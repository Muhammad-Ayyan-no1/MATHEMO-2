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
  printTree(ast);
  return ast;
}

export { formMathAST };
