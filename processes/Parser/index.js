function parse(tokenized) {
  // TODO: Implement parsing logic
  return { type: "program", body: tokenized };
}

function create(ctx) {
  return {
    cbk: "parser",
    id: `parser_${Date.now()}`,
    ins: { parse },
    init() {},
    despawn() {},
    exportState() {
      return {};
    },
    importState() {},
  };
}

export { create };
