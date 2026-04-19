const main = (mathjs) => {
  const astStatmentsTomathjs = (astManager) => {
    function formCondition(ast) {
      const branch = ast.statement === "if" ? "memory" : ast.ElseAssociatedCode;
      return astManager.add_ast(
        astManager.multiply_ast(ast.Ifcondition, ast.IfassociatedCode),
        astManager.multiply_ast(
          astManager.subtract_ast(1, ast.Ifcondition),
          branch,
        ),
      );
    }
    function formFunction(ast) {
      return astManager.function_ast(ast.name, ast.parameters, ast.expression);
    }
    function formMem(ast) {
      return astManager.function_callAst(ast.functionName, "memory");
    }
    return { condition: formCondition, function: formFunction, mem: formMem };
  };

  class astManager {
    node(val) {
      if (val && typeof val === "object" && val.isNode) return val;
      if (typeof val === "number") return new mathjs.ConstantNode(val);

      if (typeof val === "string") return mathjs.parse(val);
    }
    add_ast(a, b) {
      return new mathjs.OperatorNode("+", "add", [this.node(a), this.node(b)]);
    }
    subtract_ast(a, b) {
      return new mathjs.OperatorNode("-", "subtract", [
        this.node(a),
        this.node(b),
      ]);
    }
    multiply_ast(a, b) {
      return new mathjs.OperatorNode("*", "multiply", [
        this.node(a),
        this.node(b),
      ]);
    }
    function_ast(name, params, expr) {
      const paramNames = (Array.isArray(params) ? params : [params]).map((p) =>
        typeof p === "string" ? p : p.name,
      );
      return new mathjs.FunctionAssignmentNode(
        name,
        paramNames,
        this.node(expr),
      );
    }
    function_callAst(name, arg) {
      return new mathjs.FunctionNode(new mathjs.SymbolNode(name), [
        this.node(arg),
      ]);
    }
    substitude(target, replacement) {
      const replacementNode = this.node(replacement);
      return (tree) =>
        this.node(tree).transform((node) => {
          if (node.isSymbolNode && node.name === target) return replacementNode;
          return node;
        });
    }
  }

  function transpileToMath(ast) {
    const astManager_ins = new astManager();
    const transpiler = astStatmentsTomathjs(astManager_ins);
    const dependentFns = [];
    let main = "memory";

    for (const statement of ast.statements) {
      if (statement.type === "condition") {
        const substitute = astManager_ins.substitude(
          "memory",
          transpiler.condition(statement),
        );
        main = substitute(main);
      } else if (statement.type === "mem") {
        const substitute = astManager_ins.substitude(
          "memory",
          transpiler.mem(statement),
        );
        main = substitute(main);
      } else if (statement.type === "function") {
        dependentFns.push(transpiler.function(statement));
      }
    }

    const mainFn = astManager_ins.function_ast("main", "memory", main);
    return { main: mainFn, dependencies: dependentFns };
  }

  return {
    formMathAst: (ast) => transpileToMath(ast),
  };
};

export { main };
