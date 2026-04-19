import { main } from "./main.js";

function safeLibrary(lib, name, fallback) {
  if (!lib || !lib.get) return fallback;
  return lib.get(name) || fallback;
}

function createMain(lib) {
  const mathjs = safeLibrary(lib, "mathjs", null);
  const algebrite = safeLibrary(lib, "algebrite", null);
  return main(mathjs, algebrite);
}

function create(ctx) {
  const lib = ctx?.lib || null;

  // const sampleAst = {
  //   statements: [
  //     {
  //       type: "function",
  //       name: "add",
  //       parameters: ["x", "y"],
  //       expression: "x + y",
  //     },
  //     {
  //       type: "condition",
  //       statement: "if",
  //       Ifcondition: "x > 0",
  //       IfassociatedCode: "positive",
  //       ElseAssociatedCode: "negative",
  //     },
  //   ],
  // };

  // let mainLib = createMain(lib);
  // const resultAst = mainLib.formMathAst(sampleAst);
  // console.log(resultAst);

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
