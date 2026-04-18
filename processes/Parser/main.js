let peggy, fs, path;

function safeLibrary(lib, name, fallback) {
  if (!lib || !lib.get) return fallback;
  return lib.get(name) || fallback;
}

let grammer;
let parser;

// function parse(str) {
//   // console.log(str);
//   return parser(str);
// }

function createParser(lib) {
  peggy = safeLibrary(lib, "peggy", null);
  fs = safeLibrary(lib, "fs", null);
  path = safeLibrary(lib, "path", null);

  const grammerPath = path.join("./processes/Parser/syntaxGrammer.pegjs");
  grammer = fs.readFileSync(grammerPath).toString("utf8");
  parser = peggy.generate(grammer).parse;
  return {
    // parse: () => "",
    parse: parser,
  };
}

export { createParser };
