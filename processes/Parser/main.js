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

// Token Equvilence
const TE = (() => {
  function simpleTokenEquvilence(token, type, value) {
    return token && token.type === type && token.value === value;
  }

  function allowedValueTE(token, type, valueFn) {
    return token && token.type === type && valueFn(token.value);
  }

  function MultiTypesTEvalFN(token, types, valueFn) {
    for (let i = 0; i < types.length; i++) {
      if (allowedValueTE(token, types[i], valueFn)) return true;
    }
    return false;
  }

  function MultiTypesTEvalue(token, types, value) {
    for (let i = 0; i < types.length; i++) {
      if (simpleTokenEquvilence(token, types[i], value)) return true;
    }
    return false;
  }

  function mainTE(token, type, value) {
    switch (Array.isArray(type) + "," + (typeof value === "function")) {
      case "false,false":
        return simpleTokenEquvilence(token, type, value);
      case "true,false":
        return MultiTypesTEvalue(token, type, value);
      case "false,true":
        return allowedValueTE(token, type, value);
      case "true,true":
        return MultiTypesTEvalFN(token, type, value);
      default:
        return false;
    }
  }

  return mainTE;
})();

//modify token value
function mtv(token, str, rep) {
  return {
    ...token,
    value: str.replace(rep, token.value),
  };
}

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

  name: {},

  positiveInteger: {
    // 123  or +123
    test: (stream) => {
      // let test = stream.save();
      let t = stream.peek(0);
      if (TE(t, "arithmeticOperator", "+")) {
        stream.consume();
        t = stream.peek();
      } else if (TE(t, "arithmeticOperator", "-")) return false;
      if (!TE(t, "number", () => true)) return false;

      if (!Number(t)) return false;
      // stream.restore(test);
      return true;
    },

    parse: (stream) => {
      let t = stream.peek(0);
      stream.consume();
      return {
        parsed: {
          nodeCBK: "PosInt",
          meta: {
            value: t,
          },
          childern: [],
        },
      };
    },
  },

  negativeInt: {
    // -123
    test: (stream) => {
      // let test = stream.save();
      let t = stream.peek(0);
      if (TE(t, "arithmeticOperator", "-")) {
        stream.consume();
        t = stream.peek();
      } else if (TE(t, "arithmeticOperator", "+")) return false;
      if (!TE(t, "number", () => true)) return false;

      if (!Number(t)) return false;
      // stream.restore(test);
      return true;
    },

    parse: (stream) => {
      let t = stream.peek(0);
      stream.consume();
      return {
        parsed: {
          nodeCBK: "NegInt",
          meta: {
            value: mtv(t, "-$", "$"),
          },
          childern: [],
        },
      };
    },
  },
};

const statments = {
  memoryStatment: {
    /* 

    mem location = data;

    OR

    mem varName = data;

    */

    test: (stream, testParse) => {
      let t1 = stream.peek(0);
      if (!TE(t1, "keyword", "mem")) return false;
      let t3 = stream.peak(2);
      if (!TE(t3, "asginmentOperator", "=")) return false;

      let t2 = stream.peak(1); // name/location
      let r_2_tstParse = testParse([t2], syntaxes);
      if (r_2_tstParse[0] != "positiveInteger" || r_2_tstParse[0] != "name")
        return false;

      let t4 = stream.peak(3); // data to store
      let r_4_tstParse = testParse([t4], syntaxes);
      if (r_4_tstParse[0] != "data") return false;

      return true;
    },

    parse: (stream, parse) => {
      let name = stream.peak(1);
      let parsedName = parse([name], syntaxes);

      let data = stream.peak(3);
      let parsedData = parse([data], syntaxes);
    },
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
