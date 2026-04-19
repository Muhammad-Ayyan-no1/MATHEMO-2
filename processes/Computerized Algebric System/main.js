const astStatmentsToMath = (astManager) => {
  function formCondition(ast) {
    if (ast.statment == "if")
      return astManager.add_ast(
        astManager.multiply_ast(ast.Ifcondition, ast.IfassociatedCode),
        astManager.multiply_ast(
          astManager.subtract_ast(1, ast.Ifcondition),
          "memory",
        ),
      );
    else
      return astManager.add_ast(
        astManager.multiply_ast(ast.Ifcondition, ast.IfassociatedCode),
        astManager.multiply_ast(
          astManager.subtract_ast(1, ast.Ifcondition),
          ast.ElseAssociatedCode,
        ),
      );
  }
  function formFunction(ast) {
    return astManager.function_ast(ast.name, ast.prametersArr, ast.expression);
  }
  function formMem(ast) {
    return astManager.function_callAst(ast.functionName, "memory");
  }
  return {
    condition: formCondition,
    function: formFunction,
    mem: formMem,
  };
};

class astManager {}

function transpileToMath(ast) {
  let astManager_ins = new astManager();
  let transpiler = astStatmentsToMath(astManager_ins);

  let dependentFns = [];
  let main = "memory";
  for (let i = 0; i < ast.statments.length; i++) {
    let statment = ast.statments[i];
    if (statment.type == "condition") {
      main = astManager_ins.substitude(
        "memory",
        transpiler.condition(statment),
      );
    } else if (statment.type == "mem") {
      main = astManager_ins.substitude("memory", transpiler.mem(statment));
    } else if (statment.type == "function") {
      dependentFns.push(transpiler.function(statment));
    }
  }

  let mainFn = astManager_ins.function_ast("main", "memory", main);

  return {
    main: mainFn,
    dependencies: dependentFns,
  };
}
