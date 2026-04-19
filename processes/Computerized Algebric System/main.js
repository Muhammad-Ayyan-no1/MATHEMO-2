const main = (mathjs, algebrite) => {
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

  // things to remember
  /*
  Key things for future devs
No you cant remove unused fns why? bec you have not itterated through all fns, so maybe it is used in future
so simplification is done induvidually not collectively
  */

  // console.log(algebrite.run("a + a"));
  class AutoSimplification {
    constructor() {
      this.p = 0.75;
      this.p_target = 0.125;
      this.p_t_its = 5;
      this.p_t_i = 0;
      this.p_r_coff = 1.0;
      this.p_r =
        this.p * Math.pow(this.p_target / this.p, this.p_t_i / this.p_t_its);
      this.weightThreshold = 0.3;
      this.MJ_AlgB_Threshold = 0.05;
      this.MJcoff_m = 0.0625;
      this.MJcoff_a = 0.1;
      this.AlgBcoff_m = 0.0625;
      this.AlgBcoff_a = 0.12;
      this.MJ_overshoot = 0.05;
      this.MJ_overshoot_coof = 0.5;
    }

    // delta pulls p toward 0 or 1 proportionally to remaining room
    _nudgeP(delta) {
      if (delta > 0) this.p -= delta * this.p;
      else this.p -= delta * (1 - this.p);
    }

    measureWeight(main, dependencies) {
      let count = 0;
      const countNodes = (node) => {
        count++;
        node.forEach?.(countNodes);
      };
      if (main?.isNode) countNodes(main);
      dependencies.forEach((fn) => fn?.isNode && countNodes(fn));
      return 1 / (1 + Math.exp(-count / 50));
    }

    step(main, dependencies) {
      let w1 = this.measureWeight(main, dependencies);
      if (w1 < this.weightThreshold) return { main, dependencies };
      if (Math.random() > this.p) return { main, dependencies };
      let { s_main, s_dependencies } = this.simplify(main, dependencies, w1);
      let { m_main, m_dependencies } = this.mixMatch(
        [main, s_main],
        [dependencies, s_dependencies],
      );

      this.p_r =
        this.p * Math.pow(this.p_target / this.p, this.p_t_i / this.p_t_its);
      const schedDelta = this.p - this.p_r;
      this._nudgeP(schedDelta * this.p_r_coff);
      this.p_t_i++;

      return { main: m_main, dependencies: m_dependencies };
    }

    simplify(main, dependencies, w1) {
      var mj_main, mj_dependencies;
      try {
        ({ mj_main, mj_dependencies } = this.simplifyByMathJs(
          main,
          dependencies,
        ));
      } catch (e) {}
      let wMJ = this.measureWeight(mj_main, mj_dependencies);
      let MJ_diff = w1 - wMJ;
      this._nudgeP(this.MJcoff_a * MJ_diff);
      if (MJ_diff > this.MJ_AlgB_Threshold)
        return { s_main: mj_main, s_dependencies: mj_dependencies };

      var AlgB_main, AlgB_dependencies;
      try {
        ({ AlgB_main, AlgB_dependencies } = this.simplifyByAlgebriate(
          main,
          dependencies,
        ));
      } catch (e) {}
      let wAlgB = this.measureWeight(AlgB_main, AlgB_dependencies);
      let AlgB_Diff = w1 - wAlgB;
      this._nudgeP(this.AlgBcoff_a * AlgB_Diff);
      this.MJ_overshoot +=
        this.MJ_overshoot_coof * (this.p_t_i / this.p_t_its) * this.p_target;
      return { s_main: AlgB_main, s_dependencies: AlgB_dependencies };
    }

    mixMatch([main, s_main], [dependencies, s_dependencies]) {
      const wOriginal = this.measureWeight(main, dependencies);
      const wSimplified = this.measureWeight(s_main, s_dependencies);
      if (wSimplified < wOriginal) {
        return { m_main: s_main, m_dependencies: s_dependencies };
      }
      return { m_main: main, m_dependencies: dependencies };
    }

    obtainExpFromDependecies(dependentFns) {
      let exps = [];
      for (let i = 0; i < dependentFns.length; i++) {
        exps[i] = dependentFns[i].expr;
      }
      return exps;
    }

    simplifyByMathJs(main, dependencies) {
      let newMain = mathjs.simplify(main);
      let expsDep = this.obtainExpFromDependecies(dependencies);
      let newDep = [];
      for (let i = 0; i < expsDep.length; i++) {
        newDep[i] = mathjs.simplify(expsDep[i]);
      }
      return { mj_main: newMain, mj_dependencies: newDep };
    }

    formAlgebriteFnsStr(name, params, exp) {
      const paramArr = Array.isArray(params) ? params : [params];
      return `${name}(${paramArr.join(",")}) = simplify(${exp.toString()})`;
    }

    formAlgebriteFnsStr_raw(name, prams, exp) {
      return `${name}(${prams.join(",")}) = simplify(${exp.toString()})`;
    }

    simplifyByAlgebriate(mainFn, dependentFns) {
      const mainExprStr = algebrite.run(`simplify(${mainFn.toString()})`);
      const newMain = mathjs.parse(mainExprStr);

      let newDeps = [];
      for (let i = 0; i < dependentFns.length; i++) {
        const fn = dependentFns[i];
        const simplifiedExprStr = algebrite.run(
          `simplify(${fn.expr.toString()})`,
        );
        newDeps[i] = new mathjs.FunctionAssignmentNode(
          fn.name,
          fn.params,
          mathjs.parse(simplifiedExprStr),
        );
      }
      return { AlgB_main: newMain, AlgB_dependencies: newDeps };
    }
  }

  function transpileToMath(ast) {
    const astManager_ins = new astManager();
    const transpiler = astStatmentsTomathjs(astManager_ins);
    let dependentFns = [];
    let main = "memory";
    let simplification = new AutoSimplification();

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

      ({ main, dependencies: dependentFns } = simplification.step(
        main,
        dependentFns,
      ) ?? { main, dependencies: dependentFns });
    }

    const mainFn = astManager_ins.function_ast("main", "memory", main);
    return { main: mainFn, dependencies: dependentFns };
  }

  return {
    formMathAst: (ast) => transpileToMath(ast),
  };
};

export { main };
