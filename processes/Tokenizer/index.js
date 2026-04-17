function tokenize(string) {
  // TODO: Implement tokenization logic
  return string.split(/\s+/);
}

function create(ctx) {
  return {
    cbk: "tokenizer",
    id: `tokenizer_${Date.now()}`,
    ins: { tokenize },
    init() {},
    despawn() {},
    exportState() {
      return {};
    },
    importState() {},
  };
}

export { create };
