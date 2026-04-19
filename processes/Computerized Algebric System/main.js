const main = (mathjs, algebrite) => {
  // ─── unchanged: statement → mathjs AST builders ───────────────────────────
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

  // ─── astManager ───────────────────────────────────────────────────────────
  class astManager {
    node(val) {
      if (val instanceof ProxiedNode) return val._node; // unwrap first
      if (val && typeof val === "object" && val.isNode) return val;
      if (typeof val === "number") return new mathjs.ConstantNode(val);
      if (typeof val === "string") return mathjs.parse(val);
      throw new Error(
        `astManager.node(): unrecognised value type "${typeof val}" — value: ${val}`,
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
    // kept for any external callers
    substitude(target, replacement) {
      const rNode = this.node(replacement);
      return (tree) =>
        this.node(tree).transform((node) => {
          if (node.isSymbolNode && node.name === target) return rNode;
          return node;
        });
    }
    // Unwraps both sides before transforming so mathjs never sees ProxiedNode
    // internals. Returns a plain mathjs node (caller re-wraps if needed).
    substituteMemory(replacement, tree) {
      const rNode = this.node(replacement); // unwraps ProxiedNode if needed
      const tNode = this.node(tree); // unwraps ProxiedNode if needed
      return tNode.transform((n) => {
        if (n.isSymbolNode && n.name === "memory") return rNode;
        return n;
      });
    }
  }

  // ─── ProxyFactory ─────────────────────────────────────────────────────────
  //
  // Structural fingerprinting + shape cache.
  //
  // Problem: mathjs.simplify() and algebrite both need real node objects /
  // strings.  We can't hand them our internal chain directly.  But we also
  // don't want to materialise the whole chain just to let them traverse it.
  //
  // Solution: ProxyFactory gives every chain link a cached "structure
  // descriptor" (shape, operator, memory-slot positions) computed once.
  // ProxiedNode wraps the link and forwards every mathjs traversal call
  // straight to the underlying node — no re-discovery of structure needed.
  // When a new structural shape arrives the factory stores it; if the same
  // shape appears again (very common with repeated conditions) the cached
  // descriptor is returned instantly.
  //
  class ProxyFactory {
    constructor() {
      this._structures = new Map(); // fingerprint → StructureDescriptor
    }

    // Structural fingerprint: captures shape but NOT constant values.
    // Two nodes with the same operator tree but different constants share
    // the same fingerprint — their shapes are identical.
    _fingerprint(node) {
      if (!node?.isNode) return `lit:${node}`;
      if (node.isSymbolNode)
        return node.name === "memory" ? "__M__" : `s:${node.name}`;
      if (node.isConstantNode) return "__C__";
      if (node.isOperatorNode)
        return `op:${node.op}[${node.args.map((a) => this._fingerprint(a)).join(",")}]`;
      if (node.isFunctionNode)
        return `fn:${node.fn?.name ?? "?"}[${node.args.map((a) => this._fingerprint(a)).join(",")}]`;
      if (node.isFunctionAssignmentNode)
        return `fa:${node.name}(${node.params?.join(",")}):${this._fingerprint(node.expr)}`;
      return `?:${node.type}`;
    }

    // Walk the node once and record every path that leads to a "memory" leaf.
    // path is an array of child indices from the root.
    // These paths let the chain know in O(1) whether a link has memory slots.
    _locateMemory(node, path) {
      if (!node?.isNode) return [];
      if (node.isSymbolNode && node.name === "memory") return [[...path]];
      const found = [];
      node.args?.forEach((child, i) =>
        found.push(...this._locateMemory(child, [...path, i])),
      );
      return found;
    }

    // Register a node: compute & cache its descriptor if we haven't seen
    // this shape before, then return the descriptor.
    // Accepts plain nodes only — callers must unwrap ProxiedNode before calling.
    register(node) {
      const fp = this._fingerprint(node);
      if (!this._structures.has(fp)) {
        this._structures.set(fp, {
          fingerprint: fp,
          type: node.type,
          op: node.op ?? null,
          fnName: node.fn?.name ?? node.name ?? null,
          arity: node.args?.length ?? 0,
          // pre-located memory paths — [] means no memory slots (terminal)
          memPaths: this._locateMemory(node, []),
        });
      }
      return this._structures.get(fp);
    }

    // Wrap a mathjs node in a ProxiedNode that carries the cached descriptor.
    wrap(node) {
      if (!node?.isNode) return node;
      const struct = this.register(node);
      return new ProxiedNode(node, struct);
    }
  }

  // ─── ProxiedNode ──────────────────────────────────────────────────────────
  //
  // Thin wrapper that makes a raw mathjs node behave exactly like a mathjs
  // node while carrying the pre-computed StructureDescriptor.
  //
  // Why not use a JS Proxy?  mathjs does instanceof checks internally.
  // A hand-rolled wrapper that simply forwards every property/method is
  // safer and does not break on mathjs version changes.
  //
  // Both mathjs.simplify() and algebrite receive either a ProxiedNode
  // (forwarded transparently) or a plain materialized node — neither
  // ever sees our internal chain representation.
  //
  class ProxiedNode {
    constructor(node, struct) {
      this._node = node;
      this._struct = struct; // StructureDescriptor from ProxyFactory
      // mirror the fields mathjs checks directly
      this.isNode = true;
      this.type = node.type;
      this.op = node.op;
      this.fn = node.fn;
      this.name = node.name;
      this.value = node.value;
      this.expr = node.expr;
      this.params = node.params;
    }
    // lazy: only accessed when mathjs actually walks children
    get args() {
      return this._node.args;
    }
    transform(fn) {
      return this._node.transform(fn);
    }
    forEach(fn) {
      return this._node.forEach(fn);
    }
    map(fn) {
      return this._node.map(fn);
    }
    toString() {
      return this._node.toString();
    }
    compile() {
      return this._node.compile();
    }
    evaluate(scope) {
      return this._node.evaluate(scope);
    }
    // escape hatch: get the raw mathjs node back
    unwrap() {
      return this._node;
    }
    // O(1) check from the pre-computed descriptor — no re-walk needed
    hasMemorySlots() {
      return this._struct.memPaths.length > 0;
    }
  }

  // ─── SubstitutionChain ────────────────────────────────────────────────────
  //
  // Key insight:
  //   Original code:  main = substitute("memory", eN)(main)
  //   ↳ walks the ENTIRE growing main tree at every step → O(K^N)
  //
  //   New approach:   chain.push(eN)
  //   ↳ O(1) per statement; tree never touched during the loop.
  //
  // The chain represents the composition:
  //   e1[ memory := e2[ memory := e3[ … eN ] ] ]
  // i.e. e1 is the outermost shell, eN is the deepest filler.
  //
  // Materialisation via D&C:
  //   [e1, e2, e3, e4]
  //   →  level1: [ e1[m:=e2],  e3[m:=e4]  ]   ← simplify each pair
  //   →  level2: [ e1[m:=e2[m:=e3[m:=e4]]] ]   ← simplify final
  //
  // Cost: O(N log N) substitute calls, each on a chunk that has been
  // independently simplified, so chunk sizes stay bounded.
  //
  class SubstitutionChain {
    constructor(am, pf) {
      this.am = am;
      this.pf = pf;
      this.links = []; // ProxiedNodes — carry descriptor, wrap raw mathjs node
    }

    // O(1) — registers shape, wraps in ProxiedNode, stores.
    // No tree walk beyond what ProxyFactory.register() does once per shape.
    push(expr) {
      const node = this.am.node(expr); // always a plain mathjs node here
      const wrapped = this.pf.wrap(node);
      this.links.push(wrapped);
    }

    size() {
      return this.links.length;
    }

    // Count total nodes across all links WITHOUT materialising.
    // Used by AutoSimplification.measureWeight as a fast approximation.
    // Unwraps ProxiedNodes so forEach works correctly.
    estimateNodeCount() {
      let count = 0;
      const walk = (n) => {
        count++;
        n.forEach?.((c) => walk(c));
      };
      this.links.forEach((l) => {
        const raw = l instanceof ProxiedNode ? l._node : l;
        if (raw?.isNode) walk(raw);
      });
      return count;
    }

    // D&C materialisation.
    // simplifyFn: (mathjsNode) → mathjsNode — called on every merged chunk.
    // Terminal links (no memory slots) are passed through without merge cost.
    //
    // ProxiedNode.hasMemorySlots() is the gating check — O(1) from the
    // pre-computed descriptor, no re-walk of the node tree.
    // After each merge the result is re-wrapped so the next level still gets
    // a ProxiedNode with an up-to-date descriptor.
    materialize(simplifyFn = (x) => x) {
      if (this.links.length === 0) return mathjs.parse("memory");
      if (this.links.length === 1) {
        const only = this.links[0];
        return simplifyFn(only instanceof ProxiedNode ? only._node : only);
      }

      let level = [...this.links]; // array of ProxiedNodes

      while (level.length > 1) {
        const next = [];
        for (let i = 0; i < level.length; i += 2) {
          if (i + 1 >= level.length) {
            // odd tail — carry to next level unchanged
            next.push(level[i]);
          } else {
            const left = level[i]; // ProxiedNode
            const right = level[i + 1]; // ProxiedNode

            // O(1) guard: descriptor already has memPaths computed.
            // If left has no memory slots the substitution is a no-op;
            // drop right (its contribution goes into a slot that doesn't exist).
            if (!left.hasMemorySlots()) {
              const simplified = simplifyFn(left._node);
              // re-wrap so next level gets a ProxiedNode
              next.push(this.pf.wrap(simplified));
            } else {
              // left[ memory := right ]
              // substituteMemory unwraps both sides internally.
              const merged = this.am.substituteMemory(right, left);
              const simplified = simplifyFn(merged);
              // re-wrap merged+simplified result for next level
              next.push(this.pf.wrap(simplified));
            }
          }
        }
        level = next;
      }

      // Final element: unwrap to return a plain mathjs node to the caller
      const final = level[0];
      return final instanceof ProxiedNode ? final._node : final;
    }
  }

  /*
    Key things for future devs:
    No you cant remove unused fns — you have not iterated through all fns,
    so maybe it is used in future.  Simplification is done individually,
    not collectively.
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
      // this.weightThreshold = 0.1;
      this.weightThreshold = 0;
      this.MJ_AlgB_Threshold = 0.05;
      this.MJcoff_m = 0.0625;
      this.MJcoff_a = 0.1;
      this.AlgBcoff_m = 0.0625;
      this.AlgBcoff_a = 0.12;
      this.MJ_overshoot = 0.05;
      this.MJ_overshoot_coof = 0.5;
    }

    _nudgeP(delta) {
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
      // console.log(this.p);
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
      this._nudgeP(schedDelta * this.p_r_coff);
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
      this._nudgeP(this.MJcoff_a * MJ_diff);
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
      this._nudgeP(this.AlgBcoff_a * AlgB_Diff);
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

  // ─── transpileToMath ──────────────────────────────────────────────────────
  //
  //  Loop: O(1) per statement (just push to chain).
  //  Functions: simplified individually as each one arrives.
  //  Final: one D&C pass over the chain, simplifying at every merge point.
  //
  function transpileToMath(ast) {
    const am = new astManager();
    const pf = new ProxyFactory();
    const transpiler = astStatmentsTomathjs(am);
    const chain = new SubstitutionChain(am, pf);
    const simplification = new AutoSimplification();
    let dependentFns = [];

    // Passed to chain.materialize() — called on every D&C-merged chunk.
    // Receives and returns a real mathjs node.
    const mergeSimplify = (node) => {
      const result = simplification.step(node, []);
      return result?.main ?? node;
    };

    for (const statement of ast.statements) {
      if (statement.type === "condition") {
        // O(1): push the condition expression onto the chain as a ProxiedNode.
        // No tree walk, no substitution yet.
        chain.push(transpiler.condition(statement));
      } else if (statement.type === "mem") {
        // O(1): same as above.
        chain.push(transpiler.mem(statement));
      } else if (statement.type === "function") {
        // Functions are independent of the main chain — simplify each one
        // individually the moment it arrives, exactly as before.
        const rawFn = transpiler.function(statement);
        const { main: simplified } = simplification.step(rawFn, []) ?? {
          main: rawFn,
        };
        dependentFns.push(simplified ?? rawFn);
      }
      // Note: we do NOT call simplification.step on the chain here.
      // Simplification of the main expression happens at D&C merge points
      // below, on real materialised chunks — not on the growing phantom tree.
    }

    // D&C materialisation — O(N log N) merges, each chunk is small enough
    // to benefit from simplification before being folded into the next level.
    // Every link in the chain is a ProxiedNode; hasMemorySlots() is O(1).
    const materializedMain = chain.materialize(mergeSimplify);
    const mainFn = am.function_ast("main", "memory", materializedMain);
    return { main: mainFn, dependencies: dependentFns };
  }

  return {
    formMathAst: (ast) => transpileToMath(ast),
  };
};

export { main };
