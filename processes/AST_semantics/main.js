import {
  getChildren,
  getAncestors,
  walk,
  walkWithParent,
  findAll,
  findFirst,
  findByType,
  mapTree,
  replaceNode,
  collectScopes,
  printTree,
} from "./utilities.js";

/*
The superoptimizer works on math and cas thus we require to transform all this into simple AST easy to be translated to MATH
*/

function formFunction(name, prams, body) {
  return `${name}(${prams.join(",")}) = ${body}`;
}
function callFunction(name, prams) {
  return `${name}(${prams.join(",")})`;
}

function normalizeAtom(node) {
  if (node == null) return null;
  if (typeof node === "string") return node; // also has ints
  if (typeof node === "number") return `${node}`;
  if (typeof node !== "object") return null;

  switch (node.type) {
    case "location":
      return callFunction("__SYS_load__", ["memory", node.value]);
    case "rawPass":
      return node.value;
    default:
      return null;
  }
}

function normalizeCondition(condNode) {
  const r = normalizeAtom(condNode);
  if (r == null)
    throw new Error(
      `normalizeCondition(): unsupported condition node: ${JSON.stringify(condNode)}`,
    );
  return r;
}

function normalizeData(dataNode) {
  const r = normalizeAtom(dataNode);
  if (r != null) return r;
  throw new Error(
    `normalizeData(): unsupported data node: ${JSON.stringify(dataNode)}`,
  );
}

function normalizeMemName(memNameNode) {
  if (typeof memNameNode === "string") return memNameNode;
  if (memNameNode && typeof memNameNode === "object") {
    if (memNameNode.type === "location") return `x${memNameNode.value}`;
  }
  throw new Error(
    `normalizeMemName(): unsupported name node: ${JSON.stringify(memNameNode)}`,
  );
}

function safeIdentifierPart(raw) {
  return `${raw}`
    .replace(/[^A-Za-z0-9_]/g, "_")
    .replace(/^([^A-Za-z_])/, "_$1");
}

function memTargetInfo(nameNode) {
  if (
    nameNode &&
    typeof nameNode === "object" &&
    nameNode.type === "location"
  ) {
    return {
      key: `x${nameNode.value}`,
      slotExpr: `${nameNode.value}`,
      helperName: `SYS_store_at_x${nameNode.value}`,
    };
  }

  const literalName = normalizeMemName(nameNode);
  const safe = safeIdentifierPart(literalName);
  return {
    key: literalName,
    slotExpr: literalName,
    helperName: `SYS_store_at_name_${safe}`,
  };
}

function mergeAst(a, b) {
  return {
    injectFns: [...(a?.injectFns ?? []), ...(b?.injectFns ?? [])],
    statements: [...(a?.statements ?? []), ...(b?.statements ?? [])],
  };
}

function toSequence(stmt) {
  if (!stmt || typeof stmt !== "object") return [];
  if (stmt.type === "block") return [...(stmt.body ?? [])];
  return [stmt];
}

function fromSequence(seq) {
  if (!Array.isArray(seq) || seq.length === 0)
    return { type: "block", body: [] };
  if (seq.length === 1) return seq[0];
  return { type: "block", body: seq };
}

function flowOfStatement(stmt) {
  if (!stmt || typeof stmt !== "object") return "never";
  switch (stmt.type) {
    case "return":
      return "always";
    case "if": {
      const bodyFlow = flowOfStatement(stmt.body);
      return bodyFlow === "never" ? "never" : "maybe";
    }
    case "ifElse": {
      const thenFlow = flowOfStatement(stmt.body);
      const elseFlow = flowOfStatement(stmt.elseBody);
      if (thenFlow === "always" && elseFlow === "always") return "always";
      if (thenFlow === "never" && elseFlow === "never") return "never";
      return "maybe";
    }
    case "block":
      return flowOfSequence(stmt.body ?? []);
    default:
      return "never";
  }
}

function flowOfSequence(seq) {
  let hasMaybe = false;
  for (const s of seq) {
    const f = flowOfStatement(s);
    if (f === "always") return "always";
    if (f === "maybe") hasMaybe = true;
  }
  return hasMaybe ? "maybe" : "never";
}

function appendTailToBranch(branchStmt, tailSeq) {
  const branchSeq = toSequence(normalizeNode(branchStmt));
  if (flowOfSequence(branchSeq) === "always") return branchSeq;
  return normalizeSequence([...branchSeq, ...tailSeq]);
}

