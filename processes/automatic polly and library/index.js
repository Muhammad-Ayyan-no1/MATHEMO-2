const DEFAULT_LIBRARY_NAMES = [
  "chalk",
  "boxen",
  "ora",
  "inquirer",
  "peggy",
  "fs",
  "path",
];

const DEFAULT_FALLBACKS = {
  chalk: () => {
    const identity = new Proxy((text) => String(text ?? ""), {
      get(target) {
        return target;
      },
      apply(target, thisArg, args) {
        return args.map((value) => String(value ?? "")).join(" ");
      },
    });
    return identity;
  },
  boxen: () => (text) => String(text ?? ""),
  ora: () => {
    const spinner = {
      text: "",
      start() {
        return this;
      },
      stop() {
        return this;
      },
      succeed() {
        return this;
      },
      fail() {
        return this;
      },
      info() {
        return this;
      },
    };
    return (text) => {
      spinner.text = String(text ?? "");
      return spinner;
    };
  },
  inquirer: () => ({
    prompt: async (questions) => {
      if (!Array.isArray(questions)) return {};
      return questions.reduce((answers, question) => {
        if (question && question.name) {
          answers[question.name] = question.default ?? null;
        }
        return answers;
      }, {});
    },
  }),
};

function _normalizeModule(module) {
  if (module && typeof module === "object" && "default" in module) {
    return module.default;
  }
  return module;
}

function _createMissingModule(name, error) {
  return {
    _missing: true,
    name,
    error,
    warn() {
      console.warn(`[autoLib] missing module: ${name}`);
    },
  };
}

class AutoLibrary {
  constructor(options = {}) {
    this._cache = {};
    this._registry = {};
    this._fallbacks = { ...DEFAULT_FALLBACKS, ...(options.fallbacks || {}) };
    this._defaultNames = Array.isArray(options.defaults)
      ? options.defaults
      : DEFAULT_LIBRARY_NAMES;
  }

  async _importModule(name) {
    try {
      const module = await import(name);
      return _normalizeModule(module);
    } catch (error) {
      return null;
    }
  }

  register(name, loader, fallback) {
    if (!name) return this;
    this._registry[name] = { loader, fallback };
    return this;
  }

  async load(name) {
    if (!name) return null;
    if (this._cache[name]) return this._cache[name];

    const registered = this._registry[name] || {};
    const loader = registered.loader || (() => this._importModule(name));
    const fallback = registered.fallback || this._fallbacks[name];

    let module = null;
    try {
      module = _normalizeModule(await loader());
    } catch (error) {
      module = null;
    }

    if (module) {
      this._cache[name] = module;
      return module;
    }

    if (fallback) {
      const fallbackValue =
        typeof fallback === "function" ? fallback() : fallback;
      this._cache[name] = fallbackValue;
      return fallbackValue;
    }

    const missing = _createMissingModule(
      name,
      new Error(`Module not available: ${name}`),
    );
    this._cache[name] = missing;
    return missing;
  }

  get(name) {
    if (!name) return null;
    if (this._cache[name]) return this._cache[name];
    if (this._fallbacks[name]) return this._fallbacks[name]();
    return null;
  }

  has(name) {
    return Boolean(
      this._cache[name] || this._registry[name] || this._fallbacks[name],
    );
  }

  async preload(names) {
    const list = Array.isArray(names) ? names : this._defaultNames;
    for (const name of list) {
      await this.load(name);
    }
    return this;
  }

  list() {
    return Array.from(
      new Set([
        ...Object.keys(this._cache),
        ...Object.keys(this._registry),
        ...Object.keys(this._fallbacks),
      ]),
    );
  }

  create(ctx) {
    const options = ctx || {};
    const library = new AutoLibrary(options);
    if (options.register) {
      for (const [name, config] of Object.entries(options.register)) {
        library.register(name, config.loader, config.fallback);
      }
    }
    return {
      cbk: "autoLib",
      id: `autoLib_${Date.now()}`,
      ins: library,
      register: (name, loader, fallback) =>
        library.register(name, loader, fallback),
      load: (name) => library.load(name),
      get: (name) => library.get(name),
      has: (name) => library.has(name),
      preload: (names) => library.preload(names),
      list: () => library.list(),
      init() {},
      despawn() {
        this._cache = {};
        this._registry = {};
      },
      exportState() {
        return { loaded: Object.keys(library._cache) };
      },
      importState(state) {
        if (!state || !state.loaded) return;
        state.loaded.forEach((name) => {
          if (library._cache[name]) return;
          library._cache[name] = this._fallbacks[name]
            ? this._fallbacks[name]()
            : _createMissingModule(
                name,
                new Error(`Restored fallback for ${name}`),
              );
        });
      },
    };
  }
}

function create(ctx) {
  const options = ctx || {};
  const library = new AutoLibrary(options);
  return {
    cbk: "autoLib",
    id: `autoLib_${Date.now()}`,
    ins: library,
    register: (name, loader, fallback) =>
      library.register(name, loader, fallback),
    load: (name) => library.load(name),
    get: (name) => library.get(name),
    has: (name) => library.has(name),
    preload: (names) => library.preload(names),
    list: () => library.list(),
    init() {},
    despawn() {
      library._cache = {};
      library._registry = {};
    },
    exportState() {
      return { loaded: Object.keys(library._cache) };
    },
    importState(state) {
      if (!state || !state.loaded) return;
      state.loaded.forEach((name) => {
        if (!library._cache[name]) {
          library._cache[name] = library._fallbacks[name]
            ? library._fallbacks[name]()
            : _createMissingModule(
                name,
                new Error(`Restored fallback for ${name}`),
              );
        }
      });
    },
  };
}

export { create, DEFAULT_LIBRARY_NAMES };
