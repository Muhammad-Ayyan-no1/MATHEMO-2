import { parse } from "./main.js";

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
