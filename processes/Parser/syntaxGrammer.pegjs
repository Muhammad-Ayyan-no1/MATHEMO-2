/*
function abc(a, b){
mem x1 = 5;
mem a = 1;
if (x1) return x1;
else return a;
}
abc(1,2);
function abc(a, b){ mem x1 = 5; mem a = 1; if (x1) return x1; else return a; } abc(1,2);
*/
start
= s:statment+ { return { type: "program", body: s } } / extraToks
statment
= blockStatment / memStat / ifElseStatment / ifStatment / functionStat / c:functionCall optionalStatementTerminator { return c }
functionAllowedStatments
= returnStat / blockStatment_fn / memStat / ifElseStatment_fn / ifStatment_fn / c:functionCall optionalStatementTerminator { return c }
returnStat
= extraToks "return" extraToks n:memName extraToks optionalStatementTerminator {
    return { type: "return", value: n }
}
functionStat
= extraToks "function" extraToks n:memName extraToks "(" extraToks p:functionPrams extraToks ")" b:functionAllowedStatments {
    return { type: "function", name: n, params: p, body: b }
}
functionCall
= extraToks n:memName extraToks "(" extraToks a:functionArgs extraToks")" optionalStatementTerminator {
    return { type: "call", name: n, args: a }
}
functionPrams
= extraToks p:prams* extraToks { return p }
functionArgs
= extraToks a:args* extraToks { return a }
prams
= extraToks n:memName optionalComma extraToks { return n }
args
= extraToks d:data optionalComma extraToks { return d }
optionalComma
= "," ? extraToks
ifStatment
= extraToks "if" extraToks "(" extraToks cond:ifCondition extraToks ")" extraToks code:statment {
    return {
        type : "if",
        condition : cond,
        body : code,
    }
}
ifStatment_fn
= extraToks "if" extraToks "(" extraToks cond:ifCondition extraToks ")" extraToks code:functionAllowedStatments {
    return {
        type : "if",
        condition : cond,
        body : code,
    }
}
ifElseStatment
= ifPart:ifStatment elsePart:elseStatment {
    return {
        type : "ifElse",
        condition : ifPart.condition,
        body : ifPart.body,
        elseBody : elsePart.body,
    }
}
ifElseStatment_fn
= ifPart:ifStatment_fn elsePart:elseStatment_fn {
    return {
        type : "ifElse",
        condition : ifPart.condition,
        body : ifPart.body,
        elseBody : elsePart.body,
    }
}
elseStatment
= extraToks "else" extraToks code:statment {
    return { type: "else", body: code }
}
elseStatment_fn
= extraToks "else" extraToks code:functionAllowedStatments {
    return { type: "else", body: code }
}
ifCondition
= extraToks d:data extraToks { return d }
blockStatment
= extraToks "{" body:statment* "}" extraToks optionalStatementTerminator {
    return { type: "block", body: body }
}
blockStatment_fn
= extraToks "{" body:functionAllowedStatments* "}" extraToks optionalStatementTerminator {
    return { type: "block", body: body }
}
memStat
= extraToks "mem" extraToks n:memName extraToks "=" extraToks d:data extraToks optionalStatementTerminator {
    return { type: "mem", name: n, data: d }
}
memName
= memLoc / literal
memLoc
= "x" i:PosInteger  {return {type : "location", value : i}}
data
= integer / rawPass / memName
rawPass
  = "(" expr:innerExpression_rawPass ")" { return { type:"rawPass", value: expr }; }
innerExpression_rawPass
  = head:([^()]+ / rawPass)* {
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
integer
= PosInteger / NegInteger
PosInteger
= (i:[0-9]+   {return i.join("") })  / ("+" extraToks i:[0-9]+   {return i.join("") })   
NegInteger
= "-" extraToks i:[0-9]+ {return "-"+i.join("")}
literal 
= [A-Za-z_]+[_0-9A-Za-z]* { return text(); }
optionalStatementTerminator
  = statementTerminator? extraToks { return ""; }
statementTerminator
  = ";" / "\n"
extraToks
 = extraToksP1
extraToksP1
  = [ \t\r\n]* { return ""; }
  
optionalSemicoln
 = ";"? extraToks {return "";}