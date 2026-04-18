const peggy = require("peggy");
let STD_Lib_INS;
const grammar = `
start
  = statements:(functionStatement / ifStatement / functionCall / varStatement  / comments)* { return statements; }
comments 
 = commentsSingleLine / commentsMultiLine
commentsSingleLine
 = "//" [^\\n]* 
commentsMultiLine
 = "/*" (!"*/" .)* "*/"

varStatement
  = extraToks "adr" extraToks name:varName extraToks "=" extraToks value:DataTypes optionalSemicoln {
      return { type: "var", name, value };
    }

DataTypes
  = functionCall / Mathexpression / numberDataType / arrDataType / varName / fnName 

arrDataType
  = "[" extraToks values:(DataTypes (extraToks "," extraToks DataTypes ","?)*)? extraToks "]" {
      let vals = [];
      if (values) {
        vals = [values[0], ...values[1].map(v => v[3])];
      }
      return { type: "array", value: vals , rawVal : text()};
    }
    
Mathexpression
  = "(" expr:innerExpression ")" { return { type:"mathexpr", value: expr }; }

innerExpression
  = head:([^()]+ / Mathexpression)* {
  let r = head.flat()
  let s = "";
  for (let i = 0; i < r.length; i++){
  let a = r[i]
  if (typeof a !== "string"){
      a = "("+a.value+")"
  }
      s = s  + a
  }
  return s
  }

numberDataType
 = [0-9]+ { return {value: Number(text()), type:"number" } }

functionStatement
  = extraToks "function" extraToks name:fnName? extraToks "(" prams:functionPrams ")" extraToks "{" extraToks scope:start extraToks "}" extraToks { return { type: "function" , prams , scope, name}; }
  
ifCondition
 = extraToks r:functionCall extraToks {return r}
 
ifBlockP1
  = extraToks "{" extraToks r:start extraToks "}" extraToks { return r }

ifBlockP2
  = r:start { return r }

ifBlock
  = ifBlockP1 / ifBlockP2
 
ifStatementP1
  = extraToks "if" extraToks "("condition:ifCondition")" extraToks code:ifBlock extraToks { return { type: "if", condition ,code , "else" : ""}; }

ifStatementP2
 = extraToks "if" extraToks "("condition:ifCondition")" extraToks code:ifBlock extraToks "else" extraToks elseB:ifBlock extraToks { return { type: "if", condition ,code , "else" : elseB}; }

ifStatement = ifStatementP2 / ifStatementP1
  
functionPrams
 = extraToks values:(varName (extraToks "," extraToks varName)*)? extraToks {
      let vals = [];
      if (values) {
        vals = [values[0], ...values[1].map(v => v[3])];
      }
      return vals;
    }

functionCall 
  = extraToks callName:fnName extraToks  "(" prams:functionCallPrams? ")"  extraToks optionalSemicoln {
  // console.log(prams)
    return {
      type: "functionCall",
      callName,
      raw : text(),
      prams: (typeof prams == "array" ? [prams] : prams) || [],
    };
  }

functionCallPrams
 = extraToks values:(DataTypes (extraToks "," extraToks DataTypes)*)? extraToks {
      let vals = [];
      if (values) {
        vals = [values[0], ...values[1].map(v => v[3])];
      }
      return vals;
    }

fnName 
  = [A-Za-z_][A-Za-z0-9_]* { return text(); }
varName =
chars: [A-Za-z0-9_]+ { 
return chars.join("");
}

extraToks
 = extraToksP1

extraToksP1
  = [ \\t\\r\\n]* { return ""; }
  
optionalSemicoln
 = ";"? extraToks {return "";}
`;

const parser = peggy.generate(grammar);

function parse(txt) {
  txt = (STD_Lib_INS.L2_txt || "") + "\n" + txt;
  // console.log("parse");
  // let r = parser.parse(txt);
  // console.log("parse");
  // console.log(r);
  // return r;

  return parser.parse(txt);
}

async function create(globalPipeLineMEM) {
  STD_Lib_INS = globalPipeLineMEM.standerd.lib;
  // console.log(STD_Lib_INS, globalPipeLineMEM);
  return {
    parse: function () {
      if (!globalPipeLineMEM.pipelineData.rawText) {
        console.warn(
          "rawText data is invalid",
          globalPipeLineMEM.pipelineData.rawText,
        );
        return {
          statements: [],
          logs: [{ type: "error", log: "Invalid rawText data" }],
        };
      }
      // console.log(globalPipeLineMEM.pipelineData.rawText);
      return parse(globalPipeLineMEM.pipelineData.rawText);
    },
  };
}

module.exports = { create };
