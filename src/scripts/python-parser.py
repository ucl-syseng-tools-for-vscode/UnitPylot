import argparse
import ast
import json

class TestAnalyzer(ast.NodeVisitor):
    def __init__(self):
        self.tests = {}
        self.current_test = None

    def visit_FunctionDef(self, node):
        if node.name.startswith("test_"):
            self.current_test = node.name
            self.tests[self.current_test] = {"calls": [], "fixtures": self.get_args(node) + self.get_decorators(node)}
        self.generic_visit(node)
        self.current_test = None

    def get_args(self, node):
        return [x.arg for x in node.args.args]
    
    def get_decorators(self, node):
        return []  # TODO: Implement this

    def visit_Call(self, node):
        # Check if the call is to another test function
        if isinstance(node.func, ast.Name) and node.func.id.startswith("test_"):
            self.tests[self.current_test]["calls"].append(node.func.id)
        self.generic_visit(node)

    def analyse(self, file_path):
        with open(file_path, "r") as f:
            tree = ast.parse(f.read())
        self.visit(tree)
        return self.tests

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Analyze test functions in a Python file.")
    parser.add_argument("file_path", help="Path to the Python file to analyze")
    args = parser.parse_args()

    analyzer = TestAnalyzer()
    results = analyzer.analyse(args.file_path)
    print(json.dumps(results))