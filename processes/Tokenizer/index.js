import { defaultTokenizer } from "./tokenizer.js";

function tokenize(string) {
  return defaultTokenizer(string);
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
