/*
{{{{mem x123=321;};}} if (x123) {mem x321 = 1;}; }
*/

start
= statment+ / extraToks

statment
= blockStatment / memStat / ifElseStatment / ifStatment / functionStat optionalStatementTerminator


functionStat
= extraToks "function" extraToks memName extraToks "(" extraToks functionPramsArgs extraToks ")" statment

functionCall
= extraToks memName extraToks "(" extraToks functionPramsArgs extraToks")" optionalStatementTerminator

functionPramsArgs
= extraToks pramarg* extraToks

pramarg
= extraToks memName optionalComma extraToks

optionalComma
= "," ? extraToks

ifStatment
= extraToks "if" extraToks "(" extraToks cond:ifCondition extraToks ")" extraToks code:statment {
    return {
        type : "ifCondition",
        value : {
            condition : cond,
            code : code,
        }
    }
}

ifElseStatment
= ifPart:ifStatment elsePart:elseStatment {
    return {
        type : "ifElseCondition",
        value : {
            ifPart : ifPart,
            elsePart : elsePart
        }
    }
}

elseStatment 
= extraToks code:statment {
    return {
        type : "elseCondition",
        value : code,
    }
}

ifCondition 
= extraToks memName extraToks

blockStatment
= extraToks "{" statments:(statment:statment optionalStatementTerminator {
    return {
        type : "statment",
        value : statment
    }
})*  "}" extraToks optionalStatementTerminator {
    return {
        type : "statments",
        value : statments
    }
}

memStat 
= extraToks "mem" extraToks n:memName extraToks "=" extraToks d:data extraToks optionalStatementTerminator {
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
= integer / rawPass

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