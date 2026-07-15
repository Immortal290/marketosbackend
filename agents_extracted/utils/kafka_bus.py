class TopicsMeta(type):
    def __getattr__(cls, name):
        return f"agent.{name.lower()}"

class Topics(metaclass=TopicsMeta):
    SUPERVISOR_TASKS = "agent.supervisor.tasks"
    SUPERVISOR_RESULTS = "agent.supervisor.results"
    COPY_RESULTS = "agent.copy.results"
    COMPLIANCE_RESULTS = "agent.compliance.results"
    CONTACT_EVENTS = "agent.contact.events"
    SEND_STATS = "agent.send.stats"
    CAMPAIGN_EVENTS = "campaign.events"

def publish_event(topic: str, source_agent: str, payload: dict, priority: str = "NORMAL"):
    print(f"[Kafka Bus] Publish to '{topic}' from '{source_agent}' (Priority: {priority}) -> {payload}")
