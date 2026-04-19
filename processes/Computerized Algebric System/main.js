const main = (mathjs) => {
  const astStatmentsTomathjs = (astManager) => {
    function formCondition(ast) {
      if (ast.statment == "if")
        return astManager.add_ast(
          astManager.multiply_ast(ast.Ifcondition, ast.IfassociatedCode),
          astManager.multiply_ast(
            astManager.subtract_ast(1, ast.Ifcondition),
            "memory",
          ),
        );
      else
        return astManager.add_ast(
          astManager.multiply_ast(ast.Ifcondition, ast.IfassociatedCode),
          astManager.multiply_ast(
            astManager.subtract_ast(1, ast.Ifcondition),
            ast.ElseAssociatedCode,
          ),
        );
    }
    function formFunction(ast) {
      return astManager.function_ast(
        ast.name,
        ast.prametersArr,
        ast.expression,
      );
    }
    function formMem(ast) {
      return astManager.function_callAst(ast.functionName, "memory");
    }
    return {
      condition: formCondition,
      function: formFunction,
      mem: formMem,
    };
  };

  class astManager {
    node(val) {
      if (val && typeof val === "object" && val.isNode) return val;
      if (typeof val === "number") return new mathjs.ConstantNode(val);
      if (typeof val === "string") return new mathjs.SymbolNode(val);
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
      const paramNodes = (Array.isArray(params) ? params : [params]).map(
        (p) => new mathjs.SymbolNode(p),
      );
      const fnSymbol = new mathjs.SymbolNode(name);
      const callLhs = new mathjs.FunctionNode(fnSymbol, paramNodes);
      return new mathjs.AssignmentNode(callLhs, this.node(expr));
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
    let astManager_ins = new astManager();
    let transpiler = astStatmentsToMath(astManager_ins);
    let dependentFns = [];
    let main = "memory";

    for (let i = 0; i < ast.statments.length; i++) {
      let statment = ast.statments[i];
      if (statment.type == "condition") {
        const substitute = astManager_ins.substitude(
          "memory",
          transpiler.condition(statment),
        );
        main = substitute(main);
      } else if (statment.type == "mem") {
        const substitute = astManager_ins.substitude(
          "memory",
          transpiler.mem(statment),
        );
        main = substitute(main);
      } else if (statment.type == "function") {
        dependentFns.push(transpiler.function(statment));
      }
    }

    let mainFn = astManager_ins.function_ast("main", "memory", main);
    return {
      main: mainFn,
      dependencies: dependentFns,
    };
  }

  return {
    formMathAst: (ast) => {
      console.log(ast);
      return ast;
    },
  };
};

export { main };
