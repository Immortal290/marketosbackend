from core.agent_base import AgentBase

class CircuitBreaker:
    def __init__(self, *args, **kwargs):
        pass
    def __call__(self, func):
        return func

def retry(*args, **kwargs):
    def decorator(func):
        return func
    return decorator
