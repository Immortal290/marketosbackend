class MockMemory:
    def store(self, *args, **kwargs):
        pass
    def recall(self, *args, **kwargs):
        return []
    def search(self, *args, **kwargs):
        return []
    def get(self, *args, **kwargs):
        return None
    def set(self, *args, **kwargs):
        pass
    def upsert(self, *args, **kwargs):
        pass

episodic_memory = MockMemory()
semantic_memory = MockMemory()
working_memory = MockMemory()
