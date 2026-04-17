function analyze(ast) {
  // TODO: Implement AST semantic analysis
  return ast;
}

function create(ctx) {
  return {
    cbk: "astSemantics",
    id: `astSemantics_${Date.now()}`,
    ins: { analyze },
    init() {},
    despawn() {},
    exportState() {
      return {};
    },
    importState() {},
  };
}

export { create };
