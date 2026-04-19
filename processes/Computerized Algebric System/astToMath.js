"use strict";

// ═══════════════════════════════════════════════════════════════
//  dag.js  —  Program AST  ↔  Math AST  ↔  Algebraic string
//
//  Algebraic form: single nested expression, memory substituted
//  inward. if_ becomes if_condition(c,t)+else_condition(c,e) —
//  matching the original MATHEMO stdLib convention.
// ═══════════════════════════════════════════════════════════════

// ── 1. Math AST constructors ────────────────────────────────────

const _s = new Map(),
  _n = new Map();
const sym = (n) =>
  _s.get(n) ?? (_s.set(n, Object.freeze({ type: "sym", name: n })), _s.get(n));
const num = (v) =>
  _n.get(v) ?? (_n.set(v, Object.freeze({ type: "num", value: v })), _n.get(v));
const app = (f, args) => ({ type: "app", fn: f, args: [...args] });
const bop = (op, l, r) => ({ type: "binop", op, l, r });
const let_ = (n, v, body) => ({ type: "let", name: n, val: v, body });
const lam = (ps, body) => ({ type: "lam", params: [...ps], body });
const if_ = (c, t, e) => ({ type: "if", cond: c, then: t, else: e });

// ── 2. Thunks ───────────────────────────────────────────────────

const thunk = (f) => {
  let done = false,
    v;
  const t = () => {
    if (!done) {
      v = f();
      done = true;
    }
    return v;
  };
  t.isThunk = true;
  return t;
};
const force = (x) => {
  while (x?.isThunk) x = x();
  return x;
};

// ── 3. SSA chain ────────────────────────────────────────────────

class Chain {
  constructor() {
    this.binds = [];
  }
  bind(name, val) {
    this.binds.push({ name, val });
    return sym(name);
  }
  build(body) {
    let n = force(body);
    for (let i = this.binds.length - 1; i >= 0; i--)
      n = let_(this.binds[i].name, force(this.binds[i].val), n);
    return n;
  }
}

// ── 4. Program AST → Math AST ───────────────────────────────────

function compile(prog) {
  let id = 0;
  const fresh = (tag) => `${tag}_${id++}`;
  const fns = new Map();

  const expr = (e, mem) => {
    if (typeof e === "number") return num(e);
    switch (e.type) {
      case "num":
        return num(e.value);
      case "ref":
        return sym(e.name);
      case "load": {
        const a = typeof e.addr === "number" ? num(e.addr) : expr(e.addr, mem);
        return app(sym("load"), [mem, a]);
      }
      case "binop":
        return bop(e.op, expr(e.l, mem), expr(e.r, mem));
      case "call":
        return app(
          sym(e.name),
          e.args.map((a) => expr(a, mem)),
        );
    }
  };

  const stmt = (s, chain, mem) => {
    switch (s.type) {
      case "assign": {
        const a = typeof s.addr === "number" ? num(s.addr) : expr(s.addr, mem);
        return chain.bind(
          fresh("mem"),
          thunk(() => app(sym("store"), [mem, a, expr(s.val, mem)])),
        );
      }
      case "call": {
        const args = s.args.map((a) => expr(a, mem));
        return chain.bind(
          fresh("mem"),
          thunk(() => app(sym(s.name), [mem, ...args])),
        );
      }
      case "if": {
        const cond = expr(s.cond, mem);
        return chain.bind(
          fresh("mem"),
          thunk(() => {
            const tc = new Chain(),
              ec = new Chain();
            return if_(
              cond,
              tc.build(block(s.then || [], tc, mem)),
              ec.build(block(s.else || [], ec, mem)),
            );
          }),
        );
      }
      case "fn": {
        const { name, params, body } = s;
        fns.set(
          name,
          thunk(() => {
            const m = sym("mem"),
              c = new Chain();
            return lam(["mem", ...params], c.build(block(body, c, m)));
          }),
        );
        return mem;
      }
      default:
        return mem;
    }
  };

  const block = (stmts, chain, mem) =>
    stmts.reduce((m, s) => stmt(s, chain, m), mem);

  const root = new Chain();
  const main = root.build(block(prog.body, root, sym("mem")));
  const defs = new Map([...fns].map(([k, t]) => [k, force(t)]));
  return { main, defs };
}

// ── 5. Math AST → Algebraic string ──────────────────────────────
//
// substLets eliminates all let_ nodes on the DAG.
// emit serialises to a string using if_condition+else_condition.

