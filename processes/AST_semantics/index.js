import { formMathAST } from "./main.js";
function analyze(ast) {
  // console.log(ast);
  return formMathAST(ast);
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
