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
= statment+ / extraToks

statment
= blockStatment / memStat / ifElseStatment / ifStatment / functionStat / functionCall optionalStatementTerminator 


functionAllowedStatments
= returnStat / blockStatment_fn / memStat / ifElseStatment_fn / ifStatment_fn / functionCall optionalStatementTerminator

returnStat
= extraToks "return" extraToks memName extraToks optionalStatementTerminator

functionStat
= extraToks "function" extraToks memName extraToks "(" extraToks functionPrams extraToks ")" functionAllowedStatments

functionCall
= extraToks memName extraToks "(" extraToks functionArgs extraToks")" optionalStatementTerminator

functionPrams
= extraToks prams* extraToks

functionArgs
= extraToks args* extraToks

prams
= extraToks memName optionalComma extraToks

args
= extraToks data optionalComma extraToks

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

ifStatment_fn
= extraToks "if" extraToks "(" extraToks cond:ifCondition extraToks ")" extraToks code:functionAllowedStatments {
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

ifElseStatment_fn
= ifPart:ifStatment_fn elsePart:elseStatment_fn {
    return {
        type : "ifElseCondition",
        value : {
            ifPart : ifPart,
            elsePart : elsePart
        }
    }
}

elseStatment
= extraToks "else" extraToks code:statment {
    return {
        type : "elseCondition",
        value : code,
    }
}

elseStatment_fn
= extraToks "else" extraToks code:functionAllowedStatments {
    return {
        type : "elseCondition",
        value : code,
    }
}

ifCondition 
= extraToks data extraToks

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

blockStatment_fn
= extraToks "{" statments:(statment:functionAllowedStatments optionalStatementTerminator {
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