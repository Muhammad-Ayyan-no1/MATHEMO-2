const algebrite = require("algebrite");
const mathjs = require("mathjs");

let STD_Lib_INS = {};
let mangler;
let DBBstring;

function fullTranspileFinal(ast) {
  let { exp, residueFNs, exp_meta, residueFNs_meta } = fullTranspile(ast);
  residueFNs.push(...(stdSysLib || []));
  residueFNs_meta.push(...(stdSysLib || []).map(parseMathExp));

  const mainMeta = {
    name: "main",
    params: ["memory"],
    body: exp,
  };

  return {
    // exp: `main_MaTHEmO(memory) = ${exp}`,
    exp: `${mangler.mangle("main")} (memory) = ${exp}`,
    residueFNs,
    exp_meta: mainMeta,
    residueFNs_meta,
  };
}

//depricated       was written by claude anyways so idc
// function parseFnString(fnStr) {
//   const match = fnStr.match(/^([^\(]+)\(([^\)]*)\)\s*=\s*(.+)$/);
//   if (!match) return null;
//   return {
//     name: match[1].trim(),
//     params: match[2]
//       .split(",")
//       .map((p) => p.trim())
//       .filter((p) => p),
//     body: match[3].trim(),
//   };
// }

function parseMathExp(ln) {
  // a(b,c,d...) = exp
  let name = ln.slice(0, ln.indexOf("(") - 1);
  let pramsRaw = ln.slice(name.length, ln.indexOf(")")); // btw if wondering -1 for len but +1 for brackets so cancels out
  let pramsInds = pramsRaw.split(",");

  let exp = ln.slice(ln.indexOf("=") + 1, ln.length);
  // console.log("equ", exp);
  let expAST = mathjs.parse(exp);

  return {
    name,
    pramsRaw,
    pramsInds,
    exp,
    expAST,
  };
}

function simplify(exp) {
  return (
    `${exp.name}(${exp.prams}) =` +
    algebrite
      .run(
        `
    ${exp.val}
    simplify(
    ${exp.name}(${exp.prams})
    )
    `,
      )
      .toString()
  );
}

function fullTranspile(ast, nativeSTR = true) {
  if (nativeSTR) {
    if (typeof ast === "string") {
      return { exp: ast, residueFNs: [], exp_meta: null, residueFNs_meta: [] };
    }

    let exp = "memory";
    let residueFNs = [];
    let residueFNs_meta = [];
    const statements = Array.isArray(ast) ? ast : ast.stats || [];

    let p = 0.75;
    let p_target = 0.125;
    let p_t_its = 5;
    let p_t_i = 0;
    let p_r = p * Math.pow(p_target / p, p_t_i / p_t_its);

    for (let i = 0; i < statements.length; i++) {
      const r = fullUniNodeTranspile(statements[i], fullTranspile);

      if (r.exp && r.exp !== "memory") {
        exp = r.exp.replace(/memory/g, exp);

        if (exp.length > 500) {
          if (Math.random() < p) {
            try {
              let simplified = algebrite.run(`simplify(${exp})`).toString();
              if (simplified && simplified.length < exp.length) {
                exp = simplified;
                p_r = p * Math.pow(p_target / p, p_t_i / p_t_its);
                p *= p_r;
                p_t_i++;
              }
            } catch (e) {}
          }
        }
      }

      if (r.residueFNs && r.residueFNs.length > 0) {
        residueFNs.push(...r.residueFNs);
      }

      if (r.residueFNs_meta && r.residueFNs_meta.length > 0) {
        residueFNs_meta.push(...r.residueFNs_meta);
      }
    }

    residueFNs = [...new Set(residueFNs)];
    return { exp, residueFNs, exp_meta: null, residueFNs_meta };
  } else {
    // let exp = new DBBstring();
  }

  return { exp: "memory", residueFNs: [], exp_meta: null, residueFNs_meta: [] };
}

function fullUniNodeTranspile(node, fullTranspile) {
  switch (node.type) {
    case "var":
      return {
        exp: genVariableStore(node, fullTranspile),
        residueFNs: [],
        residueFNs_meta: [],
      };
    case "condition":
      return genIfElse(node, fullTranspile);
    case "functionCall":
      return getfunctionCall(node, fullTranspile);
    case "function":
      return genFunction(node, fullTranspile);
    default:
      return { exp: "memory", residueFNs: [], residueFNs_meta: [] };
  }
}

let stdSysLib;

