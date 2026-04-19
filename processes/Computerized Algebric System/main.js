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
      if (val instanceof ChainLink)
        throw new Error(
          "astManager.node(): received a ChainLink; caller must pass link._node",
        );
      if (val && typeof val === "object" && val.isNode) return val;
      if (typeof val === "number") return new mathjs.ConstantNode(val);
      if (typeof val === "string") return mathjs.parse(val);
      throw new Error(
        `astManager.node(): unrecognised value type "${typeof val}"; value: ${val}`,
      );
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
    //for any external callers
    substitude(target, replacement) {
      const rNode = this.node(replacement);
      return (tree) =>
        this.node(tree).transform((node) => {
          if (node.isSymbolNode && node.name === target) return rNode;
          return node;
        });
    }

    // both are mathjs node
    substituteMemory(replacementNode, treeNode) {
      if (replacementNode instanceof ChainLink || treeNode instanceof ChainLink)
        throw new Error(
          "substituteMemory: received ChainLink; pass ._node directly",
        );
      return treeNode.transform((n) => {
        if (n.isSymbolNode && n.name === "memory") return replacementNode;
        return n;
      });
    }
  }

  // Structural fingerprinting + shape cache.
  class ProxyFactory {
    constructor() {
      this._structures = new Map();
    }

    fingerprint(node) {
      if (!node?.isNode) return `lit:${node}`;
      if (node.isSymbolNode)
        return node.name === "memory" ? "__M__" : `s:${node.name}`;
      if (node.isConstantNode) return "__C__";
      if (node.isOperatorNode)
        return `op:${node.op}[${node.args.map((a) => this.fingerprint(a)).join(",")}]`;
      if (node.isFunctionNode)
        return `fn:${node.fn?.name ?? "?"}[${node.args.map((a) => this.fingerprint(a)).join(",")}]`;
      if (node.isFunctionAssignmentNode)
        return `fa:${node.name}(${node.params?.join(",")}):${this.fingerprint(node.expr)}`;
      return `?:${node.type}`;
    }

    locateMemory(node, path) {
      if (!node?.isNode) return [];
      if (node.isSymbolNode && node.name === "memory") return [[...path]];
      const found = [];
      node.args?.forEach((child, i) =>
        found.push(...this.locateMemory(child, [...path, i])),
      );
      return found;
    }

    //mathjs node
    register(node) {
      if (node instanceof ChainLink)
        throw new Error(
          "ProxyFactory.register(): received ChainLink; pass ._node",
        );
      const fp = this.fingerprint(node);
      if (!this._structures.has(fp)) {
        this._structures.set(fp, {
          fingerprint: fp,
          type: node.type,
          op: node.op ?? null,
          fnName: node.fn?.name ?? node.name ?? null,
          arity: node.args?.length ?? 0,
          memPaths: this.locateMemory(node, []),
        });
      }
      return this._structures.get(fp);
    }

    wrap(node) {
      if (!node?.isNode)
        throw new Error(
          `ProxyFactory.wrap(): expected mathjs node, got ${typeof node}`,
        );
      const struct = this.register(node);
      return new ChainLink(node, struct);
    }
  }

  //  "isNode" is false, to catch any leaked node  (idk)
  class ChainLink {
    constructor(node, struct) {
      this._node = node;
      this._struct = struct;
    }

    hasMemorySlots() {
      return this._struct.memPaths.length > 0;
    }
  }
  class SubstitutionChain {
    constructor(am, pf) {
      this.am = am;
      this.pf = pf;
      this.links = []; // ChainLink[]
    }

    push(expr) {
      // am.node() rejects ChainLink, so expr must already be a plain node/string/number.
      const node = this.am.node(expr);
      this.links.push(this.pf.wrap(node));
    }

    size() {
      return this.links.length;
    }

    estimateNodeCount() {
      let count = 0;
      const walk = (n) => {
        count++;
        n.forEach?.((c) => walk(c));
      };
      this.links.forEach((l) => {
        if (l._node?.isNode) walk(l._node);
      });
      return count;
    }

    // D&C materialisation.
    materialize(simplifyFn = (x) => x) {
      if (this.links.length === 0) return mathjs.parse("memory");
      if (this.links.length === 1) {
        return simplifyFn(this.links[0]._node);
      }

      let level = [...this.links]; // ChainLink[]

      while (level.length > 1) {
        const next = [];
        for (let i = 0; i < level.length; i += 2) {
          if (i + 1 >= level.length) {
            next.push(level[i]);
          } else {
            const left = level[i];
            const right = level[i + 1];

            if (!left.hasMemorySlots()) {
              const simplified = simplifyFn(left._node);
              next.push(this.pf.wrap(simplified));
            } else {
              const merged = this.am.substituteMemory(right._node, left._node);
              const simplified = simplifyFn(merged);
              next.push(this.pf.wrap(simplified));
            }
          }
        }
        level = next;
      }

      return level[0]._node;
    }
  }

  /*
    Key things for future devs:
    No you cant remove unused fns 
    you have not iterated through all fns,
    so maybe it is used in future.  Simplification is done individually, not collectively.
  */
  class AutoSimplification {
    constructor() {
      this.p = 0.75;
      this.p_target = 0.125;
      this.p_t_its = 5;
      this.p_t_i = 0;
      this.p_r_coff = 1.0;
      this.p_r =
        this.p * Math.pow(this.p_target / this.p, this.p_t_i / this.p_t_its);
      this.weightThreshold = 0.1;
      this.MJ_AlgB_Threshold = 0.05;
      this.MJcoff_m = 0.0625;
      this.MJcoff_a = 0.1;
      this.AlgBcoff_m = 0.0625;
      this.AlgBcoff_a = 0.12;
      this.MJ_overshoot = 0.05;
      this.MJ_overshoot_coof = 0.5;
    }

    nudgeP(delta) {
      if (delta > 0) this.p -= delta * this.p;
      else this.p -= delta * (1 - this.p);
    }

    measureWeight(main, dependencies = []) {
      let count = 0;
      const countNodes = (node) => {
        if (!node?.forEach) return;
        count++;
        node.forEach?.(countNodes);
      };
      if (main?.isNode) countNodes(main);
      Array.isArray(dependencies) &&
        dependencies.forEach((fn) => fn?.isNode && countNodes(fn));
      return 1 / (1 + Math.exp(-count / 50));
    }

    step(main, dependencies) {
      let w1 = this.measureWeight(main, dependencies);
      if (w1 < this.weightThreshold) return { main, dependencies };
      if (Math.random() > this.p) return { main, dependencies };

      const { s_main, s_dependencies } = this.simplify(main, dependencies, w1);
      const { m_main, m_dependencies } = this.mixMatch(
        [main, s_main],
        [dependencies, s_dependencies],
      );

      this.p_r =
        this.p * Math.pow(this.p_target / this.p, this.p_t_i / this.p_t_its);
      const schedDelta = this.p - this.p_r;
      this.nudgeP(schedDelta * this.p_r_coff);
      this.p_t_i++;

      return { main: m_main, dependencies: m_dependencies };
    }

    simplify(main, dependencies = [], w1) {
      let mj_main = main;
      let mj_dependencies = Array.isArray(dependencies) ? dependencies : [];
      try {
        ({ mj_main, mj_dependencies } = this.simplifyByMathJs(
          main,
          dependencies,
        ));
      } catch (e) {
        mj_main = main;
        mj_dependencies = Array.isArray(dependencies) ? dependencies : [];
      }
      let wMJ = this.measureWeight(mj_main, mj_dependencies);
      let MJ_diff = w1 - wMJ;
      this.nudgeP(this.MJcoff_a * MJ_diff);
      if (MJ_diff > this.MJ_AlgB_Threshold)
        return { s_main: mj_main, s_dependencies: mj_dependencies };

      let AlgB_main = main;
      let AlgB_dependencies = Array.isArray(dependencies) ? dependencies : [];
      try {
        ({ AlgB_main, AlgB_dependencies } = this.simplifyByAlgebriate(
          main,
          dependencies,
        ));
      } catch (e) {
        AlgB_main = main;
        AlgB_dependencies = Array.isArray(dependencies) ? dependencies : [];
      }
      let wAlgB = this.measureWeight(AlgB_main, AlgB_dependencies);
      let AlgB_Diff = w1 - wAlgB;
      this.nudgeP(this.AlgBcoff_a * AlgB_Diff);
      this.MJ_overshoot +=
        this.MJ_overshoot_coof * (this.p_t_i / this.p_t_its) * this.p_target;
      return { s_main: AlgB_main, s_dependencies: AlgB_dependencies };
    }

    mixMatch([main, s_main], [dependencies, s_dependencies]) {
      const wOriginal = this.measureWeight(main, dependencies);
      const wSimplified = this.measureWeight(s_main, s_dependencies);
      if (wSimplified < wOriginal)
        return { m_main: s_main, m_dependencies: s_dependencies };
      return { m_main: main, m_dependencies: dependencies };
    }

    obtainExpFromDependecies(dependentFns) {
      return dependentFns.map((fn) => fn.expr);
    }

    simplifyByMathJs(main, dependencies = []) {
      let newMain = mathjs.simplify(main);
      let expsDep = this.obtainExpFromDependecies(
        Array.isArray(dependencies) ? dependencies : [],
      );
      let newDep = expsDep.map((e) => mathjs.simplify(e));
      return { mj_main: newMain, mj_dependencies: newDep };
    }

    formAlgebriteFnsStr(name, params, exp) {
      const paramArr = Array.isArray(params) ? params : [params];
      return `${name}(${paramArr.join(",")}) = simplify(${exp.toString()})`;
    }

    formAlgebriteFnsStr_raw(name, prams, exp) {
      return `${name}(${prams.join(",")}) = simplify(${exp.toString()})`;
    }

    simplifyByAlgebriate(mainFn, dependentFns = []) {
      const mainExprStr = algebrite.run(`simplify(${mainFn.toString()})`);
      const newMain = mathjs.parse(mainExprStr);

      const newDeps = (Array.isArray(dependentFns) ? dependentFns : []).map(
        (fn) => {
          const simplified = algebrite.run(`simplify(${fn.expr.toString()})`);
          return new mathjs.FunctionAssignmentNode(
            fn.name,
            fn.params,
            mathjs.parse(simplified),
          );
        },
      );

      return { AlgB_main: newMain, AlgB_dependencies: newDeps };
    }
  }

  function transpileToMath(ast) {
    const am = new astManager();
    const pf = new ProxyFactory();
    const transpiler = astStatmentsTomathjs(am);
    const chain = new SubstitutionChain(am, pf);
    const simplification = new AutoSimplification();
    let dependentFns = [];

    const mergeSimplify = (node) => {
      const result = simplification.step(node, []);
      return result?.main ?? node;
    };

    for (const statement of ast.statements) {
      if (statement.type === "condition") {
        chain.push(transpiler.condition(statement));
      } else if (statement.type === "mem") {
        chain.push(transpiler.mem(statement));
      } else if (statement.type === "function") {
        const rawFn = transpiler.function(statement);
        const { main: simplified } = simplification.step(rawFn, []) ?? {
          main: rawFn,
        };
        dependentFns.push(simplified ?? rawFn);
      }
    }

    const materializedMain = chain.materialize(mergeSimplify);
    const mainFn = am.function_ast("main", "memory", materializedMain);
    return { main: mainFn, dependencies: dependentFns };
  }

  return {
    formMathAst: (ast) => transpileToMath(ast),
  };
};

export { main };
