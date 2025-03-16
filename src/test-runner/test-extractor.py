import ast
import sys
import json

'''
    This Python file outputs the functions called by tests in a given test file.
'''
def get_imported_functions(file_path):
    """Extract functions that are imported in the test file."""
    imported_functions = {}
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            tree = ast.parse(f.read(), filename=file_path)

        for node in ast.walk(tree):
            if isinstance(node, ast.ImportFrom):  # Handle from ... import ... syntax
                for alias in node.names:
                    imported_functions[alias.name] = set()

        return imported_functions
    except Exception as e:
        return {}

class ParentNodeVisitor(ast.NodeVisitor):
    def __init__(self):
        self.parent_map = {}

    def visit(self, node):
        for child in ast.iter_child_nodes(node):
            self.parent_map[child] = node
            self.visit(child)

class TestAnalyzer(ast.NodeVisitor):
    def __init__(self):
        self.tests = {}
        self.current_test = None
        self.parent_map = {}

    def visit_FunctionDef(self, node):
        if node.name.startswith("test_"):
            parent = self.parent_map.get(node)
            if isinstance(parent, ast.ClassDef):
                self.current_test = f"{parent.name}::{node.name}"
            else:
                self.current_test = node.name
            self.tests[self.current_test] = set()
        
        self.generic_visit(node)
        self.current_test = None

    def get_args(self, node):
        return [x.arg for x in node.args.args]

    def visit_Call(self, node):
        # Check if the call is to another test function
        if isinstance(node.func, ast.Name):
            if self.current_test is not None:
                self.tests[self.current_test].add(node.func.id)
        self.generic_visit(node)

def analyze_tests(file_path: str):
    with open(file_path, "r", encoding="utf-8") as f:
        source_code = f.read()

    tree = ast.parse(source_code)
    parent_visitor = ParentNodeVisitor()
    parent_visitor.visit(tree)

    analyzer = TestAnalyzer()
    analyzer.parent_map = parent_visitor.parent_map
    analyzer.visit(tree)

    return analyzer.tests

def get_functions_and_associated_tests(test_file_path):
    function_tests = get_imported_functions(test_file_path)

    analyzer = TestAnalyzer()
    results = analyze_tests(test_file_path)

    for function, calls in results.items():
        for call in calls:
            if function_tests.get(call) is not None:

                function_tests[call].add(function)

    for function, calls in function_tests.items():
        function_tests[function] = list(calls)

    return function_tests

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({}))
        sys.exit(1)

    test_file_path = sys.argv[1]

    # Get the dictionary of function calls and their associated test functions
    result = get_functions_and_associated_tests(test_file_path)

    # Print the result as a JSON object
    print(json.dumps(result))  # Returning the dictionary
