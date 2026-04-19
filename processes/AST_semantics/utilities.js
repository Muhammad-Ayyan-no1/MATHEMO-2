// heavily AI assisted code

// ─── Core: get the traversable children of any node ───────────────────────────

function getChildren(node) {
  if (!node || typeof node !== "object") return [];

  switch (node.type) {
    case "program":
      return node.body;

    case "function":
      // name could be a location node, params are strings, body is a node
      return [...(typeof node.name === "object" ? [node.name] : []), node.body];

    case "call":
      return node.args
        .filter((a) => typeof a === "object")
        .concat(typeof node.name === "object" ? [node.name] : []);

    case "block":
      return node.body;

    case "mem":
      return [
        ...(typeof node.name === "object" ? [node.name] : []),
        ...(typeof node.data === "object" ? [node.data] : []),
      ];

    case "if":
      return [
        ...(typeof node.condition === "object" ? [node.condition] : []),
        node.body,
      ];

    case "ifElse":
      return [
        ...(typeof node.condition === "object" ? [node.condition] : []),
        node.body,
        node.elseBody,
      ];

    case "return":
      return typeof node.value === "object" ? [node.value] : [];

    case "location":
    case "rawPass":
      return [];

    default:
      return [];
  }
}

// ─── 1. walk(node, visitor) ────────────────────────────────────────────────────
// Depth-first traversal from a root node.
// visitor = { enter(node), leave(node) }  — both optional
// Return false from enter() to skip the node's subtree.

function walk(node, visitor) {
  if (!node || typeof node !== "object") return;

  if (visitor.enter) {
    const result = visitor.enter(node);
    if (result === false) return; // prune this branch
  }

  for (const child of getChildren(node)) {
    walk(child, visitor);
  }

  if (visitor.leave) {
    visitor.leave(node);
  }
}

// ─── 2. walkWithParent(node, visitor, parent?) ────────────────────────────────
// Same as walk() but visitor callbacks also receive the parent node.
// visitor = { enter(node, parent), leave(node, parent) }

function walkWithParent(node, visitor, parent = null) {
  if (!node || typeof node !== "object") return;

  if (visitor.enter) {
    const result = visitor.enter(node, parent);
    if (result === false) return;
  }

  for (const child of getChildren(node)) {
    walkWithParent(child, visitor, node);
  }

  if (visitor.leave) {
    visitor.leave(node, parent);
  }
}

// ─── 3. findAll(root, predicate) ──────────────────────────────────────────────
// Returns every node (anywhere in the tree) that satisfies predicate(node).

function findAll(root, predicate) {
  const results = [];
  walk(root, {
    enter(node) {
      if (predicate(node)) results.push(node);
    },
  });
  return results;
}

// ─── 4. findFirst(root, predicate) ────────────────────────────────────────────
// Returns the first matching node, or null. Short-circuits the traversal.

function findFirst(root, predicate) {
  let found = null;
  walk(root, {
    enter(node) {
      if (found) return false; // already found — prune everything
      if (predicate(node)) {
        found = node;
        return false; // prune this branch too
      }
    },
  });
  return found;
}

// ─── 5. findByType(root, type) ────────────────────────────────────────────────
// Sugar: collect all nodes of a given type string.

function findByType(root, type) {
  return findAll(root, (n) => n.type === type);
}

// ─── 6. mapTree(node, transform) ──────────────────────────────────────────────
// Returns a NEW tree; transform(node) may return a replacement node or the
// original.  Children are mapped first (bottom-up), then transform is called.

function mapTree(node, transform) {
  if (!node || typeof node !== "object") return node;

  // Rebuild a shallow clone with children already mapped
  let clone = { ...node };

  switch (node.type) {
    case "program":
    case "block":
      clone.body = node.body.map((c) => mapTree(c, transform));
      break;

    case "function":
      if (typeof node.name === "object")
        clone.name = mapTree(node.name, transform);
      clone.body = mapTree(node.body, transform);
      break;

    case "call":
      if (typeof node.name === "object")
        clone.name = mapTree(node.name, transform);
      clone.args = node.args.map((a) =>
        typeof a === "object" ? mapTree(a, transform) : a,
      );
      break;

    case "mem":
      if (typeof node.name === "object")
        clone.name = mapTree(node.name, transform);
      if (typeof node.data === "object")
        clone.data = mapTree(node.data, transform);
      break;

    case "if":
      if (typeof node.condition === "object")
        clone.condition = mapTree(node.condition, transform);
      clone.body = mapTree(node.body, transform);
      break;

    case "ifElse":
      if (typeof node.condition === "object")
        clone.condition = mapTree(node.condition, transform);
      clone.body = mapTree(node.body, transform);
      clone.elseBody = mapTree(node.elseBody, transform);
      break;

    case "return":
      if (typeof node.value === "object")
        clone.value = mapTree(node.value, transform);
      break;
  }

  return transform(clone) ?? clone;
}

// ─── 7. replaceNode(root, predicate, replacement) ─────────────────────────────
// Returns a new tree where every node matching predicate is swapped out.
// replacement can be a node object OR a function (node) => newNode.

function replaceNode(root, predicate, replacement) {
  return mapTree(root, (node) => {
    if (!predicate(node)) return node;
    return typeof replacement === "function" ? replacement(node) : replacement;
  });
}

// ─── 8. getAncestors(root, target) ────────────────────────────────────────────
// Returns the ancestor chain [root, ..., directParent] for a target node,
// or null if the target is not found.

function getAncestors(root, target) {
  let chain = null;

  function dfs(node, path) {
    if (chain) return; // already done
    if (node === target) {
      chain = [...path];
      return;
    }
    for (const child of getChildren(node)) {
      dfs(child, [...path, node]);
    }
  }

  dfs(root, []);
  return chain;
}

// ─── 9. collectScopes(root) ───────────────────────────────────────────────────
// Returns a Map<functionNode, string[]> of each function's declared mem names.

function collectScopes(root) {
  const scopes = new Map();

  walk(root, {
    enter(node) {
      if (node.type === "function") {
        const mems = findByType(node.body, "mem").map((m) =>
          typeof m.name === "object" ? `x${m.name.value}` : m.name,
        );
        scopes.set(node, { params: node.params, locals: mems });
      }
    },
  });

  return scopes;
}

// ─── 10. printTree(node, indent?) ─────────────────────────────────────────────
// Pretty-prints a compact outline of the AST for debugging.

function printTree(node, indent = 0) {
  if (!node || typeof node !== "object") return;
  const pad = "  ".repeat(indent);

  const label = (() => {
    switch (node.type) {
      case "program":
        return "Program";
      case "function":
        return `Function  "${node.name}"  params=(${node.params.join(", ")})`;
      case "call":
        return `Call  "${node.name}"  args=(${node.args.join(", ")})`;
      case "block":
        return "Block";
      case "mem":
        return `Mem  ${JSON.stringify(node.name)} = ${JSON.stringify(node.data)}`;
      case "if":
        return `If  cond=${JSON.stringify(node.condition)}`;
      case "ifElse":
        return `IfElse  cond=${JSON.stringify(node.condition)}`;
      case "return":
        return `Return  ${JSON.stringify(node.value)}`;
      case "location":
        return `Location  x${node.value}`;
      case "rawPass":
        return `RawPass  (${node.value})`;
      default:
        return JSON.stringify(node);
    }
  })();

  console.log(`${pad}${label}`);
  for (const child of getChildren(node)) printTree(child, indent + 1);
}

export {
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
};
