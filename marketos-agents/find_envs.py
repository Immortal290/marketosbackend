import os
import ast
import glob

def find_getenv(file_path):
    with open(file_path, "r", encoding="utf-8") as f:
        try:
            tree = ast.parse(f.read())
        except:
            return []
    
    envs = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Call):
            if isinstance(node.func, ast.Attribute) and node.func.attr in ('getenv', 'environ'):
                if node.args and isinstance(node.args[0], ast.Constant):
                    envs.append(node.args[0].value)
            elif isinstance(node.func, ast.Name) and node.func.id == 'getenv':
                 if node.args and isinstance(node.args[0], ast.Constant):
                    envs.append(node.args[0].value)
        elif isinstance(node, ast.Subscript):
            if isinstance(node.value, ast.Attribute) and node.value.attr == 'environ':
                if isinstance(node.slice, ast.Constant):
                    envs.append(node.slice.value)
    return envs

all_envs = set()
for root, dirs, files in os.walk("/home/sam/marketosbackend-1/agents"):
    for file in files:
        if file.endswith(".py"):
            envs = find_getenv(os.path.join(root, file))
            all_envs.update(envs)

print("ALL ENV VARS:", sorted(list(all_envs)))