function applyMathStepsSerial(steps) {
  let str = "memory";
  for (let i = steps.length - 1; i >= 0; i--) {
    const step =
      typeof steps[i] === "string"
        ? steps[i]
        : (steps[i] && steps[i].exp) || "memory";
    str = str.replaceAll("memory", `(${step})`);
  }
  return str;
}

function normalizeToTranspiled(obj, fullTranspile) {
  if (typeof obj === "string") {
    return { exp: obj, residueFNs: [], residueFNs_meta: [] };
  }
  return fullTranspile(obj);
}

function genIfElse(node, fullTranspile) {
  //const condition = normalizeToTranspiled(node.condition, fullTranspile);
  const condition = node.condition.raw;
  const ifC = normalizeToTranspiled(node.if, fullTranspile);
  const elseC = normalizeToTranspiled(node.else, fullTranspile);
  return {
    exp: `if_condition(${condition}, ${ifC.exp}) + else_condition(${condition}, ${elseC.exp})`,
    residueFNs: [
      ...(condition.residueFNs || []),
      ...(ifC.residueFNs || []),
      ...(elseC.residueFNs || []),
    ],
    residueFNs_meta: [
      ...(condition.residueFNs_meta || []),
      ...(ifC.residueFNs_meta || []),
      ...(elseC.residueFNs_meta || []),
    ],
  };
}

function genVariableStore(node, fullTranspile, applyArr = true, ll) {
  if (node.varType === "arr" && applyArr) {
    const steps = [];
    for (let i = 0; i < node.value.length; i++) {
      const elem = { ...node.value[i], address: node.address + i };
      let lladr = node.address + i + 1;
      if (i == node.value.length - 1) {
        lladr = node.address;
      }
      const step = genVariableStore(elem, fullTranspile, false, lladr);
      steps[i] = step;
    }
    return applyMathStepsSerial(steps);
  } else if (node.varType === "ptr" && !ll) {
    return `cellConstructorOnMemory(memory, ${node.address}, ${node.value}, -1)`;
  } else if (node.varType === "num" && !ll) {
    return `cellConstructorOnMemory(memory, ${node.address}, ${node.value}, 0)`;
  } else {
    const lastFlag = typeof ll === "number" ? ll : 0;
    const val = typeof node.value !== "undefined" ? node.value : 0;
    return `cellConstructorOnMemory(memory, ${node.address}, ${val}, ${lastFlag})`;
  }
}

function genFunction(node, fullTranspile) {
  let prams = node.params.join(",");
  if (node.params.length != 0) prams = "," + prams;
  const transpiledResult = fullTranspile(node.code, false);
  // const fnExp = `${node.name}_MaTHEmO (memory ${prams}) = ${transpiledResult.exp}`;
  const fnExp = `${mangler.mangle(node.name)} (memory ${prams}) = ${
    transpiledResult.exp
  }`;
  const fnMeta = {
    name: node.name,
    params: ["memory", ...node.params],
    body: transpiledResult.exp,
  };

  return {
    exp: "memory",
    residueFNs: [...(transpiledResult.residueFNs || []), fnExp],
    residueFNs_meta: [...(transpiledResult.residueFNs_meta || []), fnMeta],
  };
}

function getfunctionCall(node, fullTranspile) {
  let prams = "";
  if (node.params.length != 0) {
    let r = [];
    for (let i = 0; i < node.params.length; i++) {
      if (node.params[i].type === "number") {
        r[i] = node.params[i].value;
      } else if (node.params[i].type === "varName") {
        r[i] = node.params[i];
      } else {
        r[i] = node.params[i].value || node.params[i];
      }
    }
    prams = "," + r.join(",");
  }
  return {
    // exp: `${node.name}_MaTHEmO (memory ${prams})`,
    exp: `${mangler.mangle(node.name)} (memory ${prams})`,

    residueFNs: [],
    residueFNs_meta: [],
  };
}

async function create(globalPipeLineMEM) {
  STD_Lib_INS = globalPipeLineMEM.standerd.lib;
  stdSysLib = STD_Lib_INS.L1;
  mangler = globalPipeLineMEM.tools.mangler;
  DBBstring = globalPipeLineMEM.tools.DBBstring;
  // console.log(mangler);
  return {
    astToMath: function () {
      if (!globalPipeLineMEM.pipelineData.transformedAST) {
        console.warn(
          "transformedAST data is invalid",
          globalPipeLineMEM.pipelineData.transformedAST,
        );
        return;
      }
      return fullTranspileFinal(globalPipeLineMEM.pipelineData.transformedAST);
    },
  };
}

module.exports = { create };
