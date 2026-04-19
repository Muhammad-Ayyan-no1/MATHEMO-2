import { main } from "./main.js";

function safeLibrary(lib, name, fallback) {
  if (!lib || !lib.get) return fallback;
  return lib.get(name) || fallback;
}

function createMain(lib) {
  const mathjs = safeLibrary(lib, "mathjs", null);
  return main(mathjs);
}

function create(ctx) {
  const lib = ctx?.lib || null;

  return {
    cbk: "cas",
    id: `cas_${Date.now()}`,
    ins: { ...createMain(lib) },
    init() {},
    despawn() {},
    exportState() {
      return {};
    },
    importState() {},
  };
}

export { create };
