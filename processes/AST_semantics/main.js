import {
  getChildren,
  getAncestors,
  walk,
  walkWithParent,
  findAll,
  findFirst,
  findByType,
  mapTree,
  replaceNode,
  collectScopes,
  printTree,
} from "./utilities.js";

/*
The superoptimizer works on math and cas thus we require to transform all this into simple AST easy to be translated to MATH
*/

function formMathAST(ast) {
  // printTree(ast);
  const sampleAst = {
    statements: [
      {
        type: "function",
        name: "add",
        parameters: ["x", "y"],
        expression: "x + y",
      },
      {
        type: "condition",
        statement: "if",
        Ifcondition: "x > 0",
        IfassociatedCode: "positive",
        ElseAssociatedCode: "negative",
      },
    ],
  };
  return sampleAst;
}

export { formMathAST };
