const n2w = require("n2words");

// This sys is used in logging system to transform variables, etc into readable and viceversa
// This sys is also used to "store" data in hashmap (to ensure compatibility with processes)
/*
Everyone shall follow the protocoal of naming "keywords"
These protocoal is:

<Template fillout> {{{Your Protocoal stuff}}}
*/

let map = {
  cbk: "Code Base Keywords",
  cbkM: "Code Base Map of Keywords",
  ins: "Instance",
  // todo
};

let inverted = (() => {
  let r = {};
  for (const n in map) {
    r[map[n]] = n;
  }
  return r;
})();

function resultNum(str) {
  if (!str.match(/r_*[0-9_]+/)) return false;
  let num = Number(str.slice(1, str.length).replace("_", ""));

  return (n2w.toOrdinal(num) || num + "th") + " result";
}

let fullMap = { ...inverted, ...map };

//decomposes a chain (multiple) codebase keywords then decodes them etc
function chainAbrivations(str) {
  if (!str.startsWith("C_") && str.startsWith("C__")) return false;
  let abrivations = str.split(/[ ]+[^]+/);
  let abrivationsFiller = str.split(/![[ ]+[^]+]/);
  let r = "";
  let carry = "";
  let j = 0;
  for (let i = 0; i < abrivations.length; i++) {
    if (carry != "" && fullMap[carry + " " + abrivations[i]]) {
      r += carry + " " + abrivations[i] + abrivationsFiller[i];
      carry = "";
    } else if (
      carry != "" &&
      fullMap[carry + abrivationsFiller[i] + abrivations[i]]
    ) {
      r += carry + abrivationsFiller[i] + abrivations[i] + abrivationsFiller[i];
      carry = "";
    } else if (
      carry != "" &&
      (() => {
        j = 0;
        for (j = 0; j < abrivationsFiller.length; j++) {
          if (fullMap[carry + abrivationsFiller[j] + abrivations[i]])
            return true;
        }
        return false;
      })()
    ) {
      r += carry + abrivationsFiller[j] + abrivations[i] + abrivationsFiller[i];
      carry = "";
    } else if (fullMap[abrivations[i]] && carry == "") {
      r += abrivations[i] + abrivationsFiller[i];
    } else {
      carry += fullMap[abrivations[i]];
    }
  }

  if (r == "") return false;
  if (carry == "") return r;
  return r + "$Carry=" + carry;
}

for (const n in fullMap) {
  fullMap["_" + n + "_"] = n[fullMap].replace(" ", "_");
}

function get(item) {
  return fullMap[item] || resultNum(item) || chainAbrivations(item);
}

function create() {}

module.exports = { create };
