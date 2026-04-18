let peggy;

function safeLibrary(lib, name, fallback) {
  if (!lib || !lib.get) return fallback;
  return lib.get(name) || fallback;
}

const grammer = `
start
= memStat

memStat 
= extraToks "mem" extraToks n:memName extraToks "=" extraToks d:data extraToks optionalSemicoln {
return {
data : d,
name : n
}
}

memName
= memLoc / literal

memLoc
= "x" i:PosInteger  {return {type : "location", value : i}}

data
= integer

integer
= PosInteger / NegInteger

PosInteger
= (i:[0-9]+   {return i.join("") })  / ("+" extraToks i:[0-9]+   {return i.join("") })   

NegInteger
= "-" extraToks i:[0-9]+ {return "-"+i.join("")}

literal 
= [A-Za-z_]+[_0-9A-Za-z]* { return text(); }

extraToks
 = extraToksP1

extraToksP1
  = [ \\t\\r\\n]* { return ""; }
  
optionalSemicoln
 = ";"? extraToks {return "";}
`;
let parser;

function parse(str) {
  // console.log(str);
  return parser(str);
}

function createParser(lib) {
  peggy = safeLibrary(lib, "peggy", null);
  parser = peggy.generate(grammer).parse;
  console.log("\n\n\n", parser);
  return {
    parse: parser,
  };
}

export { createParser };
