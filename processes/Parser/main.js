/*

Syntaxes :-
mem statement :
        mem location/VarName = data;

if statement :-
        if (condition) code [else code]

functions :-
        function name(param1, param2, ...) code;

*/

class TokenStream {
  constructor(tokens) {
    this.tokens = Array.isArray(tokens) ? tokens : tokens?.tokens || [];
    this.pos = 0;
  }
  peek(offset = 0) {
    return this.tokens[this.pos + offset];
  }
  consume() {
    return this.tokens[this.pos++];
  }
  save() {
    return this.pos;
  }
  restore(pos) {
    this.pos = pos;
  }
}

function tokenIs(token, type, value) {
  return token && token.type === type && token.value === value;
}

function isIdentifier(token) {
  return token && token.type === "identifier";
}

function isNumberToken(token) {
  return token.type === "number";
}

function parsePrimary(stream) {
  const token = stream.peek();
  if (!token) return null;

  if (isIdentifier(token)) {
    stream.consume();
    return { nodeCBK: "identifier", meta: { name: token.value }, children: [] };
  }

  if (isNumberToken(token)) {
    stream.consume();
    return {
      nodeCBK: "number",
      meta: { value: Number(token.value) },
      children: [],
    };
  }

  if (tokenIs(token, "token", "(")) {
    stream.consume();
    const children = [];
    while (stream.peek() && !tokenIs(stream.peek(), "token", ")")) {
      const child = parsePrimary(stream);
      if (child) {
        children.push(child);
        continue;
      }
      const raw = stream.consume();
      children.push({
        nodeCBK: "token",
        meta: { value: raw.value, type: raw.type },
        children: [],
      });
    }
    if (tokenIs(stream.peek(), "token", ")")) stream.consume();
    return { nodeCBK: "rawExpression", meta: {}, children };
  }

  return null;
}

function parseData(stream) {
  return parsePrimary(stream);
}

function parseMemLocOrVarName(stream) {
  const token = stream.peek();
  if (isNumberToken(token)) {
    const numberNode = parsePrimary(stream);
    return {
      nodeCBK: "memLoc",
      meta: { value: numberNode.meta.value },
      children: [],
    };
  }
  if (isIdentifier(token)) {
    const identifierNode = parsePrimary(stream);
    return {
      nodeCBK: "varName",
      meta: { name: identifierNode.meta.name },
      children: [],
    };
  }
  return null;
}

function parseMemoryStatement(stream) {
  const start = stream.save();
  if (!isIdentifier(stream.peek()) || stream.peek().value !== "mem") {
    stream.restore(start);
    return null;
  }
  stream.consume();

  const target = parseMemLocOrVarName(stream);
  if (!target) {
    stream.restore(start);
    return null;
  }

  if (!tokenIs(stream.peek(), "token", "=")) {
    stream.restore(start);
    return null;
  }
  stream.consume();

  const data = parseData(stream);
  if (!data) {
    stream.restore(start);
    return null;
  }

  if (tokenIs(stream.peek(), "token", ";")) stream.consume();
  return { nodeCBK: "memoryStatement", meta: {}, children: [target, data] };
}

function parseReturnStatement(stream) {
  const start = stream.save();
  if (!isIdentifier(stream.peek()) || stream.peek().value !== "return") {
    stream.restore(start);
    return null;
  }
  stream.consume();

  const value = parseData(stream);
  if (!value) {
    stream.restore(start);
    return null;
  }

  if (tokenIs(stream.peek(), "token", ";")) stream.consume();
  return { nodeCBK: "returnStatement", meta: {}, children: [value] };
}

function parseCodeBlock(stream) {
  if (!tokenIs(stream.peek(), "token", "{")) return null;
  stream.consume();

  const children = [];
  while (stream.peek() && !tokenIs(stream.peek(), "token", "}")) {
    const statement = parseStatement(stream);
    if (!statement) {
      stream.consume();
      continue;
    }
    children.push(statement);
  }

  if (tokenIs(stream.peek(), "token", "}")) stream.consume();
  return { nodeCBK: "codeBlock", meta: {}, children };
}

function parseIfStatement(stream) {
  const start = stream.save();
  if (!isIdentifier(stream.peek()) || stream.peek().value !== "if") {
    stream.restore(start);
    return null;
  }
  stream.consume();

  if (!tokenIs(stream.peek(), "token", "(")) {
    stream.restore(start);
    return null;
  }
  stream.consume();

  const condition = parseData(stream);
  if (!condition || !tokenIs(stream.peek(), "token", ")")) {
    stream.restore(start);
    return null;
  }
  stream.consume();

  const thenStatement = parseStatement(stream);
  if (!thenStatement) {
    stream.restore(start);
    return null;
  }

  let elseStatement = null;
  if (isIdentifier(stream.peek()) && stream.peek().value === "else") {
    stream.consume();
    elseStatement = parseStatement(stream);
    if (!elseStatement) {
      stream.restore(start);
      return null;
    }
  }

  const children = [condition, thenStatement];
  if (elseStatement) children.push(elseStatement);
  return { nodeCBK: "ifStatement", meta: {}, children };
}

function parseFunctionDeclaration(stream) {
  const start = stream.save();
  if (!isIdentifier(stream.peek()) || stream.peek().value !== "function") {
    stream.restore(start);
    return null;
  }
  stream.consume();

  if (!isIdentifier(stream.peek())) {
    stream.restore(start);
    return null;
  }
  const name = stream.consume().value;

  if (!tokenIs(stream.peek(), "token", "(")) {
    stream.restore(start);
    return null;
  }
  stream.consume();

  const params = [];
  while (stream.peek() && !tokenIs(stream.peek(), "token", ")")) {
    if (isIdentifier(stream.peek())) {
      params.push(stream.consume().value);
      continue;
    }
    if (tokenIs(stream.peek(), "token", ",")) {
      stream.consume();
      continue;
    }
    stream.consume();
  }

  if (!tokenIs(stream.peek(), "token", ")")) {
    stream.restore(start);
    return null;
  }
  stream.consume();

  const body = parseStatement(stream);
  if (!body) {
    stream.restore(start);
    return null;
  }

  return {
    nodeCBK: "functionDeclaration",
    meta: { name, params },
    children: [body],
  };
}

function parseStatement(stream) {
  return (
    parseCodeBlock(stream) ||
    parseIfStatement(stream) ||
    parseFunctionDeclaration(stream) ||
    parseMemoryStatement(stream) ||
    parseReturnStatement(stream)
  );
}

function parse(tokenized) {
  const stream = new TokenStream(tokenized);
  const AST = { meta: {}, children: [] };
  while (stream.peek()) {
    const node = parseStatement(stream);
    if (!node) {
      stream.consume();
      continue;
    }
    AST.children.push(node);
  }
  return AST;
}

function testParse(tokenized) {
  const stream = new TokenStream(tokenized);
  const result = [];
  while (stream.peek()) {
    const saved = stream.save();
    const node = parseStatement(stream);
    if (!node) {
      stream.restore(saved);
      break;
    }
    result.push(node.nodeCBK);
  }
  return result;
}

export { parse, testParse, TokenStream };
