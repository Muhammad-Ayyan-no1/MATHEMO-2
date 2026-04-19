function resolveRecursions(MathAST) {}

function create(ctx) {
  return {
    cbk: "cas",
    id: `cas_${Date.now()}`,
    ins: { resolveRecursions },
    init() {},
    despawn() {},
    exportState() {
      return {};
    },
    importState() {},
  };
}

export { create };
