"""
MarketOS — Three-Tier Agent Memory
PRD §3.4: Every agent has three memory tiers.

┌─────────────────┬───────────────┬──────────────────────────────────────────┐
│ Tier            │ Storage       │ Contents                                 │
├─────────────────┼───────────────┼──────────────────────────────────────────┤
│ Working Memory  │ Redis (2h)    │ Current task context, in-progress state  │
│ Episodic Memory │ pgvector perm │ Past campaign outcomes, A/B test results │
│ Semantic Memory │ pgvector perm │ Brand guidelines, personas, approved msg │
└─────────────────┴───────────────┴──────────────────────────────────────────┘

Embeddings: Google text-embedding-004 (768 dim, free, high quality)
            Falls back to simple TF-IDF hashing if API unavailable.
"""

from __future__ import annotations

import hashlib
import json
import os
import time
from datetime import datetime
from typing import Any, Optional

from utils.logger import agent_log

# ── Optional deps (graceful degradation) ────────────────────────────────────
try:
    import redis as redis_lib
    REDIS_AVAILABLE = True
except ImportError:
    REDIS_AVAILABLE = False

PG_AVAILABLE = False
try:
    import psycopg2
    import psycopg2.extras
    PG_AVAILABLE = True
except ImportError:
    pass

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
PG_DSN    = os.getenv("DATABASE_URL", "postgresql://marketos:marketos_dev@localhost:5433/marketos")
WORKSPACE = os.getenv("DEFAULT_WORKSPACE_ID", "default")


# ── Memory event counters (for demo verification) ───────────────────────────

_memory_stats = {
    "episodic_stores": 0,
    "episodic_recalls": 0,
    "semantic_upserts": 0,
    "semantic_searches": 0,
    "working_sets": 0,
    "working_deletes": 0,
}


def get_memory_stats() -> dict:
    return dict(_memory_stats)


def reset_memory_stats() -> None:
    for k in _memory_stats:
        _memory_stats[k] = 0


# ── Working Memory (Redis) ───────────────────────────────────────────────────

class WorkingMemory:
    """
    Redis-backed working memory for a single agent task.
    TTL: 2 hours (auto-extended on writes).
    Key pattern: wm:{workspace}:{agent}:{task_id}
    """

    TTL_SECONDS = 7200  # 2 hours per PRD

    def __init__(self):
        self._redis = None
        self._local: dict = {}   # in-memory fallback

        if REDIS_AVAILABLE:
            try:
                self._redis = redis_lib.from_url(REDIS_URL, decode_responses=True)
                self._redis.ping()
                agent_log("MEMORY", "Working memory: Redis connected")
            except Exception as e:
                agent_log("MEMORY", f"Redis unavailable ({e}) — using in-process dict fallback")
                self._redis = None

    def _key(self, agent: str, task_id: str) -> str:
        return f"wm:{WORKSPACE}:{agent}:{task_id}"

    def set(self, agent: str, task_id: str, data: dict) -> None:
        _memory_stats["working_sets"] += 1
        key = self._key(agent, task_id)
        value = json.dumps(data)
        if self._redis:
            try:
                self._redis.setex(key, self.TTL_SECONDS, value)
            except Exception:
                self._local[key] = value
        else:
            self._local[key] = value

    def get(self, agent: str, task_id: str) -> Optional[dict]:
        key = self._key(agent, task_id)
        raw = None
        if self._redis:
            try:
                raw = self._redis.get(key)
            except Exception:
                raw = self._local.get(key)
        else:
            raw = self._local.get(key)
        return json.loads(raw) if raw else None

    def extend_ttl(self, agent: str, task_id: str) -> None:
        """Extend TTL on active tasks to prevent expiry mid-execution."""
        key = self._key(agent, task_id)
        if self._redis:
            try:
                self._redis.expire(key, self.TTL_SECONDS)
            except Exception:
                pass

    def delete(self, agent: str, task_id: str) -> None:
        _memory_stats["working_deletes"] += 1
        key = self._key(agent, task_id)
        if self._redis:
            try:
                self._redis.delete(key)
            except Exception:
                self._local.pop(key, None)
        else:
            self._local.pop(key, None)

    def distributed_lock(self, lock_name: str, ttl: int = 30) -> bool:
        """
        Acquire a distributed lock (used by Email Agent to prevent duplicate sends).
        Returns True if lock acquired, False if already held.
        """
        if not self._redis:
            return True  # no-op in fallback mode
        key = f"lock:{WORKSPACE}:{lock_name}"
        try:
            return bool(self._redis.set(key, "1", nx=True, ex=ttl))
        except Exception:
            return True

    def release_lock(self, lock_name: str) -> None:
        if self._redis:
            try:
                self._redis.delete(f"lock:{WORKSPACE}:{lock_name}")
            except Exception:
                pass


