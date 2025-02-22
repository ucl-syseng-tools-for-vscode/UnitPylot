import ast
import argparse
import json

class ParentNodeVisitor(ast.NodeVisitor):
    def __init__(self):
        self.parent_map = {}

    def visit(self, node):
        for child in ast.iter_child_nodes(node):
            self.parent_map[child] = node
            self.visit(child)

def extract_function_code(file_path: str):
    """Extracts and hashes each function and class method in the given Python file."""
    with open(file_path, "r", encoding="utf-8") as f:
        source_code = f.read()

    tree = ast.parse(source_code)
    parent_visitor = ParentNodeVisitor()
    parent_visitor.visit(tree)
    function_hashes = {}

    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):  # Matches both standalone functions and class methods
            parent = parent_visitor.parent_map.get(node)
            if isinstance(parent, ast.ClassDef):
                function_name = f"{parent.name}::{node.name}"
            else:
                function_name = node.name
            function_code = ast.unparse(node)  # Convert AST back to code
            function_hashes[function_name] = function_code

    return function_hashes

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Analyze test functions in a Python file.")
    parser.add_argument("file_path", help="Path to the Python file to analyze")
    args = parser.parse_args()
    file_path = args.file_path
    code = extract_function_code(file_path)

    print(json.dumps(code))