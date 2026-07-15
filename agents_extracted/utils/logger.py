def agent_log(agent_name: str, msg: str, color: str = None):
    print(f"[{agent_name}] {msg}")

def step_banner(msg: str):
    print(f"\n==================== {msg} ====================\n")

def divider():
    print("-" * 60)

def kv(key: str, value: str, color: str = None):
    print(f"  {key:<20}: {value}")

def section(msg: str):
    print(f"\n--- {msg} ---")

def check_line(msg: str, passed: bool, detail: str = None):
    status = "✓" if passed else "✗"
    detail_str = f" ({detail})" if detail else ""
    print(f"  [{status}] {msg}{detail_str}")

def success_banner(campaign_id: str, campaign_name: str):
    print(f"\n★ SUCCESS: Campaign '{campaign_name}' ({campaign_id}) ★\n")
