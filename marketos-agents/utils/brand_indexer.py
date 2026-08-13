import json
from utils.rag import upsert_brand_chunk
from utils.logger import agent_log

def index_brand_profile(brand_profile: dict):
    """
    Takes a structured BrandProfile dict, chunks it into semantic sections,
    and inserts them into the pgvector knowledge base.
    """
    brand_id = brand_profile.get("id")
    if not brand_id:
        agent_log("INDEXER", "Skipping index: no brand_profile.id found")
        return
        
    business_name = brand_profile.get("businessName", "Brand")
    
    # 1. Core Identity & Voice
    identity_parts = []
    if brand_profile.get("mission"): identity_parts.append(f"Mission: {brand_profile['mission']}")
    if brand_profile.get("usp"): identity_parts.append(f"Unique Selling Proposition: {brand_profile['usp']}")
    if brand_profile.get("positioning"): identity_parts.append(f"Positioning: {brand_profile['positioning']}")
    
    if identity_parts:
        upsert_brand_chunk(
            brand_id, 
            "brand_identity", 
            f"{business_name} Core Identity:\n" + "\n".join(identity_parts)
        )
        
    # 2. Voice Guidelines
    voice_parts = []
    if brand_profile.get("voiceAdjectives"): 
        voice_parts.append(f"Tone Adjectives: {', '.join(brand_profile['voiceAdjectives'])}")
    if brand_profile.get("voiceDos"): 
        voice_parts.append(f"Do's: {', '.join(brand_profile['voiceDos'])}")
    if brand_profile.get("voiceDonts"): 
        voice_parts.append(f"Don'ts: {', '.join(brand_profile['voiceDonts'])}")
        
    if voice_parts:
        upsert_brand_chunk(
            brand_id, 
            "brand_voice", 
            f"{business_name} Voice Guidelines:\n" + "\n".join(voice_parts)
        )
        
    # 3. Personas
    personas = brand_profile.get("personas", [])
    for p in personas:
        if p.get("name"):
            text = f"Persona: {p['name']}\nDemographics: {p.get('demographics', '')}\nPain Points: {p.get('painPoints', '')}\nGoals: {p.get('goals', '')}"
            upsert_brand_chunk(brand_id, "persona", text, metadata={"persona_name": p["name"]})
            
    # 4. Past Campaign References
    past_refs = brand_profile.get("pastCampaignRefs", [])
    for ref in past_refs:
        if ref.get("description"):
            upsert_brand_chunk(
                brand_id, 
                "past_campaign", 
                f"Historical Campaign Ref: {ref['description']}", 
                metadata={"url": ref.get("url")}
            )
            
    agent_log("INDEXER", f"Successfully indexed BrandProfile {brand_id} for {business_name}")
