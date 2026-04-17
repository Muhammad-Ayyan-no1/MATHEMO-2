function generateCode(ast) {
  // TODO: Implement code generation logic
  return JSON.stringify(ast);
}

function create(ctx) {
  return {
    cbk: "codeGen",
    id: `codeGen_${Date.now()}`,
    ins: { generateCode },
    init() {},
    despawn() {},
    exportState() {
      return {};
    },
    importState() {},
  };
}

export { create };