# ── Embedding Generation ─────────────────────────────────────────────────────

def _get_embedding(text: str) -> list[float]:
    """
    Generate a 768-dim embedding using Google text-embedding-004.
    Falls back to a deterministic 768-dim hash vector if unavailable.
    """
    api_key = os.getenv("GEMINI_API_KEY")
    if api_key:
        try:
            import urllib.request
            # Use models/gemini-embedding-001 as confirmed by your available models list
            # Embedding endpoint: https://generativelanguage.googleapis.com/v1beta/models/{model}:embedContent
            url = (
                "https://generativelanguage.googleapis.com/v1beta/"
                f"models/gemini-embedding-001:embedContent?key={api_key}"
            )
            payload = json.dumps({
                "model": "models/gemini-embedding-001",
                "content": {"parts": [{"text": text[:3000]}]},
                "task_type": "RETRIEVAL_DOCUMENT",
                "output_dimensionality": 768  # Crucial: Must match pgvector 768-dim schema
            }).encode()
            req = urllib.request.Request(url, data=payload, headers={"Content-Type": "application/json"})
            with urllib.request.urlopen(req, timeout=10) as resp:
                data = json.loads(resp.read())
            return data["embedding"]["values"]
        except Exception as e:
            agent_log("MEMORY", f"Embedding API failed ({e}) — using hash fallback")

    # Deterministic hash fallback: 768 floats derived from text hash
    h = hashlib.sha256(text.encode()).digest()
    base = [((b / 255.0) - 0.5) * 2 for b in h]
    # Stretch to 768 dims by repeating with phase shift
    result = []
    for i in range(768):
        result.append(base[i % 32] * (1 + (i // 32) * 0.01))
    return result


# ── Episodic Memory (pgvector) ───────────────────────────────────────────────

class EpisodicMemory:
    """
    Permanent store of past campaign outcomes.
    Enables agents to learn from history via semantic similarity search.
    """

    def _conn(self):
        if not PG_AVAILABLE:
            return None
        try:
            return psycopg2.connect(PG_DSN)
        except Exception as e:
            agent_log("MEMORY", f"PostgreSQL connection failed: {e}")
            return None

    def store(
        self,
        agent_name:  str,
        event_type:  str,
        summary:     str,
        metadata:    Optional[dict] = None,
    ) -> bool:
        """Store a campaign outcome as an embedding."""
        _memory_stats["episodic_stores"] += 1
        conn = self._conn()
        if not conn:
            agent_log("MEMORY", f"Episodic store skipped (no DB): {summary[:60]}...")
            return False
        try:
            embedding = _get_embedding(summary)
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO agent_episodic_memory
                        (workspace_id, agent_name, event_type, summary, embedding, metadata)
                    VALUES (%s, %s, %s, %s, %s::vector, %s)
                """, (
                    WORKSPACE, agent_name, event_type, summary,
                    f"[{','.join(str(v) for v in embedding)}]",
                    json.dumps(metadata or {}),
                ))
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            agent_log("MEMORY", f"Episodic store failed: {e}")
            try:
                conn.close()
            except Exception:
                pass
            return False

    def recall(
        self,
        agent_name:  str,
        query:       str,
        top_k:       int = 5,
    ) -> list[dict]:
        """
        Retrieve the most semantically similar past outcomes.
        Used by agents at task start to inform current decisions.
        """
        _memory_stats["episodic_recalls"] += 1
        conn = self._conn()
        if not conn:
            return []
        try:
            embedding = _get_embedding(query)
            vec_str   = f"[{','.join(str(v) for v in embedding)}]"
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                cur.execute("""
                    SELECT summary, event_type, metadata, created_at,
                           1 - (embedding <=> %s::vector) AS similarity
                    FROM agent_episodic_memory
                    WHERE workspace_id = %s AND agent_name = %s
                    ORDER BY embedding <=> %s::vector
                    LIMIT %s
                """, (vec_str, WORKSPACE, agent_name, vec_str, top_k))
                rows = cur.fetchall()
            conn.close()
            return [dict(r) for r in rows]
        except Exception as e:
            agent_log("MEMORY", f"Episodic recall failed: {e}")
            try:
                conn.close()
            except Exception:
                pass
            return []


# ── Semantic Memory (brand brain) ─────────────────────────────────────────────

class SemanticMemory:
    """
    Brand knowledge base: guidelines, personas, approved messaging.
    All agents query this before generating content.
    """

    def _conn(self):
        if not PG_AVAILABLE:
            return None
        try:
            return psycopg2.connect(PG_DSN)
        except Exception as e:
            agent_log("MEMORY", f"PostgreSQL connection failed: {e}")
            return None

    def upsert(self, category: str, key: str, content: str) -> bool:
        _memory_stats["semantic_upserts"] += 1
        conn = self._conn()
        if not conn:
            agent_log("MEMORY", f"Semantic upsert skipped (no DB): {category}/{key}")
            return False
        try:
            embedding = _get_embedding(f"{category} {key}: {content}")
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO agent_semantic_memory
                        (workspace_id, category, key, content, embedding, updated_at)
                    VALUES (%s, %s, %s, %s, %s::vector, NOW())
                    ON CONFLICT (workspace_id, category, key) DO UPDATE
                    SET content = EXCLUDED.content,
                        embedding = EXCLUDED.embedding,
                        updated_at = NOW()
                """, (
                    WORKSPACE, category, key, content,
                    f"[{','.join(str(v) for v in embedding)}]",
                ))
            conn.commit()
            conn.close()
            return True
        except Exception as e:
            agent_log("MEMORY", f"Semantic upsert failed: {e}")
            try:
                conn.close()
            except Exception:
                pass
            return False

    def search(self, query: str, category: Optional[str] = None, top_k: int = 3) -> list[dict]:
        _memory_stats["semantic_searches"] += 1
        conn = self._conn()
        if not conn:
            return []
        try:
            embedding = _get_embedding(query)
            vec_str   = f"[{','.join(str(v) for v in embedding)}]"
            with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
                if category:
                    cur.execute("""
                        SELECT category, key, content,
                               1 - (embedding <=> %s::vector) AS similarity
                        FROM agent_semantic_memory
                        WHERE workspace_id = %s AND category = %s
                        ORDER BY embedding <=> %s::vector
                        LIMIT %s
                    """, (vec_str, WORKSPACE, category, vec_str, top_k))
                else:
                    cur.execute("""
                        SELECT category, key, content,
                               1 - (embedding <=> %s::vector) AS similarity
                        FROM agent_semantic_memory
                        WHERE workspace_id = %s
                        ORDER BY embedding <=> %s::vector
                        LIMIT %s
                    """, (vec_str, WORKSPACE, vec_str, top_k))
                rows = cur.fetchall()
            conn.close()
            return [dict(r) for r in rows]
        except Exception as e:
            agent_log("MEMORY", f"Semantic search failed: {e}")
            try:
                conn.close()
            except Exception:
                pass
            return []


# ── Module-level singletons ───────────────────────────────────────────────────

working_memory  = WorkingMemory()
episodic_memory = EpisodicMemory()
semantic_memory = SemanticMemory()