function toAlgebra({ main, defs }) {
  function substLets(n, env = new Map()) {
    switch (n.type) {
      case "num":
        return n;
      case "sym":
        return env.has(n.name) ? env.get(n.name) : n;
      case "binop":
        return bop(n.op, substLets(n.l, env), substLets(n.r, env));
      case "app":
        return app(
          substLets(n.fn, env),
          n.args.map((a) => substLets(a, env)),
        );
      case "if":
        return if_(
          substLets(n.cond, env),
          substLets(n.then, env),
          substLets(n.else, env),
        );
      case "lam": {
        const inner = new Map(env);
        n.params.forEach((p) => inner.delete(p));
        return lam(n.params, substLets(n.body, inner));
      }
      case "let": {
        const val = substLets(n.val, env);
        const inner = new Map(env);
        inner.set(n.name, val);
        return substLets(n.body, inner);
      }
      default:
        return n;
    }
  }

  function emit(n) {
    switch (n.type) {
      case "num":
        return String(n.value);
      case "sym":
        return n.name;
      case "binop":
        return `(${emit(n.l)}${n.op}${emit(n.r)})`;
      case "app":
        return `${emit(n.fn)}(${n.args.map(emit).join(",")})`;
      // if_ → two-term sum: if_condition(c,t)+else_condition(c,e)
      // Wrap in parens so it parses unambiguously inside argument lists.
      case "if": {
        const c = emit(n.cond);
        return `(if_condition(${c},${emit(n.then)})+else_condition(${c},${emit(n.else)}))`;
      }
      default:
        return "?";
    }
  }

  const lines = [];
  for (const [name, node] of defs)
    lines.push(
      `${name}(${node.params.join(",")})=${emit(substLets(node.body))}`,
    );
  lines.push(`program(memory)=${emit(substLets(main))}`);
  return lines.join("\n");
}

// ── 6. Algebraic string → Math AST ──────────────────────────────
//
// Recursive descent. The key invariant: every if_condition+else_condition
// pair is wrapped in parens by the emitter, so inside an arg list the
// comma can never be ambiguous — it always sits at paren depth > 0.

function fromAlgebra(src) {
  const tokenise = (str) =>
    [
      ...str.matchAll(
        /[A-Za-z_][A-Za-z0-9_]*|[0-9]+(?:\.[0-9]+)?|[+\-*\/<>=!]+|[(),]|\S/g,
      ),
    ].map((m) => m[0]);

  function makeParser(toks) {
    let pos = 0;
    const peek = () => toks[pos];
    const eat = () => toks[pos++];
    const expect = (t) => {
      if (peek() !== t)
        throw new Error(`expected '${t}' got '${peek()}' at ${pos}`);
      return eat();
    };

    // expr handles everything including + chains at the top level of an argument
    function parseExpr() {
      let left = parsePrimary();
      // binary + or - between primaries (not inside parens — those are handled by parsePrimary)
      while (peek() === "+" || peek() === "-") {
        const op = eat();
        left = bop(op, left, parsePrimary());
      }
      return left;
    }

    function parsePrimary() {
      const t = peek();

      // (l op r)  —  grouped binop written by emit for binop nodes
      // (if_condition(...)+else_condition(...))  —  grouped if
      if (t === "(") {
        eat();
        const first = parseExpr();
        // after parsing first, if next is ')' it was a single-expr group
        if (peek() === ")") {
          eat();
          return first;
        }
        // otherwise it's (l op r)
        const op = eat();
        const right = parseExpr();
        expect(")");
        return bop(op, first, right);
      }

      if (/^[0-9]/.test(t)) return num(Number(eat()));

      if (/^[A-Za-z_]/.test(t)) {
        const name = eat();
        if (peek() !== "(") return sym(name);
        eat(); // '('

        if (name === "if_condition") {
          const cond = parseExpr();
          expect(",");
          const thn = parseExpr();
          expect(")");
          expect("+");
          const ec = eat(); // 'else_condition'
          if (ec !== "else_condition")
            throw new Error(`expected else_condition got ${ec}`);
          expect("(");
          parseExpr();
          expect(","); // cond duplicate — discard
          const els = parseExpr();
          expect(")");
          return if_(cond, thn, els);
        }

        const args = [];
        while (peek() !== ")") {
          args.push(parseExpr());
          if (peek() === ",") eat();
        }
        eat(); // ')'
        return app(sym(name), args);
      }

      throw new Error(`unexpected: '${t}' at ${pos}`);
    }

    return { parseExpr };
  }

  const defs = new Map();
  let main = null;

  for (const line of src.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf("=");
    const head = trimmed.slice(0, eq);
    const body = trimmed.slice(eq + 1);
    const hm = head.match(/^([A-Za-z_][A-Za-z0-9_]*)\(([^)]*)\)$/);
    if (!hm) continue;
    const name = hm[1];
    const params = hm[2]
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const node = makeParser(tokenise(body)).parseExpr();
    if (name === "program") main = node;
    else defs.set(name, lam(params, node));
  }

  return { main, defs };
}

