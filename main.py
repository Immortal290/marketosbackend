"""
MarketOS — One-Click Marketing Intelligence Platform
Demo: End-to-end 4-agent campaign execution pipeline

Usage:
    python main.py                          # runs default demo campaign
    python main.py "your custom intent"     # runs with your own campaign intent
"""

import sys
import time
from dotenv import load_dotenv

load_dotenv()   # Must be first — loads .env before any agent imports

from graph.campaign_graph import campaign_graph
from utils.logger import step_banner, agent_log, divider, kv, section

# ── Default Demo Campaign ────────────────────────────────────────────────────
# Change this to anything you like — the agents adapt automatically.

DEFAULT_INTENT = (
    "Run a Diwali sale campaign for our D2C skincare brand targeting women "
    "aged 25–40 in India. We're offering 30% off our bestselling Vitamin C face serum. "
    "Budget: ₹50,000. Goal: 500 conversions in 7 days. Brand tone: warm, celebratory, premium."
)


def run_campaign(intent: str) -> dict:
    """Execute the full 4-agent pipeline for a given campaign intent."""

    print("\n")
    step_banner("MarketOS  ─  One-Click Autonomous Campaign Execution")
    print(f"  Intent: \"{intent[:90]}{'...' if len(intent) > 90 else ''}\"\n")
    print(f"  Pipeline:  Supervisor → Copy Agent → Compliance → Email Agent")
    print(f"  Provider:  {_get_provider()}")
    divider()

    initial_state = {
        "user_intent":       intent,
        "campaign_plan":     None,
        "copy_output":       None,
        "compliance_result": None,
        "send_result":       None,
        "current_step":      "supervisor",
        "errors":            [],
        "trace":             [],
    }

    start = time.time()
    result = campaign_graph.invoke(initial_state)
    elapsed = time.time() - start

    # ── Final Summary ────────────────────────────────────────────────────────
    _print_summary(result, elapsed)
    return result


def _print_summary(result: dict, elapsed: float) -> None:
    step_banner("PIPELINE COMPLETE  ─  Execution Summary")

    errors = result.get("errors", [])
    trace  = result.get("trace", [])

    section("AGENT EXECUTION TRACE")
    for entry in trace:
        status_icon = "✓" if entry.get("status") not in ("failed", "blocked") else "✗"
        print(f"  {status_icon}  [{entry['agent'].upper():>18}]  status={entry['status']}  ts={entry['timestamp'][-8:]}")

    print()
    kv("Total Pipeline Time", f"{elapsed:.2f}s")
    kv("Agents Completed",    f"{len(trace)} / 4")

    if errors:
        section("ERRORS")
        for e in errors:
            print(f"  ✗  {e}")

    # Quick metrics recap
    send = result.get("send_result")
    comp = result.get("compliance_result")
    copy = result.get("copy_output")
    plan = result.get("campaign_plan")

    if plan:
        print()
        section("CAMPAIGN SNAPSHOT")
        kv("Campaign ID",   plan.get("campaign_id", "N/A"))
        kv("Name",          plan.get("campaign_name", "N/A"))

    if copy:
        variants = copy.get("variants", [])
        selected = copy.get("selected_variant_id", "N/A")
        winner   = next((v for v in variants if v["variant_id"] == selected), None)
        if winner:
            kv("Winning Subject",  f'"{winner["subject_line"]}"')
            kv("Open Rate Est.",   f'{winner["estimated_open_rate"]:.1f}%')

    if comp:
        kv("Compliance Score",  f'{comp.get("compliance_score", 0):.1f} / 100')
        kv("Compliance Status", "✅ APPROVED" if comp.get("approved") else "🚫 BLOCKED")

    if send:
        kv("Send Status",   f'{send.get("status", "UNKNOWN")}')
        if send.get("real_email_sent"):
            kv("Real Email", "✅ SENT")

    print()


def _get_provider() -> str:
    import os
    provider = os.getenv("LLM_PROVIDER", "gemini").lower()
    if provider == "anthropic":
        return f"Anthropic Claude (claude-sonnet-4-20250514)"
    return f"Google Gemini (gemini-2.0-flash)"


# ── Entry Point ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    intent = " ".join(sys.argv[1:]).strip() if len(sys.argv) > 1 else DEFAULT_INTENT
    run_campaign(intent)