function normalizeSequence(inputSeq) {
  const seq = Array.isArray(inputSeq) ? inputSeq : [];
  if (seq.length === 0) return [];

  const [headRaw, ...tailRaw] = seq;
  const head = normalizeNode(headRaw);
  const tail = normalizeSequence(tailRaw);
  if (tail.length === 0) return [head];

  if (head.type === "if" && flowOfStatement(head.body) !== "never") {
    const thenSeq = appendTailToBranch(head.body, tail);
    return [
      {
        type: "ifElse",
        condition: head.condition,
        body: fromSequence(thenSeq),
        elseBody: fromSequence(tail),
      },
    ];
  }

  if (
    head.type === "ifElse" &&
    (flowOfStatement(head.body) !== "never" ||
      flowOfStatement(head.elseBody) !== "never")
  ) {
    const thenSeq = appendTailToBranch(head.body, tail);
    const elseSeq = appendTailToBranch(head.elseBody, tail);
    return [
      {
        type: "ifElse",
        condition: head.condition,
        body: fromSequence(thenSeq),
        elseBody: fromSequence(elseSeq),
      },
    ];
  }

  if (flowOfStatement(head) === "always") return [head];
  return [head, ...tail];
}

function normalizeNode(stmt) {
  if (!stmt || typeof stmt !== "object") return stmt;
  switch (stmt.type) {
    case "block":
      return { ...stmt, body: normalizeSequence(stmt.body ?? []) };
    case "if":
      return { ...stmt, body: normalizeNode(stmt.body) };
    case "ifElse":
      return {
        ...stmt,
        body: normalizeNode(stmt.body),
        elseBody: normalizeNode(stmt.elseBody),
      };
    case "function": {
      const bodySeq = normalizeSequence(toSequence(stmt.body));
      return { ...stmt, body: fromSequence(bodySeq) };
    }
    default:
      return stmt;
  }
}

function translateStatementList(stmtOrBlock) {
  if (!stmtOrBlock || typeof stmtOrBlock !== "object")
    return { injectFns: [], statements: [] };

  if (stmtOrBlock.type === "block") {
    let out = { injectFns: [], statements: [] };
    for (const s of stmtOrBlock.body ?? []) {
      out = mergeAst(out, translateStatement(s));
    }
    return out;
  }

  return translateStatement(stmtOrBlock);
}

// sa = statement ast
function translateStatement(sa) {
  if (!sa || typeof sa !== "object") return { injectFns: [], statements: [] };

  switch (sa.type) {
    case "mem": {
      const target = memTargetInfo(sa.name);
      const dataExpr = normalizeData(sa.data);
      const fnName = target.helperName;
      const fnDef = formFunction(
        fnName,
        ["memory"],
        `__SYS_store__(memory, ${target.slotExpr}, ${dataExpr})`,
      );

      return {
        injectFns: [fnDef],
        statements: [
          {
            type: "mem",
            og: { parser: sa },
            target: target.key,
            functionName: fnName,
          },
        ],
      };
    }

    case "if": {
      const thenAst = translateStatementList(sa.body);
      return {
        injectFns: [],
        statements: [
          {
            type: "condition",
            statement: "if",
            Ifcondition: normalizeCondition(sa.condition),
            IfassociatedCode: thenAst,
          },
        ],
      };
    }

    case "ifElse": {
      const thenAst = translateStatementList(sa.body);
      const elseAst = translateStatementList(sa.elseBody);
      return {
        injectFns: [],
        statements: [
          {
            type: "condition",
            statement: "ifElse",
            Ifcondition: normalizeCondition(sa.condition),
            IfassociatedCode: thenAst,
            ElseAssociatedCode: elseAst,
          },
        ],
      };
    }

    case "function": {
      const name = normalizeMemName(sa.name);
      const params = (sa.params ?? []).map(normalizeMemName);
      const bodyAst = translateStatementList(sa.body);
      return {
        injectFns: [],
        statements: [
          {
            type: "function",
            name,
            parameters: params,
            body: bodyAst,
          },
        ],
      };
    }

    case "return": {
      return {
        injectFns: [],
        statements: [
          {
            type: "return",
            expression: normalizeData(sa.value),
          },
        ],
      };
    }

    case "call": {
      const name = normalizeMemName(sa.name);
      const args = (sa.args ?? []).map((a) => normalizeData(a));
      return {
        injectFns: [],
        statements: [
          {
            type: "call",
            name,
            args,
          },
        ],
      };
    }

    case "block":
      return translateStatementList(sa);

    default:
      // user asked to only implement if/ifElse/function/mem for now
      return { injectFns: [], statements: [] };
  }
}

function formMathAST(ast) {
  const normalizedProgram = {
    ...(ast ?? { type: "program", body: [] }),
    body: normalizeSequence(ast?.body ?? []),
  };
  const out = { injectFns: [], statements: [] };
  const programBody = normalizedProgram.body ?? [];
  for (const s of programBody) {
    const r = translateStatement(s);
    out.injectFns.push(...(r.injectFns ?? []));
    out.statements.push(...(r.statements ?? []));
  }
  return out;
}

export { formMathAST };

//if (x0) mem x1 = 1;