// ── 7. Pretty printer ────────────────────────────────────────────

function print(node) {
  const seen = new WeakMap();
  let ref = 0;
  function p(n, d) {
    if (!n) return "?";
    if (n.type !== "sym" && n.type !== "num") {
      if (seen.has(n)) return `@${seen.get(n)}`;
      seen.set(n, `r${ref++}`);
    }
    const I = "  ".repeat(d);
    switch (n.type) {
      case "num":
        return String(n.value);
      case "sym":
        return n.name;
      case "binop":
        return `(${p(n.l, d)} ${n.op} ${p(n.r, d)})`;
      case "app":
        return `${p(n.fn, d)}(${n.args.map((a) => p(a, d)).join(", ")})`;
      case "let":
        return `let ${n.name} = ${p(n.val, d + 1)}\n${I}in  ${p(n.body, d + 1)}`;
      case "lam":
        return `λ(${n.params.join(", ")}) =>\n${I}  ${p(n.body, d + 1)}`;
      case "if":
        return `if   ${p(n.cond, d)}\n${I}then ${p(n.then, d + 1)}\n${I}else ${p(n.else, d + 1)}`;
      default:
        return JSON.stringify(n);
    }
  }
  return p(node, 0);
}

// ── 8. DAG utilities ────────────────────────────────────────────

function dagWalk(root, visit) {
  const seen = new WeakSet();
  function walk(n) {
    if (!n || typeof n !== "object" || seen.has(n)) return;
    seen.add(n);
    visit(n);
    switch (n.type) {
      case "app":
        walk(n.fn);
        n.args.forEach(walk);
        break;
      case "binop":
        walk(n.l);
        walk(n.r);
        break;
      case "let":
        walk(n.val);
        walk(n.body);
        break;
      case "lam":
        walk(n.body);
        break;
      case "if":
        walk(n.cond);
        walk(n.then);
        walk(n.else);
        break;
    }
  }
  walk(root);
}
const nodeCount = (root) => {
  let n = 0;
  dagWalk(root, () => n++);
  return n;
};

// ── 9. Demo ─────────────────────────────────────────────────────

const prog = {
  type: "program",
  body: [
    {
      type: "fn",
      name: "add",
      params: ["x", "y"],
      body: [
        {
          type: "assign",
          addr: 0,
          val: {
            type: "binop",
            op: "+",
            l: { type: "ref", name: "x" },
            r: { type: "ref", name: "y" },
          },
        },
      ],
    },
    { type: "assign", addr: 0, val: { type: "num", value: 10 } },
    { type: "assign", addr: 1, val: { type: "num", value: 20 } },
    {
      type: "if",
      cond: {
        type: "binop",
        op: ">",
        l: { type: "load", addr: 0 },
        r: { type: "num", value: 5 },
      },
      then: [{ type: "assign", addr: 2, val: { type: "num", value: 1 } }],
      else: [{ type: "assign", addr: 2, val: { type: "num", value: 0 } }],
    },
    {
      type: "assign",
      addr: 3,
      val: {
        type: "binop",
        op: "+",
        l: { type: "load", addr: 2 },
        r: { type: "load", addr: 1 },
      },
    },
  ],
};

const mathAST = compile(prog);

console.log("── SSA ─────────────────────────────────────────────────");
console.log(print(mathAST.main));
for (const [n, node] of mathAST.defs) {
  console.log(`\n── def: ${n}`);
  console.log(print(node));
}

const algebra = toAlgebra(mathAST);
console.log("\n── algebraic string ────────────────────────────────────");
console.log(algebra);

const recovered = fromAlgebra(algebra);
console.log("\n── recovered (algebra → AST) ───────────────────────────");
console.log(print(recovered.main));
for (const [n, node] of recovered.defs) {
  console.log(`\n── recovered def: ${n}`);
  console.log(print(node));
}

let hits = 0;
const target = sym("mem_2");
function tc(n) {
  if (!n || typeof n !== "object") return;
  if (n === target) hits++;
  switch (n.type) {
    case "app":
      tc(n.fn);
      n.args.forEach(tc);
      break;
    case "binop":
      tc(n.l);
      tc(n.r);
      break;
    case "let":
      tc(n.val);
      tc(n.body);
      break;
    case "lam":
      tc(n.body);
      break;
    case "if":
      tc(n.cond);
      tc(n.then);
      tc(n.else);
      break;
  }
}
tc(mathAST.main);
console.log(
  `\n── DAG: mem_2 appears ${hits}× in tree walk, unique nodes: ${nodeCount(mathAST.main)}`,
);
