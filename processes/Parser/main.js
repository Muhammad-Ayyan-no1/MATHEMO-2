/*

Syntaxes :-
mem statment :
        mem location/varName = data;

if statment :- 
        if (memLocation/VarName) code else code

functions :-
        function name(pram1, pram2, ...) code;



*/

/*
A statment is multiple syntax.
For example for a simple statment    var name = data;   data and name are seperate syntax
*/
class TokenStream {
  constructor(tokens) {
    this.tokens = tokens;
    this.pos = 0;
  }
  peek(offset = 0) {
    return this.tokens[this.pos + offset];
  }
  consume() {
    return this.tokens[this.pos++];
  }
  save() {
    return this.pos;
  }
  restore(pos) {
    this.pos = pos;
  }
}
const syntaxes = {
  data: {
    /*
Supported data syntaxes :
integers positive/negative
    */
    test: () => {},
    parse: () => {},
  },
  positiveInteger: {
    // 123  or +123
    test: () => {},
    parse: () => {},
  },
  negativeInteger: {
    // -123
    test: () => {},
    parse: () => {},
  },
};
const statments = {
  memoryStatment: {
    /* 
    mem location = data;
    OR
    mem varName = data;
    */
    test: (stream, testParse) => {},
    parse: (stream, parse) => {},
  },
};

//It is like parse but it only returns true/false stack that is for recursive used to test syntax
function testParse(tokenized, selections = statments) {
  const stream = new TokenStream(tokenized);
  let R = [];
  while (stream.peek()) {
    let r = false;
    for (const selection in selections) {
      const saved = stream.save();
      if (selections[selection].test(stream, testParse)) {
        r = selection;
        break;
      }
      stream.restore(saved);
    }
    if (r === false) return R;
    R.push(r);
  }
  return R;
}
function parse(tokenized, selections = statments) {
  /*
Form:
node => {
nodeCBK : some name,
meta : {metadata},
childern : [more nodes]
}
*/
  const stream = new TokenStream(tokenized);
  let AST = {
    meta: {},
    childern: [],
  };
  while (stream.peek()) {
    for (const selection in selections) {
      const saved = stream.save();
      if (selections[selection].test(stream, testParse)) {
        stream.restore(saved);
        let parsedR = selections[selection].parse(stream, parse);
        if (parsedR.errorBool) continue;
        AST.childern.push(parsedR.parsed);
        break;
      }
      stream.restore(saved);
    }
  }
  return AST;
}
export { parse, testParse, TokenStream };
