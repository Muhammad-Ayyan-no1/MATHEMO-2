import { createParser } from "./main.js";

function create(ctx) {
  const lib = ctx?.lib || null;
  const parser = createParser(lib);

  return {
    cbk: "parser",
    id: `parser_${Date.now()}`,
    ins: parser,
    init() {},
    despawn() {},
    exportState() {
      return {};
    },
    importState() {},
  };
}

export { create };
