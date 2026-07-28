"""
MarketOS — Terminal Logger
Colored, timestamped output for every agent step.
Designed to make demo output look professional in a terminal.
"""

from datetime import datetime, timezone

C = {
    "RESET":   "\033[0m",
    "BOLD":    "\033[1m",
    "DIM":     "\033[2m",
    "CYAN":    "\033[96m",
    "GREEN":   "\033[92m",
    "YELLOW":  "\033[93m",
    "RED":     "\033[91m",
    "MAGENTA": "\033[95m",
    "BLUE":    "\033[94m",
    "WHITE":   "\033[97m",
}

AGENT_COLORS = {
    "SUPERVISOR":  C["MAGENTA"],
    "COPY":        C["CYAN"],
    "COMPLIANCE":  C["YELLOW"],
    "EMAIL":       C["GREEN"],
    "GRAPH":       C["BLUE"],
    "SYSTEM":      C["WHITE"],
}


def _ts() -> str:
    return datetime.now(timezone.utc).strftime("%H:%M:%S.%f")[:-3]


def agent_log(agent: str, message: str) -> None:
    color = AGENT_COLORS.get(agent.upper(), C["WHITE"])
    ts    = f"{C['DIM']}[{_ts()}]{C['RESET']}"
    tag   = f"{color}{C['BOLD']}[{agent.upper():>11}]{C['RESET']}"
    print(f"{ts} {tag}  {message}")


def step_banner(title: str) -> None:
    bar = "━" * 64
    print(f"\n{C['BOLD']}{C['BLUE']}{bar}")
    print(f"  {title}")
    print(f"{bar}{C['RESET']}\n")


def kv(label: str, value: str, color: str = "CYAN", indent: int = 2) -> None:
    pad = " " * indent
    color_code = C.get(color.upper(), C["CYAN"])
    print(f"{pad}{C['DIM']}│{C['RESET']}  {C['BOLD']}{label}:{C['RESET']}  {color_code}{value}{C['RESET']}")


def check_line(label: str, passed: bool, detail: str = "") -> None:
    icon   = f"{C['GREEN']}✓{C['RESET']}" if passed else f"{C['RED']}✗{C['RESET']}"
    sev    = f"  {C['DIM']}{detail}{C['RESET']}" if detail else ""
    print(f"  {icon}  {label}{sev}")


def section(title: str) -> None:
    print(f"\n  {C['BOLD']}{C['WHITE']}{title}{C['RESET']}")
    print(f"  {'─' * (len(title) + 2)}")


def divider() -> None:
    print(f"\n{C['DIM']}{'·' * 64}{C['RESET']}\n")


def success_banner(campaign_id: str, campaign_name: str) -> None:
    bar = "═" * 64
    print(f"\n{C['BOLD']}{C['GREEN']}{bar}")
    print(f"  ✅  CAMPAIGN LIVE — {campaign_id}")
    print(f"  {campaign_name}")
    print(f"{bar}{C['RESET']}\n")


def error_banner(message: str) -> None:
    print(f"\n{C['BOLD']}{C['RED']}  ✗  PIPELINE ERROR: {message}{C['RESET']}\n")
