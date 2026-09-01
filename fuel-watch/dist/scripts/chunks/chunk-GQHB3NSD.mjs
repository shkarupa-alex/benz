import { createRequire as __fuelWatchCreateRequire } from 'node:module'; const require = __fuelWatchCreateRequire(import.meta.url);
import {
  __commonJS,
  __toESM,
  normalizeFuelLabel
} from "./chunk-XKTP5TT3.mjs";

// node_modules/ajv/dist/compile/codegen/code.js
var require_code = __commonJS({
  "node_modules/ajv/dist/compile/codegen/code.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.regexpCode = exports.getEsmExportName = exports.getProperty = exports.safeStringify = exports.stringify = exports.strConcat = exports.addCodeArg = exports.str = exports._ = exports.nil = exports._Code = exports.Name = exports.IDENTIFIER = exports._CodeOrName = void 0;
    var _CodeOrName = class {
    };
    exports._CodeOrName = _CodeOrName;
    exports.IDENTIFIER = /^[a-z$_][a-z$_0-9]*$/i;
    var Name = class extends _CodeOrName {
      constructor(s) {
        super();
        if (!exports.IDENTIFIER.test(s))
          throw new Error("CodeGen: name must be a valid identifier");
        this.str = s;
      }
      toString() {
        return this.str;
      }
      emptyStr() {
        return false;
      }
      get names() {
        return { [this.str]: 1 };
      }
    };
    exports.Name = Name;
    var _Code = class extends _CodeOrName {
      constructor(code) {
        super();
        this._items = typeof code === "string" ? [code] : code;
      }
      toString() {
        return this.str;
      }
      emptyStr() {
        if (this._items.length > 1)
          return false;
        const item = this._items[0];
        return item === "" || item === '""';
      }
      get str() {
        var _a;
        return (_a = this._str) !== null && _a !== void 0 ? _a : this._str = this._items.reduce((s, c) => `${s}${c}`, "");
      }
      get names() {
        var _a;
        return (_a = this._names) !== null && _a !== void 0 ? _a : this._names = this._items.reduce((names, c) => {
          if (c instanceof Name)
            names[c.str] = (names[c.str] || 0) + 1;
          return names;
        }, {});
      }
    };
    exports._Code = _Code;
    exports.nil = new _Code("");
    function _(strs, ...args) {
      const code = [strs[0]];
      let i = 0;
      while (i < args.length) {
        addCodeArg(code, args[i]);
        code.push(strs[++i]);
      }
      return new _Code(code);
    }
    exports._ = _;
    var plus = new _Code("+");
    function str(strs, ...args) {
      const expr = [safeStringify(strs[0])];
      let i = 0;
      while (i < args.length) {
        expr.push(plus);
        addCodeArg(expr, args[i]);
        expr.push(plus, safeStringify(strs[++i]));
      }
      optimize(expr);
      return new _Code(expr);
    }
    exports.str = str;
    function addCodeArg(code, arg) {
      if (arg instanceof _Code)
        code.push(...arg._items);
      else if (arg instanceof Name)
        code.push(arg);
      else
        code.push(interpolate(arg));
    }
    exports.addCodeArg = addCodeArg;
    function optimize(expr) {
      let i = 1;
      while (i < expr.length - 1) {
        if (expr[i] === plus) {
          const res = mergeExprItems(expr[i - 1], expr[i + 1]);
          if (res !== void 0) {
            expr.splice(i - 1, 3, res);
            continue;
          }
          expr[i++] = "+";
        }
        i++;
      }
    }
    function mergeExprItems(a, b) {
      if (b === '""')
        return a;
      if (a === '""')
        return b;
      if (typeof a == "string") {
        if (b instanceof Name || a[a.length - 1] !== '"')
          return;
        if (typeof b != "string")
          return `${a.slice(0, -1)}${b}"`;
        if (b[0] === '"')
          return a.slice(0, -1) + b.slice(1);
        return;
      }
      if (typeof b == "string" && b[0] === '"' && !(a instanceof Name))
        return `"${a}${b.slice(1)}`;
      return;
    }
    function strConcat(c1, c2) {
      return c2.emptyStr() ? c1 : c1.emptyStr() ? c2 : str`${c1}${c2}`;
    }
    exports.strConcat = strConcat;
    function interpolate(x) {
      return typeof x == "number" || typeof x == "boolean" || x === null ? x : safeStringify(Array.isArray(x) ? x.join(",") : x);
    }
    function stringify(x) {
      return new _Code(safeStringify(x));
    }
    exports.stringify = stringify;
    function safeStringify(x) {
      return JSON.stringify(x).replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
    }
    exports.safeStringify = safeStringify;
    function getProperty(key) {
      return typeof key == "string" && exports.IDENTIFIER.test(key) ? new _Code(`.${key}`) : _`[${key}]`;
    }
    exports.getProperty = getProperty;
    function getEsmExportName(key) {
      if (typeof key == "string" && exports.IDENTIFIER.test(key)) {
        return new _Code(`${key}`);
      }
      throw new Error(`CodeGen: invalid export name: ${key}, use explicit $id name mapping`);
    }
    exports.getEsmExportName = getEsmExportName;
    function regexpCode(rx) {
      return new _Code(rx.toString());
    }
    exports.regexpCode = regexpCode;
  }
});

// node_modules/ajv/dist/compile/codegen/scope.js
var require_scope = __commonJS({
  "node_modules/ajv/dist/compile/codegen/scope.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.ValueScope = exports.ValueScopeName = exports.Scope = exports.varKinds = exports.UsedValueState = void 0;
    var code_1 = require_code();
    var ValueError = class extends Error {
      constructor(name) {
        super(`CodeGen: "code" for ${name} not defined`);
        this.value = name.value;
      }
    };
    var UsedValueState;
    (function(UsedValueState2) {
      UsedValueState2[UsedValueState2["Started"] = 0] = "Started";
      UsedValueState2[UsedValueState2["Completed"] = 1] = "Completed";
    })(UsedValueState || (exports.UsedValueState = UsedValueState = {}));
    exports.varKinds = {
      const: new code_1.Name("const"),
      let: new code_1.Name("let"),
      var: new code_1.Name("var")
    };
    var Scope = class {
      constructor({ prefixes, parent } = {}) {
        this._names = {};
        this._prefixes = prefixes;
        this._parent = parent;
      }
      toName(nameOrPrefix) {
        return nameOrPrefix instanceof code_1.Name ? nameOrPrefix : this.name(nameOrPrefix);
      }
      name(prefix) {
        return new code_1.Name(this._newName(prefix));
      }
      _newName(prefix) {
        const ng = this._names[prefix] || this._nameGroup(prefix);
        return `${prefix}${ng.index++}`;
      }
      _nameGroup(prefix) {
        var _a, _b;
        if (((_b = (_a = this._parent) === null || _a === void 0 ? void 0 : _a._prefixes) === null || _b === void 0 ? void 0 : _b.has(prefix)) || this._prefixes && !this._prefixes.has(prefix)) {
          throw new Error(`CodeGen: prefix "${prefix}" is not allowed in this scope`);
        }
        return this._names[prefix] = { prefix, index: 0 };
      }
    };
    exports.Scope = Scope;
    var ValueScopeName = class extends code_1.Name {
      constructor(prefix, nameStr) {
        super(nameStr);
        this.prefix = prefix;
      }
      setValue(value, { property, itemIndex }) {
        this.value = value;
        this.scopePath = (0, code_1._)`.${new code_1.Name(property)}[${itemIndex}]`;
      }
    };
    exports.ValueScopeName = ValueScopeName;
    var line = (0, code_1._)`\n`;
    var ValueScope = class extends Scope {
      constructor(opts) {
        super(opts);
        this._values = {};
        this._scope = opts.scope;
        this.opts = { ...opts, _n: opts.lines ? line : code_1.nil };
      }
      get() {
        return this._scope;
      }
      name(prefix) {
        return new ValueScopeName(prefix, this._newName(prefix));
      }
      value(nameOrPrefix, value) {
        var _a;
        if (value.ref === void 0)
          throw new Error("CodeGen: ref must be passed in value");
        const name = this.toName(nameOrPrefix);
        const { prefix } = name;
        const valueKey = (_a = value.key) !== null && _a !== void 0 ? _a : value.ref;
        let vs = this._values[prefix];
        if (vs) {
          const _name = vs.get(valueKey);
          if (_name)
            return _name;
        } else {
          vs = this._values[prefix] = /* @__PURE__ */ new Map();
        }
        vs.set(valueKey, name);
        const s = this._scope[prefix] || (this._scope[prefix] = []);
        const itemIndex = s.length;
        s[itemIndex] = value.ref;
        name.setValue(value, { property: prefix, itemIndex });
        return name;
      }
      getValue(prefix, keyOrRef) {
        const vs = this._values[prefix];
        if (!vs)
          return;
        return vs.get(keyOrRef);
      }
      scopeRefs(scopeName, values = this._values) {
        return this._reduceValues(values, (name) => {
          if (name.scopePath === void 0)
            throw new Error(`CodeGen: name "${name}" has no value`);
          return (0, code_1._)`${scopeName}${name.scopePath}`;
        });
      }
      scopeCode(values = this._values, usedValues, getCode) {
        return this._reduceValues(values, (name) => {
          if (name.value === void 0)
            throw new Error(`CodeGen: name "${name}" has no value`);
          return name.value.code;
        }, usedValues, getCode);
      }
      _reduceValues(values, valueCode, usedValues = {}, getCode) {
        let code = code_1.nil;
        for (const prefix in values) {
          const vs = values[prefix];
          if (!vs)
            continue;
          const nameSet = usedValues[prefix] = usedValues[prefix] || /* @__PURE__ */ new Map();
          vs.forEach((name) => {
            if (nameSet.has(name))
              return;
            nameSet.set(name, UsedValueState.Started);
            let c = valueCode(name);
            if (c) {
              const def = this.opts.es5 ? exports.varKinds.var : exports.varKinds.const;
              code = (0, code_1._)`${code}${def} ${name} = ${c};${this.opts._n}`;
            } else if (c = getCode === null || getCode === void 0 ? void 0 : getCode(name)) {
              code = (0, code_1._)`${code}${c}${this.opts._n}`;
            } else {
              throw new ValueError(name);
            }
            nameSet.set(name, UsedValueState.Completed);
          });
        }
        return code;
      }
    };
    exports.ValueScope = ValueScope;
  }
});

// node_modules/ajv/dist/compile/codegen/index.js
var require_codegen = __commonJS({
  "node_modules/ajv/dist/compile/codegen/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.or = exports.and = exports.not = exports.CodeGen = exports.operators = exports.varKinds = exports.ValueScopeName = exports.ValueScope = exports.Scope = exports.Name = exports.regexpCode = exports.stringify = exports.getProperty = exports.nil = exports.strConcat = exports.str = exports._ = void 0;
    var code_1 = require_code();
    var scope_1 = require_scope();
    var code_2 = require_code();
    Object.defineProperty(exports, "_", { enumerable: true, get: function() {
      return code_2._;
    } });
    Object.defineProperty(exports, "str", { enumerable: true, get: function() {
      return code_2.str;
    } });
    Object.defineProperty(exports, "strConcat", { enumerable: true, get: function() {
      return code_2.strConcat;
    } });
    Object.defineProperty(exports, "nil", { enumerable: true, get: function() {
      return code_2.nil;
    } });
    Object.defineProperty(exports, "getProperty", { enumerable: true, get: function() {
      return code_2.getProperty;
    } });
    Object.defineProperty(exports, "stringify", { enumerable: true, get: function() {
      return code_2.stringify;
    } });
    Object.defineProperty(exports, "regexpCode", { enumerable: true, get: function() {
      return code_2.regexpCode;
    } });
    Object.defineProperty(exports, "Name", { enumerable: true, get: function() {
      return code_2.Name;
    } });
    var scope_2 = require_scope();
    Object.defineProperty(exports, "Scope", { enumerable: true, get: function() {
      return scope_2.Scope;
    } });
    Object.defineProperty(exports, "ValueScope", { enumerable: true, get: function() {
      return scope_2.ValueScope;
    } });
    Object.defineProperty(exports, "ValueScopeName", { enumerable: true, get: function() {
      return scope_2.ValueScopeName;
    } });
    Object.defineProperty(exports, "varKinds", { enumerable: true, get: function() {
      return scope_2.varKinds;
    } });
    exports.operators = {
      GT: new code_1._Code(">"),
      GTE: new code_1._Code(">="),
      LT: new code_1._Code("<"),
      LTE: new code_1._Code("<="),
      EQ: new code_1._Code("==="),
      NEQ: new code_1._Code("!=="),
      NOT: new code_1._Code("!"),
      OR: new code_1._Code("||"),
      AND: new code_1._Code("&&"),
      ADD: new code_1._Code("+")
    };
    var Node = class {
      optimizeNodes() {
        return this;
      }
      optimizeNames(_names, _constants) {
        return this;
      }
    };
    var Def = class extends Node {
      constructor(varKind, name, rhs) {
        super();
        this.varKind = varKind;
        this.name = name;
        this.rhs = rhs;
      }
      render({ es5, _n }) {
        const varKind = es5 ? scope_1.varKinds.var : this.varKind;
        const rhs = this.rhs === void 0 ? "" : ` = ${this.rhs}`;
        return `${varKind} ${this.name}${rhs};` + _n;
      }
      optimizeNames(names, constants) {
        if (!names[this.name.str])
          return;
        if (this.rhs)
          this.rhs = optimizeExpr(this.rhs, names, constants);
        return this;
      }
      get names() {
        return this.rhs instanceof code_1._CodeOrName ? this.rhs.names : {};
      }
    };
    var Assign = class extends Node {
      constructor(lhs, rhs, sideEffects) {
        super();
        this.lhs = lhs;
        this.rhs = rhs;
        this.sideEffects = sideEffects;
      }
      render({ _n }) {
        return `${this.lhs} = ${this.rhs};` + _n;
      }
      optimizeNames(names, constants) {
        if (this.lhs instanceof code_1.Name && !names[this.lhs.str] && !this.sideEffects)
          return;
        this.rhs = optimizeExpr(this.rhs, names, constants);
        return this;
      }
      get names() {
        const names = this.lhs instanceof code_1.Name ? {} : { ...this.lhs.names };
        return addExprNames(names, this.rhs);
      }
    };
    var AssignOp = class extends Assign {
      constructor(lhs, op, rhs, sideEffects) {
        super(lhs, rhs, sideEffects);
        this.op = op;
      }
      render({ _n }) {
        return `${this.lhs} ${this.op}= ${this.rhs};` + _n;
      }
    };
    var Label = class extends Node {
      constructor(label) {
        super();
        this.label = label;
        this.names = {};
      }
      render({ _n }) {
        return `${this.label}:` + _n;
      }
    };
    var Break = class extends Node {
      constructor(label) {
        super();
        this.label = label;
        this.names = {};
      }
      render({ _n }) {
        const label = this.label ? ` ${this.label}` : "";
        return `break${label};` + _n;
      }
    };
    var Throw = class extends Node {
      constructor(error) {
        super();
        this.error = error;
      }
      render({ _n }) {
        return `throw ${this.error};` + _n;
      }
      get names() {
        return this.error.names;
      }
    };
    var AnyCode = class extends Node {
      constructor(code) {
        super();
        this.code = code;
      }
      render({ _n }) {
        return `${this.code};` + _n;
      }
      optimizeNodes() {
        return `${this.code}` ? this : void 0;
      }
      optimizeNames(names, constants) {
        this.code = optimizeExpr(this.code, names, constants);
        return this;
      }
      get names() {
        return this.code instanceof code_1._CodeOrName ? this.code.names : {};
      }
    };
    var ParentNode = class extends Node {
      constructor(nodes = []) {
        super();
        this.nodes = nodes;
      }
      render(opts) {
        return this.nodes.reduce((code, n) => code + n.render(opts), "");
      }
      optimizeNodes() {
        const { nodes } = this;
        let i = nodes.length;
        while (i--) {
          const n = nodes[i].optimizeNodes();
          if (Array.isArray(n))
            nodes.splice(i, 1, ...n);
          else if (n)
            nodes[i] = n;
          else
            nodes.splice(i, 1);
        }
        return nodes.length > 0 ? this : void 0;
      }
      optimizeNames(names, constants) {
        const { nodes } = this;
        let i = nodes.length;
        while (i--) {
          const n = nodes[i];
          if (n.optimizeNames(names, constants))
            continue;
          subtractNames(names, n.names);
          nodes.splice(i, 1);
        }
        return nodes.length > 0 ? this : void 0;
      }
      get names() {
        return this.nodes.reduce((names, n) => addNames(names, n.names), {});
      }
    };
    var BlockNode = class extends ParentNode {
      render(opts) {
        return "{" + opts._n + super.render(opts) + "}" + opts._n;
      }
    };
    var Root = class extends ParentNode {
    };
    var Else = class extends BlockNode {
    };
    Else.kind = "else";
    var If = class _If extends BlockNode {
      constructor(condition, nodes) {
        super(nodes);
        this.condition = condition;
      }
      render(opts) {
        let code = `if(${this.condition})` + super.render(opts);
        if (this.else)
          code += "else " + this.else.render(opts);
        return code;
      }
      optimizeNodes() {
        super.optimizeNodes();
        const cond = this.condition;
        if (cond === true)
          return this.nodes;
        let e = this.else;
        if (e) {
          const ns = e.optimizeNodes();
          e = this.else = Array.isArray(ns) ? new Else(ns) : ns;
        }
        if (e) {
          if (cond === false)
            return e instanceof _If ? e : e.nodes;
          if (this.nodes.length)
            return this;
          return new _If(not(cond), e instanceof _If ? [e] : e.nodes);
        }
        if (cond === false || !this.nodes.length)
          return void 0;
        return this;
      }
      optimizeNames(names, constants) {
        var _a;
        this.else = (_a = this.else) === null || _a === void 0 ? void 0 : _a.optimizeNames(names, constants);
        if (!(super.optimizeNames(names, constants) || this.else))
          return;
        this.condition = optimizeExpr(this.condition, names, constants);
        return this;
      }
      get names() {
        const names = super.names;
        addExprNames(names, this.condition);
        if (this.else)
          addNames(names, this.else.names);
        return names;
      }
    };
    If.kind = "if";
    var For = class extends BlockNode {
    };
    For.kind = "for";
    var ForLoop = class extends For {
      constructor(iteration) {
        super();
        this.iteration = iteration;
      }
      render(opts) {
        return `for(${this.iteration})` + super.render(opts);
      }
      optimizeNames(names, constants) {
        if (!super.optimizeNames(names, constants))
          return;
        this.iteration = optimizeExpr(this.iteration, names, constants);
        return this;
      }
      get names() {
        return addNames(super.names, this.iteration.names);
      }
    };
    var ForRange = class extends For {
      constructor(varKind, name, from, to) {
        super();
        this.varKind = varKind;
        this.name = name;
        this.from = from;
        this.to = to;
      }
      render(opts) {
        const varKind = opts.es5 ? scope_1.varKinds.var : this.varKind;
        const { name, from, to } = this;
        return `for(${varKind} ${name}=${from}; ${name}<${to}; ${name}++)` + super.render(opts);
      }
      get names() {
        const names = addExprNames(super.names, this.from);
        return addExprNames(names, this.to);
      }
    };
    var ForIter = class extends For {
      constructor(loop, varKind, name, iterable) {
        super();
        this.loop = loop;
        this.varKind = varKind;
        this.name = name;
        this.iterable = iterable;
      }
      render(opts) {
        return `for(${this.varKind} ${this.name} ${this.loop} ${this.iterable})` + super.render(opts);
      }
      optimizeNames(names, constants) {
        if (!super.optimizeNames(names, constants))
          return;
        this.iterable = optimizeExpr(this.iterable, names, constants);
        return this;
      }
      get names() {
        return addNames(super.names, this.iterable.names);
      }
    };
    var Func = class extends BlockNode {
      constructor(name, args, async) {
        super();
        this.name = name;
        this.args = args;
        this.async = async;
      }
      render(opts) {
        const _async = this.async ? "async " : "";
        return `${_async}function ${this.name}(${this.args})` + super.render(opts);
      }
    };
    Func.kind = "func";
    var Return = class extends ParentNode {
      render(opts) {
        return "return " + super.render(opts);
      }
    };
    Return.kind = "return";
    var Try = class extends BlockNode {
      render(opts) {
        let code = "try" + super.render(opts);
        if (this.catch)
          code += this.catch.render(opts);
        if (this.finally)
          code += this.finally.render(opts);
        return code;
      }
      optimizeNodes() {
        var _a, _b;
        super.optimizeNodes();
        (_a = this.catch) === null || _a === void 0 ? void 0 : _a.optimizeNodes();
        (_b = this.finally) === null || _b === void 0 ? void 0 : _b.optimizeNodes();
        return this;
      }
      optimizeNames(names, constants) {
        var _a, _b;
        super.optimizeNames(names, constants);
        (_a = this.catch) === null || _a === void 0 ? void 0 : _a.optimizeNames(names, constants);
        (_b = this.finally) === null || _b === void 0 ? void 0 : _b.optimizeNames(names, constants);
        return this;
      }
      get names() {
        const names = super.names;
        if (this.catch)
          addNames(names, this.catch.names);
        if (this.finally)
          addNames(names, this.finally.names);
        return names;
      }
    };
    var Catch = class extends BlockNode {
      constructor(error) {
        super();
        this.error = error;
      }
      render(opts) {
        return `catch(${this.error})` + super.render(opts);
      }
    };
    Catch.kind = "catch";
    var Finally = class extends BlockNode {
      render(opts) {
        return "finally" + super.render(opts);
      }
    };
    Finally.kind = "finally";
    var CodeGen = class {
      constructor(extScope, opts = {}) {
        this._values = {};
        this._blockStarts = [];
        this._constants = {};
        this.opts = { ...opts, _n: opts.lines ? "\n" : "" };
        this._extScope = extScope;
        this._scope = new scope_1.Scope({ parent: extScope });
        this._nodes = [new Root()];
      }
      toString() {
        return this._root.render(this.opts);
      }
      // returns unique name in the internal scope
      name(prefix) {
        return this._scope.name(prefix);
      }
      // reserves unique name in the external scope
      scopeName(prefix) {
        return this._extScope.name(prefix);
      }
      // reserves unique name in the external scope and assigns value to it
      scopeValue(prefixOrName, value) {
        const name = this._extScope.value(prefixOrName, value);
        const vs = this._values[name.prefix] || (this._values[name.prefix] = /* @__PURE__ */ new Set());
        vs.add(name);
        return name;
      }
      getScopeValue(prefix, keyOrRef) {
        return this._extScope.getValue(prefix, keyOrRef);
      }
      // return code that assigns values in the external scope to the names that are used internally
      // (same names that were returned by gen.scopeName or gen.scopeValue)
      scopeRefs(scopeName) {
        return this._extScope.scopeRefs(scopeName, this._values);
      }
      scopeCode() {
        return this._extScope.scopeCode(this._values);
      }
      _def(varKind, nameOrPrefix, rhs, constant) {
        const name = this._scope.toName(nameOrPrefix);
        if (rhs !== void 0 && constant)
          this._constants[name.str] = rhs;
        this._leafNode(new Def(varKind, name, rhs));
        return name;
      }
      // `const` declaration (`var` in es5 mode)
      const(nameOrPrefix, rhs, _constant) {
        return this._def(scope_1.varKinds.const, nameOrPrefix, rhs, _constant);
      }
      // `let` declaration with optional assignment (`var` in es5 mode)
      let(nameOrPrefix, rhs, _constant) {
        return this._def(scope_1.varKinds.let, nameOrPrefix, rhs, _constant);
      }
      // `var` declaration with optional assignment
      var(nameOrPrefix, rhs, _constant) {
        return this._def(scope_1.varKinds.var, nameOrPrefix, rhs, _constant);
      }
      // assignment code
      assign(lhs, rhs, sideEffects) {
        return this._leafNode(new Assign(lhs, rhs, sideEffects));
      }
      // `+=` code
      add(lhs, rhs) {
        return this._leafNode(new AssignOp(lhs, exports.operators.ADD, rhs));
      }
      // appends passed SafeExpr to code or executes Block
      code(c) {
        if (typeof c == "function")
          c();
        else if (c !== code_1.nil)
          this._leafNode(new AnyCode(c));
        return this;
      }
      // returns code for object literal for the passed argument list of key-value pairs
      object(...keyValues) {
        const code = ["{"];
        for (const [key, value] of keyValues) {
          if (code.length > 1)
            code.push(",");
          code.push(key);
          if (key !== value || this.opts.es5) {
            code.push(":");
            (0, code_1.addCodeArg)(code, value);
          }
        }
        code.push("}");
        return new code_1._Code(code);
      }
      // `if` clause (or statement if `thenBody` and, optionally, `elseBody` are passed)
      if(condition, thenBody, elseBody) {
        this._blockNode(new If(condition));
        if (thenBody && elseBody) {
          this.code(thenBody).else().code(elseBody).endIf();
        } else if (thenBody) {
          this.code(thenBody).endIf();
        } else if (elseBody) {
          throw new Error('CodeGen: "else" body without "then" body');
        }
        return this;
      }
      // `else if` clause - invalid without `if` or after `else` clauses
      elseIf(condition) {
        return this._elseNode(new If(condition));
      }
      // `else` clause - only valid after `if` or `else if` clauses
      else() {
        return this._elseNode(new Else());
      }
      // end `if` statement (needed if gen.if was used only with condition)
      endIf() {
        return this._endBlockNode(If, Else);
      }
      _for(node, forBody) {
        this._blockNode(node);
        if (forBody)
          this.code(forBody).endFor();
        return this;
      }
      // a generic `for` clause (or statement if `forBody` is passed)
      for(iteration, forBody) {
        return this._for(new ForLoop(iteration), forBody);
      }
      // `for` statement for a range of values
      forRange(nameOrPrefix, from, to, forBody, varKind = this.opts.es5 ? scope_1.varKinds.var : scope_1.varKinds.let) {
        const name = this._scope.toName(nameOrPrefix);
        return this._for(new ForRange(varKind, name, from, to), () => forBody(name));
      }
      // `for-of` statement (in es5 mode replace with a normal for loop)
      forOf(nameOrPrefix, iterable, forBody, varKind = scope_1.varKinds.const) {
        const name = this._scope.toName(nameOrPrefix);
        if (this.opts.es5) {
          const arr = iterable instanceof code_1.Name ? iterable : this.var("_arr", iterable);
          return this.forRange("_i", 0, (0, code_1._)`${arr}.length`, (i) => {
            this.var(name, (0, code_1._)`${arr}[${i}]`);
            forBody(name);
          });
        }
        return this._for(new ForIter("of", varKind, name, iterable), () => forBody(name));
      }
      // `for-in` statement.
      // With option `ownProperties` replaced with a `for-of` loop for object keys
      forIn(nameOrPrefix, obj, forBody, varKind = this.opts.es5 ? scope_1.varKinds.var : scope_1.varKinds.const) {
        if (this.opts.ownProperties) {
          return this.forOf(nameOrPrefix, (0, code_1._)`Object.keys(${obj})`, forBody);
        }
        const name = this._scope.toName(nameOrPrefix);
        return this._for(new ForIter("in", varKind, name, obj), () => forBody(name));
      }
      // end `for` loop
      endFor() {
        return this._endBlockNode(For);
      }
      // `label` statement
      label(label) {
        return this._leafNode(new Label(label));
      }
      // `break` statement
      break(label) {
        return this._leafNode(new Break(label));
      }
      // `return` statement
      return(value) {
        const node = new Return();
        this._blockNode(node);
        this.code(value);
        if (node.nodes.length !== 1)
          throw new Error('CodeGen: "return" should have one node');
        return this._endBlockNode(Return);
      }
      // `try` statement
      try(tryBody, catchCode, finallyCode) {
        if (!catchCode && !finallyCode)
          throw new Error('CodeGen: "try" without "catch" and "finally"');
        const node = new Try();
        this._blockNode(node);
        this.code(tryBody);
        if (catchCode) {
          const error = this.name("e");
          this._currNode = node.catch = new Catch(error);
          catchCode(error);
        }
        if (finallyCode) {
          this._currNode = node.finally = new Finally();
          this.code(finallyCode);
        }
        return this._endBlockNode(Catch, Finally);
      }
      // `throw` statement
      throw(error) {
        return this._leafNode(new Throw(error));
      }
      // start self-balancing block
      block(body, nodeCount) {
        this._blockStarts.push(this._nodes.length);
        if (body)
          this.code(body).endBlock(nodeCount);
        return this;
      }
      // end the current self-balancing block
      endBlock(nodeCount) {
        const len = this._blockStarts.pop();
        if (len === void 0)
          throw new Error("CodeGen: not in self-balancing block");
        const toClose = this._nodes.length - len;
        if (toClose < 0 || nodeCount !== void 0 && toClose !== nodeCount) {
          throw new Error(`CodeGen: wrong number of nodes: ${toClose} vs ${nodeCount} expected`);
        }
        this._nodes.length = len;
        return this;
      }
      // `function` heading (or definition if funcBody is passed)
      func(name, args = code_1.nil, async, funcBody) {
        this._blockNode(new Func(name, args, async));
        if (funcBody)
          this.code(funcBody).endFunc();
        return this;
      }
      // end function definition
      endFunc() {
        return this._endBlockNode(Func);
      }
      optimize(n = 1) {
        while (n-- > 0) {
          this._root.optimizeNodes();
          this._root.optimizeNames(this._root.names, this._constants);
        }
      }
      _leafNode(node) {
        this._currNode.nodes.push(node);
        return this;
      }
      _blockNode(node) {
        this._currNode.nodes.push(node);
        this._nodes.push(node);
      }
      _endBlockNode(N1, N2) {
        const n = this._currNode;
        if (n instanceof N1 || N2 && n instanceof N2) {
          this._nodes.pop();
          return this;
        }
        throw new Error(`CodeGen: not in block "${N2 ? `${N1.kind}/${N2.kind}` : N1.kind}"`);
      }
      _elseNode(node) {
        const n = this._currNode;
        if (!(n instanceof If)) {
          throw new Error('CodeGen: "else" without "if"');
        }
        this._currNode = n.else = node;
        return this;
      }
      get _root() {
        return this._nodes[0];
      }
      get _currNode() {
        const ns = this._nodes;
        return ns[ns.length - 1];
      }
      set _currNode(node) {
        const ns = this._nodes;
        ns[ns.length - 1] = node;
      }
    };
    exports.CodeGen = CodeGen;
    function addNames(names, from) {
      for (const n in from)
        names[n] = (names[n] || 0) + (from[n] || 0);
      return names;
    }
    function addExprNames(names, from) {
      return from instanceof code_1._CodeOrName ? addNames(names, from.names) : names;
    }
    function optimizeExpr(expr, names, constants) {
      if (expr instanceof code_1.Name)
        return replaceName(expr);
      if (!canOptimize(expr))
        return expr;
      return new code_1._Code(expr._items.reduce((items, c) => {
        if (c instanceof code_1.Name)
          c = replaceName(c);
        if (c instanceof code_1._Code)
          items.push(...c._items);
        else
          items.push(c);
        return items;
      }, []));
      function replaceName(n) {
        const c = constants[n.str];
        if (c === void 0 || names[n.str] !== 1)
          return n;
        delete names[n.str];
        return c;
      }
      function canOptimize(e) {
        return e instanceof code_1._Code && e._items.some((c) => c instanceof code_1.Name && names[c.str] === 1 && constants[c.str] !== void 0);
      }
    }
    function subtractNames(names, from) {
      for (const n in from)
        names[n] = (names[n] || 0) - (from[n] || 0);
    }
    function not(x) {
      return typeof x == "boolean" || typeof x == "number" || x === null ? !x : (0, code_1._)`!${par(x)}`;
    }
    exports.not = not;
    var andCode = mappend(exports.operators.AND);
    function and(...args) {
      return args.reduce(andCode);
    }
    exports.and = and;
    var orCode = mappend(exports.operators.OR);
    function or(...args) {
      return args.reduce(orCode);
    }
    exports.or = or;
    function mappend(op) {
      return (x, y) => x === code_1.nil ? y : y === code_1.nil ? x : (0, code_1._)`${par(x)} ${op} ${par(y)}`;
    }
    function par(x) {
      return x instanceof code_1.Name ? x : (0, code_1._)`(${x})`;
    }
  }
});

// node_modules/ajv/dist/compile/util.js
var require_util = __commonJS({
  "node_modules/ajv/dist/compile/util.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.checkStrictMode = exports.getErrorPath = exports.Type = exports.useFunc = exports.setEvaluated = exports.evaluatedPropsToName = exports.mergeEvaluated = exports.eachItem = exports.unescapeJsonPointer = exports.escapeJsonPointer = exports.escapeFragment = exports.unescapeFragment = exports.schemaRefOrVal = exports.schemaHasRulesButRef = exports.schemaHasRules = exports.checkUnknownRules = exports.alwaysValidSchema = exports.toHash = void 0;
    var codegen_1 = require_codegen();
    var code_1 = require_code();
    function toHash(arr) {
      const hash = {};
      for (const item of arr)
        hash[item] = true;
      return hash;
    }
    exports.toHash = toHash;
    function alwaysValidSchema(it, schema) {
      if (typeof schema == "boolean")
        return schema;
      if (Object.keys(schema).length === 0)
        return true;
      checkUnknownRules(it, schema);
      return !schemaHasRules(schema, it.self.RULES.all);
    }
    exports.alwaysValidSchema = alwaysValidSchema;
    function checkUnknownRules(it, schema = it.schema) {
      const { opts, self: self2 } = it;
      if (!opts.strictSchema)
        return;
      if (typeof schema === "boolean")
        return;
      const rules = self2.RULES.keywords;
      for (const key in schema) {
        if (!rules[key])
          checkStrictMode(it, `unknown keyword: "${key}"`);
      }
    }
    exports.checkUnknownRules = checkUnknownRules;
    function schemaHasRules(schema, rules) {
      if (typeof schema == "boolean")
        return !schema;
      for (const key in schema)
        if (rules[key])
          return true;
      return false;
    }
    exports.schemaHasRules = schemaHasRules;
    function schemaHasRulesButRef(schema, RULES) {
      if (typeof schema == "boolean")
        return !schema;
      for (const key in schema)
        if (key !== "$ref" && RULES.all[key])
          return true;
      return false;
    }
    exports.schemaHasRulesButRef = schemaHasRulesButRef;
    function schemaRefOrVal({ topSchemaRef, schemaPath }, schema, keyword, $data) {
      if (!$data) {
        if (typeof schema == "number" || typeof schema == "boolean")
          return schema;
        if (typeof schema == "string")
          return (0, codegen_1._)`${schema}`;
      }
      return (0, codegen_1._)`${topSchemaRef}${schemaPath}${(0, codegen_1.getProperty)(keyword)}`;
    }
    exports.schemaRefOrVal = schemaRefOrVal;
    function unescapeFragment(str) {
      return unescapeJsonPointer(decodeURIComponent(str));
    }
    exports.unescapeFragment = unescapeFragment;
    function escapeFragment(str) {
      return encodeURIComponent(escapeJsonPointer(str));
    }
    exports.escapeFragment = escapeFragment;
    function escapeJsonPointer(str) {
      if (typeof str == "number")
        return `${str}`;
      return str.replace(/~/g, "~0").replace(/\//g, "~1");
    }
    exports.escapeJsonPointer = escapeJsonPointer;
    function unescapeJsonPointer(str) {
      return str.replace(/~1/g, "/").replace(/~0/g, "~");
    }
    exports.unescapeJsonPointer = unescapeJsonPointer;
    function eachItem(xs, f) {
      if (Array.isArray(xs)) {
        for (const x of xs)
          f(x);
      } else {
        f(xs);
      }
    }
    exports.eachItem = eachItem;
    function makeMergeEvaluated({ mergeNames, mergeToName, mergeValues, resultToName }) {
      return (gen, from, to, toName) => {
        const res = to === void 0 ? from : to instanceof codegen_1.Name ? (from instanceof codegen_1.Name ? mergeNames(gen, from, to) : mergeToName(gen, from, to), to) : from instanceof codegen_1.Name ? (mergeToName(gen, to, from), from) : mergeValues(from, to);
        return toName === codegen_1.Name && !(res instanceof codegen_1.Name) ? resultToName(gen, res) : res;
      };
    }
    exports.mergeEvaluated = {
      props: makeMergeEvaluated({
        mergeNames: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true && ${from} !== undefined`, () => {
          gen.if((0, codegen_1._)`${from} === true`, () => gen.assign(to, true), () => gen.assign(to, (0, codegen_1._)`${to} || {}`).code((0, codegen_1._)`Object.assign(${to}, ${from})`));
        }),
        mergeToName: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true`, () => {
          if (from === true) {
            gen.assign(to, true);
          } else {
            gen.assign(to, (0, codegen_1._)`${to} || {}`);
            setEvaluated(gen, to, from);
          }
        }),
        mergeValues: (from, to) => from === true ? true : { ...from, ...to },
        resultToName: evaluatedPropsToName
      }),
      items: makeMergeEvaluated({
        mergeNames: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true && ${from} !== undefined`, () => gen.assign(to, (0, codegen_1._)`${from} === true ? true : ${to} > ${from} ? ${to} : ${from}`)),
        mergeToName: (gen, from, to) => gen.if((0, codegen_1._)`${to} !== true`, () => gen.assign(to, from === true ? true : (0, codegen_1._)`${to} > ${from} ? ${to} : ${from}`)),
        mergeValues: (from, to) => from === true ? true : Math.max(from, to),
        resultToName: (gen, items) => gen.var("items", items)
      })
    };
    function evaluatedPropsToName(gen, ps) {
      if (ps === true)
        return gen.var("props", true);
      const props = gen.var("props", (0, codegen_1._)`{}`);
      if (ps !== void 0)
        setEvaluated(gen, props, ps);
      return props;
    }
    exports.evaluatedPropsToName = evaluatedPropsToName;
    function setEvaluated(gen, props, ps) {
      Object.keys(ps).forEach((p) => gen.assign((0, codegen_1._)`${props}${(0, codegen_1.getProperty)(p)}`, true));
    }
    exports.setEvaluated = setEvaluated;
    var snippets = {};
    function useFunc(gen, f) {
      return gen.scopeValue("func", {
        ref: f,
        code: snippets[f.code] || (snippets[f.code] = new code_1._Code(f.code))
      });
    }
    exports.useFunc = useFunc;
    var Type;
    (function(Type2) {
      Type2[Type2["Num"] = 0] = "Num";
      Type2[Type2["Str"] = 1] = "Str";
    })(Type || (exports.Type = Type = {}));
    function getErrorPath(dataProp, dataPropType, jsPropertySyntax) {
      if (dataProp instanceof codegen_1.Name) {
        const isNumber2 = dataPropType === Type.Num;
        return jsPropertySyntax ? isNumber2 ? (0, codegen_1._)`"[" + ${dataProp} + "]"` : (0, codegen_1._)`"['" + ${dataProp} + "']"` : isNumber2 ? (0, codegen_1._)`"/" + ${dataProp}` : (0, codegen_1._)`"/" + ${dataProp}.replace(/~/g, "~0").replace(/\\//g, "~1")`;
      }
      return jsPropertySyntax ? (0, codegen_1.getProperty)(dataProp).toString() : "/" + escapeJsonPointer(dataProp);
    }
    exports.getErrorPath = getErrorPath;
    function checkStrictMode(it, msg, mode = it.opts.strictSchema) {
      if (!mode)
        return;
      msg = `strict mode: ${msg}`;
      if (mode === true)
        throw new Error(msg);
      it.self.logger.warn(msg);
    }
    exports.checkStrictMode = checkStrictMode;
  }
});

// node_modules/ajv/dist/compile/names.js
var require_names = __commonJS({
  "node_modules/ajv/dist/compile/names.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var names = {
      // validation function arguments
      data: new codegen_1.Name("data"),
      // data passed to validation function
      // args passed from referencing schema
      valCxt: new codegen_1.Name("valCxt"),
      // validation/data context - should not be used directly, it is destructured to the names below
      instancePath: new codegen_1.Name("instancePath"),
      parentData: new codegen_1.Name("parentData"),
      parentDataProperty: new codegen_1.Name("parentDataProperty"),
      rootData: new codegen_1.Name("rootData"),
      // root data - same as the data passed to the first/top validation function
      dynamicAnchors: new codegen_1.Name("dynamicAnchors"),
      // used to support recursiveRef and dynamicRef
      // function scoped variables
      vErrors: new codegen_1.Name("vErrors"),
      // null or array of validation errors
      errors: new codegen_1.Name("errors"),
      // counter of validation errors
      this: new codegen_1.Name("this"),
      // "globals"
      self: new codegen_1.Name("self"),
      scope: new codegen_1.Name("scope"),
      // JTD serialize/parse name for JSON string and position
      json: new codegen_1.Name("json"),
      jsonPos: new codegen_1.Name("jsonPos"),
      jsonLen: new codegen_1.Name("jsonLen"),
      jsonPart: new codegen_1.Name("jsonPart")
    };
    exports.default = names;
  }
});

// node_modules/ajv/dist/compile/errors.js
var require_errors = __commonJS({
  "node_modules/ajv/dist/compile/errors.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.extendErrors = exports.resetErrorsCount = exports.reportExtraError = exports.reportError = exports.keyword$DataError = exports.keywordError = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var names_1 = require_names();
    exports.keywordError = {
      message: ({ keyword }) => (0, codegen_1.str)`must pass "${keyword}" keyword validation`
    };
    exports.keyword$DataError = {
      message: ({ keyword, schemaType }) => schemaType ? (0, codegen_1.str)`"${keyword}" keyword must be ${schemaType} ($data)` : (0, codegen_1.str)`"${keyword}" keyword is invalid ($data)`
    };
    function reportError(cxt, error = exports.keywordError, errorPaths, overrideAllErrors) {
      const { it } = cxt;
      const { gen, compositeRule, allErrors } = it;
      const errObj = errorObjectCode(cxt, error, errorPaths);
      if (overrideAllErrors !== null && overrideAllErrors !== void 0 ? overrideAllErrors : compositeRule || allErrors) {
        addError(gen, errObj);
      } else {
        returnErrors(it, (0, codegen_1._)`[${errObj}]`);
      }
    }
    exports.reportError = reportError;
    function reportExtraError(cxt, error = exports.keywordError, errorPaths) {
      const { it } = cxt;
      const { gen, compositeRule, allErrors } = it;
      const errObj = errorObjectCode(cxt, error, errorPaths);
      addError(gen, errObj);
      if (!(compositeRule || allErrors)) {
        returnErrors(it, names_1.default.vErrors);
      }
    }
    exports.reportExtraError = reportExtraError;
    function resetErrorsCount(gen, errsCount) {
      gen.assign(names_1.default.errors, errsCount);
      gen.if((0, codegen_1._)`${names_1.default.vErrors} !== null`, () => gen.if(errsCount, () => gen.assign((0, codegen_1._)`${names_1.default.vErrors}.length`, errsCount), () => gen.assign(names_1.default.vErrors, null)));
    }
    exports.resetErrorsCount = resetErrorsCount;
    function extendErrors({ gen, keyword, schemaValue, data, errsCount, it }) {
      if (errsCount === void 0)
        throw new Error("ajv implementation error");
      const err = gen.name("err");
      gen.forRange("i", errsCount, names_1.default.errors, (i) => {
        gen.const(err, (0, codegen_1._)`${names_1.default.vErrors}[${i}]`);
        gen.if((0, codegen_1._)`${err}.instancePath === undefined`, () => gen.assign((0, codegen_1._)`${err}.instancePath`, (0, codegen_1.strConcat)(names_1.default.instancePath, it.errorPath)));
        gen.assign((0, codegen_1._)`${err}.schemaPath`, (0, codegen_1.str)`${it.errSchemaPath}/${keyword}`);
        if (it.opts.verbose) {
          gen.assign((0, codegen_1._)`${err}.schema`, schemaValue);
          gen.assign((0, codegen_1._)`${err}.data`, data);
        }
      });
    }
    exports.extendErrors = extendErrors;
    function addError(gen, errObj) {
      const err = gen.const("err", errObj);
      gen.if((0, codegen_1._)`${names_1.default.vErrors} === null`, () => gen.assign(names_1.default.vErrors, (0, codegen_1._)`[${err}]`), (0, codegen_1._)`${names_1.default.vErrors}.push(${err})`);
      gen.code((0, codegen_1._)`${names_1.default.errors}++`);
    }
    function returnErrors(it, errs) {
      const { gen, validateName, schemaEnv } = it;
      if (schemaEnv.$async) {
        gen.throw((0, codegen_1._)`new ${it.ValidationError}(${errs})`);
      } else {
        gen.assign((0, codegen_1._)`${validateName}.errors`, errs);
        gen.return(false);
      }
    }
    var E = {
      keyword: new codegen_1.Name("keyword"),
      schemaPath: new codegen_1.Name("schemaPath"),
      // also used in JTD errors
      params: new codegen_1.Name("params"),
      propertyName: new codegen_1.Name("propertyName"),
      message: new codegen_1.Name("message"),
      schema: new codegen_1.Name("schema"),
      parentSchema: new codegen_1.Name("parentSchema")
    };
    function errorObjectCode(cxt, error, errorPaths) {
      const { createErrors } = cxt.it;
      if (createErrors === false)
        return (0, codegen_1._)`{}`;
      return errorObject(cxt, error, errorPaths);
    }
    function errorObject(cxt, error, errorPaths = {}) {
      const { gen, it } = cxt;
      const keyValues = [
        errorInstancePath(it, errorPaths),
        errorSchemaPath(cxt, errorPaths)
      ];
      extraErrorProps(cxt, error, keyValues);
      return gen.object(...keyValues);
    }
    function errorInstancePath({ errorPath }, { instancePath }) {
      const instPath = instancePath ? (0, codegen_1.str)`${errorPath}${(0, util_1.getErrorPath)(instancePath, util_1.Type.Str)}` : errorPath;
      return [names_1.default.instancePath, (0, codegen_1.strConcat)(names_1.default.instancePath, instPath)];
    }
    function errorSchemaPath({ keyword, it: { errSchemaPath } }, { schemaPath, parentSchema }) {
      let schPath = parentSchema ? errSchemaPath : (0, codegen_1.str)`${errSchemaPath}/${keyword}`;
      if (schemaPath) {
        schPath = (0, codegen_1.str)`${schPath}${(0, util_1.getErrorPath)(schemaPath, util_1.Type.Str)}`;
      }
      return [E.schemaPath, schPath];
    }
    function extraErrorProps(cxt, { params, message }, keyValues) {
      const { keyword, data, schemaValue, it } = cxt;
      const { opts, propertyName, topSchemaRef, schemaPath } = it;
      keyValues.push([E.keyword, keyword], [E.params, typeof params == "function" ? params(cxt) : params || (0, codegen_1._)`{}`]);
      if (opts.messages) {
        keyValues.push([E.message, typeof message == "function" ? message(cxt) : message]);
      }
      if (opts.verbose) {
        keyValues.push([E.schema, schemaValue], [E.parentSchema, (0, codegen_1._)`${topSchemaRef}${schemaPath}`], [names_1.default.data, data]);
      }
      if (propertyName)
        keyValues.push([E.propertyName, propertyName]);
    }
  }
});

// node_modules/ajv/dist/compile/validate/boolSchema.js
var require_boolSchema = __commonJS({
  "node_modules/ajv/dist/compile/validate/boolSchema.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.boolOrEmptySchema = exports.topBoolOrEmptySchema = void 0;
    var errors_1 = require_errors();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var boolError = {
      message: "boolean schema is false"
    };
    function topBoolOrEmptySchema(it) {
      const { gen, schema, validateName } = it;
      if (schema === false) {
        falseSchemaError(it, false);
      } else if (typeof schema == "object" && schema.$async === true) {
        gen.return(names_1.default.data);
      } else {
        gen.assign((0, codegen_1._)`${validateName}.errors`, null);
        gen.return(true);
      }
    }
    exports.topBoolOrEmptySchema = topBoolOrEmptySchema;
    function boolOrEmptySchema(it, valid) {
      const { gen, schema } = it;
      if (schema === false) {
        gen.var(valid, false);
        falseSchemaError(it);
      } else {
        gen.var(valid, true);
      }
    }
    exports.boolOrEmptySchema = boolOrEmptySchema;
    function falseSchemaError(it, overrideAllErrors) {
      const { gen, data } = it;
      const cxt = {
        gen,
        keyword: "false schema",
        data,
        schema: false,
        schemaCode: false,
        schemaValue: false,
        params: {},
        it
      };
      (0, errors_1.reportError)(cxt, boolError, void 0, overrideAllErrors);
    }
  }
});

// node_modules/ajv/dist/compile/rules.js
var require_rules = __commonJS({
  "node_modules/ajv/dist/compile/rules.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getRules = exports.isJSONType = void 0;
    var _jsonTypes = ["string", "number", "integer", "boolean", "null", "object", "array"];
    var jsonTypes = new Set(_jsonTypes);
    function isJSONType(x) {
      return typeof x == "string" && jsonTypes.has(x);
    }
    exports.isJSONType = isJSONType;
    function getRules() {
      const groups = {
        number: { type: "number", rules: [] },
        string: { type: "string", rules: [] },
        array: { type: "array", rules: [] },
        object: { type: "object", rules: [] }
      };
      return {
        types: { ...groups, integer: true, boolean: true, null: true },
        rules: [{ rules: [] }, groups.number, groups.string, groups.array, groups.object],
        post: { rules: [] },
        all: {},
        keywords: {}
      };
    }
    exports.getRules = getRules;
  }
});

// node_modules/ajv/dist/compile/validate/applicability.js
var require_applicability = __commonJS({
  "node_modules/ajv/dist/compile/validate/applicability.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.shouldUseRule = exports.shouldUseGroup = exports.schemaHasRulesForType = void 0;
    function schemaHasRulesForType({ schema, self: self2 }, type) {
      const group = self2.RULES.types[type];
      return group && group !== true && shouldUseGroup(schema, group);
    }
    exports.schemaHasRulesForType = schemaHasRulesForType;
    function shouldUseGroup(schema, group) {
      return group.rules.some((rule) => shouldUseRule(schema, rule));
    }
    exports.shouldUseGroup = shouldUseGroup;
    function shouldUseRule(schema, rule) {
      var _a;
      return schema[rule.keyword] !== void 0 || ((_a = rule.definition.implements) === null || _a === void 0 ? void 0 : _a.some((kwd) => schema[kwd] !== void 0));
    }
    exports.shouldUseRule = shouldUseRule;
  }
});

// node_modules/ajv/dist/compile/validate/dataType.js
var require_dataType = __commonJS({
  "node_modules/ajv/dist/compile/validate/dataType.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.reportTypeError = exports.checkDataTypes = exports.checkDataType = exports.coerceAndCheckDataType = exports.getJSONTypes = exports.getSchemaTypes = exports.DataType = void 0;
    var rules_1 = require_rules();
    var applicability_1 = require_applicability();
    var errors_1 = require_errors();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var DataType;
    (function(DataType2) {
      DataType2[DataType2["Correct"] = 0] = "Correct";
      DataType2[DataType2["Wrong"] = 1] = "Wrong";
    })(DataType || (exports.DataType = DataType = {}));
    function getSchemaTypes(schema) {
      const types = getJSONTypes(schema.type);
      const hasNull = types.includes("null");
      if (hasNull) {
        if (schema.nullable === false)
          throw new Error("type: null contradicts nullable: false");
      } else {
        if (!types.length && schema.nullable !== void 0) {
          throw new Error('"nullable" cannot be used without "type"');
        }
        if (schema.nullable === true)
          types.push("null");
      }
      return types;
    }
    exports.getSchemaTypes = getSchemaTypes;
    function getJSONTypes(ts) {
      const types = Array.isArray(ts) ? ts : ts ? [ts] : [];
      if (types.every(rules_1.isJSONType))
        return types;
      throw new Error("type must be JSONType or JSONType[]: " + types.join(","));
    }
    exports.getJSONTypes = getJSONTypes;
    function coerceAndCheckDataType(it, types) {
      const { gen, data, opts } = it;
      const coerceTo = coerceToTypes(types, opts.coerceTypes);
      const checkTypes = types.length > 0 && !(coerceTo.length === 0 && types.length === 1 && (0, applicability_1.schemaHasRulesForType)(it, types[0]));
      if (checkTypes) {
        const wrongType = checkDataTypes(types, data, opts.strictNumbers, DataType.Wrong);
        gen.if(wrongType, () => {
          if (coerceTo.length)
            coerceData(it, types, coerceTo);
          else
            reportTypeError(it);
        });
      }
      return checkTypes;
    }
    exports.coerceAndCheckDataType = coerceAndCheckDataType;
    var COERCIBLE = /* @__PURE__ */ new Set(["string", "number", "integer", "boolean", "null"]);
    function coerceToTypes(types, coerceTypes) {
      return coerceTypes ? types.filter((t) => COERCIBLE.has(t) || coerceTypes === "array" && t === "array") : [];
    }
    function coerceData(it, types, coerceTo) {
      const { gen, data, opts } = it;
      const dataType = gen.let("dataType", (0, codegen_1._)`typeof ${data}`);
      const coerced = gen.let("coerced", (0, codegen_1._)`undefined`);
      if (opts.coerceTypes === "array") {
        gen.if((0, codegen_1._)`${dataType} == 'object' && Array.isArray(${data}) && ${data}.length == 1`, () => gen.assign(data, (0, codegen_1._)`${data}[0]`).assign(dataType, (0, codegen_1._)`typeof ${data}`).if(checkDataTypes(types, data, opts.strictNumbers), () => gen.assign(coerced, data)));
      }
      gen.if((0, codegen_1._)`${coerced} !== undefined`);
      for (const t of coerceTo) {
        if (COERCIBLE.has(t) || t === "array" && opts.coerceTypes === "array") {
          coerceSpecificType(t);
        }
      }
      gen.else();
      reportTypeError(it);
      gen.endIf();
      gen.if((0, codegen_1._)`${coerced} !== undefined`, () => {
        gen.assign(data, coerced);
        assignParentData(it, coerced);
      });
      function coerceSpecificType(t) {
        switch (t) {
          case "string":
            gen.elseIf((0, codegen_1._)`${dataType} == "number" || ${dataType} == "boolean"`).assign(coerced, (0, codegen_1._)`"" + ${data}`).elseIf((0, codegen_1._)`${data} === null`).assign(coerced, (0, codegen_1._)`""`);
            return;
          case "number":
            gen.elseIf((0, codegen_1._)`${dataType} == "boolean" || ${data} === null
              || (${dataType} == "string" && ${data} && ${data} == +${data})`).assign(coerced, (0, codegen_1._)`+${data}`);
            return;
          case "integer":
            gen.elseIf((0, codegen_1._)`${dataType} === "boolean" || ${data} === null
              || (${dataType} === "string" && ${data} && ${data} == +${data} && !(${data} % 1))`).assign(coerced, (0, codegen_1._)`+${data}`);
            return;
          case "boolean":
            gen.elseIf((0, codegen_1._)`${data} === "false" || ${data} === 0 || ${data} === null`).assign(coerced, false).elseIf((0, codegen_1._)`${data} === "true" || ${data} === 1`).assign(coerced, true);
            return;
          case "null":
            gen.elseIf((0, codegen_1._)`${data} === "" || ${data} === 0 || ${data} === false`);
            gen.assign(coerced, null);
            return;
          case "array":
            gen.elseIf((0, codegen_1._)`${dataType} === "string" || ${dataType} === "number"
              || ${dataType} === "boolean" || ${data} === null`).assign(coerced, (0, codegen_1._)`[${data}]`);
        }
      }
    }
    function assignParentData({ gen, parentData, parentDataProperty }, expr) {
      gen.if((0, codegen_1._)`${parentData} !== undefined`, () => gen.assign((0, codegen_1._)`${parentData}[${parentDataProperty}]`, expr));
    }
    function checkDataType(dataType, data, strictNums, correct = DataType.Correct) {
      const EQ = correct === DataType.Correct ? codegen_1.operators.EQ : codegen_1.operators.NEQ;
      let cond;
      switch (dataType) {
        case "null":
          return (0, codegen_1._)`${data} ${EQ} null`;
        case "array":
          cond = (0, codegen_1._)`Array.isArray(${data})`;
          break;
        case "object":
          cond = (0, codegen_1._)`${data} && typeof ${data} == "object" && !Array.isArray(${data})`;
          break;
        case "integer":
          cond = numCond((0, codegen_1._)`!(${data} % 1) && !isNaN(${data})`);
          break;
        case "number":
          cond = numCond();
          break;
        default:
          return (0, codegen_1._)`typeof ${data} ${EQ} ${dataType}`;
      }
      return correct === DataType.Correct ? cond : (0, codegen_1.not)(cond);
      function numCond(_cond = codegen_1.nil) {
        return (0, codegen_1.and)((0, codegen_1._)`typeof ${data} == "number"`, _cond, strictNums ? (0, codegen_1._)`isFinite(${data})` : codegen_1.nil);
      }
    }
    exports.checkDataType = checkDataType;
    function checkDataTypes(dataTypes, data, strictNums, correct) {
      if (dataTypes.length === 1) {
        return checkDataType(dataTypes[0], data, strictNums, correct);
      }
      let cond;
      const types = (0, util_1.toHash)(dataTypes);
      if (types.array && types.object) {
        const notObj = (0, codegen_1._)`typeof ${data} != "object"`;
        cond = types.null ? notObj : (0, codegen_1._)`!${data} || ${notObj}`;
        delete types.null;
        delete types.array;
        delete types.object;
      } else {
        cond = codegen_1.nil;
      }
      if (types.number)
        delete types.integer;
      for (const t in types)
        cond = (0, codegen_1.and)(cond, checkDataType(t, data, strictNums, correct));
      return cond;
    }
    exports.checkDataTypes = checkDataTypes;
    var typeError = {
      message: ({ schema }) => `must be ${schema}`,
      params: ({ schema, schemaValue }) => typeof schema == "string" ? (0, codegen_1._)`{type: ${schema}}` : (0, codegen_1._)`{type: ${schemaValue}}`
    };
    function reportTypeError(it) {
      const cxt = getTypeErrorContext(it);
      (0, errors_1.reportError)(cxt, typeError);
    }
    exports.reportTypeError = reportTypeError;
    function getTypeErrorContext(it) {
      const { gen, data, schema } = it;
      const schemaCode = (0, util_1.schemaRefOrVal)(it, schema, "type");
      return {
        gen,
        keyword: "type",
        data,
        schema: schema.type,
        schemaCode,
        schemaValue: schemaCode,
        parentSchema: schema,
        params: {},
        it
      };
    }
  }
});

// node_modules/ajv/dist/compile/validate/defaults.js
var require_defaults = __commonJS({
  "node_modules/ajv/dist/compile/validate/defaults.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.assignDefaults = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    function assignDefaults(it, ty) {
      const { properties, items } = it.schema;
      if (ty === "object" && properties) {
        for (const key in properties) {
          assignDefault(it, key, properties[key].default);
        }
      } else if (ty === "array" && Array.isArray(items)) {
        items.forEach((sch, i) => assignDefault(it, i, sch.default));
      }
    }
    exports.assignDefaults = assignDefaults;
    function assignDefault(it, prop, defaultValue) {
      const { gen, compositeRule, data, opts } = it;
      if (defaultValue === void 0)
        return;
      const childData = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(prop)}`;
      if (compositeRule) {
        (0, util_1.checkStrictMode)(it, `default is ignored for: ${childData}`);
        return;
      }
      let condition = (0, codegen_1._)`${childData} === undefined`;
      if (opts.useDefaults === "empty") {
        condition = (0, codegen_1._)`${condition} || ${childData} === null || ${childData} === ""`;
      }
      gen.if(condition, (0, codegen_1._)`${childData} = ${(0, codegen_1.stringify)(defaultValue)}`);
    }
  }
});

// node_modules/ajv/dist/vocabularies/code.js
var require_code2 = __commonJS({
  "node_modules/ajv/dist/vocabularies/code.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateUnion = exports.validateArray = exports.usePattern = exports.callValidateCode = exports.schemaProperties = exports.allSchemaProperties = exports.noPropertyInData = exports.propertyInData = exports.isOwnProperty = exports.hasPropFunc = exports.reportMissingProp = exports.checkMissingProp = exports.checkReportMissingProp = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var names_1 = require_names();
    var util_2 = require_util();
    function checkReportMissingProp(cxt, prop) {
      const { gen, data, it } = cxt;
      gen.if(noPropertyInData(gen, data, prop, it.opts.ownProperties), () => {
        cxt.setParams({ missingProperty: (0, codegen_1._)`${prop}` }, true);
        cxt.error();
      });
    }
    exports.checkReportMissingProp = checkReportMissingProp;
    function checkMissingProp({ gen, data, it: { opts } }, properties, missing) {
      return (0, codegen_1.or)(...properties.map((prop) => (0, codegen_1.and)(noPropertyInData(gen, data, prop, opts.ownProperties), (0, codegen_1._)`${missing} = ${prop}`)));
    }
    exports.checkMissingProp = checkMissingProp;
    function reportMissingProp(cxt, missing) {
      cxt.setParams({ missingProperty: missing }, true);
      cxt.error();
    }
    exports.reportMissingProp = reportMissingProp;
    function hasPropFunc(gen) {
      return gen.scopeValue("func", {
        // eslint-disable-next-line @typescript-eslint/unbound-method
        ref: Object.prototype.hasOwnProperty,
        code: (0, codegen_1._)`Object.prototype.hasOwnProperty`
      });
    }
    exports.hasPropFunc = hasPropFunc;
    function isOwnProperty(gen, data, property) {
      return (0, codegen_1._)`${hasPropFunc(gen)}.call(${data}, ${property})`;
    }
    exports.isOwnProperty = isOwnProperty;
    function propertyInData(gen, data, property, ownProperties) {
      const cond = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(property)} !== undefined`;
      return ownProperties ? (0, codegen_1._)`${cond} && ${isOwnProperty(gen, data, property)}` : cond;
    }
    exports.propertyInData = propertyInData;
    function noPropertyInData(gen, data, property, ownProperties) {
      const cond = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(property)} === undefined`;
      return ownProperties ? (0, codegen_1.or)(cond, (0, codegen_1.not)(isOwnProperty(gen, data, property))) : cond;
    }
    exports.noPropertyInData = noPropertyInData;
    function allSchemaProperties(schemaMap) {
      return schemaMap ? Object.keys(schemaMap).filter((p) => p !== "__proto__") : [];
    }
    exports.allSchemaProperties = allSchemaProperties;
    function schemaProperties(it, schemaMap) {
      return allSchemaProperties(schemaMap).filter((p) => !(0, util_1.alwaysValidSchema)(it, schemaMap[p]));
    }
    exports.schemaProperties = schemaProperties;
    function callValidateCode({ schemaCode, data, it: { gen, topSchemaRef, schemaPath, errorPath }, it }, func, context, passSchema) {
      const dataAndSchema = passSchema ? (0, codegen_1._)`${schemaCode}, ${data}, ${topSchemaRef}${schemaPath}` : data;
      const valCxt = [
        [names_1.default.instancePath, (0, codegen_1.strConcat)(names_1.default.instancePath, errorPath)],
        [names_1.default.parentData, it.parentData],
        [names_1.default.parentDataProperty, it.parentDataProperty],
        [names_1.default.rootData, names_1.default.rootData]
      ];
      if (it.opts.dynamicRef)
        valCxt.push([names_1.default.dynamicAnchors, names_1.default.dynamicAnchors]);
      const args = (0, codegen_1._)`${dataAndSchema}, ${gen.object(...valCxt)}`;
      return context !== codegen_1.nil ? (0, codegen_1._)`${func}.call(${context}, ${args})` : (0, codegen_1._)`${func}(${args})`;
    }
    exports.callValidateCode = callValidateCode;
    var newRegExp = (0, codegen_1._)`new RegExp`;
    function usePattern({ gen, it: { opts } }, pattern) {
      const u4 = opts.unicodeRegExp ? "u" : "";
      const { regExp } = opts.code;
      const rx = regExp(pattern, u4);
      return gen.scopeValue("pattern", {
        key: rx.toString(),
        ref: rx,
        code: (0, codegen_1._)`${regExp.code === "new RegExp" ? newRegExp : (0, util_2.useFunc)(gen, regExp)}(${pattern}, ${u4})`
      });
    }
    exports.usePattern = usePattern;
    function validateArray(cxt) {
      const { gen, data, keyword, it } = cxt;
      const valid = gen.name("valid");
      if (it.allErrors) {
        const validArr = gen.let("valid", true);
        validateItems(() => gen.assign(validArr, false));
        return validArr;
      }
      gen.var(valid, true);
      validateItems(() => gen.break());
      return valid;
      function validateItems(notValid) {
        const len = gen.const("len", (0, codegen_1._)`${data}.length`);
        gen.forRange("i", 0, len, (i) => {
          cxt.subschema({
            keyword,
            dataProp: i,
            dataPropType: util_1.Type.Num
          }, valid);
          gen.if((0, codegen_1.not)(valid), notValid);
        });
      }
    }
    exports.validateArray = validateArray;
    function validateUnion(cxt) {
      const { gen, schema, keyword, it } = cxt;
      if (!Array.isArray(schema))
        throw new Error("ajv implementation error");
      const alwaysValid = schema.some((sch) => (0, util_1.alwaysValidSchema)(it, sch));
      if (alwaysValid && !it.opts.unevaluated)
        return;
      const valid = gen.let("valid", false);
      const schValid = gen.name("_valid");
      gen.block(() => schema.forEach((_sch, i) => {
        const schCxt = cxt.subschema({
          keyword,
          schemaProp: i,
          compositeRule: true
        }, schValid);
        gen.assign(valid, (0, codegen_1._)`${valid} || ${schValid}`);
        const merged = cxt.mergeValidEvaluated(schCxt, schValid);
        if (!merged)
          gen.if((0, codegen_1.not)(valid));
      }));
      cxt.result(valid, () => cxt.reset(), () => cxt.error(true));
    }
    exports.validateUnion = validateUnion;
  }
});

// node_modules/ajv/dist/compile/validate/keyword.js
var require_keyword = __commonJS({
  "node_modules/ajv/dist/compile/validate/keyword.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateKeywordUsage = exports.validSchemaType = exports.funcKeywordCode = exports.macroKeywordCode = void 0;
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var code_1 = require_code2();
    var errors_1 = require_errors();
    function macroKeywordCode(cxt, def) {
      const { gen, keyword, schema, parentSchema, it } = cxt;
      const macroSchema = def.macro.call(it.self, schema, parentSchema, it);
      const schemaRef = useKeyword(gen, keyword, macroSchema);
      if (it.opts.validateSchema !== false)
        it.self.validateSchema(macroSchema, true);
      const valid = gen.name("valid");
      cxt.subschema({
        schema: macroSchema,
        schemaPath: codegen_1.nil,
        errSchemaPath: `${it.errSchemaPath}/${keyword}`,
        topSchemaRef: schemaRef,
        compositeRule: true
      }, valid);
      cxt.pass(valid, () => cxt.error(true));
    }
    exports.macroKeywordCode = macroKeywordCode;
    function funcKeywordCode(cxt, def) {
      var _a;
      const { gen, keyword, schema, parentSchema, $data, it } = cxt;
      checkAsyncKeyword(it, def);
      const validate = !$data && def.compile ? def.compile.call(it.self, schema, parentSchema, it) : def.validate;
      const validateRef = useKeyword(gen, keyword, validate);
      const valid = gen.let("valid");
      cxt.block$data(valid, validateKeyword);
      cxt.ok((_a = def.valid) !== null && _a !== void 0 ? _a : valid);
      function validateKeyword() {
        if (def.errors === false) {
          assignValid();
          if (def.modifying)
            modifyData(cxt);
          reportErrs(() => cxt.error());
        } else {
          const ruleErrs = def.async ? validateAsync() : validateSync();
          if (def.modifying)
            modifyData(cxt);
          reportErrs(() => addErrs(cxt, ruleErrs));
        }
      }
      function validateAsync() {
        const ruleErrs = gen.let("ruleErrs", null);
        gen.try(() => assignValid((0, codegen_1._)`await `), (e) => gen.assign(valid, false).if((0, codegen_1._)`${e} instanceof ${it.ValidationError}`, () => gen.assign(ruleErrs, (0, codegen_1._)`${e}.errors`), () => gen.throw(e)));
        return ruleErrs;
      }
      function validateSync() {
        const validateErrs = (0, codegen_1._)`${validateRef}.errors`;
        gen.assign(validateErrs, null);
        assignValid(codegen_1.nil);
        return validateErrs;
      }
      function assignValid(_await = def.async ? (0, codegen_1._)`await ` : codegen_1.nil) {
        const passCxt = it.opts.passContext ? names_1.default.this : names_1.default.self;
        const passSchema = !("compile" in def && !$data || def.schema === false);
        gen.assign(valid, (0, codegen_1._)`${_await}${(0, code_1.callValidateCode)(cxt, validateRef, passCxt, passSchema)}`, def.modifying);
      }
      function reportErrs(errors) {
        var _a2;
        gen.if((0, codegen_1.not)((_a2 = def.valid) !== null && _a2 !== void 0 ? _a2 : valid), errors);
      }
    }
    exports.funcKeywordCode = funcKeywordCode;
    function modifyData(cxt) {
      const { gen, data, it } = cxt;
      gen.if(it.parentData, () => gen.assign(data, (0, codegen_1._)`${it.parentData}[${it.parentDataProperty}]`));
    }
    function addErrs(cxt, errs) {
      const { gen } = cxt;
      gen.if((0, codegen_1._)`Array.isArray(${errs})`, () => {
        gen.assign(names_1.default.vErrors, (0, codegen_1._)`${names_1.default.vErrors} === null ? ${errs} : ${names_1.default.vErrors}.concat(${errs})`).assign(names_1.default.errors, (0, codegen_1._)`${names_1.default.vErrors}.length`);
        (0, errors_1.extendErrors)(cxt);
      }, () => cxt.error());
    }
    function checkAsyncKeyword({ schemaEnv }, def) {
      if (def.async && !schemaEnv.$async)
        throw new Error("async keyword in sync schema");
    }
    function useKeyword(gen, keyword, result) {
      if (result === void 0)
        throw new Error(`keyword "${keyword}" failed to compile`);
      return gen.scopeValue("keyword", typeof result == "function" ? { ref: result } : { ref: result, code: (0, codegen_1.stringify)(result) });
    }
    function validSchemaType(schema, schemaType, allowUndefined = false) {
      return !schemaType.length || schemaType.some((st) => st === "array" ? Array.isArray(schema) : st === "object" ? schema && typeof schema == "object" && !Array.isArray(schema) : typeof schema == st || allowUndefined && typeof schema == "undefined");
    }
    exports.validSchemaType = validSchemaType;
    function validateKeywordUsage({ schema, opts, self: self2, errSchemaPath }, def, keyword) {
      if (Array.isArray(def.keyword) ? !def.keyword.includes(keyword) : def.keyword !== keyword) {
        throw new Error("ajv implementation error");
      }
      const deps = def.dependencies;
      if (deps === null || deps === void 0 ? void 0 : deps.some((kwd) => !Object.prototype.hasOwnProperty.call(schema, kwd))) {
        throw new Error(`parent schema must have dependencies of ${keyword}: ${deps.join(",")}`);
      }
      if (def.validateSchema) {
        const valid = def.validateSchema(schema[keyword]);
        if (!valid) {
          const msg = `keyword "${keyword}" value is invalid at path "${errSchemaPath}": ` + self2.errorsText(def.validateSchema.errors);
          if (opts.validateSchema === "log")
            self2.logger.error(msg);
          else
            throw new Error(msg);
        }
      }
    }
    exports.validateKeywordUsage = validateKeywordUsage;
  }
});

// node_modules/ajv/dist/compile/validate/subschema.js
var require_subschema = __commonJS({
  "node_modules/ajv/dist/compile/validate/subschema.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.extendSubschemaMode = exports.extendSubschemaData = exports.getSubschema = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    function getSubschema(it, { keyword, schemaProp, schema, schemaPath, errSchemaPath, topSchemaRef }) {
      if (keyword !== void 0 && schema !== void 0) {
        throw new Error('both "keyword" and "schema" passed, only one allowed');
      }
      if (keyword !== void 0) {
        const sch = it.schema[keyword];
        return schemaProp === void 0 ? {
          schema: sch,
          schemaPath: (0, codegen_1._)`${it.schemaPath}${(0, codegen_1.getProperty)(keyword)}`,
          errSchemaPath: `${it.errSchemaPath}/${keyword}`
        } : {
          schema: sch[schemaProp],
          schemaPath: (0, codegen_1._)`${it.schemaPath}${(0, codegen_1.getProperty)(keyword)}${(0, codegen_1.getProperty)(schemaProp)}`,
          errSchemaPath: `${it.errSchemaPath}/${keyword}/${(0, util_1.escapeFragment)(schemaProp)}`
        };
      }
      if (schema !== void 0) {
        if (schemaPath === void 0 || errSchemaPath === void 0 || topSchemaRef === void 0) {
          throw new Error('"schemaPath", "errSchemaPath" and "topSchemaRef" are required with "schema"');
        }
        return {
          schema,
          schemaPath,
          topSchemaRef,
          errSchemaPath
        };
      }
      throw new Error('either "keyword" or "schema" must be passed');
    }
    exports.getSubschema = getSubschema;
    function extendSubschemaData(subschema, it, { dataProp, dataPropType: dpType, data, dataTypes, propertyName }) {
      if (data !== void 0 && dataProp !== void 0) {
        throw new Error('both "data" and "dataProp" passed, only one allowed');
      }
      const { gen } = it;
      if (dataProp !== void 0) {
        const { errorPath, dataPathArr, opts } = it;
        const nextData = gen.let("data", (0, codegen_1._)`${it.data}${(0, codegen_1.getProperty)(dataProp)}`, true);
        dataContextProps(nextData);
        subschema.errorPath = (0, codegen_1.str)`${errorPath}${(0, util_1.getErrorPath)(dataProp, dpType, opts.jsPropertySyntax)}`;
        subschema.parentDataProperty = (0, codegen_1._)`${dataProp}`;
        subschema.dataPathArr = [...dataPathArr, subschema.parentDataProperty];
      }
      if (data !== void 0) {
        const nextData = data instanceof codegen_1.Name ? data : gen.let("data", data, true);
        dataContextProps(nextData);
        if (propertyName !== void 0)
          subschema.propertyName = propertyName;
      }
      if (dataTypes)
        subschema.dataTypes = dataTypes;
      function dataContextProps(_nextData) {
        subschema.data = _nextData;
        subschema.dataLevel = it.dataLevel + 1;
        subschema.dataTypes = [];
        it.definedProperties = /* @__PURE__ */ new Set();
        subschema.parentData = it.data;
        subschema.dataNames = [...it.dataNames, _nextData];
      }
    }
    exports.extendSubschemaData = extendSubschemaData;
    function extendSubschemaMode(subschema, { jtdDiscriminator, jtdMetadata, compositeRule, createErrors, allErrors }) {
      if (compositeRule !== void 0)
        subschema.compositeRule = compositeRule;
      if (createErrors !== void 0)
        subschema.createErrors = createErrors;
      if (allErrors !== void 0)
        subschema.allErrors = allErrors;
      subschema.jtdDiscriminator = jtdDiscriminator;
      subschema.jtdMetadata = jtdMetadata;
    }
    exports.extendSubschemaMode = extendSubschemaMode;
  }
});

// node_modules/fast-deep-equal/index.js
var require_fast_deep_equal = __commonJS({
  "node_modules/fast-deep-equal/index.js"(exports, module) {
    "use strict";
    module.exports = function equal(a, b) {
      if (a === b) return true;
      if (a && b && typeof a == "object" && typeof b == "object") {
        if (a.constructor !== b.constructor) return false;
        var length, i, keys;
        if (Array.isArray(a)) {
          length = a.length;
          if (length != b.length) return false;
          for (i = length; i-- !== 0; )
            if (!equal(a[i], b[i])) return false;
          return true;
        }
        if (a.constructor === RegExp) return a.source === b.source && a.flags === b.flags;
        if (a.valueOf !== Object.prototype.valueOf) return a.valueOf() === b.valueOf();
        if (a.toString !== Object.prototype.toString) return a.toString() === b.toString();
        keys = Object.keys(a);
        length = keys.length;
        if (length !== Object.keys(b).length) return false;
        for (i = length; i-- !== 0; )
          if (!Object.prototype.hasOwnProperty.call(b, keys[i])) return false;
        for (i = length; i-- !== 0; ) {
          var key = keys[i];
          if (!equal(a[key], b[key])) return false;
        }
        return true;
      }
      return a !== a && b !== b;
    };
  }
});

// node_modules/json-schema-traverse/index.js
var require_json_schema_traverse = __commonJS({
  "node_modules/json-schema-traverse/index.js"(exports, module) {
    "use strict";
    var traverse = module.exports = function(schema, opts, cb) {
      if (typeof opts == "function") {
        cb = opts;
        opts = {};
      }
      cb = opts.cb || cb;
      var pre = typeof cb == "function" ? cb : cb.pre || function() {
      };
      var post = cb.post || function() {
      };
      _traverse(opts, pre, post, schema, "", schema);
    };
    traverse.keywords = {
      additionalItems: true,
      items: true,
      contains: true,
      additionalProperties: true,
      propertyNames: true,
      not: true,
      if: true,
      then: true,
      else: true
    };
    traverse.arrayKeywords = {
      items: true,
      allOf: true,
      anyOf: true,
      oneOf: true
    };
    traverse.propsKeywords = {
      $defs: true,
      definitions: true,
      properties: true,
      patternProperties: true,
      dependencies: true
    };
    traverse.skipKeywords = {
      default: true,
      enum: true,
      const: true,
      required: true,
      maximum: true,
      minimum: true,
      exclusiveMaximum: true,
      exclusiveMinimum: true,
      multipleOf: true,
      maxLength: true,
      minLength: true,
      pattern: true,
      format: true,
      maxItems: true,
      minItems: true,
      uniqueItems: true,
      maxProperties: true,
      minProperties: true
    };
    function _traverse(opts, pre, post, schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex) {
      if (schema && typeof schema == "object" && !Array.isArray(schema)) {
        pre(schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex);
        for (var key in schema) {
          var sch = schema[key];
          if (Array.isArray(sch)) {
            if (key in traverse.arrayKeywords) {
              for (var i = 0; i < sch.length; i++)
                _traverse(opts, pre, post, sch[i], jsonPtr + "/" + key + "/" + i, rootSchema, jsonPtr, key, schema, i);
            }
          } else if (key in traverse.propsKeywords) {
            if (sch && typeof sch == "object") {
              for (var prop in sch)
                _traverse(opts, pre, post, sch[prop], jsonPtr + "/" + key + "/" + escapeJsonPtr(prop), rootSchema, jsonPtr, key, schema, prop);
            }
          } else if (key in traverse.keywords || opts.allKeys && !(key in traverse.skipKeywords)) {
            _traverse(opts, pre, post, sch, jsonPtr + "/" + key, rootSchema, jsonPtr, key, schema);
          }
        }
        post(schema, jsonPtr, rootSchema, parentJsonPtr, parentKeyword, parentSchema, keyIndex);
      }
    }
    function escapeJsonPtr(str) {
      return str.replace(/~/g, "~0").replace(/\//g, "~1");
    }
  }
});

// node_modules/ajv/dist/compile/resolve.js
var require_resolve = __commonJS({
  "node_modules/ajv/dist/compile/resolve.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getSchemaRefs = exports.resolveUrl = exports.normalizeId = exports._getFullPath = exports.getFullPath = exports.inlineRef = void 0;
    var util_1 = require_util();
    var equal = require_fast_deep_equal();
    var traverse = require_json_schema_traverse();
    var SIMPLE_INLINED = /* @__PURE__ */ new Set([
      "type",
      "format",
      "pattern",
      "maxLength",
      "minLength",
      "maxProperties",
      "minProperties",
      "maxItems",
      "minItems",
      "maximum",
      "minimum",
      "uniqueItems",
      "multipleOf",
      "required",
      "enum",
      "const"
    ]);
    function inlineRef(schema, limit = true) {
      if (typeof schema == "boolean")
        return true;
      if (limit === true)
        return !hasRef(schema);
      if (!limit)
        return false;
      return countKeys(schema) <= limit;
    }
    exports.inlineRef = inlineRef;
    var REF_KEYWORDS = /* @__PURE__ */ new Set([
      "$ref",
      "$recursiveRef",
      "$recursiveAnchor",
      "$dynamicRef",
      "$dynamicAnchor"
    ]);
    function hasRef(schema) {
      for (const key in schema) {
        if (REF_KEYWORDS.has(key))
          return true;
        const sch = schema[key];
        if (Array.isArray(sch) && sch.some(hasRef))
          return true;
        if (typeof sch == "object" && hasRef(sch))
          return true;
      }
      return false;
    }
    function countKeys(schema) {
      let count = 0;
      for (const key in schema) {
        if (key === "$ref")
          return Infinity;
        count++;
        if (SIMPLE_INLINED.has(key))
          continue;
        if (typeof schema[key] == "object") {
          (0, util_1.eachItem)(schema[key], (sch) => count += countKeys(sch));
        }
        if (count === Infinity)
          return Infinity;
      }
      return count;
    }
    function getFullPath(resolver, id = "", normalize) {
      if (normalize !== false)
        id = normalizeId(id);
      const p = resolver.parse(id);
      return _getFullPath(resolver, p);
    }
    exports.getFullPath = getFullPath;
    function _getFullPath(resolver, p) {
      const serialized = resolver.serialize(p);
      return serialized.split("#")[0] + "#";
    }
    exports._getFullPath = _getFullPath;
    var TRAILING_SLASH_HASH = /#\/?$/;
    function normalizeId(id) {
      return id ? id.replace(TRAILING_SLASH_HASH, "") : "";
    }
    exports.normalizeId = normalizeId;
    function resolveUrl(resolver, baseId, id) {
      id = normalizeId(id);
      return resolver.resolve(baseId, id);
    }
    exports.resolveUrl = resolveUrl;
    var ANCHOR = /^[a-z_][-a-z0-9._]*$/i;
    function getSchemaRefs(schema, baseId) {
      if (typeof schema == "boolean")
        return {};
      const { schemaId, uriResolver } = this.opts;
      const schId = normalizeId(schema[schemaId] || baseId);
      const baseIds = { "": schId };
      const pathPrefix = getFullPath(uriResolver, schId, false);
      const localRefs = {};
      const schemaRefs = /* @__PURE__ */ new Set();
      traverse(schema, { allKeys: true }, (sch, jsonPtr, _, parentJsonPtr) => {
        if (parentJsonPtr === void 0)
          return;
        const fullPath = pathPrefix + jsonPtr;
        let innerBaseId = baseIds[parentJsonPtr];
        if (typeof sch[schemaId] == "string")
          innerBaseId = addRef.call(this, sch[schemaId]);
        addAnchor.call(this, sch.$anchor);
        addAnchor.call(this, sch.$dynamicAnchor);
        baseIds[jsonPtr] = innerBaseId;
        function addRef(ref) {
          const _resolve = this.opts.uriResolver.resolve;
          ref = normalizeId(innerBaseId ? _resolve(innerBaseId, ref) : ref);
          if (schemaRefs.has(ref))
            throw ambiguos(ref);
          schemaRefs.add(ref);
          let schOrRef = this.refs[ref];
          if (typeof schOrRef == "string")
            schOrRef = this.refs[schOrRef];
          if (typeof schOrRef == "object") {
            checkAmbiguosRef(sch, schOrRef.schema, ref);
          } else if (ref !== normalizeId(fullPath)) {
            if (ref[0] === "#") {
              checkAmbiguosRef(sch, localRefs[ref], ref);
              localRefs[ref] = sch;
            } else {
              this.refs[ref] = fullPath;
            }
          }
          return ref;
        }
        function addAnchor(anchor) {
          if (typeof anchor == "string") {
            if (!ANCHOR.test(anchor))
              throw new Error(`invalid anchor "${anchor}"`);
            addRef.call(this, `#${anchor}`);
          }
        }
      });
      return localRefs;
      function checkAmbiguosRef(sch1, sch2, ref) {
        if (sch2 !== void 0 && !equal(sch1, sch2))
          throw ambiguos(ref);
      }
      function ambiguos(ref) {
        return new Error(`reference "${ref}" resolves to more than one schema`);
      }
    }
    exports.getSchemaRefs = getSchemaRefs;
  }
});

// node_modules/ajv/dist/compile/validate/index.js
var require_validate = __commonJS({
  "node_modules/ajv/dist/compile/validate/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.getData = exports.KeywordCxt = exports.validateFunctionCode = void 0;
    var boolSchema_1 = require_boolSchema();
    var dataType_1 = require_dataType();
    var applicability_1 = require_applicability();
    var dataType_2 = require_dataType();
    var defaults_1 = require_defaults();
    var keyword_1 = require_keyword();
    var subschema_1 = require_subschema();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var resolve_1 = require_resolve();
    var util_1 = require_util();
    var errors_1 = require_errors();
    function validateFunctionCode(it) {
      if (isSchemaObj(it)) {
        checkKeywords(it);
        if (schemaCxtHasRules(it)) {
          topSchemaObjCode(it);
          return;
        }
      }
      validateFunction(it, () => (0, boolSchema_1.topBoolOrEmptySchema)(it));
    }
    exports.validateFunctionCode = validateFunctionCode;
    function validateFunction({ gen, validateName, schema, schemaEnv, opts }, body) {
      if (opts.code.es5) {
        gen.func(validateName, (0, codegen_1._)`${names_1.default.data}, ${names_1.default.valCxt}`, schemaEnv.$async, () => {
          gen.code((0, codegen_1._)`"use strict"; ${funcSourceUrl(schema, opts)}`);
          destructureValCxtES5(gen, opts);
          gen.code(body);
        });
      } else {
        gen.func(validateName, (0, codegen_1._)`${names_1.default.data}, ${destructureValCxt(opts)}`, schemaEnv.$async, () => gen.code(funcSourceUrl(schema, opts)).code(body));
      }
    }
    function destructureValCxt(opts) {
      return (0, codegen_1._)`{${names_1.default.instancePath}="", ${names_1.default.parentData}, ${names_1.default.parentDataProperty}, ${names_1.default.rootData}=${names_1.default.data}${opts.dynamicRef ? (0, codegen_1._)`, ${names_1.default.dynamicAnchors}={}` : codegen_1.nil}}={}`;
    }
    function destructureValCxtES5(gen, opts) {
      gen.if(names_1.default.valCxt, () => {
        gen.var(names_1.default.instancePath, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.instancePath}`);
        gen.var(names_1.default.parentData, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.parentData}`);
        gen.var(names_1.default.parentDataProperty, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.parentDataProperty}`);
        gen.var(names_1.default.rootData, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.rootData}`);
        if (opts.dynamicRef)
          gen.var(names_1.default.dynamicAnchors, (0, codegen_1._)`${names_1.default.valCxt}.${names_1.default.dynamicAnchors}`);
      }, () => {
        gen.var(names_1.default.instancePath, (0, codegen_1._)`""`);
        gen.var(names_1.default.parentData, (0, codegen_1._)`undefined`);
        gen.var(names_1.default.parentDataProperty, (0, codegen_1._)`undefined`);
        gen.var(names_1.default.rootData, names_1.default.data);
        if (opts.dynamicRef)
          gen.var(names_1.default.dynamicAnchors, (0, codegen_1._)`{}`);
      });
    }
    function topSchemaObjCode(it) {
      const { schema, opts, gen } = it;
      validateFunction(it, () => {
        if (opts.$comment && schema.$comment)
          commentKeyword(it);
        checkNoDefault(it);
        gen.let(names_1.default.vErrors, null);
        gen.let(names_1.default.errors, 0);
        if (opts.unevaluated)
          resetEvaluated(it);
        typeAndKeywords(it);
        returnResults(it);
      });
      return;
    }
    function resetEvaluated(it) {
      const { gen, validateName } = it;
      it.evaluated = gen.const("evaluated", (0, codegen_1._)`${validateName}.evaluated`);
      gen.if((0, codegen_1._)`${it.evaluated}.dynamicProps`, () => gen.assign((0, codegen_1._)`${it.evaluated}.props`, (0, codegen_1._)`undefined`));
      gen.if((0, codegen_1._)`${it.evaluated}.dynamicItems`, () => gen.assign((0, codegen_1._)`${it.evaluated}.items`, (0, codegen_1._)`undefined`));
    }
    function funcSourceUrl(schema, opts) {
      const schId = typeof schema == "object" && schema[opts.schemaId];
      return schId && (opts.code.source || opts.code.process) ? (0, codegen_1._)`/*# sourceURL=${schId} */` : codegen_1.nil;
    }
    function subschemaCode(it, valid) {
      if (isSchemaObj(it)) {
        checkKeywords(it);
        if (schemaCxtHasRules(it)) {
          subSchemaObjCode(it, valid);
          return;
        }
      }
      (0, boolSchema_1.boolOrEmptySchema)(it, valid);
    }
    function schemaCxtHasRules({ schema, self: self2 }) {
      if (typeof schema == "boolean")
        return !schema;
      for (const key in schema)
        if (self2.RULES.all[key])
          return true;
      return false;
    }
    function isSchemaObj(it) {
      return typeof it.schema != "boolean";
    }
    function subSchemaObjCode(it, valid) {
      const { schema, gen, opts } = it;
      if (opts.$comment && schema.$comment)
        commentKeyword(it);
      updateContext(it);
      checkAsyncSchema(it);
      const errsCount = gen.const("_errs", names_1.default.errors);
      typeAndKeywords(it, errsCount);
      gen.var(valid, (0, codegen_1._)`${errsCount} === ${names_1.default.errors}`);
    }
    function checkKeywords(it) {
      (0, util_1.checkUnknownRules)(it);
      checkRefsAndKeywords(it);
    }
    function typeAndKeywords(it, errsCount) {
      if (it.opts.jtd)
        return schemaKeywords(it, [], false, errsCount);
      const types = (0, dataType_1.getSchemaTypes)(it.schema);
      const checkedTypes = (0, dataType_1.coerceAndCheckDataType)(it, types);
      schemaKeywords(it, types, !checkedTypes, errsCount);
    }
    function checkRefsAndKeywords(it) {
      const { schema, errSchemaPath, opts, self: self2 } = it;
      if (schema.$ref && opts.ignoreKeywordsWithRef && (0, util_1.schemaHasRulesButRef)(schema, self2.RULES)) {
        self2.logger.warn(`$ref: keywords ignored in schema at path "${errSchemaPath}"`);
      }
    }
    function checkNoDefault(it) {
      const { schema, opts } = it;
      if (schema.default !== void 0 && opts.useDefaults && opts.strictSchema) {
        (0, util_1.checkStrictMode)(it, "default is ignored in the schema root");
      }
    }
    function updateContext(it) {
      const schId = it.schema[it.opts.schemaId];
      if (schId)
        it.baseId = (0, resolve_1.resolveUrl)(it.opts.uriResolver, it.baseId, schId);
    }
    function checkAsyncSchema(it) {
      if (it.schema.$async && !it.schemaEnv.$async)
        throw new Error("async schema in sync schema");
    }
    function commentKeyword({ gen, schemaEnv, schema, errSchemaPath, opts }) {
      const msg = schema.$comment;
      if (opts.$comment === true) {
        gen.code((0, codegen_1._)`${names_1.default.self}.logger.log(${msg})`);
      } else if (typeof opts.$comment == "function") {
        const schemaPath = (0, codegen_1.str)`${errSchemaPath}/$comment`;
        const rootName = gen.scopeValue("root", { ref: schemaEnv.root });
        gen.code((0, codegen_1._)`${names_1.default.self}.opts.$comment(${msg}, ${schemaPath}, ${rootName}.schema)`);
      }
    }
    function returnResults(it) {
      const { gen, schemaEnv, validateName, ValidationError, opts } = it;
      if (schemaEnv.$async) {
        gen.if((0, codegen_1._)`${names_1.default.errors} === 0`, () => gen.return(names_1.default.data), () => gen.throw((0, codegen_1._)`new ${ValidationError}(${names_1.default.vErrors})`));
      } else {
        gen.assign((0, codegen_1._)`${validateName}.errors`, names_1.default.vErrors);
        if (opts.unevaluated)
          assignEvaluated(it);
        gen.return((0, codegen_1._)`${names_1.default.errors} === 0`);
      }
    }
    function assignEvaluated({ gen, evaluated, props, items }) {
      if (props instanceof codegen_1.Name)
        gen.assign((0, codegen_1._)`${evaluated}.props`, props);
      if (items instanceof codegen_1.Name)
        gen.assign((0, codegen_1._)`${evaluated}.items`, items);
    }
    function schemaKeywords(it, types, typeErrors, errsCount) {
      const { gen, schema, data, allErrors, opts, self: self2 } = it;
      const { RULES } = self2;
      if (schema.$ref && (opts.ignoreKeywordsWithRef || !(0, util_1.schemaHasRulesButRef)(schema, RULES))) {
        gen.block(() => keywordCode(it, "$ref", RULES.all.$ref.definition));
        return;
      }
      if (!opts.jtd)
        checkStrictTypes(it, types);
      gen.block(() => {
        for (const group of RULES.rules)
          groupKeywords(group);
        groupKeywords(RULES.post);
      });
      function groupKeywords(group) {
        if (!(0, applicability_1.shouldUseGroup)(schema, group))
          return;
        if (group.type) {
          gen.if((0, dataType_2.checkDataType)(group.type, data, opts.strictNumbers));
          iterateKeywords(it, group);
          if (types.length === 1 && types[0] === group.type && typeErrors) {
            gen.else();
            (0, dataType_2.reportTypeError)(it);
          }
          gen.endIf();
        } else {
          iterateKeywords(it, group);
        }
        if (!allErrors)
          gen.if((0, codegen_1._)`${names_1.default.errors} === ${errsCount || 0}`);
      }
    }
    function iterateKeywords(it, group) {
      const { gen, schema, opts: { useDefaults } } = it;
      if (useDefaults)
        (0, defaults_1.assignDefaults)(it, group.type);
      gen.block(() => {
        for (const rule of group.rules) {
          if ((0, applicability_1.shouldUseRule)(schema, rule)) {
            keywordCode(it, rule.keyword, rule.definition, group.type);
          }
        }
      });
    }
    function checkStrictTypes(it, types) {
      if (it.schemaEnv.meta || !it.opts.strictTypes)
        return;
      checkContextTypes(it, types);
      if (!it.opts.allowUnionTypes)
        checkMultipleTypes(it, types);
      checkKeywordTypes(it, it.dataTypes);
    }
    function checkContextTypes(it, types) {
      if (!types.length)
        return;
      if (!it.dataTypes.length) {
        it.dataTypes = types;
        return;
      }
      types.forEach((t) => {
        if (!includesType(it.dataTypes, t)) {
          strictTypesError(it, `type "${t}" not allowed by context "${it.dataTypes.join(",")}"`);
        }
      });
      narrowSchemaTypes(it, types);
    }
    function checkMultipleTypes(it, ts) {
      if (ts.length > 1 && !(ts.length === 2 && ts.includes("null"))) {
        strictTypesError(it, "use allowUnionTypes to allow union type keyword");
      }
    }
    function checkKeywordTypes(it, ts) {
      const rules = it.self.RULES.all;
      for (const keyword in rules) {
        const rule = rules[keyword];
        if (typeof rule == "object" && (0, applicability_1.shouldUseRule)(it.schema, rule)) {
          const { type } = rule.definition;
          if (type.length && !type.some((t) => hasApplicableType(ts, t))) {
            strictTypesError(it, `missing type "${type.join(",")}" for keyword "${keyword}"`);
          }
        }
      }
    }
    function hasApplicableType(schTs, kwdT) {
      return schTs.includes(kwdT) || kwdT === "number" && schTs.includes("integer");
    }
    function includesType(ts, t) {
      return ts.includes(t) || t === "integer" && ts.includes("number");
    }
    function narrowSchemaTypes(it, withTypes) {
      const ts = [];
      for (const t of it.dataTypes) {
        if (includesType(withTypes, t))
          ts.push(t);
        else if (withTypes.includes("integer") && t === "number")
          ts.push("integer");
      }
      it.dataTypes = ts;
    }
    function strictTypesError(it, msg) {
      const schemaPath = it.schemaEnv.baseId + it.errSchemaPath;
      msg += ` at "${schemaPath}" (strictTypes)`;
      (0, util_1.checkStrictMode)(it, msg, it.opts.strictTypes);
    }
    var KeywordCxt = class {
      constructor(it, def, keyword) {
        (0, keyword_1.validateKeywordUsage)(it, def, keyword);
        this.gen = it.gen;
        this.allErrors = it.allErrors;
        this.keyword = keyword;
        this.data = it.data;
        this.schema = it.schema[keyword];
        this.$data = def.$data && it.opts.$data && this.schema && this.schema.$data;
        this.schemaValue = (0, util_1.schemaRefOrVal)(it, this.schema, keyword, this.$data);
        this.schemaType = def.schemaType;
        this.parentSchema = it.schema;
        this.params = {};
        this.it = it;
        this.def = def;
        if (this.$data) {
          this.schemaCode = it.gen.const("vSchema", getData(this.$data, it));
        } else {
          this.schemaCode = this.schemaValue;
          if (!(0, keyword_1.validSchemaType)(this.schema, def.schemaType, def.allowUndefined)) {
            throw new Error(`${keyword} value must be ${JSON.stringify(def.schemaType)}`);
          }
        }
        if ("code" in def ? def.trackErrors : def.errors !== false) {
          this.errsCount = it.gen.const("_errs", names_1.default.errors);
        }
      }
      result(condition, successAction, failAction) {
        this.failResult((0, codegen_1.not)(condition), successAction, failAction);
      }
      failResult(condition, successAction, failAction) {
        this.gen.if(condition);
        if (failAction)
          failAction();
        else
          this.error();
        if (successAction) {
          this.gen.else();
          successAction();
          if (this.allErrors)
            this.gen.endIf();
        } else {
          if (this.allErrors)
            this.gen.endIf();
          else
            this.gen.else();
        }
      }
      pass(condition, failAction) {
        this.failResult((0, codegen_1.not)(condition), void 0, failAction);
      }
      fail(condition) {
        if (condition === void 0) {
          this.error();
          if (!this.allErrors)
            this.gen.if(false);
          return;
        }
        this.gen.if(condition);
        this.error();
        if (this.allErrors)
          this.gen.endIf();
        else
          this.gen.else();
      }
      fail$data(condition) {
        if (!this.$data)
          return this.fail(condition);
        const { schemaCode } = this;
        this.fail((0, codegen_1._)`${schemaCode} !== undefined && (${(0, codegen_1.or)(this.invalid$data(), condition)})`);
      }
      error(append, errorParams, errorPaths) {
        if (errorParams) {
          this.setParams(errorParams);
          this._error(append, errorPaths);
          this.setParams({});
          return;
        }
        this._error(append, errorPaths);
      }
      _error(append, errorPaths) {
        ;
        (append ? errors_1.reportExtraError : errors_1.reportError)(this, this.def.error, errorPaths);
      }
      $dataError() {
        (0, errors_1.reportError)(this, this.def.$dataError || errors_1.keyword$DataError);
      }
      reset() {
        if (this.errsCount === void 0)
          throw new Error('add "trackErrors" to keyword definition');
        (0, errors_1.resetErrorsCount)(this.gen, this.errsCount);
      }
      ok(cond) {
        if (!this.allErrors)
          this.gen.if(cond);
      }
      setParams(obj, assign) {
        if (assign)
          Object.assign(this.params, obj);
        else
          this.params = obj;
      }
      block$data(valid, codeBlock, $dataValid = codegen_1.nil) {
        this.gen.block(() => {
          this.check$data(valid, $dataValid);
          codeBlock();
        });
      }
      check$data(valid = codegen_1.nil, $dataValid = codegen_1.nil) {
        if (!this.$data)
          return;
        const { gen, schemaCode, schemaType, def } = this;
        gen.if((0, codegen_1.or)((0, codegen_1._)`${schemaCode} === undefined`, $dataValid));
        if (valid !== codegen_1.nil)
          gen.assign(valid, true);
        if (schemaType.length || def.validateSchema) {
          gen.elseIf(this.invalid$data());
          this.$dataError();
          if (valid !== codegen_1.nil)
            gen.assign(valid, false);
        }
        gen.else();
      }
      invalid$data() {
        const { gen, schemaCode, schemaType, def, it } = this;
        return (0, codegen_1.or)(wrong$DataType(), invalid$DataSchema());
        function wrong$DataType() {
          if (schemaType.length) {
            if (!(schemaCode instanceof codegen_1.Name))
              throw new Error("ajv implementation error");
            const st = Array.isArray(schemaType) ? schemaType : [schemaType];
            return (0, codegen_1._)`${(0, dataType_2.checkDataTypes)(st, schemaCode, it.opts.strictNumbers, dataType_2.DataType.Wrong)}`;
          }
          return codegen_1.nil;
        }
        function invalid$DataSchema() {
          if (def.validateSchema) {
            const validateSchemaRef = gen.scopeValue("validate$data", { ref: def.validateSchema });
            return (0, codegen_1._)`!${validateSchemaRef}(${schemaCode})`;
          }
          return codegen_1.nil;
        }
      }
      subschema(appl, valid) {
        const subschema = (0, subschema_1.getSubschema)(this.it, appl);
        (0, subschema_1.extendSubschemaData)(subschema, this.it, appl);
        (0, subschema_1.extendSubschemaMode)(subschema, appl);
        const nextContext = { ...this.it, ...subschema, items: void 0, props: void 0 };
        subschemaCode(nextContext, valid);
        return nextContext;
      }
      mergeEvaluated(schemaCxt, toName) {
        const { it, gen } = this;
        if (!it.opts.unevaluated)
          return;
        if (it.props !== true && schemaCxt.props !== void 0) {
          it.props = util_1.mergeEvaluated.props(gen, schemaCxt.props, it.props, toName);
        }
        if (it.items !== true && schemaCxt.items !== void 0) {
          it.items = util_1.mergeEvaluated.items(gen, schemaCxt.items, it.items, toName);
        }
      }
      mergeValidEvaluated(schemaCxt, valid) {
        const { it, gen } = this;
        if (it.opts.unevaluated && (it.props !== true || it.items !== true)) {
          gen.if(valid, () => this.mergeEvaluated(schemaCxt, codegen_1.Name));
          return true;
        }
      }
    };
    exports.KeywordCxt = KeywordCxt;
    function keywordCode(it, keyword, def, ruleType) {
      const cxt = new KeywordCxt(it, def, keyword);
      if ("code" in def) {
        def.code(cxt, ruleType);
      } else if (cxt.$data && def.validate) {
        (0, keyword_1.funcKeywordCode)(cxt, def);
      } else if ("macro" in def) {
        (0, keyword_1.macroKeywordCode)(cxt, def);
      } else if (def.compile || def.validate) {
        (0, keyword_1.funcKeywordCode)(cxt, def);
      }
    }
    var JSON_POINTER = /^\/(?:[^~]|~0|~1)*$/;
    var RELATIVE_JSON_POINTER = /^([0-9]+)(#|\/(?:[^~]|~0|~1)*)?$/;
    function getData($data, { dataLevel, dataNames, dataPathArr }) {
      let jsonPointer;
      let data;
      if ($data === "")
        return names_1.default.rootData;
      if ($data[0] === "/") {
        if (!JSON_POINTER.test($data))
          throw new Error(`Invalid JSON-pointer: ${$data}`);
        jsonPointer = $data;
        data = names_1.default.rootData;
      } else {
        const matches = RELATIVE_JSON_POINTER.exec($data);
        if (!matches)
          throw new Error(`Invalid JSON-pointer: ${$data}`);
        const up = +matches[1];
        jsonPointer = matches[2];
        if (jsonPointer === "#") {
          if (up >= dataLevel)
            throw new Error(errorMsg("property/index", up));
          return dataPathArr[dataLevel - up];
        }
        if (up > dataLevel)
          throw new Error(errorMsg("data", up));
        data = dataNames[dataLevel - up];
        if (!jsonPointer)
          return data;
      }
      let expr = data;
      const segments = jsonPointer.split("/");
      for (const segment of segments) {
        if (segment) {
          data = (0, codegen_1._)`${data}${(0, codegen_1.getProperty)((0, util_1.unescapeJsonPointer)(segment))}`;
          expr = (0, codegen_1._)`${expr} && ${data}`;
        }
      }
      return expr;
      function errorMsg(pointerType, up) {
        return `Cannot access ${pointerType} ${up} levels up, current level is ${dataLevel}`;
      }
    }
    exports.getData = getData;
  }
});

// node_modules/ajv/dist/runtime/validation_error.js
var require_validation_error = __commonJS({
  "node_modules/ajv/dist/runtime/validation_error.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var ValidationError = class extends Error {
      constructor(errors) {
        super("validation failed");
        this.errors = errors;
        this.ajv = this.validation = true;
      }
    };
    exports.default = ValidationError;
  }
});

// node_modules/ajv/dist/compile/ref_error.js
var require_ref_error = __commonJS({
  "node_modules/ajv/dist/compile/ref_error.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var resolve_1 = require_resolve();
    var MissingRefError = class extends Error {
      constructor(resolver, baseId, ref, msg) {
        super(msg || `can't resolve reference ${ref} from id ${baseId}`);
        this.missingRef = (0, resolve_1.resolveUrl)(resolver, baseId, ref);
        this.missingSchema = (0, resolve_1.normalizeId)((0, resolve_1.getFullPath)(resolver, this.missingRef));
      }
    };
    exports.default = MissingRefError;
  }
});

// node_modules/ajv/dist/compile/index.js
var require_compile = __commonJS({
  "node_modules/ajv/dist/compile/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.resolveSchema = exports.getCompilingSchema = exports.resolveRef = exports.compileSchema = exports.SchemaEnv = void 0;
    var codegen_1 = require_codegen();
    var validation_error_1 = require_validation_error();
    var names_1 = require_names();
    var resolve_1 = require_resolve();
    var util_1 = require_util();
    var validate_1 = require_validate();
    var SchemaEnv = class {
      constructor(env) {
        var _a;
        this.refs = {};
        this.dynamicAnchors = {};
        let schema;
        if (typeof env.schema == "object")
          schema = env.schema;
        this.schema = env.schema;
        this.schemaId = env.schemaId;
        this.root = env.root || this;
        this.baseId = (_a = env.baseId) !== null && _a !== void 0 ? _a : (0, resolve_1.normalizeId)(schema === null || schema === void 0 ? void 0 : schema[env.schemaId || "$id"]);
        this.schemaPath = env.schemaPath;
        this.localRefs = env.localRefs;
        this.meta = env.meta;
        this.$async = schema === null || schema === void 0 ? void 0 : schema.$async;
        this.refs = {};
      }
    };
    exports.SchemaEnv = SchemaEnv;
    function compileSchema(sch) {
      const _sch = getCompilingSchema.call(this, sch);
      if (_sch)
        return _sch;
      const rootId = (0, resolve_1.getFullPath)(this.opts.uriResolver, sch.root.baseId);
      const { es5, lines } = this.opts.code;
      const { ownProperties } = this.opts;
      const gen = new codegen_1.CodeGen(this.scope, { es5, lines, ownProperties });
      let _ValidationError;
      if (sch.$async) {
        _ValidationError = gen.scopeValue("Error", {
          ref: validation_error_1.default,
          code: (0, codegen_1._)`require("ajv/dist/runtime/validation_error").default`
        });
      }
      const validateName = gen.scopeName("validate");
      sch.validateName = validateName;
      const schemaCxt = {
        gen,
        allErrors: this.opts.allErrors,
        data: names_1.default.data,
        parentData: names_1.default.parentData,
        parentDataProperty: names_1.default.parentDataProperty,
        dataNames: [names_1.default.data],
        dataPathArr: [codegen_1.nil],
        // TODO can its length be used as dataLevel if nil is removed?
        dataLevel: 0,
        dataTypes: [],
        definedProperties: /* @__PURE__ */ new Set(),
        topSchemaRef: gen.scopeValue("schema", this.opts.code.source === true ? { ref: sch.schema, code: (0, codegen_1.stringify)(sch.schema) } : { ref: sch.schema }),
        validateName,
        ValidationError: _ValidationError,
        schema: sch.schema,
        schemaEnv: sch,
        rootId,
        baseId: sch.baseId || rootId,
        schemaPath: codegen_1.nil,
        errSchemaPath: sch.schemaPath || (this.opts.jtd ? "" : "#"),
        errorPath: (0, codegen_1._)`""`,
        opts: this.opts,
        self: this
      };
      let sourceCode;
      try {
        this._compilations.add(sch);
        (0, validate_1.validateFunctionCode)(schemaCxt);
        gen.optimize(this.opts.code.optimize);
        const validateCode = gen.toString();
        sourceCode = `${gen.scopeRefs(names_1.default.scope)}return ${validateCode}`;
        if (this.opts.code.process)
          sourceCode = this.opts.code.process(sourceCode, sch);
        const makeValidate = new Function(`${names_1.default.self}`, `${names_1.default.scope}`, sourceCode);
        const validate = makeValidate(this, this.scope.get());
        this.scope.value(validateName, { ref: validate });
        validate.errors = null;
        validate.schema = sch.schema;
        validate.schemaEnv = sch;
        if (sch.$async)
          validate.$async = true;
        if (this.opts.code.source === true) {
          validate.source = { validateName, validateCode, scopeValues: gen._values };
        }
        if (this.opts.unevaluated) {
          const { props, items } = schemaCxt;
          validate.evaluated = {
            props: props instanceof codegen_1.Name ? void 0 : props,
            items: items instanceof codegen_1.Name ? void 0 : items,
            dynamicProps: props instanceof codegen_1.Name,
            dynamicItems: items instanceof codegen_1.Name
          };
          if (validate.source)
            validate.source.evaluated = (0, codegen_1.stringify)(validate.evaluated);
        }
        sch.validate = validate;
        return sch;
      } catch (e) {
        delete sch.validate;
        delete sch.validateName;
        if (sourceCode)
          this.logger.error("Error compiling schema, function code:", sourceCode);
        throw e;
      } finally {
        this._compilations.delete(sch);
      }
    }
    exports.compileSchema = compileSchema;
    function resolveRef(root, baseId, ref) {
      var _a;
      ref = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, ref);
      const schOrFunc = root.refs[ref];
      if (schOrFunc)
        return schOrFunc;
      let _sch = resolve3.call(this, root, ref);
      if (_sch === void 0) {
        const schema = (_a = root.localRefs) === null || _a === void 0 ? void 0 : _a[ref];
        const { schemaId } = this.opts;
        if (schema)
          _sch = new SchemaEnv({ schema, schemaId, root, baseId });
      }
      if (_sch === void 0)
        return;
      return root.refs[ref] = inlineOrCompile.call(this, _sch);
    }
    exports.resolveRef = resolveRef;
    function inlineOrCompile(sch) {
      if ((0, resolve_1.inlineRef)(sch.schema, this.opts.inlineRefs))
        return sch.schema;
      return sch.validate ? sch : compileSchema.call(this, sch);
    }
    function getCompilingSchema(schEnv) {
      for (const sch of this._compilations) {
        if (sameSchemaEnv(sch, schEnv))
          return sch;
      }
    }
    exports.getCompilingSchema = getCompilingSchema;
    function sameSchemaEnv(s1, s2) {
      return s1.schema === s2.schema && s1.root === s2.root && s1.baseId === s2.baseId;
    }
    function resolve3(root, ref) {
      let sch;
      while (typeof (sch = this.refs[ref]) == "string")
        ref = sch;
      return sch || this.schemas[ref] || resolveSchema.call(this, root, ref);
    }
    function resolveSchema(root, ref) {
      const p = this.opts.uriResolver.parse(ref);
      const refPath = (0, resolve_1._getFullPath)(this.opts.uriResolver, p);
      let baseId = (0, resolve_1.getFullPath)(this.opts.uriResolver, root.baseId, void 0);
      if (Object.keys(root.schema).length > 0 && refPath === baseId) {
        return getJsonPointer.call(this, p, root);
      }
      const id = (0, resolve_1.normalizeId)(refPath);
      const schOrRef = this.refs[id] || this.schemas[id];
      if (typeof schOrRef == "string") {
        const sch = resolveSchema.call(this, root, schOrRef);
        if (typeof (sch === null || sch === void 0 ? void 0 : sch.schema) !== "object")
          return;
        return getJsonPointer.call(this, p, sch);
      }
      if (typeof (schOrRef === null || schOrRef === void 0 ? void 0 : schOrRef.schema) !== "object")
        return;
      if (!schOrRef.validate)
        compileSchema.call(this, schOrRef);
      if (id === (0, resolve_1.normalizeId)(ref)) {
        const { schema } = schOrRef;
        const { schemaId } = this.opts;
        const schId = schema[schemaId];
        if (schId)
          baseId = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schId);
        return new SchemaEnv({ schema, schemaId, root, baseId });
      }
      return getJsonPointer.call(this, p, schOrRef);
    }
    exports.resolveSchema = resolveSchema;
    var PREVENT_SCOPE_CHANGE = /* @__PURE__ */ new Set([
      "properties",
      "patternProperties",
      "enum",
      "dependencies",
      "definitions"
    ]);
    function getJsonPointer(parsedRef, { baseId, schema, root }) {
      var _a;
      if (((_a = parsedRef.fragment) === null || _a === void 0 ? void 0 : _a[0]) !== "/")
        return;
      for (const part of parsedRef.fragment.slice(1).split("/")) {
        if (typeof schema === "boolean")
          return;
        const partSchema = schema[(0, util_1.unescapeFragment)(part)];
        if (partSchema === void 0)
          return;
        schema = partSchema;
        const schId = typeof schema === "object" && schema[this.opts.schemaId];
        if (!PREVENT_SCOPE_CHANGE.has(part) && schId) {
          baseId = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schId);
        }
      }
      let env;
      if (typeof schema != "boolean" && schema.$ref && !(0, util_1.schemaHasRulesButRef)(schema, this.RULES)) {
        const $ref = (0, resolve_1.resolveUrl)(this.opts.uriResolver, baseId, schema.$ref);
        env = resolveSchema.call(this, root, $ref);
      }
      const { schemaId } = this.opts;
      env = env || new SchemaEnv({ schema, schemaId, root, baseId });
      if (env.schema !== env.root.schema)
        return env;
      return void 0;
    }
  }
});

// node_modules/ajv/dist/refs/data.json
var require_data = __commonJS({
  "node_modules/ajv/dist/refs/data.json"(exports, module) {
    module.exports = {
      $id: "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#",
      description: "Meta-schema for $data reference (JSON AnySchema extension proposal)",
      type: "object",
      required: ["$data"],
      properties: {
        $data: {
          type: "string",
          anyOf: [{ format: "relative-json-pointer" }, { format: "json-pointer" }]
        }
      },
      additionalProperties: false
    };
  }
});

// node_modules/fast-uri/lib/utils.js
var require_utils = __commonJS({
  "node_modules/fast-uri/lib/utils.js"(exports, module) {
    "use strict";
    var isUUID = RegExp.prototype.test.bind(/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/iu);
    var isIPv4 = RegExp.prototype.test.bind(/^(?:(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)\.){3}(?:25[0-5]|2[0-4]\d|1\d{2}|[1-9]\d|\d)$/u);
    var isHexPair = RegExp.prototype.test.bind(/^[\da-f]{2}$/iu);
    var isUnreserved = RegExp.prototype.test.bind(/^[\da-z\-._~]$/iu);
    var isPathCharacter = RegExp.prototype.test.bind(/^[A-Za-z0-9\-._~!$&'()*+,;=:@/]$/u);
    var isQueryFragmentCharacter = RegExp.prototype.test.bind(/^[A-Za-z0-9\-._~!$&'()*+,;=:@/?]$/u);
    var isUserinfoCharacter = RegExp.prototype.test.bind(/^[A-Za-z0-9\-._~!$&'()*+,;=:]$/u);
    var BYTE_HEX = new Array(256);
    {
      const HEX_DIGITS = "0123456789ABCDEF";
      for (let i = 0; i < 256; i++) {
        BYTE_HEX[i] = "%" + HEX_DIGITS[i >> 4] + HEX_DIGITS[i & 15];
      }
    }
    function percentEncodeNonAscii(cp) {
      if (cp < 2048) {
        return BYTE_HEX[192 | cp >> 6] + BYTE_HEX[128 | cp & 63];
      }
      if (cp < 65536) {
        return BYTE_HEX[224 | cp >> 12] + BYTE_HEX[128 | cp >> 6 & 63] + BYTE_HEX[128 | cp & 63];
      }
      return BYTE_HEX[240 | cp >> 18] + BYTE_HEX[128 | cp >> 12 & 63] + BYTE_HEX[128 | cp >> 6 & 63] + BYTE_HEX[128 | cp & 63];
    }
    function stringArrayToHexStripped(input) {
      let acc = "";
      let code = 0;
      let i = 0;
      for (i = 0; i < input.length; i++) {
        code = input[i].charCodeAt(0);
        if (code === 48) {
          continue;
        }
        if (!(code >= 48 && code <= 57 || code >= 65 && code <= 70 || code >= 97 && code <= 102)) {
          return "";
        }
        acc += input[i];
        break;
      }
      for (i += 1; i < input.length; i++) {
        code = input[i].charCodeAt(0);
        if (!(code >= 48 && code <= 57 || code >= 65 && code <= 70 || code >= 97 && code <= 102)) {
          return "";
        }
        acc += input[i];
      }
      return acc;
    }
    var isHextet = RegExp.prototype.test.bind(/^[\dA-Fa-f]{1,4}$/);
    var isIPvFuture = RegExp.prototype.test.bind(/^[vV][\dA-Fa-f]+\.[A-Za-z\d\-._~!$&'()*+,;=:]+$/);
    var isZoneCharacter = RegExp.prototype.test.bind(/^[A-Za-z\d\-._~]$/);
    var nonSimpleDomain = RegExp.prototype.test.bind(/[^!"$&'()*+,\-.;=_`a-z{}~]/u);
    function isZoneIdentifier(zone) {
      if (zone.length === 0) return false;
      for (let i = 0; i < zone.length; i++) {
        if (isZoneCharacter(zone[i])) continue;
        if (zone[i] === "%" && i + 2 < zone.length && isHexPair(zone.slice(i + 1, i + 3))) {
          i += 2;
          continue;
        }
        return false;
      }
      return true;
    }
    function compressIPv6ZeroRun(hextets) {
      let bestStart = -1;
      let bestLength = 0;
      let runStart = -1;
      let runLength = 0;
      for (let i = 0; i < hextets.length; i++) {
        if (hextets[i] === "0") {
          if (runStart === -1) runStart = i;
          runLength++;
          if (runLength > bestLength) {
            bestLength = runLength;
            bestStart = runStart;
          }
        } else {
          runStart = -1;
          runLength = 0;
        }
      }
      if (bestLength < 2) return hextets.join(":");
      const head = hextets.slice(0, bestStart).join(":");
      const tail = hextets.slice(bestStart + bestLength).join(":");
      return head + "::" + tail;
    }
    function normalizeIPv6Address(input) {
      const compression = input.indexOf("::");
      if (compression !== -1 && input.indexOf("::", compression + 1) !== -1) return void 0;
      const left = compression === -1 ? input.split(":") : input.slice(0, compression).split(":");
      const right = compression === -1 ? [] : input.slice(compression + 2).split(":");
      if (compression !== -1) {
        if (left.length === 1 && left[0] === "") left.length = 0;
        if (right.length === 1 && right[0] === "") right.length = 0;
      }
      const parts = left.concat(right);
      let hextetCount = 0;
      for (let i = 0; i < parts.length; i++) {
        const part = parts[i];
        if (part === "") return void 0;
        if (part.indexOf(".") !== -1) {
          if (i !== parts.length - 1 || compression !== -1 && right.length === 0 || !isIPv4(part)) return void 0;
          hextetCount += 2;
          continue;
        }
        if (!isHextet(part)) return void 0;
        parts[i] = parseInt(part, 16).toString(16);
        hextetCount++;
      }
      if (compression === -1) {
        if (hextetCount !== 8) return void 0;
        return compressIPv6ZeroRun(parts);
      }
      if (hextetCount >= 8) return void 0;
      const expanded = parts.slice(0, left.length);
      for (let i = hextetCount; i < 8; i++) expanded.push("0");
      for (let i = left.length; i < parts.length; i++) expanded.push(parts[i]);
      return compressIPv6ZeroRun(expanded);
    }
    function normalizeIPv6(host) {
      const bracketed = host[0] === "[" && host[host.length - 1] === "]";
      const hasBracket = host[0] === "[" || host[host.length - 1] === "]";
      if (hasBracket && !bracketed) return { host, isIPV6: false, error: true };
      let input = bracketed ? host.slice(1, -1) : host;
      if (bracketed && isIPvFuture(input)) {
        input = input.toLowerCase();
        return { host: `[${input}]`, escapedHost: input, isIPV6: false, isIPVFuture: true };
      }
      if (findToken(input, ":") < 2) {
        return { host, isIPV6: false, error: bracketed };
      }
      let zoneIdentifier = "";
      const zoneSeparator = input.indexOf("%");
      if (zoneSeparator !== -1) {
        const separatorLength = input.slice(zoneSeparator, zoneSeparator + 3).toLowerCase() === "%25" ? 3 : 1;
        zoneIdentifier = input.slice(zoneSeparator + separatorLength);
        if (!isZoneIdentifier(zoneIdentifier)) return { host, isIPV6: false, error: true };
        input = input.slice(0, zoneSeparator);
      }
      const address = normalizeIPv6Address(input);
      if (address === void 0) return { host, isIPV6: false, error: true };
      return {
        host: address + (zoneIdentifier ? "%" + zoneIdentifier : ""),
        escapedHost: address + (zoneIdentifier ? "%25" + zoneIdentifier : ""),
        isIPV6: true
      };
    }
    function findToken(str, token) {
      let ind = 0;
      for (let i = 0; i < str.length; i++) {
        if (str[i] === token) ind++;
      }
      return ind;
    }
    function removeDotSegments(path) {
      let input = path;
      const output = [];
      let nextSlash = -1;
      let len = 0;
      while (len = input.length) {
        if (len === 1) {
          if (input === ".") {
            break;
          } else if (input === "/") {
            output.push("/");
            break;
          } else {
            output.push(input);
            break;
          }
        } else if (len === 2) {
          if (input[0] === ".") {
            if (input[1] === ".") {
              break;
            } else if (input[1] === "/") {
              input = input.slice(2);
              continue;
            }
          } else if (input[0] === "/") {
            if (input[1] === "." || input[1] === "/") {
              output.push("/");
              break;
            }
          }
        } else if (len === 3) {
          if (input === "/..") {
            if (output.length !== 0) {
              output.pop();
            }
            output.push("/");
            break;
          }
        }
        if (input[0] === ".") {
          if (input[1] === ".") {
            if (input[2] === "/") {
              input = input.slice(3);
              continue;
            }
          } else if (input[1] === "/") {
            input = input.slice(2);
            continue;
          }
        } else if (input[0] === "/") {
          if (input[1] === ".") {
            if (input[2] === "/") {
              input = input.slice(2);
              continue;
            } else if (input[2] === ".") {
              if (input[3] === "/") {
                input = input.slice(3);
                if (output.length !== 0) {
                  output.pop();
                }
                continue;
              }
            }
          }
        }
        if ((nextSlash = input.indexOf("/", 1)) === -1) {
          output.push(input);
          break;
        } else {
          output.push(input.slice(0, nextSlash));
          input = input.slice(nextSlash);
        }
      }
      return output.join("");
    }
    var HOST_DELIMS = { "@": "%40", "/": "%2F", "?": "%3F", "#": "%23", ":": "%3A" };
    var HOST_DELIM_RE = /[@/?#:]/g;
    var HOST_DELIM_NO_COLON_RE = /[@/?#]/g;
    function reescapeHostDelimiters(host, isIP) {
      const re = isIP ? HOST_DELIM_NO_COLON_RE : HOST_DELIM_RE;
      re.lastIndex = 0;
      return host.replace(re, (ch) => HOST_DELIMS[ch]);
    }
    function normalizePercentEncoding(input, decodeUnreserved = false) {
      if (input.indexOf("%") === -1) {
        return input;
      }
      let output = "";
      for (let i = 0; i < input.length; i++) {
        if (input[i] === "%" && i + 2 < input.length) {
          const hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            const normalizedHex = hex.toUpperCase();
            const decoded = String.fromCharCode(parseInt(normalizedHex, 16));
            if (decodeUnreserved && isUnreserved(decoded)) {
              output += decoded;
            } else {
              output += "%" + normalizedHex;
            }
            i += 2;
            continue;
          }
        }
        output += input[i];
      }
      return output;
    }
    function normalizePathEncoding(input) {
      let output = "";
      for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        if (ch === "%" && i + 2 < input.length) {
          const hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            const normalizedHex = hex.toUpperCase();
            const decoded = String.fromCharCode(parseInt(normalizedHex, 16));
            if (decoded !== "." && isUnreserved(decoded)) {
              output += decoded;
            } else {
              output += "%" + normalizedHex;
            }
            i += 2;
            continue;
          }
        }
        if (isPathCharacter(ch)) {
          output += ch;
        } else {
          const code = input.charCodeAt(i);
          if (code < 128) {
            output += isEscapeSafe(code) ? ch : BYTE_HEX[code];
          } else if (code < 55296 || code > 57343) {
            output += percentEncodeNonAscii(code);
          } else if (code <= 56319 && i + 1 < input.length) {
            const low = input.charCodeAt(i + 1);
            if (low >= 56320 && low <= 57343) {
              output += percentEncodeNonAscii(65536 + (code - 55296 << 10) + (low - 56320));
              i++;
            } else {
              output += percentEncodeNonAscii(65533);
            }
          } else {
            output += percentEncodeNonAscii(65533);
          }
        }
      }
      return output;
    }
    function serializePathEncoding(input, pathNoScheme = false) {
      let output = "";
      let firstSegment = pathNoScheme && input[0] !== "/";
      for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        if (ch === "%" && i + 2 < input.length) {
          const hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            output += "%" + hex.toUpperCase();
            i += 2;
            continue;
          }
        }
        if (ch === "/") {
          firstSegment = false;
        }
        if (isPathCharacter(ch) && (ch !== ":" || !firstSegment)) {
          output += ch;
        } else {
          const code = input.charCodeAt(i);
          if (code < 128) {
            output += BYTE_HEX[code];
          } else if (code < 55296 || code > 57343) {
            output += percentEncodeNonAscii(code);
          } else if (code <= 56319 && i + 1 < input.length) {
            const low = input.charCodeAt(i + 1);
            if (low >= 56320 && low <= 57343) {
              output += percentEncodeNonAscii(65536 + (code - 55296 << 10) + (low - 56320));
              i++;
            } else {
              output += percentEncodeNonAscii(65533);
            }
          } else {
            output += percentEncodeNonAscii(65533);
          }
        }
      }
      return output;
    }
    function encodeComponent(input, isAllowed) {
      let output = "";
      for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        if (ch === "%" && i + 2 < input.length) {
          const hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            output += "%" + hex.toUpperCase();
            i += 2;
            continue;
          }
        }
        if (isAllowed(ch)) {
          output += ch;
        } else {
          const code = input.charCodeAt(i);
          if (code < 128) {
            output += BYTE_HEX[code];
          } else if (code < 55296 || code > 57343) {
            output += percentEncodeNonAscii(code);
          } else if (code <= 56319 && i + 1 < input.length) {
            const low = input.charCodeAt(i + 1);
            if (low >= 56320 && low <= 57343) {
              output += percentEncodeNonAscii(65536 + (code - 55296 << 10) + (low - 56320));
              i++;
            } else {
              output += percentEncodeNonAscii(65533);
            }
          } else {
            output += percentEncodeNonAscii(65533);
          }
        }
      }
      return output;
    }
    function encodeUserinfo(input) {
      return encodeComponent(input, isUserinfoCharacter);
    }
    function encodeQuery(input) {
      return encodeComponent(input, isQueryFragmentCharacter);
    }
    function encodeFragment(input) {
      return encodeComponent(input, isQueryFragmentCharacter);
    }
    function isEscapeSafe(cp) {
      return cp >= 48 && cp <= 57 || cp >= 65 && cp <= 90 || cp >= 97 && cp <= 122 || cp === 42 || cp === 43 || cp === 45 || cp === 46 || cp === 47 || cp === 64 || cp === 95;
    }
    function normalizeQueryFragmentEncoding(input) {
      let output = "";
      for (let i = 0; i < input.length; i++) {
        const ch = input[i];
        if (ch === "%" && i + 2 < input.length) {
          const hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            const normalizedHex = hex.toUpperCase();
            const decoded = String.fromCharCode(parseInt(normalizedHex, 16));
            if (isUnreserved(decoded)) {
              output += decoded;
            } else {
              output += "%" + normalizedHex;
            }
            i += 2;
            continue;
          }
        }
        if (isQueryFragmentCharacter(ch)) {
          output += ch;
        } else {
          const code = input.charCodeAt(i);
          if (code < 128) {
            output += isEscapeSafe(code) ? ch : BYTE_HEX[code];
          } else if (code < 55296 || code > 57343) {
            output += percentEncodeNonAscii(code);
          } else if (code <= 56319 && i + 1 < input.length) {
            const low = input.charCodeAt(i + 1);
            if (low >= 56320 && low <= 57343) {
              output += percentEncodeNonAscii(65536 + (code - 55296 << 10) + (low - 56320));
              i++;
            } else {
              output += percentEncodeNonAscii(65533);
            }
          } else {
            output += percentEncodeNonAscii(65533);
          }
        }
      }
      return output;
    }
    function escapePreservingEscapes(input) {
      let output = "";
      for (let i = 0; i < input.length; i++) {
        if (input[i] === "%" && i + 2 < input.length) {
          const hex = input.slice(i + 1, i + 3);
          if (isHexPair(hex)) {
            output += "%" + hex.toUpperCase();
            i += 2;
            continue;
          }
        }
        output += escape(input[i]);
      }
      return output;
    }
    function recomposeAuthority(component) {
      const uriTokens = [];
      if (component.userinfo !== void 0) {
        uriTokens.push(encodeUserinfo(component.userinfo));
        uriTokens.push("@");
      }
      if (component.host !== void 0) {
        let host = component.host;
        if (!isIPv4(host)) {
          let ipV6res = normalizeIPv6(host);
          if (ipV6res.isIPV6 !== true && ipV6res.isIPVFuture !== true) {
            host = normalizePercentEncoding(host, true);
            ipV6res = normalizeIPv6(host);
          }
          if (ipV6res.isIPV6 === true || ipV6res.isIPVFuture === true) {
            host = `[${ipV6res.escapedHost}]`;
          } else {
            host = reescapeHostDelimiters(host, false);
          }
        }
        uriTokens.push(host);
      }
      if (typeof component.port === "number" || typeof component.port === "string") {
        uriTokens.push(":");
        uriTokens.push(String(component.port));
      }
      return uriTokens.length ? uriTokens.join("") : void 0;
    }
    module.exports = {
      nonSimpleDomain,
      recomposeAuthority,
      reescapeHostDelimiters,
      normalizePercentEncoding,
      normalizePathEncoding,
      serializePathEncoding,
      normalizeQueryFragmentEncoding,
      encodeUserinfo,
      encodeQuery,
      encodeFragment,
      escapePreservingEscapes,
      removeDotSegments,
      isIPv4,
      isUUID,
      normalizeIPv6,
      stringArrayToHexStripped
    };
  }
});

// node_modules/fast-uri/lib/schemes.js
var require_schemes = __commonJS({
  "node_modules/fast-uri/lib/schemes.js"(exports, module) {
    "use strict";
    var { isUUID } = require_utils();
    var URN_REG = /^([\da-z][\d\-a-z]{0,31}):((?:[\w!$'()*+,\-./:;=@]|%[\da-f]{2})+)$/iu;
    var supportedSchemeNames = (
      /** @type {const} */
      [
        "http",
        "https",
        "ws",
        "wss",
        "urn",
        "urn:uuid"
      ]
    );
    function isValidSchemeName(name) {
      return supportedSchemeNames.indexOf(
        /** @type {*} */
        name
      ) !== -1;
    }
    function wsIsSecure(wsComponent) {
      if (wsComponent.secure === true) {
        return true;
      } else if (wsComponent.secure === false) {
        return false;
      } else if (wsComponent.scheme) {
        return wsComponent.scheme.length === 3 && (wsComponent.scheme[0] === "w" || wsComponent.scheme[0] === "W") && (wsComponent.scheme[1] === "s" || wsComponent.scheme[1] === "S") && (wsComponent.scheme[2] === "s" || wsComponent.scheme[2] === "S");
      } else {
        return false;
      }
    }
    function httpParse(component) {
      if (!component.host) {
        component.error = component.error || "HTTP URIs must have a host.";
      }
      return component;
    }
    function httpSerialize(component) {
      const secure = String(component.scheme).toLowerCase() === "https";
      if (component.port === (secure ? 443 : 80) || component.port === "") {
        component.port = void 0;
      }
      if (!component.path) {
        component.path = "/";
      }
      return component;
    }
    function wsParse(wsComponent) {
      wsComponent.secure = wsIsSecure(wsComponent);
      wsComponent.resourceName = (wsComponent.path || "/") + (wsComponent.query ? "?" + wsComponent.query : "");
      wsComponent.path = void 0;
      wsComponent.query = void 0;
      return wsComponent;
    }
    function wsSerialize(wsComponent) {
      if (wsComponent.port === (wsIsSecure(wsComponent) ? 443 : 80) || wsComponent.port === "") {
        wsComponent.port = void 0;
      }
      if (typeof wsComponent.secure === "boolean") {
        wsComponent.scheme = wsComponent.secure ? "wss" : "ws";
        wsComponent.secure = void 0;
      }
      if (wsComponent.resourceName) {
        const queryIndex = wsComponent.resourceName.indexOf("?");
        const path = queryIndex === -1 ? wsComponent.resourceName : wsComponent.resourceName.slice(0, queryIndex);
        wsComponent.path = path && path !== "/" ? path : void 0;
        wsComponent.query = queryIndex === -1 ? void 0 : wsComponent.resourceName.slice(queryIndex + 1);
        wsComponent.resourceName = void 0;
      }
      wsComponent.fragment = void 0;
      return wsComponent;
    }
    function urnParse(urnComponent, options) {
      if (!urnComponent.path) {
        urnComponent.error = "URN can not be parsed";
        return urnComponent;
      }
      const matches = urnComponent.path.match(URN_REG);
      if (matches && matches[0] === urnComponent.path) {
        const scheme = options.scheme || urnComponent.scheme || "urn";
        urnComponent.nid = matches[1].toLowerCase();
        urnComponent.nss = matches[2];
        const urnScheme = `${scheme}:${options.nid || urnComponent.nid}`;
        const schemeHandler = getSchemeHandler(urnScheme);
        urnComponent.path = void 0;
        if (schemeHandler) {
          urnComponent = schemeHandler.parse(urnComponent, options);
        }
      } else {
        urnComponent.error = urnComponent.error || "URN can not be parsed.";
      }
      return urnComponent;
    }
    function urnSerialize(urnComponent, options) {
      if (urnComponent.nid === void 0) {
        throw new Error("URN without nid cannot be serialized");
      }
      const scheme = options.scheme || urnComponent.scheme || "urn";
      const nid = urnComponent.nid.toLowerCase();
      const urnScheme = `${scheme}:${options.nid || nid}`;
      const schemeHandler = getSchemeHandler(urnScheme);
      if (schemeHandler) {
        urnComponent = schemeHandler.serialize(urnComponent, options);
      }
      const uriComponent = urnComponent;
      const nss = urnComponent.nss;
      uriComponent.path = `${nid || options.nid}:${nss}`;
      options.skipEscape = true;
      return uriComponent;
    }
    function urnuuidParse(urnComponent, options) {
      const uuidComponent = urnComponent;
      uuidComponent.uuid = uuidComponent.nss;
      uuidComponent.nss = void 0;
      if (!options.tolerant && (!uuidComponent.uuid || !isUUID(uuidComponent.uuid))) {
        uuidComponent.error = uuidComponent.error || "UUID is not valid.";
      }
      return uuidComponent;
    }
    function urnuuidSerialize(uuidComponent) {
      const urnComponent = uuidComponent;
      urnComponent.nss = (uuidComponent.uuid || "").toLowerCase();
      return urnComponent;
    }
    var http = (
      /** @type {SchemeHandler} */
      {
        scheme: "http",
        domainHost: true,
        parse: httpParse,
        serialize: httpSerialize
      }
    );
    var https = (
      /** @type {SchemeHandler} */
      {
        scheme: "https",
        domainHost: http.domainHost,
        parse: httpParse,
        serialize: httpSerialize
      }
    );
    var ws = (
      /** @type {SchemeHandler} */
      {
        scheme: "ws",
        domainHost: true,
        parse: wsParse,
        serialize: wsSerialize
      }
    );
    var wss = (
      /** @type {SchemeHandler} */
      {
        scheme: "wss",
        domainHost: ws.domainHost,
        parse: ws.parse,
        serialize: ws.serialize
      }
    );
    var urn = (
      /** @type {SchemeHandler} */
      {
        scheme: "urn",
        parse: urnParse,
        serialize: urnSerialize,
        skipNormalize: true
      }
    );
    var urnuuid = (
      /** @type {SchemeHandler} */
      {
        scheme: "urn:uuid",
        parse: urnuuidParse,
        serialize: urnuuidSerialize,
        skipNormalize: true
      }
    );
    var SCHEMES = (
      /** @type {Record<SchemeName, SchemeHandler>} */
      {
        http,
        https,
        ws,
        wss,
        urn,
        "urn:uuid": urnuuid
      }
    );
    Object.setPrototypeOf(SCHEMES, null);
    function getSchemeHandler(scheme) {
      return scheme && (SCHEMES[
        /** @type {SchemeName} */
        scheme
      ] || SCHEMES[
        /** @type {SchemeName} */
        scheme.toLowerCase()
      ]) || void 0;
    }
    module.exports = {
      wsIsSecure,
      SCHEMES,
      isValidSchemeName,
      getSchemeHandler
    };
  }
});

// node_modules/fast-uri/index.js
var require_fast_uri = __commonJS({
  "node_modules/fast-uri/index.js"(exports, module) {
    "use strict";
    var { normalizeIPv6, removeDotSegments, recomposeAuthority, normalizePercentEncoding, normalizePathEncoding, serializePathEncoding, normalizeQueryFragmentEncoding, encodeQuery, encodeFragment, reescapeHostDelimiters, isIPv4, nonSimpleDomain } = require_utils();
    var { SCHEMES, getSchemeHandler } = require_schemes();
    var VALID_SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*$/u;
    var MALFORMED_SCHEME_ERROR = "URI scheme is malformed.";
    function decodeValidScheme(scheme) {
      const decodedScheme = unescape(String(scheme));
      if (!VALID_SCHEME.test(decodedScheme)) {
        throw new TypeError(MALFORMED_SCHEME_ERROR);
      }
      return decodedScheme;
    }
    function normalize(uri, options) {
      if (typeof uri === "string") {
        uri = /** @type {T} */
        normalizeString(uri, options);
      } else if (typeof uri === "object") {
        uri = /** @type {T} */
        parse(serialize(uri, options), options);
      }
      return uri;
    }
    function resolve3(baseURI, relativeURI, options) {
      const schemelessOptions = options ? Object.assign({ scheme: "null" }, options) : { scheme: "null" };
      const {
        parsed: baseParsed,
        malformedAuthorityOrPort: baseMalformed,
        malformedPercentEncoding: baseMalformedPercentEncoding,
        malformedSchemeSpecific: baseMalformedSchemeSpecific,
        malformedHost: baseMalformedHost,
        malformedScheme: baseMalformedScheme
      } = parseWithStatus(baseURI, schemelessOptions);
      const {
        parsed: relativeParsed,
        malformedAuthorityOrPort: relativeMalformed,
        malformedPercentEncoding: relativeMalformedPercentEncoding,
        malformedSchemeSpecific: relativeMalformedSchemeSpecific,
        malformedHost: relativeMalformedHost,
        malformedScheme: relativeMalformedScheme
      } = parseWithStatus(relativeURI, schemelessOptions);
      if (baseMalformed || relativeMalformed || baseMalformedPercentEncoding || relativeMalformedPercentEncoding || baseMalformedSchemeSpecific || relativeMalformedSchemeSpecific || baseMalformedHost || relativeMalformedHost || baseMalformedScheme || relativeMalformedScheme) {
        throw new Error(baseParsed.error || relativeParsed.error || "URI is malformed.");
      }
      const resolved = resolveComponent(baseParsed, relativeParsed, schemelessOptions, true);
      const resolvedSchemeHandler = getSchemeHandler(options && options.scheme || resolved.scheme);
      const resolvedHost = resolved.host;
      const resolvedHostIsIP = resolvedHost !== void 0 && resolvedHost !== "" && (isIPv4(resolvedHost) || normalizeIPv6(resolvedHost).isIPV6);
      canonicalizeHost(resolved, options || {}, resolvedSchemeHandler, resolvedHostIsIP);
      const encodedASCIIHost = resolvedHost && resolvedHost.indexOf("%") !== -1 && !new RegExp("\\P{ASCII}", "u").test(resolvedHost);
      if (resolved.error && !encodedASCIIHost) {
        throw new Error(resolved.error);
      }
      schemelessOptions.skipEscape = true;
      return serialize(resolved, schemelessOptions);
    }
    function resolveComponent(base, relative, options, skipNormalization) {
      const target = {};
      if (!skipNormalization) {
        base = parse(serialize(base, options), options);
        relative = parse(serialize(relative, options), options);
      }
      options = options || {};
      if (!options.tolerant && relative.scheme) {
        target.scheme = relative.scheme;
        target.userinfo = relative.userinfo;
        target.host = relative.host;
        target.port = relative.port;
        target.path = removeDotSegments(relative.path || "");
        target.query = relative.query;
      } else {
        if (relative.userinfo !== void 0 || relative.host !== void 0 || relative.port !== void 0) {
          target.userinfo = relative.userinfo;
          target.host = relative.host;
          target.port = relative.port;
          target.path = removeDotSegments(relative.path || "");
          target.query = relative.query;
        } else {
          if (!relative.path) {
            target.path = base.path;
            if (relative.query !== void 0) {
              target.query = relative.query;
            } else {
              target.query = base.query;
            }
          } else {
            if (relative.path[0] === "/") {
              target.path = removeDotSegments(relative.path);
            } else {
              if ((base.userinfo !== void 0 || base.host !== void 0 || base.port !== void 0) && !base.path) {
                target.path = "/" + relative.path;
              } else if (!base.path) {
                target.path = relative.path;
              } else {
                target.path = base.path.slice(0, base.path.lastIndexOf("/") + 1) + relative.path;
              }
              target.path = removeDotSegments(target.path);
            }
            target.query = relative.query;
          }
          target.userinfo = base.userinfo;
          target.host = base.host;
          target.port = base.port;
        }
        target.scheme = base.scheme;
      }
      target.fragment = relative.fragment;
      return target;
    }
    function equal(uriA, uriB, options) {
      const normalizedA = normalizeComparableURI(uriA, options);
      const normalizedB = normalizeComparableURI(uriB, options);
      return normalizedA !== void 0 && normalizedB !== void 0 && normalizedA === normalizedB;
    }
    function serialize(cmpts, opts) {
      const component = {
        host: cmpts.host,
        scheme: cmpts.scheme,
        userinfo: cmpts.userinfo,
        port: cmpts.port,
        path: cmpts.path,
        query: cmpts.query,
        nid: cmpts.nid,
        nss: cmpts.nss,
        uuid: cmpts.uuid,
        fragment: cmpts.fragment,
        reference: cmpts.reference,
        resourceName: cmpts.resourceName,
        secure: cmpts.secure,
        error: ""
      };
      const options = Object.assign({}, opts);
      const uriTokens = [];
      if (component.scheme) {
        component.scheme = decodeValidScheme(component.scheme);
      }
      const schemeHandler = getSchemeHandler(options.scheme || component.scheme);
      if (schemeHandler && schemeHandler.serialize) schemeHandler.serialize(component, options);
      const hasAuthority = component.userinfo !== void 0 || component.host !== void 0 || component.port !== void 0;
      const pathNoScheme = !options.skipEscape && component.scheme === void 0 && !hasAuthority;
      if (component.path !== void 0) {
        if (!options.skipEscape) {
          component.path = serializePathEncoding(component.path, pathNoScheme);
        } else {
          component.path = normalizePercentEncoding(component.path);
        }
      }
      if (options.reference !== "suffix" && component.scheme) {
        component.scheme = decodeValidScheme(component.scheme);
        uriTokens.push(component.scheme, ":");
      }
      const authority = recomposeAuthority(component);
      if (authority !== void 0) {
        if (options.reference !== "suffix") {
          uriTokens.push("//");
        }
        uriTokens.push(authority);
        if (component.path && component.path[0] !== "/") {
          uriTokens.push("/");
        }
      }
      if (component.path !== void 0) {
        let s = component.path;
        if (!options.absolutePath && (!schemeHandler || !schemeHandler.absolutePath)) {
          s = removeDotSegments(s);
        }
        if (pathNoScheme) {
          s = serializePathEncoding(s, true);
        }
        if (authority === void 0 && s[0] === "/" && s[1] === "/") {
          s = "/%2F" + s.slice(2);
        }
        uriTokens.push(s);
      }
      if (component.query !== void 0) {
        uriTokens.push("?", encodeQuery(component.query));
      }
      if (component.fragment !== void 0) {
        uriTokens.push("#", encodeFragment(component.fragment));
      }
      return uriTokens.join("");
    }
    var URI_PARSE = /^(?:([^#/:?]+):)?(?:\/\/((?:([^#/?@]*)@)?(\[[^#/?\]]+\]|[^#/:?]*)(?::(\d*))?))?([^#?]*)(?:\?([^#]*))?(?:#((?:.|[\n\r])*))?/u;
    var AUTHORITY_PREFIX = /^(?:[^#/:?]+:)?\/\/([^/?#]*)/;
    var AUTHORITY_INTRODUCER_REGION = /^(?:[^#/:?]+:)?([/\\\t\n\r]*)/;
    function getParseError(parsed, matches) {
      if (matches[2] !== void 0 && parsed.path && parsed.path[0] !== "/") {
        return 'URI path must start with "/" when authority is present.';
      }
      if (typeof parsed.port === "number" && (parsed.port < 0 || parsed.port > 65535)) {
        return "URI port is malformed.";
      }
      return void 0;
    }
    function hasMalformedPercentEncoding(component) {
      if (component === void 0) return false;
      let percent = component.indexOf("%");
      while (percent !== -1) {
        if (percent + 2 >= component.length || !/^[\da-f]{2}$/iu.test(component.slice(percent + 1, percent + 3))) {
          return true;
        }
        percent = component.indexOf("%", percent + 3);
      }
      return false;
    }
    function hasMalformedComponentPercentEncoding(matches) {
      const host = matches[4];
      return hasMalformedPercentEncoding(matches[3]) || host !== void 0 && !(host[0] === "[" && host[host.length - 1] === "]") && hasMalformedPercentEncoding(host) || hasMalformedPercentEncoding(matches[6]) || hasMalformedPercentEncoding(matches[7]) || hasMalformedPercentEncoding(matches[8]);
    }
    function canonicalizeHost(parsed, options, schemeHandler, isIP) {
      if (!options.unicodeSupport && (!schemeHandler || !schemeHandler.unicodeSupport) && parsed.host && parsed.host[0] !== "[" && (options.domainHost || schemeHandler && schemeHandler.domainHost) && isIP === false && nonSimpleDomain(parsed.host)) {
        try {
          parsed.host = new URL("http://" + parsed.host).hostname;
        } catch (e) {
          parsed.error = parsed.error || "Host's domain name can not be converted to ASCII: " + e;
          return true;
        }
      }
      return false;
    }
    function parseWithStatus(uri, opts) {
      const options = Object.assign({}, opts);
      const parsed = {
        scheme: void 0,
        userinfo: void 0,
        host: "",
        port: void 0,
        path: "",
        query: void 0,
        fragment: void 0
      };
      let malformedAuthorityOrPort = false;
      let malformedPercentEncoding = false;
      let malformedSchemeSpecific = false;
      let malformedHost = false;
      let malformedIPLiteral = false;
      let malformedScheme = false;
      let isIP = false;
      if (options.reference === "suffix") {
        if (options.scheme) {
          uri = options.scheme + ":" + uri;
        } else {
          uri = "//" + uri;
        }
      }
      const authorityMatch = uri.match(AUTHORITY_PREFIX);
      if (authorityMatch !== null && authorityMatch[1].indexOf("\\") !== -1) {
        parsed.error = "URI authority must not contain a literal backslash.";
        malformedAuthorityOrPort = true;
      }
      const introducerMatch = uri.match(AUTHORITY_INTRODUCER_REGION);
      if (introducerMatch !== null) {
        const region = introducerMatch[1];
        const normalizedRegion = region.replace(/[\t\n\r]/g, "");
        if (normalizedRegion.length >= 2) {
          if (normalizedRegion.slice(0, 2) !== "//") {
            parsed.error = parsed.error || "URI authority must not contain a literal backslash.";
            malformedAuthorityOrPort = true;
          } else if (region.length !== normalizedRegion.length) {
            parsed.error = parsed.error || "URI authority introducer must not contain whitespace.";
            malformedAuthorityOrPort = true;
          }
        }
      }
      const matches = uri.match(URI_PARSE);
      if (matches) {
        parsed.scheme = matches[1];
        parsed.userinfo = matches[3];
        parsed.host = matches[4];
        parsed.port = parseInt(matches[5], 10);
        parsed.path = matches[6] || "";
        parsed.query = matches[7];
        parsed.fragment = matches[8];
        if (parsed.scheme !== void 0) {
          const decodedScheme = unescape(parsed.scheme);
          if (VALID_SCHEME.test(decodedScheme)) {
            parsed.scheme = decodedScheme.toLowerCase();
          } else {
            parsed.error = parsed.error || MALFORMED_SCHEME_ERROR;
            malformedScheme = true;
          }
        }
        malformedPercentEncoding = hasMalformedComponentPercentEncoding(matches);
        if (malformedPercentEncoding) {
          parsed.error = parsed.error || "URI contains malformed percent-encoding.";
        }
        if (isNaN(parsed.port)) {
          parsed.port = matches[5];
        }
        const parseError = getParseError(parsed, matches);
        if (parseError !== void 0) {
          parsed.error = parsed.error || parseError;
          malformedAuthorityOrPort = true;
        }
        if (parsed.host) {
          const ipv4result = isIPv4(parsed.host);
          if (ipv4result === false) {
            const bracketedIPLiteral = parsed.host[0] === "[" && parsed.host[parsed.host.length - 1] === "]";
            const ipv6result = normalizeIPv6(parsed.host);
            isIP = ipv6result.isIPV6 || ipv6result.isIPVFuture === true;
            malformedIPLiteral = bracketedIPLiteral && ipv6result.error === true;
            parsed.host = isIP ? ipv6result.host : ipv6result.host.toLowerCase();
            if (malformedIPLiteral) {
              parsed.error = parsed.error || "URI host is malformed.";
              malformedAuthorityOrPort = true;
            }
          } else {
            isIP = true;
          }
        }
        if (parsed.scheme === void 0 && parsed.userinfo === void 0 && parsed.host === void 0 && parsed.port === void 0 && parsed.query === void 0 && !parsed.path) {
          parsed.reference = "same-document";
        } else if (parsed.scheme === void 0) {
          parsed.reference = "relative";
        } else if (parsed.fragment === void 0) {
          parsed.reference = "absolute";
        } else {
          parsed.reference = "uri";
        }
        if (options.reference && options.reference !== "suffix" && options.reference !== parsed.reference) {
          parsed.error = parsed.error || "URI is not a " + options.reference + " reference.";
        }
        const schemeHandler = getSchemeHandler(options.scheme || parsed.scheme);
        malformedHost = canonicalizeHost(parsed, options, schemeHandler, isIP);
        if (!schemeHandler || schemeHandler && !schemeHandler.skipNormalize) {
          if (uri.indexOf("%") !== -1) {
            if (parsed.host !== void 0 && !malformedIPLiteral) {
              const host = isIP ? parsed.host : normalizePercentEncoding(parsed.host, true);
              parsed.host = reescapeHostDelimiters(host, isIP);
            }
          }
          if (parsed.path) {
            parsed.path = normalizePathEncoding(parsed.path);
          }
          if (parsed.query) {
            parsed.query = normalizeQueryFragmentEncoding(parsed.query);
          }
          if (parsed.fragment) {
            parsed.fragment = normalizeQueryFragmentEncoding(parsed.fragment);
          }
        }
        if (schemeHandler && schemeHandler.parse) {
          schemeHandler.parse(parsed, options);
          if (schemeHandler === SCHEMES.urn && parsed.nid === void 0) {
            malformedSchemeSpecific = true;
          }
        }
      } else {
        parsed.error = parsed.error || "URI can not be parsed.";
      }
      return { parsed, malformedAuthorityOrPort, malformedPercentEncoding, malformedSchemeSpecific, malformedHost, malformedScheme };
    }
    function parse(uri, opts) {
      return parseWithStatus(uri, opts).parsed;
    }
    function normalizeString(uri, opts) {
      return normalizeStringWithStatus(uri, opts).normalized;
    }
    function normalizeStringWithStatus(uri, opts) {
      const { parsed, malformedAuthorityOrPort, malformedPercentEncoding, malformedSchemeSpecific, malformedHost, malformedScheme } = parseWithStatus(uri, opts);
      return {
        normalized: malformedAuthorityOrPort || malformedPercentEncoding || malformedSchemeSpecific || malformedHost || malformedScheme ? uri : serialize(parsed, opts),
        malformedAuthorityOrPort,
        malformedPercentEncoding,
        malformedSchemeSpecific,
        malformedHost,
        malformedScheme
      };
    }
    function normalizeComparableURI(uri, opts) {
      if (typeof uri !== "string" && typeof uri !== "object") {
        return void 0;
      }
      let value;
      try {
        value = typeof uri === "string" ? uri : serialize(uri, opts);
      } catch {
        return void 0;
      }
      const { normalized, malformedAuthorityOrPort, malformedPercentEncoding, malformedSchemeSpecific, malformedHost, malformedScheme } = normalizeStringWithStatus(value, opts);
      return malformedAuthorityOrPort || malformedPercentEncoding || malformedSchemeSpecific || malformedHost || malformedScheme ? void 0 : normalized;
    }
    var fastUri = {
      SCHEMES,
      normalize,
      resolve: resolve3,
      resolveComponent,
      equal,
      serialize,
      parse
    };
    module.exports = fastUri;
    module.exports.default = fastUri;
    module.exports.fastUri = fastUri;
  }
});

// node_modules/ajv/dist/runtime/uri.js
var require_uri = __commonJS({
  "node_modules/ajv/dist/runtime/uri.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var uri = require_fast_uri();
    uri.code = 'require("ajv/dist/runtime/uri").default';
    exports.default = uri;
  }
});

// node_modules/ajv/dist/core.js
var require_core = __commonJS({
  "node_modules/ajv/dist/core.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.CodeGen = exports.Name = exports.nil = exports.stringify = exports.str = exports._ = exports.KeywordCxt = void 0;
    var validate_1 = require_validate();
    Object.defineProperty(exports, "KeywordCxt", { enumerable: true, get: function() {
      return validate_1.KeywordCxt;
    } });
    var codegen_1 = require_codegen();
    Object.defineProperty(exports, "_", { enumerable: true, get: function() {
      return codegen_1._;
    } });
    Object.defineProperty(exports, "str", { enumerable: true, get: function() {
      return codegen_1.str;
    } });
    Object.defineProperty(exports, "stringify", { enumerable: true, get: function() {
      return codegen_1.stringify;
    } });
    Object.defineProperty(exports, "nil", { enumerable: true, get: function() {
      return codegen_1.nil;
    } });
    Object.defineProperty(exports, "Name", { enumerable: true, get: function() {
      return codegen_1.Name;
    } });
    Object.defineProperty(exports, "CodeGen", { enumerable: true, get: function() {
      return codegen_1.CodeGen;
    } });
    var validation_error_1 = require_validation_error();
    var ref_error_1 = require_ref_error();
    var rules_1 = require_rules();
    var compile_1 = require_compile();
    var codegen_2 = require_codegen();
    var resolve_1 = require_resolve();
    var dataType_1 = require_dataType();
    var util_1 = require_util();
    var $dataRefSchema = require_data();
    var uri_1 = require_uri();
    var defaultRegExp = (str, flags) => new RegExp(str, flags);
    defaultRegExp.code = "new RegExp";
    var META_IGNORE_OPTIONS = ["removeAdditional", "useDefaults", "coerceTypes"];
    var EXT_SCOPE_NAMES = /* @__PURE__ */ new Set([
      "validate",
      "serialize",
      "parse",
      "wrapper",
      "root",
      "schema",
      "keyword",
      "pattern",
      "formats",
      "validate$data",
      "func",
      "obj",
      "Error"
    ]);
    var removedOptions = {
      errorDataPath: "",
      format: "`validateFormats: false` can be used instead.",
      nullable: '"nullable" keyword is supported by default.',
      jsonPointers: "Deprecated jsPropertySyntax can be used instead.",
      extendRefs: "Deprecated ignoreKeywordsWithRef can be used instead.",
      missingRefs: "Pass empty schema with $id that should be ignored to ajv.addSchema.",
      processCode: "Use option `code: {process: (code, schemaEnv: object) => string}`",
      sourceCode: "Use option `code: {source: true}`",
      strictDefaults: "It is default now, see option `strict`.",
      strictKeywords: "It is default now, see option `strict`.",
      uniqueItems: '"uniqueItems" keyword is always validated.',
      unknownFormats: "Disable strict mode or pass `true` to `ajv.addFormat` (or `formats` option).",
      cache: "Map is used as cache, schema object as key.",
      serialize: "Map is used as cache, schema object as key.",
      ajvErrors: "It is default now."
    };
    var deprecatedOptions = {
      ignoreKeywordsWithRef: "",
      jsPropertySyntax: "",
      unicode: '"minLength"/"maxLength" account for unicode characters by default.'
    };
    var MAX_EXPRESSION = 200;
    function requiredOptions(o) {
      var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t, _u, _v, _w, _x, _y, _z, _0;
      const s = o.strict;
      const _optz = (_a = o.code) === null || _a === void 0 ? void 0 : _a.optimize;
      const optimize = _optz === true || _optz === void 0 ? 1 : _optz || 0;
      const regExp = (_c = (_b = o.code) === null || _b === void 0 ? void 0 : _b.regExp) !== null && _c !== void 0 ? _c : defaultRegExp;
      const uriResolver = (_d = o.uriResolver) !== null && _d !== void 0 ? _d : uri_1.default;
      return {
        strictSchema: (_f = (_e = o.strictSchema) !== null && _e !== void 0 ? _e : s) !== null && _f !== void 0 ? _f : true,
        strictNumbers: (_h = (_g = o.strictNumbers) !== null && _g !== void 0 ? _g : s) !== null && _h !== void 0 ? _h : true,
        strictTypes: (_k = (_j = o.strictTypes) !== null && _j !== void 0 ? _j : s) !== null && _k !== void 0 ? _k : "log",
        strictTuples: (_m = (_l = o.strictTuples) !== null && _l !== void 0 ? _l : s) !== null && _m !== void 0 ? _m : "log",
        strictRequired: (_p = (_o = o.strictRequired) !== null && _o !== void 0 ? _o : s) !== null && _p !== void 0 ? _p : false,
        code: o.code ? { ...o.code, optimize, regExp } : { optimize, regExp },
        loopRequired: (_q = o.loopRequired) !== null && _q !== void 0 ? _q : MAX_EXPRESSION,
        loopEnum: (_r = o.loopEnum) !== null && _r !== void 0 ? _r : MAX_EXPRESSION,
        meta: (_s = o.meta) !== null && _s !== void 0 ? _s : true,
        messages: (_t = o.messages) !== null && _t !== void 0 ? _t : true,
        inlineRefs: (_u = o.inlineRefs) !== null && _u !== void 0 ? _u : true,
        schemaId: (_v = o.schemaId) !== null && _v !== void 0 ? _v : "$id",
        addUsedSchema: (_w = o.addUsedSchema) !== null && _w !== void 0 ? _w : true,
        validateSchema: (_x = o.validateSchema) !== null && _x !== void 0 ? _x : true,
        validateFormats: (_y = o.validateFormats) !== null && _y !== void 0 ? _y : true,
        unicodeRegExp: (_z = o.unicodeRegExp) !== null && _z !== void 0 ? _z : true,
        int32range: (_0 = o.int32range) !== null && _0 !== void 0 ? _0 : true,
        uriResolver
      };
    }
    var Ajv = class {
      constructor(opts = {}) {
        this.schemas = {};
        this.refs = {};
        this.formats = /* @__PURE__ */ Object.create(null);
        this._compilations = /* @__PURE__ */ new Set();
        this._loading = {};
        this._cache = /* @__PURE__ */ new Map();
        opts = this.opts = { ...opts, ...requiredOptions(opts) };
        const { es5, lines } = this.opts.code;
        this.scope = new codegen_2.ValueScope({ scope: {}, prefixes: EXT_SCOPE_NAMES, es5, lines });
        this.logger = getLogger(opts.logger);
        const formatOpt = opts.validateFormats;
        opts.validateFormats = false;
        this.RULES = (0, rules_1.getRules)();
        checkOptions.call(this, removedOptions, opts, "NOT SUPPORTED");
        checkOptions.call(this, deprecatedOptions, opts, "DEPRECATED", "warn");
        this._metaOpts = getMetaSchemaOptions.call(this);
        if (opts.formats)
          addInitialFormats.call(this);
        this._addVocabularies();
        this._addDefaultMetaSchema();
        if (opts.keywords)
          addInitialKeywords.call(this, opts.keywords);
        if (typeof opts.meta == "object")
          this.addMetaSchema(opts.meta);
        addInitialSchemas.call(this);
        opts.validateFormats = formatOpt;
      }
      _addVocabularies() {
        this.addKeyword("$async");
      }
      _addDefaultMetaSchema() {
        const { $data, meta, schemaId } = this.opts;
        let _dataRefSchema = $dataRefSchema;
        if (schemaId === "id") {
          _dataRefSchema = { ...$dataRefSchema };
          _dataRefSchema.id = _dataRefSchema.$id;
          delete _dataRefSchema.$id;
        }
        if (meta && $data)
          this.addMetaSchema(_dataRefSchema, _dataRefSchema[schemaId], false);
      }
      defaultMeta() {
        const { meta, schemaId } = this.opts;
        return this.opts.defaultMeta = typeof meta == "object" ? meta[schemaId] || meta : void 0;
      }
      validate(schemaKeyRef, data) {
        let v2;
        if (typeof schemaKeyRef == "string") {
          v2 = this.getSchema(schemaKeyRef);
          if (!v2)
            throw new Error(`no schema with key or ref "${schemaKeyRef}"`);
        } else {
          v2 = this.compile(schemaKeyRef);
        }
        const valid = v2(data);
        if (!("$async" in v2))
          this.errors = v2.errors;
        return valid;
      }
      compile(schema, _meta) {
        const sch = this._addSchema(schema, _meta);
        return sch.validate || this._compileSchemaEnv(sch);
      }
      compileAsync(schema, meta) {
        if (typeof this.opts.loadSchema != "function") {
          throw new Error("options.loadSchema should be a function");
        }
        const { loadSchema } = this.opts;
        return runCompileAsync.call(this, schema, meta);
        async function runCompileAsync(_schema, _meta) {
          await loadMetaSchema.call(this, _schema.$schema);
          const sch = this._addSchema(_schema, _meta);
          return sch.validate || _compileAsync.call(this, sch);
        }
        async function loadMetaSchema($ref) {
          if ($ref && !this.getSchema($ref)) {
            await runCompileAsync.call(this, { $ref }, true);
          }
        }
        async function _compileAsync(sch) {
          try {
            return this._compileSchemaEnv(sch);
          } catch (e) {
            if (!(e instanceof ref_error_1.default))
              throw e;
            checkLoaded.call(this, e);
            await loadMissingSchema.call(this, e.missingSchema);
            return _compileAsync.call(this, sch);
          }
        }
        function checkLoaded({ missingSchema: ref, missingRef }) {
          if (this.refs[ref]) {
            throw new Error(`AnySchema ${ref} is loaded but ${missingRef} cannot be resolved`);
          }
        }
        async function loadMissingSchema(ref) {
          const _schema = await _loadSchema.call(this, ref);
          if (!this.refs[ref])
            await loadMetaSchema.call(this, _schema.$schema);
          if (!this.refs[ref])
            this.addSchema(_schema, ref, meta);
        }
        async function _loadSchema(ref) {
          const p = this._loading[ref];
          if (p)
            return p;
          try {
            return await (this._loading[ref] = loadSchema(ref));
          } finally {
            delete this._loading[ref];
          }
        }
      }
      // Adds schema to the instance
      addSchema(schema, key, _meta, _validateSchema = this.opts.validateSchema) {
        if (Array.isArray(schema)) {
          for (const sch of schema)
            this.addSchema(sch, void 0, _meta, _validateSchema);
          return this;
        }
        let id;
        if (typeof schema === "object") {
          const { schemaId } = this.opts;
          id = schema[schemaId];
          if (id !== void 0 && typeof id != "string") {
            throw new Error(`schema ${schemaId} must be string`);
          }
        }
        key = (0, resolve_1.normalizeId)(key || id);
        this._checkUnique(key);
        this.schemas[key] = this._addSchema(schema, _meta, key, _validateSchema, true);
        return this;
      }
      // Add schema that will be used to validate other schemas
      // options in META_IGNORE_OPTIONS are alway set to false
      addMetaSchema(schema, key, _validateSchema = this.opts.validateSchema) {
        this.addSchema(schema, key, true, _validateSchema);
        return this;
      }
      //  Validate schema against its meta-schema
      validateSchema(schema, throwOrLogError) {
        if (typeof schema == "boolean")
          return true;
        let $schema;
        $schema = schema.$schema;
        if ($schema !== void 0 && typeof $schema != "string") {
          throw new Error("$schema must be a string");
        }
        $schema = $schema || this.opts.defaultMeta || this.defaultMeta();
        if (!$schema) {
          this.logger.warn("meta-schema not available");
          this.errors = null;
          return true;
        }
        const valid = this.validate($schema, schema);
        if (!valid && throwOrLogError) {
          const message = "schema is invalid: " + this.errorsText();
          if (this.opts.validateSchema === "log")
            this.logger.error(message);
          else
            throw new Error(message);
        }
        return valid;
      }
      // Get compiled schema by `key` or `ref`.
      // (`key` that was passed to `addSchema` or full schema reference - `schema.$id` or resolved id)
      getSchema(keyRef) {
        let sch;
        while (typeof (sch = getSchEnv.call(this, keyRef)) == "string")
          keyRef = sch;
        if (sch === void 0) {
          const { schemaId } = this.opts;
          const root = new compile_1.SchemaEnv({ schema: {}, schemaId });
          sch = compile_1.resolveSchema.call(this, root, keyRef);
          if (!sch)
            return;
          this.refs[keyRef] = sch;
        }
        return sch.validate || this._compileSchemaEnv(sch);
      }
      // Remove cached schema(s).
      // If no parameter is passed all schemas but meta-schemas are removed.
      // If RegExp is passed all schemas with key/id matching pattern but meta-schemas are removed.
      // Even if schema is referenced by other schemas it still can be removed as other schemas have local references.
      removeSchema(schemaKeyRef) {
        if (schemaKeyRef instanceof RegExp) {
          this._removeAllSchemas(this.schemas, schemaKeyRef);
          this._removeAllSchemas(this.refs, schemaKeyRef);
          return this;
        }
        switch (typeof schemaKeyRef) {
          case "undefined":
            this._removeAllSchemas(this.schemas);
            this._removeAllSchemas(this.refs);
            this._cache.clear();
            return this;
          case "string": {
            const sch = getSchEnv.call(this, schemaKeyRef);
            if (typeof sch == "object")
              this._cache.delete(sch.schema);
            delete this.schemas[schemaKeyRef];
            delete this.refs[schemaKeyRef];
            return this;
          }
          case "object": {
            const cacheKey = schemaKeyRef;
            this._cache.delete(cacheKey);
            let id = schemaKeyRef[this.opts.schemaId];
            if (id) {
              id = (0, resolve_1.normalizeId)(id);
              delete this.schemas[id];
              delete this.refs[id];
            }
            return this;
          }
          default:
            throw new Error("ajv.removeSchema: invalid parameter");
        }
      }
      // add "vocabulary" - a collection of keywords
      addVocabulary(definitions) {
        for (const def of definitions)
          this.addKeyword(def);
        return this;
      }
      addKeyword(kwdOrDef, def) {
        let keyword;
        if (typeof kwdOrDef == "string") {
          keyword = kwdOrDef;
          if (typeof def == "object") {
            this.logger.warn("these parameters are deprecated, see docs for addKeyword");
            def.keyword = keyword;
          }
        } else if (typeof kwdOrDef == "object" && def === void 0) {
          def = kwdOrDef;
          keyword = def.keyword;
          if (Array.isArray(keyword) && !keyword.length) {
            throw new Error("addKeywords: keyword must be string or non-empty array");
          }
        } else {
          throw new Error("invalid addKeywords parameters");
        }
        checkKeyword.call(this, keyword, def);
        if (!def) {
          (0, util_1.eachItem)(keyword, (kwd) => addRule.call(this, kwd));
          return this;
        }
        keywordMetaschema.call(this, def);
        const definition = {
          ...def,
          type: (0, dataType_1.getJSONTypes)(def.type),
          schemaType: (0, dataType_1.getJSONTypes)(def.schemaType)
        };
        (0, util_1.eachItem)(keyword, definition.type.length === 0 ? (k) => addRule.call(this, k, definition) : (k) => definition.type.forEach((t) => addRule.call(this, k, definition, t)));
        return this;
      }
      getKeyword(keyword) {
        const rule = this.RULES.all[keyword];
        return typeof rule == "object" ? rule.definition : !!rule;
      }
      // Remove keyword
      removeKeyword(keyword) {
        const { RULES } = this;
        delete RULES.keywords[keyword];
        delete RULES.all[keyword];
        for (const group of RULES.rules) {
          const i = group.rules.findIndex((rule) => rule.keyword === keyword);
          if (i >= 0)
            group.rules.splice(i, 1);
        }
        return this;
      }
      // Add format
      addFormat(name, format) {
        if (typeof format == "string")
          format = new RegExp(format);
        this.formats[name] = format;
        return this;
      }
      errorsText(errors = this.errors, { separator = ", ", dataVar = "data" } = {}) {
        if (!errors || errors.length === 0)
          return "No errors";
        return errors.map((e) => `${dataVar}${e.instancePath} ${e.message}`).reduce((text, msg) => text + separator + msg);
      }
      $dataMetaSchema(metaSchema, keywordsJsonPointers) {
        const rules = this.RULES.all;
        metaSchema = JSON.parse(JSON.stringify(metaSchema));
        for (const jsonPointer of keywordsJsonPointers) {
          const segments = jsonPointer.split("/").slice(1);
          let keywords = metaSchema;
          for (const seg of segments)
            keywords = keywords[seg];
          for (const key in rules) {
            const rule = rules[key];
            if (typeof rule != "object")
              continue;
            const { $data } = rule.definition;
            const schema = keywords[key];
            if ($data && schema)
              keywords[key] = schemaOrData(schema);
          }
        }
        return metaSchema;
      }
      _removeAllSchemas(schemas, regex) {
        for (const keyRef in schemas) {
          const sch = schemas[keyRef];
          if (!regex || regex.test(keyRef)) {
            if (typeof sch == "string") {
              delete schemas[keyRef];
            } else if (sch && !sch.meta) {
              this._cache.delete(sch.schema);
              delete schemas[keyRef];
            }
          }
        }
      }
      _addSchema(schema, meta, baseId, validateSchema = this.opts.validateSchema, addSchema = this.opts.addUsedSchema) {
        let id;
        const { schemaId } = this.opts;
        if (typeof schema == "object") {
          id = schema[schemaId];
        } else {
          if (this.opts.jtd)
            throw new Error("schema must be object");
          else if (typeof schema != "boolean")
            throw new Error("schema must be object or boolean");
        }
        let sch = this._cache.get(schema);
        if (sch !== void 0)
          return sch;
        baseId = (0, resolve_1.normalizeId)(id || baseId);
        const localRefs = resolve_1.getSchemaRefs.call(this, schema, baseId);
        sch = new compile_1.SchemaEnv({ schema, schemaId, meta, baseId, localRefs });
        this._cache.set(sch.schema, sch);
        if (addSchema && !baseId.startsWith("#")) {
          if (baseId)
            this._checkUnique(baseId);
          this.refs[baseId] = sch;
        }
        if (validateSchema)
          this.validateSchema(schema, true);
        return sch;
      }
      _checkUnique(id) {
        if (this.schemas[id] || this.refs[id]) {
          throw new Error(`schema with key or id "${id}" already exists`);
        }
      }
      _compileSchemaEnv(sch) {
        if (sch.meta)
          this._compileMetaSchema(sch);
        else
          compile_1.compileSchema.call(this, sch);
        if (!sch.validate)
          throw new Error("ajv implementation error");
        return sch.validate;
      }
      _compileMetaSchema(sch) {
        const currentOpts = this.opts;
        this.opts = this._metaOpts;
        try {
          compile_1.compileSchema.call(this, sch);
        } finally {
          this.opts = currentOpts;
        }
      }
    };
    Ajv.ValidationError = validation_error_1.default;
    Ajv.MissingRefError = ref_error_1.default;
    exports.default = Ajv;
    function checkOptions(checkOpts, options, msg, log = "error") {
      for (const key in checkOpts) {
        const opt = key;
        if (opt in options)
          this.logger[log](`${msg}: option ${key}. ${checkOpts[opt]}`);
      }
    }
    function getSchEnv(keyRef) {
      keyRef = (0, resolve_1.normalizeId)(keyRef);
      return this.schemas[keyRef] || this.refs[keyRef];
    }
    function addInitialSchemas() {
      const optsSchemas = this.opts.schemas;
      if (!optsSchemas)
        return;
      if (Array.isArray(optsSchemas))
        this.addSchema(optsSchemas);
      else
        for (const key in optsSchemas)
          this.addSchema(optsSchemas[key], key);
    }
    function addInitialFormats() {
      for (const name in this.opts.formats) {
        const format = this.opts.formats[name];
        if (format)
          this.addFormat(name, format);
      }
    }
    function addInitialKeywords(defs) {
      if (Array.isArray(defs)) {
        this.addVocabulary(defs);
        return;
      }
      this.logger.warn("keywords option as map is deprecated, pass array");
      for (const keyword in defs) {
        const def = defs[keyword];
        if (!def.keyword)
          def.keyword = keyword;
        this.addKeyword(def);
      }
    }
    function getMetaSchemaOptions() {
      const metaOpts = { ...this.opts };
      for (const opt of META_IGNORE_OPTIONS)
        delete metaOpts[opt];
      return metaOpts;
    }
    var noLogs = { log() {
    }, warn() {
    }, error() {
    } };
    function getLogger(logger) {
      if (logger === false)
        return noLogs;
      if (logger === void 0)
        return console;
      if (logger.log && logger.warn && logger.error)
        return logger;
      throw new Error("logger must implement log, warn and error methods");
    }
    var KEYWORD_NAME = /^[a-z_$][a-z0-9_$:-]*$/i;
    function checkKeyword(keyword, def) {
      const { RULES } = this;
      (0, util_1.eachItem)(keyword, (kwd) => {
        if (RULES.keywords[kwd])
          throw new Error(`Keyword ${kwd} is already defined`);
        if (!KEYWORD_NAME.test(kwd))
          throw new Error(`Keyword ${kwd} has invalid name`);
      });
      if (!def)
        return;
      if (def.$data && !("code" in def || "validate" in def)) {
        throw new Error('$data keyword must have "code" or "validate" function');
      }
    }
    function addRule(keyword, definition, dataType) {
      var _a;
      const post = definition === null || definition === void 0 ? void 0 : definition.post;
      if (dataType && post)
        throw new Error('keyword with "post" flag cannot have "type"');
      const { RULES } = this;
      let ruleGroup = post ? RULES.post : RULES.rules.find(({ type: t }) => t === dataType);
      if (!ruleGroup) {
        ruleGroup = { type: dataType, rules: [] };
        RULES.rules.push(ruleGroup);
      }
      RULES.keywords[keyword] = true;
      if (!definition)
        return;
      const rule = {
        keyword,
        definition: {
          ...definition,
          type: (0, dataType_1.getJSONTypes)(definition.type),
          schemaType: (0, dataType_1.getJSONTypes)(definition.schemaType)
        }
      };
      if (definition.before)
        addBeforeRule.call(this, ruleGroup, rule, definition.before);
      else
        ruleGroup.rules.push(rule);
      RULES.all[keyword] = rule;
      (_a = definition.implements) === null || _a === void 0 ? void 0 : _a.forEach((kwd) => this.addKeyword(kwd));
    }
    function addBeforeRule(ruleGroup, rule, before) {
      const i = ruleGroup.rules.findIndex((_rule) => _rule.keyword === before);
      if (i >= 0) {
        ruleGroup.rules.splice(i, 0, rule);
      } else {
        ruleGroup.rules.push(rule);
        this.logger.warn(`rule ${before} is not defined`);
      }
    }
    function keywordMetaschema(def) {
      let { metaSchema } = def;
      if (metaSchema === void 0)
        return;
      if (def.$data && this.opts.$data)
        metaSchema = schemaOrData(metaSchema);
      def.validateSchema = this.compile(metaSchema, true);
    }
    var $dataRef = {
      $ref: "https://raw.githubusercontent.com/ajv-validator/ajv/master/lib/refs/data.json#"
    };
    function schemaOrData(schema) {
      return { anyOf: [schema, $dataRef] };
    }
  }
});

// node_modules/ajv/dist/vocabularies/core/id.js
var require_id = __commonJS({
  "node_modules/ajv/dist/vocabularies/core/id.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var def = {
      keyword: "id",
      code() {
        throw new Error('NOT SUPPORTED: keyword "id", use "$id" for schema ID');
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/core/ref.js
var require_ref = __commonJS({
  "node_modules/ajv/dist/vocabularies/core/ref.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.callRef = exports.getValidate = void 0;
    var ref_error_1 = require_ref_error();
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var compile_1 = require_compile();
    var util_1 = require_util();
    var def = {
      keyword: "$ref",
      schemaType: "string",
      code(cxt) {
        const { gen, schema: $ref, it } = cxt;
        const { baseId, schemaEnv: env, validateName, opts, self: self2 } = it;
        const { root } = env;
        if (($ref === "#" || $ref === "#/") && baseId === root.baseId)
          return callRootRef();
        const schOrEnv = compile_1.resolveRef.call(self2, root, baseId, $ref);
        if (schOrEnv === void 0)
          throw new ref_error_1.default(it.opts.uriResolver, baseId, $ref);
        if (schOrEnv instanceof compile_1.SchemaEnv)
          return callValidate(schOrEnv);
        return inlineRefSchema(schOrEnv);
        function callRootRef() {
          if (env === root)
            return callRef(cxt, validateName, env, env.$async);
          const rootName = gen.scopeValue("root", { ref: root });
          return callRef(cxt, (0, codegen_1._)`${rootName}.validate`, root, root.$async);
        }
        function callValidate(sch) {
          const v2 = getValidate(cxt, sch);
          callRef(cxt, v2, sch, sch.$async);
        }
        function inlineRefSchema(sch) {
          const schName = gen.scopeValue("schema", opts.code.source === true ? { ref: sch, code: (0, codegen_1.stringify)(sch) } : { ref: sch });
          const valid = gen.name("valid");
          const schCxt = cxt.subschema({
            schema: sch,
            dataTypes: [],
            schemaPath: codegen_1.nil,
            topSchemaRef: schName,
            errSchemaPath: $ref
          }, valid);
          cxt.mergeEvaluated(schCxt);
          cxt.ok(valid);
        }
      }
    };
    function getValidate(cxt, sch) {
      const { gen } = cxt;
      return sch.validate ? gen.scopeValue("validate", { ref: sch.validate }) : (0, codegen_1._)`${gen.scopeValue("wrapper", { ref: sch })}.validate`;
    }
    exports.getValidate = getValidate;
    function callRef(cxt, v2, sch, $async) {
      const { gen, it } = cxt;
      const { allErrors, schemaEnv: env, opts } = it;
      const passCxt = opts.passContext ? names_1.default.this : codegen_1.nil;
      if ($async)
        callAsyncRef();
      else
        callSyncRef();
      function callAsyncRef() {
        if (!env.$async)
          throw new Error("async schema referenced by sync schema");
        const valid = gen.let("valid");
        gen.try(() => {
          gen.code((0, codegen_1._)`await ${(0, code_1.callValidateCode)(cxt, v2, passCxt)}`);
          addEvaluatedFrom(v2);
          if (!allErrors)
            gen.assign(valid, true);
        }, (e) => {
          gen.if((0, codegen_1._)`!(${e} instanceof ${it.ValidationError})`, () => gen.throw(e));
          addErrorsFrom(e);
          if (!allErrors)
            gen.assign(valid, false);
        });
        cxt.ok(valid);
      }
      function callSyncRef() {
        cxt.result((0, code_1.callValidateCode)(cxt, v2, passCxt), () => addEvaluatedFrom(v2), () => addErrorsFrom(v2));
      }
      function addErrorsFrom(source) {
        const errs = (0, codegen_1._)`${source}.errors`;
        gen.assign(names_1.default.vErrors, (0, codegen_1._)`${names_1.default.vErrors} === null ? ${errs} : ${names_1.default.vErrors}.concat(${errs})`);
        gen.assign(names_1.default.errors, (0, codegen_1._)`${names_1.default.vErrors}.length`);
      }
      function addEvaluatedFrom(source) {
        var _a;
        if (!it.opts.unevaluated)
          return;
        const schEvaluated = (_a = sch === null || sch === void 0 ? void 0 : sch.validate) === null || _a === void 0 ? void 0 : _a.evaluated;
        if (it.props !== true) {
          if (schEvaluated && !schEvaluated.dynamicProps) {
            if (schEvaluated.props !== void 0) {
              it.props = util_1.mergeEvaluated.props(gen, schEvaluated.props, it.props);
            }
          } else {
            const props = gen.var("props", (0, codegen_1._)`${source}.evaluated.props`);
            it.props = util_1.mergeEvaluated.props(gen, props, it.props, codegen_1.Name);
          }
        }
        if (it.items !== true) {
          if (schEvaluated && !schEvaluated.dynamicItems) {
            if (schEvaluated.items !== void 0) {
              it.items = util_1.mergeEvaluated.items(gen, schEvaluated.items, it.items);
            }
          } else {
            const items = gen.var("items", (0, codegen_1._)`${source}.evaluated.items`);
            it.items = util_1.mergeEvaluated.items(gen, items, it.items, codegen_1.Name);
          }
        }
      }
    }
    exports.callRef = callRef;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/core/index.js
var require_core2 = __commonJS({
  "node_modules/ajv/dist/vocabularies/core/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var id_1 = require_id();
    var ref_1 = require_ref();
    var core = [
      "$schema",
      "$id",
      "$defs",
      "$vocabulary",
      { keyword: "$comment" },
      "definitions",
      id_1.default,
      ref_1.default
    ];
    exports.default = core;
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitNumber.js
var require_limitNumber = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitNumber.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var ops = codegen_1.operators;
    var KWDs = {
      maximum: { okStr: "<=", ok: ops.LTE, fail: ops.GT },
      minimum: { okStr: ">=", ok: ops.GTE, fail: ops.LT },
      exclusiveMaximum: { okStr: "<", ok: ops.LT, fail: ops.GTE },
      exclusiveMinimum: { okStr: ">", ok: ops.GT, fail: ops.LTE }
    };
    var error = {
      message: ({ keyword, schemaCode }) => (0, codegen_1.str)`must be ${KWDs[keyword].okStr} ${schemaCode}`,
      params: ({ keyword, schemaCode }) => (0, codegen_1._)`{comparison: ${KWDs[keyword].okStr}, limit: ${schemaCode}}`
    };
    var def = {
      keyword: Object.keys(KWDs),
      type: "number",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { keyword, data, schemaCode } = cxt;
        cxt.fail$data((0, codegen_1._)`${data} ${KWDs[keyword].fail} ${schemaCode} || isNaN(${data})`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/multipleOf.js
var require_multipleOf = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/multipleOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error = {
      message: ({ schemaCode }) => (0, codegen_1.str)`must be multiple of ${schemaCode}`,
      params: ({ schemaCode }) => (0, codegen_1._)`{multipleOf: ${schemaCode}}`
    };
    var def = {
      keyword: "multipleOf",
      type: "number",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, schemaCode, it } = cxt;
        const prec = it.opts.multipleOfPrecision;
        const res = gen.let("res");
        const invalid = prec ? (0, codegen_1._)`Math.abs(Math.round(${res}) - ${res}) > 1e-${prec}` : (0, codegen_1._)`${res} !== parseInt(${res})`;
        cxt.fail$data((0, codegen_1._)`(${schemaCode} === 0 || (${res} = ${data}/${schemaCode}, ${invalid}))`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/runtime/ucs2length.js
var require_ucs2length = __commonJS({
  "node_modules/ajv/dist/runtime/ucs2length.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    function ucs2length(str) {
      const len = str.length;
      let length = 0;
      let pos = 0;
      let value;
      while (pos < len) {
        length++;
        value = str.charCodeAt(pos++);
        if (value >= 55296 && value <= 56319 && pos < len) {
          value = str.charCodeAt(pos);
          if ((value & 64512) === 56320)
            pos++;
        }
      }
      return length;
    }
    exports.default = ucs2length;
    ucs2length.code = 'require("ajv/dist/runtime/ucs2length").default';
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitLength.js
var require_limitLength = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitLength.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var ucs2length_1 = require_ucs2length();
    var error = {
      message({ keyword, schemaCode }) {
        const comp = keyword === "maxLength" ? "more" : "fewer";
        return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} characters`;
      },
      params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
    };
    var def = {
      keyword: ["maxLength", "minLength"],
      type: "string",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { keyword, data, schemaCode, it } = cxt;
        const op = keyword === "maxLength" ? codegen_1.operators.GT : codegen_1.operators.LT;
        const len = it.opts.unicode === false ? (0, codegen_1._)`${data}.length` : (0, codegen_1._)`${(0, util_1.useFunc)(cxt.gen, ucs2length_1.default)}(${data})`;
        cxt.fail$data((0, codegen_1._)`${len} ${op} ${schemaCode}`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/pattern.js
var require_pattern = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/pattern.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var util_1 = require_util();
    var codegen_1 = require_codegen();
    var error = {
      message: ({ schemaCode }) => (0, codegen_1.str)`must match pattern "${schemaCode}"`,
      params: ({ schemaCode }) => (0, codegen_1._)`{pattern: ${schemaCode}}`
    };
    var def = {
      keyword: "pattern",
      type: "string",
      schemaType: "string",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, $data, schema, schemaCode, it } = cxt;
        const u4 = it.opts.unicodeRegExp ? "u" : "";
        if ($data) {
          const { regExp } = it.opts.code;
          const regExpCode = regExp.code === "new RegExp" ? (0, codegen_1._)`new RegExp` : (0, util_1.useFunc)(gen, regExp);
          const valid = gen.let("valid");
          gen.try(() => gen.assign(valid, (0, codegen_1._)`${regExpCode}(${schemaCode}, ${u4}).test(${data})`), () => gen.assign(valid, false));
          cxt.fail$data((0, codegen_1._)`!${valid}`);
        } else {
          const regExp = (0, code_1.usePattern)(cxt, schema);
          cxt.fail$data((0, codegen_1._)`!${regExp}.test(${data})`);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitProperties.js
var require_limitProperties = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitProperties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error = {
      message({ keyword, schemaCode }) {
        const comp = keyword === "maxProperties" ? "more" : "fewer";
        return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} properties`;
      },
      params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
    };
    var def = {
      keyword: ["maxProperties", "minProperties"],
      type: "object",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { keyword, data, schemaCode } = cxt;
        const op = keyword === "maxProperties" ? codegen_1.operators.GT : codegen_1.operators.LT;
        cxt.fail$data((0, codegen_1._)`Object.keys(${data}).length ${op} ${schemaCode}`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/required.js
var require_required = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/required.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params: { missingProperty } }) => (0, codegen_1.str)`must have required property '${missingProperty}'`,
      params: ({ params: { missingProperty } }) => (0, codegen_1._)`{missingProperty: ${missingProperty}}`
    };
    var def = {
      keyword: "required",
      type: "object",
      schemaType: "array",
      $data: true,
      error,
      code(cxt) {
        const { gen, schema, schemaCode, data, $data, it } = cxt;
        const { opts } = it;
        if (!$data && schema.length === 0)
          return;
        const useLoop = schema.length >= opts.loopRequired;
        if (it.allErrors)
          allErrorsMode();
        else
          exitOnErrorMode();
        if (opts.strictRequired) {
          const props = cxt.parentSchema.properties;
          const { definedProperties } = cxt.it;
          for (const requiredKey of schema) {
            if ((props === null || props === void 0 ? void 0 : props[requiredKey]) === void 0 && !definedProperties.has(requiredKey)) {
              const schemaPath = it.schemaEnv.baseId + it.errSchemaPath;
              const msg = `required property "${requiredKey}" is not defined at "${schemaPath}" (strictRequired)`;
              (0, util_1.checkStrictMode)(it, msg, it.opts.strictRequired);
            }
          }
        }
        function allErrorsMode() {
          if (useLoop || $data) {
            cxt.block$data(codegen_1.nil, loopAllRequired);
          } else {
            for (const prop of schema) {
              (0, code_1.checkReportMissingProp)(cxt, prop);
            }
          }
        }
        function exitOnErrorMode() {
          const missing = gen.let("missing");
          if (useLoop || $data) {
            const valid = gen.let("valid", true);
            cxt.block$data(valid, () => loopUntilMissing(missing, valid));
            cxt.ok(valid);
          } else {
            gen.if((0, code_1.checkMissingProp)(cxt, schema, missing));
            (0, code_1.reportMissingProp)(cxt, missing);
            gen.else();
          }
        }
        function loopAllRequired() {
          gen.forOf("prop", schemaCode, (prop) => {
            cxt.setParams({ missingProperty: prop });
            gen.if((0, code_1.noPropertyInData)(gen, data, prop, opts.ownProperties), () => cxt.error());
          });
        }
        function loopUntilMissing(missing, valid) {
          cxt.setParams({ missingProperty: missing });
          gen.forOf(missing, schemaCode, () => {
            gen.assign(valid, (0, code_1.propertyInData)(gen, data, missing, opts.ownProperties));
            gen.if((0, codegen_1.not)(valid), () => {
              cxt.error();
              gen.break();
            });
          }, codegen_1.nil);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitItems.js
var require_limitItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error = {
      message({ keyword, schemaCode }) {
        const comp = keyword === "maxItems" ? "more" : "fewer";
        return (0, codegen_1.str)`must NOT have ${comp} than ${schemaCode} items`;
      },
      params: ({ schemaCode }) => (0, codegen_1._)`{limit: ${schemaCode}}`
    };
    var def = {
      keyword: ["maxItems", "minItems"],
      type: "array",
      schemaType: "number",
      $data: true,
      error,
      code(cxt) {
        const { keyword, data, schemaCode } = cxt;
        const op = keyword === "maxItems" ? codegen_1.operators.GT : codegen_1.operators.LT;
        cxt.fail$data((0, codegen_1._)`${data}.length ${op} ${schemaCode}`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/runtime/equal.js
var require_equal = __commonJS({
  "node_modules/ajv/dist/runtime/equal.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var equal = require_fast_deep_equal();
    equal.code = 'require("ajv/dist/runtime/equal").default';
    exports.default = equal;
  }
});

// node_modules/ajv/dist/vocabularies/validation/uniqueItems.js
var require_uniqueItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/uniqueItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dataType_1 = require_dataType();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var equal_1 = require_equal();
    var error = {
      message: ({ params: { i, j } }) => (0, codegen_1.str)`must NOT have duplicate items (items ## ${j} and ${i} are identical)`,
      params: ({ params: { i, j } }) => (0, codegen_1._)`{i: ${i}, j: ${j}}`
    };
    var def = {
      keyword: "uniqueItems",
      type: "array",
      schemaType: "boolean",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, $data, schema, parentSchema, schemaCode, it } = cxt;
        if (!$data && !schema)
          return;
        const valid = gen.let("valid");
        const itemTypes = parentSchema.items ? (0, dataType_1.getSchemaTypes)(parentSchema.items) : [];
        cxt.block$data(valid, validateUniqueItems, (0, codegen_1._)`${schemaCode} === false`);
        cxt.ok(valid);
        function validateUniqueItems() {
          const i = gen.let("i", (0, codegen_1._)`${data}.length`);
          const j = gen.let("j");
          cxt.setParams({ i, j });
          gen.assign(valid, true);
          gen.if((0, codegen_1._)`${i} > 1`, () => (canOptimize() ? loopN : loopN2)(i, j));
        }
        function canOptimize() {
          return itemTypes.length > 0 && !itemTypes.some((t) => t === "object" || t === "array");
        }
        function loopN(i, j) {
          const item = gen.name("item");
          const wrongType = (0, dataType_1.checkDataTypes)(itemTypes, item, it.opts.strictNumbers, dataType_1.DataType.Wrong);
          const indices = gen.const("indices", (0, codegen_1._)`{}`);
          gen.for((0, codegen_1._)`;${i}--;`, () => {
            gen.let(item, (0, codegen_1._)`${data}[${i}]`);
            gen.if(wrongType, (0, codegen_1._)`continue`);
            if (itemTypes.length > 1)
              gen.if((0, codegen_1._)`typeof ${item} == "string"`, (0, codegen_1._)`${item} += "_"`);
            gen.if((0, codegen_1._)`typeof ${indices}[${item}] == "number"`, () => {
              gen.assign(j, (0, codegen_1._)`${indices}[${item}]`);
              cxt.error();
              gen.assign(valid, false).break();
            }).code((0, codegen_1._)`${indices}[${item}] = ${i}`);
          });
        }
        function loopN2(i, j) {
          const eql = (0, util_1.useFunc)(gen, equal_1.default);
          const outer = gen.name("outer");
          gen.label(outer).for((0, codegen_1._)`;${i}--;`, () => gen.for((0, codegen_1._)`${j} = ${i}; ${j}--;`, () => gen.if((0, codegen_1._)`${eql}(${data}[${i}], ${data}[${j}])`, () => {
            cxt.error();
            gen.assign(valid, false).break(outer);
          })));
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/const.js
var require_const = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/const.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var equal_1 = require_equal();
    var error = {
      message: "must be equal to constant",
      params: ({ schemaCode }) => (0, codegen_1._)`{allowedValue: ${schemaCode}}`
    };
    var def = {
      keyword: "const",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, $data, schemaCode, schema } = cxt;
        if ($data || schema && typeof schema == "object") {
          cxt.fail$data((0, codegen_1._)`!${(0, util_1.useFunc)(gen, equal_1.default)}(${data}, ${schemaCode})`);
        } else {
          cxt.fail((0, codegen_1._)`${schema} !== ${data}`);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/enum.js
var require_enum = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/enum.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var equal_1 = require_equal();
    var error = {
      message: "must be equal to one of the allowed values",
      params: ({ schemaCode }) => (0, codegen_1._)`{allowedValues: ${schemaCode}}`
    };
    var def = {
      keyword: "enum",
      schemaType: "array",
      $data: true,
      error,
      code(cxt) {
        const { gen, data, $data, schema, schemaCode, it } = cxt;
        if (!$data && schema.length === 0)
          throw new Error("enum must have non-empty array");
        const useLoop = schema.length >= it.opts.loopEnum;
        let eql;
        const getEql = () => eql !== null && eql !== void 0 ? eql : eql = (0, util_1.useFunc)(gen, equal_1.default);
        let valid;
        if (useLoop || $data) {
          valid = gen.let("valid");
          cxt.block$data(valid, loopEnum);
        } else {
          if (!Array.isArray(schema))
            throw new Error("ajv implementation error");
          const vSchema = gen.const("vSchema", schemaCode);
          valid = (0, codegen_1.or)(...schema.map((_x, i) => equalCode(vSchema, i)));
        }
        cxt.pass(valid);
        function loopEnum() {
          gen.assign(valid, false);
          gen.forOf("v", schemaCode, (v2) => gen.if((0, codegen_1._)`${getEql()}(${data}, ${v2})`, () => gen.assign(valid, true).break()));
        }
        function equalCode(vSchema, i) {
          const sch = schema[i];
          return typeof sch === "object" && sch !== null ? (0, codegen_1._)`${getEql()}(${data}, ${vSchema}[${i}])` : (0, codegen_1._)`${data} === ${sch}`;
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/index.js
var require_validation = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var limitNumber_1 = require_limitNumber();
    var multipleOf_1 = require_multipleOf();
    var limitLength_1 = require_limitLength();
    var pattern_1 = require_pattern();
    var limitProperties_1 = require_limitProperties();
    var required_1 = require_required();
    var limitItems_1 = require_limitItems();
    var uniqueItems_1 = require_uniqueItems();
    var const_1 = require_const();
    var enum_1 = require_enum();
    var validation = [
      // number
      limitNumber_1.default,
      multipleOf_1.default,
      // string
      limitLength_1.default,
      pattern_1.default,
      // object
      limitProperties_1.default,
      required_1.default,
      // array
      limitItems_1.default,
      uniqueItems_1.default,
      // any
      { keyword: "type", schemaType: ["string", "array"] },
      { keyword: "nullable", schemaType: "boolean" },
      const_1.default,
      enum_1.default
    ];
    exports.default = validation;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/additionalItems.js
var require_additionalItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/additionalItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateAdditionalItems = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params: { len } }) => (0, codegen_1.str)`must NOT have more than ${len} items`,
      params: ({ params: { len } }) => (0, codegen_1._)`{limit: ${len}}`
    };
    var def = {
      keyword: "additionalItems",
      type: "array",
      schemaType: ["boolean", "object"],
      before: "uniqueItems",
      error,
      code(cxt) {
        const { parentSchema, it } = cxt;
        const { items } = parentSchema;
        if (!Array.isArray(items)) {
          (0, util_1.checkStrictMode)(it, '"additionalItems" is ignored when "items" is not an array of schemas');
          return;
        }
        validateAdditionalItems(cxt, items);
      }
    };
    function validateAdditionalItems(cxt, items) {
      const { gen, schema, data, keyword, it } = cxt;
      it.items = true;
      const len = gen.const("len", (0, codegen_1._)`${data}.length`);
      if (schema === false) {
        cxt.setParams({ len: items.length });
        cxt.pass((0, codegen_1._)`${len} <= ${items.length}`);
      } else if (typeof schema == "object" && !(0, util_1.alwaysValidSchema)(it, schema)) {
        const valid = gen.var("valid", (0, codegen_1._)`${len} <= ${items.length}`);
        gen.if((0, codegen_1.not)(valid), () => validateItems(valid));
        cxt.ok(valid);
      }
      function validateItems(valid) {
        gen.forRange("i", items.length, len, (i) => {
          cxt.subschema({ keyword, dataProp: i, dataPropType: util_1.Type.Num }, valid);
          if (!it.allErrors)
            gen.if((0, codegen_1.not)(valid), () => gen.break());
        });
      }
    }
    exports.validateAdditionalItems = validateAdditionalItems;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/items.js
var require_items = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/items.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateTuple = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var code_1 = require_code2();
    var def = {
      keyword: "items",
      type: "array",
      schemaType: ["object", "array", "boolean"],
      before: "uniqueItems",
      code(cxt) {
        const { schema, it } = cxt;
        if (Array.isArray(schema))
          return validateTuple(cxt, "additionalItems", schema);
        it.items = true;
        if ((0, util_1.alwaysValidSchema)(it, schema))
          return;
        cxt.ok((0, code_1.validateArray)(cxt));
      }
    };
    function validateTuple(cxt, extraItems, schArr = cxt.schema) {
      const { gen, parentSchema, data, keyword, it } = cxt;
      checkStrictTuple(parentSchema);
      if (it.opts.unevaluated && schArr.length && it.items !== true) {
        it.items = util_1.mergeEvaluated.items(gen, schArr.length, it.items);
      }
      const valid = gen.name("valid");
      const len = gen.const("len", (0, codegen_1._)`${data}.length`);
      schArr.forEach((sch, i) => {
        if ((0, util_1.alwaysValidSchema)(it, sch))
          return;
        gen.if((0, codegen_1._)`${len} > ${i}`, () => cxt.subschema({
          keyword,
          schemaProp: i,
          dataProp: i
        }, valid));
        cxt.ok(valid);
      });
      function checkStrictTuple(sch) {
        const { opts, errSchemaPath } = it;
        const l = schArr.length;
        const fullTuple = l === sch.minItems && (l === sch.maxItems || sch[extraItems] === false);
        if (opts.strictTuples && !fullTuple) {
          const msg = `"${keyword}" is ${l}-tuple, but minItems or maxItems/${extraItems} are not specified or different at path "${errSchemaPath}"`;
          (0, util_1.checkStrictMode)(it, msg, opts.strictTuples);
        }
      }
    }
    exports.validateTuple = validateTuple;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/prefixItems.js
var require_prefixItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/prefixItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var items_1 = require_items();
    var def = {
      keyword: "prefixItems",
      type: "array",
      schemaType: ["array"],
      before: "uniqueItems",
      code: (cxt) => (0, items_1.validateTuple)(cxt, "items")
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/items2020.js
var require_items2020 = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/items2020.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var code_1 = require_code2();
    var additionalItems_1 = require_additionalItems();
    var error = {
      message: ({ params: { len } }) => (0, codegen_1.str)`must NOT have more than ${len} items`,
      params: ({ params: { len } }) => (0, codegen_1._)`{limit: ${len}}`
    };
    var def = {
      keyword: "items",
      type: "array",
      schemaType: ["object", "boolean"],
      before: "uniqueItems",
      error,
      code(cxt) {
        const { schema, parentSchema, it } = cxt;
        const { prefixItems } = parentSchema;
        it.items = true;
        if ((0, util_1.alwaysValidSchema)(it, schema))
          return;
        if (prefixItems)
          (0, additionalItems_1.validateAdditionalItems)(cxt, prefixItems);
        else
          cxt.ok((0, code_1.validateArray)(cxt));
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/contains.js
var require_contains = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/contains.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params: { min, max } }) => max === void 0 ? (0, codegen_1.str)`must contain at least ${min} valid item(s)` : (0, codegen_1.str)`must contain at least ${min} and no more than ${max} valid item(s)`,
      params: ({ params: { min, max } }) => max === void 0 ? (0, codegen_1._)`{minContains: ${min}}` : (0, codegen_1._)`{minContains: ${min}, maxContains: ${max}}`
    };
    var def = {
      keyword: "contains",
      type: "array",
      schemaType: ["object", "boolean"],
      before: "uniqueItems",
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, schema, parentSchema, data, it } = cxt;
        let min;
        let max;
        const { minContains, maxContains } = parentSchema;
        if (it.opts.next) {
          min = minContains === void 0 ? 1 : minContains;
          max = maxContains;
        } else {
          min = 1;
        }
        const len = gen.const("len", (0, codegen_1._)`${data}.length`);
        cxt.setParams({ min, max });
        if (max === void 0 && min === 0) {
          (0, util_1.checkStrictMode)(it, `"minContains" == 0 without "maxContains": "contains" keyword ignored`);
          return;
        }
        if (max !== void 0 && min > max) {
          (0, util_1.checkStrictMode)(it, `"minContains" > "maxContains" is always invalid`);
          cxt.fail();
          return;
        }
        if ((0, util_1.alwaysValidSchema)(it, schema)) {
          let cond = (0, codegen_1._)`${len} >= ${min}`;
          if (max !== void 0)
            cond = (0, codegen_1._)`${cond} && ${len} <= ${max}`;
          cxt.pass(cond);
          return;
        }
        it.items = true;
        const valid = gen.name("valid");
        if (max === void 0 && min === 1) {
          validateItems(valid, () => gen.if(valid, () => gen.break()));
        } else if (min === 0) {
          gen.let(valid, true);
          if (max !== void 0)
            gen.if((0, codegen_1._)`${data}.length > 0`, validateItemsWithCount);
        } else {
          gen.let(valid, false);
          validateItemsWithCount();
        }
        cxt.result(valid, () => cxt.reset());
        function validateItemsWithCount() {
          const schValid = gen.name("_valid");
          const count = gen.let("count", 0);
          validateItems(schValid, () => gen.if(schValid, () => checkLimits(count)));
        }
        function validateItems(_valid, block) {
          gen.forRange("i", 0, len, (i) => {
            cxt.subschema({
              keyword: "contains",
              dataProp: i,
              dataPropType: util_1.Type.Num,
              compositeRule: true
            }, _valid);
            block();
          });
        }
        function checkLimits(count) {
          gen.code((0, codegen_1._)`${count}++`);
          if (max === void 0) {
            gen.if((0, codegen_1._)`${count} >= ${min}`, () => gen.assign(valid, true).break());
          } else {
            gen.if((0, codegen_1._)`${count} > ${max}`, () => gen.assign(valid, false).break());
            if (min === 1)
              gen.assign(valid, true);
            else
              gen.if((0, codegen_1._)`${count} >= ${min}`, () => gen.assign(valid, true));
          }
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/dependencies.js
var require_dependencies = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/dependencies.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.validateSchemaDeps = exports.validatePropertyDeps = exports.error = void 0;
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var code_1 = require_code2();
    exports.error = {
      message: ({ params: { property, depsCount, deps } }) => {
        const property_ies = depsCount === 1 ? "property" : "properties";
        return (0, codegen_1.str)`must have ${property_ies} ${deps} when property ${property} is present`;
      },
      params: ({ params: { property, depsCount, deps, missingProperty } }) => (0, codegen_1._)`{property: ${property},
    missingProperty: ${missingProperty},
    depsCount: ${depsCount},
    deps: ${deps}}`
      // TODO change to reference
    };
    var def = {
      keyword: "dependencies",
      type: "object",
      schemaType: "object",
      error: exports.error,
      code(cxt) {
        const [propDeps, schDeps] = splitDependencies(cxt);
        validatePropertyDeps(cxt, propDeps);
        validateSchemaDeps(cxt, schDeps);
      }
    };
    function splitDependencies({ schema }) {
      const propertyDeps = {};
      const schemaDeps = {};
      for (const key in schema) {
        if (key === "__proto__")
          continue;
        const deps = Array.isArray(schema[key]) ? propertyDeps : schemaDeps;
        deps[key] = schema[key];
      }
      return [propertyDeps, schemaDeps];
    }
    function validatePropertyDeps(cxt, propertyDeps = cxt.schema) {
      const { gen, data, it } = cxt;
      if (Object.keys(propertyDeps).length === 0)
        return;
      const missing = gen.let("missing");
      for (const prop in propertyDeps) {
        const deps = propertyDeps[prop];
        if (deps.length === 0)
          continue;
        const hasProperty = (0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties);
        cxt.setParams({
          property: prop,
          depsCount: deps.length,
          deps: deps.join(", ")
        });
        if (it.allErrors) {
          gen.if(hasProperty, () => {
            for (const depProp of deps) {
              (0, code_1.checkReportMissingProp)(cxt, depProp);
            }
          });
        } else {
          gen.if((0, codegen_1._)`${hasProperty} && (${(0, code_1.checkMissingProp)(cxt, deps, missing)})`);
          (0, code_1.reportMissingProp)(cxt, missing);
          gen.else();
        }
      }
    }
    exports.validatePropertyDeps = validatePropertyDeps;
    function validateSchemaDeps(cxt, schemaDeps = cxt.schema) {
      const { gen, data, keyword, it } = cxt;
      const valid = gen.name("valid");
      for (const prop in schemaDeps) {
        if ((0, util_1.alwaysValidSchema)(it, schemaDeps[prop]))
          continue;
        gen.if(
          (0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties),
          () => {
            const schCxt = cxt.subschema({ keyword, schemaProp: prop }, valid);
            cxt.mergeValidEvaluated(schCxt, valid);
          },
          () => gen.var(valid, true)
          // TODO var
        );
        cxt.ok(valid);
      }
    }
    exports.validateSchemaDeps = validateSchemaDeps;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/propertyNames.js
var require_propertyNames = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/propertyNames.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: "property name must be valid",
      params: ({ params }) => (0, codegen_1._)`{propertyName: ${params.propertyName}}`
    };
    var def = {
      keyword: "propertyNames",
      type: "object",
      schemaType: ["object", "boolean"],
      error,
      code(cxt) {
        const { gen, schema, data, it } = cxt;
        if ((0, util_1.alwaysValidSchema)(it, schema))
          return;
        const valid = gen.name("valid");
        gen.forIn("key", data, (key) => {
          cxt.setParams({ propertyName: key });
          cxt.subschema({
            keyword: "propertyNames",
            data: key,
            dataTypes: ["string"],
            propertyName: key,
            compositeRule: true
          }, valid);
          gen.if((0, codegen_1.not)(valid), () => {
            cxt.error(true);
            if (!it.allErrors)
              gen.break();
          });
        });
        cxt.ok(valid);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/additionalProperties.js
var require_additionalProperties = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/additionalProperties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var util_1 = require_util();
    var error = {
      message: "must NOT have additional properties",
      params: ({ params }) => (0, codegen_1._)`{additionalProperty: ${params.additionalProperty}}`
    };
    var def = {
      keyword: "additionalProperties",
      type: ["object"],
      schemaType: ["boolean", "object"],
      allowUndefined: true,
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, schema, parentSchema, data, errsCount, it } = cxt;
        if (!errsCount)
          throw new Error("ajv implementation error");
        const { allErrors, opts } = it;
        it.props = true;
        if (opts.removeAdditional !== "all" && (0, util_1.alwaysValidSchema)(it, schema))
          return;
        const props = (0, code_1.allSchemaProperties)(parentSchema.properties);
        const patProps = (0, code_1.allSchemaProperties)(parentSchema.patternProperties);
        checkAdditionalProperties();
        cxt.ok((0, codegen_1._)`${errsCount} === ${names_1.default.errors}`);
        function checkAdditionalProperties() {
          gen.forIn("key", data, (key) => {
            if (!props.length && !patProps.length)
              additionalPropertyCode(key);
            else
              gen.if(isAdditional(key), () => additionalPropertyCode(key));
          });
        }
        function isAdditional(key) {
          let definedProp;
          if (props.length > 8) {
            const propsSchema = (0, util_1.schemaRefOrVal)(it, parentSchema.properties, "properties");
            definedProp = (0, code_1.isOwnProperty)(gen, propsSchema, key);
          } else if (props.length) {
            definedProp = (0, codegen_1.or)(...props.map((p) => (0, codegen_1._)`${key} === ${p}`));
          } else {
            definedProp = codegen_1.nil;
          }
          if (patProps.length) {
            definedProp = (0, codegen_1.or)(definedProp, ...patProps.map((p) => (0, codegen_1._)`${(0, code_1.usePattern)(cxt, p)}.test(${key})`));
          }
          return (0, codegen_1.not)(definedProp);
        }
        function deleteAdditional(key) {
          gen.code((0, codegen_1._)`delete ${data}[${key}]`);
        }
        function additionalPropertyCode(key) {
          if (opts.removeAdditional === "all" || opts.removeAdditional && schema === false) {
            deleteAdditional(key);
            return;
          }
          if (schema === false) {
            cxt.setParams({ additionalProperty: key });
            cxt.error();
            if (!allErrors)
              gen.break();
            return;
          }
          if (typeof schema == "object" && !(0, util_1.alwaysValidSchema)(it, schema)) {
            const valid = gen.name("valid");
            if (opts.removeAdditional === "failing") {
              applyAdditionalSchema(key, valid, false);
              gen.if((0, codegen_1.not)(valid), () => {
                cxt.reset();
                deleteAdditional(key);
              });
            } else {
              applyAdditionalSchema(key, valid);
              if (!allErrors)
                gen.if((0, codegen_1.not)(valid), () => gen.break());
            }
          }
        }
        function applyAdditionalSchema(key, valid, errors) {
          const subschema = {
            keyword: "additionalProperties",
            dataProp: key,
            dataPropType: util_1.Type.Str
          };
          if (errors === false) {
            Object.assign(subschema, {
              compositeRule: true,
              createErrors: false,
              allErrors: false
            });
          }
          cxt.subschema(subschema, valid);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/properties.js
var require_properties = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/properties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var validate_1 = require_validate();
    var code_1 = require_code2();
    var util_1 = require_util();
    var additionalProperties_1 = require_additionalProperties();
    var def = {
      keyword: "properties",
      type: "object",
      schemaType: "object",
      code(cxt) {
        const { gen, schema, parentSchema, data, it } = cxt;
        if (it.opts.removeAdditional === "all" && parentSchema.additionalProperties === void 0) {
          additionalProperties_1.default.code(new validate_1.KeywordCxt(it, additionalProperties_1.default, "additionalProperties"));
        }
        const allProps = (0, code_1.allSchemaProperties)(schema);
        for (const prop of allProps) {
          it.definedProperties.add(prop);
        }
        if (it.opts.unevaluated && allProps.length && it.props !== true) {
          it.props = util_1.mergeEvaluated.props(gen, (0, util_1.toHash)(allProps), it.props);
        }
        const properties = allProps.filter((p) => !(0, util_1.alwaysValidSchema)(it, schema[p]));
        if (properties.length === 0)
          return;
        const valid = gen.name("valid");
        for (const prop of properties) {
          if (hasDefault(prop)) {
            applyPropertySchema(prop);
          } else {
            gen.if((0, code_1.propertyInData)(gen, data, prop, it.opts.ownProperties));
            applyPropertySchema(prop);
            if (!it.allErrors)
              gen.else().var(valid, true);
            gen.endIf();
          }
          cxt.it.definedProperties.add(prop);
          cxt.ok(valid);
        }
        function hasDefault(prop) {
          return it.opts.useDefaults && !it.compositeRule && schema[prop].default !== void 0;
        }
        function applyPropertySchema(prop) {
          cxt.subschema({
            keyword: "properties",
            schemaProp: prop,
            dataProp: prop
          }, valid);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/patternProperties.js
var require_patternProperties = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/patternProperties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var util_2 = require_util();
    var def = {
      keyword: "patternProperties",
      type: "object",
      schemaType: "object",
      code(cxt) {
        const { gen, schema, data, parentSchema, it } = cxt;
        const { opts } = it;
        const patterns = (0, code_1.allSchemaProperties)(schema);
        const alwaysValidPatterns = patterns.filter((p) => (0, util_1.alwaysValidSchema)(it, schema[p]));
        if (patterns.length === 0 || alwaysValidPatterns.length === patterns.length && (!it.opts.unevaluated || it.props === true)) {
          return;
        }
        const checkProperties = opts.strictSchema && !opts.allowMatchingProperties && parentSchema.properties;
        const valid = gen.name("valid");
        if (it.props !== true && !(it.props instanceof codegen_1.Name)) {
          it.props = (0, util_2.evaluatedPropsToName)(gen, it.props);
        }
        const { props } = it;
        validatePatternProperties();
        function validatePatternProperties() {
          for (const pat of patterns) {
            if (checkProperties)
              checkMatchingProperties(pat);
            if (it.allErrors) {
              validateProperties(pat);
            } else {
              gen.var(valid, true);
              validateProperties(pat);
              gen.if(valid);
            }
          }
        }
        function checkMatchingProperties(pat) {
          for (const prop in checkProperties) {
            if (new RegExp(pat).test(prop)) {
              (0, util_1.checkStrictMode)(it, `property ${prop} matches pattern ${pat} (use allowMatchingProperties)`);
            }
          }
        }
        function validateProperties(pat) {
          gen.forIn("key", data, (key) => {
            gen.if((0, codegen_1._)`${(0, code_1.usePattern)(cxt, pat)}.test(${key})`, () => {
              const alwaysValid = alwaysValidPatterns.includes(pat);
              if (!alwaysValid) {
                cxt.subschema({
                  keyword: "patternProperties",
                  schemaProp: pat,
                  dataProp: key,
                  dataPropType: util_2.Type.Str
                }, valid);
              }
              if (it.opts.unevaluated && props !== true) {
                gen.assign((0, codegen_1._)`${props}[${key}]`, true);
              } else if (!alwaysValid && !it.allErrors) {
                gen.if((0, codegen_1.not)(valid), () => gen.break());
              }
            });
          });
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/not.js
var require_not = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/not.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = require_util();
    var def = {
      keyword: "not",
      schemaType: ["object", "boolean"],
      trackErrors: true,
      code(cxt) {
        const { gen, schema, it } = cxt;
        if ((0, util_1.alwaysValidSchema)(it, schema)) {
          cxt.fail();
          return;
        }
        const valid = gen.name("valid");
        cxt.subschema({
          keyword: "not",
          compositeRule: true,
          createErrors: false,
          allErrors: false
        }, valid);
        cxt.failResult(valid, () => cxt.reset(), () => cxt.error());
      },
      error: { message: "must NOT be valid" }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/anyOf.js
var require_anyOf = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/anyOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var code_1 = require_code2();
    var def = {
      keyword: "anyOf",
      schemaType: "array",
      trackErrors: true,
      code: code_1.validateUnion,
      error: { message: "must match a schema in anyOf" }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/oneOf.js
var require_oneOf = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/oneOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: "must match exactly one schema in oneOf",
      params: ({ params }) => (0, codegen_1._)`{passingSchemas: ${params.passing}}`
    };
    var def = {
      keyword: "oneOf",
      schemaType: "array",
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, schema, parentSchema, it } = cxt;
        if (!Array.isArray(schema))
          throw new Error("ajv implementation error");
        if (it.opts.discriminator && parentSchema.discriminator)
          return;
        const schArr = schema;
        const valid = gen.let("valid", false);
        const passing = gen.let("passing", null);
        const schValid = gen.name("_valid");
        cxt.setParams({ passing });
        gen.block(validateOneOf);
        cxt.result(valid, () => cxt.reset(), () => cxt.error(true));
        function validateOneOf() {
          schArr.forEach((sch, i) => {
            let schCxt;
            if ((0, util_1.alwaysValidSchema)(it, sch)) {
              gen.var(schValid, true);
            } else {
              schCxt = cxt.subschema({
                keyword: "oneOf",
                schemaProp: i,
                compositeRule: true
              }, schValid);
            }
            if (i > 0) {
              gen.if((0, codegen_1._)`${schValid} && ${valid}`).assign(valid, false).assign(passing, (0, codegen_1._)`[${passing}, ${i}]`).else();
            }
            gen.if(schValid, () => {
              gen.assign(valid, true);
              gen.assign(passing, i);
              if (schCxt)
                cxt.mergeEvaluated(schCxt, codegen_1.Name);
            });
          });
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/allOf.js
var require_allOf = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/allOf.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = require_util();
    var def = {
      keyword: "allOf",
      schemaType: "array",
      code(cxt) {
        const { gen, schema, it } = cxt;
        if (!Array.isArray(schema))
          throw new Error("ajv implementation error");
        const valid = gen.name("valid");
        schema.forEach((sch, i) => {
          if ((0, util_1.alwaysValidSchema)(it, sch))
            return;
          const schCxt = cxt.subschema({ keyword: "allOf", schemaProp: i }, valid);
          cxt.ok(valid);
          cxt.mergeEvaluated(schCxt);
        });
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/if.js
var require_if = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/if.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params }) => (0, codegen_1.str)`must match "${params.ifClause}" schema`,
      params: ({ params }) => (0, codegen_1._)`{failingKeyword: ${params.ifClause}}`
    };
    var def = {
      keyword: "if",
      schemaType: ["object", "boolean"],
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, parentSchema, it } = cxt;
        if (parentSchema.then === void 0 && parentSchema.else === void 0) {
          (0, util_1.checkStrictMode)(it, '"if" without "then" and "else" is ignored');
        }
        const hasThen = hasSchema(it, "then");
        const hasElse = hasSchema(it, "else");
        if (!hasThen && !hasElse)
          return;
        const valid = gen.let("valid", true);
        const schValid = gen.name("_valid");
        validateIf();
        cxt.reset();
        if (hasThen && hasElse) {
          const ifClause = gen.let("ifClause");
          cxt.setParams({ ifClause });
          gen.if(schValid, validateClause("then", ifClause), validateClause("else", ifClause));
        } else if (hasThen) {
          gen.if(schValid, validateClause("then"));
        } else {
          gen.if((0, codegen_1.not)(schValid), validateClause("else"));
        }
        cxt.pass(valid, () => cxt.error(true));
        function validateIf() {
          const schCxt = cxt.subschema({
            keyword: "if",
            compositeRule: true,
            createErrors: false,
            allErrors: false
          }, schValid);
          cxt.mergeEvaluated(schCxt);
        }
        function validateClause(keyword, ifClause) {
          return () => {
            const schCxt = cxt.subschema({ keyword }, schValid);
            gen.assign(valid, schValid);
            cxt.mergeValidEvaluated(schCxt, valid);
            if (ifClause)
              gen.assign(ifClause, (0, codegen_1._)`${keyword}`);
            else
              cxt.setParams({ ifClause: keyword });
          };
        }
      }
    };
    function hasSchema(it, keyword) {
      const schema = it.schema[keyword];
      return schema !== void 0 && !(0, util_1.alwaysValidSchema)(it, schema);
    }
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/thenElse.js
var require_thenElse = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/thenElse.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = require_util();
    var def = {
      keyword: ["then", "else"],
      schemaType: ["object", "boolean"],
      code({ keyword, parentSchema, it }) {
        if (parentSchema.if === void 0)
          (0, util_1.checkStrictMode)(it, `"${keyword}" without "if" is ignored`);
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/index.js
var require_applicator = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var additionalItems_1 = require_additionalItems();
    var prefixItems_1 = require_prefixItems();
    var items_1 = require_items();
    var items2020_1 = require_items2020();
    var contains_1 = require_contains();
    var dependencies_1 = require_dependencies();
    var propertyNames_1 = require_propertyNames();
    var additionalProperties_1 = require_additionalProperties();
    var properties_1 = require_properties();
    var patternProperties_1 = require_patternProperties();
    var not_1 = require_not();
    var anyOf_1 = require_anyOf();
    var oneOf_1 = require_oneOf();
    var allOf_1 = require_allOf();
    var if_1 = require_if();
    var thenElse_1 = require_thenElse();
    function getApplicator(draft2020 = false) {
      const applicator = [
        // any
        not_1.default,
        anyOf_1.default,
        oneOf_1.default,
        allOf_1.default,
        if_1.default,
        thenElse_1.default,
        // object
        propertyNames_1.default,
        additionalProperties_1.default,
        dependencies_1.default,
        properties_1.default,
        patternProperties_1.default
      ];
      if (draft2020)
        applicator.push(prefixItems_1.default, items2020_1.default);
      else
        applicator.push(additionalItems_1.default, items_1.default);
      applicator.push(contains_1.default);
      return applicator;
    }
    exports.default = getApplicator;
  }
});

// node_modules/ajv/dist/vocabularies/dynamic/dynamicAnchor.js
var require_dynamicAnchor = __commonJS({
  "node_modules/ajv/dist/vocabularies/dynamic/dynamicAnchor.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.dynamicAnchor = void 0;
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var compile_1 = require_compile();
    var ref_1 = require_ref();
    var def = {
      keyword: "$dynamicAnchor",
      schemaType: "string",
      code: (cxt) => dynamicAnchor(cxt, cxt.schema)
    };
    function dynamicAnchor(cxt, anchor) {
      const { gen, it } = cxt;
      it.schemaEnv.root.dynamicAnchors[anchor] = true;
      const v2 = (0, codegen_1._)`${names_1.default.dynamicAnchors}${(0, codegen_1.getProperty)(anchor)}`;
      const validate = it.errSchemaPath === "#" ? it.validateName : _getValidate(cxt);
      gen.if((0, codegen_1._)`!${v2}`, () => gen.assign(v2, validate));
    }
    exports.dynamicAnchor = dynamicAnchor;
    function _getValidate(cxt) {
      const { schemaEnv, schema, self: self2 } = cxt.it;
      const { root, baseId, localRefs, meta } = schemaEnv.root;
      const { schemaId } = self2.opts;
      const sch = new compile_1.SchemaEnv({ schema, schemaId, root, baseId, localRefs, meta });
      compile_1.compileSchema.call(self2, sch);
      return (0, ref_1.getValidate)(cxt, sch);
    }
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/dynamic/dynamicRef.js
var require_dynamicRef = __commonJS({
  "node_modules/ajv/dist/vocabularies/dynamic/dynamicRef.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.dynamicRef = void 0;
    var codegen_1 = require_codegen();
    var names_1 = require_names();
    var ref_1 = require_ref();
    var def = {
      keyword: "$dynamicRef",
      schemaType: "string",
      code: (cxt) => dynamicRef(cxt, cxt.schema)
    };
    function dynamicRef(cxt, ref) {
      const { gen, keyword, it } = cxt;
      if (ref[0] !== "#")
        throw new Error(`"${keyword}" only supports hash fragment reference`);
      const anchor = ref.slice(1);
      if (it.allErrors) {
        _dynamicRef();
      } else {
        const valid = gen.let("valid", false);
        _dynamicRef(valid);
        cxt.ok(valid);
      }
      function _dynamicRef(valid) {
        if (it.schemaEnv.root.dynamicAnchors[anchor]) {
          const v2 = gen.let("_v", (0, codegen_1._)`${names_1.default.dynamicAnchors}${(0, codegen_1.getProperty)(anchor)}`);
          gen.if(v2, _callRef(v2, valid), _callRef(it.validateName, valid));
        } else {
          _callRef(it.validateName, valid)();
        }
      }
      function _callRef(validate, valid) {
        return valid ? () => gen.block(() => {
          (0, ref_1.callRef)(cxt, validate);
          gen.let(valid, true);
        }) : () => (0, ref_1.callRef)(cxt, validate);
      }
    }
    exports.dynamicRef = dynamicRef;
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/dynamic/recursiveAnchor.js
var require_recursiveAnchor = __commonJS({
  "node_modules/ajv/dist/vocabularies/dynamic/recursiveAnchor.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dynamicAnchor_1 = require_dynamicAnchor();
    var util_1 = require_util();
    var def = {
      keyword: "$recursiveAnchor",
      schemaType: "boolean",
      code(cxt) {
        if (cxt.schema)
          (0, dynamicAnchor_1.dynamicAnchor)(cxt, "");
        else
          (0, util_1.checkStrictMode)(cxt.it, "$recursiveAnchor: false is ignored");
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/dynamic/recursiveRef.js
var require_recursiveRef = __commonJS({
  "node_modules/ajv/dist/vocabularies/dynamic/recursiveRef.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dynamicRef_1 = require_dynamicRef();
    var def = {
      keyword: "$recursiveRef",
      schemaType: "string",
      code: (cxt) => (0, dynamicRef_1.dynamicRef)(cxt, cxt.schema)
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/dynamic/index.js
var require_dynamic = __commonJS({
  "node_modules/ajv/dist/vocabularies/dynamic/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dynamicAnchor_1 = require_dynamicAnchor();
    var dynamicRef_1 = require_dynamicRef();
    var recursiveAnchor_1 = require_recursiveAnchor();
    var recursiveRef_1 = require_recursiveRef();
    var dynamic = [dynamicAnchor_1.default, dynamicRef_1.default, recursiveAnchor_1.default, recursiveRef_1.default];
    exports.default = dynamic;
  }
});

// node_modules/ajv/dist/vocabularies/validation/dependentRequired.js
var require_dependentRequired = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/dependentRequired.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dependencies_1 = require_dependencies();
    var def = {
      keyword: "dependentRequired",
      type: "object",
      schemaType: "object",
      error: dependencies_1.error,
      code: (cxt) => (0, dependencies_1.validatePropertyDeps)(cxt)
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/applicator/dependentSchemas.js
var require_dependentSchemas = __commonJS({
  "node_modules/ajv/dist/vocabularies/applicator/dependentSchemas.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dependencies_1 = require_dependencies();
    var def = {
      keyword: "dependentSchemas",
      type: "object",
      schemaType: "object",
      code: (cxt) => (0, dependencies_1.validateSchemaDeps)(cxt)
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/validation/limitContains.js
var require_limitContains = __commonJS({
  "node_modules/ajv/dist/vocabularies/validation/limitContains.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var util_1 = require_util();
    var def = {
      keyword: ["maxContains", "minContains"],
      type: "array",
      schemaType: "number",
      code({ keyword, parentSchema, it }) {
        if (parentSchema.contains === void 0) {
          (0, util_1.checkStrictMode)(it, `"${keyword}" without "contains" is ignored`);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/next.js
var require_next = __commonJS({
  "node_modules/ajv/dist/vocabularies/next.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var dependentRequired_1 = require_dependentRequired();
    var dependentSchemas_1 = require_dependentSchemas();
    var limitContains_1 = require_limitContains();
    var next = [dependentRequired_1.default, dependentSchemas_1.default, limitContains_1.default];
    exports.default = next;
  }
});

// node_modules/ajv/dist/vocabularies/unevaluated/unevaluatedProperties.js
var require_unevaluatedProperties = __commonJS({
  "node_modules/ajv/dist/vocabularies/unevaluated/unevaluatedProperties.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var names_1 = require_names();
    var error = {
      message: "must NOT have unevaluated properties",
      params: ({ params }) => (0, codegen_1._)`{unevaluatedProperty: ${params.unevaluatedProperty}}`
    };
    var def = {
      keyword: "unevaluatedProperties",
      type: "object",
      schemaType: ["boolean", "object"],
      trackErrors: true,
      error,
      code(cxt) {
        const { gen, schema, data, errsCount, it } = cxt;
        if (!errsCount)
          throw new Error("ajv implementation error");
        const { allErrors, props } = it;
        if (props instanceof codegen_1.Name) {
          gen.if((0, codegen_1._)`${props} !== true`, () => gen.forIn("key", data, (key) => gen.if(unevaluatedDynamic(props, key), () => unevaluatedPropCode(key))));
        } else if (props !== true) {
          gen.forIn("key", data, (key) => props === void 0 ? unevaluatedPropCode(key) : gen.if(unevaluatedStatic(props, key), () => unevaluatedPropCode(key)));
        }
        it.props = true;
        cxt.ok((0, codegen_1._)`${errsCount} === ${names_1.default.errors}`);
        function unevaluatedPropCode(key) {
          if (schema === false) {
            cxt.setParams({ unevaluatedProperty: key });
            cxt.error();
            if (!allErrors)
              gen.break();
            return;
          }
          if (!(0, util_1.alwaysValidSchema)(it, schema)) {
            const valid = gen.name("valid");
            cxt.subschema({
              keyword: "unevaluatedProperties",
              dataProp: key,
              dataPropType: util_1.Type.Str
            }, valid);
            if (!allErrors)
              gen.if((0, codegen_1.not)(valid), () => gen.break());
          }
        }
        function unevaluatedDynamic(evaluatedProps, key) {
          return (0, codegen_1._)`!${evaluatedProps} || !${evaluatedProps}[${key}]`;
        }
        function unevaluatedStatic(evaluatedProps, key) {
          const ps = [];
          for (const p in evaluatedProps) {
            if (evaluatedProps[p] === true)
              ps.push((0, codegen_1._)`${key} !== ${p}`);
          }
          return (0, codegen_1.and)(...ps);
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/unevaluated/unevaluatedItems.js
var require_unevaluatedItems = __commonJS({
  "node_modules/ajv/dist/vocabularies/unevaluated/unevaluatedItems.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var util_1 = require_util();
    var error = {
      message: ({ params: { len } }) => (0, codegen_1.str)`must NOT have more than ${len} items`,
      params: ({ params: { len } }) => (0, codegen_1._)`{limit: ${len}}`
    };
    var def = {
      keyword: "unevaluatedItems",
      type: "array",
      schemaType: ["boolean", "object"],
      error,
      code(cxt) {
        const { gen, schema, data, it } = cxt;
        const items = it.items || 0;
        if (items === true)
          return;
        const len = gen.const("len", (0, codegen_1._)`${data}.length`);
        if (schema === false) {
          cxt.setParams({ len: items });
          cxt.fail((0, codegen_1._)`${len} > ${items}`);
        } else if (typeof schema == "object" && !(0, util_1.alwaysValidSchema)(it, schema)) {
          const valid = gen.var("valid", (0, codegen_1._)`${len} <= ${items}`);
          gen.if((0, codegen_1.not)(valid), () => validateItems(valid, items));
          cxt.ok(valid);
        }
        it.items = true;
        function validateItems(valid, from) {
          gen.forRange("i", from, len, (i) => {
            cxt.subschema({ keyword: "unevaluatedItems", dataProp: i, dataPropType: util_1.Type.Num }, valid);
            if (!it.allErrors)
              gen.if((0, codegen_1.not)(valid), () => gen.break());
          });
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/unevaluated/index.js
var require_unevaluated = __commonJS({
  "node_modules/ajv/dist/vocabularies/unevaluated/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var unevaluatedProperties_1 = require_unevaluatedProperties();
    var unevaluatedItems_1 = require_unevaluatedItems();
    var unevaluated = [unevaluatedProperties_1.default, unevaluatedItems_1.default];
    exports.default = unevaluated;
  }
});

// node_modules/ajv/dist/vocabularies/format/format.js
var require_format = __commonJS({
  "node_modules/ajv/dist/vocabularies/format/format.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var error = {
      message: ({ schemaCode }) => (0, codegen_1.str)`must match format "${schemaCode}"`,
      params: ({ schemaCode }) => (0, codegen_1._)`{format: ${schemaCode}}`
    };
    var def = {
      keyword: "format",
      type: ["number", "string"],
      schemaType: "string",
      $data: true,
      error,
      code(cxt, ruleType) {
        const { gen, data, $data, schema, schemaCode, it } = cxt;
        const { opts, errSchemaPath, schemaEnv, self: self2 } = it;
        if (!opts.validateFormats)
          return;
        if ($data)
          validate$DataFormat();
        else
          validateFormat();
        function validate$DataFormat() {
          const fmts = gen.scopeValue("formats", {
            ref: self2.formats,
            code: opts.code.formats
          });
          const fDef = gen.const("fDef", (0, codegen_1._)`${fmts}[${schemaCode}]`);
          const fType = gen.let("fType");
          const format = gen.let("format");
          gen.if((0, codegen_1._)`typeof ${fDef} == "object" && !(${fDef} instanceof RegExp)`, () => gen.assign(fType, (0, codegen_1._)`${fDef}.type || "string"`).assign(format, (0, codegen_1._)`${fDef}.validate`), () => gen.assign(fType, (0, codegen_1._)`"string"`).assign(format, fDef));
          cxt.fail$data((0, codegen_1.or)(unknownFmt(), invalidFmt()));
          function unknownFmt() {
            if (opts.strictSchema === false)
              return codegen_1.nil;
            return (0, codegen_1._)`${schemaCode} && !${format}`;
          }
          function invalidFmt() {
            const callFormat = schemaEnv.$async ? (0, codegen_1._)`(${fDef}.async ? await ${format}(${data}) : ${format}(${data}))` : (0, codegen_1._)`${format}(${data})`;
            const validData = (0, codegen_1._)`(typeof ${format} == "function" ? ${callFormat} : ${format}.test(${data}))`;
            return (0, codegen_1._)`${format} && ${format} !== true && ${fType} === ${ruleType} && !${validData}`;
          }
        }
        function validateFormat() {
          const formatDef = self2.formats[schema];
          if (!formatDef) {
            unknownFormat();
            return;
          }
          if (formatDef === true)
            return;
          const [fmtType, format, fmtRef] = getFormat(formatDef);
          if (fmtType === ruleType)
            cxt.pass(validCondition());
          function unknownFormat() {
            if (opts.strictSchema === false) {
              self2.logger.warn(unknownMsg());
              return;
            }
            throw new Error(unknownMsg());
            function unknownMsg() {
              return `unknown format "${schema}" ignored in schema at path "${errSchemaPath}"`;
            }
          }
          function getFormat(fmtDef) {
            const code = fmtDef instanceof RegExp ? (0, codegen_1.regexpCode)(fmtDef) : opts.code.formats ? (0, codegen_1._)`${opts.code.formats}${(0, codegen_1.getProperty)(schema)}` : void 0;
            const fmt = gen.scopeValue("formats", { key: schema, ref: fmtDef, code });
            if (typeof fmtDef == "object" && !(fmtDef instanceof RegExp)) {
              return [fmtDef.type || "string", fmtDef.validate, (0, codegen_1._)`${fmt}.validate`];
            }
            return ["string", fmtDef, fmt];
          }
          function validCondition() {
            if (typeof formatDef == "object" && !(formatDef instanceof RegExp) && formatDef.async) {
              if (!schemaEnv.$async)
                throw new Error("async format in sync schema");
              return (0, codegen_1._)`await ${fmtRef}(${data})`;
            }
            return typeof format == "function" ? (0, codegen_1._)`${fmtRef}(${data})` : (0, codegen_1._)`${fmtRef}.test(${data})`;
          }
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/vocabularies/format/index.js
var require_format2 = __commonJS({
  "node_modules/ajv/dist/vocabularies/format/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var format_1 = require_format();
    var format = [format_1.default];
    exports.default = format;
  }
});

// node_modules/ajv/dist/vocabularies/metadata.js
var require_metadata = __commonJS({
  "node_modules/ajv/dist/vocabularies/metadata.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.contentVocabulary = exports.metadataVocabulary = void 0;
    exports.metadataVocabulary = [
      "title",
      "description",
      "default",
      "deprecated",
      "readOnly",
      "writeOnly",
      "examples"
    ];
    exports.contentVocabulary = [
      "contentMediaType",
      "contentEncoding",
      "contentSchema"
    ];
  }
});

// node_modules/ajv/dist/vocabularies/draft2020.js
var require_draft2020 = __commonJS({
  "node_modules/ajv/dist/vocabularies/draft2020.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var core_1 = require_core2();
    var validation_1 = require_validation();
    var applicator_1 = require_applicator();
    var dynamic_1 = require_dynamic();
    var next_1 = require_next();
    var unevaluated_1 = require_unevaluated();
    var format_1 = require_format2();
    var metadata_1 = require_metadata();
    var draft2020Vocabularies = [
      dynamic_1.default,
      core_1.default,
      validation_1.default,
      (0, applicator_1.default)(true),
      format_1.default,
      metadata_1.metadataVocabulary,
      metadata_1.contentVocabulary,
      next_1.default,
      unevaluated_1.default
    ];
    exports.default = draft2020Vocabularies;
  }
});

// node_modules/ajv/dist/vocabularies/discriminator/types.js
var require_types = __commonJS({
  "node_modules/ajv/dist/vocabularies/discriminator/types.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.DiscrError = void 0;
    var DiscrError;
    (function(DiscrError2) {
      DiscrError2["Tag"] = "tag";
      DiscrError2["Mapping"] = "mapping";
    })(DiscrError || (exports.DiscrError = DiscrError = {}));
  }
});

// node_modules/ajv/dist/vocabularies/discriminator/index.js
var require_discriminator = __commonJS({
  "node_modules/ajv/dist/vocabularies/discriminator/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var codegen_1 = require_codegen();
    var types_1 = require_types();
    var compile_1 = require_compile();
    var ref_error_1 = require_ref_error();
    var util_1 = require_util();
    var error = {
      message: ({ params: { discrError, tagName } }) => discrError === types_1.DiscrError.Tag ? `tag "${tagName}" must be string` : `value of tag "${tagName}" must be in oneOf`,
      params: ({ params: { discrError, tag, tagName } }) => (0, codegen_1._)`{error: ${discrError}, tag: ${tagName}, tagValue: ${tag}}`
    };
    var def = {
      keyword: "discriminator",
      type: "object",
      schemaType: "object",
      error,
      code(cxt) {
        const { gen, data, schema, parentSchema, it } = cxt;
        const { oneOf } = parentSchema;
        if (!it.opts.discriminator) {
          throw new Error("discriminator: requires discriminator option");
        }
        const tagName = schema.propertyName;
        if (typeof tagName != "string")
          throw new Error("discriminator: requires propertyName");
        if (schema.mapping)
          throw new Error("discriminator: mapping is not supported");
        if (!oneOf)
          throw new Error("discriminator: requires oneOf keyword");
        const valid = gen.let("valid", false);
        const tag = gen.const("tag", (0, codegen_1._)`${data}${(0, codegen_1.getProperty)(tagName)}`);
        gen.if((0, codegen_1._)`typeof ${tag} == "string"`, () => validateMapping(), () => cxt.error(false, { discrError: types_1.DiscrError.Tag, tag, tagName }));
        cxt.ok(valid);
        function validateMapping() {
          const mapping = getMapping();
          gen.if(false);
          for (const tagValue in mapping) {
            gen.elseIf((0, codegen_1._)`${tag} === ${tagValue}`);
            gen.assign(valid, applyTagSchema(mapping[tagValue]));
          }
          gen.else();
          cxt.error(false, { discrError: types_1.DiscrError.Mapping, tag, tagName });
          gen.endIf();
        }
        function applyTagSchema(schemaProp) {
          const _valid = gen.name("valid");
          const schCxt = cxt.subschema({ keyword: "oneOf", schemaProp }, _valid);
          cxt.mergeEvaluated(schCxt, codegen_1.Name);
          return _valid;
        }
        function getMapping() {
          var _a;
          const oneOfMapping = {};
          const topRequired = hasRequired(parentSchema);
          let tagRequired = true;
          for (let i = 0; i < oneOf.length; i++) {
            let sch = oneOf[i];
            if ((sch === null || sch === void 0 ? void 0 : sch.$ref) && !(0, util_1.schemaHasRulesButRef)(sch, it.self.RULES)) {
              const ref = sch.$ref;
              sch = compile_1.resolveRef.call(it.self, it.schemaEnv.root, it.baseId, ref);
              if (sch instanceof compile_1.SchemaEnv)
                sch = sch.schema;
              if (sch === void 0)
                throw new ref_error_1.default(it.opts.uriResolver, it.baseId, ref);
            }
            const propSch = (_a = sch === null || sch === void 0 ? void 0 : sch.properties) === null || _a === void 0 ? void 0 : _a[tagName];
            if (typeof propSch != "object") {
              throw new Error(`discriminator: oneOf subschemas (or referenced schemas) must have "properties/${tagName}"`);
            }
            tagRequired = tagRequired && (topRequired || hasRequired(sch));
            addMappings(propSch, i);
          }
          if (!tagRequired)
            throw new Error(`discriminator: "${tagName}" must be required`);
          return oneOfMapping;
          function hasRequired({ required }) {
            return Array.isArray(required) && required.includes(tagName);
          }
          function addMappings(sch, i) {
            if (sch.const) {
              addMapping(sch.const, i);
            } else if (sch.enum) {
              for (const tagValue of sch.enum) {
                addMapping(tagValue, i);
              }
            } else {
              throw new Error(`discriminator: "properties/${tagName}" must have "const" or "enum"`);
            }
          }
          function addMapping(tagValue, i) {
            if (typeof tagValue != "string" || tagValue in oneOfMapping) {
              throw new Error(`discriminator: "${tagName}" values must be unique strings`);
            }
            oneOfMapping[tagValue] = i;
          }
        }
      }
    };
    exports.default = def;
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/schema.json
var require_schema = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/schema.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/schema",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/core": true,
        "https://json-schema.org/draft/2020-12/vocab/applicator": true,
        "https://json-schema.org/draft/2020-12/vocab/unevaluated": true,
        "https://json-schema.org/draft/2020-12/vocab/validation": true,
        "https://json-schema.org/draft/2020-12/vocab/meta-data": true,
        "https://json-schema.org/draft/2020-12/vocab/format-annotation": true,
        "https://json-schema.org/draft/2020-12/vocab/content": true
      },
      $dynamicAnchor: "meta",
      title: "Core and Validation specifications meta-schema",
      allOf: [
        { $ref: "meta/core" },
        { $ref: "meta/applicator" },
        { $ref: "meta/unevaluated" },
        { $ref: "meta/validation" },
        { $ref: "meta/meta-data" },
        { $ref: "meta/format-annotation" },
        { $ref: "meta/content" }
      ],
      type: ["object", "boolean"],
      $comment: "This meta-schema also defines keywords that have appeared in previous drafts in order to prevent incompatible extensions as they remain in common use.",
      properties: {
        definitions: {
          $comment: '"definitions" has been replaced by "$defs".',
          type: "object",
          additionalProperties: { $dynamicRef: "#meta" },
          deprecated: true,
          default: {}
        },
        dependencies: {
          $comment: '"dependencies" has been split and replaced by "dependentSchemas" and "dependentRequired" in order to serve their differing semantics.',
          type: "object",
          additionalProperties: {
            anyOf: [{ $dynamicRef: "#meta" }, { $ref: "meta/validation#/$defs/stringArray" }]
          },
          deprecated: true,
          default: {}
        },
        $recursiveAnchor: {
          $comment: '"$recursiveAnchor" has been replaced by "$dynamicAnchor".',
          $ref: "meta/core#/$defs/anchorString",
          deprecated: true
        },
        $recursiveRef: {
          $comment: '"$recursiveRef" has been replaced by "$dynamicRef".',
          $ref: "meta/core#/$defs/uriReferenceString",
          deprecated: true
        }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/applicator.json
var require_applicator2 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/applicator.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/applicator",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/applicator": true
      },
      $dynamicAnchor: "meta",
      title: "Applicator vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        prefixItems: { $ref: "#/$defs/schemaArray" },
        items: { $dynamicRef: "#meta" },
        contains: { $dynamicRef: "#meta" },
        additionalProperties: { $dynamicRef: "#meta" },
        properties: {
          type: "object",
          additionalProperties: { $dynamicRef: "#meta" },
          default: {}
        },
        patternProperties: {
          type: "object",
          additionalProperties: { $dynamicRef: "#meta" },
          propertyNames: { format: "regex" },
          default: {}
        },
        dependentSchemas: {
          type: "object",
          additionalProperties: { $dynamicRef: "#meta" },
          default: {}
        },
        propertyNames: { $dynamicRef: "#meta" },
        if: { $dynamicRef: "#meta" },
        then: { $dynamicRef: "#meta" },
        else: { $dynamicRef: "#meta" },
        allOf: { $ref: "#/$defs/schemaArray" },
        anyOf: { $ref: "#/$defs/schemaArray" },
        oneOf: { $ref: "#/$defs/schemaArray" },
        not: { $dynamicRef: "#meta" }
      },
      $defs: {
        schemaArray: {
          type: "array",
          minItems: 1,
          items: { $dynamicRef: "#meta" }
        }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/unevaluated.json
var require_unevaluated2 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/unevaluated.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/unevaluated",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/unevaluated": true
      },
      $dynamicAnchor: "meta",
      title: "Unevaluated applicator vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        unevaluatedItems: { $dynamicRef: "#meta" },
        unevaluatedProperties: { $dynamicRef: "#meta" }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/content.json
var require_content = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/content.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/content",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/content": true
      },
      $dynamicAnchor: "meta",
      title: "Content vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        contentEncoding: { type: "string" },
        contentMediaType: { type: "string" },
        contentSchema: { $dynamicRef: "#meta" }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/core.json
var require_core3 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/core.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/core",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/core": true
      },
      $dynamicAnchor: "meta",
      title: "Core vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        $id: {
          $ref: "#/$defs/uriReferenceString",
          $comment: "Non-empty fragments not allowed.",
          pattern: "^[^#]*#?$"
        },
        $schema: { $ref: "#/$defs/uriString" },
        $ref: { $ref: "#/$defs/uriReferenceString" },
        $anchor: { $ref: "#/$defs/anchorString" },
        $dynamicRef: { $ref: "#/$defs/uriReferenceString" },
        $dynamicAnchor: { $ref: "#/$defs/anchorString" },
        $vocabulary: {
          type: "object",
          propertyNames: { $ref: "#/$defs/uriString" },
          additionalProperties: {
            type: "boolean"
          }
        },
        $comment: {
          type: "string"
        },
        $defs: {
          type: "object",
          additionalProperties: { $dynamicRef: "#meta" }
        }
      },
      $defs: {
        anchorString: {
          type: "string",
          pattern: "^[A-Za-z_][-A-Za-z0-9._]*$"
        },
        uriString: {
          type: "string",
          format: "uri"
        },
        uriReferenceString: {
          type: "string",
          format: "uri-reference"
        }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/format-annotation.json
var require_format_annotation = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/format-annotation.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/format-annotation",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/format-annotation": true
      },
      $dynamicAnchor: "meta",
      title: "Format vocabulary meta-schema for annotation results",
      type: ["object", "boolean"],
      properties: {
        format: { type: "string" }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/meta-data.json
var require_meta_data = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/meta-data.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/meta-data",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/meta-data": true
      },
      $dynamicAnchor: "meta",
      title: "Meta-data vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        title: {
          type: "string"
        },
        description: {
          type: "string"
        },
        default: true,
        deprecated: {
          type: "boolean",
          default: false
        },
        readOnly: {
          type: "boolean",
          default: false
        },
        writeOnly: {
          type: "boolean",
          default: false
        },
        examples: {
          type: "array",
          items: true
        }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/meta/validation.json
var require_validation2 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/meta/validation.json"(exports, module) {
    module.exports = {
      $schema: "https://json-schema.org/draft/2020-12/schema",
      $id: "https://json-schema.org/draft/2020-12/meta/validation",
      $vocabulary: {
        "https://json-schema.org/draft/2020-12/vocab/validation": true
      },
      $dynamicAnchor: "meta",
      title: "Validation vocabulary meta-schema",
      type: ["object", "boolean"],
      properties: {
        type: {
          anyOf: [
            { $ref: "#/$defs/simpleTypes" },
            {
              type: "array",
              items: { $ref: "#/$defs/simpleTypes" },
              minItems: 1,
              uniqueItems: true
            }
          ]
        },
        const: true,
        enum: {
          type: "array",
          items: true
        },
        multipleOf: {
          type: "number",
          exclusiveMinimum: 0
        },
        maximum: {
          type: "number"
        },
        exclusiveMaximum: {
          type: "number"
        },
        minimum: {
          type: "number"
        },
        exclusiveMinimum: {
          type: "number"
        },
        maxLength: { $ref: "#/$defs/nonNegativeInteger" },
        minLength: { $ref: "#/$defs/nonNegativeIntegerDefault0" },
        pattern: {
          type: "string",
          format: "regex"
        },
        maxItems: { $ref: "#/$defs/nonNegativeInteger" },
        minItems: { $ref: "#/$defs/nonNegativeIntegerDefault0" },
        uniqueItems: {
          type: "boolean",
          default: false
        },
        maxContains: { $ref: "#/$defs/nonNegativeInteger" },
        minContains: {
          $ref: "#/$defs/nonNegativeInteger",
          default: 1
        },
        maxProperties: { $ref: "#/$defs/nonNegativeInteger" },
        minProperties: { $ref: "#/$defs/nonNegativeIntegerDefault0" },
        required: { $ref: "#/$defs/stringArray" },
        dependentRequired: {
          type: "object",
          additionalProperties: {
            $ref: "#/$defs/stringArray"
          }
        }
      },
      $defs: {
        nonNegativeInteger: {
          type: "integer",
          minimum: 0
        },
        nonNegativeIntegerDefault0: {
          $ref: "#/$defs/nonNegativeInteger",
          default: 0
        },
        simpleTypes: {
          enum: ["array", "boolean", "integer", "null", "number", "object", "string"]
        },
        stringArray: {
          type: "array",
          items: { type: "string" },
          uniqueItems: true,
          default: []
        }
      }
    };
  }
});

// node_modules/ajv/dist/refs/json-schema-2020-12/index.js
var require_json_schema_2020_12 = __commonJS({
  "node_modules/ajv/dist/refs/json-schema-2020-12/index.js"(exports) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    var metaSchema = require_schema();
    var applicator = require_applicator2();
    var unevaluated = require_unevaluated2();
    var content = require_content();
    var core = require_core3();
    var format = require_format_annotation();
    var metadata = require_meta_data();
    var validation = require_validation2();
    var META_SUPPORT_DATA = ["/properties"];
    function addMetaSchema2020($data) {
      ;
      [
        metaSchema,
        applicator,
        unevaluated,
        content,
        core,
        with$data(this, format),
        metadata,
        with$data(this, validation)
      ].forEach((sch) => this.addMetaSchema(sch, void 0, false));
      return this;
      function with$data(ajv, sch) {
        return $data ? ajv.$dataMetaSchema(sch, META_SUPPORT_DATA) : sch;
      }
    }
    exports.default = addMetaSchema2020;
  }
});

// node_modules/ajv/dist/2020.js
var require__ = __commonJS({
  "node_modules/ajv/dist/2020.js"(exports, module) {
    "use strict";
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.MissingRefError = exports.ValidationError = exports.CodeGen = exports.Name = exports.nil = exports.stringify = exports.str = exports._ = exports.KeywordCxt = exports.Ajv2020 = void 0;
    var core_1 = require_core();
    var draft2020_1 = require_draft2020();
    var discriminator_1 = require_discriminator();
    var json_schema_2020_12_1 = require_json_schema_2020_12();
    var META_SCHEMA_ID = "https://json-schema.org/draft/2020-12/schema";
    var Ajv20202 = class extends core_1.default {
      constructor(opts = {}) {
        super({
          ...opts,
          dynamicRef: true,
          next: true,
          unevaluated: true
        });
      }
      _addVocabularies() {
        super._addVocabularies();
        draft2020_1.default.forEach((v2) => this.addVocabulary(v2));
        if (this.opts.discriminator)
          this.addKeyword(discriminator_1.default);
      }
      _addDefaultMetaSchema() {
        super._addDefaultMetaSchema();
        const { $data, meta } = this.opts;
        if (!meta)
          return;
        json_schema_2020_12_1.default.call(this, $data);
        this.refs["http://json-schema.org/schema"] = META_SCHEMA_ID;
      }
      defaultMeta() {
        return this.opts.defaultMeta = super.defaultMeta() || (this.getSchema(META_SCHEMA_ID) ? META_SCHEMA_ID : void 0);
      }
    };
    exports.Ajv2020 = Ajv20202;
    module.exports = exports = Ajv20202;
    module.exports.Ajv2020 = Ajv20202;
    Object.defineProperty(exports, "__esModule", { value: true });
    exports.default = Ajv20202;
    var validate_1 = require_validate();
    Object.defineProperty(exports, "KeywordCxt", { enumerable: true, get: function() {
      return validate_1.KeywordCxt;
    } });
    var codegen_1 = require_codegen();
    Object.defineProperty(exports, "_", { enumerable: true, get: function() {
      return codegen_1._;
    } });
    Object.defineProperty(exports, "str", { enumerable: true, get: function() {
      return codegen_1.str;
    } });
    Object.defineProperty(exports, "stringify", { enumerable: true, get: function() {
      return codegen_1.stringify;
    } });
    Object.defineProperty(exports, "nil", { enumerable: true, get: function() {
      return codegen_1.nil;
    } });
    Object.defineProperty(exports, "Name", { enumerable: true, get: function() {
      return codegen_1.Name;
    } });
    Object.defineProperty(exports, "CodeGen", { enumerable: true, get: function() {
      return codegen_1.CodeGen;
    } });
    var validation_error_1 = require_validation_error();
    Object.defineProperty(exports, "ValidationError", { enumerable: true, get: function() {
      return validation_error_1.default;
    } });
    var ref_error_1 = require_ref_error();
    Object.defineProperty(exports, "MissingRefError", { enumerable: true, get: function() {
      return ref_error_1.default;
    } });
  }
});

// node_modules/rbush/rbush.js
var require_rbush = __commonJS({
  "node_modules/rbush/rbush.js"(exports, module) {
    (function(global, factory) {
      typeof exports === "object" && typeof module !== "undefined" ? module.exports = factory() : typeof define === "function" && define.amd ? define(factory) : (global = global || self, global.RBush = factory());
    })(exports, function() {
      "use strict";
      function quickselect(arr, k, left, right, compare) {
        quickselectStep(arr, k, left || 0, right || arr.length - 1, compare || defaultCompare);
      }
      function quickselectStep(arr, k, left, right, compare) {
        while (right > left) {
          if (right - left > 600) {
            var n = right - left + 1;
            var m = k - left + 1;
            var z = Math.log(n);
            var s = 0.5 * Math.exp(2 * z / 3);
            var sd = 0.5 * Math.sqrt(z * s * (n - s) / n) * (m - n / 2 < 0 ? -1 : 1);
            var newLeft = Math.max(left, Math.floor(k - m * s / n + sd));
            var newRight = Math.min(right, Math.floor(k + (n - m) * s / n + sd));
            quickselectStep(arr, k, newLeft, newRight, compare);
          }
          var t = arr[k];
          var i = left;
          var j = right;
          swap(arr, left, k);
          if (compare(arr[right], t) > 0) {
            swap(arr, left, right);
          }
          while (i < j) {
            swap(arr, i, j);
            i++;
            j--;
            while (compare(arr[i], t) < 0) {
              i++;
            }
            while (compare(arr[j], t) > 0) {
              j--;
            }
          }
          if (compare(arr[left], t) === 0) {
            swap(arr, left, j);
          } else {
            j++;
            swap(arr, j, right);
          }
          if (j <= k) {
            left = j + 1;
          }
          if (k <= j) {
            right = j - 1;
          }
        }
      }
      function swap(arr, i, j) {
        var tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
      }
      function defaultCompare(a, b) {
        return a < b ? -1 : a > b ? 1 : 0;
      }
      var RBush = function RBush2(maxEntries) {
        if (maxEntries === void 0) maxEntries = 9;
        this._maxEntries = Math.max(4, maxEntries);
        this._minEntries = Math.max(2, Math.ceil(this._maxEntries * 0.4));
        this.clear();
      };
      RBush.prototype.all = function all() {
        return this._all(this.data, []);
      };
      RBush.prototype.search = function search(bbox2) {
        var node = this.data;
        var result = [];
        if (!intersects(bbox2, node)) {
          return result;
        }
        var toBBox = this.toBBox;
        var nodesToSearch = [];
        while (node) {
          for (var i = 0; i < node.children.length; i++) {
            var child = node.children[i];
            var childBBox = node.leaf ? toBBox(child) : child;
            if (intersects(bbox2, childBBox)) {
              if (node.leaf) {
                result.push(child);
              } else if (contains(bbox2, childBBox)) {
                this._all(child, result);
              } else {
                nodesToSearch.push(child);
              }
            }
          }
          node = nodesToSearch.pop();
        }
        return result;
      };
      RBush.prototype.collides = function collides(bbox2) {
        var node = this.data;
        if (!intersects(bbox2, node)) {
          return false;
        }
        var nodesToSearch = [];
        while (node) {
          for (var i = 0; i < node.children.length; i++) {
            var child = node.children[i];
            var childBBox = node.leaf ? this.toBBox(child) : child;
            if (intersects(bbox2, childBBox)) {
              if (node.leaf || contains(bbox2, childBBox)) {
                return true;
              }
              nodesToSearch.push(child);
            }
          }
          node = nodesToSearch.pop();
        }
        return false;
      };
      RBush.prototype.load = function load(data) {
        if (!(data && data.length)) {
          return this;
        }
        if (data.length < this._minEntries) {
          for (var i = 0; i < data.length; i++) {
            this.insert(data[i]);
          }
          return this;
        }
        var node = this._build(data.slice(), 0, data.length - 1, 0);
        if (!this.data.children.length) {
          this.data = node;
        } else if (this.data.height === node.height) {
          this._splitRoot(this.data, node);
        } else {
          if (this.data.height < node.height) {
            var tmpNode = this.data;
            this.data = node;
            node = tmpNode;
          }
          this._insert(node, this.data.height - node.height - 1, true);
        }
        return this;
      };
      RBush.prototype.insert = function insert(item) {
        if (item) {
          this._insert(item, this.data.height - 1);
        }
        return this;
      };
      RBush.prototype.clear = function clear() {
        this.data = createNode([]);
        return this;
      };
      RBush.prototype.remove = function remove(item, equalsFn) {
        if (!item) {
          return this;
        }
        var node = this.data;
        var bbox2 = this.toBBox(item);
        var path = [];
        var indexes = [];
        var i, parent, goingUp;
        while (node || path.length) {
          if (!node) {
            node = path.pop();
            parent = path[path.length - 1];
            i = indexes.pop();
            goingUp = true;
          }
          if (node.leaf) {
            var index = findItem(item, node.children, equalsFn);
            if (index !== -1) {
              node.children.splice(index, 1);
              path.push(node);
              this._condense(path);
              return this;
            }
          }
          if (!goingUp && !node.leaf && contains(node, bbox2)) {
            path.push(node);
            indexes.push(i);
            i = 0;
            parent = node;
            node = node.children[0];
          } else if (parent) {
            i++;
            node = parent.children[i];
            goingUp = false;
          } else {
            node = null;
          }
        }
        return this;
      };
      RBush.prototype.toBBox = function toBBox(item) {
        return item;
      };
      RBush.prototype.compareMinX = function compareMinX(a, b) {
        return a.minX - b.minX;
      };
      RBush.prototype.compareMinY = function compareMinY(a, b) {
        return a.minY - b.minY;
      };
      RBush.prototype.toJSON = function toJSON() {
        return this.data;
      };
      RBush.prototype.fromJSON = function fromJSON(data) {
        this.data = data;
        return this;
      };
      RBush.prototype._all = function _all(node, result) {
        var nodesToSearch = [];
        while (node) {
          if (node.leaf) {
            result.push.apply(result, node.children);
          } else {
            nodesToSearch.push.apply(nodesToSearch, node.children);
          }
          node = nodesToSearch.pop();
        }
        return result;
      };
      RBush.prototype._build = function _build(items, left, right, height) {
        var N = right - left + 1;
        var M = this._maxEntries;
        var node;
        if (N <= M) {
          node = createNode(items.slice(left, right + 1));
          calcBBox(node, this.toBBox);
          return node;
        }
        if (!height) {
          height = Math.ceil(Math.log(N) / Math.log(M));
          M = Math.ceil(N / Math.pow(M, height - 1));
        }
        node = createNode([]);
        node.leaf = false;
        node.height = height;
        var N2 = Math.ceil(N / M);
        var N1 = N2 * Math.ceil(Math.sqrt(M));
        multiSelect(items, left, right, N1, this.compareMinX);
        for (var i = left; i <= right; i += N1) {
          var right2 = Math.min(i + N1 - 1, right);
          multiSelect(items, i, right2, N2, this.compareMinY);
          for (var j = i; j <= right2; j += N2) {
            var right3 = Math.min(j + N2 - 1, right2);
            node.children.push(this._build(items, j, right3, height - 1));
          }
        }
        calcBBox(node, this.toBBox);
        return node;
      };
      RBush.prototype._chooseSubtree = function _chooseSubtree(bbox2, node, level, path) {
        while (true) {
          path.push(node);
          if (node.leaf || path.length - 1 === level) {
            break;
          }
          var minArea = Infinity;
          var minEnlargement = Infinity;
          var targetNode = void 0;
          for (var i = 0; i < node.children.length; i++) {
            var child = node.children[i];
            var area2 = bboxArea(child);
            var enlargement = enlargedArea(bbox2, child) - area2;
            if (enlargement < minEnlargement) {
              minEnlargement = enlargement;
              minArea = area2 < minArea ? area2 : minArea;
              targetNode = child;
            } else if (enlargement === minEnlargement) {
              if (area2 < minArea) {
                minArea = area2;
                targetNode = child;
              }
            }
          }
          node = targetNode || node.children[0];
        }
        return node;
      };
      RBush.prototype._insert = function _insert(item, level, isNode) {
        var bbox2 = isNode ? item : this.toBBox(item);
        var insertPath = [];
        var node = this._chooseSubtree(bbox2, this.data, level, insertPath);
        node.children.push(item);
        extend(node, bbox2);
        while (level >= 0) {
          if (insertPath[level].children.length > this._maxEntries) {
            this._split(insertPath, level);
            level--;
          } else {
            break;
          }
        }
        this._adjustParentBBoxes(bbox2, insertPath, level);
      };
      RBush.prototype._split = function _split(insertPath, level) {
        var node = insertPath[level];
        var M = node.children.length;
        var m = this._minEntries;
        this._chooseSplitAxis(node, m, M);
        var splitIndex = this._chooseSplitIndex(node, m, M);
        var newNode = createNode(node.children.splice(splitIndex, node.children.length - splitIndex));
        newNode.height = node.height;
        newNode.leaf = node.leaf;
        calcBBox(node, this.toBBox);
        calcBBox(newNode, this.toBBox);
        if (level) {
          insertPath[level - 1].children.push(newNode);
        } else {
          this._splitRoot(node, newNode);
        }
      };
      RBush.prototype._splitRoot = function _splitRoot(node, newNode) {
        this.data = createNode([node, newNode]);
        this.data.height = node.height + 1;
        this.data.leaf = false;
        calcBBox(this.data, this.toBBox);
      };
      RBush.prototype._chooseSplitIndex = function _chooseSplitIndex(node, m, M) {
        var index;
        var minOverlap = Infinity;
        var minArea = Infinity;
        for (var i = m; i <= M - m; i++) {
          var bbox1 = distBBox(node, 0, i, this.toBBox);
          var bbox2 = distBBox(node, i, M, this.toBBox);
          var overlap = intersectionArea(bbox1, bbox2);
          var area2 = bboxArea(bbox1) + bboxArea(bbox2);
          if (overlap < minOverlap) {
            minOverlap = overlap;
            index = i;
            minArea = area2 < minArea ? area2 : minArea;
          } else if (overlap === minOverlap) {
            if (area2 < minArea) {
              minArea = area2;
              index = i;
            }
          }
        }
        return index || M - m;
      };
      RBush.prototype._chooseSplitAxis = function _chooseSplitAxis(node, m, M) {
        var compareMinX = node.leaf ? this.compareMinX : compareNodeMinX;
        var compareMinY = node.leaf ? this.compareMinY : compareNodeMinY;
        var xMargin = this._allDistMargin(node, m, M, compareMinX);
        var yMargin = this._allDistMargin(node, m, M, compareMinY);
        if (xMargin < yMargin) {
          node.children.sort(compareMinX);
        }
      };
      RBush.prototype._allDistMargin = function _allDistMargin(node, m, M, compare) {
        node.children.sort(compare);
        var toBBox = this.toBBox;
        var leftBBox = distBBox(node, 0, m, toBBox);
        var rightBBox = distBBox(node, M - m, M, toBBox);
        var margin = bboxMargin(leftBBox) + bboxMargin(rightBBox);
        for (var i = m; i < M - m; i++) {
          var child = node.children[i];
          extend(leftBBox, node.leaf ? toBBox(child) : child);
          margin += bboxMargin(leftBBox);
        }
        for (var i$1 = M - m - 1; i$1 >= m; i$1--) {
          var child$1 = node.children[i$1];
          extend(rightBBox, node.leaf ? toBBox(child$1) : child$1);
          margin += bboxMargin(rightBBox);
        }
        return margin;
      };
      RBush.prototype._adjustParentBBoxes = function _adjustParentBBoxes(bbox2, path, level) {
        for (var i = level; i >= 0; i--) {
          extend(path[i], bbox2);
        }
      };
      RBush.prototype._condense = function _condense(path) {
        for (var i = path.length - 1, siblings = void 0; i >= 0; i--) {
          if (path[i].children.length === 0) {
            if (i > 0) {
              siblings = path[i - 1].children;
              siblings.splice(siblings.indexOf(path[i]), 1);
            } else {
              this.clear();
            }
          } else {
            calcBBox(path[i], this.toBBox);
          }
        }
      };
      function findItem(item, items, equalsFn) {
        if (!equalsFn) {
          return items.indexOf(item);
        }
        for (var i = 0; i < items.length; i++) {
          if (equalsFn(item, items[i])) {
            return i;
          }
        }
        return -1;
      }
      function calcBBox(node, toBBox) {
        distBBox(node, 0, node.children.length, toBBox, node);
      }
      function distBBox(node, k, p, toBBox, destNode) {
        if (!destNode) {
          destNode = createNode(null);
        }
        destNode.minX = Infinity;
        destNode.minY = Infinity;
        destNode.maxX = -Infinity;
        destNode.maxY = -Infinity;
        for (var i = k; i < p; i++) {
          var child = node.children[i];
          extend(destNode, node.leaf ? toBBox(child) : child);
        }
        return destNode;
      }
      function extend(a, b) {
        a.minX = Math.min(a.minX, b.minX);
        a.minY = Math.min(a.minY, b.minY);
        a.maxX = Math.max(a.maxX, b.maxX);
        a.maxY = Math.max(a.maxY, b.maxY);
        return a;
      }
      function compareNodeMinX(a, b) {
        return a.minX - b.minX;
      }
      function compareNodeMinY(a, b) {
        return a.minY - b.minY;
      }
      function bboxArea(a) {
        return (a.maxX - a.minX) * (a.maxY - a.minY);
      }
      function bboxMargin(a) {
        return a.maxX - a.minX + (a.maxY - a.minY);
      }
      function enlargedArea(a, b) {
        return (Math.max(b.maxX, a.maxX) - Math.min(b.minX, a.minX)) * (Math.max(b.maxY, a.maxY) - Math.min(b.minY, a.minY));
      }
      function intersectionArea(a, b) {
        var minX = Math.max(a.minX, b.minX);
        var minY = Math.max(a.minY, b.minY);
        var maxX = Math.min(a.maxX, b.maxX);
        var maxY = Math.min(a.maxY, b.maxY);
        return Math.max(0, maxX - minX) * Math.max(0, maxY - minY);
      }
      function contains(a, b) {
        return a.minX <= b.minX && a.minY <= b.minY && b.maxX <= a.maxX && b.maxY <= a.maxY;
      }
      function intersects(a, b) {
        return b.minX <= a.maxX && b.minY <= a.maxY && b.maxX >= a.minX && b.maxY >= a.minY;
      }
      function createNode(children) {
        return {
          children,
          height: 1,
          leaf: true,
          minX: Infinity,
          minY: Infinity,
          maxX: -Infinity,
          maxY: -Infinity
        };
      }
      function multiSelect(arr, left, right, n, compare) {
        var stack = [left, right];
        while (stack.length) {
          right = stack.pop();
          left = stack.pop();
          if (right - left <= n) {
            continue;
          }
          var mid = left + Math.ceil((right - left) / n / 2) * n;
          quickselect(arr, mid, left, right, compare);
          stack.push(left, mid, mid, right);
        }
      }
      return RBush;
    });
  }
});

// node_modules/tinyqueue/tinyqueue.js
var require_tinyqueue = __commonJS({
  "node_modules/tinyqueue/tinyqueue.js"(exports, module) {
    (function(global, factory) {
      typeof exports === "object" && typeof module !== "undefined" ? module.exports = factory() : typeof define === "function" && define.amd ? define(factory) : (global = global || self, global.TinyQueue = factory());
    })(exports, function() {
      "use strict";
      var TinyQueue = function TinyQueue2(data, compare) {
        if (data === void 0) data = [];
        if (compare === void 0) compare = defaultCompare;
        this.data = data;
        this.length = this.data.length;
        this.compare = compare;
        if (this.length > 0) {
          for (var i = (this.length >> 1) - 1; i >= 0; i--) {
            this._down(i);
          }
        }
      };
      TinyQueue.prototype.push = function push(item) {
        this.data.push(item);
        this.length++;
        this._up(this.length - 1);
      };
      TinyQueue.prototype.pop = function pop() {
        if (this.length === 0) {
          return void 0;
        }
        var top = this.data[0];
        var bottom = this.data.pop();
        this.length--;
        if (this.length > 0) {
          this.data[0] = bottom;
          this._down(0);
        }
        return top;
      };
      TinyQueue.prototype.peek = function peek() {
        return this.data[0];
      };
      TinyQueue.prototype._up = function _up(pos) {
        var ref = this;
        var data = ref.data;
        var compare = ref.compare;
        var item = data[pos];
        while (pos > 0) {
          var parent = pos - 1 >> 1;
          var current = data[parent];
          if (compare(item, current) >= 0) {
            break;
          }
          data[pos] = current;
          pos = parent;
        }
        data[pos] = item;
      };
      TinyQueue.prototype._down = function _down(pos) {
        var ref = this;
        var data = ref.data;
        var compare = ref.compare;
        var halfLength = this.length >> 1;
        var item = data[pos];
        while (pos < halfLength) {
          var left = (pos << 1) + 1;
          var best = data[left];
          var right = left + 1;
          if (right < this.length && compare(data[right], best) < 0) {
            left = right;
            best = data[right];
          }
          if (compare(best, item) >= 0) {
            break;
          }
          data[pos] = best;
          pos = left;
        }
        data[pos] = item;
      };
      function defaultCompare(a, b) {
        return a < b ? -1 : a > b ? 1 : 0;
      }
      return TinyQueue;
    });
  }
});

// node_modules/@turf/jsts/dist/jsts.min.js
var require_jsts_min = __commonJS({
  "node_modules/@turf/jsts/dist/jsts.min.js"(exports, module) {
    !(function(t, e) {
      "object" == typeof exports && "undefined" != typeof module ? module.exports = e() : "function" == typeof define && define.amd ? define(e) : (t = "undefined" != typeof globalThis ? globalThis : t || self).jsts = e();
    })(exports, (function() {
      "use strict";
      function t(t2, e2) {
        (null == e2 || e2 > t2.length) && (e2 = t2.length);
        for (var n2 = 0, i2 = Array(e2); n2 < e2; n2++) i2[n2] = t2[n2];
        return i2;
      }
      function e(t2, e2, n2) {
        return e2 = u4(e2), (function(t3, e3) {
          if (e3 && ("object" == typeof e3 || "function" == typeof e3)) return e3;
          if (void 0 !== e3) throw new TypeError("Derived constructors may only return object or undefined");
          return (function(t4) {
            if (void 0 === t4) throw new ReferenceError("this hasn't been initialised - super() hasn't been called");
            return t4;
          })(t3);
        })(t2, h() ? Reflect.construct(e2, n2 || [], u4(t2).constructor) : e2.apply(t2, n2));
      }
      function n(t2, e2) {
        if (!(t2 instanceof e2)) throw new TypeError("Cannot call a class as a function");
      }
      function i(t2, e2, n2) {
        if (h()) return Reflect.construct.apply(null, arguments);
        var i2 = [null];
        i2.push.apply(i2, e2);
        var r2 = new (t2.bind.apply(t2, i2))();
        return n2 && c(r2, n2.prototype), r2;
      }
      function r(t2, e2) {
        for (var n2 = 0; n2 < e2.length; n2++) {
          var i2 = e2[n2];
          i2.enumerable = i2.enumerable || false, i2.configurable = true, "value" in i2 && (i2.writable = true), Object.defineProperty(t2, v2(i2.key), i2);
        }
      }
      function s(t2, e2, n2) {
        return e2 && r(t2.prototype, e2), n2 && r(t2, n2), Object.defineProperty(t2, "prototype", { writable: false }), t2;
      }
      function a(t2, e2) {
        var n2 = "undefined" != typeof Symbol && t2[Symbol.iterator] || t2["@@iterator"];
        if (!n2) {
          if (Array.isArray(t2) || (n2 = y(t2)) || e2) {
            n2 && (t2 = n2);
            var i2 = 0, r2 = function() {
            };
            return { s: r2, n: function() {
              return i2 >= t2.length ? { done: true } : { done: false, value: t2[i2++] };
            }, e: function(t3) {
              throw t3;
            }, f: r2 };
          }
          throw new TypeError("Invalid attempt to iterate non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
        }
        var s2, a2 = true, o2 = false;
        return { s: function() {
          n2 = n2.call(t2);
        }, n: function() {
          var t3 = n2.next();
          return a2 = t3.done, t3;
        }, e: function(t3) {
          o2 = true, s2 = t3;
        }, f: function() {
          try {
            a2 || null == n2.return || n2.return();
          } finally {
            if (o2) throw s2;
          }
        } };
      }
      function o() {
        return o = "undefined" != typeof Reflect && Reflect.get ? Reflect.get.bind() : function(t2, e2, n2) {
          var i2 = (function(t3, e3) {
            for (; !{}.hasOwnProperty.call(t3, e3) && null !== (t3 = u4(t3)); ) ;
            return t3;
          })(t2, e2);
          if (i2) {
            var r2 = Object.getOwnPropertyDescriptor(i2, e2);
            return r2.get ? r2.get.call(arguments.length < 3 ? t2 : n2) : r2.value;
          }
        }, o.apply(null, arguments);
      }
      function u4(t2) {
        return u4 = Object.setPrototypeOf ? Object.getPrototypeOf.bind() : function(t3) {
          return t3.__proto__ || Object.getPrototypeOf(t3);
        }, u4(t2);
      }
      function l(t2, e2) {
        if ("function" != typeof e2 && null !== e2) throw new TypeError("Super expression must either be null or a function");
        t2.prototype = Object.create(e2 && e2.prototype, { constructor: { value: t2, writable: true, configurable: true } }), Object.defineProperty(t2, "prototype", { writable: false }), e2 && c(t2, e2);
      }
      function h() {
        try {
          var t2 = !Boolean.prototype.valueOf.call(Reflect.construct(Boolean, [], (function() {
          })));
        } catch (t3) {
        }
        return (h = function() {
          return !!t2;
        })();
      }
      function c(t2, e2) {
        return c = Object.setPrototypeOf ? Object.setPrototypeOf.bind() : function(t3, e3) {
          return t3.__proto__ = e3, t3;
        }, c(t2, e2);
      }
      function f(t2, e2, n2, i2) {
        var r2 = o(u4(1 & i2 ? t2.prototype : t2), e2, n2);
        return 2 & i2 && "function" == typeof r2 ? function(t3) {
          return r2.apply(n2, t3);
        } : r2;
      }
      function g(e2) {
        return (function(e3) {
          if (Array.isArray(e3)) return t(e3);
        })(e2) || (function(t2) {
          if ("undefined" != typeof Symbol && null != t2[Symbol.iterator] || null != t2["@@iterator"]) return Array.from(t2);
        })(e2) || y(e2) || (function() {
          throw new TypeError("Invalid attempt to spread non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
        })();
      }
      function v2(t2) {
        var e2 = (function(t3, e3) {
          if ("object" != typeof t3 || !t3) return t3;
          var n2 = t3[Symbol.toPrimitive];
          if (void 0 !== n2) {
            var i2 = n2.call(t3, e3);
            if ("object" != typeof i2) return i2;
            throw new TypeError("@@toPrimitive must return a primitive value.");
          }
          return String(t3);
        })(t2, "string");
        return "symbol" == typeof e2 ? e2 : e2 + "";
      }
      function y(e2, n2) {
        if (e2) {
          if ("string" == typeof e2) return t(e2, n2);
          var i2 = {}.toString.call(e2).slice(8, -1);
          return "Object" === i2 && e2.constructor && (i2 = e2.constructor.name), "Map" === i2 || "Set" === i2 ? Array.from(e2) : "Arguments" === i2 || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(i2) ? t(e2, n2) : void 0;
        }
      }
      function d(t2) {
        var e2 = "function" == typeof Map ? /* @__PURE__ */ new Map() : void 0;
        return d = function(t3) {
          if (null === t3 || !(function(t4) {
            try {
              return -1 !== Function.toString.call(t4).indexOf("[native code]");
            } catch (e3) {
              return "function" == typeof t4;
            }
          })(t3)) return t3;
          if ("function" != typeof t3) throw new TypeError("Super expression must either be null or a function");
          if (void 0 !== e2) {
            if (e2.has(t3)) return e2.get(t3);
            e2.set(t3, n2);
          }
          function n2() {
            return i(t3, arguments, u4(this).constructor);
          }
          return n2.prototype = Object.create(t3.prototype, { constructor: { value: n2, enumerable: false, writable: true, configurable: true } }), c(n2, t3);
        }, d(t2);
      }
      var _ = (function() {
        function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }
        return s(t2, [{ key: "getEndCapStyle", value: function() {
          return this._endCapStyle;
        } }, { key: "isSingleSided", value: function() {
          return this._isSingleSided;
        } }, { key: "setQuadrantSegments", value: function(e2) {
          this._quadrantSegments = e2, 0 === this._quadrantSegments && (this._joinStyle = t2.JOIN_BEVEL), this._quadrantSegments < 0 && (this._joinStyle = t2.JOIN_MITRE, this._mitreLimit = Math.abs(this._quadrantSegments)), e2 <= 0 && (this._quadrantSegments = 1), this._joinStyle !== t2.JOIN_ROUND && (this._quadrantSegments = t2.DEFAULT_QUADRANT_SEGMENTS);
        } }, { key: "getJoinStyle", value: function() {
          return this._joinStyle;
        } }, { key: "setJoinStyle", value: function(t3) {
          this._joinStyle = t3;
        } }, { key: "setSimplifyFactor", value: function(t3) {
          this._simplifyFactor = t3 < 0 ? 0 : t3;
        } }, { key: "getSimplifyFactor", value: function() {
          return this._simplifyFactor;
        } }, { key: "getQuadrantSegments", value: function() {
          return this._quadrantSegments;
        } }, { key: "setEndCapStyle", value: function(t3) {
          this._endCapStyle = t3;
        } }, { key: "getMitreLimit", value: function() {
          return this._mitreLimit;
        } }, { key: "setMitreLimit", value: function(t3) {
          this._mitreLimit = t3;
        } }, { key: "setSingleSided", value: function(t3) {
          this._isSingleSided = t3;
        } }], [{ key: "constructor_", value: function() {
          if (this._quadrantSegments = t2.DEFAULT_QUADRANT_SEGMENTS, this._endCapStyle = t2.CAP_ROUND, this._joinStyle = t2.JOIN_ROUND, this._mitreLimit = t2.DEFAULT_MITRE_LIMIT, this._isSingleSided = false, this._simplifyFactor = t2.DEFAULT_SIMPLIFY_FACTOR, 0 === arguments.length) ;
          else if (1 === arguments.length) {
            var e2 = arguments[0];
            this.setQuadrantSegments(e2);
          } else if (2 === arguments.length) {
            var n2 = arguments[0], i2 = arguments[1];
            this.setQuadrantSegments(n2), this.setEndCapStyle(i2);
          } else if (4 === arguments.length) {
            var r2 = arguments[0], s2 = arguments[1], a2 = arguments[2], o2 = arguments[3];
            this.setQuadrantSegments(r2), this.setEndCapStyle(s2), this.setJoinStyle(a2), this.setMitreLimit(o2);
          }
        } }, { key: "bufferDistanceError", value: function(t3) {
          var e2 = Math.PI / 2 / t3;
          return 1 - Math.cos(e2 / 2);
        } }]);
      })();
      _.CAP_ROUND = 1, _.CAP_FLAT = 2, _.CAP_SQUARE = 3, _.JOIN_ROUND = 1, _.JOIN_MITRE = 2, _.JOIN_BEVEL = 3, _.DEFAULT_QUADRANT_SEGMENTS = 8, _.DEFAULT_MITRE_LIMIT = 5, _.DEFAULT_SIMPLIFY_FACTOR = 0.01;
      var p = (function(t2) {
        function i2(t3) {
          var r2;
          return n(this, i2), (r2 = e(this, i2, [t3])).name = Object.keys({ Exception: i2 })[0], r2;
        }
        return l(i2, t2), s(i2, [{ key: "toString", value: function() {
          return this.message;
        } }]);
      })(d(Error)), m = (function(t2) {
        function i2(t3) {
          var r2;
          return n(this, i2), (r2 = e(this, i2, [t3])).name = Object.keys({ IllegalArgumentException: i2 })[0], r2;
        }
        return l(i2, t2), s(i2);
      })(p), k = (function() {
        return s((function t2() {
          n(this, t2);
        }), [{ key: "filter", value: function(t2) {
        } }]);
      })();
      function x() {
      }
      function I() {
      }
      function E() {
      }
      var N, T, S, L, C, R, w, O, b = (function() {
        return s((function t2() {
          n(this, t2);
        }), null, [{ key: "equalsWithTolerance", value: function(t2, e2, n2) {
          return Math.abs(t2 - e2) <= n2;
        } }]);
      })(), M = (function() {
        return s((function t2(e2, i2) {
          n(this, t2), this.low = i2 || 0, this.high = e2 || 0;
        }), null, [{ key: "toBinaryString", value: function(t2) {
          var e2, n2 = "";
          for (e2 = 2147483648; e2 > 0; e2 >>>= 1) n2 += (t2.high & e2) === e2 ? "1" : "0";
          for (e2 = 2147483648; e2 > 0; e2 >>>= 1) n2 += (t2.low & e2) === e2 ? "1" : "0";
          return n2;
        } }]);
      })();
      function A() {
      }
      function P() {
      }
      A.NaN = NaN, A.isNaN = function(t2) {
        return Number.isNaN(t2);
      }, A.isInfinite = function(t2) {
        return !Number.isFinite(t2);
      }, A.MAX_VALUE = Number.MAX_VALUE, A.POSITIVE_INFINITY = Number.POSITIVE_INFINITY, A.NEGATIVE_INFINITY = Number.NEGATIVE_INFINITY, "function" == typeof Float64Array && "function" == typeof Int32Array ? (R = 2146435072, w = new Float64Array(1), O = new Int32Array(w.buffer), A.doubleToLongBits = function(t2) {
        w[0] = t2;
        var e2 = 0 | O[0], n2 = 0 | O[1];
        return (n2 & R) === R && 1048575 & n2 && 0 !== e2 && (e2 = 0, n2 = 2146959360), new M(n2, e2);
      }, A.longBitsToDouble = function(t2) {
        return O[0] = t2.low, O[1] = t2.high, w[0];
      }) : (N = 1023, T = Math.log2, S = Math.floor, L = Math.pow, C = (function() {
        for (var t2 = 53; t2 > 0; t2--) {
          var e2 = L(2, t2) - 1;
          if (S(T(e2)) + 1 === t2) return e2;
        }
        return 0;
      })(), A.doubleToLongBits = function(t2) {
        var e2, n2, i2, r2, s2, a2, o2, u5, l2;
        if (t2 < 0 || 1 / t2 === Number.NEGATIVE_INFINITY ? (a2 = 1 << 31, t2 = -t2) : a2 = 0, 0 === t2) return new M(u5 = a2, l2 = 0);
        if (t2 === 1 / 0) return new M(u5 = 2146435072 | a2, l2 = 0);
        if (t2 != t2) return new M(u5 = 2146959360, l2 = 0);
        if (r2 = 0, l2 = 0, (e2 = S(t2)) > 1) if (e2 <= C) (r2 = S(T(e2))) <= 20 ? (l2 = 0, u5 = e2 << 20 - r2 & 1048575) : (l2 = e2 % (n2 = L(2, i2 = r2 - 20)) << 32 - i2, u5 = e2 / n2 & 1048575);
        else for (i2 = e2, l2 = 0; 0 !== (i2 = S(n2 = i2 / 2)); ) r2++, l2 >>>= 1, l2 |= (1 & u5) << 31, u5 >>>= 1, n2 !== i2 && (u5 |= 524288);
        if (o2 = r2 + N, s2 = 0 === e2, e2 = t2 - e2, r2 < 52 && 0 !== e2) for (i2 = 0; ; ) {
          if ((n2 = 2 * e2) >= 1 ? (e2 = n2 - 1, s2 ? (o2--, s2 = false) : (i2 <<= 1, i2 |= 1, r2++)) : (e2 = n2, s2 ? 0 == --o2 && (r2++, s2 = false) : (i2 <<= 1, r2++)), 20 === r2) u5 |= i2, i2 = 0;
          else if (52 === r2) {
            l2 |= i2;
            break;
          }
          if (1 === n2) {
            r2 < 20 ? u5 |= i2 << 20 - r2 : r2 < 52 && (l2 |= i2 << 52 - r2);
            break;
          }
        }
        return u5 |= o2 << 20, new M(u5 |= a2, l2);
      }, A.longBitsToDouble = function(t2) {
        var e2, n2, i2, r2, s2 = t2.high, a2 = t2.low, o2 = s2 & 1 << 31 ? -1 : 1;
        for (i2 = ((2146435072 & s2) >> 20) - N, r2 = 0, n2 = 1 << 19, e2 = 1; e2 <= 20; e2++) s2 & n2 && (r2 += L(2, -e2)), n2 >>>= 1;
        for (n2 = 1 << 31, e2 = 21; e2 <= 52; e2++) a2 & n2 && (r2 += L(2, -e2)), n2 >>>= 1;
        if (-1023 === i2) {
          if (0 === r2) return 0 * o2;
          i2 = -1022;
        } else {
          if (1024 === i2) return 0 === r2 ? o2 / 0 : NaN;
          r2 += 1;
        }
        return o2 * r2 * L(2, i2);
      });
      var D2 = (function(t2) {
        function i2(t3) {
          var r2;
          return n(this, i2), (r2 = e(this, i2, [t3])).name = Object.keys({ RuntimeException: i2 })[0], r2;
        }
        return l(i2, t2), s(i2);
      })(p), F = (function(t2) {
        function i2() {
          var t3;
          return n(this, i2), t3 = e(this, i2), i2.constructor_.apply(t3, arguments), t3;
        }
        return l(i2, t2), s(i2, null, [{ key: "constructor_", value: function() {
          if (0 === arguments.length) D2.constructor_.call(this);
          else if (1 === arguments.length) {
            var t3 = arguments[0];
            D2.constructor_.call(this, t3);
          }
        } }]);
      })(D2), G = (function() {
        function t2() {
          n(this, t2);
        }
        return s(t2, null, [{ key: "shouldNeverReachHere", value: function() {
          if (0 === arguments.length) t2.shouldNeverReachHere(null);
          else if (1 === arguments.length) {
            var e2 = arguments[0];
            throw new F("Should never reach here" + (null !== e2 ? ": " + e2 : ""));
          }
        } }, { key: "isTrue", value: function() {
          if (1 === arguments.length) {
            var e2 = arguments[0];
            t2.isTrue(e2, null);
          } else if (2 === arguments.length) {
            var n2 = arguments[1];
            if (!arguments[0]) throw null === n2 ? new F() : new F(n2);
          }
        } }, { key: "equals", value: function() {
          if (2 === arguments.length) {
            var e2 = arguments[0], n2 = arguments[1];
            t2.equals(e2, n2, null);
          } else if (3 === arguments.length) {
            var i2 = arguments[0], r2 = arguments[1], s2 = arguments[2];
            if (!r2.equals(i2)) throw new F("Expected " + i2 + " but encountered " + r2 + (null !== s2 ? ": " + s2 : ""));
          }
        } }]);
      })(), q = new ArrayBuffer(8), Y = new Float64Array(q), z = new Int32Array(q), X = (function() {
        function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }
        return s(t2, [{ key: "getM", value: function() {
          return A.NaN;
        } }, { key: "setOrdinate", value: function(e2, n2) {
          switch (e2) {
            case t2.X:
              this.x = n2;
              break;
            case t2.Y:
              this.y = n2;
              break;
            case t2.Z:
              this.setZ(n2);
              break;
            default:
              throw new m("Invalid ordinate index: " + e2);
          }
        } }, { key: "equals2D", value: function() {
          if (1 === arguments.length) {
            var t3 = arguments[0];
            return this.x === t3.x && this.y === t3.y;
          }
          if (2 === arguments.length) {
            var e2 = arguments[0], n2 = arguments[1];
            return !!b.equalsWithTolerance(this.x, e2.x, n2) && !!b.equalsWithTolerance(this.y, e2.y, n2);
          }
        } }, { key: "setM", value: function(e2) {
          throw new m("Invalid ordinate index: " + t2.M);
        } }, { key: "getZ", value: function() {
          return this.z;
        } }, { key: "getOrdinate", value: function(e2) {
          switch (e2) {
            case t2.X:
              return this.x;
            case t2.Y:
              return this.y;
            case t2.Z:
              return this.getZ();
          }
          throw new m("Invalid ordinate index: " + e2);
        } }, { key: "equals3D", value: function(t3) {
          return this.x === t3.x && this.y === t3.y && (this.getZ() === t3.getZ() || A.isNaN(this.getZ()) && A.isNaN(t3.getZ()));
        } }, { key: "equals", value: function(e2) {
          return e2 instanceof t2 && this.equals2D(e2);
        } }, { key: "equalInZ", value: function(t3, e2) {
          return b.equalsWithTolerance(this.getZ(), t3.getZ(), e2);
        } }, { key: "setX", value: function(t3) {
          this.x = t3;
        } }, { key: "compareTo", value: function(t3) {
          var e2 = t3;
          return this.x < e2.x ? -1 : this.x > e2.x ? 1 : this.y < e2.y ? -1 : this.y > e2.y ? 1 : 0;
        } }, { key: "getX", value: function() {
          return this.x;
        } }, { key: "setZ", value: function(t3) {
          this.z = t3;
        } }, { key: "clone", value: function() {
          try {
            return null;
          } catch (t3) {
            if (t3 instanceof CloneNotSupportedException) return G.shouldNeverReachHere("this shouldn't happen because this class is Cloneable"), null;
            throw t3;
          }
        } }, { key: "copy", value: function() {
          return new t2(this);
        } }, { key: "toString", value: function() {
          return "(" + this.x + ", " + this.y + ", " + this.getZ() + ")";
        } }, { key: "distance3D", value: function(t3) {
          var e2 = this.x - t3.x, n2 = this.y - t3.y, i2 = this.getZ() - t3.getZ();
          return Math.sqrt(e2 * e2 + n2 * n2 + i2 * i2);
        } }, { key: "getY", value: function() {
          return this.y;
        } }, { key: "setY", value: function(t3) {
          this.y = t3;
        } }, { key: "distance", value: function(t3) {
          var e2 = this.x - t3.x, n2 = this.y - t3.y;
          return Math.sqrt(e2 * e2 + n2 * n2);
        } }, { key: "hashCode", value: function() {
          var e2 = 17;
          return e2 = 37 * (e2 = 37 * e2 + t2.hashCode(this.x)) + t2.hashCode(this.y);
        } }, { key: "setCoordinate", value: function(t3) {
          this.x = t3.x, this.y = t3.y, this.z = t3.getZ();
        } }, { key: "interfaces_", get: function() {
          return [x, I, E];
        } }], [{ key: "constructor_", value: function() {
          if (this.x = null, this.y = null, this.z = null, 0 === arguments.length) t2.constructor_.call(this, 0, 0);
          else if (1 === arguments.length) {
            var e2 = arguments[0];
            t2.constructor_.call(this, e2.x, e2.y, e2.getZ());
          } else if (2 === arguments.length) {
            var n2 = arguments[0], i2 = arguments[1];
            t2.constructor_.call(this, n2, i2, t2.NULL_ORDINATE);
          } else if (3 === arguments.length) {
            var r2 = arguments[0], s2 = arguments[1], a2 = arguments[2];
            this.x = r2, this.y = s2, this.z = a2;
          }
        } }, { key: "hashCode", value: function(t3) {
          return Y[0] = t3, z[0] ^ z[1];
        } }]);
      })(), B2 = (function() {
        function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }
        return s(t2, [{ key: "compare", value: function(e2, n2) {
          var i2 = t2.compare(e2.x, n2.x);
          if (0 !== i2) return i2;
          var r2 = t2.compare(e2.y, n2.y);
          return 0 !== r2 ? r2 : this._dimensionsToTest <= 2 ? 0 : t2.compare(e2.getZ(), n2.getZ());
        } }, { key: "interfaces_", get: function() {
          return [P];
        } }], [{ key: "constructor_", value: function() {
          if (this._dimensionsToTest = 2, 0 === arguments.length) t2.constructor_.call(this, 2);
          else if (1 === arguments.length) {
            var e2 = arguments[0];
            if (2 !== e2 && 3 !== e2) throw new m("only 2 or 3 dimensions may be specified");
            this._dimensionsToTest = e2;
          }
        } }, { key: "compare", value: function(t3, e2) {
          return t3 < e2 ? -1 : t3 > e2 ? 1 : A.isNaN(t3) ? A.isNaN(e2) ? 0 : -1 : A.isNaN(e2) ? 1 : 0;
        } }]);
      })();
      X.DimensionalComparator = B2, X.NULL_ORDINATE = A.NaN, X.X = 0, X.Y = 1, X.Z = 2, X.M = 3;
      var U = (function() {
        function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }
        return s(t2, [{ key: "getArea", value: function() {
          return this.getWidth() * this.getHeight();
        } }, { key: "equals", value: function(e2) {
          if (!(e2 instanceof t2)) return false;
          var n2 = e2;
          return this.isNull() ? n2.isNull() : this._maxx === n2.getMaxX() && this._maxy === n2.getMaxY() && this._minx === n2.getMinX() && this._miny === n2.getMinY();
        } }, { key: "intersection", value: function(e2) {
          if (this.isNull() || e2.isNull() || !this.intersects(e2)) return new t2();
          var n2 = this._minx > e2._minx ? this._minx : e2._minx, i2 = this._miny > e2._miny ? this._miny : e2._miny;
          return new t2(n2, this._maxx < e2._maxx ? this._maxx : e2._maxx, i2, this._maxy < e2._maxy ? this._maxy : e2._maxy);
        } }, { key: "isNull", value: function() {
          return this._maxx < this._minx;
        } }, { key: "getMaxX", value: function() {
          return this._maxx;
        } }, { key: "covers", value: function() {
          if (1 === arguments.length) {
            if (arguments[0] instanceof X) {
              var e2 = arguments[0];
              return this.covers(e2.x, e2.y);
            }
            if (arguments[0] instanceof t2) {
              var n2 = arguments[0];
              return !this.isNull() && !n2.isNull() && (n2.getMinX() >= this._minx && n2.getMaxX() <= this._maxx && n2.getMinY() >= this._miny && n2.getMaxY() <= this._maxy);
            }
          } else if (2 === arguments.length) {
            var i2 = arguments[0], r2 = arguments[1];
            return !this.isNull() && (i2 >= this._minx && i2 <= this._maxx && r2 >= this._miny && r2 <= this._maxy);
          }
        } }, { key: "intersects", value: function() {
          if (1 === arguments.length) {
            if (arguments[0] instanceof t2) {
              var e2 = arguments[0];
              return !this.isNull() && !e2.isNull() && !(e2._minx > this._maxx || e2._maxx < this._minx || e2._miny > this._maxy || e2._maxy < this._miny);
            }
            if (arguments[0] instanceof X) {
              var n2 = arguments[0];
              return this.intersects(n2.x, n2.y);
            }
          } else if (2 === arguments.length) {
            if (arguments[0] instanceof X && arguments[1] instanceof X) {
              var i2 = arguments[0], r2 = arguments[1];
              return !this.isNull() && (!((i2.x < r2.x ? i2.x : r2.x) > this._maxx) && (!((i2.x > r2.x ? i2.x : r2.x) < this._minx) && (!((i2.y < r2.y ? i2.y : r2.y) > this._maxy) && !((i2.y > r2.y ? i2.y : r2.y) < this._miny))));
            }
            if ("number" == typeof arguments[0] && "number" == typeof arguments[1]) {
              var s2 = arguments[0], a2 = arguments[1];
              return !this.isNull() && !(s2 > this._maxx || s2 < this._minx || a2 > this._maxy || a2 < this._miny);
            }
          }
        } }, { key: "getMinY", value: function() {
          return this._miny;
        } }, { key: "getDiameter", value: function() {
          if (this.isNull()) return 0;
          var t3 = this.getWidth(), e2 = this.getHeight();
          return Math.sqrt(t3 * t3 + e2 * e2);
        } }, { key: "getMinX", value: function() {
          return this._minx;
        } }, { key: "expandToInclude", value: function() {
          if (1 === arguments.length) {
            if (arguments[0] instanceof X) {
              var e2 = arguments[0];
              this.expandToInclude(e2.x, e2.y);
            } else if (arguments[0] instanceof t2) {
              var n2 = arguments[0];
              if (n2.isNull()) return null;
              this.isNull() ? (this._minx = n2.getMinX(), this._maxx = n2.getMaxX(), this._miny = n2.getMinY(), this._maxy = n2.getMaxY()) : (n2._minx < this._minx && (this._minx = n2._minx), n2._maxx > this._maxx && (this._maxx = n2._maxx), n2._miny < this._miny && (this._miny = n2._miny), n2._maxy > this._maxy && (this._maxy = n2._maxy));
            }
          } else if (2 === arguments.length) {
            var i2 = arguments[0], r2 = arguments[1];
            this.isNull() ? (this._minx = i2, this._maxx = i2, this._miny = r2, this._maxy = r2) : (i2 < this._minx && (this._minx = i2), i2 > this._maxx && (this._maxx = i2), r2 < this._miny && (this._miny = r2), r2 > this._maxy && (this._maxy = r2));
          }
        } }, { key: "minExtent", value: function() {
          if (this.isNull()) return 0;
          var t3 = this.getWidth(), e2 = this.getHeight();
          return t3 < e2 ? t3 : e2;
        } }, { key: "getWidth", value: function() {
          return this.isNull() ? 0 : this._maxx - this._minx;
        } }, { key: "compareTo", value: function(t3) {
          var e2 = t3;
          return this.isNull() ? e2.isNull() ? 0 : -1 : e2.isNull() ? 1 : this._minx < e2._minx ? -1 : this._minx > e2._minx ? 1 : this._miny < e2._miny ? -1 : this._miny > e2._miny ? 1 : this._maxx < e2._maxx ? -1 : this._maxx > e2._maxx ? 1 : this._maxy < e2._maxy ? -1 : this._maxy > e2._maxy ? 1 : 0;
        } }, { key: "translate", value: function(t3, e2) {
          if (this.isNull()) return null;
          this.init(this.getMinX() + t3, this.getMaxX() + t3, this.getMinY() + e2, this.getMaxY() + e2);
        } }, { key: "copy", value: function() {
          return new t2(this);
        } }, { key: "toString", value: function() {
          return "Env[" + this._minx + " : " + this._maxx + ", " + this._miny + " : " + this._maxy + "]";
        } }, { key: "setToNull", value: function() {
          this._minx = 0, this._maxx = -1, this._miny = 0, this._maxy = -1;
        } }, { key: "disjoint", value: function(t3) {
          return !(!this.isNull() && !t3.isNull()) || (t3._minx > this._maxx || t3._maxx < this._minx || t3._miny > this._maxy || t3._maxy < this._miny);
        } }, { key: "getHeight", value: function() {
          return this.isNull() ? 0 : this._maxy - this._miny;
        } }, { key: "maxExtent", value: function() {
          if (this.isNull()) return 0;
          var t3 = this.getWidth(), e2 = this.getHeight();
          return t3 > e2 ? t3 : e2;
        } }, { key: "expandBy", value: function() {
          if (1 === arguments.length) {
            var t3 = arguments[0];
            this.expandBy(t3, t3);
          } else if (2 === arguments.length) {
            var e2 = arguments[0], n2 = arguments[1];
            if (this.isNull()) return null;
            this._minx -= e2, this._maxx += e2, this._miny -= n2, this._maxy += n2, (this._minx > this._maxx || this._miny > this._maxy) && this.setToNull();
          }
        } }, { key: "contains", value: function() {
          if (1 === arguments.length) {
            if (arguments[0] instanceof t2) {
              var e2 = arguments[0];
              return this.covers(e2);
            }
            if (arguments[0] instanceof X) {
              var n2 = arguments[0];
              return this.covers(n2);
            }
          } else if (2 === arguments.length) {
            var i2 = arguments[0], r2 = arguments[1];
            return this.covers(i2, r2);
          }
        } }, { key: "centre", value: function() {
          return this.isNull() ? null : new X((this.getMinX() + this.getMaxX()) / 2, (this.getMinY() + this.getMaxY()) / 2);
        } }, { key: "init", value: function() {
          if (0 === arguments.length) this.setToNull();
          else if (1 === arguments.length) {
            if (arguments[0] instanceof X) {
              var e2 = arguments[0];
              this.init(e2.x, e2.x, e2.y, e2.y);
            } else if (arguments[0] instanceof t2) {
              var n2 = arguments[0];
              this._minx = n2._minx, this._maxx = n2._maxx, this._miny = n2._miny, this._maxy = n2._maxy;
            }
          } else if (2 === arguments.length) {
            var i2 = arguments[0], r2 = arguments[1];
            this.init(i2.x, r2.x, i2.y, r2.y);
          } else if (4 === arguments.length) {
            var s2 = arguments[0], a2 = arguments[1], o2 = arguments[2], u5 = arguments[3];
            s2 < a2 ? (this._minx = s2, this._maxx = a2) : (this._minx = a2, this._maxx = s2), o2 < u5 ? (this._miny = o2, this._maxy = u5) : (this._miny = u5, this._maxy = o2);
          }
        } }, { key: "getMaxY", value: function() {
          return this._maxy;
        } }, { key: "distance", value: function(t3) {
          if (this.intersects(t3)) return 0;
          var e2 = 0;
          this._maxx < t3._minx ? e2 = t3._minx - this._maxx : this._minx > t3._maxx && (e2 = this._minx - t3._maxx);
          var n2 = 0;
          return this._maxy < t3._miny ? n2 = t3._miny - this._maxy : this._miny > t3._maxy && (n2 = this._miny - t3._maxy), 0 === e2 ? n2 : 0 === n2 ? e2 : Math.sqrt(e2 * e2 + n2 * n2);
        } }, { key: "hashCode", value: function() {
          var t3 = 17;
          return t3 = 37 * (t3 = 37 * (t3 = 37 * (t3 = 37 * t3 + X.hashCode(this._minx)) + X.hashCode(this._maxx)) + X.hashCode(this._miny)) + X.hashCode(this._maxy);
        } }, { key: "interfaces_", get: function() {
          return [x, E];
        } }], [{ key: "constructor_", value: function() {
          if (this._minx = null, this._maxx = null, this._miny = null, this._maxy = null, 0 === arguments.length) this.init();
          else if (1 === arguments.length) {
            if (arguments[0] instanceof X) {
              var e2 = arguments[0];
              this.init(e2.x, e2.x, e2.y, e2.y);
            } else if (arguments[0] instanceof t2) {
              var n2 = arguments[0];
              this.init(n2);
            }
          } else if (2 === arguments.length) {
            var i2 = arguments[0], r2 = arguments[1];
            this.init(i2.x, r2.x, i2.y, r2.y);
          } else if (4 === arguments.length) {
            var s2 = arguments[0], a2 = arguments[1], o2 = arguments[2], u5 = arguments[3];
            this.init(s2, a2, o2, u5);
          }
        } }, { key: "intersects", value: function() {
          if (3 === arguments.length) {
            var t3 = arguments[0], e2 = arguments[1], n2 = arguments[2];
            return n2.x >= (t3.x < e2.x ? t3.x : e2.x) && n2.x <= (t3.x > e2.x ? t3.x : e2.x) && n2.y >= (t3.y < e2.y ? t3.y : e2.y) && n2.y <= (t3.y > e2.y ? t3.y : e2.y);
          }
          if (4 === arguments.length) {
            var i2 = arguments[0], r2 = arguments[1], s2 = arguments[2], a2 = arguments[3], o2 = Math.min(s2.x, a2.x), u5 = Math.max(s2.x, a2.x), l2 = Math.min(i2.x, r2.x), h2 = Math.max(i2.x, r2.x);
            return !(l2 > u5) && (!(h2 < o2) && (o2 = Math.min(s2.y, a2.y), u5 = Math.max(s2.y, a2.y), l2 = Math.min(i2.y, r2.y), h2 = Math.max(i2.y, r2.y), !(l2 > u5) && !(h2 < o2)));
          }
        } }]);
      })(), V = (function() {
        function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }
        return s(t2, [{ key: "isGeometryCollection", value: function() {
          return this.getTypeCode() === t2.TYPECODE_GEOMETRYCOLLECTION;
        } }, { key: "getFactory", value: function() {
          return this._factory;
        } }, { key: "getGeometryN", value: function(t3) {
          return this;
        } }, { key: "getArea", value: function() {
          return 0;
        } }, { key: "isRectangle", value: function() {
          return false;
        } }, { key: "equalsExact", value: function(t3) {
          return this === t3 || this.equalsExact(t3, 0);
        } }, { key: "geometryChanged", value: function() {
          this.apply(t2.geometryChangedFilter);
        } }, { key: "geometryChangedAction", value: function() {
          this._envelope = null;
        } }, { key: "equalsNorm", value: function(t3) {
          return null !== t3 && this.norm().equalsExact(t3.norm());
        } }, { key: "getLength", value: function() {
          return 0;
        } }, { key: "getNumGeometries", value: function() {
          return 1;
        } }, { key: "compareTo", value: function() {
          var t3;
          if (1 === arguments.length) {
            var e2 = arguments[0];
            return t3 = e2, this.getTypeCode() !== t3.getTypeCode() ? this.getTypeCode() - t3.getTypeCode() : this.isEmpty() && t3.isEmpty() ? 0 : this.isEmpty() ? -1 : t3.isEmpty() ? 1 : this.compareToSameClass(e2);
          }
          if (2 === arguments.length) {
            var n2 = arguments[0], i2 = arguments[1];
            return t3 = n2, this.getTypeCode() !== t3.getTypeCode() ? this.getTypeCode() - t3.getTypeCode() : this.isEmpty() && t3.isEmpty() ? 0 : this.isEmpty() ? -1 : t3.isEmpty() ? 1 : this.compareToSameClass(n2, i2);
          }
        } }, { key: "getUserData", value: function() {
          return this._userData;
        } }, { key: "getSRID", value: function() {
          return this._SRID;
        } }, { key: "getEnvelope", value: function() {
          return this.getFactory().toGeometry(this.getEnvelopeInternal());
        } }, { key: "checkNotGeometryCollection", value: function(e2) {
          if (e2.getTypeCode() === t2.TYPECODE_GEOMETRYCOLLECTION) throw new m("This method does not support GeometryCollection arguments");
        } }, { key: "equal", value: function(t3, e2, n2) {
          return 0 === n2 ? t3.equals(e2) : t3.distance(e2) <= n2;
        } }, { key: "norm", value: function() {
          var t3 = this.copy();
          return t3.normalize(), t3;
        } }, { key: "reverse", value: function() {
          var t3 = this.reverseInternal();
          return null != this.envelope && (t3.envelope = this.envelope.copy()), t3.setSRID(this.getSRID()), t3;
        } }, { key: "copy", value: function() {
          var t3 = this.copyInternal();
          return t3.envelope = null == this._envelope ? null : this._envelope.copy(), t3._SRID = this._SRID, t3._userData = this._userData, t3;
        } }, { key: "getPrecisionModel", value: function() {
          return this._factory.getPrecisionModel();
        } }, { key: "getEnvelopeInternal", value: function() {
          return null === this._envelope && (this._envelope = this.computeEnvelopeInternal()), new U(this._envelope);
        } }, { key: "setSRID", value: function(t3) {
          this._SRID = t3;
        } }, { key: "setUserData", value: function(t3) {
          this._userData = t3;
        } }, { key: "compare", value: function(t3, e2) {
          for (var n2 = t3.iterator(), i2 = e2.iterator(); n2.hasNext() && i2.hasNext(); ) {
            var r2 = n2.next(), s2 = i2.next(), a2 = r2.compareTo(s2);
            if (0 !== a2) return a2;
          }
          return n2.hasNext() ? 1 : i2.hasNext() ? -1 : 0;
        } }, { key: "hashCode", value: function() {
          return this.getEnvelopeInternal().hashCode();
        } }, { key: "isEquivalentClass", value: function(t3) {
          return this.getClass() === t3.getClass();
        } }, { key: "isGeometryCollectionOrDerived", value: function() {
          return this.getTypeCode() === t2.TYPECODE_GEOMETRYCOLLECTION || this.getTypeCode() === t2.TYPECODE_MULTIPOINT || this.getTypeCode() === t2.TYPECODE_MULTILINESTRING || this.getTypeCode() === t2.TYPECODE_MULTIPOLYGON;
        } }, { key: "interfaces_", get: function() {
          return [I, x, E];
        } }, { key: "getClass", value: function() {
          return t2;
        } }], [{ key: "hasNonEmptyElements", value: function(t3) {
          for (var e2 = 0; e2 < t3.length; e2++) if (!t3[e2].isEmpty()) return true;
          return false;
        } }, { key: "hasNullElements", value: function(t3) {
          for (var e2 = 0; e2 < t3.length; e2++) if (null === t3[e2]) return true;
          return false;
        } }]);
      })();
      V.constructor_ = function(t2) {
        t2 && (this._envelope = null, this._userData = null, this._factory = t2, this._SRID = t2.getSRID());
      }, V.TYPECODE_POINT = 0, V.TYPECODE_MULTIPOINT = 1, V.TYPECODE_LINESTRING = 2, V.TYPECODE_LINEARRING = 3, V.TYPECODE_MULTILINESTRING = 4, V.TYPECODE_POLYGON = 5, V.TYPECODE_MULTIPOLYGON = 6, V.TYPECODE_GEOMETRYCOLLECTION = 7, V.TYPENAME_POINT = "Point", V.TYPENAME_MULTIPOINT = "MultiPoint", V.TYPENAME_LINESTRING = "LineString", V.TYPENAME_LINEARRING = "LinearRing", V.TYPENAME_MULTILINESTRING = "MultiLineString", V.TYPENAME_POLYGON = "Polygon", V.TYPENAME_MULTIPOLYGON = "MultiPolygon", V.TYPENAME_GEOMETRYCOLLECTION = "GeometryCollection", V.geometryChangedFilter = { get interfaces_() {
        return [k];
      }, filter: function(t2) {
        t2.geometryChangedAction();
      } };
      var H = (function() {
        function t2() {
          n(this, t2);
        }
        return s(t2, null, [{ key: "toLocationSymbol", value: function(e2) {
          switch (e2) {
            case t2.EXTERIOR:
              return "e";
            case t2.BOUNDARY:
              return "b";
            case t2.INTERIOR:
              return "i";
            case t2.NONE:
              return "-";
          }
          throw new m("Unknown location value: " + e2);
        } }]);
      })();
      H.INTERIOR = 0, H.BOUNDARY = 1, H.EXTERIOR = 2, H.NONE = -1;
      var Z = (function() {
        return s((function t2() {
          n(this, t2);
        }), [{ key: "add", value: function() {
        } }, { key: "addAll", value: function() {
        } }, { key: "isEmpty", value: function() {
        } }, { key: "iterator", value: function() {
        } }, { key: "size", value: function() {
        } }, { key: "toArray", value: function() {
        } }, { key: "remove", value: function() {
        } }]);
      })(), j = (function(t2) {
        function i2(t3) {
          var r2;
          return n(this, i2), (r2 = e(this, i2, [t3])).name = Object.keys({ NoSuchElementException: i2 })[0], r2;
        }
        return l(i2, t2), s(i2);
      })(p), W = (function(t2) {
        function i2(t3) {
          var r2;
          return n(this, i2), (r2 = e(this, i2, [t3])).name = Object.keys({ UnsupportedOperationException: i2 })[0], r2;
        }
        return l(i2, t2), s(i2);
      })(p), K = (function(t2) {
        function i2() {
          return n(this, i2), e(this, i2, arguments);
        }
        return l(i2, t2), s(i2, [{ key: "contains", value: function() {
        } }]);
      })(Z), J = (function(t2) {
        function i2(t3) {
          var r2;
          return n(this, i2), (r2 = e(this, i2)).map = /* @__PURE__ */ new Map(), t3 instanceof Z && r2.addAll(t3), r2;
        }
        return l(i2, t2), s(i2, [{ key: "contains", value: function(t3) {
          var e2 = t3.hashCode ? t3.hashCode() : t3;
          return !!this.map.has(e2);
        } }, { key: "add", value: function(t3) {
          var e2 = t3.hashCode ? t3.hashCode() : t3;
          return !this.map.has(e2) && !!this.map.set(e2, t3);
        } }, { key: "addAll", value: function(t3) {
          var e2, n2 = a(t3);
          try {
            for (n2.s(); !(e2 = n2.n()).done; ) {
              var i3 = e2.value;
              this.add(i3);
            }
          } catch (t4) {
            n2.e(t4);
          } finally {
            n2.f();
          }
          return true;
        } }, { key: "remove", value: function() {
          throw new W();
        } }, { key: "size", value: function() {
          return this.map.size;
        } }, { key: "isEmpty", value: function() {
          return 0 === this.map.size;
        } }, { key: "toArray", value: function() {
          return Array.from(this.map.values());
        } }, { key: "iterator", value: function() {
          return new Q(this.map);
        } }, { key: Symbol.iterator, value: function() {
          return this.map;
        } }]);
      })(K), Q = (function() {
        return s((function t2(e2) {
          n(this, t2), this.iterator = e2.values();
          var i2 = this.iterator.next(), r2 = i2.done, s2 = i2.value;
          this.done = r2, this.value = s2;
        }), [{ key: "next", value: function() {
          if (this.done) throw new j();
          var t2 = this.value, e2 = this.iterator.next(), n2 = e2.done, i2 = e2.value;
          return this.done = n2, this.value = i2, t2;
        } }, { key: "hasNext", value: function() {
          return !this.done;
        } }, { key: "remove", value: function() {
          throw new W();
        } }]);
      })(), $ = (function() {
        function t2() {
          n(this, t2);
        }
        return s(t2, null, [{ key: "opposite", value: function(e2) {
          return e2 === t2.LEFT ? t2.RIGHT : e2 === t2.RIGHT ? t2.LEFT : e2;
        } }]);
      })();
      $.ON = 0, $.LEFT = 1, $.RIGHT = 2;
      var tt = (function(t2) {
        function i2(t3) {
          var r2;
          return n(this, i2), (r2 = e(this, i2, [t3])).name = Object.keys({ EmptyStackException: i2 })[0], r2;
        }
        return l(i2, t2), s(i2);
      })(p), et = (function(t2) {
        function i2(t3) {
          var r2;
          return n(this, i2), (r2 = e(this, i2, [t3])).name = Object.keys({ IndexOutOfBoundsException: i2 })[0], r2;
        }
        return l(i2, t2), s(i2);
      })(p), nt = (function(t2) {
        function i2() {
          return n(this, i2), e(this, i2, arguments);
        }
        return l(i2, t2), s(i2, [{ key: "get", value: function() {
        } }, { key: "set", value: function() {
        } }, { key: "isEmpty", value: function() {
        } }]);
      })(Z), it = (function(t2) {
        function i2() {
          var t3;
          return n(this, i2), (t3 = e(this, i2)).array = [], t3;
        }
        return l(i2, t2), s(i2, [{ key: "add", value: function(t3) {
          return this.array.push(t3), true;
        } }, { key: "get", value: function(t3) {
          if (t3 < 0 || t3 >= this.size()) throw new et();
          return this.array[t3];
        } }, { key: "push", value: function(t3) {
          return this.array.push(t3), t3;
        } }, { key: "pop", value: function() {
          if (0 === this.array.length) throw new tt();
          return this.array.pop();
        } }, { key: "peek", value: function() {
          if (0 === this.array.length) throw new tt();
          return this.array[this.array.length - 1];
        } }, { key: "empty", value: function() {
          return 0 === this.array.length;
        } }, { key: "isEmpty", value: function() {
          return this.empty();
        } }, { key: "search", value: function(t3) {
          return this.array.indexOf(t3);
        } }, { key: "size", value: function() {
          return this.array.length;
        } }, { key: "toArray", value: function() {
          return this.array.slice();
        } }]);
      })(nt);
      function rt(t2, e2) {
        return t2.interfaces_ && t2.interfaces_.indexOf(e2) > -1;
      }
      var st = (function() {
        return s((function t2(e2) {
          n(this, t2), this.str = e2;
        }), [{ key: "append", value: function(t2) {
          this.str += t2;
        } }, { key: "setCharAt", value: function(t2, e2) {
          this.str = this.str.substr(0, t2) + e2 + this.str.substr(t2 + 1);
        } }, { key: "toString", value: function() {
          return this.str;
        } }]);
      })(), at = (function() {
        function t2(e2) {
          n(this, t2), this.value = e2;
        }
        return s(t2, [{ key: "intValue", value: function() {
          return this.value;
        } }, { key: "compareTo", value: function(t3) {
          return this.value < t3 ? -1 : this.value > t3 ? 1 : 0;
        } }], [{ key: "compare", value: function(t3, e2) {
          return t3 < e2 ? -1 : t3 > e2 ? 1 : 0;
        } }, { key: "isNan", value: function(t3) {
          return Number.isNaN(t3);
        } }, { key: "valueOf", value: function(e2) {
          return new t2(e2);
        } }]);
      })(), ot = (function() {
        return s((function t2() {
          n(this, t2);
        }), null, [{ key: "isWhitespace", value: function(t2) {
          return t2 <= 32 && t2 >= 0 || 127 === t2;
        } }, { key: "toUpperCase", value: function(t2) {
          return t2.toUpperCase();
        } }]);
      })(), ut = (function() {
        function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }
        return s(t2, [{ key: "le", value: function(t3) {
          return this._hi < t3._hi || this._hi === t3._hi && this._lo <= t3._lo;
        } }, { key: "extractSignificantDigits", value: function(e2, n2) {
          var i2 = this.abs(), r2 = t2.magnitude(i2._hi), s2 = t2.TEN.pow(r2);
          (i2 = i2.divide(s2)).gt(t2.TEN) ? (i2 = i2.divide(t2.TEN), r2 += 1) : i2.lt(t2.ONE) && (i2 = i2.multiply(t2.TEN), r2 -= 1);
          for (var a2 = r2 + 1, o2 = new st(), u5 = t2.MAX_PRINT_DIGITS - 1, l2 = 0; l2 <= u5; l2++) {
            e2 && l2 === a2 && o2.append(".");
            var h2 = Math.trunc(i2._hi);
            if (h2 < 0) break;
            var c2 = false, f2 = 0;
            h2 > 9 ? (c2 = true, f2 = "9") : f2 = "0" + h2, o2.append(f2), i2 = i2.subtract(t2.valueOf(h2)).multiply(t2.TEN), c2 && i2.selfAdd(t2.TEN);
            var g2 = true, v3 = t2.magnitude(i2._hi);
            if (v3 < 0 && Math.abs(v3) >= u5 - l2 && (g2 = false), !g2) break;
          }
          return n2[0] = r2, o2.toString();
        } }, { key: "sqr", value: function() {
          return this.multiply(this);
        } }, { key: "doubleValue", value: function() {
          return this._hi + this._lo;
        } }, { key: "subtract", value: function() {
          if (arguments[0] instanceof t2) {
            var e2 = arguments[0];
            return this.add(e2.negate());
          }
          if ("number" == typeof arguments[0]) {
            var n2 = arguments[0];
            return this.add(-n2);
          }
        } }, { key: "equals", value: function() {
          if (1 === arguments.length && arguments[0] instanceof t2) {
            var e2 = arguments[0];
            return this._hi === e2._hi && this._lo === e2._lo;
          }
        } }, { key: "isZero", value: function() {
          return 0 === this._hi && 0 === this._lo;
        } }, { key: "selfSubtract", value: function() {
          if (arguments[0] instanceof t2) {
            var e2 = arguments[0];
            return this.isNaN() ? this : this.selfAdd(-e2._hi, -e2._lo);
          }
          if ("number" == typeof arguments[0]) {
            var n2 = arguments[0];
            return this.isNaN() ? this : this.selfAdd(-n2, 0);
          }
        } }, { key: "getSpecialNumberString", value: function() {
          return this.isZero() ? "0.0" : this.isNaN() ? "NaN " : null;
        } }, { key: "min", value: function(t3) {
          return this.le(t3) ? this : t3;
        } }, { key: "selfDivide", value: function() {
          if (1 === arguments.length) {
            if (arguments[0] instanceof t2) {
              var e2 = arguments[0];
              return this.selfDivide(e2._hi, e2._lo);
            }
            if ("number" == typeof arguments[0]) {
              var n2 = arguments[0];
              return this.selfDivide(n2, 0);
            }
          } else if (2 === arguments.length) {
            var i2, r2, s2, a2, o2 = arguments[0], u5 = arguments[1], l2 = null, h2 = null, c2 = null, f2 = null;
            return s2 = this._hi / o2, f2 = (l2 = (c2 = t2.SPLIT * s2) - (l2 = c2 - s2)) * (h2 = (f2 = t2.SPLIT * o2) - (h2 = f2 - o2)) - (a2 = s2 * o2) + l2 * (r2 = o2 - h2) + (i2 = s2 - l2) * h2 + i2 * r2, f2 = s2 + (c2 = (this._hi - a2 - f2 + this._lo - s2 * u5) / o2), this._hi = f2, this._lo = s2 - f2 + c2, this;
          }
        } }, { key: "dump", value: function() {
          return "DD<" + this._hi + ", " + this._lo + ">";
        } }, { key: "divide", value: function() {
          if (arguments[0] instanceof t2) {
            var e2, n2, i2, r2, s2 = arguments[0], a2 = null, o2 = null, u5 = null, l2 = null;
            return e2 = (i2 = this._hi / s2._hi) - (a2 = (u5 = t2.SPLIT * i2) - (a2 = u5 - i2)), l2 = a2 * (o2 = (l2 = t2.SPLIT * s2._hi) - (o2 = l2 - s2._hi)) - (r2 = i2 * s2._hi) + a2 * (n2 = s2._hi - o2) + e2 * o2 + e2 * n2, new t2(l2 = i2 + (u5 = (this._hi - r2 - l2 + this._lo - i2 * s2._lo) / s2._hi), i2 - l2 + u5);
          }
          if ("number" == typeof arguments[0]) {
            var h2 = arguments[0];
            return A.isNaN(h2) ? t2.createNaN() : t2.copy(this).selfDivide(h2, 0);
          }
        } }, { key: "ge", value: function(t3) {
          return this._hi > t3._hi || this._hi === t3._hi && this._lo >= t3._lo;
        } }, { key: "pow", value: function(e2) {
          if (0 === e2) return t2.valueOf(1);
          var n2 = new t2(this), i2 = t2.valueOf(1), r2 = Math.abs(e2);
          if (r2 > 1) for (; r2 > 0; ) r2 % 2 == 1 && i2.selfMultiply(n2), (r2 /= 2) > 0 && (n2 = n2.sqr());
          else i2 = n2;
          return e2 < 0 ? i2.reciprocal() : i2;
        } }, { key: "ceil", value: function() {
          if (this.isNaN()) return t2.NaN;
          var e2 = Math.ceil(this._hi), n2 = 0;
          return e2 === this._hi && (n2 = Math.ceil(this._lo)), new t2(e2, n2);
        } }, { key: "compareTo", value: function(t3) {
          var e2 = t3;
          return this._hi < e2._hi ? -1 : this._hi > e2._hi ? 1 : this._lo < e2._lo ? -1 : this._lo > e2._lo ? 1 : 0;
        } }, { key: "rint", value: function() {
          return this.isNaN() ? this : this.add(0.5).floor();
        } }, { key: "setValue", value: function() {
          if (arguments[0] instanceof t2) {
            var e2 = arguments[0];
            return this.init(e2), this;
          }
          if ("number" == typeof arguments[0]) {
            var n2 = arguments[0];
            return this.init(n2), this;
          }
        } }, { key: "max", value: function(t3) {
          return this.ge(t3) ? this : t3;
        } }, { key: "sqrt", value: function() {
          if (this.isZero()) return t2.valueOf(0);
          if (this.isNegative()) return t2.NaN;
          var e2 = 1 / Math.sqrt(this._hi), n2 = this._hi * e2, i2 = t2.valueOf(n2), r2 = this.subtract(i2.sqr())._hi * (0.5 * e2);
          return i2.add(r2);
        } }, { key: "selfAdd", value: function() {
          if (1 === arguments.length) {
            if (arguments[0] instanceof t2) {
              var e2 = arguments[0];
              return this.selfAdd(e2._hi, e2._lo);
            }
            if ("number" == typeof arguments[0]) {
              var n2, i2, r2, s2, a2, o2 = arguments[0], u5 = null;
              return u5 = (r2 = this._hi + o2) - (s2 = r2 - this._hi), i2 = (a2 = (u5 = o2 - s2 + (this._hi - u5)) + this._lo) + (r2 - (n2 = r2 + a2)), this._hi = n2 + i2, this._lo = i2 + (n2 - this._hi), this;
            }
          } else if (2 === arguments.length) {
            var l2, h2, c2, f2, g2 = arguments[0], v3 = arguments[1], y2 = null, d2 = null, _2 = null;
            c2 = this._hi + g2, h2 = this._lo + v3, d2 = c2 - (_2 = c2 - this._hi), y2 = h2 - (f2 = h2 - this._lo);
            var p2 = (l2 = c2 + (_2 = (d2 = g2 - _2 + (this._hi - d2)) + h2)) + (_2 = (y2 = v3 - f2 + (this._lo - y2)) + (_2 + (c2 - l2))), m2 = _2 + (l2 - p2);
            return this._hi = p2, this._lo = m2, this;
          }
        } }, { key: "selfMultiply", value: function() {
          if (1 === arguments.length) {
            if (arguments[0] instanceof t2) {
              var e2 = arguments[0];
              return this.selfMultiply(e2._hi, e2._lo);
            }
            if ("number" == typeof arguments[0]) {
              var n2 = arguments[0];
              return this.selfMultiply(n2, 0);
            }
          } else if (2 === arguments.length) {
            var i2, r2, s2 = arguments[0], a2 = arguments[1], o2 = null, u5 = null, l2 = null, h2 = null;
            o2 = (l2 = t2.SPLIT * this._hi) - this._hi, h2 = t2.SPLIT * s2, o2 = l2 - o2, i2 = this._hi - o2, u5 = h2 - s2;
            var c2 = (l2 = this._hi * s2) + (h2 = o2 * (u5 = h2 - u5) - l2 + o2 * (r2 = s2 - u5) + i2 * u5 + i2 * r2 + (this._hi * a2 + this._lo * s2)), f2 = h2 + (o2 = l2 - c2);
            return this._hi = c2, this._lo = f2, this;
          }
        } }, { key: "selfSqr", value: function() {
          return this.selfMultiply(this);
        } }, { key: "floor", value: function() {
          if (this.isNaN()) return t2.NaN;
          var e2 = Math.floor(this._hi), n2 = 0;
          return e2 === this._hi && (n2 = Math.floor(this._lo)), new t2(e2, n2);
        } }, { key: "negate", value: function() {
          return this.isNaN() ? this : new t2(-this._hi, -this._lo);
        } }, { key: "clone", value: function() {
          try {
            return null;
          } catch (t3) {
            if (t3 instanceof CloneNotSupportedException) return null;
            throw t3;
          }
        } }, { key: "multiply", value: function() {
          if (arguments[0] instanceof t2) {
            var e2 = arguments[0];
            return e2.isNaN() ? t2.createNaN() : t2.copy(this).selfMultiply(e2);
          }
          if ("number" == typeof arguments[0]) {
            var n2 = arguments[0];
            return A.isNaN(n2) ? t2.createNaN() : t2.copy(this).selfMultiply(n2, 0);
          }
        } }, { key: "isNaN", value: function() {
          return A.isNaN(this._hi);
        } }, { key: "intValue", value: function() {
          return Math.trunc(this._hi);
        } }, { key: "toString", value: function() {
          var e2 = t2.magnitude(this._hi);
          return e2 >= -3 && e2 <= 20 ? this.toStandardNotation() : this.toSciNotation();
        } }, { key: "toStandardNotation", value: function() {
          var e2 = this.getSpecialNumberString();
          if (null !== e2) return e2;
          var n2 = new Array(1).fill(null), i2 = this.extractSignificantDigits(true, n2), r2 = n2[0] + 1, s2 = i2;
          if ("." === i2.charAt(0)) s2 = "0" + i2;
          else if (r2 < 0) s2 = "0." + t2.stringOfChar("0", -r2) + i2;
          else if (-1 === i2.indexOf(".")) {
            var a2 = r2 - i2.length;
            s2 = i2 + t2.stringOfChar("0", a2) + ".0";
          }
          return this.isNegative() ? "-" + s2 : s2;
        } }, { key: "reciprocal", value: function() {
          var e2, n2, i2, r2, s2 = null, a2 = null, o2 = null, u5 = null;
          e2 = (i2 = 1 / this._hi) - (s2 = (o2 = t2.SPLIT * i2) - (s2 = o2 - i2)), a2 = (u5 = t2.SPLIT * this._hi) - this._hi;
          var l2 = i2 + (o2 = (1 - (r2 = i2 * this._hi) - (u5 = s2 * (a2 = u5 - a2) - r2 + s2 * (n2 = this._hi - a2) + e2 * a2 + e2 * n2) - i2 * this._lo) / this._hi);
          return new t2(l2, i2 - l2 + o2);
        } }, { key: "toSciNotation", value: function() {
          if (this.isZero()) return t2.SCI_NOT_ZERO;
          var e2 = this.getSpecialNumberString();
          if (null !== e2) return e2;
          var n2 = new Array(1).fill(null), i2 = this.extractSignificantDigits(false, n2), r2 = t2.SCI_NOT_EXPONENT_CHAR + n2[0];
          if ("0" === i2.charAt(0)) throw new IllegalStateException("Found leading zero: " + i2);
          var s2 = "";
          i2.length > 1 && (s2 = i2.substring(1));
          var a2 = i2.charAt(0) + "." + s2;
          return this.isNegative() ? "-" + a2 + r2 : a2 + r2;
        } }, { key: "abs", value: function() {
          return this.isNaN() ? t2.NaN : this.isNegative() ? this.negate() : new t2(this);
        } }, { key: "isPositive", value: function() {
          return this._hi > 0 || 0 === this._hi && this._lo > 0;
        } }, { key: "lt", value: function(t3) {
          return this._hi < t3._hi || this._hi === t3._hi && this._lo < t3._lo;
        } }, { key: "add", value: function() {
          if (arguments[0] instanceof t2) {
            var e2 = arguments[0];
            return t2.copy(this).selfAdd(e2);
          }
          if ("number" == typeof arguments[0]) {
            var n2 = arguments[0];
            return t2.copy(this).selfAdd(n2);
          }
        } }, { key: "init", value: function() {
          if (1 === arguments.length) {
            if ("number" == typeof arguments[0]) {
              var e2 = arguments[0];
              this._hi = e2, this._lo = 0;
            } else if (arguments[0] instanceof t2) {
              var n2 = arguments[0];
              this._hi = n2._hi, this._lo = n2._lo;
            }
          } else if (2 === arguments.length) {
            var i2 = arguments[0], r2 = arguments[1];
            this._hi = i2, this._lo = r2;
          }
        } }, { key: "gt", value: function(t3) {
          return this._hi > t3._hi || this._hi === t3._hi && this._lo > t3._lo;
        } }, { key: "isNegative", value: function() {
          return this._hi < 0 || 0 === this._hi && this._lo < 0;
        } }, { key: "trunc", value: function() {
          return this.isNaN() ? t2.NaN : this.isPositive() ? this.floor() : this.ceil();
        } }, { key: "signum", value: function() {
          return this._hi > 0 ? 1 : this._hi < 0 ? -1 : this._lo > 0 ? 1 : this._lo < 0 ? -1 : 0;
        } }, { key: "interfaces_", get: function() {
          return [E, x, I];
        } }], [{ key: "constructor_", value: function() {
          if (this._hi = 0, this._lo = 0, 0 === arguments.length) this.init(0);
          else if (1 === arguments.length) {
            if ("number" == typeof arguments[0]) {
              var e2 = arguments[0];
              this.init(e2);
            } else if (arguments[0] instanceof t2) {
              var n2 = arguments[0];
              this.init(n2);
            } else if ("string" == typeof arguments[0]) {
              var i2 = arguments[0];
              t2.constructor_.call(this, t2.parse(i2));
            }
          } else if (2 === arguments.length) {
            var r2 = arguments[0], s2 = arguments[1];
            this.init(r2, s2);
          }
        } }, { key: "determinant", value: function() {
          if ("number" == typeof arguments[3] && "number" == typeof arguments[2] && "number" == typeof arguments[0] && "number" == typeof arguments[1]) {
            var e2 = arguments[0], n2 = arguments[1], i2 = arguments[2], r2 = arguments[3];
            return t2.determinant(t2.valueOf(e2), t2.valueOf(n2), t2.valueOf(i2), t2.valueOf(r2));
          }
          if (arguments[3] instanceof t2 && arguments[2] instanceof t2 && arguments[0] instanceof t2 && arguments[1] instanceof t2) {
            var s2 = arguments[1], a2 = arguments[2], o2 = arguments[3];
            return arguments[0].multiply(o2).selfSubtract(s2.multiply(a2));
          }
        } }, { key: "sqr", value: function(e2) {
          return t2.valueOf(e2).selfMultiply(e2);
        } }, { key: "valueOf", value: function() {
          if ("string" == typeof arguments[0]) {
            var e2 = arguments[0];
            return t2.parse(e2);
          }
          if ("number" == typeof arguments[0]) return new t2(arguments[0]);
        } }, { key: "sqrt", value: function(e2) {
          return t2.valueOf(e2).sqrt();
        } }, { key: "parse", value: function(e2) {
          for (var n2 = 0, i2 = e2.length; ot.isWhitespace(e2.charAt(n2)); ) n2++;
          var r2 = false;
          if (n2 < i2) {
            var s2 = e2.charAt(n2);
            "-" !== s2 && "+" !== s2 || (n2++, "-" === s2 && (r2 = true));
          }
          for (var a2 = new t2(), o2 = 0, u5 = 0, l2 = 0, h2 = false; !(n2 >= i2); ) {
            var c2 = e2.charAt(n2);
            if (n2++, ot.isDigit(c2)) {
              var f2 = c2 - "0";
              a2.selfMultiply(t2.TEN), a2.selfAdd(f2), o2++;
            } else {
              if ("." !== c2) {
                if ("e" === c2 || "E" === c2) {
                  var g2 = e2.substring(n2);
                  try {
                    l2 = at.parseInt(g2);
                  } catch (t3) {
                    throw t3 instanceof NumberFormatException ? new NumberFormatException("Invalid exponent " + g2 + " in string " + e2) : t3;
                  }
                  break;
                }
                throw new NumberFormatException("Unexpected character '" + c2 + "' at position " + n2 + " in string " + e2);
              }
              u5 = o2, h2 = true;
            }
          }
          var v3 = a2;
          h2 || (u5 = o2);
          var y2 = o2 - u5 - l2;
          if (0 === y2) v3 = a2;
          else if (y2 > 0) {
            var d2 = t2.TEN.pow(y2);
            v3 = a2.divide(d2);
          } else if (y2 < 0) {
            var _2 = t2.TEN.pow(-y2);
            v3 = a2.multiply(_2);
          }
          return r2 ? v3.negate() : v3;
        } }, { key: "createNaN", value: function() {
          return new t2(A.NaN, A.NaN);
        } }, { key: "copy", value: function(e2) {
          return new t2(e2);
        } }, { key: "magnitude", value: function(t3) {
          var e2 = Math.abs(t3), n2 = Math.log(e2) / Math.log(10), i2 = Math.trunc(Math.floor(n2));
          return 10 * Math.pow(10, i2) <= e2 && (i2 += 1), i2;
        } }, { key: "stringOfChar", value: function(t3, e2) {
          for (var n2 = new st(), i2 = 0; i2 < e2; i2++) n2.append(t3);
          return n2.toString();
        } }]);
      })();
      ut.PI = new ut(3.141592653589793, 12246467991473532e-32), ut.TWO_PI = new ut(6.283185307179586, 24492935982947064e-32), ut.PI_2 = new ut(1.5707963267948966, 6123233995736766e-32), ut.E = new ut(2.718281828459045, 14456468917292502e-32), ut.NaN = new ut(A.NaN, A.NaN), ut.EPS = 123259516440783e-46, ut.SPLIT = 134217729, ut.MAX_PRINT_DIGITS = 32, ut.TEN = ut.valueOf(10), ut.ONE = ut.valueOf(1), ut.SCI_NOT_EXPONENT_CHAR = "E", ut.SCI_NOT_ZERO = "0.0E0";
      var lt = (function() {
        function t2() {
          n(this, t2);
        }
        return s(t2, null, [{ key: "orientationIndex", value: function(e2, n2, i2) {
          var r2 = t2.orientationIndexFilter(e2, n2, i2);
          if (r2 <= 1) return r2;
          var s2 = ut.valueOf(n2.x).selfAdd(-e2.x), a2 = ut.valueOf(n2.y).selfAdd(-e2.y), o2 = ut.valueOf(i2.x).selfAdd(-n2.x), u5 = ut.valueOf(i2.y).selfAdd(-n2.y);
          return s2.selfMultiply(u5).selfSubtract(a2.selfMultiply(o2)).signum();
        } }, { key: "signOfDet2x2", value: function() {
          if (arguments[3] instanceof ut && arguments[2] instanceof ut && arguments[0] instanceof ut && arguments[1] instanceof ut) {
            var t3 = arguments[1], e2 = arguments[2], n2 = arguments[3];
            return arguments[0].multiply(n2).selfSubtract(t3.multiply(e2)).signum();
          }
          if ("number" == typeof arguments[3] && "number" == typeof arguments[2] && "number" == typeof arguments[0] && "number" == typeof arguments[1]) {
            var i2 = arguments[0], r2 = arguments[1], s2 = arguments[2], a2 = arguments[3], o2 = ut.valueOf(i2), u5 = ut.valueOf(r2), l2 = ut.valueOf(s2), h2 = ut.valueOf(a2);
            return o2.multiply(h2).selfSubtract(u5.multiply(l2)).signum();
          }
        } }, { key: "intersection", value: function(t3, e2, n2, i2) {
          var r2 = new ut(t3.y).selfSubtract(e2.y), s2 = new ut(e2.x).selfSubtract(t3.x), a2 = new ut(t3.x).selfMultiply(e2.y).selfSubtract(new ut(e2.x).selfMultiply(t3.y)), o2 = new ut(n2.y).selfSubtract(i2.y), u5 = new ut(i2.x).selfSubtract(n2.x), l2 = new ut(n2.x).selfMultiply(i2.y).selfSubtract(new ut(i2.x).selfMultiply(n2.y)), h2 = s2.multiply(l2).selfSubtract(u5.multiply(a2)), c2 = o2.multiply(a2).selfSubtract(r2.multiply(l2)), f2 = r2.multiply(u5).selfSubtract(o2.multiply(s2)), g2 = h2.selfDivide(f2).doubleValue(), v3 = c2.selfDivide(f2).doubleValue();
          return A.isNaN(g2) || A.isInfinite(g2) || A.isNaN(v3) || A.isInfinite(v3) ? null : new X(g2, v3);
        } }, { key: "orientationIndexFilter", value: function(e2, n2, i2) {
          var r2 = null, s2 = (e2.x - i2.x) * (n2.y - i2.y), a2 = (e2.y - i2.y) * (n2.x - i2.x), o2 = s2 - a2;
          if (s2 > 0) {
            if (a2 <= 0) return t2.signum(o2);
            r2 = s2 + a2;
          } else {
            if (!(s2 < 0)) return t2.signum(o2);
            if (a2 >= 0) return t2.signum(o2);
            r2 = -s2 - a2;
          }
          var u5 = t2.DP_SAFE_EPSILON * r2;
          return o2 >= u5 || -o2 >= u5 ? t2.signum(o2) : 2;
        } }, { key: "signum", value: function(t3) {
          return t3 > 0 ? 1 : t3 < 0 ? -1 : 0;
        } }]);
      })();
      lt.DP_SAFE_EPSILON = 1e-15;
      var ht = (function() {
        return s((function t2() {
          n(this, t2);
        }), [{ key: "getM", value: function(t2) {
          if (this.hasM()) {
            var e2 = this.getDimension() - this.getMeasures();
            return this.getOrdinate(t2, e2);
          }
          return A.NaN;
        } }, { key: "setOrdinate", value: function(t2, e2, n2) {
        } }, { key: "getZ", value: function(t2) {
          return this.hasZ() ? this.getOrdinate(t2, 2) : A.NaN;
        } }, { key: "size", value: function() {
        } }, { key: "getOrdinate", value: function(t2, e2) {
        } }, { key: "getCoordinate", value: function() {
        } }, { key: "getCoordinateCopy", value: function(t2) {
        } }, { key: "createCoordinate", value: function() {
        } }, { key: "getDimension", value: function() {
        } }, { key: "hasM", value: function() {
          return this.getMeasures() > 0;
        } }, { key: "getX", value: function(t2) {
        } }, { key: "hasZ", value: function() {
          return this.getDimension() - this.getMeasures() > 2;
        } }, { key: "getMeasures", value: function() {
          return 0;
        } }, { key: "expandEnvelope", value: function(t2) {
        } }, { key: "copy", value: function() {
        } }, { key: "getY", value: function(t2) {
        } }, { key: "toCoordinateArray", value: function() {
        } }, { key: "interfaces_", get: function() {
          return [I];
        } }]);
      })();
      ht.X = 0, ht.Y = 1, ht.Z = 2, ht.M = 3;
      var ct = (function() {
        function t2() {
          n(this, t2);
        }
        return s(t2, null, [{ key: "index", value: function(t3, e2, n2) {
          return lt.orientationIndex(t3, e2, n2);
        } }, { key: "isCCW", value: function() {
          if (arguments[0] instanceof Array) {
            var e2 = arguments[0], n2 = e2.length - 1;
            if (n2 < 3) throw new m("Ring has fewer than 4 points, so orientation cannot be determined");
            for (var i2 = e2[0], r2 = 0, s2 = 1; s2 <= n2; s2++) {
              var a2 = e2[s2];
              a2.y > i2.y && (i2 = a2, r2 = s2);
            }
            var o2 = r2;
            do {
              (o2 -= 1) < 0 && (o2 = n2);
            } while (e2[o2].equals2D(i2) && o2 !== r2);
            var u5 = r2;
            do {
              u5 = (u5 + 1) % n2;
            } while (e2[u5].equals2D(i2) && u5 !== r2);
            var l2 = e2[o2], h2 = e2[u5];
            if (l2.equals2D(i2) || h2.equals2D(i2) || l2.equals2D(h2)) return false;
            var c2 = t2.index(l2, i2, h2);
            return 0 === c2 ? l2.x > h2.x : c2 > 0;
          }
          if (rt(arguments[0], ht)) {
            var f2 = arguments[0], g2 = f2.size() - 1;
            if (g2 < 3) throw new m("Ring has fewer than 4 points, so orientation cannot be determined");
            for (var v3 = f2.getCoordinate(0), y2 = 0, d2 = 1; d2 <= g2; d2++) {
              var _2 = f2.getCoordinate(d2);
              _2.y > v3.y && (v3 = _2, y2 = d2);
            }
            var p2 = null, k2 = y2;
            do {
              (k2 -= 1) < 0 && (k2 = g2), p2 = f2.getCoordinate(k2);
            } while (p2.equals2D(v3) && k2 !== y2);
            var x2 = null, I2 = y2;
            do {
              I2 = (I2 + 1) % g2, x2 = f2.getCoordinate(I2);
            } while (x2.equals2D(v3) && I2 !== y2);
            if (p2.equals2D(v3) || x2.equals2D(v3) || p2.equals2D(x2)) return false;
            var E2 = t2.index(p2, v3, x2);
            return 0 === E2 ? p2.x > x2.x : E2 > 0;
          }
        } }]);
      })();
      ct.CLOCKWISE = -1, ct.RIGHT = ct.CLOCKWISE, ct.COUNTERCLOCKWISE = 1, ct.LEFT = ct.COUNTERCLOCKWISE, ct.COLLINEAR = 0, ct.STRAIGHT = ct.COLLINEAR;
      var ft = (function() {
        return s((function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }), [{ key: "getCoordinate", value: function() {
          return this._minCoord;
        } }, { key: "getRightmostSide", value: function(t2, e2) {
          var n2 = this.getRightmostSideOfSegment(t2, e2);
          return n2 < 0 && (n2 = this.getRightmostSideOfSegment(t2, e2 - 1)), n2 < 0 && (this._minCoord = null, this.checkForRightmostCoordinate(t2)), n2;
        } }, { key: "findRightmostEdgeAtVertex", value: function() {
          var t2 = this._minDe.getEdge().getCoordinates();
          G.isTrue(this._minIndex > 0 && this._minIndex < t2.length, "rightmost point expected to be interior vertex of edge");
          var e2 = t2[this._minIndex - 1], n2 = t2[this._minIndex + 1], i2 = ct.index(this._minCoord, n2, e2), r2 = false;
          (e2.y < this._minCoord.y && n2.y < this._minCoord.y && i2 === ct.COUNTERCLOCKWISE || e2.y > this._minCoord.y && n2.y > this._minCoord.y && i2 === ct.CLOCKWISE) && (r2 = true), r2 && (this._minIndex = this._minIndex - 1);
        } }, { key: "getRightmostSideOfSegment", value: function(t2, e2) {
          var n2 = t2.getEdge().getCoordinates();
          if (e2 < 0 || e2 + 1 >= n2.length) return -1;
          if (n2[e2].y === n2[e2 + 1].y) return -1;
          var i2 = $.LEFT;
          return n2[e2].y < n2[e2 + 1].y && (i2 = $.RIGHT), i2;
        } }, { key: "getEdge", value: function() {
          return this._orientedDe;
        } }, { key: "checkForRightmostCoordinate", value: function(t2) {
          for (var e2 = t2.getEdge().getCoordinates(), n2 = 0; n2 < e2.length - 1; n2++) (null === this._minCoord || e2[n2].x > this._minCoord.x) && (this._minDe = t2, this._minIndex = n2, this._minCoord = e2[n2]);
        } }, { key: "findRightmostEdgeAtNode", value: function() {
          var t2 = this._minDe.getNode().getEdges();
          this._minDe = t2.getRightmostEdge(), this._minDe.isForward() || (this._minDe = this._minDe.getSym(), this._minIndex = this._minDe.getEdge().getCoordinates().length - 1);
        } }, { key: "findEdge", value: function(t2) {
          for (var e2 = t2.iterator(); e2.hasNext(); ) {
            var n2 = e2.next();
            n2.isForward() && this.checkForRightmostCoordinate(n2);
          }
          G.isTrue(0 !== this._minIndex || this._minCoord.equals(this._minDe.getCoordinate()), "inconsistency in rightmost processing"), 0 === this._minIndex ? this.findRightmostEdgeAtNode() : this.findRightmostEdgeAtVertex(), this._orientedDe = this._minDe, this.getRightmostSide(this._minDe, this._minIndex) === $.LEFT && (this._orientedDe = this._minDe.getSym());
        } }], [{ key: "constructor_", value: function() {
          this._minIndex = -1, this._minCoord = null, this._minDe = null, this._orientedDe = null;
        } }]);
      })(), gt = (function(t2) {
        function i2(t3, r2) {
          var s2;
          return n(this, i2), (s2 = e(this, i2, [r2 ? t3 + " [ " + r2 + " ]" : t3])).pt = r2 ? new X(r2) : void 0, s2.name = Object.keys({ TopologyException: i2 })[0], s2;
        }
        return l(i2, t2), s(i2, [{ key: "getCoordinate", value: function() {
          return this.pt;
        } }]);
      })(D2), vt = (function() {
        return s((function t2() {
          n(this, t2), this.array = [];
        }), [{ key: "addLast", value: function(t2) {
          this.array.push(t2);
        } }, { key: "removeFirst", value: function() {
          return this.array.shift();
        } }, { key: "isEmpty", value: function() {
          return 0 === this.array.length;
        } }]);
      })(), yt = (function(t2) {
        function i2(t3) {
          var r2;
          return n(this, i2), (r2 = e(this, i2)).array = [], t3 instanceof Z && r2.addAll(t3), r2;
        }
        return l(i2, t2), s(i2, [{ key: "interfaces_", get: function() {
          return [nt, Z];
        } }, { key: "ensureCapacity", value: function() {
        } }, { key: "add", value: function(t3) {
          return 1 === arguments.length ? this.array.push(t3) : this.array.splice(arguments[0], 0, arguments[1]), true;
        } }, { key: "clear", value: function() {
          this.array = [];
        } }, { key: "addAll", value: function(t3) {
          var e2, n2 = a(t3);
          try {
            for (n2.s(); !(e2 = n2.n()).done; ) {
              var i3 = e2.value;
              this.array.push(i3);
            }
          } catch (t4) {
            n2.e(t4);
          } finally {
            n2.f();
          }
        } }, { key: "set", value: function(t3, e2) {
          var n2 = this.array[t3];
          return this.array[t3] = e2, n2;
        } }, { key: "iterator", value: function() {
          return new dt(this);
        } }, { key: "get", value: function(t3) {
          if (t3 < 0 || t3 >= this.size()) throw new et();
          return this.array[t3];
        } }, { key: "isEmpty", value: function() {
          return 0 === this.array.length;
        } }, { key: "sort", value: function(t3) {
          t3 ? this.array.sort((function(e2, n2) {
            return t3.compare(e2, n2);
          })) : this.array.sort();
        } }, { key: "size", value: function() {
          return this.array.length;
        } }, { key: "toArray", value: function() {
          return this.array.slice();
        } }, { key: "remove", value: function(t3) {
          for (var e2 = 0, n2 = this.array.length; e2 < n2; e2++) if (this.array[e2] === t3) return !!this.array.splice(e2, 1);
          return false;
        } }, { key: Symbol.iterator, value: function() {
          return this.array.values();
        } }]);
      })(nt), dt = (function() {
        return s((function t2(e2) {
          n(this, t2), this.arrayList = e2, this.position = 0;
        }), [{ key: "next", value: function() {
          if (this.position === this.arrayList.size()) throw new j();
          return this.arrayList.get(this.position++);
        } }, { key: "hasNext", value: function() {
          return this.position < this.arrayList.size();
        } }, { key: "set", value: function(t2) {
          return this.arrayList.set(this.position - 1, t2);
        } }, { key: "remove", value: function() {
          this.arrayList.remove(this.arrayList.get(this.position));
        } }]);
      })(), _t = (function() {
        return s((function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }), [{ key: "clearVisitedEdges", value: function() {
          for (var t2 = this._dirEdgeList.iterator(); t2.hasNext(); ) {
            t2.next().setVisited(false);
          }
        } }, { key: "getRightmostCoordinate", value: function() {
          return this._rightMostCoord;
        } }, { key: "computeNodeDepth", value: function(t2) {
          for (var e2 = null, n2 = t2.getEdges().iterator(); n2.hasNext(); ) {
            var i2 = n2.next();
            if (i2.isVisited() || i2.getSym().isVisited()) {
              e2 = i2;
              break;
            }
          }
          if (null === e2) throw new gt("unable to find edge to compute depths at " + t2.getCoordinate());
          t2.getEdges().computeDepths(e2);
          for (var r2 = t2.getEdges().iterator(); r2.hasNext(); ) {
            var s2 = r2.next();
            s2.setVisited(true), this.copySymDepths(s2);
          }
        } }, { key: "computeDepth", value: function(t2) {
          this.clearVisitedEdges();
          var e2 = this._finder.getEdge();
          e2.getNode(), e2.getLabel(), e2.setEdgeDepths($.RIGHT, t2), this.copySymDepths(e2), this.computeDepths(e2);
        } }, { key: "create", value: function(t2) {
          this.addReachable(t2), this._finder.findEdge(this._dirEdgeList), this._rightMostCoord = this._finder.getCoordinate();
        } }, { key: "findResultEdges", value: function() {
          for (var t2 = this._dirEdgeList.iterator(); t2.hasNext(); ) {
            var e2 = t2.next();
            e2.getDepth($.RIGHT) >= 1 && e2.getDepth($.LEFT) <= 0 && !e2.isInteriorAreaEdge() && e2.setInResult(true);
          }
        } }, { key: "computeDepths", value: function(t2) {
          var e2 = new J(), n2 = new vt(), i2 = t2.getNode();
          for (n2.addLast(i2), e2.add(i2), t2.setVisited(true); !n2.isEmpty(); ) {
            var r2 = n2.removeFirst();
            e2.add(r2), this.computeNodeDepth(r2);
            for (var s2 = r2.getEdges().iterator(); s2.hasNext(); ) {
              var a2 = s2.next().getSym();
              if (!a2.isVisited()) {
                var o2 = a2.getNode();
                e2.contains(o2) || (n2.addLast(o2), e2.add(o2));
              }
            }
          }
        } }, { key: "compareTo", value: function(t2) {
          var e2 = t2;
          return this._rightMostCoord.x < e2._rightMostCoord.x ? -1 : this._rightMostCoord.x > e2._rightMostCoord.x ? 1 : 0;
        } }, { key: "getEnvelope", value: function() {
          if (null === this._env) {
            for (var t2 = new U(), e2 = this._dirEdgeList.iterator(); e2.hasNext(); ) for (var n2 = e2.next().getEdge().getCoordinates(), i2 = 0; i2 < n2.length - 1; i2++) t2.expandToInclude(n2[i2]);
            this._env = t2;
          }
          return this._env;
        } }, { key: "addReachable", value: function(t2) {
          var e2 = new it();
          for (e2.add(t2); !e2.empty(); ) {
            var n2 = e2.pop();
            this.add(n2, e2);
          }
        } }, { key: "copySymDepths", value: function(t2) {
          var e2 = t2.getSym();
          e2.setDepth($.LEFT, t2.getDepth($.RIGHT)), e2.setDepth($.RIGHT, t2.getDepth($.LEFT));
        } }, { key: "add", value: function(t2, e2) {
          t2.setVisited(true), this._nodes.add(t2);
          for (var n2 = t2.getEdges().iterator(); n2.hasNext(); ) {
            var i2 = n2.next();
            this._dirEdgeList.add(i2);
            var r2 = i2.getSym().getNode();
            r2.isVisited() || e2.push(r2);
          }
        } }, { key: "getNodes", value: function() {
          return this._nodes;
        } }, { key: "getDirectedEdges", value: function() {
          return this._dirEdgeList;
        } }, { key: "interfaces_", get: function() {
          return [x];
        } }], [{ key: "constructor_", value: function() {
          this._finder = null, this._dirEdgeList = new yt(), this._nodes = new yt(), this._rightMostCoord = null, this._env = null, this._finder = new ft();
        } }]);
      })(), pt = (function() {
        return s((function t2() {
          n(this, t2);
        }), null, [{ key: "intersection", value: function(t2, e2, n2, i2) {
          var r2 = t2.x < e2.x ? t2.x : e2.x, s2 = t2.y < e2.y ? t2.y : e2.y, a2 = t2.x > e2.x ? t2.x : e2.x, o2 = t2.y > e2.y ? t2.y : e2.y, u5 = n2.x < i2.x ? n2.x : i2.x, l2 = n2.y < i2.y ? n2.y : i2.y, h2 = n2.x > i2.x ? n2.x : i2.x, c2 = n2.y > i2.y ? n2.y : i2.y, f2 = ((r2 > u5 ? r2 : u5) + (a2 < h2 ? a2 : h2)) / 2, g2 = ((s2 > l2 ? s2 : l2) + (o2 < c2 ? o2 : c2)) / 2, v3 = t2.x - f2, y2 = t2.y - g2, d2 = e2.x - f2, _2 = e2.y - g2, p2 = n2.x - f2, m2 = n2.y - g2, k2 = i2.x - f2, x2 = i2.y - g2, I2 = y2 - _2, E2 = d2 - v3, N2 = v3 * _2 - d2 * y2, T2 = m2 - x2, S2 = k2 - p2, L2 = p2 * x2 - k2 * m2, C3 = I2 * S2 - T2 * E2, R2 = (E2 * L2 - S2 * N2) / C3, w2 = (T2 * N2 - I2 * L2) / C3;
          return A.isNaN(R2) || A.isInfinite(R2) || A.isNaN(w2) || A.isInfinite(w2) ? null : new X(R2 + f2, w2 + g2);
        } }]);
      })(), mt = (function() {
        return s((function t2() {
          n(this, t2);
        }), null, [{ key: "arraycopy", value: function(t2, e2, n2, i2, r2) {
          for (var s2 = 0, a2 = e2; a2 < e2 + r2; a2++) n2[i2 + s2] = t2[a2], s2++;
        } }, { key: "getProperty", value: function(t2) {
          return { "line.separator": "\n" }[t2];
        } }]);
      })(), kt = (function() {
        function t2() {
          n(this, t2);
        }
        return s(t2, null, [{ key: "log10", value: function(e2) {
          var n2 = Math.log(e2);
          return A.isInfinite(n2) || A.isNaN(n2) ? n2 : n2 / t2.LOG_10;
        } }, { key: "min", value: function(t3, e2, n2, i2) {
          var r2 = t3;
          return e2 < r2 && (r2 = e2), n2 < r2 && (r2 = n2), i2 < r2 && (r2 = i2), r2;
        } }, { key: "clamp", value: function() {
          if ("number" == typeof arguments[2] && "number" == typeof arguments[0] && "number" == typeof arguments[1]) {
            var t3 = arguments[0], e2 = arguments[1], n2 = arguments[2];
            return t3 < e2 ? e2 : t3 > n2 ? n2 : t3;
          }
          if (Number.isInteger(arguments[2]) && Number.isInteger(arguments[0]) && Number.isInteger(arguments[1])) {
            var i2 = arguments[0], r2 = arguments[1], s2 = arguments[2];
            return i2 < r2 ? r2 : i2 > s2 ? s2 : i2;
          }
        } }, { key: "wrap", value: function(t3, e2) {
          return t3 < 0 ? e2 - -t3 % e2 : t3 % e2;
        } }, { key: "max", value: function() {
          if (3 === arguments.length) {
            var t3 = arguments[1], e2 = arguments[2], n2 = arguments[0];
            return t3 > n2 && (n2 = t3), e2 > n2 && (n2 = e2), n2;
          }
          if (4 === arguments.length) {
            var i2 = arguments[1], r2 = arguments[2], s2 = arguments[3], a2 = arguments[0];
            return i2 > a2 && (a2 = i2), r2 > a2 && (a2 = r2), s2 > a2 && (a2 = s2), a2;
          }
        } }, { key: "average", value: function(t3, e2) {
          return (t3 + e2) / 2;
        } }]);
      })();
      kt.LOG_10 = Math.log(10);
      var xt = (function() {
        function t2() {
          n(this, t2);
        }
        return s(t2, null, [{ key: "segmentToSegment", value: function(e2, n2, i2, r2) {
          if (e2.equals(n2)) return t2.pointToSegment(e2, i2, r2);
          if (i2.equals(r2)) return t2.pointToSegment(r2, e2, n2);
          var s2 = false;
          if (U.intersects(e2, n2, i2, r2)) {
            var a2 = (n2.x - e2.x) * (r2.y - i2.y) - (n2.y - e2.y) * (r2.x - i2.x);
            if (0 === a2) s2 = true;
            else {
              var o2 = (e2.y - i2.y) * (r2.x - i2.x) - (e2.x - i2.x) * (r2.y - i2.y), u5 = ((e2.y - i2.y) * (n2.x - e2.x) - (e2.x - i2.x) * (n2.y - e2.y)) / a2, l2 = o2 / a2;
              (l2 < 0 || l2 > 1 || u5 < 0 || u5 > 1) && (s2 = true);
            }
          } else s2 = true;
          return s2 ? kt.min(t2.pointToSegment(e2, i2, r2), t2.pointToSegment(n2, i2, r2), t2.pointToSegment(i2, e2, n2), t2.pointToSegment(r2, e2, n2)) : 0;
        } }, { key: "pointToSegment", value: function(t3, e2, n2) {
          if (e2.x === n2.x && e2.y === n2.y) return t3.distance(e2);
          var i2 = (n2.x - e2.x) * (n2.x - e2.x) + (n2.y - e2.y) * (n2.y - e2.y), r2 = ((t3.x - e2.x) * (n2.x - e2.x) + (t3.y - e2.y) * (n2.y - e2.y)) / i2;
          if (r2 <= 0) return t3.distance(e2);
          if (r2 >= 1) return t3.distance(n2);
          var s2 = ((e2.y - t3.y) * (n2.x - e2.x) - (e2.x - t3.x) * (n2.y - e2.y)) / i2;
          return Math.abs(s2) * Math.sqrt(i2);
        } }, { key: "pointToLinePerpendicular", value: function(t3, e2, n2) {
          var i2 = (n2.x - e2.x) * (n2.x - e2.x) + (n2.y - e2.y) * (n2.y - e2.y), r2 = ((e2.y - t3.y) * (n2.x - e2.x) - (e2.x - t3.x) * (n2.y - e2.y)) / i2;
          return Math.abs(r2) * Math.sqrt(i2);
        } }, { key: "pointToSegmentString", value: function(e2, n2) {
          if (0 === n2.length) throw new m("Line array must contain at least one vertex");
          for (var i2 = e2.distance(n2[0]), r2 = 0; r2 < n2.length - 1; r2++) {
            var s2 = t2.pointToSegment(e2, n2[r2], n2[r2 + 1]);
            s2 < i2 && (i2 = s2);
          }
          return i2;
        } }]);
      })(), It = (function() {
        return s((function t2() {
          n(this, t2);
        }), [{ key: "create", value: function() {
          if (1 === arguments.length) arguments[0] instanceof Array || rt(arguments[0], ht);
          else if (2 === arguments.length) ;
          else if (3 === arguments.length) {
            var t2 = arguments[0], e2 = arguments[1];
            return this.create(t2, e2);
          }
        } }]);
      })(), Et = (function() {
        return s((function t2() {
          n(this, t2);
        }), [{ key: "filter", value: function(t2) {
        } }]);
      })(), Nt = (function() {
        return s((function t2() {
          n(this, t2);
        }), null, [{ key: "ofLine", value: function(t2) {
          var e2 = t2.size();
          if (e2 <= 1) return 0;
          var n2 = 0, i2 = new X();
          t2.getCoordinate(0, i2);
          for (var r2 = i2.x, s2 = i2.y, a2 = 1; a2 < e2; a2++) {
            t2.getCoordinate(a2, i2);
            var o2 = i2.x, u5 = i2.y, l2 = o2 - r2, h2 = u5 - s2;
            n2 += Math.sqrt(l2 * l2 + h2 * h2), r2 = o2, s2 = u5;
          }
          return n2;
        } }]);
      })(), Tt = s((function t2() {
        n(this, t2);
      })), St = (function() {
        function t2() {
          n(this, t2);
        }
        return s(t2, null, [{ key: "copyCoord", value: function(t3, e2, n2, i2) {
          for (var r2 = Math.min(t3.getDimension(), n2.getDimension()), s2 = 0; s2 < r2; s2++) n2.setOrdinate(i2, s2, t3.getOrdinate(e2, s2));
        } }, { key: "isRing", value: function(t3) {
          var e2 = t3.size();
          return 0 === e2 || !(e2 <= 3) && (t3.getOrdinate(0, ht.X) === t3.getOrdinate(e2 - 1, ht.X) && t3.getOrdinate(0, ht.Y) === t3.getOrdinate(e2 - 1, ht.Y));
        } }, { key: "scroll", value: function() {
          if (2 === arguments.length) {
            if (rt(arguments[0], ht) && Number.isInteger(arguments[1])) {
              var e2 = arguments[0], n2 = arguments[1];
              t2.scroll(e2, n2, t2.isRing(e2));
            } else if (rt(arguments[0], ht) && arguments[1] instanceof X) {
              var i2 = arguments[0], r2 = arguments[1], s2 = t2.indexOf(r2, i2);
              if (s2 <= 0) return null;
              t2.scroll(i2, s2);
            }
          } else if (3 === arguments.length) {
            var a2 = arguments[0], o2 = arguments[1], u5 = arguments[2];
            if (o2 <= 0) return null;
            for (var l2 = a2.copy(), h2 = u5 ? a2.size() - 1 : a2.size(), c2 = 0; c2 < h2; c2++) for (var f2 = 0; f2 < a2.getDimension(); f2++) a2.setOrdinate(c2, f2, l2.getOrdinate((o2 + c2) % h2, f2));
            if (u5) for (var g2 = 0; g2 < a2.getDimension(); g2++) a2.setOrdinate(h2, g2, a2.getOrdinate(0, g2));
          }
        } }, { key: "isEqual", value: function(t3, e2) {
          var n2 = t3.size();
          if (n2 !== e2.size()) return false;
          for (var i2 = Math.min(t3.getDimension(), e2.getDimension()), r2 = 0; r2 < n2; r2++) for (var s2 = 0; s2 < i2; s2++) {
            var a2 = t3.getOrdinate(r2, s2), o2 = e2.getOrdinate(r2, s2);
            if (t3.getOrdinate(r2, s2) !== e2.getOrdinate(r2, s2) && (!A.isNaN(a2) || !A.isNaN(o2))) return false;
          }
          return true;
        } }, { key: "minCoordinateIndex", value: function() {
          if (1 === arguments.length) {
            var e2 = arguments[0];
            return t2.minCoordinateIndex(e2, 0, e2.size() - 1);
          }
          if (3 === arguments.length) {
            for (var n2 = arguments[0], i2 = arguments[2], r2 = -1, s2 = null, a2 = arguments[1]; a2 <= i2; a2++) {
              var o2 = n2.getCoordinate(a2);
              (null === s2 || s2.compareTo(o2) > 0) && (s2 = o2, r2 = a2);
            }
            return r2;
          }
        } }, { key: "extend", value: function(e2, n2, i2) {
          var r2 = e2.create(i2, n2.getDimension()), s2 = n2.size();
          if (t2.copy(n2, 0, r2, 0, s2), s2 > 0) for (var a2 = s2; a2 < i2; a2++) t2.copy(n2, s2 - 1, r2, a2, 1);
          return r2;
        } }, { key: "reverse", value: function(e2) {
          for (var n2 = e2.size() - 1, i2 = Math.trunc(n2 / 2), r2 = 0; r2 <= i2; r2++) t2.swap(e2, r2, n2 - r2);
        } }, { key: "swap", value: function(t3, e2, n2) {
          if (e2 === n2) return null;
          for (var i2 = 0; i2 < t3.getDimension(); i2++) {
            var r2 = t3.getOrdinate(e2, i2);
            t3.setOrdinate(e2, i2, t3.getOrdinate(n2, i2)), t3.setOrdinate(n2, i2, r2);
          }
        } }, { key: "copy", value: function(e2, n2, i2, r2, s2) {
          for (var a2 = 0; a2 < s2; a2++) t2.copyCoord(e2, n2 + a2, i2, r2 + a2);
        } }, { key: "ensureValidRing", value: function(e2, n2) {
          var i2 = n2.size();
          return 0 === i2 ? n2 : i2 <= 3 ? t2.createClosedRing(e2, n2, 4) : n2.getOrdinate(0, ht.X) === n2.getOrdinate(i2 - 1, ht.X) && n2.getOrdinate(0, ht.Y) === n2.getOrdinate(i2 - 1, ht.Y) ? n2 : t2.createClosedRing(e2, n2, i2 + 1);
        } }, { key: "indexOf", value: function(t3, e2) {
          for (var n2 = 0; n2 < e2.size(); n2++) if (t3.x === e2.getOrdinate(n2, ht.X) && t3.y === e2.getOrdinate(n2, ht.Y)) return n2;
          return -1;
        } }, { key: "createClosedRing", value: function(e2, n2, i2) {
          var r2 = e2.create(i2, n2.getDimension()), s2 = n2.size();
          t2.copy(n2, 0, r2, 0, s2);
          for (var a2 = s2; a2 < i2; a2++) t2.copy(n2, 0, r2, a2, 1);
          return r2;
        } }, { key: "minCoordinate", value: function(t3) {
          for (var e2 = null, n2 = 0; n2 < t3.size(); n2++) {
            var i2 = t3.getCoordinate(n2);
            (null === e2 || e2.compareTo(i2) > 0) && (e2 = i2);
          }
          return e2;
        } }]);
      })(), Lt = (function() {
        function t2() {
          n(this, t2);
        }
        return s(t2, null, [{ key: "toDimensionSymbol", value: function(e2) {
          switch (e2) {
            case t2.FALSE:
              return t2.SYM_FALSE;
            case t2.TRUE:
              return t2.SYM_TRUE;
            case t2.DONTCARE:
              return t2.SYM_DONTCARE;
            case t2.P:
              return t2.SYM_P;
            case t2.L:
              return t2.SYM_L;
            case t2.A:
              return t2.SYM_A;
          }
          throw new m("Unknown dimension value: " + e2);
        } }, { key: "toDimensionValue", value: function(e2) {
          switch (ot.toUpperCase(e2)) {
            case t2.SYM_FALSE:
              return t2.FALSE;
            case t2.SYM_TRUE:
              return t2.TRUE;
            case t2.SYM_DONTCARE:
              return t2.DONTCARE;
            case t2.SYM_P:
              return t2.P;
            case t2.SYM_L:
              return t2.L;
            case t2.SYM_A:
              return t2.A;
          }
          throw new m("Unknown dimension symbol: " + e2);
        } }]);
      })();
      Lt.P = 0, Lt.L = 1, Lt.A = 2, Lt.FALSE = -1, Lt.TRUE = -2, Lt.DONTCARE = -3, Lt.SYM_FALSE = "F", Lt.SYM_TRUE = "T", Lt.SYM_DONTCARE = "*", Lt.SYM_P = "0", Lt.SYM_L = "1", Lt.SYM_A = "2";
      var Ct = (function() {
        return s((function t2() {
          n(this, t2);
        }), [{ key: "filter", value: function(t2) {
        } }]);
      })(), Rt = (function() {
        return s((function t2() {
          n(this, t2);
        }), [{ key: "filter", value: function(t2, e2) {
        } }, { key: "isDone", value: function() {
        } }, { key: "isGeometryChanged", value: function() {
        } }]);
      })(), wt = (function(t2) {
        function i2() {
          var t3;
          return n(this, i2), t3 = e(this, i2), i2.constructor_.apply(t3, arguments), t3;
        }
        return l(i2, t2), s(i2, [{ key: "computeEnvelopeInternal", value: function() {
          return this.isEmpty() ? new U() : this._points.expandEnvelope(new U());
        } }, { key: "isRing", value: function() {
          return this.isClosed() && this.isSimple();
        } }, { key: "getCoordinates", value: function() {
          return this._points.toCoordinateArray();
        } }, { key: "copyInternal", value: function() {
          return new i2(this._points.copy(), this._factory);
        } }, { key: "equalsExact", value: function() {
          if (2 === arguments.length && "number" == typeof arguments[1] && arguments[0] instanceof V) {
            var t3 = arguments[0], e2 = arguments[1];
            if (!this.isEquivalentClass(t3)) return false;
            var n2 = t3;
            if (this._points.size() !== n2._points.size()) return false;
            for (var r2 = 0; r2 < this._points.size(); r2++) if (!this.equal(this._points.getCoordinate(r2), n2._points.getCoordinate(r2), e2)) return false;
            return true;
          }
          return f(i2, "equalsExact", this, 1).apply(this, arguments);
        } }, { key: "normalize", value: function() {
          for (var t3 = 0; t3 < Math.trunc(this._points.size() / 2); t3++) {
            var e2 = this._points.size() - 1 - t3;
            if (!this._points.getCoordinate(t3).equals(this._points.getCoordinate(e2))) {
              if (this._points.getCoordinate(t3).compareTo(this._points.getCoordinate(e2)) > 0) {
                var n2 = this._points.copy();
                St.reverse(n2), this._points = n2;
              }
              return null;
            }
          }
        } }, { key: "getCoordinate", value: function() {
          return this.isEmpty() ? null : this._points.getCoordinate(0);
        } }, { key: "getBoundaryDimension", value: function() {
          return this.isClosed() ? Lt.FALSE : 0;
        } }, { key: "isClosed", value: function() {
          return !this.isEmpty() && this.getCoordinateN(0).equals2D(this.getCoordinateN(this.getNumPoints() - 1));
        } }, { key: "reverseInternal", value: function() {
          var t3 = this._points.copy();
          return St.reverse(t3), this.getFactory().createLineString(t3);
        } }, { key: "getEndPoint", value: function() {
          return this.isEmpty() ? null : this.getPointN(this.getNumPoints() - 1);
        } }, { key: "getTypeCode", value: function() {
          return V.TYPECODE_LINESTRING;
        } }, { key: "getDimension", value: function() {
          return 1;
        } }, { key: "getLength", value: function() {
          return Nt.ofLine(this._points);
        } }, { key: "getNumPoints", value: function() {
          return this._points.size();
        } }, { key: "compareToSameClass", value: function() {
          if (1 === arguments.length) {
            for (var t3 = arguments[0], e2 = 0, n2 = 0; e2 < this._points.size() && n2 < t3._points.size(); ) {
              var i3 = this._points.getCoordinate(e2).compareTo(t3._points.getCoordinate(n2));
              if (0 !== i3) return i3;
              e2++, n2++;
            }
            return e2 < this._points.size() ? 1 : n2 < t3._points.size() ? -1 : 0;
          }
          if (2 === arguments.length) {
            var r2 = arguments[0];
            return arguments[1].compare(this._points, r2._points);
          }
        } }, { key: "apply", value: function() {
          if (rt(arguments[0], Et)) for (var t3 = arguments[0], e2 = 0; e2 < this._points.size(); e2++) t3.filter(this._points.getCoordinate(e2));
          else if (rt(arguments[0], Rt)) {
            var n2 = arguments[0];
            if (0 === this._points.size()) return null;
            for (var i3 = 0; i3 < this._points.size() && (n2.filter(this._points, i3), !n2.isDone()); i3++) ;
            n2.isGeometryChanged() && this.geometryChanged();
          } else if (rt(arguments[0], Ct)) {
            arguments[0].filter(this);
          } else if (rt(arguments[0], k)) {
            arguments[0].filter(this);
          }
        } }, { key: "getBoundary", value: function() {
          throw new W();
        } }, { key: "isEquivalentClass", value: function(t3) {
          return t3 instanceof i2;
        } }, { key: "getCoordinateN", value: function(t3) {
          return this._points.getCoordinate(t3);
        } }, { key: "getGeometryType", value: function() {
          return V.TYPENAME_LINESTRING;
        } }, { key: "getCoordinateSequence", value: function() {
          return this._points;
        } }, { key: "isEmpty", value: function() {
          return 0 === this._points.size();
        } }, { key: "init", value: function(t3) {
          if (null === t3 && (t3 = this.getFactory().getCoordinateSequenceFactory().create([])), 1 === t3.size()) throw new m("Invalid number of points in LineString (found " + t3.size() + " - must be 0 or >= 2)");
          this._points = t3;
        } }, { key: "isCoordinate", value: function(t3) {
          for (var e2 = 0; e2 < this._points.size(); e2++) if (this._points.getCoordinate(e2).equals(t3)) return true;
          return false;
        } }, { key: "getStartPoint", value: function() {
          return this.isEmpty() ? null : this.getPointN(0);
        } }, { key: "getPointN", value: function(t3) {
          return this.getFactory().createPoint(this._points.getCoordinate(t3));
        } }, { key: "interfaces_", get: function() {
          return [Tt];
        } }], [{ key: "constructor_", value: function() {
          if (this._points = null, 0 === arguments.length) ;
          else if (2 === arguments.length) {
            var t3 = arguments[0], e2 = arguments[1];
            V.constructor_.call(this, e2), this.init(t3);
          }
        } }]);
      })(V), Ot = s((function t2() {
        n(this, t2);
      })), bt = (function(t2) {
        function i2() {
          var t3;
          return n(this, i2), t3 = e(this, i2), i2.constructor_.apply(t3, arguments), t3;
        }
        return l(i2, t2), s(i2, [{ key: "computeEnvelopeInternal", value: function() {
          if (this.isEmpty()) return new U();
          var t3 = new U();
          return t3.expandToInclude(this._coordinates.getX(0), this._coordinates.getY(0)), t3;
        } }, { key: "getCoordinates", value: function() {
          return this.isEmpty() ? [] : [this.getCoordinate()];
        } }, { key: "copyInternal", value: function() {
          return new i2(this._coordinates.copy(), this._factory);
        } }, { key: "equalsExact", value: function() {
          if (2 === arguments.length && "number" == typeof arguments[1] && arguments[0] instanceof V) {
            var t3 = arguments[0], e2 = arguments[1];
            return !!this.isEquivalentClass(t3) && (!(!this.isEmpty() || !t3.isEmpty()) || this.isEmpty() === t3.isEmpty() && this.equal(t3.getCoordinate(), this.getCoordinate(), e2));
          }
          return f(i2, "equalsExact", this, 1).apply(this, arguments);
        } }, { key: "normalize", value: function() {
        } }, { key: "getCoordinate", value: function() {
          return 0 !== this._coordinates.size() ? this._coordinates.getCoordinate(0) : null;
        } }, { key: "getBoundaryDimension", value: function() {
          return Lt.FALSE;
        } }, { key: "reverseInternal", value: function() {
          return this.getFactory().createPoint(this._coordinates.copy());
        } }, { key: "getTypeCode", value: function() {
          return V.TYPECODE_POINT;
        } }, { key: "getDimension", value: function() {
          return 0;
        } }, { key: "getNumPoints", value: function() {
          return this.isEmpty() ? 0 : 1;
        } }, { key: "getX", value: function() {
          if (null === this.getCoordinate()) throw new IllegalStateException("getX called on empty Point");
          return this.getCoordinate().x;
        } }, { key: "compareToSameClass", value: function() {
          if (1 === arguments.length) {
            var t3 = arguments[0];
            return this.getCoordinate().compareTo(t3.getCoordinate());
          }
          if (2 === arguments.length) {
            var e2 = arguments[0];
            return arguments[1].compare(this._coordinates, e2._coordinates);
          }
        } }, { key: "apply", value: function() {
          if (rt(arguments[0], Et)) {
            var t3 = arguments[0];
            if (this.isEmpty()) return null;
            t3.filter(this.getCoordinate());
          } else if (rt(arguments[0], Rt)) {
            var e2 = arguments[0];
            if (this.isEmpty()) return null;
            e2.filter(this._coordinates, 0), e2.isGeometryChanged() && this.geometryChanged();
          } else if (rt(arguments[0], Ct)) {
            arguments[0].filter(this);
          } else if (rt(arguments[0], k)) {
            arguments[0].filter(this);
          }
        } }, { key: "getBoundary", value: function() {
          return this.getFactory().createGeometryCollection();
        } }, { key: "getGeometryType", value: function() {
          return V.TYPENAME_POINT;
        } }, { key: "getCoordinateSequence", value: function() {
          return this._coordinates;
        } }, { key: "getY", value: function() {
          if (null === this.getCoordinate()) throw new IllegalStateException("getY called on empty Point");
          return this.getCoordinate().y;
        } }, { key: "isEmpty", value: function() {
          return 0 === this._coordinates.size();
        } }, { key: "init", value: function(t3) {
          null === t3 && (t3 = this.getFactory().getCoordinateSequenceFactory().create([])), G.isTrue(t3.size() <= 1), this._coordinates = t3;
        } }, { key: "isSimple", value: function() {
          return true;
        } }, { key: "interfaces_", get: function() {
          return [Ot];
        } }], [{ key: "constructor_", value: function() {
          this._coordinates = null;
          var t3 = arguments[0], e2 = arguments[1];
          V.constructor_.call(this, e2), this.init(t3);
        } }]);
      })(V), Mt = (function() {
        function t2() {
          n(this, t2);
        }
        return s(t2, null, [{ key: "ofRing", value: function() {
          if (arguments[0] instanceof Array) {
            var e2 = arguments[0];
            return Math.abs(t2.ofRingSigned(e2));
          }
          if (rt(arguments[0], ht)) {
            var n2 = arguments[0];
            return Math.abs(t2.ofRingSigned(n2));
          }
        } }, { key: "ofRingSigned", value: function() {
          if (arguments[0] instanceof Array) {
            var t3 = arguments[0];
            if (t3.length < 3) return 0;
            for (var e2 = 0, n2 = t3[0].x, i2 = 1; i2 < t3.length - 1; i2++) {
              var r2 = t3[i2].x - n2, s2 = t3[i2 + 1].y;
              e2 += r2 * (t3[i2 - 1].y - s2);
            }
            return e2 / 2;
          }
          if (rt(arguments[0], ht)) {
            var a2 = arguments[0], o2 = a2.size();
            if (o2 < 3) return 0;
            var u5 = new X(), l2 = new X(), h2 = new X();
            a2.getCoordinate(0, l2), a2.getCoordinate(1, h2);
            var c2 = l2.x;
            h2.x -= c2;
            for (var f2 = 0, g2 = 1; g2 < o2 - 1; g2++) u5.y = l2.y, l2.x = h2.x, l2.y = h2.y, a2.getCoordinate(g2 + 1, h2), h2.x -= c2, f2 += l2.x * (u5.y - h2.y);
            return f2 / 2;
          }
        } }]);
      })(), At = (function() {
        return s((function t2() {
          n(this, t2);
        }), null, [{ key: "sort", value: function() {
          var t2 = arguments, e2 = arguments[0];
          if (1 === arguments.length) e2.sort((function(t3, e3) {
            return t3.compareTo(e3);
          }));
          else if (2 === arguments.length) e2.sort((function(e3, n3) {
            return t2[1].compare(e3, n3);
          }));
          else if (3 === arguments.length) {
            var n2 = e2.slice(arguments[1], arguments[2]);
            n2.sort();
            var i2 = e2.slice(0, arguments[1]).concat(n2, e2.slice(arguments[2], e2.length));
            e2.splice(0, e2.length);
            var r2, s2 = a(i2);
            try {
              for (s2.s(); !(r2 = s2.n()).done; ) {
                var o2 = r2.value;
                e2.push(o2);
              }
            } catch (t3) {
              s2.e(t3);
            } finally {
              s2.f();
            }
          } else if (4 === arguments.length) {
            var u5 = e2.slice(arguments[1], arguments[2]);
            u5.sort((function(e3, n3) {
              return t2[3].compare(e3, n3);
            }));
            var l2 = e2.slice(0, arguments[1]).concat(u5, e2.slice(arguments[2], e2.length));
            e2.splice(0, e2.length);
            var h2, c2 = a(l2);
            try {
              for (c2.s(); !(h2 = c2.n()).done; ) {
                var f2 = h2.value;
                e2.push(f2);
              }
            } catch (t3) {
              c2.e(t3);
            } finally {
              c2.f();
            }
          }
        } }, { key: "asList", value: function(t2) {
          var e2, n2 = new yt(), i2 = a(t2);
          try {
            for (i2.s(); !(e2 = i2.n()).done; ) {
              var r2 = e2.value;
              n2.add(r2);
            }
          } catch (t3) {
            i2.e(t3);
          } finally {
            i2.f();
          }
          return n2;
        } }, { key: "copyOf", value: function(t2, e2) {
          return t2.slice(0, e2);
        } }]);
      })(), Pt = s((function t2() {
        n(this, t2);
      })), Dt = (function(t2) {
        function i2() {
          var t3;
          return n(this, i2), t3 = e(this, i2), i2.constructor_.apply(t3, arguments), t3;
        }
        return l(i2, t2), s(i2, [{ key: "computeEnvelopeInternal", value: function() {
          return this._shell.getEnvelopeInternal();
        } }, { key: "getCoordinates", value: function() {
          if (this.isEmpty()) return [];
          for (var t3 = new Array(this.getNumPoints()).fill(null), e2 = -1, n2 = this._shell.getCoordinates(), i3 = 0; i3 < n2.length; i3++) t3[++e2] = n2[i3];
          for (var r2 = 0; r2 < this._holes.length; r2++) for (var s2 = this._holes[r2].getCoordinates(), a2 = 0; a2 < s2.length; a2++) t3[++e2] = s2[a2];
          return t3;
        } }, { key: "getArea", value: function() {
          var t3 = 0;
          t3 += Mt.ofRing(this._shell.getCoordinateSequence());
          for (var e2 = 0; e2 < this._holes.length; e2++) t3 -= Mt.ofRing(this._holes[e2].getCoordinateSequence());
          return t3;
        } }, { key: "copyInternal", value: function() {
          for (var t3 = this._shell.copy(), e2 = new Array(this._holes.length).fill(null), n2 = 0; n2 < this._holes.length; n2++) e2[n2] = this._holes[n2].copy();
          return new i2(t3, e2, this._factory);
        } }, { key: "isRectangle", value: function() {
          if (0 !== this.getNumInteriorRing()) return false;
          if (null === this._shell) return false;
          if (5 !== this._shell.getNumPoints()) return false;
          for (var t3 = this._shell.getCoordinateSequence(), e2 = this.getEnvelopeInternal(), n2 = 0; n2 < 5; n2++) {
            var i3 = t3.getX(n2);
            if (i3 !== e2.getMinX() && i3 !== e2.getMaxX()) return false;
            var r2 = t3.getY(n2);
            if (r2 !== e2.getMinY() && r2 !== e2.getMaxY()) return false;
          }
          for (var s2 = t3.getX(0), a2 = t3.getY(0), o2 = 1; o2 <= 4; o2++) {
            var u5 = t3.getX(o2), l2 = t3.getY(o2);
            if (u5 !== s2 === (l2 !== a2)) return false;
            s2 = u5, a2 = l2;
          }
          return true;
        } }, { key: "equalsExact", value: function() {
          if (2 === arguments.length && "number" == typeof arguments[1] && arguments[0] instanceof V) {
            var t3 = arguments[0], e2 = arguments[1];
            if (!this.isEquivalentClass(t3)) return false;
            var n2 = t3, r2 = this._shell, s2 = n2._shell;
            if (!r2.equalsExact(s2, e2)) return false;
            if (this._holes.length !== n2._holes.length) return false;
            for (var a2 = 0; a2 < this._holes.length; a2++) if (!this._holes[a2].equalsExact(n2._holes[a2], e2)) return false;
            return true;
          }
          return f(i2, "equalsExact", this, 1).apply(this, arguments);
        } }, { key: "normalize", value: function() {
          if (0 === arguments.length) {
            this._shell = this.normalized(this._shell, true);
            for (var t3 = 0; t3 < this._holes.length; t3++) this._holes[t3] = this.normalized(this._holes[t3], false);
            At.sort(this._holes);
          } else if (2 === arguments.length) {
            var e2 = arguments[0], n2 = arguments[1];
            if (e2.isEmpty()) return null;
            var i3 = e2.getCoordinateSequence(), r2 = St.minCoordinateIndex(i3, 0, i3.size() - 2);
            St.scroll(i3, r2, true), ct.isCCW(i3) === n2 && St.reverse(i3);
          }
        } }, { key: "getCoordinate", value: function() {
          return this._shell.getCoordinate();
        } }, { key: "getNumInteriorRing", value: function() {
          return this._holes.length;
        } }, { key: "getBoundaryDimension", value: function() {
          return 1;
        } }, { key: "reverseInternal", value: function() {
          for (var t3 = this.getExteriorRing().reverse(), e2 = new Array(this.getNumInteriorRing()).fill(null), n2 = 0; n2 < e2.length; n2++) e2[n2] = this.getInteriorRingN(n2).reverse();
          return this.getFactory().createPolygon(t3, e2);
        } }, { key: "getTypeCode", value: function() {
          return V.TYPECODE_POLYGON;
        } }, { key: "getDimension", value: function() {
          return 2;
        } }, { key: "getLength", value: function() {
          var t3 = 0;
          t3 += this._shell.getLength();
          for (var e2 = 0; e2 < this._holes.length; e2++) t3 += this._holes[e2].getLength();
          return t3;
        } }, { key: "getNumPoints", value: function() {
          for (var t3 = this._shell.getNumPoints(), e2 = 0; e2 < this._holes.length; e2++) t3 += this._holes[e2].getNumPoints();
          return t3;
        } }, { key: "convexHull", value: function() {
          return this.getExteriorRing().convexHull();
        } }, { key: "normalized", value: function(t3, e2) {
          var n2 = t3.copy();
          return this.normalize(n2, e2), n2;
        } }, { key: "compareToSameClass", value: function() {
          if (1 === arguments.length) {
            var t3 = arguments[0], e2 = this._shell, n2 = t3._shell;
            return e2.compareToSameClass(n2);
          }
          if (2 === arguments.length) {
            var i3 = arguments[1], r2 = arguments[0], s2 = this._shell, a2 = r2._shell, o2 = s2.compareToSameClass(a2, i3);
            if (0 !== o2) return o2;
            for (var u5 = this.getNumInteriorRing(), l2 = r2.getNumInteriorRing(), h2 = 0; h2 < u5 && h2 < l2; ) {
              var c2 = this.getInteriorRingN(h2), f2 = r2.getInteriorRingN(h2), g2 = c2.compareToSameClass(f2, i3);
              if (0 !== g2) return g2;
              h2++;
            }
            return h2 < u5 ? 1 : h2 < l2 ? -1 : 0;
          }
        } }, { key: "apply", value: function() {
          if (rt(arguments[0], Et)) {
            var t3 = arguments[0];
            this._shell.apply(t3);
            for (var e2 = 0; e2 < this._holes.length; e2++) this._holes[e2].apply(t3);
          } else if (rt(arguments[0], Rt)) {
            var n2 = arguments[0];
            if (this._shell.apply(n2), !n2.isDone()) for (var i3 = 0; i3 < this._holes.length && (this._holes[i3].apply(n2), !n2.isDone()); i3++) ;
            n2.isGeometryChanged() && this.geometryChanged();
          } else if (rt(arguments[0], Ct)) {
            arguments[0].filter(this);
          } else if (rt(arguments[0], k)) {
            var r2 = arguments[0];
            r2.filter(this), this._shell.apply(r2);
            for (var s2 = 0; s2 < this._holes.length; s2++) this._holes[s2].apply(r2);
          }
        } }, { key: "getBoundary", value: function() {
          if (this.isEmpty()) return this.getFactory().createMultiLineString();
          var t3 = new Array(this._holes.length + 1).fill(null);
          t3[0] = this._shell;
          for (var e2 = 0; e2 < this._holes.length; e2++) t3[e2 + 1] = this._holes[e2];
          return t3.length <= 1 ? this.getFactory().createLinearRing(t3[0].getCoordinateSequence()) : this.getFactory().createMultiLineString(t3);
        } }, { key: "getGeometryType", value: function() {
          return V.TYPENAME_POLYGON;
        } }, { key: "getExteriorRing", value: function() {
          return this._shell;
        } }, { key: "isEmpty", value: function() {
          return this._shell.isEmpty();
        } }, { key: "getInteriorRingN", value: function(t3) {
          return this._holes[t3];
        } }, { key: "interfaces_", get: function() {
          return [Pt];
        } }], [{ key: "constructor_", value: function() {
          this._shell = null, this._holes = null;
          var t3 = arguments[0], e2 = arguments[1], n2 = arguments[2];
          if (V.constructor_.call(this, n2), null === t3 && (t3 = this.getFactory().createLinearRing()), null === e2 && (e2 = []), V.hasNullElements(e2)) throw new m("holes must not contain null elements");
          if (t3.isEmpty() && V.hasNonEmptyElements(e2)) throw new m("shell is empty but holes are not");
          this._shell = t3, this._holes = e2;
        } }]);
      })(V), Ft = (function(t2) {
        function i2() {
          return n(this, i2), e(this, i2, arguments);
        }
        return l(i2, t2), s(i2);
      })(K), Gt = (function(t2) {
        function i2(t3) {
          var r2;
          return n(this, i2), (r2 = e(this, i2)).array = [], t3 instanceof Z && r2.addAll(t3), r2;
        }
        return l(i2, t2), s(i2, [{ key: "contains", value: function(t3) {
          var e2, n2 = a(this.array);
          try {
            for (n2.s(); !(e2 = n2.n()).done; ) {
              if (0 === e2.value.compareTo(t3)) return true;
            }
          } catch (t4) {
            n2.e(t4);
          } finally {
            n2.f();
          }
          return false;
        } }, { key: "add", value: function(t3) {
          if (this.contains(t3)) return false;
          for (var e2 = 0, n2 = this.array.length; e2 < n2; e2++) {
            if (1 === this.array[e2].compareTo(t3)) return !!this.array.splice(e2, 0, t3);
          }
          return this.array.push(t3), true;
        } }, { key: "addAll", value: function(t3) {
          var e2, n2 = a(t3);
          try {
            for (n2.s(); !(e2 = n2.n()).done; ) {
              var i3 = e2.value;
              this.add(i3);
            }
          } catch (t4) {
            n2.e(t4);
          } finally {
            n2.f();
          }
          return true;
        } }, { key: "remove", value: function() {
          throw new W();
        } }, { key: "size", value: function() {
          return this.array.length;
        } }, { key: "isEmpty", value: function() {
          return 0 === this.array.length;
        } }, { key: "toArray", value: function() {
          return this.array.slice();
        } }, { key: "iterator", value: function() {
          return new qt(this.array);
        } }]);
      })(Ft), qt = (function() {
        return s((function t2(e2) {
          n(this, t2), this.array = e2, this.position = 0;
        }), [{ key: "next", value: function() {
          if (this.position === this.array.length) throw new j();
          return this.array[this.position++];
        } }, { key: "hasNext", value: function() {
          return this.position < this.array.length;
        } }, { key: "remove", value: function() {
          throw new W();
        } }]);
      })(), Yt = (function(t2) {
        function i2() {
          var t3;
          return n(this, i2), t3 = e(this, i2), i2.constructor_.apply(t3, arguments), t3;
        }
        return l(i2, t2), s(i2, [{ key: "computeEnvelopeInternal", value: function() {
          for (var t3 = new U(), e2 = 0; e2 < this._geometries.length; e2++) t3.expandToInclude(this._geometries[e2].getEnvelopeInternal());
          return t3;
        } }, { key: "getGeometryN", value: function(t3) {
          return this._geometries[t3];
        } }, { key: "getCoordinates", value: function() {
          for (var t3 = new Array(this.getNumPoints()).fill(null), e2 = -1, n2 = 0; n2 < this._geometries.length; n2++) for (var i3 = this._geometries[n2].getCoordinates(), r2 = 0; r2 < i3.length; r2++) t3[++e2] = i3[r2];
          return t3;
        } }, { key: "getArea", value: function() {
          for (var t3 = 0, e2 = 0; e2 < this._geometries.length; e2++) t3 += this._geometries[e2].getArea();
          return t3;
        } }, { key: "copyInternal", value: function() {
          for (var t3 = new Array(this._geometries.length).fill(null), e2 = 0; e2 < t3.length; e2++) t3[e2] = this._geometries[e2].copy();
          return new i2(t3, this._factory);
        } }, { key: "equalsExact", value: function() {
          if (2 === arguments.length && "number" == typeof arguments[1] && arguments[0] instanceof V) {
            var t3 = arguments[0], e2 = arguments[1];
            if (!this.isEquivalentClass(t3)) return false;
            var n2 = t3;
            if (this._geometries.length !== n2._geometries.length) return false;
            for (var r2 = 0; r2 < this._geometries.length; r2++) if (!this._geometries[r2].equalsExact(n2._geometries[r2], e2)) return false;
            return true;
          }
          return f(i2, "equalsExact", this, 1).apply(this, arguments);
        } }, { key: "normalize", value: function() {
          for (var t3 = 0; t3 < this._geometries.length; t3++) this._geometries[t3].normalize();
          At.sort(this._geometries);
        } }, { key: "getCoordinate", value: function() {
          return this.isEmpty() ? null : this._geometries[0].getCoordinate();
        } }, { key: "getBoundaryDimension", value: function() {
          for (var t3 = Lt.FALSE, e2 = 0; e2 < this._geometries.length; e2++) t3 = Math.max(t3, this._geometries[e2].getBoundaryDimension());
          return t3;
        } }, { key: "reverseInternal", value: function() {
          for (var t3 = this._geometries.length, e2 = new yt(t3), n2 = 0; n2 < t3; n2++) e2.add(this._geometries[n2].reverse());
          return this.getFactory().buildGeometry(e2);
        } }, { key: "getTypeCode", value: function() {
          return V.TYPECODE_GEOMETRYCOLLECTION;
        } }, { key: "getDimension", value: function() {
          for (var t3 = Lt.FALSE, e2 = 0; e2 < this._geometries.length; e2++) t3 = Math.max(t3, this._geometries[e2].getDimension());
          return t3;
        } }, { key: "getLength", value: function() {
          for (var t3 = 0, e2 = 0; e2 < this._geometries.length; e2++) t3 += this._geometries[e2].getLength();
          return t3;
        } }, { key: "getNumPoints", value: function() {
          for (var t3 = 0, e2 = 0; e2 < this._geometries.length; e2++) t3 += this._geometries[e2].getNumPoints();
          return t3;
        } }, { key: "getNumGeometries", value: function() {
          return this._geometries.length;
        } }, { key: "compareToSameClass", value: function() {
          if (1 === arguments.length) {
            var t3 = arguments[0], e2 = new Gt(At.asList(this._geometries)), n2 = new Gt(At.asList(t3._geometries));
            return this.compare(e2, n2);
          }
          if (2 === arguments.length) {
            for (var i3 = arguments[1], r2 = arguments[0], s2 = this.getNumGeometries(), a2 = r2.getNumGeometries(), o2 = 0; o2 < s2 && o2 < a2; ) {
              var u5 = this.getGeometryN(o2), l2 = r2.getGeometryN(o2), h2 = u5.compareToSameClass(l2, i3);
              if (0 !== h2) return h2;
              o2++;
            }
            return o2 < s2 ? 1 : o2 < a2 ? -1 : 0;
          }
        } }, { key: "apply", value: function() {
          if (rt(arguments[0], Et)) for (var t3 = arguments[0], e2 = 0; e2 < this._geometries.length; e2++) this._geometries[e2].apply(t3);
          else if (rt(arguments[0], Rt)) {
            var n2 = arguments[0];
            if (0 === this._geometries.length) return null;
            for (var i3 = 0; i3 < this._geometries.length && (this._geometries[i3].apply(n2), !n2.isDone()); i3++) ;
            n2.isGeometryChanged() && this.geometryChanged();
          } else if (rt(arguments[0], Ct)) {
            var r2 = arguments[0];
            r2.filter(this);
            for (var s2 = 0; s2 < this._geometries.length; s2++) this._geometries[s2].apply(r2);
          } else if (rt(arguments[0], k)) {
            var a2 = arguments[0];
            a2.filter(this);
            for (var o2 = 0; o2 < this._geometries.length; o2++) this._geometries[o2].apply(a2);
          }
        } }, { key: "getBoundary", value: function() {
          return V.checkNotGeometryCollection(this), G.shouldNeverReachHere(), null;
        } }, { key: "getGeometryType", value: function() {
          return V.TYPENAME_GEOMETRYCOLLECTION;
        } }, { key: "isEmpty", value: function() {
          for (var t3 = 0; t3 < this._geometries.length; t3++) if (!this._geometries[t3].isEmpty()) return false;
          return true;
        } }], [{ key: "constructor_", value: function() {
          if (this._geometries = null, 0 === arguments.length) ;
          else if (2 === arguments.length) {
            var t3 = arguments[0], e2 = arguments[1];
            if (V.constructor_.call(this, e2), null === t3 && (t3 = []), V.hasNullElements(t3)) throw new m("geometries must not contain null elements");
            this._geometries = t3;
          }
        } }]);
      })(V), zt = (function(t2) {
        function i2() {
          var t3;
          return n(this, i2), t3 = e(this, i2), i2.constructor_.apply(t3, arguments), t3;
        }
        return l(i2, t2), s(i2, [{ key: "copyInternal", value: function() {
          for (var t3 = new Array(this._geometries.length).fill(null), e2 = 0; e2 < t3.length; e2++) t3[e2] = this._geometries[e2].copy();
          return new i2(t3, this._factory);
        } }, { key: "isValid", value: function() {
          return true;
        } }, { key: "equalsExact", value: function() {
          if (2 === arguments.length && "number" == typeof arguments[1] && arguments[0] instanceof V) {
            var t3 = arguments[0], e2 = arguments[1];
            return !!this.isEquivalentClass(t3) && f(i2, "equalsExact", this, 1).call(this, t3, e2);
          }
          return f(i2, "equalsExact", this, 1).apply(this, arguments);
        } }, { key: "getCoordinate", value: function() {
          if (1 === arguments.length && Number.isInteger(arguments[0])) {
            var t3 = arguments[0];
            return this._geometries[t3].getCoordinate();
          }
          return f(i2, "getCoordinate", this, 1).apply(this, arguments);
        } }, { key: "getBoundaryDimension", value: function() {
          return Lt.FALSE;
        } }, { key: "getTypeCode", value: function() {
          return V.TYPECODE_MULTIPOINT;
        } }, { key: "getDimension", value: function() {
          return 0;
        } }, { key: "getBoundary", value: function() {
          return this.getFactory().createGeometryCollection();
        } }, { key: "getGeometryType", value: function() {
          return V.TYPENAME_MULTIPOINT;
        } }, { key: "interfaces_", get: function() {
          return [Ot];
        } }], [{ key: "constructor_", value: function() {
          var t3 = arguments[0], e2 = arguments[1];
          Yt.constructor_.call(this, t3, e2);
        } }]);
      })(Yt), Xt = (function(t2) {
        function i2() {
          var t3;
          return n(this, i2), t3 = e(this, i2), i2.constructor_.apply(t3, arguments), t3;
        }
        return l(i2, t2), s(i2, [{ key: "copyInternal", value: function() {
          return new i2(this._points.copy(), this._factory);
        } }, { key: "getBoundaryDimension", value: function() {
          return Lt.FALSE;
        } }, { key: "isClosed", value: function() {
          return !!this.isEmpty() || f(i2, "isClosed", this, 1).call(this);
        } }, { key: "reverseInternal", value: function() {
          var t3 = this._points.copy();
          return St.reverse(t3), this.getFactory().createLinearRing(t3);
        } }, { key: "getTypeCode", value: function() {
          return V.TYPECODE_LINEARRING;
        } }, { key: "validateConstruction", value: function() {
          if (!this.isEmpty() && !f(i2, "isClosed", this, 1).call(this)) throw new m("Points of LinearRing do not form a closed linestring");
          if (this.getCoordinateSequence().size() >= 1 && this.getCoordinateSequence().size() < i2.MINIMUM_VALID_SIZE) throw new m("Invalid number of points in LinearRing (found " + this.getCoordinateSequence().size() + " - must be 0 or >= 4)");
        } }, { key: "getGeometryType", value: function() {
          return V.TYPENAME_LINEARRING;
        } }], [{ key: "constructor_", value: function() {
          var t3 = arguments[0], e2 = arguments[1];
          wt.constructor_.call(this, t3, e2), this.validateConstruction();
        } }]);
      })(wt);
      Xt.MINIMUM_VALID_SIZE = 4;
      var Bt = (function(t2) {
        function i2() {
          var t3;
          return n(this, i2), t3 = e(this, i2), i2.constructor_.apply(t3, arguments), t3;
        }
        return l(i2, t2), s(i2, [{ key: "setOrdinate", value: function(t3, e2) {
          switch (t3) {
            case i2.X:
              this.x = e2;
              break;
            case i2.Y:
              this.y = e2;
              break;
            default:
              throw new m("Invalid ordinate index: " + t3);
          }
        } }, { key: "getZ", value: function() {
          return X.NULL_ORDINATE;
        } }, { key: "getOrdinate", value: function(t3) {
          switch (t3) {
            case i2.X:
              return this.x;
            case i2.Y:
              return this.y;
          }
          throw new m("Invalid ordinate index: " + t3);
        } }, { key: "setZ", value: function(t3) {
          throw new m("CoordinateXY dimension 2 does not support z-ordinate");
        } }, { key: "copy", value: function() {
          return new i2(this);
        } }, { key: "toString", value: function() {
          return "(" + this.x + ", " + this.y + ")";
        } }, { key: "setCoordinate", value: function(t3) {
          this.x = t3.x, this.y = t3.y, this.z = t3.getZ();
        } }], [{ key: "constructor_", value: function() {
          if (0 === arguments.length) X.constructor_.call(this);
          else if (1 === arguments.length) {
            if (arguments[0] instanceof i2) {
              var t3 = arguments[0];
              X.constructor_.call(this, t3.x, t3.y);
            } else if (arguments[0] instanceof X) {
              var e2 = arguments[0];
              X.constructor_.call(this, e2.x, e2.y);
            }
          } else if (2 === arguments.length) {
            var n2 = arguments[0], r2 = arguments[1];
            X.constructor_.call(this, n2, r2, X.NULL_ORDINATE);
          }
        } }]);
      })(X);
      Bt.X = 0, Bt.Y = 1, Bt.Z = -1, Bt.M = -1;
      var Ut = (function(t2) {
        function i2() {
          var t3;
          return n(this, i2), t3 = e(this, i2), i2.constructor_.apply(t3, arguments), t3;
        }
        return l(i2, t2), s(i2, [{ key: "getM", value: function() {
          return this._m;
        } }, { key: "setOrdinate", value: function(t3, e2) {
          switch (t3) {
            case i2.X:
              this.x = e2;
              break;
            case i2.Y:
              this.y = e2;
              break;
            case i2.M:
              this._m = e2;
              break;
            default:
              throw new m("Invalid ordinate index: " + t3);
          }
        } }, { key: "setM", value: function(t3) {
          this._m = t3;
        } }, { key: "getZ", value: function() {
          return X.NULL_ORDINATE;
        } }, { key: "getOrdinate", value: function(t3) {
          switch (t3) {
            case i2.X:
              return this.x;
            case i2.Y:
              return this.y;
            case i2.M:
              return this._m;
          }
          throw new m("Invalid ordinate index: " + t3);
        } }, { key: "setZ", value: function(t3) {
          throw new m("CoordinateXY dimension 2 does not support z-ordinate");
        } }, { key: "copy", value: function() {
          return new i2(this);
        } }, { key: "toString", value: function() {
          return "(" + this.x + ", " + this.y + " m=" + this.getM() + ")";
        } }, { key: "setCoordinate", value: function(t3) {
          this.x = t3.x, this.y = t3.y, this.z = t3.getZ(), this._m = t3.getM();
        } }], [{ key: "constructor_", value: function() {
          if (this._m = null, 0 === arguments.length) X.constructor_.call(this), this._m = 0;
          else if (1 === arguments.length) {
            if (arguments[0] instanceof i2) {
              var t3 = arguments[0];
              X.constructor_.call(this, t3.x, t3.y), this._m = t3._m;
            } else if (arguments[0] instanceof X) {
              var e2 = arguments[0];
              X.constructor_.call(this, e2.x, e2.y), this._m = this.getM();
            }
          } else if (3 === arguments.length) {
            var n2 = arguments[0], r2 = arguments[1], s2 = arguments[2];
            X.constructor_.call(this, n2, r2, X.NULL_ORDINATE), this._m = s2;
          }
        } }]);
      })(X);
      Ut.X = 0, Ut.Y = 1, Ut.Z = -1, Ut.M = 2;
      var Vt = (function(t2) {
        function i2() {
          var t3;
          return n(this, i2), t3 = e(this, i2), i2.constructor_.apply(t3, arguments), t3;
        }
        return l(i2, t2), s(i2, [{ key: "getM", value: function() {
          return this._m;
        } }, { key: "setOrdinate", value: function(t3, e2) {
          switch (t3) {
            case X.X:
              this.x = e2;
              break;
            case X.Y:
              this.y = e2;
              break;
            case X.Z:
              this.z = e2;
              break;
            case X.M:
              this._m = e2;
              break;
            default:
              throw new m("Invalid ordinate index: " + t3);
          }
        } }, { key: "setM", value: function(t3) {
          this._m = t3;
        } }, { key: "getOrdinate", value: function(t3) {
          switch (t3) {
            case X.X:
              return this.x;
            case X.Y:
              return this.y;
            case X.Z:
              return this.getZ();
            case X.M:
              return this.getM();
          }
          throw new m("Invalid ordinate index: " + t3);
        } }, { key: "copy", value: function() {
          return new i2(this);
        } }, { key: "toString", value: function() {
          return "(" + this.x + ", " + this.y + ", " + this.getZ() + " m=" + this.getM() + ")";
        } }, { key: "setCoordinate", value: function(t3) {
          this.x = t3.x, this.y = t3.y, this.z = t3.getZ(), this._m = t3.getM();
        } }], [{ key: "constructor_", value: function() {
          if (this._m = null, 0 === arguments.length) X.constructor_.call(this), this._m = 0;
          else if (1 === arguments.length) {
            if (arguments[0] instanceof i2) {
              var t3 = arguments[0];
              X.constructor_.call(this, t3), this._m = t3._m;
            } else if (arguments[0] instanceof X) {
              var e2 = arguments[0];
              X.constructor_.call(this, e2), this._m = this.getM();
            }
          } else if (4 === arguments.length) {
            var n2 = arguments[0], r2 = arguments[1], s2 = arguments[2], a2 = arguments[3];
            X.constructor_.call(this, n2, r2, s2), this._m = a2;
          }
        } }]);
      })(X), Ht = (function() {
        function t2() {
          n(this, t2);
        }
        return s(t2, null, [{ key: "measures", value: function(t3) {
          return t3 instanceof Bt ? 0 : t3 instanceof Ut || t3 instanceof Vt ? 1 : 0;
        } }, { key: "dimension", value: function(t3) {
          return t3 instanceof Bt ? 2 : t3 instanceof Ut ? 3 : t3 instanceof Vt ? 4 : 3;
        } }, { key: "create", value: function() {
          if (1 === arguments.length) {
            var e2 = arguments[0];
            return t2.create(e2, 0);
          }
          if (2 === arguments.length) {
            var n2 = arguments[0], i2 = arguments[1];
            return 2 === n2 ? new Bt() : 3 === n2 && 0 === i2 ? new X() : 3 === n2 && 1 === i2 ? new Ut() : 4 === n2 && 1 === i2 ? new Vt() : new X();
          }
        } }]);
      })(), Zt = (function(t2) {
        function i2() {
          var t3;
          return n(this, i2), t3 = e(this, i2), i2.constructor_.apply(t3, arguments), t3;
        }
        return l(i2, t2), s(i2, [{ key: "getCoordinate", value: function(t3) {
          return this.get(t3);
        } }, { key: "addAll", value: function() {
          if (2 === arguments.length && "boolean" == typeof arguments[1] && rt(arguments[0], Z)) {
            for (var t3 = arguments[1], e2 = false, n2 = arguments[0].iterator(); n2.hasNext(); ) this.add(n2.next(), t3), e2 = true;
            return e2;
          }
          return f(i2, "addAll", this, 1).apply(this, arguments);
        } }, { key: "clone", value: function() {
          for (var t3 = f(i2, "clone", this, 1).call(this), e2 = 0; e2 < this.size(); e2++) t3.add(e2, this.get(e2).clone());
          return t3;
        } }, { key: "toCoordinateArray", value: function() {
          if (0 === arguments.length) return this.toArray(i2.coordArrayType);
          if (1 === arguments.length) {
            if (arguments[0]) return this.toArray(i2.coordArrayType);
            for (var t3 = this.size(), e2 = new Array(t3).fill(null), n2 = 0; n2 < t3; n2++) e2[n2] = this.get(t3 - n2 - 1);
            return e2;
          }
        } }, { key: "add", value: function() {
          if (1 === arguments.length) {
            var t3 = arguments[0];
            return f(i2, "add", this, 1).call(this, t3);
          }
          if (2 === arguments.length) {
            if (arguments[0] instanceof Array && "boolean" == typeof arguments[1]) {
              var e2 = arguments[0], n2 = arguments[1];
              return this.add(e2, n2, true), true;
            }
            if (arguments[0] instanceof X && "boolean" == typeof arguments[1]) {
              var r2 = arguments[0];
              if (!arguments[1] && this.size() >= 1) {
                if (this.get(this.size() - 1).equals2D(r2)) return null;
              }
              f(i2, "add", this, 1).call(this, r2);
            } else if (arguments[0] instanceof Object && "boolean" == typeof arguments[1]) {
              var s2 = arguments[0], a2 = arguments[1];
              return this.add(s2, a2), true;
            }
          } else if (3 === arguments.length) {
            if ("boolean" == typeof arguments[2] && arguments[0] instanceof Array && "boolean" == typeof arguments[1]) {
              var o2 = arguments[0], u5 = arguments[1];
              if (arguments[2]) for (var l2 = 0; l2 < o2.length; l2++) this.add(o2[l2], u5);
              else for (var h2 = o2.length - 1; h2 >= 0; h2--) this.add(o2[h2], u5);
              return true;
            }
            if ("boolean" == typeof arguments[2] && Number.isInteger(arguments[0]) && arguments[1] instanceof X) {
              var c2 = arguments[0], g2 = arguments[1];
              if (!arguments[2]) {
                var v3 = this.size();
                if (v3 > 0) {
                  if (c2 > 0) {
                    if (this.get(c2 - 1).equals2D(g2)) return null;
                  }
                  if (c2 < v3) {
                    if (this.get(c2).equals2D(g2)) return null;
                  }
                }
              }
              f(i2, "add", this, 1).call(this, c2, g2);
            }
          } else if (4 === arguments.length) {
            var y2 = arguments[0], d2 = arguments[1], _2 = arguments[2], p2 = arguments[3], m2 = 1;
            _2 > p2 && (m2 = -1);
            for (var k2 = _2; k2 !== p2; k2 += m2) this.add(y2[k2], d2);
            return true;
          }
        } }, { key: "closeRing", value: function() {
          if (this.size() > 0) {
            var t3 = this.get(0).copy();
            this.add(t3, false);
          }
        } }], [{ key: "constructor_", value: function() {
          if (0 === arguments.length) ;
          else if (1 === arguments.length) {
            var t3 = arguments[0];
            this.ensureCapacity(t3.length), this.add(t3, true);
          } else if (2 === arguments.length) {
            var e2 = arguments[0], n2 = arguments[1];
            this.ensureCapacity(e2.length), this.add(e2, n2);
          }
        } }]);
      })(yt);
      Zt.coordArrayType = new Array(0).fill(null);
      var jt = (function() {
        function t2() {
          n(this, t2);
        }
        return s(t2, null, [{ key: "isRing", value: function(t3) {
          return !(t3.length < 4) && !!t3[0].equals2D(t3[t3.length - 1]);
        } }, { key: "ptNotInList", value: function(e2, n2) {
          for (var i2 = 0; i2 < e2.length; i2++) {
            var r2 = e2[i2];
            if (t2.indexOf(r2, n2) < 0) return r2;
          }
          return null;
        } }, { key: "scroll", value: function(e2, n2) {
          var i2 = t2.indexOf(n2, e2);
          if (i2 < 0) return null;
          var r2 = new Array(e2.length).fill(null);
          mt.arraycopy(e2, i2, r2, 0, e2.length - i2), mt.arraycopy(e2, 0, r2, e2.length - i2, i2), mt.arraycopy(r2, 0, e2, 0, e2.length);
        } }, { key: "equals", value: function() {
          if (2 === arguments.length) {
            var t3 = arguments[0], e2 = arguments[1];
            if (t3 === e2) return true;
            if (null === t3 || null === e2) return false;
            if (t3.length !== e2.length) return false;
            for (var n2 = 0; n2 < t3.length; n2++) if (!t3[n2].equals(e2[n2])) return false;
            return true;
          }
          if (3 === arguments.length) {
            var i2 = arguments[0], r2 = arguments[1], s2 = arguments[2];
            if (i2 === r2) return true;
            if (null === i2 || null === r2) return false;
            if (i2.length !== r2.length) return false;
            for (var a2 = 0; a2 < i2.length; a2++) if (0 !== s2.compare(i2[a2], r2[a2])) return false;
            return true;
          }
        } }, { key: "intersection", value: function(t3, e2) {
          for (var n2 = new Zt(), i2 = 0; i2 < t3.length; i2++) e2.intersects(t3[i2]) && n2.add(t3[i2], true);
          return n2.toCoordinateArray();
        } }, { key: "measures", value: function(t3) {
          if (null === t3 || 0 === t3.length) return 0;
          var e2, n2 = 0, i2 = a(t3);
          try {
            for (i2.s(); !(e2 = i2.n()).done; ) {
              var r2 = e2.value;
              n2 = Math.max(n2, Ht.measures(r2));
            }
          } catch (t4) {
            i2.e(t4);
          } finally {
            i2.f();
          }
          return n2;
        } }, { key: "hasRepeatedPoints", value: function(t3) {
          for (var e2 = 1; e2 < t3.length; e2++) if (t3[e2 - 1].equals(t3[e2])) return true;
          return false;
        } }, { key: "removeRepeatedPoints", value: function(e2) {
          return t2.hasRepeatedPoints(e2) ? new Zt(e2, false).toCoordinateArray() : e2;
        } }, { key: "reverse", value: function(t3) {
          for (var e2 = t3.length - 1, n2 = Math.trunc(e2 / 2), i2 = 0; i2 <= n2; i2++) {
            var r2 = t3[i2];
            t3[i2] = t3[e2 - i2], t3[e2 - i2] = r2;
          }
        } }, { key: "removeNull", value: function(t3) {
          for (var e2 = 0, n2 = 0; n2 < t3.length; n2++) null !== t3[n2] && e2++;
          var i2 = new Array(e2).fill(null);
          if (0 === e2) return i2;
          for (var r2 = 0, s2 = 0; s2 < t3.length; s2++) null !== t3[s2] && (i2[r2++] = t3[s2]);
          return i2;
        } }, { key: "copyDeep", value: function() {
          if (1 === arguments.length) {
            for (var t3 = arguments[0], e2 = new Array(t3.length).fill(null), n2 = 0; n2 < t3.length; n2++) e2[n2] = t3[n2].copy();
            return e2;
          }
          if (5 === arguments.length) for (var i2 = arguments[0], r2 = arguments[1], s2 = arguments[2], a2 = arguments[3], o2 = arguments[4], u5 = 0; u5 < o2; u5++) s2[a2 + u5] = i2[r2 + u5].copy();
        } }, { key: "isEqualReversed", value: function(t3, e2) {
          for (var n2 = 0; n2 < t3.length; n2++) {
            var i2 = t3[n2], r2 = e2[t3.length - n2 - 1];
            if (0 !== i2.compareTo(r2)) return false;
          }
          return true;
        } }, { key: "envelope", value: function(t3) {
          for (var e2 = new U(), n2 = 0; n2 < t3.length; n2++) e2.expandToInclude(t3[n2]);
          return e2;
        } }, { key: "toCoordinateArray", value: function(e2) {
          return e2.toArray(t2.coordArrayType);
        } }, { key: "dimension", value: function(t3) {
          if (null === t3 || 0 === t3.length) return 3;
          var e2, n2 = 0, i2 = a(t3);
          try {
            for (i2.s(); !(e2 = i2.n()).done; ) {
              var r2 = e2.value;
              n2 = Math.max(n2, Ht.dimension(r2));
            }
          } catch (t4) {
            i2.e(t4);
          } finally {
            i2.f();
          }
          return n2;
        } }, { key: "atLeastNCoordinatesOrNothing", value: function(t3, e2) {
          return e2.length >= t3 ? e2 : [];
        } }, { key: "indexOf", value: function(t3, e2) {
          for (var n2 = 0; n2 < e2.length; n2++) if (t3.equals(e2[n2])) return n2;
          return -1;
        } }, { key: "increasingDirection", value: function(t3) {
          for (var e2 = 0; e2 < Math.trunc(t3.length / 2); e2++) {
            var n2 = t3.length - 1 - e2, i2 = t3[e2].compareTo(t3[n2]);
            if (0 !== i2) return i2;
          }
          return 1;
        } }, { key: "compare", value: function(t3, e2) {
          for (var n2 = 0; n2 < t3.length && n2 < e2.length; ) {
            var i2 = t3[n2].compareTo(e2[n2]);
            if (0 !== i2) return i2;
            n2++;
          }
          return n2 < e2.length ? -1 : n2 < t3.length ? 1 : 0;
        } }, { key: "minCoordinate", value: function(t3) {
          for (var e2 = null, n2 = 0; n2 < t3.length; n2++) (null === e2 || e2.compareTo(t3[n2]) > 0) && (e2 = t3[n2]);
          return e2;
        } }, { key: "extract", value: function(t3, e2, n2) {
          e2 = kt.clamp(e2, 0, t3.length);
          var i2 = (n2 = kt.clamp(n2, -1, t3.length)) - e2 + 1;
          n2 < 0 && (i2 = 0), e2 >= t3.length && (i2 = 0), n2 < e2 && (i2 = 0);
          var r2 = new Array(i2).fill(null);
          if (0 === i2) return r2;
          for (var s2 = 0, a2 = e2; a2 <= n2; a2++) r2[s2++] = t3[a2];
          return r2;
        } }]);
      })(), Wt = (function() {
        return s((function t2() {
          n(this, t2);
        }), [{ key: "compare", value: function(t2, e2) {
          var n2 = t2, i2 = e2;
          return jt.compare(n2, i2);
        } }, { key: "interfaces_", get: function() {
          return [P];
        } }]);
      })(), Kt = (function() {
        return s((function t2() {
          n(this, t2);
        }), [{ key: "compare", value: function(t2, e2) {
          var n2 = t2, i2 = e2;
          if (n2.length < i2.length) return -1;
          if (n2.length > i2.length) return 1;
          if (0 === n2.length) return 0;
          var r2 = jt.compare(n2, i2);
          return jt.isEqualReversed(n2, i2) ? 0 : r2;
        } }, { key: "OLDcompare", value: function(t2, e2) {
          var n2 = t2, i2 = e2;
          if (n2.length < i2.length) return -1;
          if (n2.length > i2.length) return 1;
          if (0 === n2.length) return 0;
          for (var r2 = jt.increasingDirection(n2), s2 = jt.increasingDirection(i2), a2 = r2 > 0 ? 0 : n2.length - 1, o2 = s2 > 0 ? 0 : n2.length - 1, u5 = 0; u5 < n2.length; u5++) {
            var l2 = n2[a2].compareTo(i2[o2]);
            if (0 !== l2) return l2;
            a2 += r2, o2 += s2;
          }
          return 0;
        } }, { key: "interfaces_", get: function() {
          return [P];
        } }]);
      })();
      jt.ForwardComparator = Wt, jt.BidirectionalComparator = Kt, jt.coordArrayType = new Array(0).fill(null);
      var Jt = (function() {
        return s((function t2(e2) {
          n(this, t2), this.str = e2;
        }), [{ key: "append", value: function(t2) {
          this.str += t2;
        } }, { key: "setCharAt", value: function(t2, e2) {
          this.str = this.str.substr(0, t2) + e2 + this.str.substr(t2 + 1);
        } }, { key: "toString", value: function() {
          return this.str;
        } }]);
      })(), Qt = (function() {
        function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }
        return s(t2, [{ key: "getM", value: function(t3) {
          return this.hasM() ? this._coordinates[t3].getM() : A.NaN;
        } }, { key: "setOrdinate", value: function(t3, e2, n2) {
          switch (e2) {
            case ht.X:
              this._coordinates[t3].x = n2;
              break;
            case ht.Y:
              this._coordinates[t3].y = n2;
              break;
            default:
              this._coordinates[t3].setOrdinate(e2, n2);
          }
        } }, { key: "getZ", value: function(t3) {
          return this.hasZ() ? this._coordinates[t3].getZ() : A.NaN;
        } }, { key: "size", value: function() {
          return this._coordinates.length;
        } }, { key: "getOrdinate", value: function(t3, e2) {
          switch (e2) {
            case ht.X:
              return this._coordinates[t3].x;
            case ht.Y:
              return this._coordinates[t3].y;
            default:
              return this._coordinates[t3].getOrdinate(e2);
          }
        } }, { key: "getCoordinate", value: function() {
          if (1 === arguments.length) {
            var t3 = arguments[0];
            return this._coordinates[t3];
          }
          if (2 === arguments.length) {
            var e2 = arguments[0];
            arguments[1].setCoordinate(this._coordinates[e2]);
          }
        } }, { key: "getCoordinateCopy", value: function(t3) {
          var e2 = this.createCoordinate();
          return e2.setCoordinate(this._coordinates[t3]), e2;
        } }, { key: "createCoordinate", value: function() {
          return Ht.create(this.getDimension(), this.getMeasures());
        } }, { key: "getDimension", value: function() {
          return this._dimension;
        } }, { key: "getX", value: function(t3) {
          return this._coordinates[t3].x;
        } }, { key: "getMeasures", value: function() {
          return this._measures;
        } }, { key: "expandEnvelope", value: function(t3) {
          for (var e2 = 0; e2 < this._coordinates.length; e2++) t3.expandToInclude(this._coordinates[e2]);
          return t3;
        } }, { key: "copy", value: function() {
          for (var e2 = new Array(this.size()).fill(null), n2 = 0; n2 < this._coordinates.length; n2++) {
            var i2 = this.createCoordinate();
            i2.setCoordinate(this._coordinates[n2]), e2[n2] = i2;
          }
          return new t2(e2, this._dimension, this._measures);
        } }, { key: "toString", value: function() {
          if (this._coordinates.length > 0) {
            var t3 = new Jt(17 * this._coordinates.length);
            t3.append("("), t3.append(this._coordinates[0]);
            for (var e2 = 1; e2 < this._coordinates.length; e2++) t3.append(", "), t3.append(this._coordinates[e2]);
            return t3.append(")"), t3.toString();
          }
          return "()";
        } }, { key: "getY", value: function(t3) {
          return this._coordinates[t3].y;
        } }, { key: "toCoordinateArray", value: function() {
          return this._coordinates;
        } }, { key: "interfaces_", get: function() {
          return [ht, E];
        } }], [{ key: "constructor_", value: function() {
          if (this._dimension = 3, this._measures = 0, this._coordinates = null, 1 === arguments.length) {
            if (arguments[0] instanceof Array) {
              var e2 = arguments[0];
              t2.constructor_.call(this, e2, jt.dimension(e2), jt.measures(e2));
            } else if (Number.isInteger(arguments[0])) {
              var n2 = arguments[0];
              this._coordinates = new Array(n2).fill(null);
              for (var i2 = 0; i2 < n2; i2++) this._coordinates[i2] = new X();
            } else if (rt(arguments[0], ht)) {
              var r2 = arguments[0];
              if (null === r2) return this._coordinates = new Array(0).fill(null), null;
              this._dimension = r2.getDimension(), this._measures = r2.getMeasures(), this._coordinates = new Array(r2.size()).fill(null);
              for (var s2 = 0; s2 < this._coordinates.length; s2++) this._coordinates[s2] = r2.getCoordinateCopy(s2);
            }
          } else if (2 === arguments.length) {
            if (arguments[0] instanceof Array && Number.isInteger(arguments[1])) {
              var a2 = arguments[0], o2 = arguments[1];
              t2.constructor_.call(this, a2, o2, jt.measures(a2));
            } else if (Number.isInteger(arguments[0]) && Number.isInteger(arguments[1])) {
              var u5 = arguments[0], l2 = arguments[1];
              this._coordinates = new Array(u5).fill(null), this._dimension = l2;
              for (var h2 = 0; h2 < u5; h2++) this._coordinates[h2] = Ht.create(l2);
            }
          } else if (3 === arguments.length) {
            if (Number.isInteger(arguments[2]) && arguments[0] instanceof Array && Number.isInteger(arguments[1])) {
              var c2 = arguments[0], f2 = arguments[1], g2 = arguments[2];
              this._dimension = f2, this._measures = g2, this._coordinates = null === c2 ? new Array(0).fill(null) : c2;
            } else if (Number.isInteger(arguments[2]) && Number.isInteger(arguments[0]) && Number.isInteger(arguments[1])) {
              var v3 = arguments[0], y2 = arguments[1], d2 = arguments[2];
              this._coordinates = new Array(v3).fill(null), this._dimension = y2, this._measures = d2;
              for (var _2 = 0; _2 < v3; _2++) this._coordinates[_2] = this.createCoordinate();
            }
          }
        } }]);
      })(), $t = (function() {
        function t2() {
          n(this, t2);
        }
        return s(t2, [{ key: "readResolve", value: function() {
          return t2.instance();
        } }, { key: "create", value: function() {
          if (1 === arguments.length) {
            if (arguments[0] instanceof Array) return new Qt(arguments[0]);
            if (rt(arguments[0], ht)) return new Qt(arguments[0]);
          } else {
            if (2 === arguments.length) {
              var t3 = arguments[1];
              return t3 > 3 && (t3 = 3), t3 < 2 && (t3 = 2), new Qt(arguments[0], t3);
            }
            if (3 === arguments.length) {
              var e2 = arguments[2], n2 = arguments[1] - e2;
              return e2 > 1 && (e2 = 1), n2 > 3 && (n2 = 3), n2 < 2 && (n2 = 2), new Qt(arguments[0], n2 + e2, e2);
            }
          }
        } }, { key: "interfaces_", get: function() {
          return [It, E];
        } }], [{ key: "instance", value: function() {
          return t2.instanceObject;
        } }]);
      })();
      $t.instanceObject = new $t();
      var te = (function(t2) {
        function i2() {
          var t3;
          return n(this, i2), t3 = e(this, i2), i2.constructor_.apply(t3, arguments), t3;
        }
        return l(i2, t2), s(i2, [{ key: "copyInternal", value: function() {
          for (var t3 = new Array(this._geometries.length).fill(null), e2 = 0; e2 < t3.length; e2++) t3[e2] = this._geometries[e2].copy();
          return new i2(t3, this._factory);
        } }, { key: "equalsExact", value: function() {
          if (2 === arguments.length && "number" == typeof arguments[1] && arguments[0] instanceof V) {
            var t3 = arguments[0], e2 = arguments[1];
            return !!this.isEquivalentClass(t3) && f(i2, "equalsExact", this, 1).call(this, t3, e2);
          }
          return f(i2, "equalsExact", this, 1).apply(this, arguments);
        } }, { key: "getBoundaryDimension", value: function() {
          return 1;
        } }, { key: "getTypeCode", value: function() {
          return V.TYPECODE_MULTIPOLYGON;
        } }, { key: "getDimension", value: function() {
          return 2;
        } }, { key: "getBoundary", value: function() {
          if (this.isEmpty()) return this.getFactory().createMultiLineString();
          for (var t3 = new yt(), e2 = 0; e2 < this._geometries.length; e2++) for (var n2 = this._geometries[e2].getBoundary(), i3 = 0; i3 < n2.getNumGeometries(); i3++) t3.add(n2.getGeometryN(i3));
          var r2 = new Array(t3.size()).fill(null);
          return this.getFactory().createMultiLineString(t3.toArray(r2));
        } }, { key: "getGeometryType", value: function() {
          return V.TYPENAME_MULTIPOLYGON;
        } }, { key: "interfaces_", get: function() {
          return [Pt];
        } }], [{ key: "constructor_", value: function() {
          var t3 = arguments[0], e2 = arguments[1];
          Yt.constructor_.call(this, t3, e2);
        } }]);
      })(Yt), ee = (function() {
        return s((function t2() {
          n(this, t2);
        }), [{ key: "get", value: function() {
        } }, { key: "put", value: function() {
        } }, { key: "size", value: function() {
        } }, { key: "values", value: function() {
        } }, { key: "entrySet", value: function() {
        } }]);
      })(), ne = (function(t2) {
        function i2() {
          var t3;
          return n(this, i2), (t3 = e(this, i2)).map = /* @__PURE__ */ new Map(), t3;
        }
        return l(i2, t2), s(i2, [{ key: "get", value: function(t3) {
          return this.map.get(t3) || null;
        } }, { key: "put", value: function(t3, e2) {
          return this.map.set(t3, e2), e2;
        } }, { key: "values", value: function() {
          for (var t3 = new yt(), e2 = this.map.values(), n2 = e2.next(); !n2.done; ) t3.add(n2.value), n2 = e2.next();
          return t3;
        } }, { key: "entrySet", value: function() {
          var t3 = new J();
          return this.map.entries().forEach((function(e2) {
            return t3.add(e2);
          })), t3;
        } }, { key: "size", value: function() {
          return this.map.size();
        } }]);
      })(ee), ie = (function() {
        function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }
        return s(t2, [{ key: "equals", value: function(e2) {
          if (!(e2 instanceof t2)) return false;
          var n2 = e2;
          return this._modelType === n2._modelType && this._scale === n2._scale;
        } }, { key: "compareTo", value: function(t3) {
          var e2 = t3, n2 = this.getMaximumSignificantDigits(), i2 = e2.getMaximumSignificantDigits();
          return at.compare(n2, i2);
        } }, { key: "getScale", value: function() {
          return this._scale;
        } }, { key: "isFloating", value: function() {
          return this._modelType === t2.FLOATING || this._modelType === t2.FLOATING_SINGLE;
        } }, { key: "getType", value: function() {
          return this._modelType;
        } }, { key: "toString", value: function() {
          var e2 = "UNKNOWN";
          return this._modelType === t2.FLOATING ? e2 = "Floating" : this._modelType === t2.FLOATING_SINGLE ? e2 = "Floating-Single" : this._modelType === t2.FIXED && (e2 = "Fixed (Scale=" + this.getScale() + ")"), e2;
        } }, { key: "makePrecise", value: function() {
          if ("number" == typeof arguments[0]) {
            var e2 = arguments[0];
            return A.isNaN(e2) || this._modelType === t2.FLOATING_SINGLE ? e2 : this._modelType === t2.FIXED ? Math.round(e2 * this._scale) / this._scale : e2;
          }
          if (arguments[0] instanceof X) {
            var n2 = arguments[0];
            if (this._modelType === t2.FLOATING) return null;
            n2.x = this.makePrecise(n2.x), n2.y = this.makePrecise(n2.y);
          }
        } }, { key: "getMaximumSignificantDigits", value: function() {
          var e2 = 16;
          return this._modelType === t2.FLOATING ? e2 = 16 : this._modelType === t2.FLOATING_SINGLE ? e2 = 6 : this._modelType === t2.FIXED && (e2 = 1 + Math.trunc(Math.ceil(Math.log(this.getScale()) / Math.log(10)))), e2;
        } }, { key: "setScale", value: function(t3) {
          this._scale = Math.abs(t3);
        } }, { key: "interfaces_", get: function() {
          return [E, x];
        } }], [{ key: "constructor_", value: function() {
          if (this._modelType = null, this._scale = null, 0 === arguments.length) this._modelType = t2.FLOATING;
          else if (1 === arguments.length) {
            if (arguments[0] instanceof re) {
              var e2 = arguments[0];
              this._modelType = e2, e2 === t2.FIXED && this.setScale(1);
            } else if ("number" == typeof arguments[0]) {
              var n2 = arguments[0];
              this._modelType = t2.FIXED, this.setScale(n2);
            } else if (arguments[0] instanceof t2) {
              var i2 = arguments[0];
              this._modelType = i2._modelType, this._scale = i2._scale;
            }
          }
        } }, { key: "mostPrecise", value: function(t3, e2) {
          return t3.compareTo(e2) >= 0 ? t3 : e2;
        } }]);
      })(), re = (function() {
        function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }
        return s(t2, [{ key: "readResolve", value: function() {
          return t2.nameToTypeMap.get(this._name);
        } }, { key: "toString", value: function() {
          return this._name;
        } }, { key: "interfaces_", get: function() {
          return [E];
        } }], [{ key: "constructor_", value: function() {
          this._name = null;
          var e2 = arguments[0];
          this._name = e2, t2.nameToTypeMap.put(e2, this);
        } }]);
      })();
      re.nameToTypeMap = new ne(), ie.Type = re, ie.FIXED = new re("FIXED"), ie.FLOATING = new re("FLOATING"), ie.FLOATING_SINGLE = new re("FLOATING SINGLE"), ie.maximumPreciseValue = 9007199254740992;
      var se = (function(t2) {
        function i2() {
          var t3;
          return n(this, i2), t3 = e(this, i2), i2.constructor_.apply(t3, arguments), t3;
        }
        return l(i2, t2), s(i2, [{ key: "copyInternal", value: function() {
          for (var t3 = new Array(this._geometries.length).fill(null), e2 = 0; e2 < t3.length; e2++) t3[e2] = this._geometries[e2].copy();
          return new i2(t3, this._factory);
        } }, { key: "equalsExact", value: function() {
          if (2 === arguments.length && "number" == typeof arguments[1] && arguments[0] instanceof V) {
            var t3 = arguments[0], e2 = arguments[1];
            return !!this.isEquivalentClass(t3) && f(i2, "equalsExact", this, 1).call(this, t3, e2);
          }
          return f(i2, "equalsExact", this, 1).apply(this, arguments);
        } }, { key: "getBoundaryDimension", value: function() {
          return this.isClosed() ? Lt.FALSE : 0;
        } }, { key: "isClosed", value: function() {
          if (this.isEmpty()) return false;
          for (var t3 = 0; t3 < this._geometries.length; t3++) if (!this._geometries[t3].isClosed()) return false;
          return true;
        } }, { key: "getTypeCode", value: function() {
          return V.TYPECODE_MULTILINESTRING;
        } }, { key: "getDimension", value: function() {
          return 1;
        } }, { key: "getBoundary", value: function() {
          throw new W();
        } }, { key: "getGeometryType", value: function() {
          return V.TYPENAME_MULTILINESTRING;
        } }, { key: "interfaces_", get: function() {
          return [Tt];
        } }], [{ key: "constructor_", value: function() {
          var t3 = arguments[0], e2 = arguments[1];
          Yt.constructor_.call(this, t3, e2);
        } }]);
      })(Yt), ae = (function() {
        function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }
        return s(t2, [{ key: "createEmpty", value: function(t3) {
          switch (t3) {
            case -1:
              return this.createGeometryCollection();
            case 0:
              return this.createPoint();
            case 1:
              return this.createLineString();
            case 2:
              return this.createPolygon();
            default:
              throw new m("Invalid dimension: " + t3);
          }
        } }, { key: "toGeometry", value: function(t3) {
          return t3.isNull() ? this.createPoint() : t3.getMinX() === t3.getMaxX() && t3.getMinY() === t3.getMaxY() ? this.createPoint(new X(t3.getMinX(), t3.getMinY())) : t3.getMinX() === t3.getMaxX() || t3.getMinY() === t3.getMaxY() ? this.createLineString([new X(t3.getMinX(), t3.getMinY()), new X(t3.getMaxX(), t3.getMaxY())]) : this.createPolygon(this.createLinearRing([new X(t3.getMinX(), t3.getMinY()), new X(t3.getMinX(), t3.getMaxY()), new X(t3.getMaxX(), t3.getMaxY()), new X(t3.getMaxX(), t3.getMinY()), new X(t3.getMinX(), t3.getMinY())]), null);
        } }, { key: "createLineString", value: function() {
          if (0 === arguments.length) return this.createLineString(this.getCoordinateSequenceFactory().create([]));
          if (1 === arguments.length) {
            if (arguments[0] instanceof Array) {
              var t3 = arguments[0];
              return this.createLineString(null !== t3 ? this.getCoordinateSequenceFactory().create(t3) : null);
            }
            if (rt(arguments[0], ht)) return new wt(arguments[0], this);
          }
        } }, { key: "createMultiLineString", value: function() {
          return 0 === arguments.length ? new se(null, this) : 1 === arguments.length ? new se(arguments[0], this) : void 0;
        } }, { key: "buildGeometry", value: function(e2) {
          for (var n2 = null, i2 = false, r2 = false, s2 = e2.iterator(); s2.hasNext(); ) {
            var a2 = s2.next(), o2 = a2.getTypeCode();
            null === n2 && (n2 = o2), o2 !== n2 && (i2 = true), a2 instanceof Yt && (r2 = true);
          }
          if (null === n2) return this.createGeometryCollection();
          if (i2 || r2) return this.createGeometryCollection(t2.toGeometryArray(e2));
          var u5 = e2.iterator().next();
          if (e2.size() > 1) {
            if (u5 instanceof Dt) return this.createMultiPolygon(t2.toPolygonArray(e2));
            if (u5 instanceof wt) return this.createMultiLineString(t2.toLineStringArray(e2));
            if (u5 instanceof bt) return this.createMultiPoint(t2.toPointArray(e2));
            G.shouldNeverReachHere("Unhandled geometry type: " + u5.getGeometryType());
          }
          return u5;
        } }, { key: "createMultiPointFromCoords", value: function(t3) {
          return this.createMultiPoint(null !== t3 ? this.getCoordinateSequenceFactory().create(t3) : null);
        } }, { key: "createPoint", value: function() {
          if (0 === arguments.length) return this.createPoint(this.getCoordinateSequenceFactory().create([]));
          if (1 === arguments.length) {
            if (arguments[0] instanceof X) {
              var t3 = arguments[0];
              return this.createPoint(null !== t3 ? this.getCoordinateSequenceFactory().create([t3]) : null);
            }
            if (rt(arguments[0], ht)) return new bt(arguments[0], this);
          }
        } }, { key: "getCoordinateSequenceFactory", value: function() {
          return this._coordinateSequenceFactory;
        } }, { key: "createPolygon", value: function() {
          if (0 === arguments.length) return this.createPolygon(null, null);
          if (1 === arguments.length) {
            if (rt(arguments[0], ht)) {
              var t3 = arguments[0];
              return this.createPolygon(this.createLinearRing(t3));
            }
            if (arguments[0] instanceof Array) {
              var e2 = arguments[0];
              return this.createPolygon(this.createLinearRing(e2));
            }
            if (arguments[0] instanceof Xt) {
              var n2 = arguments[0];
              return this.createPolygon(n2, null);
            }
          } else if (2 === arguments.length) {
            return new Dt(arguments[0], arguments[1], this);
          }
        } }, { key: "getSRID", value: function() {
          return this._SRID;
        } }, { key: "createGeometryCollection", value: function() {
          return 0 === arguments.length ? new Yt(null, this) : 1 === arguments.length ? new Yt(arguments[0], this) : void 0;
        } }, { key: "getPrecisionModel", value: function() {
          return this._precisionModel;
        } }, { key: "createLinearRing", value: function() {
          if (0 === arguments.length) return this.createLinearRing(this.getCoordinateSequenceFactory().create([]));
          if (1 === arguments.length) {
            if (arguments[0] instanceof Array) {
              var t3 = arguments[0];
              return this.createLinearRing(null !== t3 ? this.getCoordinateSequenceFactory().create(t3) : null);
            }
            if (rt(arguments[0], ht)) return new Xt(arguments[0], this);
          }
        } }, { key: "createMultiPolygon", value: function() {
          return 0 === arguments.length ? new te(null, this) : 1 === arguments.length ? new te(arguments[0], this) : void 0;
        } }, { key: "createMultiPoint", value: function() {
          if (0 === arguments.length) return new zt(null, this);
          if (1 === arguments.length) {
            if (arguments[0] instanceof Array) return new zt(arguments[0], this);
            if (rt(arguments[0], ht)) {
              var t3 = arguments[0];
              if (null === t3) return this.createMultiPoint(new Array(0).fill(null));
              for (var e2 = new Array(t3.size()).fill(null), n2 = 0; n2 < t3.size(); n2++) {
                var i2 = this.getCoordinateSequenceFactory().create(1, t3.getDimension(), t3.getMeasures());
                St.copy(t3, n2, i2, 0, 1), e2[n2] = this.createPoint(i2);
              }
              return this.createMultiPoint(e2);
            }
          }
        } }, { key: "interfaces_", get: function() {
          return [E];
        } }], [{ key: "constructor_", value: function() {
          if (this._precisionModel = null, this._coordinateSequenceFactory = null, this._SRID = null, 0 === arguments.length) t2.constructor_.call(this, new ie(), 0);
          else if (1 === arguments.length) {
            if (rt(arguments[0], It)) {
              var e2 = arguments[0];
              t2.constructor_.call(this, new ie(), 0, e2);
            } else if (arguments[0] instanceof ie) {
              var n2 = arguments[0];
              t2.constructor_.call(this, n2, 0, t2.getDefaultCoordinateSequenceFactory());
            }
          } else if (2 === arguments.length) {
            var i2 = arguments[0], r2 = arguments[1];
            t2.constructor_.call(this, i2, r2, t2.getDefaultCoordinateSequenceFactory());
          } else if (3 === arguments.length) {
            var s2 = arguments[0], a2 = arguments[1], o2 = arguments[2];
            this._precisionModel = s2, this._coordinateSequenceFactory = o2, this._SRID = a2;
          }
        } }, { key: "toMultiPolygonArray", value: function(t3) {
          var e2 = new Array(t3.size()).fill(null);
          return t3.toArray(e2);
        } }, { key: "toGeometryArray", value: function(t3) {
          if (null === t3) return null;
          var e2 = new Array(t3.size()).fill(null);
          return t3.toArray(e2);
        } }, { key: "getDefaultCoordinateSequenceFactory", value: function() {
          return $t.instance();
        } }, { key: "toMultiLineStringArray", value: function(t3) {
          var e2 = new Array(t3.size()).fill(null);
          return t3.toArray(e2);
        } }, { key: "toLineStringArray", value: function(t3) {
          var e2 = new Array(t3.size()).fill(null);
          return t3.toArray(e2);
        } }, { key: "toMultiPointArray", value: function(t3) {
          var e2 = new Array(t3.size()).fill(null);
          return t3.toArray(e2);
        } }, { key: "toLinearRingArray", value: function(t3) {
          var e2 = new Array(t3.size()).fill(null);
          return t3.toArray(e2);
        } }, { key: "toPointArray", value: function(t3) {
          var e2 = new Array(t3.size()).fill(null);
          return t3.toArray(e2);
        } }, { key: "toPolygonArray", value: function(t3) {
          var e2 = new Array(t3.size()).fill(null);
          return t3.toArray(e2);
        } }, { key: "createPointFromInternalCoord", value: function(t3, e2) {
          return e2.getPrecisionModel().makePrecise(t3), e2.getFactory().createPoint(t3);
        } }]);
      })(), oe = "XY", ue = "XYZ", le = "XYM", he = "XYZM", ce2 = { POINT: "Point", LINE_STRING: "LineString", LINEAR_RING: "LinearRing", POLYGON: "Polygon", MULTI_POINT: "MultiPoint", MULTI_LINE_STRING: "MultiLineString", MULTI_POLYGON: "MultiPolygon", GEOMETRY_COLLECTION: "GeometryCollection", CIRCLE: "Circle" }, fe = "EMPTY", ge = 1, ve = 2, ye = 3, de2 = 4, _e = 5, pe = 6;
      for (var me in ce2) ce2[me].toUpperCase();
      var ke = (function() {
        return s((function t2(e2) {
          n(this, t2), this.wkt = e2, this.index_ = -1;
        }), [{ key: "isAlpha_", value: function(t2) {
          return t2 >= "a" && t2 <= "z" || t2 >= "A" && t2 <= "Z";
        } }, { key: "isNumeric_", value: function(t2, e2) {
          return t2 >= "0" && t2 <= "9" || "." == t2 && !(void 0 !== e2 && e2);
        } }, { key: "isWhiteSpace_", value: function(t2) {
          return " " == t2 || "	" == t2 || "\r" == t2 || "\n" == t2;
        } }, { key: "nextChar_", value: function() {
          return this.wkt.charAt(++this.index_);
        } }, { key: "nextToken", value: function() {
          var t2, e2 = this.nextChar_(), n2 = this.index_, i2 = e2;
          if ("(" == e2) t2 = ve;
          else if ("," == e2) t2 = _e;
          else if (")" == e2) t2 = ye;
          else if (this.isNumeric_(e2) || "-" == e2) t2 = de2, i2 = this.readNumber_();
          else if (this.isAlpha_(e2)) t2 = ge, i2 = this.readText_();
          else {
            if (this.isWhiteSpace_(e2)) return this.nextToken();
            if ("" !== e2) throw new Error("Unexpected character: " + e2);
            t2 = pe;
          }
          return { position: n2, value: i2, type: t2 };
        } }, { key: "readNumber_", value: function() {
          var t2, e2 = this.index_, n2 = false, i2 = false;
          do {
            "." == t2 ? n2 = true : "e" != t2 && "E" != t2 || (i2 = true), t2 = this.nextChar_();
          } while (this.isNumeric_(t2, n2) || !i2 && ("e" == t2 || "E" == t2) || i2 && ("-" == t2 || "+" == t2));
          return parseFloat(this.wkt.substring(e2, this.index_--));
        } }, { key: "readText_", value: function() {
          var t2, e2 = this.index_;
          do {
            t2 = this.nextChar_();
          } while (this.isAlpha_(t2));
          return this.wkt.substring(e2, this.index_--).toUpperCase();
        } }]);
      })(), xe = (function() {
        return s((function t2(e2, i2) {
          n(this, t2), this.lexer_ = e2, this.token_, this.layout_ = oe, this.factory = i2;
        }), [{ key: "consume_", value: function() {
          this.token_ = this.lexer_.nextToken();
        } }, { key: "isTokenType", value: function(t2) {
          return this.token_.type == t2;
        } }, { key: "match", value: function(t2) {
          var e2 = this.isTokenType(t2);
          return e2 && this.consume_(), e2;
        } }, { key: "parse", value: function() {
          return this.consume_(), this.parseGeometry_();
        } }, { key: "parseGeometryLayout_", value: function() {
          var t2 = oe, e2 = this.token_;
          if (this.isTokenType(ge)) {
            var n2 = e2.value;
            "Z" === n2 ? t2 = ue : "M" === n2 ? t2 = le : "ZM" === n2 && (t2 = he), t2 !== oe && this.consume_();
          }
          return t2;
        } }, { key: "parseGeometryCollectionText_", value: function() {
          if (this.match(ve)) {
            var t2 = [];
            do {
              t2.push(this.parseGeometry_());
            } while (this.match(_e));
            if (this.match(ye)) return t2;
          } else if (this.isEmptyGeometry_()) return [];
          throw new Error(this.formatErrorMessage_());
        } }, { key: "parsePointText_", value: function() {
          if (this.match(ve)) {
            var t2 = this.parsePoint_();
            if (this.match(ye)) return t2;
          } else if (this.isEmptyGeometry_()) return null;
          throw new Error(this.formatErrorMessage_());
        } }, { key: "parseLineStringText_", value: function() {
          if (this.match(ve)) {
            var t2 = this.parsePointList_();
            if (this.match(ye)) return t2;
          } else if (this.isEmptyGeometry_()) return [];
          throw new Error(this.formatErrorMessage_());
        } }, { key: "parsePolygonText_", value: function() {
          if (this.match(ve)) {
            var t2 = this.parseLineStringTextList_();
            if (this.match(ye)) return t2;
          } else if (this.isEmptyGeometry_()) return [];
          throw new Error(this.formatErrorMessage_());
        } }, { key: "parseMultiPointText_", value: function() {
          var t2;
          if (this.match(ve)) {
            if (t2 = this.token_.type == ve ? this.parsePointTextList_() : this.parsePointList_(), this.match(ye)) return t2;
          } else if (this.isEmptyGeometry_()) return [];
          throw new Error(this.formatErrorMessage_());
        } }, { key: "parseMultiLineStringText_", value: function() {
          if (this.match(ve)) {
            var t2 = this.parseLineStringTextList_();
            if (this.match(ye)) return t2;
          } else if (this.isEmptyGeometry_()) return [];
          throw new Error(this.formatErrorMessage_());
        } }, { key: "parseMultiPolygonText_", value: function() {
          if (this.match(ve)) {
            var t2 = this.parsePolygonTextList_();
            if (this.match(ye)) return t2;
          } else if (this.isEmptyGeometry_()) return [];
          throw new Error(this.formatErrorMessage_());
        } }, { key: "parsePoint_", value: function() {
          for (var t2 = [], e2 = this.layout_.length, n2 = 0; n2 < e2; ++n2) {
            var i2 = this.token_;
            if (!this.match(de2)) break;
            t2.push(i2.value);
          }
          if (t2.length == e2) return t2;
          throw new Error(this.formatErrorMessage_());
        } }, { key: "parsePointList_", value: function() {
          for (var t2 = [this.parsePoint_()]; this.match(_e); ) t2.push(this.parsePoint_());
          return t2;
        } }, { key: "parsePointTextList_", value: function() {
          for (var t2 = [this.parsePointText_()]; this.match(_e); ) t2.push(this.parsePointText_());
          return t2;
        } }, { key: "parseLineStringTextList_", value: function() {
          for (var t2 = [this.parseLineStringText_()]; this.match(_e); ) t2.push(this.parseLineStringText_());
          return t2;
        } }, { key: "parsePolygonTextList_", value: function() {
          for (var t2 = [this.parsePolygonText_()]; this.match(_e); ) t2.push(this.parsePolygonText_());
          return t2;
        } }, { key: "isEmptyGeometry_", value: function() {
          var t2 = this.isTokenType(ge) && this.token_.value == fe;
          return t2 && this.consume_(), t2;
        } }, { key: "formatErrorMessage_", value: function() {
          return "Unexpected `" + this.token_.value + "` at position " + this.token_.position + " in `" + this.lexer_.wkt + "`";
        } }, { key: "parseGeometry_", value: function() {
          var t2 = this.factory, e2 = function(t3) {
            return i(X, g(t3));
          }, n2 = function(n3) {
            var i2 = n3.map((function(n4) {
              return t2.createLinearRing(n4.map(e2));
            }));
            return i2.length > 1 ? t2.createPolygon(i2[0], i2.slice(1)) : t2.createPolygon(i2[0]);
          }, r2 = this.token_;
          if (this.match(ge)) {
            var s2 = r2.value;
            if (this.layout_ = this.parseGeometryLayout_(), "GEOMETRYCOLLECTION" == s2) {
              var a2 = this.parseGeometryCollectionText_();
              return t2.createGeometryCollection(a2);
            }
            switch (s2) {
              case "POINT":
                var o2 = this.parsePointText_();
                return o2 ? t2.createPoint(i(X, g(o2))) : t2.createPoint();
              case "LINESTRING":
                var u5 = this.parseLineStringText_().map(e2);
                return t2.createLineString(u5);
              case "LINEARRING":
                var l2 = this.parseLineStringText_().map(e2);
                return t2.createLinearRing(l2);
              case "POLYGON":
                var h2 = this.parsePolygonText_();
                return h2 && 0 !== h2.length ? n2(h2) : t2.createPolygon();
              case "MULTIPOINT":
                var c2 = this.parseMultiPointText_();
                if (!c2 || 0 === c2.length) return t2.createMultiPoint();
                var f2 = c2.map(e2).map((function(e3) {
                  return t2.createPoint(e3);
                }));
                return t2.createMultiPoint(f2);
              case "MULTILINESTRING":
                var v3 = this.parseMultiLineStringText_().map((function(n3) {
                  return t2.createLineString(n3.map(e2));
                }));
                return t2.createMultiLineString(v3);
              case "MULTIPOLYGON":
                var y2 = this.parseMultiPolygonText_();
                if (!y2 || 0 === y2.length) return t2.createMultiPolygon();
                var d2 = y2.map(n2);
                return t2.createMultiPolygon(d2);
              default:
                throw new Error("Invalid geometry type: " + s2);
            }
          }
          throw new Error(this.formatErrorMessage_());
        } }]);
      })();
      function Ie(t2) {
        if (t2.isEmpty()) return "";
        var e2 = t2.getCoordinate(), n2 = [e2.x, e2.y];
        return void 0 === e2.z || Number.isNaN(e2.z) || n2.push(e2.z), void 0 === e2.m || Number.isNaN(e2.m) || n2.push(e2.m), n2.join(" ");
      }
      function Ee(t2) {
        for (var e2 = t2.getCoordinates().map((function(t3) {
          var e3 = [t3.x, t3.y];
          return void 0 === t3.z || Number.isNaN(t3.z) || e3.push(t3.z), void 0 === t3.m || Number.isNaN(t3.m) || e3.push(t3.m), e3;
        })), n2 = [], i2 = 0, r2 = e2.length; i2 < r2; ++i2) n2.push(e2[i2].join(" "));
        return n2.join(", ");
      }
      function Ne(t2) {
        var e2 = [];
        e2.push("(" + Ee(t2.getExteriorRing()) + ")");
        for (var n2 = 0, i2 = t2.getNumInteriorRing(); n2 < i2; ++n2) e2.push("(" + Ee(t2.getInteriorRingN(n2)) + ")");
        return e2.join(", ");
      }
      var Te = { Point: Ie, LineString: Ee, LinearRing: Ee, Polygon: Ne, MultiPoint: function(t2) {
        for (var e2 = [], n2 = 0, i2 = t2.getNumGeometries(); n2 < i2; ++n2) e2.push("(" + Ie(t2.getGeometryN(n2)) + ")");
        return e2.join(", ");
      }, MultiLineString: function(t2) {
        for (var e2 = [], n2 = 0, i2 = t2.getNumGeometries(); n2 < i2; ++n2) e2.push("(" + Ee(t2.getGeometryN(n2)) + ")");
        return e2.join(", ");
      }, MultiPolygon: function(t2) {
        for (var e2 = [], n2 = 0, i2 = t2.getNumGeometries(); n2 < i2; ++n2) e2.push("(" + Ne(t2.getGeometryN(n2)) + ")");
        return e2.join(", ");
      }, GeometryCollection: function(t2) {
        for (var e2 = [], n2 = 0, i2 = t2.getNumGeometries(); n2 < i2; ++n2) e2.push(Se(t2.getGeometryN(n2)));
        return e2.join(", ");
      } };
      function Se(t2) {
        var e2 = t2.getGeometryType(), n2 = Te[e2];
        e2 = e2.toUpperCase();
        var i2 = (function(t3) {
          var e3 = "";
          if (t3.isEmpty()) return e3;
          var n3 = t3.getCoordinate();
          return void 0 === n3.z || Number.isNaN(n3.z) || (e3 += "Z"), void 0 === n3.m || Number.isNaN(n3.m) || (e3 += "M"), e3;
        })(t2);
        return i2.length > 0 && (e2 += " " + i2), t2.isEmpty() ? e2 + " " + fe : e2 + " (" + n2(t2) + ")";
      }
      var Le = (function() {
        return s((function t2(e2) {
          n(this, t2), this.geometryFactory = e2 || new ae(), this.precisionModel = this.geometryFactory.getPrecisionModel();
        }), [{ key: "read", value: function(t2) {
          var e2 = new ke(t2);
          return new xe(e2, this.geometryFactory).parse();
        } }, { key: "write", value: function(t2) {
          return Se(t2);
        } }]);
      })(), Ce = (function() {
        return s((function t2(e2) {
          n(this, t2), this.parser = new Le(e2);
        }), [{ key: "write", value: function(t2) {
          return this.parser.write(t2);
        } }], [{ key: "toLineString", value: function(t2, e2) {
          if (2 !== arguments.length) throw new Error("Not implemented");
          return "LINESTRING ( " + t2.x + " " + t2.y + ", " + e2.x + " " + e2.y + " )";
        } }]);
      })(), Re = (function() {
        function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }
        return s(t2, [{ key: "getIndexAlongSegment", value: function(t3, e2) {
          return this.computeIntLineIndex(), this._intLineIndex[t3][e2];
        } }, { key: "getTopologySummary", value: function() {
          var t3 = new Jt();
          return this.isEndPoint() && t3.append(" endpoint"), this._isProper && t3.append(" proper"), this.isCollinear() && t3.append(" collinear"), t3.toString();
        } }, { key: "computeIntersection", value: function(t3, e2, n2, i2) {
          this._inputLines[0][0] = t3, this._inputLines[0][1] = e2, this._inputLines[1][0] = n2, this._inputLines[1][1] = i2, this._result = this.computeIntersect(t3, e2, n2, i2);
        } }, { key: "getIntersectionNum", value: function() {
          return this._result;
        } }, { key: "computeIntLineIndex", value: function() {
          if (0 === arguments.length) null === this._intLineIndex && (this._intLineIndex = Array(2).fill().map((function() {
            return Array(2);
          })), this.computeIntLineIndex(0), this.computeIntLineIndex(1));
          else if (1 === arguments.length) {
            var t3 = arguments[0];
            this.getEdgeDistance(t3, 0) > this.getEdgeDistance(t3, 1) ? (this._intLineIndex[t3][0] = 0, this._intLineIndex[t3][1] = 1) : (this._intLineIndex[t3][0] = 1, this._intLineIndex[t3][1] = 0);
          }
        } }, { key: "isProper", value: function() {
          return this.hasIntersection() && this._isProper;
        } }, { key: "setPrecisionModel", value: function(t3) {
          this._precisionModel = t3;
        } }, { key: "isInteriorIntersection", value: function() {
          if (0 === arguments.length) return !!this.isInteriorIntersection(0) || !!this.isInteriorIntersection(1);
          if (1 === arguments.length) {
            for (var t3 = arguments[0], e2 = 0; e2 < this._result; e2++) if (!this._intPt[e2].equals2D(this._inputLines[t3][0]) && !this._intPt[e2].equals2D(this._inputLines[t3][1])) return true;
            return false;
          }
        } }, { key: "getIntersection", value: function(t3) {
          return this._intPt[t3];
        } }, { key: "isEndPoint", value: function() {
          return this.hasIntersection() && !this._isProper;
        } }, { key: "hasIntersection", value: function() {
          return this._result !== t2.NO_INTERSECTION;
        } }, { key: "getEdgeDistance", value: function(e2, n2) {
          return t2.computeEdgeDistance(this._intPt[n2], this._inputLines[e2][0], this._inputLines[e2][1]);
        } }, { key: "isCollinear", value: function() {
          return this._result === t2.COLLINEAR_INTERSECTION;
        } }, { key: "toString", value: function() {
          return Ce.toLineString(this._inputLines[0][0], this._inputLines[0][1]) + " - " + Ce.toLineString(this._inputLines[1][0], this._inputLines[1][1]) + this.getTopologySummary();
        } }, { key: "getEndpoint", value: function(t3, e2) {
          return this._inputLines[t3][e2];
        } }, { key: "isIntersection", value: function(t3) {
          for (var e2 = 0; e2 < this._result; e2++) if (this._intPt[e2].equals2D(t3)) return true;
          return false;
        } }, { key: "getIntersectionAlongSegment", value: function(t3, e2) {
          return this.computeIntLineIndex(), this._intPt[this._intLineIndex[t3][e2]];
        } }], [{ key: "constructor_", value: function() {
          this._result = null, this._inputLines = Array(2).fill().map((function() {
            return Array(2);
          })), this._intPt = new Array(2).fill(null), this._intLineIndex = null, this._isProper = null, this._pa = null, this._pb = null, this._precisionModel = null, this._intPt[0] = new X(), this._intPt[1] = new X(), this._pa = this._intPt[0], this._pb = this._intPt[1], this._result = 0;
        } }, { key: "computeEdgeDistance", value: function(t3, e2, n2) {
          var i2 = Math.abs(n2.x - e2.x), r2 = Math.abs(n2.y - e2.y), s2 = -1;
          if (t3.equals(e2)) s2 = 0;
          else if (t3.equals(n2)) s2 = i2 > r2 ? i2 : r2;
          else {
            var a2 = Math.abs(t3.x - e2.x), o2 = Math.abs(t3.y - e2.y);
            0 !== (s2 = i2 > r2 ? a2 : o2) || t3.equals(e2) || (s2 = Math.max(a2, o2));
          }
          return G.isTrue(!(0 === s2 && !t3.equals(e2)), "Bad distance calculation"), s2;
        } }, { key: "nonRobustComputeEdgeDistance", value: function(t3, e2, n2) {
          var i2 = t3.x - e2.x, r2 = t3.y - e2.y, s2 = Math.sqrt(i2 * i2 + r2 * r2);
          return G.isTrue(!(0 === s2 && !t3.equals(e2)), "Invalid distance calculation"), s2;
        } }]);
      })();
      Re.DONT_INTERSECT = 0, Re.DO_INTERSECT = 1, Re.COLLINEAR = 2, Re.NO_INTERSECTION = 0, Re.POINT_INTERSECTION = 1, Re.COLLINEAR_INTERSECTION = 2;
      var we = (function(t2) {
        function i2() {
          return n(this, i2), e(this, i2);
        }
        return l(i2, t2), s(i2, [{ key: "isInSegmentEnvelopes", value: function(t3) {
          var e2 = new U(this._inputLines[0][0], this._inputLines[0][1]), n2 = new U(this._inputLines[1][0], this._inputLines[1][1]);
          return e2.contains(t3) && n2.contains(t3);
        } }, { key: "computeIntersection", value: function() {
          if (3 !== arguments.length) return f(i2, "computeIntersection", this, 1).apply(this, arguments);
          var t3 = arguments[0], e2 = arguments[1], n2 = arguments[2];
          if (this._isProper = false, U.intersects(e2, n2, t3) && 0 === ct.index(e2, n2, t3) && 0 === ct.index(n2, e2, t3)) return this._isProper = true, (t3.equals(e2) || t3.equals(n2)) && (this._isProper = false), this._result = Re.POINT_INTERSECTION, null;
          this._result = Re.NO_INTERSECTION;
        } }, { key: "intersection", value: function(t3, e2, n2, r2) {
          var s2 = this.intersectionSafe(t3, e2, n2, r2);
          return this.isInSegmentEnvelopes(s2) || (s2 = new X(i2.nearestEndpoint(t3, e2, n2, r2))), null !== this._precisionModel && this._precisionModel.makePrecise(s2), s2;
        } }, { key: "checkDD", value: function(t3, e2, n2, i3, r2) {
          var s2 = lt.intersection(t3, e2, n2, i3), a2 = this.isInSegmentEnvelopes(s2);
          mt.out.println("DD in env = " + a2 + "  --------------------- " + s2), r2.distance(s2) > 1e-4 && mt.out.println("Distance = " + r2.distance(s2));
        } }, { key: "intersectionSafe", value: function(t3, e2, n2, r2) {
          var s2 = pt.intersection(t3, e2, n2, r2);
          return null === s2 && (s2 = i2.nearestEndpoint(t3, e2, n2, r2)), s2;
        } }, { key: "computeCollinearIntersection", value: function(t3, e2, n2, i3) {
          var r2 = U.intersects(t3, e2, n2), s2 = U.intersects(t3, e2, i3), a2 = U.intersects(n2, i3, t3), o2 = U.intersects(n2, i3, e2);
          return r2 && s2 ? (this._intPt[0] = n2, this._intPt[1] = i3, Re.COLLINEAR_INTERSECTION) : a2 && o2 ? (this._intPt[0] = t3, this._intPt[1] = e2, Re.COLLINEAR_INTERSECTION) : r2 && a2 ? (this._intPt[0] = n2, this._intPt[1] = t3, !n2.equals(t3) || s2 || o2 ? Re.COLLINEAR_INTERSECTION : Re.POINT_INTERSECTION) : r2 && o2 ? (this._intPt[0] = n2, this._intPt[1] = e2, !n2.equals(e2) || s2 || a2 ? Re.COLLINEAR_INTERSECTION : Re.POINT_INTERSECTION) : s2 && a2 ? (this._intPt[0] = i3, this._intPt[1] = t3, !i3.equals(t3) || r2 || o2 ? Re.COLLINEAR_INTERSECTION : Re.POINT_INTERSECTION) : s2 && o2 ? (this._intPt[0] = i3, this._intPt[1] = e2, !i3.equals(e2) || r2 || a2 ? Re.COLLINEAR_INTERSECTION : Re.POINT_INTERSECTION) : Re.NO_INTERSECTION;
        } }, { key: "computeIntersect", value: function(t3, e2, n2, i3) {
          if (this._isProper = false, !U.intersects(t3, e2, n2, i3)) return Re.NO_INTERSECTION;
          var r2 = ct.index(t3, e2, n2), s2 = ct.index(t3, e2, i3);
          if (r2 > 0 && s2 > 0 || r2 < 0 && s2 < 0) return Re.NO_INTERSECTION;
          var a2 = ct.index(n2, i3, t3), o2 = ct.index(n2, i3, e2);
          return a2 > 0 && o2 > 0 || a2 < 0 && o2 < 0 ? Re.NO_INTERSECTION : 0 === r2 && 0 === s2 && 0 === a2 && 0 === o2 ? this.computeCollinearIntersection(t3, e2, n2, i3) : (0 === r2 || 0 === s2 || 0 === a2 || 0 === o2 ? (this._isProper = false, t3.equals2D(n2) || t3.equals2D(i3) ? this._intPt[0] = t3 : e2.equals2D(n2) || e2.equals2D(i3) ? this._intPt[0] = e2 : 0 === r2 ? this._intPt[0] = new X(n2) : 0 === s2 ? this._intPt[0] = new X(i3) : 0 === a2 ? this._intPt[0] = new X(t3) : 0 === o2 && (this._intPt[0] = new X(e2))) : (this._isProper = true, this._intPt[0] = this.intersection(t3, e2, n2, i3)), Re.POINT_INTERSECTION);
        } }], [{ key: "nearestEndpoint", value: function(t3, e2, n2, i3) {
          var r2 = t3, s2 = xt.pointToSegment(t3, n2, i3), a2 = xt.pointToSegment(e2, n2, i3);
          return a2 < s2 && (s2 = a2, r2 = e2), (a2 = xt.pointToSegment(n2, t3, e2)) < s2 && (s2 = a2, r2 = n2), (a2 = xt.pointToSegment(i3, t3, e2)) < s2 && (s2 = a2, r2 = i3), r2;
        } }]);
      })(Re), Oe = (function() {
        function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }
        return s(t2, [{ key: "countSegment", value: function(t3, e2) {
          if (t3.x < this._p.x && e2.x < this._p.x) return null;
          if (this._p.x === e2.x && this._p.y === e2.y) return this._isPointOnSegment = true, null;
          if (t3.y === this._p.y && e2.y === this._p.y) {
            var n2 = t3.x, i2 = e2.x;
            return n2 > i2 && (n2 = e2.x, i2 = t3.x), this._p.x >= n2 && this._p.x <= i2 && (this._isPointOnSegment = true), null;
          }
          if (t3.y > this._p.y && e2.y <= this._p.y || e2.y > this._p.y && t3.y <= this._p.y) {
            var r2 = ct.index(t3, e2, this._p);
            if (r2 === ct.COLLINEAR) return this._isPointOnSegment = true, null;
            e2.y < t3.y && (r2 = -r2), r2 === ct.LEFT && this._crossingCount++;
          }
        } }, { key: "isPointInPolygon", value: function() {
          return this.getLocation() !== H.EXTERIOR;
        } }, { key: "getLocation", value: function() {
          return this._isPointOnSegment ? H.BOUNDARY : this._crossingCount % 2 == 1 ? H.INTERIOR : H.EXTERIOR;
        } }, { key: "isOnSegment", value: function() {
          return this._isPointOnSegment;
        } }], [{ key: "constructor_", value: function() {
          this._p = null, this._crossingCount = 0, this._isPointOnSegment = false;
          var t3 = arguments[0];
          this._p = t3;
        } }, { key: "locatePointInRing", value: function() {
          if (arguments[0] instanceof X && rt(arguments[1], ht)) {
            for (var e2 = arguments[1], n2 = new t2(arguments[0]), i2 = new X(), r2 = new X(), s2 = 1; s2 < e2.size(); s2++) if (e2.getCoordinate(s2, i2), e2.getCoordinate(s2 - 1, r2), n2.countSegment(i2, r2), n2.isOnSegment()) return n2.getLocation();
            return n2.getLocation();
          }
          if (arguments[0] instanceof X && arguments[1] instanceof Array) {
            for (var a2 = arguments[1], o2 = new t2(arguments[0]), u5 = 1; u5 < a2.length; u5++) {
              var l2 = a2[u5], h2 = a2[u5 - 1];
              if (o2.countSegment(l2, h2), o2.isOnSegment()) return o2.getLocation();
            }
            return o2.getLocation();
          }
        } }]);
      })(), be = (function() {
        function t2() {
          n(this, t2);
        }
        return s(t2, null, [{ key: "isOnLine", value: function() {
          if (arguments[0] instanceof X && rt(arguments[1], ht)) {
            for (var t3 = arguments[0], e2 = arguments[1], n2 = new we(), i2 = new X(), r2 = new X(), s2 = e2.size(), a2 = 1; a2 < s2; a2++) if (e2.getCoordinate(a2 - 1, i2), e2.getCoordinate(a2, r2), n2.computeIntersection(t3, i2, r2), n2.hasIntersection()) return true;
            return false;
          }
          if (arguments[0] instanceof X && arguments[1] instanceof Array) {
            for (var o2 = arguments[0], u5 = arguments[1], l2 = new we(), h2 = 1; h2 < u5.length; h2++) {
              var c2 = u5[h2 - 1], f2 = u5[h2];
              if (l2.computeIntersection(o2, c2, f2), l2.hasIntersection()) return true;
            }
            return false;
          }
        } }, { key: "locateInRing", value: function(t3, e2) {
          return Oe.locatePointInRing(t3, e2);
        } }, { key: "isInRing", value: function(e2, n2) {
          return t2.locateInRing(e2, n2) !== H.EXTERIOR;
        } }]);
      })(), Me = (function() {
        function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }
        return s(t2, [{ key: "setAllLocations", value: function(t3) {
          for (var e2 = 0; e2 < this.location.length; e2++) this.location[e2] = t3;
        } }, { key: "isNull", value: function() {
          for (var t3 = 0; t3 < this.location.length; t3++) if (this.location[t3] !== H.NONE) return false;
          return true;
        } }, { key: "setAllLocationsIfNull", value: function(t3) {
          for (var e2 = 0; e2 < this.location.length; e2++) this.location[e2] === H.NONE && (this.location[e2] = t3);
        } }, { key: "isLine", value: function() {
          return 1 === this.location.length;
        } }, { key: "merge", value: function(t3) {
          if (t3.location.length > this.location.length) {
            var e2 = new Array(3).fill(null);
            e2[$.ON] = this.location[$.ON], e2[$.LEFT] = H.NONE, e2[$.RIGHT] = H.NONE, this.location = e2;
          }
          for (var n2 = 0; n2 < this.location.length; n2++) this.location[n2] === H.NONE && n2 < t3.location.length && (this.location[n2] = t3.location[n2]);
        } }, { key: "getLocations", value: function() {
          return this.location;
        } }, { key: "flip", value: function() {
          if (this.location.length <= 1) return null;
          var t3 = this.location[$.LEFT];
          this.location[$.LEFT] = this.location[$.RIGHT], this.location[$.RIGHT] = t3;
        } }, { key: "toString", value: function() {
          var t3 = new st();
          return this.location.length > 1 && t3.append(H.toLocationSymbol(this.location[$.LEFT])), t3.append(H.toLocationSymbol(this.location[$.ON])), this.location.length > 1 && t3.append(H.toLocationSymbol(this.location[$.RIGHT])), t3.toString();
        } }, { key: "setLocations", value: function(t3, e2, n2) {
          this.location[$.ON] = t3, this.location[$.LEFT] = e2, this.location[$.RIGHT] = n2;
        } }, { key: "get", value: function(t3) {
          return t3 < this.location.length ? this.location[t3] : H.NONE;
        } }, { key: "isArea", value: function() {
          return this.location.length > 1;
        } }, { key: "isAnyNull", value: function() {
          for (var t3 = 0; t3 < this.location.length; t3++) if (this.location[t3] === H.NONE) return true;
          return false;
        } }, { key: "setLocation", value: function() {
          if (1 === arguments.length) {
            var t3 = arguments[0];
            this.setLocation($.ON, t3);
          } else if (2 === arguments.length) {
            var e2 = arguments[0], n2 = arguments[1];
            this.location[e2] = n2;
          }
        } }, { key: "init", value: function(t3) {
          this.location = new Array(t3).fill(null), this.setAllLocations(H.NONE);
        } }, { key: "isEqualOnSide", value: function(t3, e2) {
          return this.location[e2] === t3.location[e2];
        } }, { key: "allPositionsEqual", value: function(t3) {
          for (var e2 = 0; e2 < this.location.length; e2++) if (this.location[e2] !== t3) return false;
          return true;
        } }], [{ key: "constructor_", value: function() {
          if (this.location = null, 1 === arguments.length) {
            if (arguments[0] instanceof Array) {
              var e2 = arguments[0];
              this.init(e2.length);
            } else if (Number.isInteger(arguments[0])) {
              var n2 = arguments[0];
              this.init(1), this.location[$.ON] = n2;
            } else if (arguments[0] instanceof t2) {
              var i2 = arguments[0];
              if (this.init(i2.location.length), null !== i2) for (var r2 = 0; r2 < this.location.length; r2++) this.location[r2] = i2.location[r2];
            }
          } else if (3 === arguments.length) {
            var s2 = arguments[0], a2 = arguments[1], o2 = arguments[2];
            this.init(3), this.location[$.ON] = s2, this.location[$.LEFT] = a2, this.location[$.RIGHT] = o2;
          }
        } }]);
      })(), Ae = (function() {
        function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }
        return s(t2, [{ key: "getGeometryCount", value: function() {
          var t3 = 0;
          return this.elt[0].isNull() || t3++, this.elt[1].isNull() || t3++, t3;
        } }, { key: "setAllLocations", value: function(t3, e2) {
          this.elt[t3].setAllLocations(e2);
        } }, { key: "isNull", value: function(t3) {
          return this.elt[t3].isNull();
        } }, { key: "setAllLocationsIfNull", value: function() {
          if (1 === arguments.length) {
            var t3 = arguments[0];
            this.setAllLocationsIfNull(0, t3), this.setAllLocationsIfNull(1, t3);
          } else if (2 === arguments.length) {
            var e2 = arguments[0], n2 = arguments[1];
            this.elt[e2].setAllLocationsIfNull(n2);
          }
        } }, { key: "isLine", value: function(t3) {
          return this.elt[t3].isLine();
        } }, { key: "merge", value: function(t3) {
          for (var e2 = 0; e2 < 2; e2++) null === this.elt[e2] && null !== t3.elt[e2] ? this.elt[e2] = new Me(t3.elt[e2]) : this.elt[e2].merge(t3.elt[e2]);
        } }, { key: "flip", value: function() {
          this.elt[0].flip(), this.elt[1].flip();
        } }, { key: "getLocation", value: function() {
          if (1 === arguments.length) {
            var t3 = arguments[0];
            return this.elt[t3].get($.ON);
          }
          if (2 === arguments.length) {
            var e2 = arguments[0], n2 = arguments[1];
            return this.elt[e2].get(n2);
          }
        } }, { key: "toString", value: function() {
          var t3 = new st();
          return null !== this.elt[0] && (t3.append("A:"), t3.append(this.elt[0].toString())), null !== this.elt[1] && (t3.append(" B:"), t3.append(this.elt[1].toString())), t3.toString();
        } }, { key: "isArea", value: function() {
          if (0 === arguments.length) return this.elt[0].isArea() || this.elt[1].isArea();
          if (1 === arguments.length) {
            var t3 = arguments[0];
            return this.elt[t3].isArea();
          }
        } }, { key: "isAnyNull", value: function(t3) {
          return this.elt[t3].isAnyNull();
        } }, { key: "setLocation", value: function() {
          if (2 === arguments.length) {
            var t3 = arguments[0], e2 = arguments[1];
            this.elt[t3].setLocation($.ON, e2);
          } else if (3 === arguments.length) {
            var n2 = arguments[0], i2 = arguments[1], r2 = arguments[2];
            this.elt[n2].setLocation(i2, r2);
          }
        } }, { key: "isEqualOnSide", value: function(t3, e2) {
          return this.elt[0].isEqualOnSide(t3.elt[0], e2) && this.elt[1].isEqualOnSide(t3.elt[1], e2);
        } }, { key: "allPositionsEqual", value: function(t3, e2) {
          return this.elt[t3].allPositionsEqual(e2);
        } }, { key: "toLine", value: function(t3) {
          this.elt[t3].isArea() && (this.elt[t3] = new Me(this.elt[t3].location[0]));
        } }], [{ key: "constructor_", value: function() {
          if (this.elt = new Array(2).fill(null), 1 === arguments.length) {
            if (Number.isInteger(arguments[0])) {
              var e2 = arguments[0];
              this.elt[0] = new Me(e2), this.elt[1] = new Me(e2);
            } else if (arguments[0] instanceof t2) {
              var n2 = arguments[0];
              this.elt[0] = new Me(n2.elt[0]), this.elt[1] = new Me(n2.elt[1]);
            }
          } else if (2 === arguments.length) {
            var i2 = arguments[0], r2 = arguments[1];
            this.elt[0] = new Me(H.NONE), this.elt[1] = new Me(H.NONE), this.elt[i2].setLocation(r2);
          } else if (3 === arguments.length) {
            var s2 = arguments[0], a2 = arguments[1], o2 = arguments[2];
            this.elt[0] = new Me(s2, a2, o2), this.elt[1] = new Me(s2, a2, o2);
          } else if (4 === arguments.length) {
            var u5 = arguments[0], l2 = arguments[1], h2 = arguments[2], c2 = arguments[3];
            this.elt[0] = new Me(H.NONE, H.NONE, H.NONE), this.elt[1] = new Me(H.NONE, H.NONE, H.NONE), this.elt[u5].setLocations(l2, h2, c2);
          }
        } }, { key: "toLineLabel", value: function(e2) {
          for (var n2 = new t2(H.NONE), i2 = 0; i2 < 2; i2++) n2.setLocation(i2, e2.getLocation(i2));
          return n2;
        } }]);
      })(), Pe = (function() {
        return s((function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }), [{ key: "computeRing", value: function() {
          if (null !== this._ring) return null;
          for (var t2 = new Array(this._pts.size()).fill(null), e2 = 0; e2 < this._pts.size(); e2++) t2[e2] = this._pts.get(e2);
          this._ring = this._geometryFactory.createLinearRing(t2), this._isHole = ct.isCCW(this._ring.getCoordinates());
        } }, { key: "isIsolated", value: function() {
          return 1 === this._label.getGeometryCount();
        } }, { key: "computePoints", value: function(t2) {
          this._startDe = t2;
          var e2 = t2, n2 = true;
          do {
            if (null === e2) throw new gt("Found null DirectedEdge");
            if (e2.getEdgeRing() === this) throw new gt("Directed Edge visited twice during ring-building at " + e2.getCoordinate());
            this._edges.add(e2);
            var i2 = e2.getLabel();
            G.isTrue(i2.isArea()), this.mergeLabel(i2), this.addPoints(e2.getEdge(), e2.isForward(), n2), n2 = false, this.setEdgeRing(e2, this), e2 = this.getNext(e2);
          } while (e2 !== this._startDe);
        } }, { key: "getLinearRing", value: function() {
          return this._ring;
        } }, { key: "getCoordinate", value: function(t2) {
          return this._pts.get(t2);
        } }, { key: "computeMaxNodeDegree", value: function() {
          this._maxNodeDegree = 0;
          var t2 = this._startDe;
          do {
            var e2 = t2.getNode().getEdges().getOutgoingDegree(this);
            e2 > this._maxNodeDegree && (this._maxNodeDegree = e2), t2 = this.getNext(t2);
          } while (t2 !== this._startDe);
          this._maxNodeDegree *= 2;
        } }, { key: "addPoints", value: function(t2, e2, n2) {
          var i2 = t2.getCoordinates();
          if (e2) {
            var r2 = 1;
            n2 && (r2 = 0);
            for (var s2 = r2; s2 < i2.length; s2++) this._pts.add(i2[s2]);
          } else {
            var a2 = i2.length - 2;
            n2 && (a2 = i2.length - 1);
            for (var o2 = a2; o2 >= 0; o2--) this._pts.add(i2[o2]);
          }
        } }, { key: "isHole", value: function() {
          return this._isHole;
        } }, { key: "setInResult", value: function() {
          var t2 = this._startDe;
          do {
            t2.getEdge().setInResult(true), t2 = t2.getNext();
          } while (t2 !== this._startDe);
        } }, { key: "containsPoint", value: function(t2) {
          var e2 = this.getLinearRing();
          if (!e2.getEnvelopeInternal().contains(t2)) return false;
          if (!be.isInRing(t2, e2.getCoordinates())) return false;
          for (var n2 = this._holes.iterator(); n2.hasNext(); ) {
            if (n2.next().containsPoint(t2)) return false;
          }
          return true;
        } }, { key: "addHole", value: function(t2) {
          this._holes.add(t2);
        } }, { key: "isShell", value: function() {
          return null === this._shell;
        } }, { key: "getLabel", value: function() {
          return this._label;
        } }, { key: "getEdges", value: function() {
          return this._edges;
        } }, { key: "getMaxNodeDegree", value: function() {
          return this._maxNodeDegree < 0 && this.computeMaxNodeDegree(), this._maxNodeDegree;
        } }, { key: "getShell", value: function() {
          return this._shell;
        } }, { key: "mergeLabel", value: function() {
          if (1 === arguments.length) {
            var t2 = arguments[0];
            this.mergeLabel(t2, 0), this.mergeLabel(t2, 1);
          } else if (2 === arguments.length) {
            var e2 = arguments[1], n2 = arguments[0].getLocation(e2, $.RIGHT);
            if (n2 === H.NONE) return null;
            if (this._label.getLocation(e2) === H.NONE) return this._label.setLocation(e2, n2), null;
          }
        } }, { key: "setShell", value: function(t2) {
          this._shell = t2, null !== t2 && t2.addHole(this);
        } }, { key: "toPolygon", value: function(t2) {
          for (var e2 = new Array(this._holes.size()).fill(null), n2 = 0; n2 < this._holes.size(); n2++) e2[n2] = this._holes.get(n2).getLinearRing();
          return t2.createPolygon(this.getLinearRing(), e2);
        } }], [{ key: "constructor_", value: function() {
          if (this._startDe = null, this._maxNodeDegree = -1, this._edges = new yt(), this._pts = new yt(), this._label = new Ae(H.NONE), this._ring = null, this._isHole = null, this._shell = null, this._holes = new yt(), this._geometryFactory = null, 0 === arguments.length) ;
          else if (2 === arguments.length) {
            var t2 = arguments[0], e2 = arguments[1];
            this._geometryFactory = e2, this.computePoints(t2), this.computeRing();
          }
        } }]);
      })(), De = (function(t2) {
        function i2() {
          var t3;
          return n(this, i2), t3 = e(this, i2), i2.constructor_.apply(t3, arguments), t3;
        }
        return l(i2, t2), s(i2, [{ key: "setEdgeRing", value: function(t3, e2) {
          t3.setMinEdgeRing(e2);
        } }, { key: "getNext", value: function(t3) {
          return t3.getNextMin();
        } }], [{ key: "constructor_", value: function() {
          var t3 = arguments[0], e2 = arguments[1];
          Pe.constructor_.call(this, t3, e2);
        } }]);
      })(Pe), Fe = (function(t2) {
        function i2() {
          var t3;
          return n(this, i2), t3 = e(this, i2), i2.constructor_.apply(t3, arguments), t3;
        }
        return l(i2, t2), s(i2, [{ key: "buildMinimalRings", value: function() {
          var t3 = new yt(), e2 = this._startDe;
          do {
            if (null === e2.getMinEdgeRing()) {
              var n2 = new De(e2, this._geometryFactory);
              t3.add(n2);
            }
            e2 = e2.getNext();
          } while (e2 !== this._startDe);
          return t3;
        } }, { key: "setEdgeRing", value: function(t3, e2) {
          t3.setEdgeRing(e2);
        } }, { key: "linkDirectedEdgesForMinimalEdgeRings", value: function() {
          var t3 = this._startDe;
          do {
            t3.getNode().getEdges().linkMinimalDirectedEdges(this), t3 = t3.getNext();
          } while (t3 !== this._startDe);
        } }, { key: "getNext", value: function(t3) {
          return t3.getNext();
        } }], [{ key: "constructor_", value: function() {
          var t3 = arguments[0], e2 = arguments[1];
          Pe.constructor_.call(this, t3, e2);
        } }]);
      })(Pe), Ge = (function() {
        return s((function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }), [{ key: "setVisited", value: function(t2) {
          this._isVisited = t2;
        } }, { key: "setInResult", value: function(t2) {
          this._isInResult = t2;
        } }, { key: "isCovered", value: function() {
          return this._isCovered;
        } }, { key: "isCoveredSet", value: function() {
          return this._isCoveredSet;
        } }, { key: "setLabel", value: function(t2) {
          this._label = t2;
        } }, { key: "getLabel", value: function() {
          return this._label;
        } }, { key: "setCovered", value: function(t2) {
          this._isCovered = t2, this._isCoveredSet = true;
        } }, { key: "updateIM", value: function(t2) {
          G.isTrue(this._label.getGeometryCount() >= 2, "found partial label"), this.computeIM(t2);
        } }, { key: "isInResult", value: function() {
          return this._isInResult;
        } }, { key: "isVisited", value: function() {
          return this._isVisited;
        } }], [{ key: "constructor_", value: function() {
          if (this._label = null, this._isInResult = false, this._isCovered = false, this._isCoveredSet = false, this._isVisited = false, 0 === arguments.length) ;
          else if (1 === arguments.length) {
            var t2 = arguments[0];
            this._label = t2;
          }
        } }]);
      })(), qe = (function(t2) {
        function i2() {
          var t3;
          return n(this, i2), t3 = e(this, i2), i2.constructor_.apply(t3, arguments), t3;
        }
        return l(i2, t2), s(i2, [{ key: "isIncidentEdgeInResult", value: function() {
          for (var t3 = this.getEdges().getEdges().iterator(); t3.hasNext(); ) {
            if (t3.next().getEdge().isInResult()) return true;
          }
          return false;
        } }, { key: "isIsolated", value: function() {
          return 1 === this._label.getGeometryCount();
        } }, { key: "getCoordinate", value: function() {
          return this._coord;
        } }, { key: "print", value: function(t3) {
          t3.println("node " + this._coord + " lbl: " + this._label);
        } }, { key: "computeIM", value: function(t3) {
        } }, { key: "computeMergedLocation", value: function(t3, e2) {
          var n2 = H.NONE;
          if (n2 = this._label.getLocation(e2), !t3.isNull(e2)) {
            var i3 = t3.getLocation(e2);
            n2 !== H.BOUNDARY && (n2 = i3);
          }
          return n2;
        } }, { key: "setLabel", value: function() {
          if (2 !== arguments.length || !Number.isInteger(arguments[1]) || !Number.isInteger(arguments[0])) return f(i2, "setLabel", this, 1).apply(this, arguments);
          var t3 = arguments[0], e2 = arguments[1];
          null === this._label ? this._label = new Ae(t3, e2) : this._label.setLocation(t3, e2);
        } }, { key: "getEdges", value: function() {
          return this._edges;
        } }, { key: "mergeLabel", value: function() {
          if (arguments[0] instanceof i2) {
            var t3 = arguments[0];
            this.mergeLabel(t3._label);
          } else if (arguments[0] instanceof Ae) for (var e2 = arguments[0], n2 = 0; n2 < 2; n2++) {
            var r2 = this.computeMergedLocation(e2, n2);
            this._label.getLocation(n2) === H.NONE && this._label.setLocation(n2, r2);
          }
        } }, { key: "add", value: function(t3) {
          this._edges.insert(t3), t3.setNode(this);
        } }, { key: "setLabelBoundary", value: function(t3) {
          if (null === this._label) return null;
          var e2 = H.NONE;
          null !== this._label && (e2 = this._label.getLocation(t3));
          var n2 = null;
          switch (e2) {
            case H.BOUNDARY:
              n2 = H.INTERIOR;
              break;
            case H.INTERIOR:
            default:
              n2 = H.BOUNDARY;
          }
          this._label.setLocation(t3, n2);
        } }], [{ key: "constructor_", value: function() {
          this._coord = null, this._edges = null;
          var t3 = arguments[0], e2 = arguments[1];
          this._coord = t3, this._edges = e2, this._label = new Ae(0, H.NONE);
        } }]);
      })(Ge), Ye = (function(t2) {
        function i2() {
          return n(this, i2), e(this, i2, arguments);
        }
        return l(i2, t2), s(i2);
      })(ee);
      function ze(t2) {
        return null == t2 ? 0 : t2.color;
      }
      function Xe(t2) {
        return null == t2 ? null : t2.parent;
      }
      function Be(t2, e2) {
        null !== t2 && (t2.color = e2);
      }
      function Ue(t2) {
        return null == t2 ? null : t2.left;
      }
      function Ve(t2) {
        return null == t2 ? null : t2.right;
      }
      var He = (function(t2) {
        function i2() {
          var t3;
          return n(this, i2), (t3 = e(this, i2)).root_ = null, t3.size_ = 0, t3;
        }
        return l(i2, t2), s(i2, [{ key: "get", value: function(t3) {
          for (var e2 = this.root_; null !== e2; ) {
            var n2 = t3.compareTo(e2.key);
            if (n2 < 0) e2 = e2.left;
            else {
              if (!(n2 > 0)) return e2.value;
              e2 = e2.right;
            }
          }
          return null;
        } }, { key: "put", value: function(t3, e2) {
          if (null === this.root_) return this.root_ = { key: t3, value: e2, left: null, right: null, parent: null, color: 0, getValue: function() {
            return this.value;
          }, getKey: function() {
            return this.key;
          } }, this.size_ = 1, null;
          var n2, i3, r2 = this.root_;
          do {
            if (n2 = r2, (i3 = t3.compareTo(r2.key)) < 0) r2 = r2.left;
            else {
              if (!(i3 > 0)) {
                var s2 = r2.value;
                return r2.value = e2, s2;
              }
              r2 = r2.right;
            }
          } while (null !== r2);
          var a2 = { key: t3, left: null, right: null, value: e2, parent: n2, color: 0, getValue: function() {
            return this.value;
          }, getKey: function() {
            return this.key;
          } };
          return i3 < 0 ? n2.left = a2 : n2.right = a2, this.fixAfterInsertion(a2), this.size_++, null;
        } }, { key: "fixAfterInsertion", value: function(t3) {
          var e2;
          for (t3.color = 1; null != t3 && t3 !== this.root_ && 1 === t3.parent.color; ) Xe(t3) === Ue(Xe(Xe(t3))) ? 1 === ze(e2 = Ve(Xe(Xe(t3)))) ? (Be(Xe(t3), 0), Be(e2, 0), Be(Xe(Xe(t3)), 1), t3 = Xe(Xe(t3))) : (t3 === Ve(Xe(t3)) && (t3 = Xe(t3), this.rotateLeft(t3)), Be(Xe(t3), 0), Be(Xe(Xe(t3)), 1), this.rotateRight(Xe(Xe(t3)))) : 1 === ze(e2 = Ue(Xe(Xe(t3)))) ? (Be(Xe(t3), 0), Be(e2, 0), Be(Xe(Xe(t3)), 1), t3 = Xe(Xe(t3))) : (t3 === Ue(Xe(t3)) && (t3 = Xe(t3), this.rotateRight(t3)), Be(Xe(t3), 0), Be(Xe(Xe(t3)), 1), this.rotateLeft(Xe(Xe(t3))));
          this.root_.color = 0;
        } }, { key: "values", value: function() {
          var t3 = new yt(), e2 = this.getFirstEntry();
          if (null !== e2) for (t3.add(e2.value); null !== (e2 = i2.successor(e2)); ) t3.add(e2.value);
          return t3;
        } }, { key: "entrySet", value: function() {
          var t3 = new J(), e2 = this.getFirstEntry();
          if (null !== e2) for (t3.add(e2); null !== (e2 = i2.successor(e2)); ) t3.add(e2);
          return t3;
        } }, { key: "rotateLeft", value: function(t3) {
          if (null != t3) {
            var e2 = t3.right;
            t3.right = e2.left, null != e2.left && (e2.left.parent = t3), e2.parent = t3.parent, null == t3.parent ? this.root_ = e2 : t3.parent.left === t3 ? t3.parent.left = e2 : t3.parent.right = e2, e2.left = t3, t3.parent = e2;
          }
        } }, { key: "rotateRight", value: function(t3) {
          if (null != t3) {
            var e2 = t3.left;
            t3.left = e2.right, null != e2.right && (e2.right.parent = t3), e2.parent = t3.parent, null == t3.parent ? this.root_ = e2 : t3.parent.right === t3 ? t3.parent.right = e2 : t3.parent.left = e2, e2.right = t3, t3.parent = e2;
          }
        } }, { key: "getFirstEntry", value: function() {
          var t3 = this.root_;
          if (null != t3) for (; null != t3.left; ) t3 = t3.left;
          return t3;
        } }, { key: "size", value: function() {
          return this.size_;
        } }, { key: "containsKey", value: function(t3) {
          for (var e2 = this.root_; null !== e2; ) {
            var n2 = t3.compareTo(e2.key);
            if (n2 < 0) e2 = e2.left;
            else {
              if (!(n2 > 0)) return true;
              e2 = e2.right;
            }
          }
          return false;
        } }], [{ key: "successor", value: function(t3) {
          var e2;
          if (null === t3) return null;
          if (null !== t3.right) {
            for (e2 = t3.right; null !== e2.left; ) e2 = e2.left;
            return e2;
          }
          e2 = t3.parent;
          for (var n2 = t3; null !== e2 && n2 === e2.right; ) n2 = e2, e2 = e2.parent;
          return e2;
        } }]);
      })(Ye), Ze = (function() {
        return s((function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }), [{ key: "find", value: function(t2) {
          return this.nodeMap.get(t2);
        } }, { key: "addNode", value: function() {
          if (arguments[0] instanceof X) {
            var t2 = arguments[0], e2 = this.nodeMap.get(t2);
            return null === e2 && (e2 = this.nodeFact.createNode(t2), this.nodeMap.put(t2, e2)), e2;
          }
          if (arguments[0] instanceof qe) {
            var n2 = arguments[0], i2 = this.nodeMap.get(n2.getCoordinate());
            return null === i2 ? (this.nodeMap.put(n2.getCoordinate(), n2), n2) : (i2.mergeLabel(n2), i2);
          }
        } }, { key: "print", value: function(t2) {
          for (var e2 = this.iterator(); e2.hasNext(); ) {
            e2.next().print(t2);
          }
        } }, { key: "iterator", value: function() {
          return this.nodeMap.values().iterator();
        } }, { key: "values", value: function() {
          return this.nodeMap.values();
        } }, { key: "getBoundaryNodes", value: function(t2) {
          for (var e2 = new yt(), n2 = this.iterator(); n2.hasNext(); ) {
            var i2 = n2.next();
            i2.getLabel().getLocation(t2) === H.BOUNDARY && e2.add(i2);
          }
          return e2;
        } }, { key: "add", value: function(t2) {
          var e2 = t2.getCoordinate();
          this.addNode(e2).add(t2);
        } }], [{ key: "constructor_", value: function() {
          this.nodeMap = new He(), this.nodeFact = null;
          var t2 = arguments[0];
          this.nodeFact = t2;
        } }]);
      })(), je = (function() {
        function t2() {
          n(this, t2);
        }
        return s(t2, null, [{ key: "isNorthern", value: function(e2) {
          return e2 === t2.NE || e2 === t2.NW;
        } }, { key: "isOpposite", value: function(t3, e2) {
          return t3 !== e2 && 2 === (t3 - e2 + 4) % 4;
        } }, { key: "commonHalfPlane", value: function(t3, e2) {
          if (t3 === e2) return t3;
          if (2 === (t3 - e2 + 4) % 4) return -1;
          var n2 = t3 < e2 ? t3 : e2;
          return 0 === n2 && 3 === (t3 > e2 ? t3 : e2) ? 3 : n2;
        } }, { key: "isInHalfPlane", value: function(e2, n2) {
          return n2 === t2.SE ? e2 === t2.SE || e2 === t2.SW : e2 === n2 || e2 === n2 + 1;
        } }, { key: "quadrant", value: function() {
          if ("number" == typeof arguments[0] && "number" == typeof arguments[1]) {
            var e2 = arguments[0], n2 = arguments[1];
            if (0 === e2 && 0 === n2) throw new m("Cannot compute the quadrant for point ( " + e2 + ", " + n2 + " )");
            return e2 >= 0 ? n2 >= 0 ? t2.NE : t2.SE : n2 >= 0 ? t2.NW : t2.SW;
          }
          if (arguments[0] instanceof X && arguments[1] instanceof X) {
            var i2 = arguments[0], r2 = arguments[1];
            if (r2.x === i2.x && r2.y === i2.y) throw new m("Cannot compute the quadrant for two identical points " + i2);
            return r2.x >= i2.x ? r2.y >= i2.y ? t2.NE : t2.SE : r2.y >= i2.y ? t2.NW : t2.SW;
          }
        } }]);
      })();
      je.NE = 0, je.NW = 1, je.SW = 2, je.SE = 3;
      var We = (function() {
        function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }
        return s(t2, [{ key: "compareDirection", value: function(t3) {
          return this._dx === t3._dx && this._dy === t3._dy ? 0 : this._quadrant > t3._quadrant ? 1 : this._quadrant < t3._quadrant ? -1 : ct.index(t3._p0, t3._p1, this._p1);
        } }, { key: "getDy", value: function() {
          return this._dy;
        } }, { key: "getCoordinate", value: function() {
          return this._p0;
        } }, { key: "setNode", value: function(t3) {
          this._node = t3;
        } }, { key: "print", value: function(t3) {
          var e2 = Math.atan2(this._dy, this._dx), n2 = this.getClass().getName(), i2 = n2.lastIndexOf("."), r2 = n2.substring(i2 + 1);
          t3.print("  " + r2 + ": " + this._p0 + " - " + this._p1 + " " + this._quadrant + ":" + e2 + "   " + this._label);
        } }, { key: "compareTo", value: function(t3) {
          var e2 = t3;
          return this.compareDirection(e2);
        } }, { key: "getDirectedCoordinate", value: function() {
          return this._p1;
        } }, { key: "getDx", value: function() {
          return this._dx;
        } }, { key: "getLabel", value: function() {
          return this._label;
        } }, { key: "getEdge", value: function() {
          return this._edge;
        } }, { key: "getQuadrant", value: function() {
          return this._quadrant;
        } }, { key: "getNode", value: function() {
          return this._node;
        } }, { key: "toString", value: function() {
          var t3 = Math.atan2(this._dy, this._dx), e2 = this.getClass().getName(), n2 = e2.lastIndexOf(".");
          return "  " + e2.substring(n2 + 1) + ": " + this._p0 + " - " + this._p1 + " " + this._quadrant + ":" + t3 + "   " + this._label;
        } }, { key: "computeLabel", value: function(t3) {
        } }, { key: "init", value: function(t3, e2) {
          this._p0 = t3, this._p1 = e2, this._dx = e2.x - t3.x, this._dy = e2.y - t3.y, this._quadrant = je.quadrant(this._dx, this._dy), G.isTrue(!(0 === this._dx && 0 === this._dy), "EdgeEnd with identical endpoints found");
        } }, { key: "interfaces_", get: function() {
          return [x];
        } }], [{ key: "constructor_", value: function() {
          if (this._edge = null, this._label = null, this._node = null, this._p0 = null, this._p1 = null, this._dx = null, this._dy = null, this._quadrant = null, 1 === arguments.length) {
            var e2 = arguments[0];
            this._edge = e2;
          } else if (3 === arguments.length) {
            var n2 = arguments[0], i2 = arguments[1], r2 = arguments[2];
            t2.constructor_.call(this, n2, i2, r2, null);
          } else if (4 === arguments.length) {
            var s2 = arguments[0], a2 = arguments[1], o2 = arguments[2], u5 = arguments[3];
            t2.constructor_.call(this, s2), this.init(a2, o2), this._label = u5;
          }
        } }]);
      })(), Ke = (function(t2) {
        function i2() {
          var t3;
          return n(this, i2), t3 = e(this, i2), i2.constructor_.apply(t3, arguments), t3;
        }
        return l(i2, t2), s(i2, [{ key: "getNextMin", value: function() {
          return this._nextMin;
        } }, { key: "getDepth", value: function(t3) {
          return this._depth[t3];
        } }, { key: "setVisited", value: function(t3) {
          this._isVisited = t3;
        } }, { key: "computeDirectedLabel", value: function() {
          this._label = new Ae(this._edge.getLabel()), this._isForward || this._label.flip();
        } }, { key: "getNext", value: function() {
          return this._next;
        } }, { key: "setDepth", value: function(t3, e2) {
          if (-999 !== this._depth[t3] && this._depth[t3] !== e2) throw new gt("assigned depths do not match", this.getCoordinate());
          this._depth[t3] = e2;
        } }, { key: "isInteriorAreaEdge", value: function() {
          for (var t3 = true, e2 = 0; e2 < 2; e2++) this._label.isArea(e2) && this._label.getLocation(e2, $.LEFT) === H.INTERIOR && this._label.getLocation(e2, $.RIGHT) === H.INTERIOR || (t3 = false);
          return t3;
        } }, { key: "setNextMin", value: function(t3) {
          this._nextMin = t3;
        } }, { key: "print", value: function(t3) {
          f(i2, "print", this, 1).call(this, t3), t3.print(" " + this._depth[$.LEFT] + "/" + this._depth[$.RIGHT]), t3.print(" (" + this.getDepthDelta() + ")"), this._isInResult && t3.print(" inResult");
        } }, { key: "setMinEdgeRing", value: function(t3) {
          this._minEdgeRing = t3;
        } }, { key: "isLineEdge", value: function() {
          var t3 = this._label.isLine(0) || this._label.isLine(1), e2 = !this._label.isArea(0) || this._label.allPositionsEqual(0, H.EXTERIOR), n2 = !this._label.isArea(1) || this._label.allPositionsEqual(1, H.EXTERIOR);
          return t3 && e2 && n2;
        } }, { key: "setEdgeRing", value: function(t3) {
          this._edgeRing = t3;
        } }, { key: "getMinEdgeRing", value: function() {
          return this._minEdgeRing;
        } }, { key: "getDepthDelta", value: function() {
          var t3 = this._edge.getDepthDelta();
          return this._isForward || (t3 = -t3), t3;
        } }, { key: "setInResult", value: function(t3) {
          this._isInResult = t3;
        } }, { key: "getSym", value: function() {
          return this._sym;
        } }, { key: "isForward", value: function() {
          return this._isForward;
        } }, { key: "getEdge", value: function() {
          return this._edge;
        } }, { key: "printEdge", value: function(t3) {
          this.print(t3), t3.print(" "), this._isForward ? this._edge.print(t3) : this._edge.printReverse(t3);
        } }, { key: "setSym", value: function(t3) {
          this._sym = t3;
        } }, { key: "setVisitedEdge", value: function(t3) {
          this.setVisited(t3), this._sym.setVisited(t3);
        } }, { key: "setEdgeDepths", value: function(t3, e2) {
          var n2 = this.getEdge().getDepthDelta();
          this._isForward || (n2 = -n2);
          var i3 = 1;
          t3 === $.LEFT && (i3 = -1);
          var r2 = $.opposite(t3), s2 = e2 + n2 * i3;
          this.setDepth(t3, e2), this.setDepth(r2, s2);
        } }, { key: "getEdgeRing", value: function() {
          return this._edgeRing;
        } }, { key: "isInResult", value: function() {
          return this._isInResult;
        } }, { key: "setNext", value: function(t3) {
          this._next = t3;
        } }, { key: "isVisited", value: function() {
          return this._isVisited;
        } }], [{ key: "constructor_", value: function() {
          this._isForward = null, this._isInResult = false, this._isVisited = false, this._sym = null, this._next = null, this._nextMin = null, this._edgeRing = null, this._minEdgeRing = null, this._depth = [0, -999, -999];
          var t3 = arguments[0], e2 = arguments[1];
          if (We.constructor_.call(this, t3), this._isForward = e2, e2) this.init(t3.getCoordinate(0), t3.getCoordinate(1));
          else {
            var n2 = t3.getNumPoints() - 1;
            this.init(t3.getCoordinate(n2), t3.getCoordinate(n2 - 1));
          }
          this.computeDirectedLabel();
        } }, { key: "depthFactor", value: function(t3, e2) {
          return t3 === H.EXTERIOR && e2 === H.INTERIOR ? 1 : t3 === H.INTERIOR && e2 === H.EXTERIOR ? -1 : 0;
        } }]);
      })(We), Je = (function() {
        return s((function t2() {
          n(this, t2);
        }), [{ key: "createNode", value: function(t2) {
          return new qe(t2, null);
        } }]);
      })(), Qe = (function() {
        return s((function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }), [{ key: "printEdges", value: function(t2) {
          t2.println("Edges:");
          for (var e2 = 0; e2 < this._edges.size(); e2++) {
            t2.println("edge " + e2 + ":");
            var n2 = this._edges.get(e2);
            n2.print(t2), n2.eiList.print(t2);
          }
        } }, { key: "find", value: function(t2) {
          return this._nodes.find(t2);
        } }, { key: "addNode", value: function() {
          if (arguments[0] instanceof qe) {
            var t2 = arguments[0];
            return this._nodes.addNode(t2);
          }
          if (arguments[0] instanceof X) {
            var e2 = arguments[0];
            return this._nodes.addNode(e2);
          }
        } }, { key: "getNodeIterator", value: function() {
          return this._nodes.iterator();
        } }, { key: "linkResultDirectedEdges", value: function() {
          for (var t2 = this._nodes.iterator(); t2.hasNext(); ) {
            t2.next().getEdges().linkResultDirectedEdges();
          }
        } }, { key: "debugPrintln", value: function(t2) {
          mt.out.println(t2);
        } }, { key: "isBoundaryNode", value: function(t2, e2) {
          var n2 = this._nodes.find(e2);
          if (null === n2) return false;
          var i2 = n2.getLabel();
          return null !== i2 && i2.getLocation(t2) === H.BOUNDARY;
        } }, { key: "linkAllDirectedEdges", value: function() {
          for (var t2 = this._nodes.iterator(); t2.hasNext(); ) {
            t2.next().getEdges().linkAllDirectedEdges();
          }
        } }, { key: "matchInSameDirection", value: function(t2, e2, n2, i2) {
          return !!t2.equals(n2) && (ct.index(t2, e2, i2) === ct.COLLINEAR && je.quadrant(t2, e2) === je.quadrant(n2, i2));
        } }, { key: "getEdgeEnds", value: function() {
          return this._edgeEndList;
        } }, { key: "debugPrint", value: function(t2) {
          mt.out.print(t2);
        } }, { key: "getEdgeIterator", value: function() {
          return this._edges.iterator();
        } }, { key: "findEdgeInSameDirection", value: function(t2, e2) {
          for (var n2 = 0; n2 < this._edges.size(); n2++) {
            var i2 = this._edges.get(n2), r2 = i2.getCoordinates();
            if (this.matchInSameDirection(t2, e2, r2[0], r2[1])) return i2;
            if (this.matchInSameDirection(t2, e2, r2[r2.length - 1], r2[r2.length - 2])) return i2;
          }
          return null;
        } }, { key: "insertEdge", value: function(t2) {
          this._edges.add(t2);
        } }, { key: "findEdgeEnd", value: function(t2) {
          for (var e2 = this.getEdgeEnds().iterator(); e2.hasNext(); ) {
            var n2 = e2.next();
            if (n2.getEdge() === t2) return n2;
          }
          return null;
        } }, { key: "addEdges", value: function(t2) {
          for (var e2 = t2.iterator(); e2.hasNext(); ) {
            var n2 = e2.next();
            this._edges.add(n2);
            var i2 = new Ke(n2, true), r2 = new Ke(n2, false);
            i2.setSym(r2), r2.setSym(i2), this.add(i2), this.add(r2);
          }
        } }, { key: "add", value: function(t2) {
          this._nodes.add(t2), this._edgeEndList.add(t2);
        } }, { key: "getNodes", value: function() {
          return this._nodes.values();
        } }, { key: "findEdge", value: function(t2, e2) {
          for (var n2 = 0; n2 < this._edges.size(); n2++) {
            var i2 = this._edges.get(n2), r2 = i2.getCoordinates();
            if (t2.equals(r2[0]) && e2.equals(r2[1])) return i2;
          }
          return null;
        } }], [{ key: "constructor_", value: function() {
          if (this._edges = new yt(), this._nodes = null, this._edgeEndList = new yt(), 0 === arguments.length) this._nodes = new Ze(new Je());
          else if (1 === arguments.length) {
            var t2 = arguments[0];
            this._nodes = new Ze(t2);
          }
        } }, { key: "linkResultDirectedEdges", value: function(t2) {
          for (var e2 = t2.iterator(); e2.hasNext(); ) {
            e2.next().getEdges().linkResultDirectedEdges();
          }
        } }]);
      })(), $e = (function() {
        function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }
        return s(t2, [{ key: "sortShellsAndHoles", value: function(t3, e2, n2) {
          for (var i2 = t3.iterator(); i2.hasNext(); ) {
            var r2 = i2.next();
            r2.isHole() ? n2.add(r2) : e2.add(r2);
          }
        } }, { key: "computePolygons", value: function(t3) {
          for (var e2 = new yt(), n2 = t3.iterator(); n2.hasNext(); ) {
            var i2 = n2.next().toPolygon(this._geometryFactory);
            e2.add(i2);
          }
          return e2;
        } }, { key: "placeFreeHoles", value: function(e2, n2) {
          for (var i2 = n2.iterator(); i2.hasNext(); ) {
            var r2 = i2.next();
            if (null === r2.getShell()) {
              var s2 = t2.findEdgeRingContaining(r2, e2);
              if (null === s2) throw new gt("unable to assign hole to a shell", r2.getCoordinate(0));
              r2.setShell(s2);
            }
          }
        } }, { key: "buildMinimalEdgeRings", value: function(t3, e2, n2) {
          for (var i2 = new yt(), r2 = t3.iterator(); r2.hasNext(); ) {
            var s2 = r2.next();
            if (s2.getMaxNodeDegree() > 2) {
              s2.linkDirectedEdgesForMinimalEdgeRings();
              var a2 = s2.buildMinimalRings(), o2 = this.findShell(a2);
              null !== o2 ? (this.placePolygonHoles(o2, a2), e2.add(o2)) : n2.addAll(a2);
            } else i2.add(s2);
          }
          return i2;
        } }, { key: "buildMaximalEdgeRings", value: function(t3) {
          for (var e2 = new yt(), n2 = t3.iterator(); n2.hasNext(); ) {
            var i2 = n2.next();
            if (i2.isInResult() && i2.getLabel().isArea() && null === i2.getEdgeRing()) {
              var r2 = new Fe(i2, this._geometryFactory);
              e2.add(r2), r2.setInResult();
            }
          }
          return e2;
        } }, { key: "placePolygonHoles", value: function(t3, e2) {
          for (var n2 = e2.iterator(); n2.hasNext(); ) {
            var i2 = n2.next();
            i2.isHole() && i2.setShell(t3);
          }
        } }, { key: "getPolygons", value: function() {
          return this.computePolygons(this._shellList);
        } }, { key: "findShell", value: function(t3) {
          for (var e2 = 0, n2 = null, i2 = t3.iterator(); i2.hasNext(); ) {
            var r2 = i2.next();
            r2.isHole() || (n2 = r2, e2++);
          }
          return G.isTrue(e2 <= 1, "found two shells in MinimalEdgeRing list"), n2;
        } }, { key: "add", value: function() {
          if (1 === arguments.length) {
            var t3 = arguments[0];
            this.add(t3.getEdgeEnds(), t3.getNodes());
          } else if (2 === arguments.length) {
            var e2 = arguments[0], n2 = arguments[1];
            Qe.linkResultDirectedEdges(n2);
            var i2 = this.buildMaximalEdgeRings(e2), r2 = new yt(), s2 = this.buildMinimalEdgeRings(i2, this._shellList, r2);
            this.sortShellsAndHoles(s2, this._shellList, r2), this.placeFreeHoles(this._shellList, r2);
          }
        } }], [{ key: "constructor_", value: function() {
          this._geometryFactory = null, this._shellList = new yt();
          var t3 = arguments[0];
          this._geometryFactory = t3;
        } }, { key: "findEdgeRingContaining", value: function(t3, e2) {
          for (var n2 = t3.getLinearRing(), i2 = n2.getEnvelopeInternal(), r2 = n2.getCoordinateN(0), s2 = null, a2 = null, o2 = e2.iterator(); o2.hasNext(); ) {
            var u5 = o2.next(), l2 = u5.getLinearRing(), h2 = l2.getEnvelopeInternal();
            if (!h2.equals(i2) && h2.contains(i2)) {
              r2 = jt.ptNotInList(n2.getCoordinates(), l2.getCoordinates());
              var c2 = false;
              be.isInRing(r2, l2.getCoordinates()) && (c2 = true), c2 && (null === s2 || a2.contains(h2)) && (a2 = (s2 = u5).getLinearRing().getEnvelopeInternal());
            }
          }
          return s2;
        } }]);
      })(), tn = (function() {
        return s((function t2() {
          n(this, t2);
        }), [{ key: "getBounds", value: function() {
        } }]);
      })(), en = (function() {
        return s((function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }), [{ key: "getItem", value: function() {
          return this._item;
        } }, { key: "getBounds", value: function() {
          return this._bounds;
        } }, { key: "interfaces_", get: function() {
          return [tn, E];
        } }], [{ key: "constructor_", value: function() {
          this._bounds = null, this._item = null;
          var t2 = arguments[0], e2 = arguments[1];
          this._bounds = t2, this._item = e2;
        } }]);
      })(), nn = (function() {
        return s((function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }), [{ key: "poll", value: function() {
          if (this.isEmpty()) return null;
          var t2 = this._items.get(1);
          return this._items.set(1, this._items.get(this._size)), this._size -= 1, this.reorder(1), t2;
        } }, { key: "size", value: function() {
          return this._size;
        } }, { key: "reorder", value: function(t2) {
          for (var e2 = null, n2 = this._items.get(t2); 2 * t2 <= this._size && ((e2 = 2 * t2) !== this._size && this._items.get(e2 + 1).compareTo(this._items.get(e2)) < 0 && e2++, this._items.get(e2).compareTo(n2) < 0); t2 = e2) this._items.set(t2, this._items.get(e2));
          this._items.set(t2, n2);
        } }, { key: "clear", value: function() {
          this._size = 0, this._items.clear();
        } }, { key: "peek", value: function() {
          return this.isEmpty() ? null : this._items.get(1);
        } }, { key: "isEmpty", value: function() {
          return 0 === this._size;
        } }, { key: "add", value: function(t2) {
          this._items.add(null), this._size += 1;
          var e2 = this._size;
          for (this._items.set(0, t2); t2.compareTo(this._items.get(Math.trunc(e2 / 2))) < 0; e2 /= 2) this._items.set(e2, this._items.get(Math.trunc(e2 / 2)));
          this._items.set(e2, t2);
        } }], [{ key: "constructor_", value: function() {
          this._size = null, this._items = null, this._size = 0, this._items = new yt(), this._items.add(null);
        } }]);
      })(), rn = (function() {
        return s((function t2() {
          n(this, t2);
        }), [{ key: "insert", value: function(t2, e2) {
        } }, { key: "remove", value: function(t2, e2) {
        } }, { key: "query", value: function() {
        } }]);
      })(), sn = (function() {
        return s((function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }), [{ key: "getLevel", value: function() {
          return this._level;
        } }, { key: "size", value: function() {
          return this._childBoundables.size();
        } }, { key: "getChildBoundables", value: function() {
          return this._childBoundables;
        } }, { key: "addChildBoundable", value: function(t2) {
          G.isTrue(null === this._bounds), this._childBoundables.add(t2);
        } }, { key: "isEmpty", value: function() {
          return this._childBoundables.isEmpty();
        } }, { key: "getBounds", value: function() {
          return null === this._bounds && (this._bounds = this.computeBounds()), this._bounds;
        } }, { key: "interfaces_", get: function() {
          return [tn, E];
        } }], [{ key: "constructor_", value: function() {
          if (this._childBoundables = new yt(), this._bounds = null, this._level = null, 0 === arguments.length) ;
          else if (1 === arguments.length) {
            var t2 = arguments[0];
            this._level = t2;
          }
        } }]);
      })(), an = { reverseOrder: function() {
        return { compare: function(t2, e2) {
          return e2.compareTo(t2);
        } };
      }, min: function(t2) {
        return an.sort(t2), t2.get(0);
      }, sort: function(t2, e2) {
        var n2 = t2.toArray();
        e2 ? At.sort(n2, e2) : At.sort(n2);
        for (var i2 = t2.iterator(), r2 = 0, s2 = n2.length; r2 < s2; r2++) i2.next(), i2.set(n2[r2]);
      }, singletonList: function(t2) {
        var e2 = new yt();
        return e2.add(t2), e2;
      } }, on = (function() {
        function t2() {
          n(this, t2);
        }
        return s(t2, null, [{ key: "maxDistance", value: function(e2, n2, i2, r2, s2, a2, o2, u5) {
          var l2 = t2.distance(e2, n2, s2, a2);
          return l2 = Math.max(l2, t2.distance(e2, n2, o2, u5)), l2 = Math.max(l2, t2.distance(i2, r2, s2, a2)), l2 = Math.max(l2, t2.distance(i2, r2, o2, u5));
        } }, { key: "distance", value: function(t3, e2, n2, i2) {
          var r2 = n2 - t3, s2 = i2 - e2;
          return Math.sqrt(r2 * r2 + s2 * s2);
        } }, { key: "maximumDistance", value: function(e2, n2) {
          var i2 = Math.min(e2.getMinX(), n2.getMinX()), r2 = Math.min(e2.getMinY(), n2.getMinY()), s2 = Math.max(e2.getMaxX(), n2.getMaxX()), a2 = Math.max(e2.getMaxY(), n2.getMaxY());
          return t2.distance(i2, r2, s2, a2);
        } }, { key: "minMaxDistance", value: function(e2, n2) {
          var i2 = e2.getMinX(), r2 = e2.getMinY(), s2 = e2.getMaxX(), a2 = e2.getMaxY(), o2 = n2.getMinX(), u5 = n2.getMinY(), l2 = n2.getMaxX(), h2 = n2.getMaxY(), c2 = t2.maxDistance(i2, r2, i2, a2, o2, u5, o2, h2);
          return c2 = Math.min(c2, t2.maxDistance(i2, r2, i2, a2, o2, u5, l2, u5)), c2 = Math.min(c2, t2.maxDistance(i2, r2, i2, a2, l2, h2, o2, h2)), c2 = Math.min(c2, t2.maxDistance(i2, r2, i2, a2, l2, h2, l2, u5)), c2 = Math.min(c2, t2.maxDistance(i2, r2, s2, r2, o2, u5, o2, h2)), c2 = Math.min(c2, t2.maxDistance(i2, r2, s2, r2, o2, u5, l2, u5)), c2 = Math.min(c2, t2.maxDistance(i2, r2, s2, r2, l2, h2, o2, h2)), c2 = Math.min(c2, t2.maxDistance(i2, r2, s2, r2, l2, h2, l2, u5)), c2 = Math.min(c2, t2.maxDistance(s2, a2, i2, a2, o2, u5, o2, h2)), c2 = Math.min(c2, t2.maxDistance(s2, a2, i2, a2, o2, u5, l2, u5)), c2 = Math.min(c2, t2.maxDistance(s2, a2, i2, a2, l2, h2, o2, h2)), c2 = Math.min(c2, t2.maxDistance(s2, a2, i2, a2, l2, h2, l2, u5)), c2 = Math.min(c2, t2.maxDistance(s2, a2, s2, r2, o2, u5, o2, h2)), c2 = Math.min(c2, t2.maxDistance(s2, a2, s2, r2, o2, u5, l2, u5)), c2 = Math.min(c2, t2.maxDistance(s2, a2, s2, r2, l2, h2, o2, h2)), c2 = Math.min(c2, t2.maxDistance(s2, a2, s2, r2, l2, h2, l2, u5));
        } }]);
      })(), un = (function() {
        function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }
        return s(t2, [{ key: "maximumDistance", value: function() {
          return on.maximumDistance(this._boundable1.getBounds(), this._boundable2.getBounds());
        } }, { key: "expandToQueue", value: function(e2, n2) {
          var i2 = t2.isComposite(this._boundable1), r2 = t2.isComposite(this._boundable2);
          if (i2 && r2) return t2.area(this._boundable1) > t2.area(this._boundable2) ? (this.expand(this._boundable1, this._boundable2, false, e2, n2), null) : (this.expand(this._boundable2, this._boundable1, true, e2, n2), null);
          if (i2) return this.expand(this._boundable1, this._boundable2, false, e2, n2), null;
          if (r2) return this.expand(this._boundable2, this._boundable1, true, e2, n2), null;
          throw new m("neither boundable is composite");
        } }, { key: "isLeaves", value: function() {
          return !(t2.isComposite(this._boundable1) || t2.isComposite(this._boundable2));
        } }, { key: "compareTo", value: function(t3) {
          var e2 = t3;
          return this._distance < e2._distance ? -1 : this._distance > e2._distance ? 1 : 0;
        } }, { key: "expand", value: function(e2, n2, i2, r2, s2) {
          for (var a2 = e2.getChildBoundables().iterator(); a2.hasNext(); ) {
            var o2 = a2.next(), u5 = null;
            (u5 = i2 ? new t2(n2, o2, this._itemDistance) : new t2(o2, n2, this._itemDistance)).getDistance() < s2 && r2.add(u5);
          }
        } }, { key: "getBoundable", value: function(t3) {
          return 0 === t3 ? this._boundable1 : this._boundable2;
        } }, { key: "getDistance", value: function() {
          return this._distance;
        } }, { key: "distance", value: function() {
          return this.isLeaves() ? this._itemDistance.distance(this._boundable1, this._boundable2) : this._boundable1.getBounds().distance(this._boundable2.getBounds());
        } }, { key: "interfaces_", get: function() {
          return [x];
        } }], [{ key: "constructor_", value: function() {
          this._boundable1 = null, this._boundable2 = null, this._distance = null, this._itemDistance = null;
          var t3 = arguments[0], e2 = arguments[1], n2 = arguments[2];
          this._boundable1 = t3, this._boundable2 = e2, this._itemDistance = n2, this._distance = this.distance();
        } }, { key: "area", value: function(t3) {
          return t3.getBounds().getArea();
        } }, { key: "isComposite", value: function(t3) {
          return t3 instanceof sn;
        } }]);
      })(), ln = (function() {
        return s((function t2() {
          n(this, t2);
        }), [{ key: "visitItem", value: function(t2) {
        } }]);
      })(), hn = (function() {
        function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }
        return s(t2, [{ key: "queryInternal", value: function() {
          if (rt(arguments[2], ln) && arguments[0] instanceof Object && arguments[1] instanceof sn) for (var t3 = arguments[0], e2 = arguments[2], n2 = arguments[1].getChildBoundables(), i2 = 0; i2 < n2.size(); i2++) {
            var r2 = n2.get(i2);
            this.getIntersectsOp().intersects(r2.getBounds(), t3) && (r2 instanceof sn ? this.queryInternal(t3, r2, e2) : r2 instanceof en ? e2.visitItem(r2.getItem()) : G.shouldNeverReachHere());
          }
          else if (rt(arguments[2], nt) && arguments[0] instanceof Object && arguments[1] instanceof sn) for (var s2 = arguments[0], a2 = arguments[2], o2 = arguments[1].getChildBoundables(), u5 = 0; u5 < o2.size(); u5++) {
            var l2 = o2.get(u5);
            this.getIntersectsOp().intersects(l2.getBounds(), s2) && (l2 instanceof sn ? this.queryInternal(s2, l2, a2) : l2 instanceof en ? a2.add(l2.getItem()) : G.shouldNeverReachHere());
          }
        } }, { key: "getNodeCapacity", value: function() {
          return this._nodeCapacity;
        } }, { key: "lastNode", value: function(t3) {
          return t3.get(t3.size() - 1);
        } }, { key: "size", value: function() {
          if (0 === arguments.length) return this.isEmpty() ? 0 : (this.build(), this.size(this._root));
          if (1 === arguments.length) {
            for (var t3 = 0, e2 = arguments[0].getChildBoundables().iterator(); e2.hasNext(); ) {
              var n2 = e2.next();
              n2 instanceof sn ? t3 += this.size(n2) : n2 instanceof en && (t3 += 1);
            }
            return t3;
          }
        } }, { key: "removeItem", value: function(t3, e2) {
          for (var n2 = null, i2 = t3.getChildBoundables().iterator(); i2.hasNext(); ) {
            var r2 = i2.next();
            r2 instanceof en && r2.getItem() === e2 && (n2 = r2);
          }
          return null !== n2 && (t3.getChildBoundables().remove(n2), true);
        } }, { key: "itemsTree", value: function() {
          if (0 === arguments.length) {
            this.build();
            var t3 = this.itemsTree(this._root);
            return null === t3 ? new yt() : t3;
          }
          if (1 === arguments.length) {
            for (var e2 = arguments[0], n2 = new yt(), i2 = e2.getChildBoundables().iterator(); i2.hasNext(); ) {
              var r2 = i2.next();
              if (r2 instanceof sn) {
                var s2 = this.itemsTree(r2);
                null !== s2 && n2.add(s2);
              } else r2 instanceof en ? n2.add(r2.getItem()) : G.shouldNeverReachHere();
            }
            return n2.size() <= 0 ? null : n2;
          }
        } }, { key: "insert", value: function(t3, e2) {
          G.isTrue(!this._built, "Cannot insert items into an STR packed R-tree after it has been built."), this._itemBoundables.add(new en(t3, e2));
        } }, { key: "boundablesAtLevel", value: function() {
          if (1 === arguments.length) {
            var t3 = arguments[0], e2 = new yt();
            return this.boundablesAtLevel(t3, this._root, e2), e2;
          }
          if (3 === arguments.length) {
            var n2 = arguments[0], i2 = arguments[1], r2 = arguments[2];
            if (G.isTrue(n2 > -2), i2.getLevel() === n2) return r2.add(i2), null;
            for (var s2 = i2.getChildBoundables().iterator(); s2.hasNext(); ) {
              var a2 = s2.next();
              a2 instanceof sn ? this.boundablesAtLevel(n2, a2, r2) : (G.isTrue(a2 instanceof en), -1 === n2 && r2.add(a2));
            }
            return null;
          }
        } }, { key: "query", value: function() {
          if (1 === arguments.length) {
            var t3 = arguments[0];
            this.build();
            var e2 = new yt();
            return this.isEmpty() || this.getIntersectsOp().intersects(this._root.getBounds(), t3) && this.queryInternal(t3, this._root, e2), e2;
          }
          if (2 === arguments.length) {
            var n2 = arguments[0], i2 = arguments[1];
            if (this.build(), this.isEmpty()) return null;
            this.getIntersectsOp().intersects(this._root.getBounds(), n2) && this.queryInternal(n2, this._root, i2);
          }
        } }, { key: "build", value: function() {
          if (this._built) return null;
          this._root = this._itemBoundables.isEmpty() ? this.createNode(0) : this.createHigherLevels(this._itemBoundables, -1), this._itemBoundables = null, this._built = true;
        } }, { key: "getRoot", value: function() {
          return this.build(), this._root;
        } }, { key: "remove", value: function() {
          if (2 === arguments.length) {
            var t3 = arguments[0], e2 = arguments[1];
            return this.build(), !!this.getIntersectsOp().intersects(this._root.getBounds(), t3) && this.remove(t3, this._root, e2);
          }
          if (3 === arguments.length) {
            var n2 = arguments[0], i2 = arguments[1], r2 = arguments[2], s2 = this.removeItem(i2, r2);
            if (s2) return true;
            for (var a2 = null, o2 = i2.getChildBoundables().iterator(); o2.hasNext(); ) {
              var u5 = o2.next();
              if (this.getIntersectsOp().intersects(u5.getBounds(), n2) && (u5 instanceof sn && (s2 = this.remove(n2, u5, r2)))) {
                a2 = u5;
                break;
              }
            }
            return null !== a2 && a2.getChildBoundables().isEmpty() && i2.getChildBoundables().remove(a2), s2;
          }
        } }, { key: "createHigherLevels", value: function(t3, e2) {
          G.isTrue(!t3.isEmpty());
          var n2 = this.createParentBoundables(t3, e2 + 1);
          return 1 === n2.size() ? n2.get(0) : this.createHigherLevels(n2, e2 + 1);
        } }, { key: "depth", value: function() {
          if (0 === arguments.length) return this.isEmpty() ? 0 : (this.build(), this.depth(this._root));
          if (1 === arguments.length) {
            for (var t3 = 0, e2 = arguments[0].getChildBoundables().iterator(); e2.hasNext(); ) {
              var n2 = e2.next();
              if (n2 instanceof sn) {
                var i2 = this.depth(n2);
                i2 > t3 && (t3 = i2);
              }
            }
            return t3 + 1;
          }
        } }, { key: "createParentBoundables", value: function(t3, e2) {
          G.isTrue(!t3.isEmpty());
          var n2 = new yt();
          n2.add(this.createNode(e2));
          var i2 = new yt(t3);
          an.sort(i2, this.getComparator());
          for (var r2 = i2.iterator(); r2.hasNext(); ) {
            var s2 = r2.next();
            this.lastNode(n2).getChildBoundables().size() === this.getNodeCapacity() && n2.add(this.createNode(e2)), this.lastNode(n2).addChildBoundable(s2);
          }
          return n2;
        } }, { key: "isEmpty", value: function() {
          return this._built ? this._root.isEmpty() : this._itemBoundables.isEmpty();
        } }, { key: "interfaces_", get: function() {
          return [E];
        } }], [{ key: "constructor_", value: function() {
          if (this._root = null, this._built = false, this._itemBoundables = new yt(), this._nodeCapacity = null, 0 === arguments.length) t2.constructor_.call(this, t2.DEFAULT_NODE_CAPACITY);
          else if (1 === arguments.length) {
            var e2 = arguments[0];
            G.isTrue(e2 > 1, "Node capacity must be greater than 1"), this._nodeCapacity = e2;
          }
        } }, { key: "compareDoubles", value: function(t3, e2) {
          return t3 > e2 ? 1 : t3 < e2 ? -1 : 0;
        } }]);
      })();
      hn.IntersectsOp = function() {
      }, hn.DEFAULT_NODE_CAPACITY = 10;
      var cn = (function() {
        return s((function t2() {
          n(this, t2);
        }), [{ key: "distance", value: function(t2, e2) {
        } }]);
      })(), fn = (function(t2) {
        function i2() {
          var t3;
          return n(this, i2), t3 = e(this, i2), i2.constructor_.apply(t3, arguments), t3;
        }
        return l(i2, t2), s(i2, [{ key: "createParentBoundablesFromVerticalSlices", value: function(t3, e2) {
          G.isTrue(t3.length > 0);
          for (var n2 = new yt(), i3 = 0; i3 < t3.length; i3++) n2.addAll(this.createParentBoundablesFromVerticalSlice(t3[i3], e2));
          return n2;
        } }, { key: "nearestNeighbourK", value: function() {
          if (2 === arguments.length) {
            var t3 = arguments[0], e2 = arguments[1];
            return this.nearestNeighbourK(t3, A.POSITIVE_INFINITY, e2);
          }
          if (3 === arguments.length) {
            var n2 = arguments[0], r2 = arguments[2], s2 = arguments[1], a2 = new nn();
            a2.add(n2);
            for (var o2 = new nn(); !a2.isEmpty() && s2 >= 0; ) {
              var u5 = a2.poll(), l2 = u5.getDistance();
              if (l2 >= s2) break;
              if (u5.isLeaves()) if (o2.size() < r2) o2.add(u5);
              else o2.peek().getDistance() > l2 && (o2.poll(), o2.add(u5)), s2 = o2.peek().getDistance();
              else u5.expandToQueue(a2, s2);
            }
            return i2.getItems(o2);
          }
        } }, { key: "createNode", value: function(t3) {
          return new gn(t3);
        } }, { key: "size", value: function() {
          return 0 === arguments.length ? f(i2, "size", this, 1).call(this) : f(i2, "size", this, 1).apply(this, arguments);
        } }, { key: "insert", value: function() {
          if (!(2 === arguments.length && arguments[1] instanceof Object && arguments[0] instanceof U)) return f(i2, "insert", this, 1).apply(this, arguments);
          var t3 = arguments[0], e2 = arguments[1];
          if (t3.isNull()) return null;
          f(i2, "insert", this, 1).call(this, t3, e2);
        } }, { key: "getIntersectsOp", value: function() {
          return i2.intersectsOp;
        } }, { key: "verticalSlices", value: function(t3, e2) {
          for (var n2 = Math.trunc(Math.ceil(t3.size() / e2)), i3 = new Array(e2).fill(null), r2 = t3.iterator(), s2 = 0; s2 < e2; s2++) {
            i3[s2] = new yt();
            for (var a2 = 0; r2.hasNext() && a2 < n2; ) {
              var o2 = r2.next();
              i3[s2].add(o2), a2++;
            }
          }
          return i3;
        } }, { key: "query", value: function() {
          if (1 === arguments.length) {
            var t3 = arguments[0];
            return f(i2, "query", this, 1).call(this, t3);
          }
          if (2 === arguments.length) {
            var e2 = arguments[0], n2 = arguments[1];
            f(i2, "query", this, 1).call(this, e2, n2);
          }
        } }, { key: "getComparator", value: function() {
          return i2.yComparator;
        } }, { key: "createParentBoundablesFromVerticalSlice", value: function(t3, e2) {
          return f(i2, "createParentBoundables", this, 1).call(this, t3, e2);
        } }, { key: "remove", value: function() {
          if (2 === arguments.length && arguments[1] instanceof Object && arguments[0] instanceof U) {
            var t3 = arguments[0], e2 = arguments[1];
            return f(i2, "remove", this, 1).call(this, t3, e2);
          }
          return f(i2, "remove", this, 1).apply(this, arguments);
        } }, { key: "depth", value: function() {
          return 0 === arguments.length ? f(i2, "depth", this, 1).call(this) : f(i2, "depth", this, 1).apply(this, arguments);
        } }, { key: "createParentBoundables", value: function(t3, e2) {
          G.isTrue(!t3.isEmpty());
          var n2 = Math.trunc(Math.ceil(t3.size() / this.getNodeCapacity())), r2 = new yt(t3);
          an.sort(r2, i2.xComparator);
          var s2 = this.verticalSlices(r2, Math.trunc(Math.ceil(Math.sqrt(n2))));
          return this.createParentBoundablesFromVerticalSlices(s2, e2);
        } }, { key: "nearestNeighbour", value: function() {
          if (1 === arguments.length) {
            if (rt(arguments[0], cn)) {
              var t3 = arguments[0];
              if (this.isEmpty()) return null;
              var e2 = new un(this.getRoot(), this.getRoot(), t3);
              return this.nearestNeighbour(e2);
            }
            if (arguments[0] instanceof un) {
              var n2 = arguments[0], i3 = A.POSITIVE_INFINITY, r2 = null, s2 = new nn();
              for (s2.add(n2); !s2.isEmpty() && i3 > 0; ) {
                var a2 = s2.poll(), o2 = a2.getDistance();
                if (o2 >= i3) break;
                a2.isLeaves() ? (i3 = o2, r2 = a2) : a2.expandToQueue(s2, i3);
              }
              return null === r2 ? null : [r2.getBoundable(0).getItem(), r2.getBoundable(1).getItem()];
            }
          } else {
            if (2 === arguments.length) {
              var u5 = arguments[0], l2 = arguments[1];
              if (this.isEmpty() || u5.isEmpty()) return null;
              var h2 = new un(this.getRoot(), u5.getRoot(), l2);
              return this.nearestNeighbour(h2);
            }
            if (3 === arguments.length) {
              var c2 = arguments[2], f2 = new en(arguments[0], arguments[1]), g2 = new un(this.getRoot(), f2, c2);
              return this.nearestNeighbour(g2)[0];
            }
            if (4 === arguments.length) {
              var v3 = arguments[2], y2 = arguments[3], d2 = new en(arguments[0], arguments[1]), _2 = new un(this.getRoot(), d2, v3);
              return this.nearestNeighbourK(_2, y2);
            }
          }
        } }, { key: "isWithinDistance", value: function() {
          if (2 === arguments.length) {
            var t3 = arguments[0], e2 = arguments[1], n2 = A.POSITIVE_INFINITY, i3 = new nn();
            for (i3.add(t3); !i3.isEmpty(); ) {
              var r2 = i3.poll(), s2 = r2.getDistance();
              if (s2 > e2) return false;
              if (r2.maximumDistance() <= e2) return true;
              if (r2.isLeaves()) {
                if ((n2 = s2) <= e2) return true;
              } else r2.expandToQueue(i3, n2);
            }
            return false;
          }
          if (3 === arguments.length) {
            var a2 = arguments[0], o2 = arguments[1], u5 = arguments[2], l2 = new un(this.getRoot(), a2.getRoot(), o2);
            return this.isWithinDistance(l2, u5);
          }
        } }, { key: "interfaces_", get: function() {
          return [rn, E];
        } }], [{ key: "constructor_", value: function() {
          if (0 === arguments.length) i2.constructor_.call(this, i2.DEFAULT_NODE_CAPACITY);
          else if (1 === arguments.length) {
            var t3 = arguments[0];
            hn.constructor_.call(this, t3);
          }
        } }, { key: "centreX", value: function(t3) {
          return i2.avg(t3.getMinX(), t3.getMaxX());
        } }, { key: "avg", value: function(t3, e2) {
          return (t3 + e2) / 2;
        } }, { key: "getItems", value: function(t3) {
          for (var e2 = new Array(t3.size()).fill(null), n2 = 0; !t3.isEmpty(); ) {
            var i3 = t3.poll();
            e2[n2] = i3.getBoundable(0).getItem(), n2++;
          }
          return e2;
        } }, { key: "centreY", value: function(t3) {
          return i2.avg(t3.getMinY(), t3.getMaxY());
        } }]);
      })(hn), gn = (function(t2) {
        function i2() {
          var t3;
          return n(this, i2), t3 = e(this, i2), i2.constructor_.apply(t3, arguments), t3;
        }
        return l(i2, t2), s(i2, [{ key: "computeBounds", value: function() {
          for (var t3 = null, e2 = this.getChildBoundables().iterator(); e2.hasNext(); ) {
            var n2 = e2.next();
            null === t3 ? t3 = new U(n2.getBounds()) : t3.expandToInclude(n2.getBounds());
          }
          return t3;
        } }], [{ key: "constructor_", value: function() {
          var t3 = arguments[0];
          sn.constructor_.call(this, t3);
        } }]);
      })(sn);
      fn.STRtreeNode = gn, fn.xComparator = new ((function() {
        return s((function t2() {
          n(this, t2);
        }), [{ key: "interfaces_", get: function() {
          return [P];
        } }, { key: "compare", value: function(t2, e2) {
          return hn.compareDoubles(fn.centreX(t2.getBounds()), fn.centreX(e2.getBounds()));
        } }]);
      })())(), fn.yComparator = new ((function() {
        return s((function t2() {
          n(this, t2);
        }), [{ key: "interfaces_", get: function() {
          return [P];
        } }, { key: "compare", value: function(t2, e2) {
          return hn.compareDoubles(fn.centreY(t2.getBounds()), fn.centreY(e2.getBounds()));
        } }]);
      })())(), fn.intersectsOp = new ((function() {
        return s((function t2() {
          n(this, t2);
        }), [{ key: "interfaces_", get: function() {
          return [IntersectsOp];
        } }, { key: "intersects", value: function(t2, e2) {
          return t2.intersects(e2);
        } }]);
      })())(), fn.DEFAULT_NODE_CAPACITY = 10;
      var vn = (function() {
        function t2() {
          n(this, t2);
        }
        return s(t2, null, [{ key: "relativeSign", value: function(t3, e2) {
          return t3 < e2 ? -1 : t3 > e2 ? 1 : 0;
        } }, { key: "compare", value: function(e2, n2, i2) {
          if (n2.equals2D(i2)) return 0;
          var r2 = t2.relativeSign(n2.x, i2.x), s2 = t2.relativeSign(n2.y, i2.y);
          switch (e2) {
            case 0:
              return t2.compareValue(r2, s2);
            case 1:
              return t2.compareValue(s2, r2);
            case 2:
              return t2.compareValue(s2, -r2);
            case 3:
              return t2.compareValue(-r2, s2);
            case 4:
              return t2.compareValue(-r2, -s2);
            case 5:
              return t2.compareValue(-s2, -r2);
            case 6:
              return t2.compareValue(-s2, r2);
            case 7:
              return t2.compareValue(r2, -s2);
          }
          return G.shouldNeverReachHere("invalid octant value"), 0;
        } }, { key: "compareValue", value: function(t3, e2) {
          return t3 < 0 ? -1 : t3 > 0 ? 1 : e2 < 0 ? -1 : e2 > 0 ? 1 : 0;
        } }]);
      })(), yn = (function() {
        return s((function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }), [{ key: "getCoordinate", value: function() {
          return this.coord;
        } }, { key: "print", value: function(t2) {
          t2.print(this.coord), t2.print(" seg # = " + this.segmentIndex);
        } }, { key: "compareTo", value: function(t2) {
          var e2 = t2;
          return this.segmentIndex < e2.segmentIndex ? -1 : this.segmentIndex > e2.segmentIndex ? 1 : this.coord.equals2D(e2.coord) ? 0 : this._isInterior ? e2._isInterior ? vn.compare(this._segmentOctant, this.coord, e2.coord) : 1 : -1;
        } }, { key: "isEndPoint", value: function(t2) {
          return 0 === this.segmentIndex && !this._isInterior || this.segmentIndex === t2;
        } }, { key: "toString", value: function() {
          return this.segmentIndex + ":" + this.coord.toString();
        } }, { key: "isInterior", value: function() {
          return this._isInterior;
        } }, { key: "interfaces_", get: function() {
          return [x];
        } }], [{ key: "constructor_", value: function() {
          this._segString = null, this.coord = null, this.segmentIndex = null, this._segmentOctant = null, this._isInterior = null;
          var t2 = arguments[0], e2 = arguments[1], n2 = arguments[2], i2 = arguments[3];
          this._segString = t2, this.coord = new X(e2), this.segmentIndex = n2, this._segmentOctant = i2, this._isInterior = !e2.equals2D(t2.getCoordinate(n2));
        } }]);
      })(), dn = (function() {
        return s((function t2() {
          n(this, t2);
        }), [{ key: "hasNext", value: function() {
        } }, { key: "next", value: function() {
        } }, { key: "remove", value: function() {
        } }]);
      })(), _n = (function() {
        return s((function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }), [{ key: "getSplitCoordinates", value: function() {
          var t2 = new Zt();
          this.addEndpoints();
          for (var e2 = this.iterator(), n2 = e2.next(); e2.hasNext(); ) {
            var i2 = e2.next();
            this.addEdgeCoordinates(n2, i2, t2), n2 = i2;
          }
          return t2.toCoordinateArray();
        } }, { key: "addCollapsedNodes", value: function() {
          var t2 = new yt();
          this.findCollapsesFromInsertedNodes(t2), this.findCollapsesFromExistingVertices(t2);
          for (var e2 = t2.iterator(); e2.hasNext(); ) {
            var n2 = e2.next().intValue();
            this.add(this._edge.getCoordinate(n2), n2);
          }
        } }, { key: "createSplitEdgePts", value: function(t2, e2) {
          var n2 = e2.segmentIndex - t2.segmentIndex + 2;
          if (2 === n2) return [new X(t2.coord), new X(e2.coord)];
          var i2 = this._edge.getCoordinate(e2.segmentIndex), r2 = e2.isInterior() || !e2.coord.equals2D(i2);
          r2 || n2--;
          var s2 = new Array(n2).fill(null), a2 = 0;
          s2[a2++] = new X(t2.coord);
          for (var o2 = t2.segmentIndex + 1; o2 <= e2.segmentIndex; o2++) s2[a2++] = this._edge.getCoordinate(o2);
          return r2 && (s2[a2] = new X(e2.coord)), s2;
        } }, { key: "print", value: function(t2) {
          t2.println("Intersections:");
          for (var e2 = this.iterator(); e2.hasNext(); ) {
            e2.next().print(t2);
          }
        } }, { key: "findCollapsesFromExistingVertices", value: function(t2) {
          for (var e2 = 0; e2 < this._edge.size() - 2; e2++) {
            var n2 = this._edge.getCoordinate(e2);
            this._edge.getCoordinate(e2 + 1);
            var i2 = this._edge.getCoordinate(e2 + 2);
            n2.equals2D(i2) && t2.add(at.valueOf(e2 + 1));
          }
        } }, { key: "addEdgeCoordinates", value: function(t2, e2, n2) {
          var i2 = this.createSplitEdgePts(t2, e2);
          n2.add(i2, false);
        } }, { key: "iterator", value: function() {
          return this._nodeMap.values().iterator();
        } }, { key: "addSplitEdges", value: function(t2) {
          this.addEndpoints(), this.addCollapsedNodes();
          for (var e2 = this.iterator(), n2 = e2.next(); e2.hasNext(); ) {
            var i2 = e2.next(), r2 = this.createSplitEdge(n2, i2);
            t2.add(r2), n2 = i2;
          }
        } }, { key: "findCollapseIndex", value: function(t2, e2, n2) {
          if (!t2.coord.equals2D(e2.coord)) return false;
          var i2 = e2.segmentIndex - t2.segmentIndex;
          return e2.isInterior() || i2--, 1 === i2 && (n2[0] = t2.segmentIndex + 1, true);
        } }, { key: "findCollapsesFromInsertedNodes", value: function(t2) {
          for (var e2 = new Array(1).fill(null), n2 = this.iterator(), i2 = n2.next(); n2.hasNext(); ) {
            var r2 = n2.next();
            this.findCollapseIndex(i2, r2, e2) && t2.add(at.valueOf(e2[0])), i2 = r2;
          }
        } }, { key: "getEdge", value: function() {
          return this._edge;
        } }, { key: "addEndpoints", value: function() {
          var t2 = this._edge.size() - 1;
          this.add(this._edge.getCoordinate(0), 0), this.add(this._edge.getCoordinate(t2), t2);
        } }, { key: "createSplitEdge", value: function(t2, e2) {
          var n2 = this.createSplitEdgePts(t2, e2);
          return new xn(n2, this._edge.getData());
        } }, { key: "add", value: function(t2, e2) {
          var n2 = new yn(this._edge, t2, e2, this._edge.getSegmentOctant(e2)), i2 = this._nodeMap.get(n2);
          return null !== i2 ? (G.isTrue(i2.coord.equals2D(t2), "Found equal nodes with different coordinates"), i2) : (this._nodeMap.put(n2, n2), n2);
        } }, { key: "checkSplitEdgesCorrectness", value: function(t2) {
          var e2 = this._edge.getCoordinates(), n2 = t2.get(0).getCoordinate(0);
          if (!n2.equals2D(e2[0])) throw new D2("bad split edge start point at " + n2);
          var i2 = t2.get(t2.size() - 1).getCoordinates(), r2 = i2[i2.length - 1];
          if (!r2.equals2D(e2[e2.length - 1])) throw new D2("bad split edge end point at " + r2);
        } }], [{ key: "constructor_", value: function() {
          this._nodeMap = new He(), this._edge = null;
          var t2 = arguments[0];
          this._edge = t2;
        } }]);
      })(), pn = (function() {
        function t2() {
          n(this, t2);
        }
        return s(t2, null, [{ key: "octant", value: function() {
          if ("number" == typeof arguments[0] && "number" == typeof arguments[1]) {
            var e2 = arguments[0], n2 = arguments[1];
            if (0 === e2 && 0 === n2) throw new m("Cannot compute the octant for point ( " + e2 + ", " + n2 + " )");
            var i2 = Math.abs(e2), r2 = Math.abs(n2);
            return e2 >= 0 ? n2 >= 0 ? i2 >= r2 ? 0 : 1 : i2 >= r2 ? 7 : 6 : n2 >= 0 ? i2 >= r2 ? 3 : 2 : i2 >= r2 ? 4 : 5;
          }
          if (arguments[0] instanceof X && arguments[1] instanceof X) {
            var s2 = arguments[0], a2 = arguments[1], o2 = a2.x - s2.x, u5 = a2.y - s2.y;
            if (0 === o2 && 0 === u5) throw new m("Cannot compute the octant for two identical points " + s2);
            return t2.octant(o2, u5);
          }
        } }]);
      })(), mn = (function() {
        return s((function t2() {
          n(this, t2);
        }), [{ key: "getCoordinates", value: function() {
        } }, { key: "size", value: function() {
        } }, { key: "getCoordinate", value: function(t2) {
        } }, { key: "isClosed", value: function() {
        } }, { key: "setData", value: function(t2) {
        } }, { key: "getData", value: function() {
        } }]);
      })(), kn = (function() {
        return s((function t2() {
          n(this, t2);
        }), [{ key: "addIntersection", value: function(t2, e2) {
        } }, { key: "interfaces_", get: function() {
          return [mn];
        } }]);
      })(), xn = (function() {
        function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }
        return s(t2, [{ key: "getCoordinates", value: function() {
          return this._pts;
        } }, { key: "size", value: function() {
          return this._pts.length;
        } }, { key: "getCoordinate", value: function(t3) {
          return this._pts[t3];
        } }, { key: "isClosed", value: function() {
          return this._pts[0].equals(this._pts[this._pts.length - 1]);
        } }, { key: "getSegmentOctant", value: function(t3) {
          return t3 === this._pts.length - 1 ? -1 : this.safeOctant(this.getCoordinate(t3), this.getCoordinate(t3 + 1));
        } }, { key: "setData", value: function(t3) {
          this._data = t3;
        } }, { key: "safeOctant", value: function(t3, e2) {
          return t3.equals2D(e2) ? 0 : pn.octant(t3, e2);
        } }, { key: "getData", value: function() {
          return this._data;
        } }, { key: "addIntersection", value: function() {
          if (2 === arguments.length) {
            var t3 = arguments[0], e2 = arguments[1];
            this.addIntersectionNode(t3, e2);
          } else if (4 === arguments.length) {
            var n2 = arguments[1], i2 = arguments[3], r2 = new X(arguments[0].getIntersection(i2));
            this.addIntersection(r2, n2);
          }
        } }, { key: "toString", value: function() {
          return Ce.toLineString(new Qt(this._pts));
        } }, { key: "getNodeList", value: function() {
          return this._nodeList;
        } }, { key: "addIntersectionNode", value: function(t3, e2) {
          var n2 = e2, i2 = n2 + 1;
          if (i2 < this._pts.length) {
            var r2 = this._pts[i2];
            t3.equals2D(r2) && (n2 = i2);
          }
          return this._nodeList.add(t3, n2);
        } }, { key: "addIntersections", value: function(t3, e2, n2) {
          for (var i2 = 0; i2 < t3.getIntersectionNum(); i2++) this.addIntersection(t3, e2, n2, i2);
        } }, { key: "interfaces_", get: function() {
          return [kn];
        } }], [{ key: "constructor_", value: function() {
          this._nodeList = new _n(this), this._pts = null, this._data = null;
          var t3 = arguments[0], e2 = arguments[1];
          this._pts = t3, this._data = e2;
        } }, { key: "getNodedSubstrings", value: function() {
          if (1 === arguments.length) {
            var e2 = arguments[0], n2 = new yt();
            return t2.getNodedSubstrings(e2, n2), n2;
          }
          if (2 === arguments.length) for (var i2 = arguments[1], r2 = arguments[0].iterator(); r2.hasNext(); ) {
            r2.next().getNodeList().addSplitEdges(i2);
          }
        } }]);
      })(), In = (function() {
        function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }
        return s(t2, [{ key: "minX", value: function() {
          return Math.min(this.p0.x, this.p1.x);
        } }, { key: "orientationIndex", value: function() {
          if (arguments[0] instanceof t2) {
            var e2 = arguments[0], n2 = ct.index(this.p0, this.p1, e2.p0), i2 = ct.index(this.p0, this.p1, e2.p1);
            return n2 >= 0 && i2 >= 0 || n2 <= 0 && i2 <= 0 ? Math.max(n2, i2) : 0;
          }
          if (arguments[0] instanceof X) {
            var r2 = arguments[0];
            return ct.index(this.p0, this.p1, r2);
          }
        } }, { key: "toGeometry", value: function(t3) {
          return t3.createLineString([this.p0, this.p1]);
        } }, { key: "isVertical", value: function() {
          return this.p0.x === this.p1.x;
        } }, { key: "equals", value: function(e2) {
          if (!(e2 instanceof t2)) return false;
          var n2 = e2;
          return this.p0.equals(n2.p0) && this.p1.equals(n2.p1);
        } }, { key: "intersection", value: function(t3) {
          var e2 = new we();
          return e2.computeIntersection(this.p0, this.p1, t3.p0, t3.p1), e2.hasIntersection() ? e2.getIntersection(0) : null;
        } }, { key: "project", value: function() {
          if (arguments[0] instanceof X) {
            var e2 = arguments[0];
            if (e2.equals(this.p0) || e2.equals(this.p1)) return new X(e2);
            var n2 = this.projectionFactor(e2), i2 = new X();
            return i2.x = this.p0.x + n2 * (this.p1.x - this.p0.x), i2.y = this.p0.y + n2 * (this.p1.y - this.p0.y), i2;
          }
          if (arguments[0] instanceof t2) {
            var r2 = arguments[0], s2 = this.projectionFactor(r2.p0), a2 = this.projectionFactor(r2.p1);
            if (s2 >= 1 && a2 >= 1) return null;
            if (s2 <= 0 && a2 <= 0) return null;
            var o2 = this.project(r2.p0);
            s2 < 0 && (o2 = this.p0), s2 > 1 && (o2 = this.p1);
            var u5 = this.project(r2.p1);
            return a2 < 0 && (u5 = this.p0), a2 > 1 && (u5 = this.p1), new t2(o2, u5);
          }
        } }, { key: "normalize", value: function() {
          this.p1.compareTo(this.p0) < 0 && this.reverse();
        } }, { key: "angle", value: function() {
          return Math.atan2(this.p1.y - this.p0.y, this.p1.x - this.p0.x);
        } }, { key: "getCoordinate", value: function(t3) {
          return 0 === t3 ? this.p0 : this.p1;
        } }, { key: "distancePerpendicular", value: function(t3) {
          return xt.pointToLinePerpendicular(t3, this.p0, this.p1);
        } }, { key: "minY", value: function() {
          return Math.min(this.p0.y, this.p1.y);
        } }, { key: "midPoint", value: function() {
          return t2.midPoint(this.p0, this.p1);
        } }, { key: "projectionFactor", value: function(t3) {
          if (t3.equals(this.p0)) return 0;
          if (t3.equals(this.p1)) return 1;
          var e2 = this.p1.x - this.p0.x, n2 = this.p1.y - this.p0.y, i2 = e2 * e2 + n2 * n2;
          return i2 <= 0 ? A.NaN : ((t3.x - this.p0.x) * e2 + (t3.y - this.p0.y) * n2) / i2;
        } }, { key: "closestPoints", value: function(t3) {
          var e2 = this.intersection(t3);
          if (null !== e2) return [e2, e2];
          var n2 = new Array(2).fill(null), i2 = A.MAX_VALUE, r2 = null, s2 = this.closestPoint(t3.p0);
          i2 = s2.distance(t3.p0), n2[0] = s2, n2[1] = t3.p0;
          var a2 = this.closestPoint(t3.p1);
          (r2 = a2.distance(t3.p1)) < i2 && (i2 = r2, n2[0] = a2, n2[1] = t3.p1);
          var o2 = t3.closestPoint(this.p0);
          (r2 = o2.distance(this.p0)) < i2 && (i2 = r2, n2[0] = this.p0, n2[1] = o2);
          var u5 = t3.closestPoint(this.p1);
          return (r2 = u5.distance(this.p1)) < i2 && (i2 = r2, n2[0] = this.p1, n2[1] = u5), n2;
        } }, { key: "closestPoint", value: function(t3) {
          var e2 = this.projectionFactor(t3);
          return e2 > 0 && e2 < 1 ? this.project(t3) : this.p0.distance(t3) < this.p1.distance(t3) ? this.p0 : this.p1;
        } }, { key: "maxX", value: function() {
          return Math.max(this.p0.x, this.p1.x);
        } }, { key: "getLength", value: function() {
          return this.p0.distance(this.p1);
        } }, { key: "compareTo", value: function(t3) {
          var e2 = t3, n2 = this.p0.compareTo(e2.p0);
          return 0 !== n2 ? n2 : this.p1.compareTo(e2.p1);
        } }, { key: "reverse", value: function() {
          var t3 = this.p0;
          this.p0 = this.p1, this.p1 = t3;
        } }, { key: "equalsTopo", value: function(t3) {
          return this.p0.equals(t3.p0) && this.p1.equals(t3.p1) || this.p0.equals(t3.p1) && this.p1.equals(t3.p0);
        } }, { key: "lineIntersection", value: function(t3) {
          return pt.intersection(this.p0, this.p1, t3.p0, t3.p1);
        } }, { key: "maxY", value: function() {
          return Math.max(this.p0.y, this.p1.y);
        } }, { key: "pointAlongOffset", value: function(t3, e2) {
          var n2 = this.p0.x + t3 * (this.p1.x - this.p0.x), i2 = this.p0.y + t3 * (this.p1.y - this.p0.y), r2 = this.p1.x - this.p0.x, s2 = this.p1.y - this.p0.y, a2 = Math.sqrt(r2 * r2 + s2 * s2), o2 = 0, u5 = 0;
          if (0 !== e2) {
            if (a2 <= 0) throw new IllegalStateException("Cannot compute offset from zero-length line segment");
            o2 = e2 * r2 / a2, u5 = e2 * s2 / a2;
          }
          return new X(n2 - u5, i2 + o2);
        } }, { key: "setCoordinates", value: function() {
          if (1 === arguments.length) {
            var t3 = arguments[0];
            this.setCoordinates(t3.p0, t3.p1);
          } else if (2 === arguments.length) {
            var e2 = arguments[0], n2 = arguments[1];
            this.p0.x = e2.x, this.p0.y = e2.y, this.p1.x = n2.x, this.p1.y = n2.y;
          }
        } }, { key: "segmentFraction", value: function(t3) {
          var e2 = this.projectionFactor(t3);
          return e2 < 0 ? e2 = 0 : (e2 > 1 || A.isNaN(e2)) && (e2 = 1), e2;
        } }, { key: "toString", value: function() {
          return "LINESTRING( " + this.p0.x + " " + this.p0.y + ", " + this.p1.x + " " + this.p1.y + ")";
        } }, { key: "isHorizontal", value: function() {
          return this.p0.y === this.p1.y;
        } }, { key: "reflect", value: function(t3) {
          var e2 = this.p1.getY() - this.p0.getY(), n2 = this.p0.getX() - this.p1.getX(), i2 = this.p0.getY() * (this.p1.getX() - this.p0.getX()) - this.p0.getX() * (this.p1.getY() - this.p0.getY()), r2 = e2 * e2 + n2 * n2, s2 = e2 * e2 - n2 * n2, a2 = t3.getX(), o2 = t3.getY();
          return new X((-s2 * a2 - 2 * e2 * n2 * o2 - 2 * e2 * i2) / r2, (s2 * o2 - 2 * e2 * n2 * a2 - 2 * n2 * i2) / r2);
        } }, { key: "distance", value: function() {
          if (arguments[0] instanceof t2) {
            var e2 = arguments[0];
            return xt.segmentToSegment(this.p0, this.p1, e2.p0, e2.p1);
          }
          if (arguments[0] instanceof X) {
            var n2 = arguments[0];
            return xt.pointToSegment(n2, this.p0, this.p1);
          }
        } }, { key: "pointAlong", value: function(t3) {
          var e2 = new X();
          return e2.x = this.p0.x + t3 * (this.p1.x - this.p0.x), e2.y = this.p0.y + t3 * (this.p1.y - this.p0.y), e2;
        } }, { key: "hashCode", value: function() {
          var t3 = A.doubleToLongBits(this.p0.x);
          t3 ^= 31 * A.doubleToLongBits(this.p0.y);
          var e2 = Math.trunc(t3) ^ Math.trunc(t3 >> 32), n2 = A.doubleToLongBits(this.p1.x);
          return n2 ^= 31 * A.doubleToLongBits(this.p1.y), e2 ^ (Math.trunc(n2) ^ Math.trunc(n2 >> 32));
        } }, { key: "interfaces_", get: function() {
          return [x, E];
        } }], [{ key: "constructor_", value: function() {
          if (this.p0 = null, this.p1 = null, 0 === arguments.length) t2.constructor_.call(this, new X(), new X());
          else if (1 === arguments.length) {
            var e2 = arguments[0];
            t2.constructor_.call(this, e2.p0, e2.p1);
          } else if (2 === arguments.length) {
            var n2 = arguments[0], i2 = arguments[1];
            this.p0 = n2, this.p1 = i2;
          } else if (4 === arguments.length) {
            var r2 = arguments[0], s2 = arguments[1], a2 = arguments[2], o2 = arguments[3];
            t2.constructor_.call(this, new X(r2, s2), new X(a2, o2));
          }
        } }, { key: "midPoint", value: function(t3, e2) {
          return new X((t3.x + e2.x) / 2, (t3.y + e2.y) / 2);
        } }]);
      })(), En = (function() {
        return s((function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }), [{ key: "overlap", value: function() {
          if (2 === arguments.length) ;
          else if (4 === arguments.length) {
            var t2 = arguments[1], e2 = arguments[2], n2 = arguments[3];
            arguments[0].getLineSegment(t2, this._overlapSeg1), e2.getLineSegment(n2, this._overlapSeg2), this.overlap(this._overlapSeg1, this._overlapSeg2);
          }
        } }], [{ key: "constructor_", value: function() {
          this._overlapSeg1 = new In(), this._overlapSeg2 = new In();
        } }]);
      })(), Nn = (function() {
        return s((function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }), [{ key: "getLineSegment", value: function(t2, e2) {
          e2.p0 = this._pts[t2], e2.p1 = this._pts[t2 + 1];
        } }, { key: "computeSelect", value: function(t2, e2, n2, i2) {
          var r2 = this._pts[e2], s2 = this._pts[n2];
          if (n2 - e2 == 1) return i2.select(this, e2), null;
          if (!t2.intersects(r2, s2)) return null;
          var a2 = Math.trunc((e2 + n2) / 2);
          e2 < a2 && this.computeSelect(t2, e2, a2, i2), a2 < n2 && this.computeSelect(t2, a2, n2, i2);
        } }, { key: "getCoordinates", value: function() {
          for (var t2 = new Array(this._end - this._start + 1).fill(null), e2 = 0, n2 = this._start; n2 <= this._end; n2++) t2[e2++] = this._pts[n2];
          return t2;
        } }, { key: "computeOverlaps", value: function() {
          if (2 === arguments.length) {
            var t2 = arguments[0], e2 = arguments[1];
            this.computeOverlaps(this._start, this._end, t2, t2._start, t2._end, e2);
          } else if (6 === arguments.length) {
            var n2 = arguments[0], i2 = arguments[1], r2 = arguments[2], s2 = arguments[3], a2 = arguments[4], o2 = arguments[5];
            if (i2 - n2 == 1 && a2 - s2 == 1) return o2.overlap(this, n2, r2, s2), null;
            if (!this.overlaps(n2, i2, r2, s2, a2)) return null;
            var u5 = Math.trunc((n2 + i2) / 2), l2 = Math.trunc((s2 + a2) / 2);
            n2 < u5 && (s2 < l2 && this.computeOverlaps(n2, u5, r2, s2, l2, o2), l2 < a2 && this.computeOverlaps(n2, u5, r2, l2, a2, o2)), u5 < i2 && (s2 < l2 && this.computeOverlaps(u5, i2, r2, s2, l2, o2), l2 < a2 && this.computeOverlaps(u5, i2, r2, l2, a2, o2));
          }
        } }, { key: "setId", value: function(t2) {
          this._id = t2;
        } }, { key: "select", value: function(t2, e2) {
          this.computeSelect(t2, this._start, this._end, e2);
        } }, { key: "getEnvelope", value: function() {
          if (null === this._env) {
            var t2 = this._pts[this._start], e2 = this._pts[this._end];
            this._env = new U(t2, e2);
          }
          return this._env;
        } }, { key: "overlaps", value: function(t2, e2, n2, i2, r2) {
          return U.intersects(this._pts[t2], this._pts[e2], n2._pts[i2], n2._pts[r2]);
        } }, { key: "getEndIndex", value: function() {
          return this._end;
        } }, { key: "getStartIndex", value: function() {
          return this._start;
        } }, { key: "getContext", value: function() {
          return this._context;
        } }, { key: "getId", value: function() {
          return this._id;
        } }], [{ key: "constructor_", value: function() {
          this._pts = null, this._start = null, this._end = null, this._env = null, this._context = null, this._id = null;
          var t2 = arguments[0], e2 = arguments[1], n2 = arguments[2], i2 = arguments[3];
          this._pts = t2, this._start = e2, this._end = n2, this._context = i2;
        } }]);
      })(), Tn = (function() {
        function t2() {
          n(this, t2);
        }
        return s(t2, null, [{ key: "findChainEnd", value: function(t3, e2) {
          for (var n2 = e2; n2 < t3.length - 1 && t3[n2].equals2D(t3[n2 + 1]); ) n2++;
          if (n2 >= t3.length - 1) return t3.length - 1;
          for (var i2 = je.quadrant(t3[n2], t3[n2 + 1]), r2 = e2 + 1; r2 < t3.length; ) {
            if (!t3[r2 - 1].equals2D(t3[r2])) {
              if (je.quadrant(t3[r2 - 1], t3[r2]) !== i2) break;
            }
            r2++;
          }
          return r2 - 1;
        } }, { key: "getChains", value: function() {
          if (1 === arguments.length) {
            var e2 = arguments[0];
            return t2.getChains(e2, null);
          }
          if (2 === arguments.length) {
            var n2 = arguments[0], i2 = arguments[1], r2 = new yt(), s2 = 0;
            do {
              var a2 = t2.findChainEnd(n2, s2), o2 = new Nn(n2, s2, a2, i2);
              r2.add(o2), s2 = a2;
            } while (s2 < n2.length - 1);
            return r2;
          }
        } }]);
      })(), Sn = (function() {
        return s((function t2() {
          n(this, t2);
        }), [{ key: "computeNodes", value: function(t2) {
        } }, { key: "getNodedSubstrings", value: function() {
        } }]);
      })(), Ln = (function() {
        return s((function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }), [{ key: "setSegmentIntersector", value: function(t2) {
          this._segInt = t2;
        } }, { key: "interfaces_", get: function() {
          return [Sn];
        } }], [{ key: "constructor_", value: function() {
          if (this._segInt = null, 0 === arguments.length) ;
          else if (1 === arguments.length) {
            var t2 = arguments[0];
            this.setSegmentIntersector(t2);
          }
        } }]);
      })(), Cn = (function(t2) {
        function i2() {
          var t3;
          return n(this, i2), t3 = e(this, i2), i2.constructor_.apply(t3, arguments), t3;
        }
        return l(i2, t2), s(i2, [{ key: "getMonotoneChains", value: function() {
          return this._monoChains;
        } }, { key: "getNodedSubstrings", value: function() {
          return xn.getNodedSubstrings(this._nodedSegStrings);
        } }, { key: "getIndex", value: function() {
          return this._index;
        } }, { key: "add", value: function(t3) {
          for (var e2 = Tn.getChains(t3.getCoordinates(), t3).iterator(); e2.hasNext(); ) {
            var n2 = e2.next();
            n2.setId(this._idCounter++), this._index.insert(n2.getEnvelope(), n2), this._monoChains.add(n2);
          }
        } }, { key: "computeNodes", value: function(t3) {
          this._nodedSegStrings = t3;
          for (var e2 = t3.iterator(); e2.hasNext(); ) this.add(e2.next());
          this.intersectChains();
        } }, { key: "intersectChains", value: function() {
          for (var t3 = new Rn(this._segInt), e2 = this._monoChains.iterator(); e2.hasNext(); ) for (var n2 = e2.next(), i3 = this._index.query(n2.getEnvelope()).iterator(); i3.hasNext(); ) {
            var r2 = i3.next();
            if (r2.getId() > n2.getId() && (n2.computeOverlaps(r2, t3), this._nOverlaps++), this._segInt.isDone()) return null;
          }
        } }], [{ key: "constructor_", value: function() {
          if (this._monoChains = new yt(), this._index = new fn(), this._idCounter = 0, this._nodedSegStrings = null, this._nOverlaps = 0, 0 === arguments.length) ;
          else if (1 === arguments.length) {
            var t3 = arguments[0];
            Ln.constructor_.call(this, t3);
          }
        } }]);
      })(Ln), Rn = (function(t2) {
        function i2() {
          var t3;
          return n(this, i2), t3 = e(this, i2), i2.constructor_.apply(t3, arguments), t3;
        }
        return l(i2, t2), s(i2, [{ key: "overlap", value: function() {
          if (4 !== arguments.length) return f(i2, "overlap", this, 1).apply(this, arguments);
          var t3 = arguments[1], e2 = arguments[2], n2 = arguments[3], r2 = arguments[0].getContext(), s2 = e2.getContext();
          this._si.processIntersections(r2, t3, s2, n2);
        } }], [{ key: "constructor_", value: function() {
          this._si = null;
          var t3 = arguments[0];
          this._si = t3;
        } }]);
      })(En);
      Cn.SegmentOverlapAction = Rn;
      var wn = (function() {
        function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }
        return s(t2, [{ key: "isDeletable", value: function(t3, e2, n2, i2) {
          var r2 = this._inputLine[t3], s2 = this._inputLine[e2], a2 = this._inputLine[n2];
          return !!this.isConcave(r2, s2, a2) && (!!this.isShallow(r2, s2, a2, i2) && this.isShallowSampled(r2, s2, t3, n2, i2));
        } }, { key: "deleteShallowConcavities", value: function() {
          for (var e2 = 1, n2 = this.findNextNonDeletedIndex(e2), i2 = this.findNextNonDeletedIndex(n2), r2 = false; i2 < this._inputLine.length; ) {
            var s2 = false;
            this.isDeletable(e2, n2, i2, this._distanceTol) && (this._isDeleted[n2] = t2.DELETE, s2 = true, r2 = true), e2 = s2 ? i2 : n2, n2 = this.findNextNonDeletedIndex(e2), i2 = this.findNextNonDeletedIndex(n2);
          }
          return r2;
        } }, { key: "isShallowConcavity", value: function(t3, e2, n2, i2) {
          return ct.index(t3, e2, n2) === this._angleOrientation && xt.pointToSegment(e2, t3, n2) < i2;
        } }, { key: "isShallowSampled", value: function(e2, n2, i2, r2, s2) {
          var a2 = Math.trunc((r2 - i2) / t2.NUM_PTS_TO_CHECK);
          a2 <= 0 && (a2 = 1);
          for (var o2 = i2; o2 < r2; o2 += a2) if (!this.isShallow(e2, n2, this._inputLine[o2], s2)) return false;
          return true;
        } }, { key: "isConcave", value: function(t3, e2, n2) {
          var i2 = ct.index(t3, e2, n2) === this._angleOrientation;
          return i2;
        } }, { key: "simplify", value: function(t3) {
          this._distanceTol = Math.abs(t3), t3 < 0 && (this._angleOrientation = ct.CLOCKWISE), this._isDeleted = new Array(this._inputLine.length).fill(null);
          var e2 = false;
          do {
            e2 = this.deleteShallowConcavities();
          } while (e2);
          return this.collapseLine();
        } }, { key: "findNextNonDeletedIndex", value: function(e2) {
          for (var n2 = e2 + 1; n2 < this._inputLine.length && this._isDeleted[n2] === t2.DELETE; ) n2++;
          return n2;
        } }, { key: "isShallow", value: function(t3, e2, n2, i2) {
          return xt.pointToSegment(e2, t3, n2) < i2;
        } }, { key: "collapseLine", value: function() {
          for (var e2 = new Zt(), n2 = 0; n2 < this._inputLine.length; n2++) this._isDeleted[n2] !== t2.DELETE && e2.add(this._inputLine[n2]);
          return e2.toCoordinateArray();
        } }], [{ key: "constructor_", value: function() {
          this._inputLine = null, this._distanceTol = null, this._isDeleted = null, this._angleOrientation = ct.COUNTERCLOCKWISE;
          var t3 = arguments[0];
          this._inputLine = t3;
        } }, { key: "simplify", value: function(e2, n2) {
          return new t2(e2).simplify(n2);
        } }]);
      })();
      wn.INIT = 0, wn.DELETE = 1, wn.KEEP = 1, wn.NUM_PTS_TO_CHECK = 10;
      var On = (function() {
        function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }
        return s(t2, [{ key: "getCoordinates", value: function() {
          return this._ptList.toArray(t2.COORDINATE_ARRAY_TYPE);
        } }, { key: "setPrecisionModel", value: function(t3) {
          this._precisionModel = t3;
        } }, { key: "addPt", value: function(t3) {
          var e2 = new X(t3);
          if (this._precisionModel.makePrecise(e2), this.isRedundant(e2)) return null;
          this._ptList.add(e2);
        } }, { key: "reverse", value: function() {
        } }, { key: "addPts", value: function(t3, e2) {
          if (e2) for (var n2 = 0; n2 < t3.length; n2++) this.addPt(t3[n2]);
          else for (var i2 = t3.length - 1; i2 >= 0; i2--) this.addPt(t3[i2]);
        } }, { key: "isRedundant", value: function(t3) {
          if (this._ptList.size() < 1) return false;
          var e2 = this._ptList.get(this._ptList.size() - 1);
          return t3.distance(e2) < this._minimimVertexDistance;
        } }, { key: "toString", value: function() {
          return new ae().createLineString(this.getCoordinates()).toString();
        } }, { key: "closeRing", value: function() {
          if (this._ptList.size() < 1) return null;
          var t3 = new X(this._ptList.get(0)), e2 = this._ptList.get(this._ptList.size() - 1);
          if (t3.equals(e2)) return null;
          this._ptList.add(t3);
        } }, { key: "setMinimumVertexDistance", value: function(t3) {
          this._minimimVertexDistance = t3;
        } }], [{ key: "constructor_", value: function() {
          this._ptList = null, this._precisionModel = null, this._minimimVertexDistance = 0, this._ptList = new yt();
        } }]);
      })();
      On.COORDINATE_ARRAY_TYPE = new Array(0).fill(null);
      var bn = (function() {
        function t2() {
          n(this, t2);
        }
        return s(t2, null, [{ key: "toDegrees", value: function(t3) {
          return 180 * t3 / Math.PI;
        } }, { key: "normalize", value: function(e2) {
          for (; e2 > Math.PI; ) e2 -= t2.PI_TIMES_2;
          for (; e2 <= -Math.PI; ) e2 += t2.PI_TIMES_2;
          return e2;
        } }, { key: "angle", value: function() {
          if (1 === arguments.length) {
            var t3 = arguments[0];
            return Math.atan2(t3.y, t3.x);
          }
          if (2 === arguments.length) {
            var e2 = arguments[0], n2 = arguments[1], i2 = n2.x - e2.x, r2 = n2.y - e2.y;
            return Math.atan2(r2, i2);
          }
        } }, { key: "isAcute", value: function(t3, e2, n2) {
          var i2 = t3.x - e2.x, r2 = t3.y - e2.y;
          return i2 * (n2.x - e2.x) + r2 * (n2.y - e2.y) > 0;
        } }, { key: "isObtuse", value: function(t3, e2, n2) {
          var i2 = t3.x - e2.x, r2 = t3.y - e2.y;
          return i2 * (n2.x - e2.x) + r2 * (n2.y - e2.y) < 0;
        } }, { key: "interiorAngle", value: function(e2, n2, i2) {
          var r2 = t2.angle(n2, e2), s2 = t2.angle(n2, i2);
          return Math.abs(s2 - r2);
        } }, { key: "normalizePositive", value: function(e2) {
          if (e2 < 0) {
            for (; e2 < 0; ) e2 += t2.PI_TIMES_2;
            e2 >= t2.PI_TIMES_2 && (e2 = 0);
          } else {
            for (; e2 >= t2.PI_TIMES_2; ) e2 -= t2.PI_TIMES_2;
            e2 < 0 && (e2 = 0);
          }
          return e2;
        } }, { key: "angleBetween", value: function(e2, n2, i2) {
          var r2 = t2.angle(n2, e2), s2 = t2.angle(n2, i2);
          return t2.diff(r2, s2);
        } }, { key: "diff", value: function(t3, e2) {
          var n2 = null;
          return (n2 = t3 < e2 ? e2 - t3 : t3 - e2) > Math.PI && (n2 = 2 * Math.PI - n2), n2;
        } }, { key: "toRadians", value: function(t3) {
          return t3 * Math.PI / 180;
        } }, { key: "getTurn", value: function(e2, n2) {
          var i2 = Math.sin(n2 - e2);
          return i2 > 0 ? t2.COUNTERCLOCKWISE : i2 < 0 ? t2.CLOCKWISE : t2.NONE;
        } }, { key: "angleBetweenOriented", value: function(e2, n2, i2) {
          var r2 = t2.angle(n2, e2), s2 = t2.angle(n2, i2) - r2;
          return s2 <= -Math.PI ? s2 + t2.PI_TIMES_2 : s2 > Math.PI ? s2 - t2.PI_TIMES_2 : s2;
        } }]);
      })();
      bn.PI_TIMES_2 = 2 * Math.PI, bn.PI_OVER_2 = Math.PI / 2, bn.PI_OVER_4 = Math.PI / 4, bn.COUNTERCLOCKWISE = ct.COUNTERCLOCKWISE, bn.CLOCKWISE = ct.CLOCKWISE, bn.NONE = ct.COLLINEAR;
      var Mn = (function() {
        function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }
        return s(t2, [{ key: "addNextSegment", value: function(t3, e2) {
          if (this._s0 = this._s1, this._s1 = this._s2, this._s2 = t3, this._seg0.setCoordinates(this._s0, this._s1), this.computeOffsetSegment(this._seg0, this._side, this._distance, this._offset0), this._seg1.setCoordinates(this._s1, this._s2), this.computeOffsetSegment(this._seg1, this._side, this._distance, this._offset1), this._s1.equals(this._s2)) return null;
          var n2 = ct.index(this._s0, this._s1, this._s2), i2 = n2 === ct.CLOCKWISE && this._side === $.LEFT || n2 === ct.COUNTERCLOCKWISE && this._side === $.RIGHT;
          0 === n2 ? this.addCollinear(e2) : i2 ? this.addOutsideTurn(n2, e2) : this.addInsideTurn(n2, e2);
        } }, { key: "addLineEndCap", value: function(t3, e2) {
          var n2 = new In(t3, e2), i2 = new In();
          this.computeOffsetSegment(n2, $.LEFT, this._distance, i2);
          var r2 = new In();
          this.computeOffsetSegment(n2, $.RIGHT, this._distance, r2);
          var s2 = e2.x - t3.x, a2 = e2.y - t3.y, o2 = Math.atan2(a2, s2);
          switch (this._bufParams.getEndCapStyle()) {
            case _.CAP_ROUND:
              this._segList.addPt(i2.p1), this.addDirectedFillet(e2, o2 + Math.PI / 2, o2 - Math.PI / 2, ct.CLOCKWISE, this._distance), this._segList.addPt(r2.p1);
              break;
            case _.CAP_FLAT:
              this._segList.addPt(i2.p1), this._segList.addPt(r2.p1);
              break;
            case _.CAP_SQUARE:
              var u5 = new X();
              u5.x = Math.abs(this._distance) * Math.cos(o2), u5.y = Math.abs(this._distance) * Math.sin(o2);
              var l2 = new X(i2.p1.x + u5.x, i2.p1.y + u5.y), h2 = new X(r2.p1.x + u5.x, r2.p1.y + u5.y);
              this._segList.addPt(l2), this._segList.addPt(h2);
          }
        } }, { key: "getCoordinates", value: function() {
          return this._segList.getCoordinates();
        } }, { key: "addMitreJoin", value: function(t3, e2, n2, i2) {
          var r2 = pt.intersection(e2.p0, e2.p1, n2.p0, n2.p1);
          if (null !== r2 && (i2 <= 0 ? 1 : r2.distance(t3) / Math.abs(i2)) <= this._bufParams.getMitreLimit()) return this._segList.addPt(r2), null;
          this.addLimitedMitreJoin(e2, n2, i2, this._bufParams.getMitreLimit());
        } }, { key: "addOutsideTurn", value: function(e2, n2) {
          if (this._offset0.p1.distance(this._offset1.p0) < this._distance * t2.OFFSET_SEGMENT_SEPARATION_FACTOR) return this._segList.addPt(this._offset0.p1), null;
          this._bufParams.getJoinStyle() === _.JOIN_MITRE ? this.addMitreJoin(this._s1, this._offset0, this._offset1, this._distance) : this._bufParams.getJoinStyle() === _.JOIN_BEVEL ? this.addBevelJoin(this._offset0, this._offset1) : (n2 && this._segList.addPt(this._offset0.p1), this.addCornerFillet(this._s1, this._offset0.p1, this._offset1.p0, e2, this._distance), this._segList.addPt(this._offset1.p0));
        } }, { key: "createSquare", value: function(t3) {
          this._segList.addPt(new X(t3.x + this._distance, t3.y + this._distance)), this._segList.addPt(new X(t3.x + this._distance, t3.y - this._distance)), this._segList.addPt(new X(t3.x - this._distance, t3.y - this._distance)), this._segList.addPt(new X(t3.x - this._distance, t3.y + this._distance)), this._segList.closeRing();
        } }, { key: "addSegments", value: function(t3, e2) {
          this._segList.addPts(t3, e2);
        } }, { key: "addFirstSegment", value: function() {
          this._segList.addPt(this._offset1.p0);
        } }, { key: "addCornerFillet", value: function(t3, e2, n2, i2, r2) {
          var s2 = e2.x - t3.x, a2 = e2.y - t3.y, o2 = Math.atan2(a2, s2), u5 = n2.x - t3.x, l2 = n2.y - t3.y, h2 = Math.atan2(l2, u5);
          i2 === ct.CLOCKWISE ? o2 <= h2 && (o2 += 2 * Math.PI) : o2 >= h2 && (o2 -= 2 * Math.PI), this._segList.addPt(e2), this.addDirectedFillet(t3, o2, h2, i2, r2), this._segList.addPt(n2);
        } }, { key: "addLastSegment", value: function() {
          this._segList.addPt(this._offset1.p1);
        } }, { key: "initSideSegments", value: function(t3, e2, n2) {
          this._s1 = t3, this._s2 = e2, this._side = n2, this._seg1.setCoordinates(t3, e2), this.computeOffsetSegment(this._seg1, n2, this._distance, this._offset1);
        } }, { key: "addLimitedMitreJoin", value: function(t3, e2, n2, i2) {
          var r2 = this._seg0.p1, s2 = bn.angle(r2, this._seg0.p0), a2 = bn.angleBetweenOriented(this._seg0.p0, r2, this._seg1.p1) / 2, o2 = bn.normalize(s2 + a2), u5 = bn.normalize(o2 + Math.PI), l2 = i2 * n2, h2 = n2 - l2 * Math.abs(Math.sin(a2)), c2 = r2.x + l2 * Math.cos(u5), f2 = r2.y + l2 * Math.sin(u5), g2 = new X(c2, f2), v3 = new In(r2, g2), y2 = v3.pointAlongOffset(1, h2), d2 = v3.pointAlongOffset(1, -h2);
          this._side === $.LEFT ? (this._segList.addPt(y2), this._segList.addPt(d2)) : (this._segList.addPt(d2), this._segList.addPt(y2));
        } }, { key: "addDirectedFillet", value: function(t3, e2, n2, i2, r2) {
          var s2 = i2 === ct.CLOCKWISE ? -1 : 1, a2 = Math.abs(e2 - n2), o2 = Math.trunc(a2 / this._filletAngleQuantum + 0.5);
          if (o2 < 1) return null;
          for (var u5 = a2 / o2, l2 = new X(), h2 = 0; h2 < o2; h2++) {
            var c2 = e2 + s2 * h2 * u5;
            l2.x = t3.x + r2 * Math.cos(c2), l2.y = t3.y + r2 * Math.sin(c2), this._segList.addPt(l2);
          }
        } }, { key: "computeOffsetSegment", value: function(t3, e2, n2, i2) {
          var r2 = e2 === $.LEFT ? 1 : -1, s2 = t3.p1.x - t3.p0.x, a2 = t3.p1.y - t3.p0.y, o2 = Math.sqrt(s2 * s2 + a2 * a2), u5 = r2 * n2 * s2 / o2, l2 = r2 * n2 * a2 / o2;
          i2.p0.x = t3.p0.x - l2, i2.p0.y = t3.p0.y + u5, i2.p1.x = t3.p1.x - l2, i2.p1.y = t3.p1.y + u5;
        } }, { key: "addInsideTurn", value: function(e2, n2) {
          if (this._li.computeIntersection(this._offset0.p0, this._offset0.p1, this._offset1.p0, this._offset1.p1), this._li.hasIntersection()) this._segList.addPt(this._li.getIntersection(0));
          else if (this._hasNarrowConcaveAngle = true, this._offset0.p1.distance(this._offset1.p0) < this._distance * t2.INSIDE_TURN_VERTEX_SNAP_DISTANCE_FACTOR) this._segList.addPt(this._offset0.p1);
          else {
            if (this._segList.addPt(this._offset0.p1), this._closingSegLengthFactor > 0) {
              var i2 = new X((this._closingSegLengthFactor * this._offset0.p1.x + this._s1.x) / (this._closingSegLengthFactor + 1), (this._closingSegLengthFactor * this._offset0.p1.y + this._s1.y) / (this._closingSegLengthFactor + 1));
              this._segList.addPt(i2);
              var r2 = new X((this._closingSegLengthFactor * this._offset1.p0.x + this._s1.x) / (this._closingSegLengthFactor + 1), (this._closingSegLengthFactor * this._offset1.p0.y + this._s1.y) / (this._closingSegLengthFactor + 1));
              this._segList.addPt(r2);
            } else this._segList.addPt(this._s1);
            this._segList.addPt(this._offset1.p0);
          }
        } }, { key: "createCircle", value: function(t3) {
          var e2 = new X(t3.x + this._distance, t3.y);
          this._segList.addPt(e2), this.addDirectedFillet(t3, 0, 2 * Math.PI, -1, this._distance), this._segList.closeRing();
        } }, { key: "addBevelJoin", value: function(t3, e2) {
          this._segList.addPt(t3.p1), this._segList.addPt(e2.p0);
        } }, { key: "init", value: function(e2) {
          this._distance = e2, this._maxCurveSegmentError = e2 * (1 - Math.cos(this._filletAngleQuantum / 2)), this._segList = new On(), this._segList.setPrecisionModel(this._precisionModel), this._segList.setMinimumVertexDistance(e2 * t2.CURVE_VERTEX_SNAP_DISTANCE_FACTOR);
        } }, { key: "addCollinear", value: function(t3) {
          this._li.computeIntersection(this._s0, this._s1, this._s1, this._s2), this._li.getIntersectionNum() >= 2 && (this._bufParams.getJoinStyle() === _.JOIN_BEVEL || this._bufParams.getJoinStyle() === _.JOIN_MITRE ? (t3 && this._segList.addPt(this._offset0.p1), this._segList.addPt(this._offset1.p0)) : this.addCornerFillet(this._s1, this._offset0.p1, this._offset1.p0, ct.CLOCKWISE, this._distance));
        } }, { key: "closeRing", value: function() {
          this._segList.closeRing();
        } }, { key: "hasNarrowConcaveAngle", value: function() {
          return this._hasNarrowConcaveAngle;
        } }], [{ key: "constructor_", value: function() {
          this._maxCurveSegmentError = 0, this._filletAngleQuantum = null, this._closingSegLengthFactor = 1, this._segList = null, this._distance = 0, this._precisionModel = null, this._bufParams = null, this._li = null, this._s0 = null, this._s1 = null, this._s2 = null, this._seg0 = new In(), this._seg1 = new In(), this._offset0 = new In(), this._offset1 = new In(), this._side = 0, this._hasNarrowConcaveAngle = false;
          var e2 = arguments[0], n2 = arguments[1], i2 = arguments[2];
          this._precisionModel = e2, this._bufParams = n2, this._li = new we(), this._filletAngleQuantum = Math.PI / 2 / n2.getQuadrantSegments(), n2.getQuadrantSegments() >= 8 && n2.getJoinStyle() === _.JOIN_ROUND && (this._closingSegLengthFactor = t2.MAX_CLOSING_SEG_LEN_FACTOR), this.init(i2);
        } }]);
      })();
      Mn.OFFSET_SEGMENT_SEPARATION_FACTOR = 1e-3, Mn.INSIDE_TURN_VERTEX_SNAP_DISTANCE_FACTOR = 1e-3, Mn.CURVE_VERTEX_SNAP_DISTANCE_FACTOR = 1e-6, Mn.MAX_CLOSING_SEG_LEN_FACTOR = 80;
      var An = (function() {
        function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }
        return s(t2, [{ key: "getOffsetCurve", value: function(t3, e2) {
          if (this._distance = e2, 0 === e2) return null;
          var n2 = e2 < 0, i2 = Math.abs(e2), r2 = this.getSegGen(i2);
          t3.length <= 1 ? this.computePointCurve(t3[0], r2) : this.computeOffsetCurve(t3, n2, r2);
          var s2 = r2.getCoordinates();
          return n2 && jt.reverse(s2), s2;
        } }, { key: "computeSingleSidedBufferCurve", value: function(t3, e2, n2) {
          var i2 = this.simplifyTolerance(this._distance);
          if (e2) {
            n2.addSegments(t3, true);
            var r2 = wn.simplify(t3, -i2), s2 = r2.length - 1;
            n2.initSideSegments(r2[s2], r2[s2 - 1], $.LEFT), n2.addFirstSegment();
            for (var a2 = s2 - 2; a2 >= 0; a2--) n2.addNextSegment(r2[a2], true);
          } else {
            n2.addSegments(t3, false);
            var o2 = wn.simplify(t3, i2), u5 = o2.length - 1;
            n2.initSideSegments(o2[0], o2[1], $.LEFT), n2.addFirstSegment();
            for (var l2 = 2; l2 <= u5; l2++) n2.addNextSegment(o2[l2], true);
          }
          n2.addLastSegment(), n2.closeRing();
        } }, { key: "computeRingBufferCurve", value: function(t3, e2, n2) {
          var i2 = this.simplifyTolerance(this._distance);
          e2 === $.RIGHT && (i2 = -i2);
          var r2 = wn.simplify(t3, i2), s2 = r2.length - 1;
          n2.initSideSegments(r2[s2 - 1], r2[0], e2);
          for (var a2 = 1; a2 <= s2; a2++) {
            var o2 = 1 !== a2;
            n2.addNextSegment(r2[a2], o2);
          }
          n2.closeRing();
        } }, { key: "computeLineBufferCurve", value: function(t3, e2) {
          var n2 = this.simplifyTolerance(this._distance), i2 = wn.simplify(t3, n2), r2 = i2.length - 1;
          e2.initSideSegments(i2[0], i2[1], $.LEFT);
          for (var s2 = 2; s2 <= r2; s2++) e2.addNextSegment(i2[s2], true);
          e2.addLastSegment(), e2.addLineEndCap(i2[r2 - 1], i2[r2]);
          var a2 = wn.simplify(t3, -n2), o2 = a2.length - 1;
          e2.initSideSegments(a2[o2], a2[o2 - 1], $.LEFT);
          for (var u5 = o2 - 2; u5 >= 0; u5--) e2.addNextSegment(a2[u5], true);
          e2.addLastSegment(), e2.addLineEndCap(a2[1], a2[0]), e2.closeRing();
        } }, { key: "computePointCurve", value: function(t3, e2) {
          switch (this._bufParams.getEndCapStyle()) {
            case _.CAP_ROUND:
              e2.createCircle(t3);
              break;
            case _.CAP_SQUARE:
              e2.createSquare(t3);
          }
        } }, { key: "getLineCurve", value: function(t3, e2) {
          if (this._distance = e2, this.isLineOffsetEmpty(e2)) return null;
          var n2 = Math.abs(e2), i2 = this.getSegGen(n2);
          if (t3.length <= 1) this.computePointCurve(t3[0], i2);
          else if (this._bufParams.isSingleSided()) {
            var r2 = e2 < 0;
            this.computeSingleSidedBufferCurve(t3, r2, i2);
          } else this.computeLineBufferCurve(t3, i2);
          return i2.getCoordinates();
        } }, { key: "getBufferParameters", value: function() {
          return this._bufParams;
        } }, { key: "simplifyTolerance", value: function(t3) {
          return t3 * this._bufParams.getSimplifyFactor();
        } }, { key: "getRingCurve", value: function(e2, n2, i2) {
          if (this._distance = i2, e2.length <= 2) return this.getLineCurve(e2, i2);
          if (0 === i2) return t2.copyCoordinates(e2);
          var r2 = this.getSegGen(i2);
          return this.computeRingBufferCurve(e2, n2, r2), r2.getCoordinates();
        } }, { key: "computeOffsetCurve", value: function(t3, e2, n2) {
          var i2 = this.simplifyTolerance(this._distance);
          if (e2) {
            var r2 = wn.simplify(t3, -i2), s2 = r2.length - 1;
            n2.initSideSegments(r2[s2], r2[s2 - 1], $.LEFT), n2.addFirstSegment();
            for (var a2 = s2 - 2; a2 >= 0; a2--) n2.addNextSegment(r2[a2], true);
          } else {
            var o2 = wn.simplify(t3, i2), u5 = o2.length - 1;
            n2.initSideSegments(o2[0], o2[1], $.LEFT), n2.addFirstSegment();
            for (var l2 = 2; l2 <= u5; l2++) n2.addNextSegment(o2[l2], true);
          }
          n2.addLastSegment();
        } }, { key: "isLineOffsetEmpty", value: function(t3) {
          return 0 === t3 || t3 < 0 && !this._bufParams.isSingleSided();
        } }, { key: "getSegGen", value: function(t3) {
          return new Mn(this._precisionModel, this._bufParams, t3);
        } }], [{ key: "constructor_", value: function() {
          this._distance = 0, this._precisionModel = null, this._bufParams = null;
          var t3 = arguments[0], e2 = arguments[1];
          this._precisionModel = t3, this._bufParams = e2;
        } }, { key: "copyCoordinates", value: function(t3) {
          for (var e2 = new Array(t3.length).fill(null), n2 = 0; n2 < e2.length; n2++) e2[n2] = new X(t3[n2]);
          return e2;
        } }]);
      })(), Pn = (function() {
        return s((function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }), [{ key: "findStabbedSegments", value: function() {
          if (1 === arguments.length) {
            for (var t2 = arguments[0], e2 = new yt(), n2 = this._subgraphs.iterator(); n2.hasNext(); ) {
              var i2 = n2.next(), r2 = i2.getEnvelope();
              t2.y < r2.getMinY() || t2.y > r2.getMaxY() || this.findStabbedSegments(t2, i2.getDirectedEdges(), e2);
            }
            return e2;
          }
          if (3 === arguments.length) {
            if (rt(arguments[2], nt) && arguments[0] instanceof X && arguments[1] instanceof Ke) for (var s2 = arguments[0], a2 = arguments[1], o2 = arguments[2], u5 = a2.getEdge().getCoordinates(), l2 = 0; l2 < u5.length - 1; l2++) {
              if (this._seg.p0 = u5[l2], this._seg.p1 = u5[l2 + 1], this._seg.p0.y > this._seg.p1.y && this._seg.reverse(), !(Math.max(this._seg.p0.x, this._seg.p1.x) < s2.x || this._seg.isHorizontal() || s2.y < this._seg.p0.y || s2.y > this._seg.p1.y || ct.index(this._seg.p0, this._seg.p1, s2) === ct.RIGHT)) {
                var h2 = a2.getDepth($.LEFT);
                this._seg.p0.equals(u5[l2]) || (h2 = a2.getDepth($.RIGHT));
                var c2 = new Dn(this._seg, h2);
                o2.add(c2);
              }
            }
            else if (rt(arguments[2], nt) && arguments[0] instanceof X && rt(arguments[1], nt)) for (var f2 = arguments[0], g2 = arguments[2], v3 = arguments[1].iterator(); v3.hasNext(); ) {
              var y2 = v3.next();
              y2.isForward() && this.findStabbedSegments(f2, y2, g2);
            }
          }
        } }, { key: "getDepth", value: function(t2) {
          var e2 = this.findStabbedSegments(t2);
          return 0 === e2.size() ? 0 : an.min(e2)._leftDepth;
        } }], [{ key: "constructor_", value: function() {
          this._subgraphs = null, this._seg = new In();
          var t2 = arguments[0];
          this._subgraphs = t2;
        } }]);
      })(), Dn = (function() {
        return s((function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }), [{ key: "compareTo", value: function(t2) {
          var e2 = t2;
          if (this._upwardSeg.minX() >= e2._upwardSeg.maxX()) return 1;
          if (this._upwardSeg.maxX() <= e2._upwardSeg.minX()) return -1;
          var n2 = this._upwardSeg.orientationIndex(e2._upwardSeg);
          return 0 !== n2 || 0 !== (n2 = -1 * e2._upwardSeg.orientationIndex(this._upwardSeg)) ? n2 : this._upwardSeg.compareTo(e2._upwardSeg);
        } }, { key: "compareX", value: function(t2, e2) {
          var n2 = t2.p0.compareTo(e2.p0);
          return 0 !== n2 ? n2 : t2.p1.compareTo(e2.p1);
        } }, { key: "toString", value: function() {
          return this._upwardSeg.toString();
        } }, { key: "interfaces_", get: function() {
          return [x];
        } }], [{ key: "constructor_", value: function() {
          this._upwardSeg = null, this._leftDepth = null;
          var t2 = arguments[0], e2 = arguments[1];
          this._upwardSeg = new In(t2), this._leftDepth = e2;
        } }]);
      })();
      Pn.DepthSegment = Dn;
      var Fn = (function(t2) {
        function i2() {
          var t3;
          return n(this, i2), t3 = e(this, i2), i2.constructor_.apply(t3, arguments), t3;
        }
        return l(i2, t2), s(i2, null, [{ key: "constructor_", value: function() {
          p.constructor_.call(this, "Projective point not representable on the Cartesian plane.");
        } }]);
      })(p), Gn = (function() {
        function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }
        return s(t2, [{ key: "getY", value: function() {
          var t3 = this.y / this.w;
          if (A.isNaN(t3) || A.isInfinite(t3)) throw new Fn();
          return t3;
        } }, { key: "getX", value: function() {
          var t3 = this.x / this.w;
          if (A.isNaN(t3) || A.isInfinite(t3)) throw new Fn();
          return t3;
        } }, { key: "getCoordinate", value: function() {
          var t3 = new X();
          return t3.x = this.getX(), t3.y = this.getY(), t3;
        } }], [{ key: "constructor_", value: function() {
          if (this.x = null, this.y = null, this.w = null, 0 === arguments.length) this.x = 0, this.y = 0, this.w = 1;
          else if (1 === arguments.length) {
            var e2 = arguments[0];
            this.x = e2.x, this.y = e2.y, this.w = 1;
          } else if (2 === arguments.length) {
            if ("number" == typeof arguments[0] && "number" == typeof arguments[1]) {
              var n2 = arguments[0], i2 = arguments[1];
              this.x = n2, this.y = i2, this.w = 1;
            } else if (arguments[0] instanceof t2 && arguments[1] instanceof t2) {
              var r2 = arguments[0], s2 = arguments[1];
              this.x = r2.y * s2.w - s2.y * r2.w, this.y = s2.x * r2.w - r2.x * s2.w, this.w = r2.x * s2.y - s2.x * r2.y;
            } else if (arguments[0] instanceof X && arguments[1] instanceof X) {
              var a2 = arguments[0], o2 = arguments[1];
              this.x = a2.y - o2.y, this.y = o2.x - a2.x, this.w = a2.x * o2.y - o2.x * a2.y;
            }
          } else if (3 === arguments.length) {
            var u5 = arguments[0], l2 = arguments[1], h2 = arguments[2];
            this.x = u5, this.y = l2, this.w = h2;
          } else if (4 === arguments.length) {
            var c2 = arguments[0], f2 = arguments[1], g2 = arguments[2], v3 = arguments[3], y2 = c2.y - f2.y, d2 = f2.x - c2.x, _2 = c2.x * f2.y - f2.x * c2.y, p2 = g2.y - v3.y, m2 = v3.x - g2.x, k2 = g2.x * v3.y - v3.x * g2.y;
            this.x = d2 * k2 - m2 * _2, this.y = p2 * _2 - y2 * k2, this.w = y2 * m2 - p2 * d2;
          }
        } }]);
      })(), qn = (function() {
        function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }
        return s(t2, [{ key: "area", value: function() {
          return t2.area(this.p0, this.p1, this.p2);
        } }, { key: "signedArea", value: function() {
          return t2.signedArea(this.p0, this.p1, this.p2);
        } }, { key: "interpolateZ", value: function(e2) {
          if (null === e2) throw new m("Supplied point is null.");
          return t2.interpolateZ(e2, this.p0, this.p1, this.p2);
        } }, { key: "longestSideLength", value: function() {
          return t2.longestSideLength(this.p0, this.p1, this.p2);
        } }, { key: "isAcute", value: function() {
          return t2.isAcute(this.p0, this.p1, this.p2);
        } }, { key: "circumcentre", value: function() {
          return t2.circumcentre(this.p0, this.p1, this.p2);
        } }, { key: "area3D", value: function() {
          return t2.area3D(this.p0, this.p1, this.p2);
        } }, { key: "centroid", value: function() {
          return t2.centroid(this.p0, this.p1, this.p2);
        } }, { key: "inCentre", value: function() {
          return t2.inCentre(this.p0, this.p1, this.p2);
        } }], [{ key: "constructor_", value: function() {
          this.p0 = null, this.p1 = null, this.p2 = null;
          var t3 = arguments[0], e2 = arguments[1], n2 = arguments[2];
          this.p0 = t3, this.p1 = e2, this.p2 = n2;
        } }, { key: "area", value: function(t3, e2, n2) {
          return Math.abs(((n2.x - t3.x) * (e2.y - t3.y) - (e2.x - t3.x) * (n2.y - t3.y)) / 2);
        } }, { key: "signedArea", value: function(t3, e2, n2) {
          return ((n2.x - t3.x) * (e2.y - t3.y) - (e2.x - t3.x) * (n2.y - t3.y)) / 2;
        } }, { key: "det", value: function(t3, e2, n2, i2) {
          return t3 * i2 - e2 * n2;
        } }, { key: "interpolateZ", value: function(t3, e2, n2, i2) {
          var r2 = e2.x, s2 = e2.y, a2 = n2.x - r2, o2 = i2.x - r2, u5 = n2.y - s2, l2 = i2.y - s2, h2 = a2 * l2 - o2 * u5, c2 = t3.x - r2, f2 = t3.y - s2, g2 = (l2 * c2 - o2 * f2) / h2, v3 = (-u5 * c2 + a2 * f2) / h2;
          return e2.getZ() + g2 * (n2.getZ() - e2.getZ()) + v3 * (i2.getZ() - e2.getZ());
        } }, { key: "longestSideLength", value: function(t3, e2, n2) {
          var i2 = t3.distance(e2), r2 = e2.distance(n2), s2 = n2.distance(t3), a2 = i2;
          return r2 > a2 && (a2 = r2), s2 > a2 && (a2 = s2), a2;
        } }, { key: "circumcentreDD", value: function(t3, e2, n2) {
          var i2 = ut.valueOf(t3.x).subtract(n2.x), r2 = ut.valueOf(t3.y).subtract(n2.y), s2 = ut.valueOf(e2.x).subtract(n2.x), a2 = ut.valueOf(e2.y).subtract(n2.y), o2 = ut.determinant(i2, r2, s2, a2).multiply(2), u5 = i2.sqr().add(r2.sqr()), l2 = s2.sqr().add(a2.sqr()), h2 = ut.determinant(r2, u5, a2, l2), c2 = ut.determinant(i2, u5, s2, l2), f2 = ut.valueOf(n2.x).subtract(h2.divide(o2)).doubleValue(), g2 = ut.valueOf(n2.y).add(c2.divide(o2)).doubleValue();
          return new X(f2, g2);
        } }, { key: "isAcute", value: function(t3, e2, n2) {
          return !!bn.isAcute(t3, e2, n2) && (!!bn.isAcute(e2, n2, t3) && !!bn.isAcute(n2, t3, e2));
        } }, { key: "circumcentre", value: function(e2, n2, i2) {
          var r2 = i2.x, s2 = i2.y, a2 = e2.x - r2, o2 = e2.y - s2, u5 = n2.x - r2, l2 = n2.y - s2, h2 = 2 * t2.det(a2, o2, u5, l2), c2 = t2.det(o2, a2 * a2 + o2 * o2, l2, u5 * u5 + l2 * l2), f2 = t2.det(a2, a2 * a2 + o2 * o2, u5, u5 * u5 + l2 * l2);
          return new X(r2 - c2 / h2, s2 + f2 / h2);
        } }, { key: "perpendicularBisector", value: function(t3, e2) {
          var n2 = e2.x - t3.x, i2 = e2.y - t3.y, r2 = new Gn(t3.x + n2 / 2, t3.y + i2 / 2, 1), s2 = new Gn(t3.x - i2 + n2 / 2, t3.y + n2 + i2 / 2, 1);
          return new Gn(r2, s2);
        } }, { key: "angleBisector", value: function(t3, e2, n2) {
          var i2 = e2.distance(t3), r2 = i2 / (i2 + e2.distance(n2)), s2 = n2.x - t3.x, a2 = n2.y - t3.y;
          return new X(t3.x + r2 * s2, t3.y + r2 * a2);
        } }, { key: "area3D", value: function(t3, e2, n2) {
          var i2 = e2.x - t3.x, r2 = e2.y - t3.y, s2 = e2.getZ() - t3.getZ(), a2 = n2.x - t3.x, o2 = n2.y - t3.y, u5 = n2.getZ() - t3.getZ(), l2 = r2 * u5 - s2 * o2, h2 = s2 * a2 - i2 * u5, c2 = i2 * o2 - r2 * a2, f2 = l2 * l2 + h2 * h2 + c2 * c2, g2 = Math.sqrt(f2) / 2;
          return g2;
        } }, { key: "centroid", value: function(t3, e2, n2) {
          var i2 = (t3.x + e2.x + n2.x) / 3, r2 = (t3.y + e2.y + n2.y) / 3;
          return new X(i2, r2);
        } }, { key: "inCentre", value: function(t3, e2, n2) {
          var i2 = e2.distance(n2), r2 = t3.distance(n2), s2 = t3.distance(e2), a2 = i2 + r2 + s2, o2 = (i2 * t3.x + r2 * e2.x + s2 * n2.x) / a2, u5 = (i2 * t3.y + r2 * e2.y + s2 * n2.y) / a2;
          return new X(o2, u5);
        } }]);
      })(), Yn = (function() {
        return s((function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }), [{ key: "addRingSide", value: function(t2, e2, n2, i2, r2) {
          if (0 === e2 && t2.length < Xt.MINIMUM_VALID_SIZE) return null;
          var s2 = i2, a2 = r2;
          t2.length >= Xt.MINIMUM_VALID_SIZE && ct.isCCW(t2) && (s2 = r2, a2 = i2, n2 = $.opposite(n2));
          var o2 = this._curveBuilder.getRingCurve(t2, n2, e2);
          this.addCurve(o2, s2, a2);
        } }, { key: "addRingBothSides", value: function(t2, e2) {
          this.addRingSide(t2, e2, $.LEFT, H.EXTERIOR, H.INTERIOR), this.addRingSide(t2, e2, $.RIGHT, H.INTERIOR, H.EXTERIOR);
        } }, { key: "addPoint", value: function(t2) {
          if (this._distance <= 0) return null;
          var e2 = t2.getCoordinates(), n2 = this._curveBuilder.getLineCurve(e2, this._distance);
          this.addCurve(n2, H.EXTERIOR, H.INTERIOR);
        } }, { key: "addPolygon", value: function(t2) {
          var e2 = this._distance, n2 = $.LEFT;
          this._distance < 0 && (e2 = -this._distance, n2 = $.RIGHT);
          var i2 = t2.getExteriorRing(), r2 = jt.removeRepeatedPoints(i2.getCoordinates());
          if (this._distance < 0 && this.isErodedCompletely(i2, this._distance)) return null;
          if (this._distance <= 0 && r2.length < 3) return null;
          this.addRingSide(r2, e2, n2, H.EXTERIOR, H.INTERIOR);
          for (var s2 = 0; s2 < t2.getNumInteriorRing(); s2++) {
            var a2 = t2.getInteriorRingN(s2), o2 = jt.removeRepeatedPoints(a2.getCoordinates());
            this._distance > 0 && this.isErodedCompletely(a2, -this._distance) || this.addRingSide(o2, e2, $.opposite(n2), H.INTERIOR, H.EXTERIOR);
          }
        } }, { key: "isTriangleErodedCompletely", value: function(t2, e2) {
          var n2 = new qn(t2[0], t2[1], t2[2]), i2 = n2.inCentre();
          return xt.pointToSegment(i2, n2.p0, n2.p1) < Math.abs(e2);
        } }, { key: "addLineString", value: function(t2) {
          if (this._curveBuilder.isLineOffsetEmpty(this._distance)) return null;
          var e2 = jt.removeRepeatedPoints(t2.getCoordinates());
          if (jt.isRing(e2) && !this._curveBuilder.getBufferParameters().isSingleSided()) this.addRingBothSides(e2, this._distance);
          else {
            var n2 = this._curveBuilder.getLineCurve(e2, this._distance);
            this.addCurve(n2, H.EXTERIOR, H.INTERIOR);
          }
        } }, { key: "addCurve", value: function(t2, e2, n2) {
          if (null === t2 || t2.length < 2) return null;
          var i2 = new xn(t2, new Ae(0, H.BOUNDARY, e2, n2));
          this._curveList.add(i2);
        } }, { key: "getCurves", value: function() {
          return this.add(this._inputGeom), this._curveList;
        } }, { key: "add", value: function(t2) {
          if (t2.isEmpty()) return null;
          if (t2 instanceof Dt) this.addPolygon(t2);
          else if (t2 instanceof wt) this.addLineString(t2);
          else if (t2 instanceof bt) this.addPoint(t2);
          else if (t2 instanceof zt) this.addCollection(t2);
          else if (t2 instanceof se) this.addCollection(t2);
          else if (t2 instanceof te) this.addCollection(t2);
          else {
            if (!(t2 instanceof Yt)) throw new W(t2.getGeometryType());
            this.addCollection(t2);
          }
        } }, { key: "isErodedCompletely", value: function(t2, e2) {
          var n2 = t2.getCoordinates();
          if (n2.length < 4) return e2 < 0;
          if (4 === n2.length) return this.isTriangleErodedCompletely(n2, e2);
          var i2 = t2.getEnvelopeInternal(), r2 = Math.min(i2.getHeight(), i2.getWidth());
          return e2 < 0 && 2 * Math.abs(e2) > r2;
        } }, { key: "addCollection", value: function(t2) {
          for (var e2 = 0; e2 < t2.getNumGeometries(); e2++) {
            var n2 = t2.getGeometryN(e2);
            this.add(n2);
          }
        } }], [{ key: "constructor_", value: function() {
          this._inputGeom = null, this._distance = null, this._curveBuilder = null, this._curveList = new yt();
          var t2 = arguments[0], e2 = arguments[1], n2 = arguments[2];
          this._inputGeom = t2, this._distance = e2, this._curveBuilder = n2;
        } }]);
      })(), zn = (function() {
        return s((function t2() {
          n(this, t2);
        }), [{ key: "locate", value: function(t2) {
        } }]);
      })(), Xn = (function() {
        function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }
        return s(t2, [{ key: "next", value: function() {
          if (this._atStart) return this._atStart = false, t2.isAtomic(this._parent) && this._index++, this._parent;
          if (null !== this._subcollectionIterator) {
            if (this._subcollectionIterator.hasNext()) return this._subcollectionIterator.next();
            this._subcollectionIterator = null;
          }
          if (this._index >= this._max) throw new j();
          var e2 = this._parent.getGeometryN(this._index++);
          return e2 instanceof Yt ? (this._subcollectionIterator = new t2(e2), this._subcollectionIterator.next()) : e2;
        } }, { key: "remove", value: function() {
          throw new W(this.getClass().getName());
        } }, { key: "hasNext", value: function() {
          if (this._atStart) return true;
          if (null !== this._subcollectionIterator) {
            if (this._subcollectionIterator.hasNext()) return true;
            this._subcollectionIterator = null;
          }
          return !(this._index >= this._max);
        } }, { key: "interfaces_", get: function() {
          return [dn];
        } }], [{ key: "constructor_", value: function() {
          this._parent = null, this._atStart = null, this._max = null, this._index = null, this._subcollectionIterator = null;
          var t3 = arguments[0];
          this._parent = t3, this._atStart = true, this._index = 0, this._max = t3.getNumGeometries();
        } }, { key: "isAtomic", value: function(t3) {
          return !(t3 instanceof Yt);
        } }]);
      })(), Bn = (function() {
        function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }
        return s(t2, [{ key: "locate", value: function(e2) {
          return t2.locate(e2, this._geom);
        } }, { key: "interfaces_", get: function() {
          return [zn];
        } }], [{ key: "constructor_", value: function() {
          this._geom = null;
          var t3 = arguments[0];
          this._geom = t3;
        } }, { key: "locatePointInPolygon", value: function(e2, n2) {
          if (n2.isEmpty()) return H.EXTERIOR;
          var i2 = n2.getExteriorRing(), r2 = t2.locatePointInRing(e2, i2);
          if (r2 !== H.INTERIOR) return r2;
          for (var s2 = 0; s2 < n2.getNumInteriorRing(); s2++) {
            var a2 = n2.getInteriorRingN(s2), o2 = t2.locatePointInRing(e2, a2);
            if (o2 === H.BOUNDARY) return H.BOUNDARY;
            if (o2 === H.INTERIOR) return H.EXTERIOR;
          }
          return H.INTERIOR;
        } }, { key: "locatePointInRing", value: function(t3, e2) {
          return e2.getEnvelopeInternal().intersects(t3) ? be.locateInRing(t3, e2.getCoordinates()) : H.EXTERIOR;
        } }, { key: "containsPointInPolygon", value: function(e2, n2) {
          return H.EXTERIOR !== t2.locatePointInPolygon(e2, n2);
        } }, { key: "locateInGeometry", value: function(e2, n2) {
          if (n2 instanceof Dt) return t2.locatePointInPolygon(e2, n2);
          if (n2 instanceof Yt) for (var i2 = new Xn(n2); i2.hasNext(); ) {
            var r2 = i2.next();
            if (r2 !== n2) {
              var s2 = t2.locateInGeometry(e2, r2);
              if (s2 !== H.EXTERIOR) return s2;
            }
          }
          return H.EXTERIOR;
        } }, { key: "isContained", value: function(e2, n2) {
          return H.EXTERIOR !== t2.locate(e2, n2);
        } }, { key: "locate", value: function(e2, n2) {
          return n2.isEmpty() ? H.EXTERIOR : n2.getEnvelopeInternal().intersects(e2) ? t2.locateInGeometry(e2, n2) : H.EXTERIOR;
        } }]);
      })(), Un = (function() {
        return s((function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }), [{ key: "getNextCW", value: function(t2) {
          this.getEdges();
          var e2 = this._edgeList.indexOf(t2), n2 = e2 - 1;
          return 0 === e2 && (n2 = this._edgeList.size() - 1), this._edgeList.get(n2);
        } }, { key: "propagateSideLabels", value: function(t2) {
          for (var e2 = H.NONE, n2 = this.iterator(); n2.hasNext(); ) {
            var i2 = n2.next().getLabel();
            i2.isArea(t2) && i2.getLocation(t2, $.LEFT) !== H.NONE && (e2 = i2.getLocation(t2, $.LEFT));
          }
          if (e2 === H.NONE) return null;
          for (var r2 = e2, s2 = this.iterator(); s2.hasNext(); ) {
            var a2 = s2.next(), o2 = a2.getLabel();
            if (o2.getLocation(t2, $.ON) === H.NONE && o2.setLocation(t2, $.ON, r2), o2.isArea(t2)) {
              var u5 = o2.getLocation(t2, $.LEFT), l2 = o2.getLocation(t2, $.RIGHT);
              if (l2 !== H.NONE) {
                if (l2 !== r2) throw new gt("side location conflict", a2.getCoordinate());
                u5 === H.NONE && G.shouldNeverReachHere("found single null side (at " + a2.getCoordinate() + ")"), r2 = u5;
              } else G.isTrue(o2.getLocation(t2, $.LEFT) === H.NONE, "found single null side"), o2.setLocation(t2, $.RIGHT, r2), o2.setLocation(t2, $.LEFT, r2);
            }
          }
        } }, { key: "getCoordinate", value: function() {
          var t2 = this.iterator();
          return t2.hasNext() ? t2.next().getCoordinate() : null;
        } }, { key: "print", value: function(t2) {
          mt.out.println("EdgeEndStar:   " + this.getCoordinate());
          for (var e2 = this.iterator(); e2.hasNext(); ) {
            e2.next().print(t2);
          }
        } }, { key: "isAreaLabelsConsistent", value: function(t2) {
          return this.computeEdgeEndLabels(t2.getBoundaryNodeRule()), this.checkAreaLabelsConsistent(0);
        } }, { key: "checkAreaLabelsConsistent", value: function(t2) {
          var e2 = this.getEdges();
          if (e2.size() <= 0) return true;
          var n2 = e2.size() - 1, i2 = e2.get(n2).getLabel().getLocation(t2, $.LEFT);
          G.isTrue(i2 !== H.NONE, "Found unlabelled area edge");
          for (var r2 = i2, s2 = this.iterator(); s2.hasNext(); ) {
            var a2 = s2.next().getLabel();
            G.isTrue(a2.isArea(t2), "Found non-area edge");
            var o2 = a2.getLocation(t2, $.LEFT), u5 = a2.getLocation(t2, $.RIGHT);
            if (o2 === u5) return false;
            if (u5 !== r2) return false;
            r2 = o2;
          }
          return true;
        } }, { key: "findIndex", value: function(t2) {
          this.iterator();
          for (var e2 = 0; e2 < this._edgeList.size(); e2++) {
            if (this._edgeList.get(e2) === t2) return e2;
          }
          return -1;
        } }, { key: "iterator", value: function() {
          return this.getEdges().iterator();
        } }, { key: "getEdges", value: function() {
          return null === this._edgeList && (this._edgeList = new yt(this._edgeMap.values())), this._edgeList;
        } }, { key: "getLocation", value: function(t2, e2, n2) {
          return this._ptInAreaLocation[t2] === H.NONE && (this._ptInAreaLocation[t2] = Bn.locate(e2, n2[t2].getGeometry())), this._ptInAreaLocation[t2];
        } }, { key: "toString", value: function() {
          var t2 = new st();
          t2.append("EdgeEndStar:   " + this.getCoordinate()), t2.append("\n");
          for (var e2 = this.iterator(); e2.hasNext(); ) {
            var n2 = e2.next();
            t2.append(n2), t2.append("\n");
          }
          return t2.toString();
        } }, { key: "computeEdgeEndLabels", value: function(t2) {
          for (var e2 = this.iterator(); e2.hasNext(); ) {
            e2.next().computeLabel(t2);
          }
        } }, { key: "computeLabelling", value: function(t2) {
          this.computeEdgeEndLabels(t2[0].getBoundaryNodeRule()), this.propagateSideLabels(0), this.propagateSideLabels(1);
          for (var e2 = [false, false], n2 = this.iterator(); n2.hasNext(); ) for (var i2 = n2.next().getLabel(), r2 = 0; r2 < 2; r2++) i2.isLine(r2) && i2.getLocation(r2) === H.BOUNDARY && (e2[r2] = true);
          for (var s2 = this.iterator(); s2.hasNext(); ) for (var a2 = s2.next(), o2 = a2.getLabel(), u5 = 0; u5 < 2; u5++) if (o2.isAnyNull(u5)) {
            var l2 = H.NONE;
            if (e2[u5]) l2 = H.EXTERIOR;
            else {
              var h2 = a2.getCoordinate();
              l2 = this.getLocation(u5, h2, t2);
            }
            o2.setAllLocationsIfNull(u5, l2);
          }
        } }, { key: "getDegree", value: function() {
          return this._edgeMap.size();
        } }, { key: "insertEdgeEnd", value: function(t2, e2) {
          this._edgeMap.put(t2, e2), this._edgeList = null;
        } }], [{ key: "constructor_", value: function() {
          this._edgeMap = new He(), this._edgeList = null, this._ptInAreaLocation = [H.NONE, H.NONE];
        } }]);
      })(), Vn = (function(t2) {
        function i2() {
          var t3;
          return n(this, i2), t3 = e(this, i2), i2.constructor_.apply(t3, arguments), t3;
        }
        return l(i2, t2), s(i2, [{ key: "linkResultDirectedEdges", value: function() {
          this.getResultAreaEdges();
          for (var t3 = null, e2 = null, n2 = this._SCANNING_FOR_INCOMING, i3 = 0; i3 < this._resultAreaEdgeList.size(); i3++) {
            var r2 = this._resultAreaEdgeList.get(i3), s2 = r2.getSym();
            if (r2.getLabel().isArea()) switch (null === t3 && r2.isInResult() && (t3 = r2), n2) {
              case this._SCANNING_FOR_INCOMING:
                if (!s2.isInResult()) continue;
                e2 = s2, n2 = this._LINKING_TO_OUTGOING;
                break;
              case this._LINKING_TO_OUTGOING:
                if (!r2.isInResult()) continue;
                e2.setNext(r2), n2 = this._SCANNING_FOR_INCOMING;
            }
          }
          if (n2 === this._LINKING_TO_OUTGOING) {
            if (null === t3) throw new gt("no outgoing dirEdge found", this.getCoordinate());
            G.isTrue(t3.isInResult(), "unable to link last incoming dirEdge"), e2.setNext(t3);
          }
        } }, { key: "insert", value: function(t3) {
          var e2 = t3;
          this.insertEdgeEnd(e2, e2);
        } }, { key: "getRightmostEdge", value: function() {
          var t3 = this.getEdges(), e2 = t3.size();
          if (e2 < 1) return null;
          var n2 = t3.get(0);
          if (1 === e2) return n2;
          var i3 = t3.get(e2 - 1), r2 = n2.getQuadrant(), s2 = i3.getQuadrant();
          return je.isNorthern(r2) && je.isNorthern(s2) ? n2 : je.isNorthern(r2) || je.isNorthern(s2) ? 0 !== n2.getDy() ? n2 : 0 !== i3.getDy() ? i3 : (G.shouldNeverReachHere("found two horizontal edges incident on node"), null) : i3;
        } }, { key: "print", value: function(t3) {
          mt.out.println("DirectedEdgeStar: " + this.getCoordinate());
          for (var e2 = this.iterator(); e2.hasNext(); ) {
            var n2 = e2.next();
            t3.print("out "), n2.print(t3), t3.println(), t3.print("in "), n2.getSym().print(t3), t3.println();
          }
        } }, { key: "getResultAreaEdges", value: function() {
          if (null !== this._resultAreaEdgeList) return this._resultAreaEdgeList;
          this._resultAreaEdgeList = new yt();
          for (var t3 = this.iterator(); t3.hasNext(); ) {
            var e2 = t3.next();
            (e2.isInResult() || e2.getSym().isInResult()) && this._resultAreaEdgeList.add(e2);
          }
          return this._resultAreaEdgeList;
        } }, { key: "updateLabelling", value: function(t3) {
          for (var e2 = this.iterator(); e2.hasNext(); ) {
            var n2 = e2.next().getLabel();
            n2.setAllLocationsIfNull(0, t3.getLocation(0)), n2.setAllLocationsIfNull(1, t3.getLocation(1));
          }
        } }, { key: "linkAllDirectedEdges", value: function() {
          this.getEdges();
          for (var t3 = null, e2 = null, n2 = this._edgeList.size() - 1; n2 >= 0; n2--) {
            var i3 = this._edgeList.get(n2), r2 = i3.getSym();
            null === e2 && (e2 = r2), null !== t3 && r2.setNext(t3), t3 = i3;
          }
          e2.setNext(t3);
        } }, { key: "computeDepths", value: function() {
          if (1 === arguments.length) {
            var t3 = arguments[0], e2 = this.findIndex(t3), n2 = t3.getDepth($.LEFT), i3 = t3.getDepth($.RIGHT), r2 = this.computeDepths(e2 + 1, this._edgeList.size(), n2);
            if (this.computeDepths(0, e2, r2) !== i3) throw new gt("depth mismatch at " + t3.getCoordinate());
          } else if (3 === arguments.length) {
            for (var s2 = arguments[1], a2 = arguments[2], o2 = arguments[0]; o2 < s2; o2++) {
              var u5 = this._edgeList.get(o2);
              u5.setEdgeDepths($.RIGHT, a2), a2 = u5.getDepth($.LEFT);
            }
            return a2;
          }
        } }, { key: "mergeSymLabels", value: function() {
          for (var t3 = this.iterator(); t3.hasNext(); ) {
            var e2 = t3.next();
            e2.getLabel().merge(e2.getSym().getLabel());
          }
        } }, { key: "linkMinimalDirectedEdges", value: function(t3) {
          for (var e2 = null, n2 = null, i3 = this._SCANNING_FOR_INCOMING, r2 = this._resultAreaEdgeList.size() - 1; r2 >= 0; r2--) {
            var s2 = this._resultAreaEdgeList.get(r2), a2 = s2.getSym();
            switch (null === e2 && s2.getEdgeRing() === t3 && (e2 = s2), i3) {
              case this._SCANNING_FOR_INCOMING:
                if (a2.getEdgeRing() !== t3) continue;
                n2 = a2, i3 = this._LINKING_TO_OUTGOING;
                break;
              case this._LINKING_TO_OUTGOING:
                if (s2.getEdgeRing() !== t3) continue;
                n2.setNextMin(s2), i3 = this._SCANNING_FOR_INCOMING;
            }
          }
          i3 === this._LINKING_TO_OUTGOING && (G.isTrue(null !== e2, "found null for first outgoing dirEdge"), G.isTrue(e2.getEdgeRing() === t3, "unable to link last incoming dirEdge"), n2.setNextMin(e2));
        } }, { key: "getOutgoingDegree", value: function() {
          if (0 === arguments.length) {
            for (var t3 = 0, e2 = this.iterator(); e2.hasNext(); ) {
              e2.next().isInResult() && t3++;
            }
            return t3;
          }
          if (1 === arguments.length) {
            for (var n2 = arguments[0], i3 = 0, r2 = this.iterator(); r2.hasNext(); ) {
              r2.next().getEdgeRing() === n2 && i3++;
            }
            return i3;
          }
        } }, { key: "getLabel", value: function() {
          return this._label;
        } }, { key: "findCoveredLineEdges", value: function() {
          for (var t3 = H.NONE, e2 = this.iterator(); e2.hasNext(); ) {
            var n2 = e2.next(), i3 = n2.getSym();
            if (!n2.isLineEdge()) {
              if (n2.isInResult()) {
                t3 = H.INTERIOR;
                break;
              }
              if (i3.isInResult()) {
                t3 = H.EXTERIOR;
                break;
              }
            }
          }
          if (t3 === H.NONE) return null;
          for (var r2 = t3, s2 = this.iterator(); s2.hasNext(); ) {
            var a2 = s2.next(), o2 = a2.getSym();
            a2.isLineEdge() ? a2.getEdge().setCovered(r2 === H.INTERIOR) : (a2.isInResult() && (r2 = H.EXTERIOR), o2.isInResult() && (r2 = H.INTERIOR));
          }
        } }, { key: "computeLabelling", value: function(t3) {
          f(i2, "computeLabelling", this, 1).call(this, t3), this._label = new Ae(H.NONE);
          for (var e2 = this.iterator(); e2.hasNext(); ) for (var n2 = e2.next().getEdge().getLabel(), r2 = 0; r2 < 2; r2++) {
            var s2 = n2.getLocation(r2);
            s2 !== H.INTERIOR && s2 !== H.BOUNDARY || this._label.setLocation(r2, H.INTERIOR);
          }
        } }], [{ key: "constructor_", value: function() {
          this._resultAreaEdgeList = null, this._label = null, this._SCANNING_FOR_INCOMING = 1, this._LINKING_TO_OUTGOING = 2;
        } }]);
      })(Un), Hn = (function(t2) {
        function i2() {
          return n(this, i2), e(this, i2);
        }
        return l(i2, t2), s(i2, [{ key: "createNode", value: function(t3) {
          return new qe(t3, new Vn());
        } }]);
      })(Je), Zn = (function() {
        function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }
        return s(t2, [{ key: "compareTo", value: function(e2) {
          var n2 = e2;
          return t2.compareOriented(this._pts, this._orientation, n2._pts, n2._orientation);
        } }, { key: "interfaces_", get: function() {
          return [x];
        } }], [{ key: "constructor_", value: function() {
          this._pts = null, this._orientation = null;
          var e2 = arguments[0];
          this._pts = e2, this._orientation = t2.orientation(e2);
        } }, { key: "orientation", value: function(t3) {
          return 1 === jt.increasingDirection(t3);
        } }, { key: "compareOriented", value: function(t3, e2, n2, i2) {
          for (var r2 = e2 ? 1 : -1, s2 = i2 ? 1 : -1, a2 = e2 ? t3.length : -1, o2 = i2 ? n2.length : -1, u5 = e2 ? 0 : t3.length - 1, l2 = i2 ? 0 : n2.length - 1; ; ) {
            var h2 = t3[u5].compareTo(n2[l2]);
            if (0 !== h2) return h2;
            var c2 = (u5 += r2) === a2, f2 = (l2 += s2) === o2;
            if (c2 && !f2) return -1;
            if (!c2 && f2) return 1;
            if (c2 && f2) return 0;
          }
        } }]);
      })(), jn = (function() {
        return s((function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }), [{ key: "print", value: function(t2) {
          t2.print("MULTILINESTRING ( ");
          for (var e2 = 0; e2 < this._edges.size(); e2++) {
            var n2 = this._edges.get(e2);
            e2 > 0 && t2.print(","), t2.print("(");
            for (var i2 = n2.getCoordinates(), r2 = 0; r2 < i2.length; r2++) r2 > 0 && t2.print(","), t2.print(i2[r2].x + " " + i2[r2].y);
            t2.println(")");
          }
          t2.print(")  ");
        } }, { key: "addAll", value: function(t2) {
          for (var e2 = t2.iterator(); e2.hasNext(); ) this.add(e2.next());
        } }, { key: "findEdgeIndex", value: function(t2) {
          for (var e2 = 0; e2 < this._edges.size(); e2++) if (this._edges.get(e2).equals(t2)) return e2;
          return -1;
        } }, { key: "iterator", value: function() {
          return this._edges.iterator();
        } }, { key: "getEdges", value: function() {
          return this._edges;
        } }, { key: "get", value: function(t2) {
          return this._edges.get(t2);
        } }, { key: "findEqualEdge", value: function(t2) {
          var e2 = new Zn(t2.getCoordinates());
          return this._ocaMap.get(e2);
        } }, { key: "add", value: function(t2) {
          this._edges.add(t2);
          var e2 = new Zn(t2.getCoordinates());
          this._ocaMap.put(e2, t2);
        } }], [{ key: "constructor_", value: function() {
          this._edges = new yt(), this._ocaMap = new He();
        } }]);
      })(), Wn = (function() {
        return s((function t2() {
          n(this, t2);
        }), [{ key: "processIntersections", value: function(t2, e2, n2, i2) {
        } }, { key: "isDone", value: function() {
        } }]);
      })(), Kn = (function() {
        function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }
        return s(t2, [{ key: "isTrivialIntersection", value: function(e2, n2, i2, r2) {
          if (e2 === i2 && 1 === this._li.getIntersectionNum()) {
            if (t2.isAdjacentSegments(n2, r2)) return true;
            if (e2.isClosed()) {
              var s2 = e2.size() - 1;
              if (0 === n2 && r2 === s2 || 0 === r2 && n2 === s2) return true;
            }
          }
          return false;
        } }, { key: "getProperIntersectionPoint", value: function() {
          return this._properIntersectionPoint;
        } }, { key: "hasProperInteriorIntersection", value: function() {
          return this._hasProperInterior;
        } }, { key: "getLineIntersector", value: function() {
          return this._li;
        } }, { key: "hasProperIntersection", value: function() {
          return this._hasProper;
        } }, { key: "processIntersections", value: function(t3, e2, n2, i2) {
          if (t3 === n2 && e2 === i2) return null;
          this.numTests++;
          var r2 = t3.getCoordinates()[e2], s2 = t3.getCoordinates()[e2 + 1], a2 = n2.getCoordinates()[i2], o2 = n2.getCoordinates()[i2 + 1];
          this._li.computeIntersection(r2, s2, a2, o2), this._li.hasIntersection() && (this.numIntersections++, this._li.isInteriorIntersection() && (this.numInteriorIntersections++, this._hasInterior = true), this.isTrivialIntersection(t3, e2, n2, i2) || (this._hasIntersection = true, t3.addIntersections(this._li, e2, 0), n2.addIntersections(this._li, i2, 1), this._li.isProper() && (this.numProperIntersections++, this._hasProper = true, this._hasProperInterior = true)));
        } }, { key: "hasIntersection", value: function() {
          return this._hasIntersection;
        } }, { key: "isDone", value: function() {
          return false;
        } }, { key: "hasInteriorIntersection", value: function() {
          return this._hasInterior;
        } }, { key: "interfaces_", get: function() {
          return [Wn];
        } }], [{ key: "constructor_", value: function() {
          this._hasIntersection = false, this._hasProper = false, this._hasProperInterior = false, this._hasInterior = false, this._properIntersectionPoint = null, this._li = null, this._isSelfIntersection = null, this.numIntersections = 0, this.numInteriorIntersections = 0, this.numProperIntersections = 0, this.numTests = 0;
          var t3 = arguments[0];
          this._li = t3;
        } }, { key: "isAdjacentSegments", value: function(t3, e2) {
          return 1 === Math.abs(t3 - e2);
        } }]);
      })(), Jn = (function() {
        return s((function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }), [{ key: "getSegmentIndex", value: function() {
          return this.segmentIndex;
        } }, { key: "getCoordinate", value: function() {
          return this.coord;
        } }, { key: "print", value: function(t2) {
          t2.print(this.coord), t2.print(" seg # = " + this.segmentIndex), t2.println(" dist = " + this.dist);
        } }, { key: "compareTo", value: function(t2) {
          var e2 = t2;
          return this.compare(e2.segmentIndex, e2.dist);
        } }, { key: "isEndPoint", value: function(t2) {
          return 0 === this.segmentIndex && 0 === this.dist || this.segmentIndex === t2;
        } }, { key: "toString", value: function() {
          return this.coord + " seg # = " + this.segmentIndex + " dist = " + this.dist;
        } }, { key: "getDistance", value: function() {
          return this.dist;
        } }, { key: "compare", value: function(t2, e2) {
          return this.segmentIndex < t2 ? -1 : this.segmentIndex > t2 ? 1 : this.dist < e2 ? -1 : this.dist > e2 ? 1 : 0;
        } }, { key: "interfaces_", get: function() {
          return [x];
        } }], [{ key: "constructor_", value: function() {
          this.coord = null, this.segmentIndex = null, this.dist = null;
          var t2 = arguments[0], e2 = arguments[1], n2 = arguments[2];
          this.coord = new X(t2), this.segmentIndex = e2, this.dist = n2;
        } }]);
      })(), Qn = (function() {
        return s((function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }), [{ key: "print", value: function(t2) {
          t2.println("Intersections:");
          for (var e2 = this.iterator(); e2.hasNext(); ) {
            e2.next().print(t2);
          }
        } }, { key: "iterator", value: function() {
          return this._nodeMap.values().iterator();
        } }, { key: "addSplitEdges", value: function(t2) {
          this.addEndpoints();
          for (var e2 = this.iterator(), n2 = e2.next(); e2.hasNext(); ) {
            var i2 = e2.next(), r2 = this.createSplitEdge(n2, i2);
            t2.add(r2), n2 = i2;
          }
        } }, { key: "addEndpoints", value: function() {
          var t2 = this.edge.pts.length - 1;
          this.add(this.edge.pts[0], 0, 0), this.add(this.edge.pts[t2], t2, 0);
        } }, { key: "createSplitEdge", value: function(t2, e2) {
          var n2 = e2.segmentIndex - t2.segmentIndex + 2, i2 = this.edge.pts[e2.segmentIndex], r2 = e2.dist > 0 || !e2.coord.equals2D(i2);
          r2 || n2--;
          var s2 = new Array(n2).fill(null), a2 = 0;
          s2[a2++] = new X(t2.coord);
          for (var o2 = t2.segmentIndex + 1; o2 <= e2.segmentIndex; o2++) s2[a2++] = this.edge.pts[o2];
          return r2 && (s2[a2] = e2.coord), new ri(s2, new Ae(this.edge._label));
        } }, { key: "add", value: function(t2, e2, n2) {
          var i2 = new Jn(t2, e2, n2), r2 = this._nodeMap.get(i2);
          return null !== r2 ? r2 : (this._nodeMap.put(i2, i2), i2);
        } }, { key: "isIntersection", value: function(t2) {
          for (var e2 = this.iterator(); e2.hasNext(); ) {
            if (e2.next().coord.equals(t2)) return true;
          }
          return false;
        } }], [{ key: "constructor_", value: function() {
          this._nodeMap = new He(), this.edge = null;
          var t2 = arguments[0];
          this.edge = t2;
        } }]);
      })(), $n = (function() {
        function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }
        return s(t2, [{ key: "isIntersects", value: function() {
          return !this.isDisjoint();
        } }, { key: "isCovers", value: function() {
          return (t2.isTrue(this._matrix[H.INTERIOR][H.INTERIOR]) || t2.isTrue(this._matrix[H.INTERIOR][H.BOUNDARY]) || t2.isTrue(this._matrix[H.BOUNDARY][H.INTERIOR]) || t2.isTrue(this._matrix[H.BOUNDARY][H.BOUNDARY])) && this._matrix[H.EXTERIOR][H.INTERIOR] === Lt.FALSE && this._matrix[H.EXTERIOR][H.BOUNDARY] === Lt.FALSE;
        } }, { key: "isCoveredBy", value: function() {
          return (t2.isTrue(this._matrix[H.INTERIOR][H.INTERIOR]) || t2.isTrue(this._matrix[H.INTERIOR][H.BOUNDARY]) || t2.isTrue(this._matrix[H.BOUNDARY][H.INTERIOR]) || t2.isTrue(this._matrix[H.BOUNDARY][H.BOUNDARY])) && this._matrix[H.INTERIOR][H.EXTERIOR] === Lt.FALSE && this._matrix[H.BOUNDARY][H.EXTERIOR] === Lt.FALSE;
        } }, { key: "set", value: function() {
          if (1 === arguments.length) for (var t3 = arguments[0], e2 = 0; e2 < t3.length; e2++) {
            var n2 = Math.trunc(e2 / 3), i2 = e2 % 3;
            this._matrix[n2][i2] = Lt.toDimensionValue(t3.charAt(e2));
          }
          else if (3 === arguments.length) {
            var r2 = arguments[0], s2 = arguments[1], a2 = arguments[2];
            this._matrix[r2][s2] = a2;
          }
        } }, { key: "isContains", value: function() {
          return t2.isTrue(this._matrix[H.INTERIOR][H.INTERIOR]) && this._matrix[H.EXTERIOR][H.INTERIOR] === Lt.FALSE && this._matrix[H.EXTERIOR][H.BOUNDARY] === Lt.FALSE;
        } }, { key: "setAtLeast", value: function() {
          if (1 === arguments.length) for (var t3 = arguments[0], e2 = 0; e2 < t3.length; e2++) {
            var n2 = Math.trunc(e2 / 3), i2 = e2 % 3;
            this.setAtLeast(n2, i2, Lt.toDimensionValue(t3.charAt(e2)));
          }
          else if (3 === arguments.length) {
            var r2 = arguments[0], s2 = arguments[1], a2 = arguments[2];
            this._matrix[r2][s2] < a2 && (this._matrix[r2][s2] = a2);
          }
        } }, { key: "setAtLeastIfValid", value: function(t3, e2, n2) {
          t3 >= 0 && e2 >= 0 && this.setAtLeast(t3, e2, n2);
        } }, { key: "isWithin", value: function() {
          return t2.isTrue(this._matrix[H.INTERIOR][H.INTERIOR]) && this._matrix[H.INTERIOR][H.EXTERIOR] === Lt.FALSE && this._matrix[H.BOUNDARY][H.EXTERIOR] === Lt.FALSE;
        } }, { key: "isTouches", value: function(e2, n2) {
          return e2 > n2 ? this.isTouches(n2, e2) : (e2 === Lt.A && n2 === Lt.A || e2 === Lt.L && n2 === Lt.L || e2 === Lt.L && n2 === Lt.A || e2 === Lt.P && n2 === Lt.A || e2 === Lt.P && n2 === Lt.L) && (this._matrix[H.INTERIOR][H.INTERIOR] === Lt.FALSE && (t2.isTrue(this._matrix[H.INTERIOR][H.BOUNDARY]) || t2.isTrue(this._matrix[H.BOUNDARY][H.INTERIOR]) || t2.isTrue(this._matrix[H.BOUNDARY][H.BOUNDARY])));
        } }, { key: "isOverlaps", value: function(e2, n2) {
          return e2 === Lt.P && n2 === Lt.P || e2 === Lt.A && n2 === Lt.A ? t2.isTrue(this._matrix[H.INTERIOR][H.INTERIOR]) && t2.isTrue(this._matrix[H.INTERIOR][H.EXTERIOR]) && t2.isTrue(this._matrix[H.EXTERIOR][H.INTERIOR]) : e2 === Lt.L && n2 === Lt.L && (1 === this._matrix[H.INTERIOR][H.INTERIOR] && t2.isTrue(this._matrix[H.INTERIOR][H.EXTERIOR]) && t2.isTrue(this._matrix[H.EXTERIOR][H.INTERIOR]));
        } }, { key: "isEquals", value: function(e2, n2) {
          return e2 === n2 && (t2.isTrue(this._matrix[H.INTERIOR][H.INTERIOR]) && this._matrix[H.INTERIOR][H.EXTERIOR] === Lt.FALSE && this._matrix[H.BOUNDARY][H.EXTERIOR] === Lt.FALSE && this._matrix[H.EXTERIOR][H.INTERIOR] === Lt.FALSE && this._matrix[H.EXTERIOR][H.BOUNDARY] === Lt.FALSE);
        } }, { key: "toString", value: function() {
          for (var t3 = new Jt("123456789"), e2 = 0; e2 < 3; e2++) for (var n2 = 0; n2 < 3; n2++) t3.setCharAt(3 * e2 + n2, Lt.toDimensionSymbol(this._matrix[e2][n2]));
          return t3.toString();
        } }, { key: "setAll", value: function(t3) {
          for (var e2 = 0; e2 < 3; e2++) for (var n2 = 0; n2 < 3; n2++) this._matrix[e2][n2] = t3;
        } }, { key: "get", value: function(t3, e2) {
          return this._matrix[t3][e2];
        } }, { key: "transpose", value: function() {
          var t3 = this._matrix[1][0];
          return this._matrix[1][0] = this._matrix[0][1], this._matrix[0][1] = t3, t3 = this._matrix[2][0], this._matrix[2][0] = this._matrix[0][2], this._matrix[0][2] = t3, t3 = this._matrix[2][1], this._matrix[2][1] = this._matrix[1][2], this._matrix[1][2] = t3, this;
        } }, { key: "matches", value: function(e2) {
          if (9 !== e2.length) throw new m("Should be length 9: " + e2);
          for (var n2 = 0; n2 < 3; n2++) for (var i2 = 0; i2 < 3; i2++) if (!t2.matches(this._matrix[n2][i2], e2.charAt(3 * n2 + i2))) return false;
          return true;
        } }, { key: "add", value: function(t3) {
          for (var e2 = 0; e2 < 3; e2++) for (var n2 = 0; n2 < 3; n2++) this.setAtLeast(e2, n2, t3.get(e2, n2));
        } }, { key: "isDisjoint", value: function() {
          return this._matrix[H.INTERIOR][H.INTERIOR] === Lt.FALSE && this._matrix[H.INTERIOR][H.BOUNDARY] === Lt.FALSE && this._matrix[H.BOUNDARY][H.INTERIOR] === Lt.FALSE && this._matrix[H.BOUNDARY][H.BOUNDARY] === Lt.FALSE;
        } }, { key: "isCrosses", value: function(e2, n2) {
          return e2 === Lt.P && n2 === Lt.L || e2 === Lt.P && n2 === Lt.A || e2 === Lt.L && n2 === Lt.A ? t2.isTrue(this._matrix[H.INTERIOR][H.INTERIOR]) && t2.isTrue(this._matrix[H.INTERIOR][H.EXTERIOR]) : e2 === Lt.L && n2 === Lt.P || e2 === Lt.A && n2 === Lt.P || e2 === Lt.A && n2 === Lt.L ? t2.isTrue(this._matrix[H.INTERIOR][H.INTERIOR]) && t2.isTrue(this._matrix[H.EXTERIOR][H.INTERIOR]) : e2 === Lt.L && n2 === Lt.L && 0 === this._matrix[H.INTERIOR][H.INTERIOR];
        } }, { key: "interfaces_", get: function() {
          return [I];
        } }], [{ key: "constructor_", value: function() {
          if (this._matrix = null, 0 === arguments.length) this._matrix = Array(3).fill().map((function() {
            return Array(3);
          })), this.setAll(Lt.FALSE);
          else if (1 === arguments.length) {
            if ("string" == typeof arguments[0]) {
              var e2 = arguments[0];
              t2.constructor_.call(this), this.set(e2);
            } else if (arguments[0] instanceof t2) {
              var n2 = arguments[0];
              t2.constructor_.call(this), this._matrix[H.INTERIOR][H.INTERIOR] = n2._matrix[H.INTERIOR][H.INTERIOR], this._matrix[H.INTERIOR][H.BOUNDARY] = n2._matrix[H.INTERIOR][H.BOUNDARY], this._matrix[H.INTERIOR][H.EXTERIOR] = n2._matrix[H.INTERIOR][H.EXTERIOR], this._matrix[H.BOUNDARY][H.INTERIOR] = n2._matrix[H.BOUNDARY][H.INTERIOR], this._matrix[H.BOUNDARY][H.BOUNDARY] = n2._matrix[H.BOUNDARY][H.BOUNDARY], this._matrix[H.BOUNDARY][H.EXTERIOR] = n2._matrix[H.BOUNDARY][H.EXTERIOR], this._matrix[H.EXTERIOR][H.INTERIOR] = n2._matrix[H.EXTERIOR][H.INTERIOR], this._matrix[H.EXTERIOR][H.BOUNDARY] = n2._matrix[H.EXTERIOR][H.BOUNDARY], this._matrix[H.EXTERIOR][H.EXTERIOR] = n2._matrix[H.EXTERIOR][H.EXTERIOR];
            }
          }
        } }, { key: "matches", value: function() {
          if (Number.isInteger(arguments[0]) && "string" == typeof arguments[1]) {
            var e2 = arguments[0], n2 = arguments[1];
            return n2 === Lt.SYM_DONTCARE || (n2 === Lt.SYM_TRUE && (e2 >= 0 || e2 === Lt.TRUE) || (n2 === Lt.SYM_FALSE && e2 === Lt.FALSE || (n2 === Lt.SYM_P && e2 === Lt.P || (n2 === Lt.SYM_L && e2 === Lt.L || n2 === Lt.SYM_A && e2 === Lt.A))));
          }
          if ("string" == typeof arguments[0] && "string" == typeof arguments[1]) {
            var i2 = arguments[1];
            return new t2(arguments[0]).matches(i2);
          }
        } }, { key: "isTrue", value: function(t3) {
          return t3 >= 0 || t3 === Lt.TRUE;
        } }]);
      })(), ti = (function() {
        function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }
        return s(t2, [{ key: "size", value: function() {
          return this._size;
        } }, { key: "addAll", value: function(t3) {
          return null === t3 || 0 === t3.length ? null : (this.ensureCapacity(this._size + t3.length), mt.arraycopy(t3, 0, this._data, this._size, t3.length), void (this._size += t3.length));
        } }, { key: "ensureCapacity", value: function(t3) {
          if (t3 <= this._data.length) return null;
          var e2 = Math.max(t3, 2 * this._data.length);
          this._data = At.copyOf(this._data, e2);
        } }, { key: "toArray", value: function() {
          var t3 = new Array(this._size).fill(null);
          return mt.arraycopy(this._data, 0, t3, 0, this._size), t3;
        } }, { key: "add", value: function(t3) {
          this.ensureCapacity(this._size + 1), this._data[this._size] = t3, ++this._size;
        } }], [{ key: "constructor_", value: function() {
          if (this._data = null, this._size = 0, 0 === arguments.length) t2.constructor_.call(this, 10);
          else if (1 === arguments.length) {
            var e2 = arguments[0];
            this._data = new Array(e2).fill(null);
          }
        } }]);
      })(), ei = (function() {
        function t2() {
          n(this, t2);
        }
        return s(t2, [{ key: "getChainStartIndices", value: function(t3) {
          var e2 = 0, n2 = new ti(Math.trunc(t3.length / 2));
          n2.add(e2);
          do {
            var i2 = this.findChainEnd(t3, e2);
            n2.add(i2), e2 = i2;
          } while (e2 < t3.length - 1);
          return n2.toArray();
        } }, { key: "findChainEnd", value: function(t3, e2) {
          for (var n2 = je.quadrant(t3[e2], t3[e2 + 1]), i2 = e2 + 1; i2 < t3.length; ) {
            if (je.quadrant(t3[i2 - 1], t3[i2]) !== n2) break;
            i2++;
          }
          return i2 - 1;
        } }, { key: "OLDgetChainStartIndices", value: function(e2) {
          var n2 = 0, i2 = new yt();
          i2.add(n2);
          do {
            var r2 = this.findChainEnd(e2, n2);
            i2.add(r2), n2 = r2;
          } while (n2 < e2.length - 1);
          return t2.toIntArray(i2);
        } }], [{ key: "toIntArray", value: function(t3) {
          for (var e2 = new Array(t3.size()).fill(null), n2 = 0; n2 < e2.length; n2++) e2[n2] = t3.get(n2).intValue();
          return e2;
        } }]);
      })(), ni = (function() {
        return s((function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }), [{ key: "getCoordinates", value: function() {
          return this.pts;
        } }, { key: "getMaxX", value: function(t2) {
          var e2 = this.pts[this.startIndex[t2]].x, n2 = this.pts[this.startIndex[t2 + 1]].x;
          return e2 > n2 ? e2 : n2;
        } }, { key: "getMinX", value: function(t2) {
          var e2 = this.pts[this.startIndex[t2]].x, n2 = this.pts[this.startIndex[t2 + 1]].x;
          return e2 < n2 ? e2 : n2;
        } }, { key: "computeIntersectsForChain", value: function() {
          if (4 === arguments.length) {
            var t2 = arguments[0], e2 = arguments[1], n2 = arguments[2], i2 = arguments[3];
            this.computeIntersectsForChain(this.startIndex[t2], this.startIndex[t2 + 1], e2, e2.startIndex[n2], e2.startIndex[n2 + 1], i2);
          } else if (6 === arguments.length) {
            var r2 = arguments[0], s2 = arguments[1], a2 = arguments[2], o2 = arguments[3], u5 = arguments[4], l2 = arguments[5];
            if (s2 - r2 == 1 && u5 - o2 == 1) return l2.addIntersections(this.e, r2, a2.e, o2), null;
            if (!this.overlaps(r2, s2, a2, o2, u5)) return null;
            var h2 = Math.trunc((r2 + s2) / 2), c2 = Math.trunc((o2 + u5) / 2);
            r2 < h2 && (o2 < c2 && this.computeIntersectsForChain(r2, h2, a2, o2, c2, l2), c2 < u5 && this.computeIntersectsForChain(r2, h2, a2, c2, u5, l2)), h2 < s2 && (o2 < c2 && this.computeIntersectsForChain(h2, s2, a2, o2, c2, l2), c2 < u5 && this.computeIntersectsForChain(h2, s2, a2, c2, u5, l2));
          }
        } }, { key: "overlaps", value: function(t2, e2, n2, i2, r2) {
          return U.intersects(this.pts[t2], this.pts[e2], n2.pts[i2], n2.pts[r2]);
        } }, { key: "getStartIndexes", value: function() {
          return this.startIndex;
        } }, { key: "computeIntersects", value: function(t2, e2) {
          for (var n2 = 0; n2 < this.startIndex.length - 1; n2++) for (var i2 = 0; i2 < t2.startIndex.length - 1; i2++) this.computeIntersectsForChain(n2, t2, i2, e2);
        } }], [{ key: "constructor_", value: function() {
          this.e = null, this.pts = null, this.startIndex = null;
          var t2 = arguments[0];
          this.e = t2, this.pts = t2.getCoordinates();
          var e2 = new ei();
          this.startIndex = e2.getChainStartIndices(this.pts);
        } }]);
      })(), ii = (function() {
        function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }
        return s(t2, [{ key: "getDepth", value: function(t3, e2) {
          return this._depth[t3][e2];
        } }, { key: "setDepth", value: function(t3, e2, n2) {
          this._depth[t3][e2] = n2;
        } }, { key: "isNull", value: function() {
          if (0 === arguments.length) {
            for (var e2 = 0; e2 < 2; e2++) for (var n2 = 0; n2 < 3; n2++) if (this._depth[e2][n2] !== t2.NULL_VALUE) return false;
            return true;
          }
          if (1 === arguments.length) {
            var i2 = arguments[0];
            return this._depth[i2][1] === t2.NULL_VALUE;
          }
          if (2 === arguments.length) {
            var r2 = arguments[0], s2 = arguments[1];
            return this._depth[r2][s2] === t2.NULL_VALUE;
          }
        } }, { key: "normalize", value: function() {
          for (var t3 = 0; t3 < 2; t3++) if (!this.isNull(t3)) {
            var e2 = this._depth[t3][1];
            this._depth[t3][2] < e2 && (e2 = this._depth[t3][2]), e2 < 0 && (e2 = 0);
            for (var n2 = 1; n2 < 3; n2++) {
              var i2 = 0;
              this._depth[t3][n2] > e2 && (i2 = 1), this._depth[t3][n2] = i2;
            }
          }
        } }, { key: "getDelta", value: function(t3) {
          return this._depth[t3][$.RIGHT] - this._depth[t3][$.LEFT];
        } }, { key: "getLocation", value: function(t3, e2) {
          return this._depth[t3][e2] <= 0 ? H.EXTERIOR : H.INTERIOR;
        } }, { key: "toString", value: function() {
          return "A: " + this._depth[0][1] + "," + this._depth[0][2] + " B: " + this._depth[1][1] + "," + this._depth[1][2];
        } }, { key: "add", value: function() {
          if (1 === arguments.length) for (var e2 = arguments[0], n2 = 0; n2 < 2; n2++) for (var i2 = 1; i2 < 3; i2++) {
            var r2 = e2.getLocation(n2, i2);
            r2 !== H.EXTERIOR && r2 !== H.INTERIOR || (this.isNull(n2, i2) ? this._depth[n2][i2] = t2.depthAtLocation(r2) : this._depth[n2][i2] += t2.depthAtLocation(r2));
          }
          else if (3 === arguments.length) {
            var s2 = arguments[0], a2 = arguments[1];
            arguments[2] === H.INTERIOR && this._depth[s2][a2]++;
          }
        } }], [{ key: "constructor_", value: function() {
          this._depth = Array(2).fill().map((function() {
            return Array(3);
          }));
          for (var e2 = 0; e2 < 2; e2++) for (var n2 = 0; n2 < 3; n2++) this._depth[e2][n2] = t2.NULL_VALUE;
        } }, { key: "depthAtLocation", value: function(e2) {
          return e2 === H.EXTERIOR ? 0 : e2 === H.INTERIOR ? 1 : t2.NULL_VALUE;
        } }]);
      })();
      ii.NULL_VALUE = -1;
      var ri = (function(t2) {
        function i2() {
          var t3;
          return n(this, i2), t3 = e(this, i2), i2.constructor_.apply(t3, arguments), t3;
        }
        return l(i2, t2), s(i2, [{ key: "getDepth", value: function() {
          return this._depth;
        } }, { key: "getCollapsedEdge", value: function() {
          var t3 = new Array(2).fill(null);
          return t3[0] = this.pts[0], t3[1] = this.pts[1], new i2(t3, Ae.toLineLabel(this._label));
        } }, { key: "isIsolated", value: function() {
          return this._isIsolated;
        } }, { key: "getCoordinates", value: function() {
          return this.pts;
        } }, { key: "setIsolated", value: function(t3) {
          this._isIsolated = t3;
        } }, { key: "setName", value: function(t3) {
          this._name = t3;
        } }, { key: "equals", value: function(t3) {
          if (!(t3 instanceof i2)) return false;
          var e2 = t3;
          if (this.pts.length !== e2.pts.length) return false;
          for (var n2 = true, r2 = true, s2 = this.pts.length, a2 = 0; a2 < this.pts.length; a2++) if (this.pts[a2].equals2D(e2.pts[a2]) || (n2 = false), this.pts[a2].equals2D(e2.pts[--s2]) || (r2 = false), !n2 && !r2) return false;
          return true;
        } }, { key: "getCoordinate", value: function() {
          if (0 === arguments.length) return this.pts.length > 0 ? this.pts[0] : null;
          if (1 === arguments.length) {
            var t3 = arguments[0];
            return this.pts[t3];
          }
        } }, { key: "print", value: function(t3) {
          t3.print("edge " + this._name + ": "), t3.print("LINESTRING (");
          for (var e2 = 0; e2 < this.pts.length; e2++) e2 > 0 && t3.print(","), t3.print(this.pts[e2].x + " " + this.pts[e2].y);
          t3.print(")  " + this._label + " " + this._depthDelta);
        } }, { key: "computeIM", value: function(t3) {
          i2.updateIM(this._label, t3);
        } }, { key: "isCollapsed", value: function() {
          return !!this._label.isArea() && (3 === this.pts.length && !!this.pts[0].equals(this.pts[2]));
        } }, { key: "isClosed", value: function() {
          return this.pts[0].equals(this.pts[this.pts.length - 1]);
        } }, { key: "getMaximumSegmentIndex", value: function() {
          return this.pts.length - 1;
        } }, { key: "getDepthDelta", value: function() {
          return this._depthDelta;
        } }, { key: "getNumPoints", value: function() {
          return this.pts.length;
        } }, { key: "printReverse", value: function(t3) {
          t3.print("edge " + this._name + ": ");
          for (var e2 = this.pts.length - 1; e2 >= 0; e2--) t3.print(this.pts[e2] + " ");
          t3.println("");
        } }, { key: "getMonotoneChainEdge", value: function() {
          return null === this._mce && (this._mce = new ni(this)), this._mce;
        } }, { key: "getEnvelope", value: function() {
          if (null === this._env) {
            this._env = new U();
            for (var t3 = 0; t3 < this.pts.length; t3++) this._env.expandToInclude(this.pts[t3]);
          }
          return this._env;
        } }, { key: "addIntersection", value: function(t3, e2, n2, i3) {
          var r2 = new X(t3.getIntersection(i3)), s2 = e2, a2 = t3.getEdgeDistance(n2, i3), o2 = s2 + 1;
          if (o2 < this.pts.length) {
            var u5 = this.pts[o2];
            r2.equals2D(u5) && (s2 = o2, a2 = 0);
          }
          this.eiList.add(r2, s2, a2);
        } }, { key: "toString", value: function() {
          var t3 = new Jt();
          t3.append("edge " + this._name + ": "), t3.append("LINESTRING (");
          for (var e2 = 0; e2 < this.pts.length; e2++) e2 > 0 && t3.append(","), t3.append(this.pts[e2].x + " " + this.pts[e2].y);
          return t3.append(")  " + this._label + " " + this._depthDelta), t3.toString();
        } }, { key: "isPointwiseEqual", value: function(t3) {
          if (this.pts.length !== t3.pts.length) return false;
          for (var e2 = 0; e2 < this.pts.length; e2++) if (!this.pts[e2].equals2D(t3.pts[e2])) return false;
          return true;
        } }, { key: "setDepthDelta", value: function(t3) {
          this._depthDelta = t3;
        } }, { key: "getEdgeIntersectionList", value: function() {
          return this.eiList;
        } }, { key: "addIntersections", value: function(t3, e2, n2) {
          for (var i3 = 0; i3 < t3.getIntersectionNum(); i3++) this.addIntersection(t3, e2, n2, i3);
        } }], [{ key: "constructor_", value: function() {
          if (this.pts = null, this._env = null, this.eiList = new Qn(this), this._name = null, this._mce = null, this._isIsolated = true, this._depth = new ii(), this._depthDelta = 0, 1 === arguments.length) {
            var t3 = arguments[0];
            i2.constructor_.call(this, t3, null);
          } else if (2 === arguments.length) {
            var e2 = arguments[0], n2 = arguments[1];
            this.pts = e2, this._label = n2;
          }
        } }, { key: "updateIM", value: function() {
          if (!(2 === arguments.length && arguments[1] instanceof $n && arguments[0] instanceof Ae)) return f(i2, "updateIM", this).apply(this, arguments);
          var t3 = arguments[0], e2 = arguments[1];
          e2.setAtLeastIfValid(t3.getLocation(0, $.ON), t3.getLocation(1, $.ON), 1), t3.isArea() && (e2.setAtLeastIfValid(t3.getLocation(0, $.LEFT), t3.getLocation(1, $.LEFT), 2), e2.setAtLeastIfValid(t3.getLocation(0, $.RIGHT), t3.getLocation(1, $.RIGHT), 2));
        } }]);
      })(Ge), si = (function() {
        function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }
        return s(t2, [{ key: "setWorkingPrecisionModel", value: function(t3) {
          this._workingPrecisionModel = t3;
        } }, { key: "insertUniqueEdge", value: function(e2) {
          var n2 = this._edgeList.findEqualEdge(e2);
          if (null !== n2) {
            var i2 = n2.getLabel(), r2 = e2.getLabel();
            n2.isPointwiseEqual(e2) || (r2 = new Ae(e2.getLabel())).flip(), i2.merge(r2);
            var s2 = t2.depthDelta(r2), a2 = n2.getDepthDelta() + s2;
            n2.setDepthDelta(a2);
          } else this._edgeList.add(e2), e2.setDepthDelta(t2.depthDelta(e2.getLabel()));
        } }, { key: "buildSubgraphs", value: function(t3, e2) {
          for (var n2 = new yt(), i2 = t3.iterator(); i2.hasNext(); ) {
            var r2 = i2.next(), s2 = r2.getRightmostCoordinate(), a2 = new Pn(n2).getDepth(s2);
            r2.computeDepth(a2), r2.findResultEdges(), n2.add(r2), e2.add(r2.getDirectedEdges(), r2.getNodes());
          }
        } }, { key: "createSubgraphs", value: function(t3) {
          for (var e2 = new yt(), n2 = t3.getNodes().iterator(); n2.hasNext(); ) {
            var i2 = n2.next();
            if (!i2.isVisited()) {
              var r2 = new _t();
              r2.create(i2), e2.add(r2);
            }
          }
          return an.sort(e2, an.reverseOrder()), e2;
        } }, { key: "createEmptyResultGeometry", value: function() {
          return this._geomFact.createPolygon();
        } }, { key: "getNoder", value: function(t3) {
          if (null !== this._workingNoder) return this._workingNoder;
          var e2 = new Cn(), n2 = new we();
          return n2.setPrecisionModel(t3), e2.setSegmentIntersector(new Kn(n2)), e2;
        } }, { key: "buffer", value: function(t3, e2) {
          var n2 = this._workingPrecisionModel;
          null === n2 && (n2 = t3.getPrecisionModel()), this._geomFact = t3.getFactory();
          var i2 = new An(n2, this._bufParams), r2 = new Yn(t3, e2, i2).getCurves();
          if (r2.size() <= 0) return this.createEmptyResultGeometry();
          this.computeNodedEdges(r2, n2), this._graph = new Qe(new Hn()), this._graph.addEdges(this._edgeList.getEdges());
          var s2 = this.createSubgraphs(this._graph), a2 = new $e(this._geomFact);
          this.buildSubgraphs(s2, a2);
          var o2 = a2.getPolygons();
          return o2.size() <= 0 ? this.createEmptyResultGeometry() : this._geomFact.buildGeometry(o2);
        } }, { key: "computeNodedEdges", value: function(t3, e2) {
          var n2 = this.getNoder(e2);
          n2.computeNodes(t3);
          for (var i2 = n2.getNodedSubstrings().iterator(); i2.hasNext(); ) {
            var r2 = i2.next(), s2 = r2.getCoordinates();
            if (2 !== s2.length || !s2[0].equals2D(s2[1])) {
              var a2 = r2.getData(), o2 = new ri(r2.getCoordinates(), new Ae(a2));
              this.insertUniqueEdge(o2);
            }
          }
        } }, { key: "setNoder", value: function(t3) {
          this._workingNoder = t3;
        } }], [{ key: "constructor_", value: function() {
          this._bufParams = null, this._workingPrecisionModel = null, this._workingNoder = null, this._geomFact = null, this._graph = null, this._edgeList = new jn();
          var t3 = arguments[0];
          this._bufParams = t3;
        } }, { key: "depthDelta", value: function(t3) {
          var e2 = t3.getLocation(0, $.LEFT), n2 = t3.getLocation(0, $.RIGHT);
          return e2 === H.INTERIOR && n2 === H.EXTERIOR ? 1 : e2 === H.EXTERIOR && n2 === H.INTERIOR ? -1 : 0;
        } }, { key: "convertSegStrings", value: function(t3) {
          for (var e2 = new ae(), n2 = new yt(); t3.hasNext(); ) {
            var i2 = t3.next(), r2 = e2.createLineString(i2.getCoordinates());
            n2.add(r2);
          }
          return e2.buildGeometry(n2);
        } }]);
      })(), ai = (function() {
        function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }
        return s(t2, [{ key: "rescale", value: function() {
          if (rt(arguments[0], Z)) for (var t3 = arguments[0].iterator(); t3.hasNext(); ) {
            var e2 = t3.next();
            this.rescale(e2.getCoordinates());
          }
          else if (arguments[0] instanceof Array) {
            for (var n2 = arguments[0], i2 = 0; i2 < n2.length; i2++) n2[i2].x = n2[i2].x / this._scaleFactor + this._offsetX, n2[i2].y = n2[i2].y / this._scaleFactor + this._offsetY;
            2 === n2.length && n2[0].equals2D(n2[1]) && mt.out.println(n2);
          }
        } }, { key: "scale", value: function() {
          if (rt(arguments[0], Z)) {
            for (var t3 = arguments[0], e2 = new yt(t3.size()), n2 = t3.iterator(); n2.hasNext(); ) {
              var i2 = n2.next();
              e2.add(new xn(this.scale(i2.getCoordinates()), i2.getData()));
            }
            return e2;
          }
          if (arguments[0] instanceof Array) {
            for (var r2 = arguments[0], s2 = new Array(r2.length).fill(null), a2 = 0; a2 < r2.length; a2++) s2[a2] = new X(Math.round((r2[a2].x - this._offsetX) * this._scaleFactor), Math.round((r2[a2].y - this._offsetY) * this._scaleFactor), r2[a2].getZ());
            return jt.removeRepeatedPoints(s2);
          }
        } }, { key: "isIntegerPrecision", value: function() {
          return 1 === this._scaleFactor;
        } }, { key: "getNodedSubstrings", value: function() {
          var t3 = this._noder.getNodedSubstrings();
          return this._isScaled && this.rescale(t3), t3;
        } }, { key: "computeNodes", value: function(t3) {
          var e2 = t3;
          this._isScaled && (e2 = this.scale(t3)), this._noder.computeNodes(e2);
        } }, { key: "interfaces_", get: function() {
          return [Sn];
        } }], [{ key: "constructor_", value: function() {
          if (this._noder = null, this._scaleFactor = null, this._offsetX = null, this._offsetY = null, this._isScaled = false, 2 === arguments.length) {
            var e2 = arguments[0], n2 = arguments[1];
            t2.constructor_.call(this, e2, n2, 0, 0);
          } else if (4 === arguments.length) {
            var i2 = arguments[0], r2 = arguments[1];
            this._noder = i2, this._scaleFactor = r2, this._isScaled = !this.isIntegerPrecision();
          }
        } }]);
      })(), oi = (function() {
        function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }
        return s(t2, [{ key: "checkEndPtVertexIntersections", value: function() {
          if (0 === arguments.length) for (var t3 = this._segStrings.iterator(); t3.hasNext(); ) {
            var e2 = t3.next().getCoordinates();
            this.checkEndPtVertexIntersections(e2[0], this._segStrings), this.checkEndPtVertexIntersections(e2[e2.length - 1], this._segStrings);
          }
          else if (2 === arguments.length) {
            for (var n2 = arguments[0], i2 = arguments[1].iterator(); i2.hasNext(); ) for (var r2 = i2.next().getCoordinates(), s2 = 1; s2 < r2.length - 1; s2++) if (r2[s2].equals(n2)) throw new D2("found endpt/interior pt intersection at index " + s2 + " :pt " + n2);
          }
        } }, { key: "checkInteriorIntersections", value: function() {
          if (0 === arguments.length) for (var t3 = this._segStrings.iterator(); t3.hasNext(); ) for (var e2 = t3.next(), n2 = this._segStrings.iterator(); n2.hasNext(); ) {
            var i2 = n2.next();
            this.checkInteriorIntersections(e2, i2);
          }
          else if (2 === arguments.length) for (var r2 = arguments[0], s2 = arguments[1], a2 = r2.getCoordinates(), o2 = s2.getCoordinates(), u5 = 0; u5 < a2.length - 1; u5++) for (var l2 = 0; l2 < o2.length - 1; l2++) this.checkInteriorIntersections(r2, u5, s2, l2);
          else if (4 === arguments.length) {
            var h2 = arguments[0], c2 = arguments[1], f2 = arguments[2], g2 = arguments[3];
            if (h2 === f2 && c2 === g2) return null;
            var v3 = h2.getCoordinates()[c2], y2 = h2.getCoordinates()[c2 + 1], d2 = f2.getCoordinates()[g2], _2 = f2.getCoordinates()[g2 + 1];
            if (this._li.computeIntersection(v3, y2, d2, _2), this._li.hasIntersection() && (this._li.isProper() || this.hasInteriorIntersection(this._li, v3, y2) || this.hasInteriorIntersection(this._li, d2, _2))) throw new D2("found non-noded intersection at " + v3 + "-" + y2 + " and " + d2 + "-" + _2);
          }
        } }, { key: "checkValid", value: function() {
          this.checkEndPtVertexIntersections(), this.checkInteriorIntersections(), this.checkCollapses();
        } }, { key: "checkCollapses", value: function() {
          if (0 === arguments.length) for (var t3 = this._segStrings.iterator(); t3.hasNext(); ) {
            var e2 = t3.next();
            this.checkCollapses(e2);
          }
          else if (1 === arguments.length) for (var n2 = arguments[0].getCoordinates(), i2 = 0; i2 < n2.length - 2; i2++) this.checkCollapse(n2[i2], n2[i2 + 1], n2[i2 + 2]);
        } }, { key: "hasInteriorIntersection", value: function(t3, e2, n2) {
          for (var i2 = 0; i2 < t3.getIntersectionNum(); i2++) {
            var r2 = t3.getIntersection(i2);
            if (!r2.equals(e2) && !r2.equals(n2)) return true;
          }
          return false;
        } }, { key: "checkCollapse", value: function(e2, n2, i2) {
          if (e2.equals(i2)) throw new D2("found non-noded collapse at " + t2.fact.createLineString([e2, n2, i2]));
        } }], [{ key: "constructor_", value: function() {
          this._li = new we(), this._segStrings = null;
          var t3 = arguments[0];
          this._segStrings = t3;
        } }]);
      })();
      oi.fact = new ae();
      var ui = (function() {
        function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }
        return s(t2, [{ key: "intersectsScaled", value: function(t3, e2) {
          var n2 = Math.min(t3.x, e2.x), i2 = Math.max(t3.x, e2.x), r2 = Math.min(t3.y, e2.y), s2 = Math.max(t3.y, e2.y), a2 = this._maxx < n2 || this._minx > i2 || this._maxy < r2 || this._miny > s2;
          if (a2) return false;
          var o2 = this.intersectsToleranceSquare(t3, e2);
          return G.isTrue(!(a2 && o2), "Found bad envelope test"), o2;
        } }, { key: "initCorners", value: function(t3) {
          var e2 = 0.5;
          this._minx = t3.x - e2, this._maxx = t3.x + e2, this._miny = t3.y - e2, this._maxy = t3.y + e2, this._corner[0] = new X(this._maxx, this._maxy), this._corner[1] = new X(this._minx, this._maxy), this._corner[2] = new X(this._minx, this._miny), this._corner[3] = new X(this._maxx, this._miny);
        } }, { key: "intersects", value: function(t3, e2) {
          return 1 === this._scaleFactor ? this.intersectsScaled(t3, e2) : (this.copyScaled(t3, this._p0Scaled), this.copyScaled(e2, this._p1Scaled), this.intersectsScaled(this._p0Scaled, this._p1Scaled));
        } }, { key: "scale", value: function(t3) {
          return Math.round(t3 * this._scaleFactor);
        } }, { key: "getCoordinate", value: function() {
          return this._originalPt;
        } }, { key: "copyScaled", value: function(t3, e2) {
          e2.x = this.scale(t3.x), e2.y = this.scale(t3.y);
        } }, { key: "getSafeEnvelope", value: function() {
          if (null === this._safeEnv) {
            var e2 = t2.SAFE_ENV_EXPANSION_FACTOR / this._scaleFactor;
            this._safeEnv = new U(this._originalPt.x - e2, this._originalPt.x + e2, this._originalPt.y - e2, this._originalPt.y + e2);
          }
          return this._safeEnv;
        } }, { key: "intersectsPixelClosure", value: function(t3, e2) {
          return this._li.computeIntersection(t3, e2, this._corner[0], this._corner[1]), !!this._li.hasIntersection() || (this._li.computeIntersection(t3, e2, this._corner[1], this._corner[2]), !!this._li.hasIntersection() || (this._li.computeIntersection(t3, e2, this._corner[2], this._corner[3]), !!this._li.hasIntersection() || (this._li.computeIntersection(t3, e2, this._corner[3], this._corner[0]), !!this._li.hasIntersection())));
        } }, { key: "intersectsToleranceSquare", value: function(t3, e2) {
          var n2 = false, i2 = false;
          return this._li.computeIntersection(t3, e2, this._corner[0], this._corner[1]), !!this._li.isProper() || (this._li.computeIntersection(t3, e2, this._corner[1], this._corner[2]), !!this._li.isProper() || (this._li.hasIntersection() && (n2 = true), this._li.computeIntersection(t3, e2, this._corner[2], this._corner[3]), !!this._li.isProper() || (this._li.hasIntersection() && (i2 = true), this._li.computeIntersection(t3, e2, this._corner[3], this._corner[0]), !!this._li.isProper() || (!(!n2 || !i2) || (!!t3.equals(this._pt) || !!e2.equals(this._pt))))));
        } }, { key: "addSnappedNode", value: function(t3, e2) {
          var n2 = t3.getCoordinate(e2), i2 = t3.getCoordinate(e2 + 1);
          return !!this.intersects(n2, i2) && (t3.addIntersection(this.getCoordinate(), e2), true);
        } }], [{ key: "constructor_", value: function() {
          this._li = null, this._pt = null, this._originalPt = null, this._ptScaled = null, this._p0Scaled = null, this._p1Scaled = null, this._scaleFactor = null, this._minx = null, this._maxx = null, this._miny = null, this._maxy = null, this._corner = new Array(4).fill(null), this._safeEnv = null;
          var t3 = arguments[0], e2 = arguments[1], n2 = arguments[2];
          if (this._originalPt = t3, this._pt = t3, this._scaleFactor = e2, this._li = n2, e2 <= 0) throw new m("Scale factor must be non-zero");
          1 !== e2 && (this._pt = new X(this.scale(t3.x), this.scale(t3.y)), this._p0Scaled = new X(), this._p1Scaled = new X()), this.initCorners(this._pt);
        } }]);
      })();
      ui.SAFE_ENV_EXPANSION_FACTOR = 0.75;
      var li = (function() {
        return s((function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }), [{ key: "select", value: function() {
          if (1 === arguments.length) ;
          else if (2 === arguments.length) {
            var t2 = arguments[1];
            arguments[0].getLineSegment(t2, this.selectedSegment), this.select(this.selectedSegment);
          }
        } }], [{ key: "constructor_", value: function() {
          this.selectedSegment = new In();
        } }]);
      })(), hi = (function() {
        return s((function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }), [{ key: "snap", value: function() {
          if (1 === arguments.length) {
            var t2 = arguments[0];
            return this.snap(t2, null, -1);
          }
          if (3 === arguments.length) {
            var e2 = arguments[0], i2 = arguments[1], r2 = arguments[2], a2 = e2.getSafeEnvelope(), o2 = new ci(e2, i2, r2);
            return this._index.query(a2, new ((function() {
              return s((function t3() {
                n(this, t3);
              }), [{ key: "interfaces_", get: function() {
                return [ln];
              } }, { key: "visitItem", value: function(t3) {
                t3.select(a2, o2);
              } }]);
            })())()), o2.isNodeAdded();
          }
        } }], [{ key: "constructor_", value: function() {
          this._index = null;
          var t2 = arguments[0];
          this._index = t2;
        } }]);
      })(), ci = (function(t2) {
        function i2() {
          var t3;
          return n(this, i2), t3 = e(this, i2), i2.constructor_.apply(t3, arguments), t3;
        }
        return l(i2, t2), s(i2, [{ key: "isNodeAdded", value: function() {
          return this._isNodeAdded;
        } }, { key: "select", value: function() {
          if (!(2 === arguments.length && Number.isInteger(arguments[1]) && arguments[0] instanceof Nn)) return f(i2, "select", this, 1).apply(this, arguments);
          var t3 = arguments[1], e2 = arguments[0].getContext();
          if (this._parentEdge === e2 && (t3 === this._hotPixelVertexIndex || t3 + 1 === this._hotPixelVertexIndex)) return null;
          this._isNodeAdded |= this._hotPixel.addSnappedNode(e2, t3);
        } }], [{ key: "constructor_", value: function() {
          this._hotPixel = null, this._parentEdge = null, this._hotPixelVertexIndex = null, this._isNodeAdded = false;
          var t3 = arguments[0], e2 = arguments[1], n2 = arguments[2];
          this._hotPixel = t3, this._parentEdge = e2, this._hotPixelVertexIndex = n2;
        } }]);
      })(li);
      hi.HotPixelSnapAction = ci;
      var fi = (function() {
        return s((function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }), [{ key: "processIntersections", value: function(t2, e2, n2, i2) {
          if (t2 === n2 && e2 === i2) return null;
          var r2 = t2.getCoordinates()[e2], s2 = t2.getCoordinates()[e2 + 1], a2 = n2.getCoordinates()[i2], o2 = n2.getCoordinates()[i2 + 1];
          if (this._li.computeIntersection(r2, s2, a2, o2), this._li.hasIntersection() && this._li.isInteriorIntersection()) {
            for (var u5 = 0; u5 < this._li.getIntersectionNum(); u5++) this._interiorIntersections.add(this._li.getIntersection(u5));
            t2.addIntersections(this._li, e2, 0), n2.addIntersections(this._li, i2, 1);
          }
        } }, { key: "isDone", value: function() {
          return false;
        } }, { key: "getInteriorIntersections", value: function() {
          return this._interiorIntersections;
        } }, { key: "interfaces_", get: function() {
          return [Wn];
        } }], [{ key: "constructor_", value: function() {
          this._li = null, this._interiorIntersections = null;
          var t2 = arguments[0];
          this._li = t2, this._interiorIntersections = new yt();
        } }]);
      })(), gi = (function() {
        return s((function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }), [{ key: "checkCorrectness", value: function(t2) {
          var e2 = xn.getNodedSubstrings(t2), n2 = new oi(e2);
          try {
            n2.checkValid();
          } catch (t3) {
            if (!(t3 instanceof p)) throw t3;
            t3.printStackTrace();
          }
        } }, { key: "getNodedSubstrings", value: function() {
          return xn.getNodedSubstrings(this._nodedSegStrings);
        } }, { key: "snapRound", value: function(t2, e2) {
          var n2 = this.findInteriorIntersections(t2, e2);
          this.computeIntersectionSnaps(n2), this.computeVertexSnaps(t2);
        } }, { key: "findInteriorIntersections", value: function(t2, e2) {
          var n2 = new fi(e2);
          return this._noder.setSegmentIntersector(n2), this._noder.computeNodes(t2), n2.getInteriorIntersections();
        } }, { key: "computeVertexSnaps", value: function() {
          if (rt(arguments[0], Z)) for (var t2 = arguments[0].iterator(); t2.hasNext(); ) {
            var e2 = t2.next();
            this.computeVertexSnaps(e2);
          }
          else if (arguments[0] instanceof xn) for (var n2 = arguments[0], i2 = n2.getCoordinates(), r2 = 0; r2 < i2.length; r2++) {
            var s2 = new ui(i2[r2], this._scaleFactor, this._li);
            this._pointSnapper.snap(s2, n2, r2) && n2.addIntersection(i2[r2], r2);
          }
        } }, { key: "computeNodes", value: function(t2) {
          this._nodedSegStrings = t2, this._noder = new Cn(), this._pointSnapper = new hi(this._noder.getIndex()), this.snapRound(t2, this._li);
        } }, { key: "computeIntersectionSnaps", value: function(t2) {
          for (var e2 = t2.iterator(); e2.hasNext(); ) {
            var n2 = e2.next(), i2 = new ui(n2, this._scaleFactor, this._li);
            this._pointSnapper.snap(i2);
          }
        } }, { key: "interfaces_", get: function() {
          return [Sn];
        } }], [{ key: "constructor_", value: function() {
          this._pm = null, this._li = null, this._scaleFactor = null, this._noder = null, this._pointSnapper = null, this._nodedSegStrings = null;
          var t2 = arguments[0];
          this._pm = t2, this._li = new we(), this._li.setPrecisionModel(t2), this._scaleFactor = t2.getScale();
        } }]);
      })(), vi = (function() {
        function t2() {
          n(this, t2), t2.constructor_.apply(this, arguments);
        }
        return s(t2, [{ key: "bufferFixedPrecision", value: function(t3) {
          var e2 = new ai(new gi(new ie(1)), t3.getScale()), n2 = new si(this._bufParams);
          n2.setWorkingPrecisionModel(t3), n2.setNoder(e2), this._resultGeometry = n2.buffer(this._argGeom, this._distance);
        } }, { key: "bufferReducedPrecision", value: function() {
          if (0 === arguments.length) {
            for (var e2 = t2.MAX_PRECISION_DIGITS; e2 >= 0; e2--) {
              try {
                this.bufferReducedPrecision(e2);
              } catch (t3) {
                if (!(t3 instanceof gt)) throw t3;
                this._saveException = t3;
              }
              if (null !== this._resultGeometry) return null;
            }
            throw this._saveException;
          }
          if (1 === arguments.length) {
            var n2 = arguments[0], i2 = t2.precisionScaleFactor(this._argGeom, this._distance, n2), r2 = new ie(i2);
            this.bufferFixedPrecision(r2);
          }
        } }, { key: "computeGeometry", value: function() {
          if (this.bufferOriginalPrecision(), null !== this._resultGeometry) return null;
          var t3 = this._argGeom.getFactory().getPrecisionModel();
          t3.getType() === ie.FIXED ? this.bufferFixedPrecision(t3) : this.bufferReducedPrecision();
        } }, { key: "setQuadrantSegments", value: function(t3) {
          this._bufParams.setQuadrantSegments(t3);
        } }, { key: "bufferOriginalPrecision", value: function() {
          try {
            var t3 = new si(this._bufParams);
            this._resultGeometry = t3.buffer(this._argGeom, this._distance);
          } catch (t4) {
            if (!(t4 instanceof D2)) throw t4;
            this._saveException = t4;
          }
        } }, { key: "getResultGeometry", value: function(t3) {
          return this._distance = t3, this.computeGeometry(), this._resultGeometry;
        } }, { key: "setEndCapStyle", value: function(t3) {
          this._bufParams.setEndCapStyle(t3);
        } }], [{ key: "constructor_", value: function() {
          if (this._argGeom = null, this._distance = null, this._bufParams = new _(), this._resultGeometry = null, this._saveException = null, 1 === arguments.length) {
            var t3 = arguments[0];
            this._argGeom = t3;
          } else if (2 === arguments.length) {
            var e2 = arguments[0], n2 = arguments[1];
            this._argGeom = e2, this._bufParams = n2;
          }
        } }, { key: "bufferOp", value: function() {
          if (2 === arguments.length) {
            var e2 = arguments[1];
            return new t2(arguments[0]).getResultGeometry(e2);
          }
          if (3 === arguments.length) {
            if (Number.isInteger(arguments[2]) && arguments[0] instanceof V && "number" == typeof arguments[1]) {
              var n2 = arguments[1], i2 = arguments[2], r2 = new t2(arguments[0]);
              return r2.setQuadrantSegments(i2), r2.getResultGeometry(n2);
            }
            if (arguments[2] instanceof _ && arguments[0] instanceof V && "number" == typeof arguments[1]) {
              var s2 = arguments[1];
              return new t2(arguments[0], arguments[2]).getResultGeometry(s2);
            }
          } else if (4 === arguments.length) {
            var a2 = arguments[1], o2 = arguments[2], u5 = arguments[3], l2 = new t2(arguments[0]);
            return l2.setQuadrantSegments(o2), l2.setEndCapStyle(u5), l2.getResultGeometry(a2);
          }
        } }, { key: "precisionScaleFactor", value: function(t3, e2, n2) {
          var i2 = t3.getEnvelopeInternal(), r2 = kt.max(Math.abs(i2.getMaxX()), Math.abs(i2.getMaxY()), Math.abs(i2.getMinX()), Math.abs(i2.getMinY())) + 2 * (e2 > 0 ? e2 : 0), s2 = n2 - Math.trunc(Math.log(r2) / Math.log(10) + 1);
          return Math.pow(10, s2);
        } }]);
      })();
      vi.CAP_ROUND = _.CAP_ROUND, vi.CAP_BUTT = _.CAP_FLAT, vi.CAP_FLAT = _.CAP_FLAT, vi.CAP_SQUARE = _.CAP_SQUARE, vi.MAX_PRECISION_DIGITS = 12;
      var yi = ["Point", "MultiPoint", "LineString", "MultiLineString", "Polygon", "MultiPolygon"], di = (function() {
        return s((function t2(e2) {
          n(this, t2), this.geometryFactory = e2 || new ae();
        }), [{ key: "read", value: function(t2) {
          var e2, n2 = (e2 = "string" == typeof t2 ? JSON.parse(t2) : t2).type;
          if (!_i[n2]) throw new Error("Unknown GeoJSON type: " + e2.type);
          return -1 !== yi.indexOf(n2) ? _i[n2].call(this, e2.coordinates) : "GeometryCollection" === n2 ? _i[n2].call(this, e2.geometries) : _i[n2].call(this, e2);
        } }, { key: "write", value: function(t2) {
          var e2 = t2.getGeometryType();
          if (!pi[e2]) throw new Error("Geometry is not supported");
          return pi[e2].call(this, t2);
        } }]);
      })(), _i = { Feature: function(t2) {
        var e2 = {};
        for (var n2 in t2) e2[n2] = t2[n2];
        if (t2.geometry) {
          var i2 = t2.geometry.type;
          if (!_i[i2]) throw new Error("Unknown GeoJSON type: " + t2.type);
          e2.geometry = this.read(t2.geometry);
        }
        return t2.bbox && (e2.bbox = _i.bbox.call(this, t2.bbox)), e2;
      }, FeatureCollection: function(t2) {
        var e2 = {};
        if (t2.features) {
          e2.features = [];
          for (var n2 = 0; n2 < t2.features.length; ++n2) e2.features.push(this.read(t2.features[n2]));
        }
        return t2.bbox && (e2.bbox = this.parse.bbox.call(this, t2.bbox)), e2;
      }, coordinates: function(t2) {
        for (var e2 = [], n2 = 0; n2 < t2.length; ++n2) {
          var r2 = t2[n2];
          e2.push(i(X, g(r2)));
        }
        return e2;
      }, bbox: function(t2) {
        return this.geometryFactory.createLinearRing([new X(t2[0], t2[1]), new X(t2[2], t2[1]), new X(t2[2], t2[3]), new X(t2[0], t2[3]), new X(t2[0], t2[1])]);
      }, Point: function(t2) {
        var e2 = i(X, g(t2));
        return this.geometryFactory.createPoint(e2);
      }, MultiPoint: function(t2) {
        for (var e2 = [], n2 = 0; n2 < t2.length; ++n2) e2.push(_i.Point.call(this, t2[n2]));
        return this.geometryFactory.createMultiPoint(e2);
      }, LineString: function(t2) {
        var e2 = _i.coordinates.call(this, t2);
        return this.geometryFactory.createLineString(e2);
      }, MultiLineString: function(t2) {
        for (var e2 = [], n2 = 0; n2 < t2.length; ++n2) e2.push(_i.LineString.call(this, t2[n2]));
        return this.geometryFactory.createMultiLineString(e2);
      }, Polygon: function(t2) {
        for (var e2 = _i.coordinates.call(this, t2[0]), n2 = this.geometryFactory.createLinearRing(e2), i2 = [], r2 = 1; r2 < t2.length; ++r2) {
          var s2 = t2[r2], a2 = _i.coordinates.call(this, s2), o2 = this.geometryFactory.createLinearRing(a2);
          i2.push(o2);
        }
        return this.geometryFactory.createPolygon(n2, i2);
      }, MultiPolygon: function(t2) {
        for (var e2 = [], n2 = 0; n2 < t2.length; ++n2) {
          var i2 = t2[n2];
          e2.push(_i.Polygon.call(this, i2));
        }
        return this.geometryFactory.createMultiPolygon(e2);
      }, GeometryCollection: function(t2) {
        for (var e2 = [], n2 = 0; n2 < t2.length; ++n2) {
          var i2 = t2[n2];
          e2.push(this.read(i2));
        }
        return this.geometryFactory.createGeometryCollection(e2);
      } }, pi = { coordinate: function(t2) {
        var e2 = [t2.x, t2.y];
        return t2.z && e2.push(t2.z), t2.m && e2.push(t2.m), e2;
      }, Point: function(t2) {
        return { type: "Point", coordinates: pi.coordinate.call(this, t2.getCoordinate()) };
      }, MultiPoint: function(t2) {
        for (var e2 = [], n2 = 0; n2 < t2._geometries.length; ++n2) {
          var i2 = t2._geometries[n2], r2 = pi.Point.call(this, i2);
          e2.push(r2.coordinates);
        }
        return { type: "MultiPoint", coordinates: e2 };
      }, LineString: function(t2) {
        for (var e2 = [], n2 = t2.getCoordinates(), i2 = 0; i2 < n2.length; ++i2) {
          var r2 = n2[i2];
          e2.push(pi.coordinate.call(this, r2));
        }
        return { type: "LineString", coordinates: e2 };
      }, MultiLineString: function(t2) {
        for (var e2 = [], n2 = 0; n2 < t2._geometries.length; ++n2) {
          var i2 = t2._geometries[n2], r2 = pi.LineString.call(this, i2);
          e2.push(r2.coordinates);
        }
        return { type: "MultiLineString", coordinates: e2 };
      }, Polygon: function(t2) {
        var e2 = [], n2 = pi.LineString.call(this, t2._shell);
        e2.push(n2.coordinates);
        for (var i2 = 0; i2 < t2._holes.length; ++i2) {
          var r2 = t2._holes[i2], s2 = pi.LineString.call(this, r2);
          e2.push(s2.coordinates);
        }
        return { type: "Polygon", coordinates: e2 };
      }, MultiPolygon: function(t2) {
        for (var e2 = [], n2 = 0; n2 < t2._geometries.length; ++n2) {
          var i2 = t2._geometries[n2], r2 = pi.Polygon.call(this, i2);
          e2.push(r2.coordinates);
        }
        return { type: "MultiPolygon", coordinates: e2 };
      }, GeometryCollection: function(t2) {
        for (var e2 = [], n2 = 0; n2 < t2._geometries.length; ++n2) {
          var i2 = t2._geometries[n2], r2 = i2.getGeometryType();
          e2.push(pi[r2].call(this, i2));
        }
        return { type: "GeometryCollection", geometries: e2 };
      } };
      return { BufferOp: vi, GeoJSONReader: (function() {
        return s((function t2(e2) {
          n(this, t2), this.parser = new di(e2 || new ae());
        }), [{ key: "read", value: function(t2) {
          return this.parser.read(t2);
        } }]);
      })(), GeoJSONWriter: (function() {
        return s((function t2() {
          n(this, t2), this.parser = new di(this.geometryFactory);
        }), [{ key: "write", value: function(t2) {
          return this.parser.write(t2);
        } }]);
      })() };
    }));
  }
});

// node_modules/d3-array/dist/d3-array.js
var require_d3_array = __commonJS({
  "node_modules/d3-array/dist/d3-array.js"(exports, module) {
    (function(global, factory) {
      typeof exports === "object" && typeof module !== "undefined" ? factory(exports) : typeof define === "function" && define.amd ? define(["exports"], factory) : (global = typeof globalThis !== "undefined" ? globalThis : global || self, factory(global.d3 = global.d3 || {}));
    })(exports, (function(exports2) {
      "use strict";
      function ascending(a, b) {
        return a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
      }
      function bisector(f) {
        let delta = f;
        let compare = f;
        if (f.length === 1) {
          delta = (d, x) => f(d) - x;
          compare = ascendingComparator(f);
        }
        function left(a, x, lo, hi) {
          if (lo == null) lo = 0;
          if (hi == null) hi = a.length;
          while (lo < hi) {
            const mid = lo + hi >>> 1;
            if (compare(a[mid], x) < 0) lo = mid + 1;
            else hi = mid;
          }
          return lo;
        }
        function right(a, x, lo, hi) {
          if (lo == null) lo = 0;
          if (hi == null) hi = a.length;
          while (lo < hi) {
            const mid = lo + hi >>> 1;
            if (compare(a[mid], x) > 0) hi = mid;
            else lo = mid + 1;
          }
          return lo;
        }
        function center2(a, x, lo, hi) {
          if (lo == null) lo = 0;
          if (hi == null) hi = a.length;
          const i = left(a, x, lo, hi - 1);
          return i > lo && delta(a[i - 1], x) > -delta(a[i], x) ? i - 1 : i;
        }
        return { left, center: center2, right };
      }
      function ascendingComparator(f) {
        return (d, x) => ascending(f(d), x);
      }
      function number(x) {
        return x === null ? NaN : +x;
      }
      function* numbers(values, valueof) {
        if (valueof === void 0) {
          for (let value of values) {
            if (value != null && (value = +value) >= value) {
              yield value;
            }
          }
        } else {
          let index2 = -1;
          for (let value of values) {
            if ((value = valueof(value, ++index2, values)) != null && (value = +value) >= value) {
              yield value;
            }
          }
        }
      }
      const ascendingBisect = bisector(ascending);
      const bisectRight = ascendingBisect.right;
      const bisectLeft = ascendingBisect.left;
      const bisectCenter = bisector(number).center;
      function count(values, valueof) {
        let count2 = 0;
        if (valueof === void 0) {
          for (let value of values) {
            if (value != null && (value = +value) >= value) {
              ++count2;
            }
          }
        } else {
          let index2 = -1;
          for (let value of values) {
            if ((value = valueof(value, ++index2, values)) != null && (value = +value) >= value) {
              ++count2;
            }
          }
        }
        return count2;
      }
      function length$1(array2) {
        return array2.length | 0;
      }
      function empty(length2) {
        return !(length2 > 0);
      }
      function arrayify(values) {
        return typeof values !== "object" || "length" in values ? values : Array.from(values);
      }
      function reducer(reduce2) {
        return (values) => reduce2(...values);
      }
      function cross(...values) {
        const reduce2 = typeof values[values.length - 1] === "function" && reducer(values.pop());
        values = values.map(arrayify);
        const lengths = values.map(length$1);
        const j = values.length - 1;
        const index2 = new Array(j + 1).fill(0);
        const product = [];
        if (j < 0 || lengths.some(empty)) return product;
        while (true) {
          product.push(index2.map((j2, i2) => values[i2][j2]));
          let i = j;
          while (++index2[i] === lengths[i]) {
            if (i === 0) return reduce2 ? product.map(reduce2) : product;
            index2[i--] = 0;
          }
        }
      }
      function cumsum(values, valueof) {
        var sum3 = 0, index2 = 0;
        return Float64Array.from(values, valueof === void 0 ? (v2) => sum3 += +v2 || 0 : (v2) => sum3 += +valueof(v2, index2++, values) || 0);
      }
      function descending(a, b) {
        return b < a ? -1 : b > a ? 1 : b >= a ? 0 : NaN;
      }
      function variance(values, valueof) {
        let count2 = 0;
        let delta;
        let mean2 = 0;
        let sum3 = 0;
        if (valueof === void 0) {
          for (let value of values) {
            if (value != null && (value = +value) >= value) {
              delta = value - mean2;
              mean2 += delta / ++count2;
              sum3 += delta * (value - mean2);
            }
          }
        } else {
          let index2 = -1;
          for (let value of values) {
            if ((value = valueof(value, ++index2, values)) != null && (value = +value) >= value) {
              delta = value - mean2;
              mean2 += delta / ++count2;
              sum3 += delta * (value - mean2);
            }
          }
        }
        if (count2 > 1) return sum3 / (count2 - 1);
      }
      function deviation(values, valueof) {
        const v2 = variance(values, valueof);
        return v2 ? Math.sqrt(v2) : v2;
      }
      function extent(values, valueof) {
        let min2;
        let max2;
        if (valueof === void 0) {
          for (const value of values) {
            if (value != null) {
              if (min2 === void 0) {
                if (value >= value) min2 = max2 = value;
              } else {
                if (min2 > value) min2 = value;
                if (max2 < value) max2 = value;
              }
            }
          }
        } else {
          let index2 = -1;
          for (let value of values) {
            if ((value = valueof(value, ++index2, values)) != null) {
              if (min2 === void 0) {
                if (value >= value) min2 = max2 = value;
              } else {
                if (min2 > value) min2 = value;
                if (max2 < value) max2 = value;
              }
            }
          }
        }
        return [min2, max2];
      }
      class Adder {
        constructor() {
          this._partials = new Float64Array(32);
          this._n = 0;
        }
        add(x) {
          const p = this._partials;
          let i = 0;
          for (let j = 0; j < this._n && j < 32; j++) {
            const y = p[j], hi = x + y, lo = Math.abs(x) < Math.abs(y) ? x - (hi - y) : y - (hi - x);
            if (lo) p[i++] = lo;
            x = hi;
          }
          p[i] = x;
          this._n = i + 1;
          return this;
        }
        valueOf() {
          const p = this._partials;
          let n = this._n, x, y, lo, hi = 0;
          if (n > 0) {
            hi = p[--n];
            while (n > 0) {
              x = hi;
              y = p[--n];
              hi = x + y;
              lo = y - (hi - x);
              if (lo) break;
            }
            if (n > 0 && (lo < 0 && p[n - 1] < 0 || lo > 0 && p[n - 1] > 0)) {
              y = lo * 2;
              x = hi + y;
              if (y == x - hi) hi = x;
            }
          }
          return hi;
        }
      }
      function fsum(values, valueof) {
        const adder = new Adder();
        if (valueof === void 0) {
          for (let value of values) {
            if (value = +value) {
              adder.add(value);
            }
          }
        } else {
          let index2 = -1;
          for (let value of values) {
            if (value = +valueof(value, ++index2, values)) {
              adder.add(value);
            }
          }
        }
        return +adder;
      }
      function fcumsum(values, valueof) {
        const adder = new Adder();
        let index2 = -1;
        return Float64Array.from(
          values,
          valueof === void 0 ? (v2) => adder.add(+v2 || 0) : (v2) => adder.add(+valueof(v2, ++index2, values) || 0)
        );
      }
      class InternMap extends Map {
        constructor(entries, key = keyof) {
          super();
          Object.defineProperties(this, { _intern: { value: /* @__PURE__ */ new Map() }, _key: { value: key } });
          if (entries != null) for (const [key2, value] of entries) this.set(key2, value);
        }
        get(key) {
          return super.get(intern_get(this, key));
        }
        has(key) {
          return super.has(intern_get(this, key));
        }
        set(key, value) {
          return super.set(intern_set(this, key), value);
        }
        delete(key) {
          return super.delete(intern_delete(this, key));
        }
      }
      class InternSet extends Set {
        constructor(values, key = keyof) {
          super();
          Object.defineProperties(this, { _intern: { value: /* @__PURE__ */ new Map() }, _key: { value: key } });
          if (values != null) for (const value of values) this.add(value);
        }
        has(value) {
          return super.has(intern_get(this, value));
        }
        add(value) {
          return super.add(intern_set(this, value));
        }
        delete(value) {
          return super.delete(intern_delete(this, value));
        }
      }
      function intern_get({ _intern, _key }, value) {
        const key = _key(value);
        return _intern.has(key) ? _intern.get(key) : value;
      }
      function intern_set({ _intern, _key }, value) {
        const key = _key(value);
        if (_intern.has(key)) return _intern.get(key);
        _intern.set(key, value);
        return value;
      }
      function intern_delete({ _intern, _key }, value) {
        const key = _key(value);
        if (_intern.has(key)) {
          value = _intern.get(value);
          _intern.delete(key);
        }
        return value;
      }
      function keyof(value) {
        return value !== null && typeof value === "object" ? value.valueOf() : value;
      }
      function identity(x) {
        return x;
      }
      function group(values, ...keys) {
        return nest(values, identity, identity, keys);
      }
      function groups(values, ...keys) {
        return nest(values, Array.from, identity, keys);
      }
      function rollup(values, reduce2, ...keys) {
        return nest(values, identity, reduce2, keys);
      }
      function rollups(values, reduce2, ...keys) {
        return nest(values, Array.from, reduce2, keys);
      }
      function index(values, ...keys) {
        return nest(values, identity, unique, keys);
      }
      function indexes(values, ...keys) {
        return nest(values, Array.from, unique, keys);
      }
      function unique(values) {
        if (values.length !== 1) throw new Error("duplicate key");
        return values[0];
      }
      function nest(values, map2, reduce2, keys) {
        return (function regroup(values2, i) {
          if (i >= keys.length) return reduce2(values2);
          const groups2 = new InternMap();
          const keyof2 = keys[i++];
          let index2 = -1;
          for (const value of values2) {
            const key = keyof2(value, ++index2, values2);
            const group2 = groups2.get(key);
            if (group2) group2.push(value);
            else groups2.set(key, [value]);
          }
          for (const [key, values3] of groups2) {
            groups2.set(key, regroup(values3, i));
          }
          return map2(groups2);
        })(values, 0);
      }
      function permute(source, keys) {
        return Array.from(keys, (key) => source[key]);
      }
      function sort(values, ...F) {
        if (typeof values[Symbol.iterator] !== "function") throw new TypeError("values is not iterable");
        values = Array.from(values);
        let [f = ascending] = F;
        if (f.length === 1 || F.length > 1) {
          const index2 = Uint32Array.from(values, (d, i) => i);
          if (F.length > 1) {
            F = F.map((f2) => values.map(f2));
            index2.sort((i, j) => {
              for (const f2 of F) {
                const c = ascending(f2[i], f2[j]);
                if (c) return c;
              }
            });
          } else {
            f = values.map(f);
            index2.sort((i, j) => ascending(f[i], f[j]));
          }
          return permute(values, index2);
        }
        return values.sort(f);
      }
      function groupSort(values, reduce2, key) {
        return (reduce2.length === 1 ? sort(rollup(values, reduce2, key), (([ak, av], [bk, bv]) => ascending(av, bv) || ascending(ak, bk))) : sort(group(values, key), (([ak, av], [bk, bv]) => reduce2(av, bv) || ascending(ak, bk)))).map(([key2]) => key2);
      }
      var array = Array.prototype;
      var slice = array.slice;
      function constant(x) {
        return function() {
          return x;
        };
      }
      var e10 = Math.sqrt(50), e5 = Math.sqrt(10), e2 = Math.sqrt(2);
      function ticks(start, stop, count2) {
        var reverse2, i = -1, n, ticks2, step;
        stop = +stop, start = +start, count2 = +count2;
        if (start === stop && count2 > 0) return [start];
        if (reverse2 = stop < start) n = start, start = stop, stop = n;
        if ((step = tickIncrement(start, stop, count2)) === 0 || !isFinite(step)) return [];
        if (step > 0) {
          let r0 = Math.round(start / step), r1 = Math.round(stop / step);
          if (r0 * step < start) ++r0;
          if (r1 * step > stop) --r1;
          ticks2 = new Array(n = r1 - r0 + 1);
          while (++i < n) ticks2[i] = (r0 + i) * step;
        } else {
          step = -step;
          let r0 = Math.round(start * step), r1 = Math.round(stop * step);
          if (r0 / step < start) ++r0;
          if (r1 / step > stop) --r1;
          ticks2 = new Array(n = r1 - r0 + 1);
          while (++i < n) ticks2[i] = (r0 + i) / step;
        }
        if (reverse2) ticks2.reverse();
        return ticks2;
      }
      function tickIncrement(start, stop, count2) {
        var step = (stop - start) / Math.max(0, count2), power = Math.floor(Math.log(step) / Math.LN10), error = step / Math.pow(10, power);
        return power >= 0 ? (error >= e10 ? 10 : error >= e5 ? 5 : error >= e2 ? 2 : 1) * Math.pow(10, power) : -Math.pow(10, -power) / (error >= e10 ? 10 : error >= e5 ? 5 : error >= e2 ? 2 : 1);
      }
      function tickStep(start, stop, count2) {
        var step0 = Math.abs(stop - start) / Math.max(0, count2), step1 = Math.pow(10, Math.floor(Math.log(step0) / Math.LN10)), error = step0 / step1;
        if (error >= e10) step1 *= 10;
        else if (error >= e5) step1 *= 5;
        else if (error >= e2) step1 *= 2;
        return stop < start ? -step1 : step1;
      }
      function nice(start, stop, count2) {
        let prestep;
        while (true) {
          const step = tickIncrement(start, stop, count2);
          if (step === prestep || step === 0 || !isFinite(step)) {
            return [start, stop];
          } else if (step > 0) {
            start = Math.floor(start / step) * step;
            stop = Math.ceil(stop / step) * step;
          } else if (step < 0) {
            start = Math.ceil(start * step) / step;
            stop = Math.floor(stop * step) / step;
          }
          prestep = step;
        }
      }
      function sturges(values) {
        return Math.ceil(Math.log(count(values)) / Math.LN2) + 1;
      }
      function bin() {
        var value = identity, domain = extent, threshold = sturges;
        function histogram(data) {
          if (!Array.isArray(data)) data = Array.from(data);
          var i, n = data.length, x, values = new Array(n);
          for (i = 0; i < n; ++i) {
            values[i] = value(data[i], i, data);
          }
          var xz = domain(values), x0 = xz[0], x1 = xz[1], tz = threshold(values, x0, x1);
          if (!Array.isArray(tz)) {
            const max2 = x1, tn = +tz;
            if (domain === extent) [x0, x1] = nice(x0, x1, tn);
            tz = ticks(x0, x1, tn);
            if (tz[tz.length - 1] >= x1) {
              if (max2 >= x1 && domain === extent) {
                const step = tickIncrement(x0, x1, tn);
                if (isFinite(step)) {
                  if (step > 0) {
                    x1 = (Math.floor(x1 / step) + 1) * step;
                  } else if (step < 0) {
                    x1 = (Math.ceil(x1 * -step) + 1) / -step;
                  }
                }
              } else {
                tz.pop();
              }
            }
          }
          var m = tz.length;
          while (tz[0] <= x0) tz.shift(), --m;
          while (tz[m - 1] > x1) tz.pop(), --m;
          var bins = new Array(m + 1), bin2;
          for (i = 0; i <= m; ++i) {
            bin2 = bins[i] = [];
            bin2.x0 = i > 0 ? tz[i - 1] : x0;
            bin2.x1 = i < m ? tz[i] : x1;
          }
          for (i = 0; i < n; ++i) {
            x = values[i];
            if (x0 <= x && x <= x1) {
              bins[bisectRight(tz, x, 0, m)].push(data[i]);
            }
          }
          return bins;
        }
        histogram.value = function(_) {
          return arguments.length ? (value = typeof _ === "function" ? _ : constant(_), histogram) : value;
        };
        histogram.domain = function(_) {
          return arguments.length ? (domain = typeof _ === "function" ? _ : constant([_[0], _[1]]), histogram) : domain;
        };
        histogram.thresholds = function(_) {
          return arguments.length ? (threshold = typeof _ === "function" ? _ : Array.isArray(_) ? constant(slice.call(_)) : constant(_), histogram) : threshold;
        };
        return histogram;
      }
      function max(values, valueof) {
        let max2;
        if (valueof === void 0) {
          for (const value of values) {
            if (value != null && (max2 < value || max2 === void 0 && value >= value)) {
              max2 = value;
            }
          }
        } else {
          let index2 = -1;
          for (let value of values) {
            if ((value = valueof(value, ++index2, values)) != null && (max2 < value || max2 === void 0 && value >= value)) {
              max2 = value;
            }
          }
        }
        return max2;
      }
      function min(values, valueof) {
        let min2;
        if (valueof === void 0) {
          for (const value of values) {
            if (value != null && (min2 > value || min2 === void 0 && value >= value)) {
              min2 = value;
            }
          }
        } else {
          let index2 = -1;
          for (let value of values) {
            if ((value = valueof(value, ++index2, values)) != null && (min2 > value || min2 === void 0 && value >= value)) {
              min2 = value;
            }
          }
        }
        return min2;
      }
      function quickselect(array2, k, left = 0, right = array2.length - 1, compare = ascending) {
        while (right > left) {
          if (right - left > 600) {
            const n = right - left + 1;
            const m = k - left + 1;
            const z = Math.log(n);
            const s = 0.5 * Math.exp(2 * z / 3);
            const sd = 0.5 * Math.sqrt(z * s * (n - s) / n) * (m - n / 2 < 0 ? -1 : 1);
            const newLeft = Math.max(left, Math.floor(k - m * s / n + sd));
            const newRight = Math.min(right, Math.floor(k + (n - m) * s / n + sd));
            quickselect(array2, k, newLeft, newRight, compare);
          }
          const t = array2[k];
          let i = left;
          let j = right;
          swap(array2, left, k);
          if (compare(array2[right], t) > 0) swap(array2, left, right);
          while (i < j) {
            swap(array2, i, j), ++i, --j;
            while (compare(array2[i], t) < 0) ++i;
            while (compare(array2[j], t) > 0) --j;
          }
          if (compare(array2[left], t) === 0) swap(array2, left, j);
          else ++j, swap(array2, j, right);
          if (j <= k) left = j + 1;
          if (k <= j) right = j - 1;
        }
        return array2;
      }
      function swap(array2, i, j) {
        const t = array2[i];
        array2[i] = array2[j];
        array2[j] = t;
      }
      function quantile(values, p, valueof) {
        values = Float64Array.from(numbers(values, valueof));
        if (!(n = values.length)) return;
        if ((p = +p) <= 0 || n < 2) return min(values);
        if (p >= 1) return max(values);
        var n, i = (n - 1) * p, i0 = Math.floor(i), value0 = max(quickselect(values, i0).subarray(0, i0 + 1)), value1 = min(values.subarray(i0 + 1));
        return value0 + (value1 - value0) * (i - i0);
      }
      function quantileSorted(values, p, valueof = number) {
        if (!(n = values.length)) return;
        if ((p = +p) <= 0 || n < 2) return +valueof(values[0], 0, values);
        if (p >= 1) return +valueof(values[n - 1], n - 1, values);
        var n, i = (n - 1) * p, i0 = Math.floor(i), value0 = +valueof(values[i0], i0, values), value1 = +valueof(values[i0 + 1], i0 + 1, values);
        return value0 + (value1 - value0) * (i - i0);
      }
      function freedmanDiaconis(values, min2, max2) {
        return Math.ceil((max2 - min2) / (2 * (quantile(values, 0.75) - quantile(values, 0.25)) * Math.pow(count(values), -1 / 3)));
      }
      function scott(values, min2, max2) {
        return Math.ceil((max2 - min2) / (3.5 * deviation(values) * Math.pow(count(values), -1 / 3)));
      }
      function maxIndex(values, valueof) {
        let max2;
        let maxIndex2 = -1;
        let index2 = -1;
        if (valueof === void 0) {
          for (const value of values) {
            ++index2;
            if (value != null && (max2 < value || max2 === void 0 && value >= value)) {
              max2 = value, maxIndex2 = index2;
            }
          }
        } else {
          for (let value of values) {
            if ((value = valueof(value, ++index2, values)) != null && (max2 < value || max2 === void 0 && value >= value)) {
              max2 = value, maxIndex2 = index2;
            }
          }
        }
        return maxIndex2;
      }
      function mean(values, valueof) {
        let count2 = 0;
        let sum3 = 0;
        if (valueof === void 0) {
          for (let value of values) {
            if (value != null && (value = +value) >= value) {
              ++count2, sum3 += value;
            }
          }
        } else {
          let index2 = -1;
          for (let value of values) {
            if ((value = valueof(value, ++index2, values)) != null && (value = +value) >= value) {
              ++count2, sum3 += value;
            }
          }
        }
        if (count2) return sum3 / count2;
      }
      function median(values, valueof) {
        return quantile(values, 0.5, valueof);
      }
      function* flatten(arrays) {
        for (const array2 of arrays) {
          yield* array2;
        }
      }
      function merge(arrays) {
        return Array.from(flatten(arrays));
      }
      function minIndex(values, valueof) {
        let min2;
        let minIndex2 = -1;
        let index2 = -1;
        if (valueof === void 0) {
          for (const value of values) {
            ++index2;
            if (value != null && (min2 > value || min2 === void 0 && value >= value)) {
              min2 = value, minIndex2 = index2;
            }
          }
        } else {
          for (let value of values) {
            if ((value = valueof(value, ++index2, values)) != null && (min2 > value || min2 === void 0 && value >= value)) {
              min2 = value, minIndex2 = index2;
            }
          }
        }
        return minIndex2;
      }
      function pairs(values, pairof = pair) {
        const pairs2 = [];
        let previous;
        let first = false;
        for (const value of values) {
          if (first) pairs2.push(pairof(previous, value));
          previous = value;
          first = true;
        }
        return pairs2;
      }
      function pair(a, b) {
        return [a, b];
      }
      function range(start, stop, step) {
        start = +start, stop = +stop, step = (n = arguments.length) < 2 ? (stop = start, start = 0, 1) : n < 3 ? 1 : +step;
        var i = -1, n = Math.max(0, Math.ceil((stop - start) / step)) | 0, range2 = new Array(n);
        while (++i < n) {
          range2[i] = start + i * step;
        }
        return range2;
      }
      function least(values, compare = ascending) {
        let min2;
        let defined = false;
        if (compare.length === 1) {
          let minValue;
          for (const element of values) {
            const value = compare(element);
            if (defined ? ascending(value, minValue) < 0 : ascending(value, value) === 0) {
              min2 = element;
              minValue = value;
              defined = true;
            }
          }
        } else {
          for (const value of values) {
            if (defined ? compare(value, min2) < 0 : compare(value, value) === 0) {
              min2 = value;
              defined = true;
            }
          }
        }
        return min2;
      }
      function leastIndex(values, compare = ascending) {
        if (compare.length === 1) return minIndex(values, compare);
        let minValue;
        let min2 = -1;
        let index2 = -1;
        for (const value of values) {
          ++index2;
          if (min2 < 0 ? compare(value, value) === 0 : compare(value, minValue) < 0) {
            minValue = value;
            min2 = index2;
          }
        }
        return min2;
      }
      function greatest(values, compare = ascending) {
        let max2;
        let defined = false;
        if (compare.length === 1) {
          let maxValue;
          for (const element of values) {
            const value = compare(element);
            if (defined ? ascending(value, maxValue) > 0 : ascending(value, value) === 0) {
              max2 = element;
              maxValue = value;
              defined = true;
            }
          }
        } else {
          for (const value of values) {
            if (defined ? compare(value, max2) > 0 : compare(value, value) === 0) {
              max2 = value;
              defined = true;
            }
          }
        }
        return max2;
      }
      function greatestIndex(values, compare = ascending) {
        if (compare.length === 1) return maxIndex(values, compare);
        let maxValue;
        let max2 = -1;
        let index2 = -1;
        for (const value of values) {
          ++index2;
          if (max2 < 0 ? compare(value, value) === 0 : compare(value, maxValue) > 0) {
            maxValue = value;
            max2 = index2;
          }
        }
        return max2;
      }
      function scan(values, compare) {
        const index2 = leastIndex(values, compare);
        return index2 < 0 ? void 0 : index2;
      }
      var shuffle = shuffler(Math.random);
      function shuffler(random) {
        return function shuffle2(array2, i0 = 0, i1 = array2.length) {
          let m = i1 - (i0 = +i0);
          while (m) {
            const i = random() * m-- | 0, t = array2[m + i0];
            array2[m + i0] = array2[i + i0];
            array2[i + i0] = t;
          }
          return array2;
        };
      }
      function sum2(values, valueof) {
        let sum3 = 0;
        if (valueof === void 0) {
          for (let value of values) {
            if (value = +value) {
              sum3 += value;
            }
          }
        } else {
          let index2 = -1;
          for (let value of values) {
            if (value = +valueof(value, ++index2, values)) {
              sum3 += value;
            }
          }
        }
        return sum3;
      }
      function transpose(matrix) {
        if (!(n = matrix.length)) return [];
        for (var i = -1, m = min(matrix, length), transpose2 = new Array(m); ++i < m; ) {
          for (var j = -1, n, row = transpose2[i] = new Array(n); ++j < n; ) {
            row[j] = matrix[j][i];
          }
        }
        return transpose2;
      }
      function length(d) {
        return d.length;
      }
      function zip() {
        return transpose(arguments);
      }
      function every(values, test) {
        if (typeof test !== "function") throw new TypeError("test is not a function");
        let index2 = -1;
        for (const value of values) {
          if (!test(value, ++index2, values)) {
            return false;
          }
        }
        return true;
      }
      function some(values, test) {
        if (typeof test !== "function") throw new TypeError("test is not a function");
        let index2 = -1;
        for (const value of values) {
          if (test(value, ++index2, values)) {
            return true;
          }
        }
        return false;
      }
      function filter(values, test) {
        if (typeof test !== "function") throw new TypeError("test is not a function");
        const array2 = [];
        let index2 = -1;
        for (const value of values) {
          if (test(value, ++index2, values)) {
            array2.push(value);
          }
        }
        return array2;
      }
      function map(values, mapper) {
        if (typeof values[Symbol.iterator] !== "function") throw new TypeError("values is not iterable");
        if (typeof mapper !== "function") throw new TypeError("mapper is not a function");
        return Array.from(values, (value, index2) => mapper(value, index2, values));
      }
      function reduce(values, reducer2, value) {
        if (typeof reducer2 !== "function") throw new TypeError("reducer is not a function");
        const iterator = values[Symbol.iterator]();
        let done, next, index2 = -1;
        if (arguments.length < 3) {
          ({ done, value } = iterator.next());
          if (done) return;
          ++index2;
        }
        while ({ done, value: next } = iterator.next(), !done) {
          value = reducer2(value, next, ++index2, values);
        }
        return value;
      }
      function reverse(values) {
        if (typeof values[Symbol.iterator] !== "function") throw new TypeError("values is not iterable");
        return Array.from(values).reverse();
      }
      function difference(values, ...others) {
        values = new Set(values);
        for (const other of others) {
          for (const value of other) {
            values.delete(value);
          }
        }
        return values;
      }
      function disjoint(values, other) {
        const iterator = other[Symbol.iterator](), set2 = /* @__PURE__ */ new Set();
        for (const v2 of values) {
          if (set2.has(v2)) return false;
          let value, done;
          while ({ value, done } = iterator.next()) {
            if (done) break;
            if (Object.is(v2, value)) return false;
            set2.add(value);
          }
        }
        return true;
      }
      function set(values) {
        return values instanceof Set ? values : new Set(values);
      }
      function intersection(values, ...others) {
        values = new Set(values);
        others = others.map(set);
        out: for (const value of values) {
          for (const other of others) {
            if (!other.has(value)) {
              values.delete(value);
              continue out;
            }
          }
        }
        return values;
      }
      function superset(values, other) {
        const iterator = values[Symbol.iterator](), set2 = /* @__PURE__ */ new Set();
        for (const o of other) {
          if (set2.has(o)) continue;
          let value, done;
          while ({ value, done } = iterator.next()) {
            if (done) return false;
            set2.add(value);
            if (Object.is(o, value)) break;
          }
        }
        return true;
      }
      function subset(values, other) {
        return superset(other, values);
      }
      function union(...others) {
        const set2 = /* @__PURE__ */ new Set();
        for (const other of others) {
          for (const o of other) {
            set2.add(o);
          }
        }
        return set2;
      }
      exports2.Adder = Adder;
      exports2.InternMap = InternMap;
      exports2.InternSet = InternSet;
      exports2.ascending = ascending;
      exports2.bin = bin;
      exports2.bisect = bisectRight;
      exports2.bisectCenter = bisectCenter;
      exports2.bisectLeft = bisectLeft;
      exports2.bisectRight = bisectRight;
      exports2.bisector = bisector;
      exports2.count = count;
      exports2.cross = cross;
      exports2.cumsum = cumsum;
      exports2.descending = descending;
      exports2.deviation = deviation;
      exports2.difference = difference;
      exports2.disjoint = disjoint;
      exports2.every = every;
      exports2.extent = extent;
      exports2.fcumsum = fcumsum;
      exports2.filter = filter;
      exports2.fsum = fsum;
      exports2.greatest = greatest;
      exports2.greatestIndex = greatestIndex;
      exports2.group = group;
      exports2.groupSort = groupSort;
      exports2.groups = groups;
      exports2.histogram = bin;
      exports2.index = index;
      exports2.indexes = indexes;
      exports2.intersection = intersection;
      exports2.least = least;
      exports2.leastIndex = leastIndex;
      exports2.map = map;
      exports2.max = max;
      exports2.maxIndex = maxIndex;
      exports2.mean = mean;
      exports2.median = median;
      exports2.merge = merge;
      exports2.min = min;
      exports2.minIndex = minIndex;
      exports2.nice = nice;
      exports2.pairs = pairs;
      exports2.permute = permute;
      exports2.quantile = quantile;
      exports2.quantileSorted = quantileSorted;
      exports2.quickselect = quickselect;
      exports2.range = range;
      exports2.reduce = reduce;
      exports2.reverse = reverse;
      exports2.rollup = rollup;
      exports2.rollups = rollups;
      exports2.scan = scan;
      exports2.shuffle = shuffle;
      exports2.shuffler = shuffler;
      exports2.some = some;
      exports2.sort = sort;
      exports2.subset = subset;
      exports2.sum = sum2;
      exports2.superset = superset;
      exports2.thresholdFreedmanDiaconis = freedmanDiaconis;
      exports2.thresholdScott = scott;
      exports2.thresholdSturges = sturges;
      exports2.tickIncrement = tickIncrement;
      exports2.tickStep = tickStep;
      exports2.ticks = ticks;
      exports2.transpose = transpose;
      exports2.union = union;
      exports2.variance = variance;
      exports2.zip = zip;
      Object.defineProperty(exports2, "__esModule", { value: true });
    }));
  }
});

// node_modules/d3-geo/dist/d3-geo.js
var require_d3_geo = __commonJS({
  "node_modules/d3-geo/dist/d3-geo.js"(exports, module) {
    (function(global, factory) {
      typeof exports === "object" && typeof module !== "undefined" ? factory(exports, require_d3_array()) : typeof define === "function" && define.amd ? define(["exports", "d3-array"], factory) : (global = global || self, factory(global.d3 = global.d3 || {}, global.d3));
    })(exports, function(exports2, d3Array) {
      "use strict";
      var epsilon2 = 1e-6;
      var epsilon22 = 1e-12;
      var pi = Math.PI;
      var halfPi = pi / 2;
      var quarterPi = pi / 4;
      var tau = pi * 2;
      var degrees = 180 / pi;
      var radians = pi / 180;
      var abs = Math.abs;
      var atan = Math.atan;
      var atan2 = Math.atan2;
      var cos = Math.cos;
      var ceil = Math.ceil;
      var exp = Math.exp;
      var hypot = Math.hypot;
      var log = Math.log;
      var pow = Math.pow;
      var sin = Math.sin;
      var sign = Math.sign || function(x) {
        return x > 0 ? 1 : x < 0 ? -1 : 0;
      };
      var sqrt = Math.sqrt;
      var tan = Math.tan;
      function acos(x) {
        return x > 1 ? 0 : x < -1 ? pi : Math.acos(x);
      }
      function asin(x) {
        return x > 1 ? halfPi : x < -1 ? -halfPi : Math.asin(x);
      }
      function haversin(x) {
        return (x = sin(x / 2)) * x;
      }
      function noop() {
      }
      function streamGeometry(geometry, stream) {
        if (geometry && streamGeometryType.hasOwnProperty(geometry.type)) {
          streamGeometryType[geometry.type](geometry, stream);
        }
      }
      var streamObjectType = {
        Feature: function(object2, stream) {
          streamGeometry(object2.geometry, stream);
        },
        FeatureCollection: function(object2, stream) {
          var features = object2.features, i = -1, n = features.length;
          while (++i < n) streamGeometry(features[i].geometry, stream);
        }
      };
      var streamGeometryType = {
        Sphere: function(object2, stream) {
          stream.sphere();
        },
        Point: function(object2, stream) {
          object2 = object2.coordinates;
          stream.point(object2[0], object2[1], object2[2]);
        },
        MultiPoint: function(object2, stream) {
          var coordinates2 = object2.coordinates, i = -1, n = coordinates2.length;
          while (++i < n) object2 = coordinates2[i], stream.point(object2[0], object2[1], object2[2]);
        },
        LineString: function(object2, stream) {
          streamLine(object2.coordinates, stream, 0);
        },
        MultiLineString: function(object2, stream) {
          var coordinates2 = object2.coordinates, i = -1, n = coordinates2.length;
          while (++i < n) streamLine(coordinates2[i], stream, 0);
        },
        Polygon: function(object2, stream) {
          streamPolygon(object2.coordinates, stream);
        },
        MultiPolygon: function(object2, stream) {
          var coordinates2 = object2.coordinates, i = -1, n = coordinates2.length;
          while (++i < n) streamPolygon(coordinates2[i], stream);
        },
        GeometryCollection: function(object2, stream) {
          var geometries = object2.geometries, i = -1, n = geometries.length;
          while (++i < n) streamGeometry(geometries[i], stream);
        }
      };
      function streamLine(coordinates2, stream, closed) {
        var i = -1, n = coordinates2.length - closed, coordinate;
        stream.lineStart();
        while (++i < n) coordinate = coordinates2[i], stream.point(coordinate[0], coordinate[1], coordinate[2]);
        stream.lineEnd();
      }
      function streamPolygon(coordinates2, stream) {
        var i = -1, n = coordinates2.length;
        stream.polygonStart();
        while (++i < n) streamLine(coordinates2[i], stream, 1);
        stream.polygonEnd();
      }
      function geoStream(object2, stream) {
        if (object2 && streamObjectType.hasOwnProperty(object2.type)) {
          streamObjectType[object2.type](object2, stream);
        } else {
          streamGeometry(object2, stream);
        }
      }
      var areaRingSum = new d3Array.Adder();
      var areaSum = new d3Array.Adder(), lambda00, phi00, lambda0, cosPhi0, sinPhi0;
      var areaStream = {
        point: noop,
        lineStart: noop,
        lineEnd: noop,
        polygonStart: function() {
          areaRingSum = new d3Array.Adder();
          areaStream.lineStart = areaRingStart;
          areaStream.lineEnd = areaRingEnd;
        },
        polygonEnd: function() {
          var areaRing = +areaRingSum;
          areaSum.add(areaRing < 0 ? tau + areaRing : areaRing);
          this.lineStart = this.lineEnd = this.point = noop;
        },
        sphere: function() {
          areaSum.add(tau);
        }
      };
      function areaRingStart() {
        areaStream.point = areaPointFirst;
      }
      function areaRingEnd() {
        areaPoint(lambda00, phi00);
      }
      function areaPointFirst(lambda, phi) {
        areaStream.point = areaPoint;
        lambda00 = lambda, phi00 = phi;
        lambda *= radians, phi *= radians;
        lambda0 = lambda, cosPhi0 = cos(phi = phi / 2 + quarterPi), sinPhi0 = sin(phi);
      }
      function areaPoint(lambda, phi) {
        lambda *= radians, phi *= radians;
        phi = phi / 2 + quarterPi;
        var dLambda = lambda - lambda0, sdLambda = dLambda >= 0 ? 1 : -1, adLambda = sdLambda * dLambda, cosPhi = cos(phi), sinPhi = sin(phi), k = sinPhi0 * sinPhi, u4 = cosPhi0 * cosPhi + k * cos(adLambda), v2 = k * sdLambda * sin(adLambda);
        areaRingSum.add(atan2(v2, u4));
        lambda0 = lambda, cosPhi0 = cosPhi, sinPhi0 = sinPhi;
      }
      function area2(object2) {
        areaSum = new d3Array.Adder();
        geoStream(object2, areaStream);
        return areaSum * 2;
      }
      function spherical(cartesian2) {
        return [atan2(cartesian2[1], cartesian2[0]), asin(cartesian2[2])];
      }
      function cartesian(spherical2) {
        var lambda = spherical2[0], phi = spherical2[1], cosPhi = cos(phi);
        return [cosPhi * cos(lambda), cosPhi * sin(lambda), sin(phi)];
      }
      function cartesianDot(a, b) {
        return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
      }
      function cartesianCross(a, b) {
        return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
      }
      function cartesianAddInPlace(a, b) {
        a[0] += b[0], a[1] += b[1], a[2] += b[2];
      }
      function cartesianScale(vector, k) {
        return [vector[0] * k, vector[1] * k, vector[2] * k];
      }
      function cartesianNormalizeInPlace(d) {
        var l = sqrt(d[0] * d[0] + d[1] * d[1] + d[2] * d[2]);
        d[0] /= l, d[1] /= l, d[2] /= l;
      }
      var lambda0$1, phi0, lambda1, phi1, lambda2, lambda00$1, phi00$1, p0, deltaSum, ranges, range;
      var boundsStream = {
        point: boundsPoint,
        lineStart: boundsLineStart,
        lineEnd: boundsLineEnd,
        polygonStart: function() {
          boundsStream.point = boundsRingPoint;
          boundsStream.lineStart = boundsRingStart;
          boundsStream.lineEnd = boundsRingEnd;
          deltaSum = new d3Array.Adder();
          areaStream.polygonStart();
        },
        polygonEnd: function() {
          areaStream.polygonEnd();
          boundsStream.point = boundsPoint;
          boundsStream.lineStart = boundsLineStart;
          boundsStream.lineEnd = boundsLineEnd;
          if (areaRingSum < 0) lambda0$1 = -(lambda1 = 180), phi0 = -(phi1 = 90);
          else if (deltaSum > epsilon2) phi1 = 90;
          else if (deltaSum < -epsilon2) phi0 = -90;
          range[0] = lambda0$1, range[1] = lambda1;
        },
        sphere: function() {
          lambda0$1 = -(lambda1 = 180), phi0 = -(phi1 = 90);
        }
      };
      function boundsPoint(lambda, phi) {
        ranges.push(range = [lambda0$1 = lambda, lambda1 = lambda]);
        if (phi < phi0) phi0 = phi;
        if (phi > phi1) phi1 = phi;
      }
      function linePoint(lambda, phi) {
        var p = cartesian([lambda * radians, phi * radians]);
        if (p0) {
          var normal = cartesianCross(p0, p), equatorial = [normal[1], -normal[0], 0], inflection = cartesianCross(equatorial, normal);
          cartesianNormalizeInPlace(inflection);
          inflection = spherical(inflection);
          var delta = lambda - lambda2, sign2 = delta > 0 ? 1 : -1, lambdai = inflection[0] * degrees * sign2, phii, antimeridian = abs(delta) > 180;
          if (antimeridian ^ (sign2 * lambda2 < lambdai && lambdai < sign2 * lambda)) {
            phii = inflection[1] * degrees;
            if (phii > phi1) phi1 = phii;
          } else if (lambdai = (lambdai + 360) % 360 - 180, antimeridian ^ (sign2 * lambda2 < lambdai && lambdai < sign2 * lambda)) {
            phii = -inflection[1] * degrees;
            if (phii < phi0) phi0 = phii;
          } else {
            if (phi < phi0) phi0 = phi;
            if (phi > phi1) phi1 = phi;
          }
          if (antimeridian) {
            if (lambda < lambda2) {
              if (angle(lambda0$1, lambda) > angle(lambda0$1, lambda1)) lambda1 = lambda;
            } else {
              if (angle(lambda, lambda1) > angle(lambda0$1, lambda1)) lambda0$1 = lambda;
            }
          } else {
            if (lambda1 >= lambda0$1) {
              if (lambda < lambda0$1) lambda0$1 = lambda;
              if (lambda > lambda1) lambda1 = lambda;
            } else {
              if (lambda > lambda2) {
                if (angle(lambda0$1, lambda) > angle(lambda0$1, lambda1)) lambda1 = lambda;
              } else {
                if (angle(lambda, lambda1) > angle(lambda0$1, lambda1)) lambda0$1 = lambda;
              }
            }
          }
        } else {
          ranges.push(range = [lambda0$1 = lambda, lambda1 = lambda]);
        }
        if (phi < phi0) phi0 = phi;
        if (phi > phi1) phi1 = phi;
        p0 = p, lambda2 = lambda;
      }
      function boundsLineStart() {
        boundsStream.point = linePoint;
      }
      function boundsLineEnd() {
        range[0] = lambda0$1, range[1] = lambda1;
        boundsStream.point = boundsPoint;
        p0 = null;
      }
      function boundsRingPoint(lambda, phi) {
        if (p0) {
          var delta = lambda - lambda2;
          deltaSum.add(abs(delta) > 180 ? delta + (delta > 0 ? 360 : -360) : delta);
        } else {
          lambda00$1 = lambda, phi00$1 = phi;
        }
        areaStream.point(lambda, phi);
        linePoint(lambda, phi);
      }
      function boundsRingStart() {
        areaStream.lineStart();
      }
      function boundsRingEnd() {
        boundsRingPoint(lambda00$1, phi00$1);
        areaStream.lineEnd();
        if (abs(deltaSum) > epsilon2) lambda0$1 = -(lambda1 = 180);
        range[0] = lambda0$1, range[1] = lambda1;
        p0 = null;
      }
      function angle(lambda02, lambda12) {
        return (lambda12 -= lambda02) < 0 ? lambda12 + 360 : lambda12;
      }
      function rangeCompare(a, b) {
        return a[0] - b[0];
      }
      function rangeContains(range2, x) {
        return range2[0] <= range2[1] ? range2[0] <= x && x <= range2[1] : x < range2[0] || range2[1] < x;
      }
      function bounds(feature2) {
        var i, n, a, b, merged, deltaMax, delta;
        phi1 = lambda1 = -(lambda0$1 = phi0 = Infinity);
        ranges = [];
        geoStream(feature2, boundsStream);
        if (n = ranges.length) {
          ranges.sort(rangeCompare);
          for (i = 1, a = ranges[0], merged = [a]; i < n; ++i) {
            b = ranges[i];
            if (rangeContains(a, b[0]) || rangeContains(a, b[1])) {
              if (angle(a[0], b[1]) > angle(a[0], a[1])) a[1] = b[1];
              if (angle(b[0], a[1]) > angle(a[0], a[1])) a[0] = b[0];
            } else {
              merged.push(a = b);
            }
          }
          for (deltaMax = -Infinity, n = merged.length - 1, i = 0, a = merged[n]; i <= n; a = b, ++i) {
            b = merged[i];
            if ((delta = angle(a[1], b[0])) > deltaMax) deltaMax = delta, lambda0$1 = b[0], lambda1 = a[1];
          }
        }
        ranges = range = null;
        return lambda0$1 === Infinity || phi0 === Infinity ? [[NaN, NaN], [NaN, NaN]] : [[lambda0$1, phi0], [lambda1, phi1]];
      }
      var W0, W1, X0, Y0, Z0, X1, Y1, Z1, X2, Y2, Z2, lambda00$2, phi00$2, x0, y0, z0;
      var centroidStream = {
        sphere: noop,
        point: centroidPoint,
        lineStart: centroidLineStart,
        lineEnd: centroidLineEnd,
        polygonStart: function() {
          centroidStream.lineStart = centroidRingStart;
          centroidStream.lineEnd = centroidRingEnd;
        },
        polygonEnd: function() {
          centroidStream.lineStart = centroidLineStart;
          centroidStream.lineEnd = centroidLineEnd;
        }
      };
      function centroidPoint(lambda, phi) {
        lambda *= radians, phi *= radians;
        var cosPhi = cos(phi);
        centroidPointCartesian(cosPhi * cos(lambda), cosPhi * sin(lambda), sin(phi));
      }
      function centroidPointCartesian(x, y, z) {
        ++W0;
        X0 += (x - X0) / W0;
        Y0 += (y - Y0) / W0;
        Z0 += (z - Z0) / W0;
      }
      function centroidLineStart() {
        centroidStream.point = centroidLinePointFirst;
      }
      function centroidLinePointFirst(lambda, phi) {
        lambda *= radians, phi *= radians;
        var cosPhi = cos(phi);
        x0 = cosPhi * cos(lambda);
        y0 = cosPhi * sin(lambda);
        z0 = sin(phi);
        centroidStream.point = centroidLinePoint;
        centroidPointCartesian(x0, y0, z0);
      }
      function centroidLinePoint(lambda, phi) {
        lambda *= radians, phi *= radians;
        var cosPhi = cos(phi), x = cosPhi * cos(lambda), y = cosPhi * sin(lambda), z = sin(phi), w = atan2(sqrt((w = y0 * z - z0 * y) * w + (w = z0 * x - x0 * z) * w + (w = x0 * y - y0 * x) * w), x0 * x + y0 * y + z0 * z);
        W1 += w;
        X1 += w * (x0 + (x0 = x));
        Y1 += w * (y0 + (y0 = y));
        Z1 += w * (z0 + (z0 = z));
        centroidPointCartesian(x0, y0, z0);
      }
      function centroidLineEnd() {
        centroidStream.point = centroidPoint;
      }
      function centroidRingStart() {
        centroidStream.point = centroidRingPointFirst;
      }
      function centroidRingEnd() {
        centroidRingPoint(lambda00$2, phi00$2);
        centroidStream.point = centroidPoint;
      }
      function centroidRingPointFirst(lambda, phi) {
        lambda00$2 = lambda, phi00$2 = phi;
        lambda *= radians, phi *= radians;
        centroidStream.point = centroidRingPoint;
        var cosPhi = cos(phi);
        x0 = cosPhi * cos(lambda);
        y0 = cosPhi * sin(lambda);
        z0 = sin(phi);
        centroidPointCartesian(x0, y0, z0);
      }
      function centroidRingPoint(lambda, phi) {
        lambda *= radians, phi *= radians;
        var cosPhi = cos(phi), x = cosPhi * cos(lambda), y = cosPhi * sin(lambda), z = sin(phi), cx = y0 * z - z0 * y, cy = z0 * x - x0 * z, cz = x0 * y - y0 * x, m = hypot(cx, cy, cz), w = asin(m), v2 = m && -w / m;
        X2.add(v2 * cx);
        Y2.add(v2 * cy);
        Z2.add(v2 * cz);
        W1 += w;
        X1 += w * (x0 + (x0 = x));
        Y1 += w * (y0 + (y0 = y));
        Z1 += w * (z0 + (z0 = z));
        centroidPointCartesian(x0, y0, z0);
      }
      function centroid(object2) {
        W0 = W1 = X0 = Y0 = Z0 = X1 = Y1 = Z1 = 0;
        X2 = new d3Array.Adder();
        Y2 = new d3Array.Adder();
        Z2 = new d3Array.Adder();
        geoStream(object2, centroidStream);
        var x = +X2, y = +Y2, z = +Z2, m = hypot(x, y, z);
        if (m < epsilon22) {
          x = X1, y = Y1, z = Z1;
          if (W1 < epsilon2) x = X0, y = Y0, z = Z0;
          m = hypot(x, y, z);
          if (m < epsilon22) return [NaN, NaN];
        }
        return [atan2(y, x) * degrees, asin(z / m) * degrees];
      }
      function constant(x) {
        return function() {
          return x;
        };
      }
      function compose(a, b) {
        function compose2(x, y) {
          return x = a(x, y), b(x[0], x[1]);
        }
        if (a.invert && b.invert) compose2.invert = function(x, y) {
          return x = b.invert(x, y), x && a.invert(x[0], x[1]);
        };
        return compose2;
      }
      function rotationIdentity(lambda, phi) {
        return [abs(lambda) > pi ? lambda + Math.round(-lambda / tau) * tau : lambda, phi];
      }
      rotationIdentity.invert = rotationIdentity;
      function rotateRadians(deltaLambda, deltaPhi, deltaGamma) {
        return (deltaLambda %= tau) ? deltaPhi || deltaGamma ? compose(rotationLambda(deltaLambda), rotationPhiGamma(deltaPhi, deltaGamma)) : rotationLambda(deltaLambda) : deltaPhi || deltaGamma ? rotationPhiGamma(deltaPhi, deltaGamma) : rotationIdentity;
      }
      function forwardRotationLambda(deltaLambda) {
        return function(lambda, phi) {
          return lambda += deltaLambda, [lambda > pi ? lambda - tau : lambda < -pi ? lambda + tau : lambda, phi];
        };
      }
      function rotationLambda(deltaLambda) {
        var rotation2 = forwardRotationLambda(deltaLambda);
        rotation2.invert = forwardRotationLambda(-deltaLambda);
        return rotation2;
      }
      function rotationPhiGamma(deltaPhi, deltaGamma) {
        var cosDeltaPhi = cos(deltaPhi), sinDeltaPhi = sin(deltaPhi), cosDeltaGamma = cos(deltaGamma), sinDeltaGamma = sin(deltaGamma);
        function rotation2(lambda, phi) {
          var cosPhi = cos(phi), x = cos(lambda) * cosPhi, y = sin(lambda) * cosPhi, z = sin(phi), k = z * cosDeltaPhi + x * sinDeltaPhi;
          return [
            atan2(y * cosDeltaGamma - k * sinDeltaGamma, x * cosDeltaPhi - z * sinDeltaPhi),
            asin(k * cosDeltaGamma + y * sinDeltaGamma)
          ];
        }
        rotation2.invert = function(lambda, phi) {
          var cosPhi = cos(phi), x = cos(lambda) * cosPhi, y = sin(lambda) * cosPhi, z = sin(phi), k = z * cosDeltaGamma - y * sinDeltaGamma;
          return [
            atan2(y * cosDeltaGamma + z * sinDeltaGamma, x * cosDeltaPhi + k * sinDeltaPhi),
            asin(k * cosDeltaPhi - x * sinDeltaPhi)
          ];
        };
        return rotation2;
      }
      function rotation(rotate) {
        rotate = rotateRadians(rotate[0] * radians, rotate[1] * radians, rotate.length > 2 ? rotate[2] * radians : 0);
        function forward(coordinates2) {
          coordinates2 = rotate(coordinates2[0] * radians, coordinates2[1] * radians);
          return coordinates2[0] *= degrees, coordinates2[1] *= degrees, coordinates2;
        }
        forward.invert = function(coordinates2) {
          coordinates2 = rotate.invert(coordinates2[0] * radians, coordinates2[1] * radians);
          return coordinates2[0] *= degrees, coordinates2[1] *= degrees, coordinates2;
        };
        return forward;
      }
      function circleStream(stream, radius, delta, direction, t0, t1) {
        if (!delta) return;
        var cosRadius = cos(radius), sinRadius = sin(radius), step = direction * delta;
        if (t0 == null) {
          t0 = radius + direction * tau;
          t1 = radius - step / 2;
        } else {
          t0 = circleRadius(cosRadius, t0);
          t1 = circleRadius(cosRadius, t1);
          if (direction > 0 ? t0 < t1 : t0 > t1) t0 += direction * tau;
        }
        for (var point2, t = t0; direction > 0 ? t > t1 : t < t1; t -= step) {
          point2 = spherical([cosRadius, -sinRadius * cos(t), -sinRadius * sin(t)]);
          stream.point(point2[0], point2[1]);
        }
      }
      function circleRadius(cosRadius, point2) {
        point2 = cartesian(point2), point2[0] -= cosRadius;
        cartesianNormalizeInPlace(point2);
        var radius = acos(-point2[1]);
        return ((-point2[2] < 0 ? -radius : radius) + tau - epsilon2) % tau;
      }
      function circle() {
        var center2 = constant([0, 0]), radius = constant(90), precision = constant(6), ring, rotate, stream = { point: point2 };
        function point2(x, y) {
          ring.push(x = rotate(x, y));
          x[0] *= degrees, x[1] *= degrees;
        }
        function circle2() {
          var c = center2.apply(this, arguments), r = radius.apply(this, arguments) * radians, p = precision.apply(this, arguments) * radians;
          ring = [];
          rotate = rotateRadians(-c[0] * radians, -c[1] * radians, 0).invert;
          circleStream(stream, r, p, 1);
          c = { type: "Polygon", coordinates: [ring] };
          ring = rotate = null;
          return c;
        }
        circle2.center = function(_) {
          return arguments.length ? (center2 = typeof _ === "function" ? _ : constant([+_[0], +_[1]]), circle2) : center2;
        };
        circle2.radius = function(_) {
          return arguments.length ? (radius = typeof _ === "function" ? _ : constant(+_), circle2) : radius;
        };
        circle2.precision = function(_) {
          return arguments.length ? (precision = typeof _ === "function" ? _ : constant(+_), circle2) : precision;
        };
        return circle2;
      }
      function clipBuffer() {
        var lines = [], line;
        return {
          point: function(x, y, m) {
            line.push([x, y, m]);
          },
          lineStart: function() {
            lines.push(line = []);
          },
          lineEnd: noop,
          rejoin: function() {
            if (lines.length > 1) lines.push(lines.pop().concat(lines.shift()));
          },
          result: function() {
            var result = lines;
            lines = [];
            line = null;
            return result;
          }
        };
      }
      function pointEqual(a, b) {
        return abs(a[0] - b[0]) < epsilon2 && abs(a[1] - b[1]) < epsilon2;
      }
      function Intersection(point2, points, other, entry) {
        this.x = point2;
        this.z = points;
        this.o = other;
        this.e = entry;
        this.v = false;
        this.n = this.p = null;
      }
      function clipRejoin(segments, compareIntersection2, startInside, interpolate2, stream) {
        var subject = [], clip2 = [], i, n;
        segments.forEach(function(segment) {
          if ((n2 = segment.length - 1) <= 0) return;
          var n2, p02 = segment[0], p1 = segment[n2], x;
          if (pointEqual(p02, p1)) {
            if (!p02[2] && !p1[2]) {
              stream.lineStart();
              for (i = 0; i < n2; ++i) stream.point((p02 = segment[i])[0], p02[1]);
              stream.lineEnd();
              return;
            }
            p1[0] += 2 * epsilon2;
          }
          subject.push(x = new Intersection(p02, segment, null, true));
          clip2.push(x.o = new Intersection(p02, null, x, false));
          subject.push(x = new Intersection(p1, segment, null, false));
          clip2.push(x.o = new Intersection(p1, null, x, true));
        });
        if (!subject.length) return;
        clip2.sort(compareIntersection2);
        link(subject);
        link(clip2);
        for (i = 0, n = clip2.length; i < n; ++i) {
          clip2[i].e = startInside = !startInside;
        }
        var start = subject[0], points, point2;
        while (1) {
          var current = start, isSubject = true;
          while (current.v) if ((current = current.n) === start) return;
          points = current.z;
          stream.lineStart();
          do {
            current.v = current.o.v = true;
            if (current.e) {
              if (isSubject) {
                for (i = 0, n = points.length; i < n; ++i) stream.point((point2 = points[i])[0], point2[1]);
              } else {
                interpolate2(current.x, current.n.x, 1, stream);
              }
              current = current.n;
            } else {
              if (isSubject) {
                points = current.p.z;
                for (i = points.length - 1; i >= 0; --i) stream.point((point2 = points[i])[0], point2[1]);
              } else {
                interpolate2(current.x, current.p.x, -1, stream);
              }
              current = current.p;
            }
            current = current.o;
            points = current.z;
            isSubject = !isSubject;
          } while (!current.v);
          stream.lineEnd();
        }
      }
      function link(array) {
        if (!(n = array.length)) return;
        var n, i = 0, a = array[0], b;
        while (++i < n) {
          a.n = b = array[i];
          b.p = a;
          a = b;
        }
        a.n = b = array[0];
        b.p = a;
      }
      function longitude(point2) {
        if (abs(point2[0]) <= pi)
          return point2[0];
        else
          return sign(point2[0]) * ((abs(point2[0]) + pi) % tau - pi);
      }
      function polygonContains(polygon2, point2) {
        var lambda = longitude(point2), phi = point2[1], sinPhi = sin(phi), normal = [sin(lambda), -cos(lambda), 0], angle2 = 0, winding = 0;
        var sum2 = new d3Array.Adder();
        if (sinPhi === 1) phi = halfPi + epsilon2;
        else if (sinPhi === -1) phi = -halfPi - epsilon2;
        for (var i = 0, n = polygon2.length; i < n; ++i) {
          if (!(m = (ring = polygon2[i]).length)) continue;
          var ring, m, point0 = ring[m - 1], lambda02 = longitude(point0), phi02 = point0[1] / 2 + quarterPi, sinPhi02 = sin(phi02), cosPhi02 = cos(phi02);
          for (var j = 0; j < m; ++j, lambda02 = lambda12, sinPhi02 = sinPhi1, cosPhi02 = cosPhi1, point0 = point1) {
            var point1 = ring[j], lambda12 = longitude(point1), phi12 = point1[1] / 2 + quarterPi, sinPhi1 = sin(phi12), cosPhi1 = cos(phi12), delta = lambda12 - lambda02, sign2 = delta >= 0 ? 1 : -1, absDelta = sign2 * delta, antimeridian = absDelta > pi, k = sinPhi02 * sinPhi1;
            sum2.add(atan2(k * sign2 * sin(absDelta), cosPhi02 * cosPhi1 + k * cos(absDelta)));
            angle2 += antimeridian ? delta + sign2 * tau : delta;
            if (antimeridian ^ lambda02 >= lambda ^ lambda12 >= lambda) {
              var arc = cartesianCross(cartesian(point0), cartesian(point1));
              cartesianNormalizeInPlace(arc);
              var intersection = cartesianCross(normal, arc);
              cartesianNormalizeInPlace(intersection);
              var phiArc = (antimeridian ^ delta >= 0 ? -1 : 1) * asin(intersection[2]);
              if (phi > phiArc || phi === phiArc && (arc[0] || arc[1])) {
                winding += antimeridian ^ delta >= 0 ? 1 : -1;
              }
            }
          }
        }
        return (angle2 < -epsilon2 || angle2 < epsilon2 && sum2 < -epsilon22) ^ winding & 1;
      }
      function clip(pointVisible, clipLine2, interpolate2, start) {
        return function(sink) {
          var line = clipLine2(sink), ringBuffer = clipBuffer(), ringSink = clipLine2(ringBuffer), polygonStarted = false, polygon2, segments, ring;
          var clip2 = {
            point: point2,
            lineStart,
            lineEnd,
            polygonStart: function() {
              clip2.point = pointRing;
              clip2.lineStart = ringStart;
              clip2.lineEnd = ringEnd;
              segments = [];
              polygon2 = [];
            },
            polygonEnd: function() {
              clip2.point = point2;
              clip2.lineStart = lineStart;
              clip2.lineEnd = lineEnd;
              segments = d3Array.merge(segments);
              var startInside = polygonContains(polygon2, start);
              if (segments.length) {
                if (!polygonStarted) sink.polygonStart(), polygonStarted = true;
                clipRejoin(segments, compareIntersection, startInside, interpolate2, sink);
              } else if (startInside) {
                if (!polygonStarted) sink.polygonStart(), polygonStarted = true;
                sink.lineStart();
                interpolate2(null, null, 1, sink);
                sink.lineEnd();
              }
              if (polygonStarted) sink.polygonEnd(), polygonStarted = false;
              segments = polygon2 = null;
            },
            sphere: function() {
              sink.polygonStart();
              sink.lineStart();
              interpolate2(null, null, 1, sink);
              sink.lineEnd();
              sink.polygonEnd();
            }
          };
          function point2(lambda, phi) {
            if (pointVisible(lambda, phi)) sink.point(lambda, phi);
          }
          function pointLine(lambda, phi) {
            line.point(lambda, phi);
          }
          function lineStart() {
            clip2.point = pointLine;
            line.lineStart();
          }
          function lineEnd() {
            clip2.point = point2;
            line.lineEnd();
          }
          function pointRing(lambda, phi) {
            ring.push([lambda, phi]);
            ringSink.point(lambda, phi);
          }
          function ringStart() {
            ringSink.lineStart();
            ring = [];
          }
          function ringEnd() {
            pointRing(ring[0][0], ring[0][1]);
            ringSink.lineEnd();
            var clean = ringSink.clean(), ringSegments = ringBuffer.result(), i, n = ringSegments.length, m, segment, point3;
            ring.pop();
            polygon2.push(ring);
            ring = null;
            if (!n) return;
            if (clean & 1) {
              segment = ringSegments[0];
              if ((m = segment.length - 1) > 0) {
                if (!polygonStarted) sink.polygonStart(), polygonStarted = true;
                sink.lineStart();
                for (i = 0; i < m; ++i) sink.point((point3 = segment[i])[0], point3[1]);
                sink.lineEnd();
              }
              return;
            }
            if (n > 1 && clean & 2) ringSegments.push(ringSegments.pop().concat(ringSegments.shift()));
            segments.push(ringSegments.filter(validSegment));
          }
          return clip2;
        };
      }
      function validSegment(segment) {
        return segment.length > 1;
      }
      function compareIntersection(a, b) {
        return ((a = a.x)[0] < 0 ? a[1] - halfPi - epsilon2 : halfPi - a[1]) - ((b = b.x)[0] < 0 ? b[1] - halfPi - epsilon2 : halfPi - b[1]);
      }
      var clipAntimeridian = clip(
        function() {
          return true;
        },
        clipAntimeridianLine,
        clipAntimeridianInterpolate,
        [-pi, -halfPi]
      );
      function clipAntimeridianLine(stream) {
        var lambda02 = NaN, phi02 = NaN, sign0 = NaN, clean;
        return {
          lineStart: function() {
            stream.lineStart();
            clean = 1;
          },
          point: function(lambda12, phi12) {
            var sign1 = lambda12 > 0 ? pi : -pi, delta = abs(lambda12 - lambda02);
            if (abs(delta - pi) < epsilon2) {
              stream.point(lambda02, phi02 = (phi02 + phi12) / 2 > 0 ? halfPi : -halfPi);
              stream.point(sign0, phi02);
              stream.lineEnd();
              stream.lineStart();
              stream.point(sign1, phi02);
              stream.point(lambda12, phi02);
              clean = 0;
            } else if (sign0 !== sign1 && delta >= pi) {
              if (abs(lambda02 - sign0) < epsilon2) lambda02 -= sign0 * epsilon2;
              if (abs(lambda12 - sign1) < epsilon2) lambda12 -= sign1 * epsilon2;
              phi02 = clipAntimeridianIntersect(lambda02, phi02, lambda12, phi12);
              stream.point(sign0, phi02);
              stream.lineEnd();
              stream.lineStart();
              stream.point(sign1, phi02);
              clean = 0;
            }
            stream.point(lambda02 = lambda12, phi02 = phi12);
            sign0 = sign1;
          },
          lineEnd: function() {
            stream.lineEnd();
            lambda02 = phi02 = NaN;
          },
          clean: function() {
            return 2 - clean;
          }
        };
      }
      function clipAntimeridianIntersect(lambda02, phi02, lambda12, phi12) {
        var cosPhi02, cosPhi1, sinLambda0Lambda1 = sin(lambda02 - lambda12);
        return abs(sinLambda0Lambda1) > epsilon2 ? atan((sin(phi02) * (cosPhi1 = cos(phi12)) * sin(lambda12) - sin(phi12) * (cosPhi02 = cos(phi02)) * sin(lambda02)) / (cosPhi02 * cosPhi1 * sinLambda0Lambda1)) : (phi02 + phi12) / 2;
      }
      function clipAntimeridianInterpolate(from, to, direction, stream) {
        var phi;
        if (from == null) {
          phi = direction * halfPi;
          stream.point(-pi, phi);
          stream.point(0, phi);
          stream.point(pi, phi);
          stream.point(pi, 0);
          stream.point(pi, -phi);
          stream.point(0, -phi);
          stream.point(-pi, -phi);
          stream.point(-pi, 0);
          stream.point(-pi, phi);
        } else if (abs(from[0] - to[0]) > epsilon2) {
          var lambda = from[0] < to[0] ? pi : -pi;
          phi = direction * lambda / 2;
          stream.point(-lambda, phi);
          stream.point(0, phi);
          stream.point(lambda, phi);
        } else {
          stream.point(to[0], to[1]);
        }
      }
      function clipCircle(radius) {
        var cr = cos(radius), delta = 6 * radians, smallRadius = cr > 0, notHemisphere = abs(cr) > epsilon2;
        function interpolate2(from, to, direction, stream) {
          circleStream(stream, radius, delta, direction, from, to);
        }
        function visible(lambda, phi) {
          return cos(lambda) * cos(phi) > cr;
        }
        function clipLine2(stream) {
          var point0, c0, v0, v00, clean;
          return {
            lineStart: function() {
              v00 = v0 = false;
              clean = 1;
            },
            point: function(lambda, phi) {
              var point1 = [lambda, phi], point2, v2 = visible(lambda, phi), c = smallRadius ? v2 ? 0 : code(lambda, phi) : v2 ? code(lambda + (lambda < 0 ? pi : -pi), phi) : 0;
              if (!point0 && (v00 = v0 = v2)) stream.lineStart();
              if (v2 !== v0) {
                point2 = intersect(point0, point1);
                if (!point2 || pointEqual(point0, point2) || pointEqual(point1, point2))
                  point1[2] = 1;
              }
              if (v2 !== v0) {
                clean = 0;
                if (v2) {
                  stream.lineStart();
                  point2 = intersect(point1, point0);
                  stream.point(point2[0], point2[1]);
                } else {
                  point2 = intersect(point0, point1);
                  stream.point(point2[0], point2[1], 2);
                  stream.lineEnd();
                }
                point0 = point2;
              } else if (notHemisphere && point0 && smallRadius ^ v2) {
                var t;
                if (!(c & c0) && (t = intersect(point1, point0, true))) {
                  clean = 0;
                  if (smallRadius) {
                    stream.lineStart();
                    stream.point(t[0][0], t[0][1]);
                    stream.point(t[1][0], t[1][1]);
                    stream.lineEnd();
                  } else {
                    stream.point(t[1][0], t[1][1]);
                    stream.lineEnd();
                    stream.lineStart();
                    stream.point(t[0][0], t[0][1], 3);
                  }
                }
              }
              if (v2 && (!point0 || !pointEqual(point0, point1))) {
                stream.point(point1[0], point1[1]);
              }
              point0 = point1, v0 = v2, c0 = c;
            },
            lineEnd: function() {
              if (v0) stream.lineEnd();
              point0 = null;
            },
            // Rejoin first and last segments if there were intersections and the first
            // and last points were visible.
            clean: function() {
              return clean | (v00 && v0) << 1;
            }
          };
        }
        function intersect(a, b, two) {
          var pa = cartesian(a), pb = cartesian(b);
          var n1 = [1, 0, 0], n2 = cartesianCross(pa, pb), n2n2 = cartesianDot(n2, n2), n1n2 = n2[0], determinant = n2n2 - n1n2 * n1n2;
          if (!determinant) return !two && a;
          var c1 = cr * n2n2 / determinant, c2 = -cr * n1n2 / determinant, n1xn2 = cartesianCross(n1, n2), A = cartesianScale(n1, c1), B2 = cartesianScale(n2, c2);
          cartesianAddInPlace(A, B2);
          var u4 = n1xn2, w = cartesianDot(A, u4), uu = cartesianDot(u4, u4), t2 = w * w - uu * (cartesianDot(A, A) - 1);
          if (t2 < 0) return;
          var t = sqrt(t2), q = cartesianScale(u4, (-w - t) / uu);
          cartesianAddInPlace(q, A);
          q = spherical(q);
          if (!two) return q;
          var lambda02 = a[0], lambda12 = b[0], phi02 = a[1], phi12 = b[1], z;
          if (lambda12 < lambda02) z = lambda02, lambda02 = lambda12, lambda12 = z;
          var delta2 = lambda12 - lambda02, polar = abs(delta2 - pi) < epsilon2, meridian = polar || delta2 < epsilon2;
          if (!polar && phi12 < phi02) z = phi02, phi02 = phi12, phi12 = z;
          if (meridian ? polar ? phi02 + phi12 > 0 ^ q[1] < (abs(q[0] - lambda02) < epsilon2 ? phi02 : phi12) : phi02 <= q[1] && q[1] <= phi12 : delta2 > pi ^ (lambda02 <= q[0] && q[0] <= lambda12)) {
            var q1 = cartesianScale(u4, (-w + t) / uu);
            cartesianAddInPlace(q1, A);
            return [q, spherical(q1)];
          }
        }
        function code(lambda, phi) {
          var r = smallRadius ? radius : pi - radius, code2 = 0;
          if (lambda < -r) code2 |= 1;
          else if (lambda > r) code2 |= 2;
          if (phi < -r) code2 |= 4;
          else if (phi > r) code2 |= 8;
          return code2;
        }
        return clip(visible, clipLine2, interpolate2, smallRadius ? [0, -radius] : [-pi, radius - pi]);
      }
      function clipLine(a, b, x02, y02, x12, y12) {
        var ax = a[0], ay = a[1], bx = b[0], by = b[1], t0 = 0, t1 = 1, dx = bx - ax, dy = by - ay, r;
        r = x02 - ax;
        if (!dx && r > 0) return;
        r /= dx;
        if (dx < 0) {
          if (r < t0) return;
          if (r < t1) t1 = r;
        } else if (dx > 0) {
          if (r > t1) return;
          if (r > t0) t0 = r;
        }
        r = x12 - ax;
        if (!dx && r < 0) return;
        r /= dx;
        if (dx < 0) {
          if (r > t1) return;
          if (r > t0) t0 = r;
        } else if (dx > 0) {
          if (r < t0) return;
          if (r < t1) t1 = r;
        }
        r = y02 - ay;
        if (!dy && r > 0) return;
        r /= dy;
        if (dy < 0) {
          if (r < t0) return;
          if (r < t1) t1 = r;
        } else if (dy > 0) {
          if (r > t1) return;
          if (r > t0) t0 = r;
        }
        r = y12 - ay;
        if (!dy && r < 0) return;
        r /= dy;
        if (dy < 0) {
          if (r > t1) return;
          if (r > t0) t0 = r;
        } else if (dy > 0) {
          if (r < t0) return;
          if (r < t1) t1 = r;
        }
        if (t0 > 0) a[0] = ax + t0 * dx, a[1] = ay + t0 * dy;
        if (t1 < 1) b[0] = ax + t1 * dx, b[1] = ay + t1 * dy;
        return true;
      }
      var clipMax = 1e9, clipMin = -clipMax;
      function clipRectangle(x02, y02, x12, y12) {
        function visible(x, y) {
          return x02 <= x && x <= x12 && y02 <= y && y <= y12;
        }
        function interpolate2(from, to, direction, stream) {
          var a = 0, a1 = 0;
          if (from == null || (a = corner(from, direction)) !== (a1 = corner(to, direction)) || comparePoint(from, to) < 0 ^ direction > 0) {
            do
              stream.point(a === 0 || a === 3 ? x02 : x12, a > 1 ? y12 : y02);
            while ((a = (a + direction + 4) % 4) !== a1);
          } else {
            stream.point(to[0], to[1]);
          }
        }
        function corner(p, direction) {
          return abs(p[0] - x02) < epsilon2 ? direction > 0 ? 0 : 3 : abs(p[0] - x12) < epsilon2 ? direction > 0 ? 2 : 1 : abs(p[1] - y02) < epsilon2 ? direction > 0 ? 1 : 0 : direction > 0 ? 3 : 2;
        }
        function compareIntersection2(a, b) {
          return comparePoint(a.x, b.x);
        }
        function comparePoint(a, b) {
          var ca3 = corner(a, 1), cb = corner(b, 1);
          return ca3 !== cb ? ca3 - cb : ca3 === 0 ? b[1] - a[1] : ca3 === 1 ? a[0] - b[0] : ca3 === 2 ? a[1] - b[1] : b[0] - a[0];
        }
        return function(stream) {
          var activeStream = stream, bufferStream = clipBuffer(), segments, polygon2, ring, x__, y__, v__, x_, y_, v_, first, clean;
          var clipStream = {
            point: point2,
            lineStart,
            lineEnd,
            polygonStart,
            polygonEnd
          };
          function point2(x, y) {
            if (visible(x, y)) activeStream.point(x, y);
          }
          function polygonInside() {
            var winding = 0;
            for (var i = 0, n = polygon2.length; i < n; ++i) {
              for (var ring2 = polygon2[i], j = 1, m = ring2.length, point3 = ring2[0], a0, a1, b0 = point3[0], b1 = point3[1]; j < m; ++j) {
                a0 = b0, a1 = b1, point3 = ring2[j], b0 = point3[0], b1 = point3[1];
                if (a1 <= y12) {
                  if (b1 > y12 && (b0 - a0) * (y12 - a1) > (b1 - a1) * (x02 - a0)) ++winding;
                } else {
                  if (b1 <= y12 && (b0 - a0) * (y12 - a1) < (b1 - a1) * (x02 - a0)) --winding;
                }
              }
            }
            return winding;
          }
          function polygonStart() {
            activeStream = bufferStream, segments = [], polygon2 = [], clean = true;
          }
          function polygonEnd() {
            var startInside = polygonInside(), cleanInside = clean && startInside, visible2 = (segments = d3Array.merge(segments)).length;
            if (cleanInside || visible2) {
              stream.polygonStart();
              if (cleanInside) {
                stream.lineStart();
                interpolate2(null, null, 1, stream);
                stream.lineEnd();
              }
              if (visible2) {
                clipRejoin(segments, compareIntersection2, startInside, interpolate2, stream);
              }
              stream.polygonEnd();
            }
            activeStream = stream, segments = polygon2 = ring = null;
          }
          function lineStart() {
            clipStream.point = linePoint2;
            if (polygon2) polygon2.push(ring = []);
            first = true;
            v_ = false;
            x_ = y_ = NaN;
          }
          function lineEnd() {
            if (segments) {
              linePoint2(x__, y__);
              if (v__ && v_) bufferStream.rejoin();
              segments.push(bufferStream.result());
            }
            clipStream.point = point2;
            if (v_) activeStream.lineEnd();
          }
          function linePoint2(x, y) {
            var v2 = visible(x, y);
            if (polygon2) ring.push([x, y]);
            if (first) {
              x__ = x, y__ = y, v__ = v2;
              first = false;
              if (v2) {
                activeStream.lineStart();
                activeStream.point(x, y);
              }
            } else {
              if (v2 && v_) activeStream.point(x, y);
              else {
                var a = [x_ = Math.max(clipMin, Math.min(clipMax, x_)), y_ = Math.max(clipMin, Math.min(clipMax, y_))], b = [x = Math.max(clipMin, Math.min(clipMax, x)), y = Math.max(clipMin, Math.min(clipMax, y))];
                if (clipLine(a, b, x02, y02, x12, y12)) {
                  if (!v_) {
                    activeStream.lineStart();
                    activeStream.point(a[0], a[1]);
                  }
                  activeStream.point(b[0], b[1]);
                  if (!v2) activeStream.lineEnd();
                  clean = false;
                } else if (v2) {
                  activeStream.lineStart();
                  activeStream.point(x, y);
                  clean = false;
                }
              }
            }
            x_ = x, y_ = y, v_ = v2;
          }
          return clipStream;
        };
      }
      function extent() {
        var x02 = 0, y02 = 0, x12 = 960, y12 = 500, cache, cacheStream, clip2;
        return clip2 = {
          stream: function(stream) {
            return cache && cacheStream === stream ? cache : cache = clipRectangle(x02, y02, x12, y12)(cacheStream = stream);
          },
          extent: function(_) {
            return arguments.length ? (x02 = +_[0][0], y02 = +_[0][1], x12 = +_[1][0], y12 = +_[1][1], cache = cacheStream = null, clip2) : [[x02, y02], [x12, y12]];
          }
        };
      }
      var lengthSum, lambda0$2, sinPhi0$1, cosPhi0$1;
      var lengthStream = {
        sphere: noop,
        point: noop,
        lineStart: lengthLineStart,
        lineEnd: noop,
        polygonStart: noop,
        polygonEnd: noop
      };
      function lengthLineStart() {
        lengthStream.point = lengthPointFirst;
        lengthStream.lineEnd = lengthLineEnd;
      }
      function lengthLineEnd() {
        lengthStream.point = lengthStream.lineEnd = noop;
      }
      function lengthPointFirst(lambda, phi) {
        lambda *= radians, phi *= radians;
        lambda0$2 = lambda, sinPhi0$1 = sin(phi), cosPhi0$1 = cos(phi);
        lengthStream.point = lengthPoint;
      }
      function lengthPoint(lambda, phi) {
        lambda *= radians, phi *= radians;
        var sinPhi = sin(phi), cosPhi = cos(phi), delta = abs(lambda - lambda0$2), cosDelta = cos(delta), sinDelta = sin(delta), x = cosPhi * sinDelta, y = cosPhi0$1 * sinPhi - sinPhi0$1 * cosPhi * cosDelta, z = sinPhi0$1 * sinPhi + cosPhi0$1 * cosPhi * cosDelta;
        lengthSum.add(atan2(sqrt(x * x + y * y), z));
        lambda0$2 = lambda, sinPhi0$1 = sinPhi, cosPhi0$1 = cosPhi;
      }
      function length(object2) {
        lengthSum = new d3Array.Adder();
        geoStream(object2, lengthStream);
        return +lengthSum;
      }
      var coordinates = [null, null], object = { type: "LineString", coordinates };
      function distance(a, b) {
        coordinates[0] = a;
        coordinates[1] = b;
        return length(object);
      }
      var containsObjectType = {
        Feature: function(object2, point2) {
          return containsGeometry(object2.geometry, point2);
        },
        FeatureCollection: function(object2, point2) {
          var features = object2.features, i = -1, n = features.length;
          while (++i < n) if (containsGeometry(features[i].geometry, point2)) return true;
          return false;
        }
      };
      var containsGeometryType = {
        Sphere: function() {
          return true;
        },
        Point: function(object2, point2) {
          return containsPoint(object2.coordinates, point2);
        },
        MultiPoint: function(object2, point2) {
          var coordinates2 = object2.coordinates, i = -1, n = coordinates2.length;
          while (++i < n) if (containsPoint(coordinates2[i], point2)) return true;
          return false;
        },
        LineString: function(object2, point2) {
          return containsLine(object2.coordinates, point2);
        },
        MultiLineString: function(object2, point2) {
          var coordinates2 = object2.coordinates, i = -1, n = coordinates2.length;
          while (++i < n) if (containsLine(coordinates2[i], point2)) return true;
          return false;
        },
        Polygon: function(object2, point2) {
          return containsPolygon(object2.coordinates, point2);
        },
        MultiPolygon: function(object2, point2) {
          var coordinates2 = object2.coordinates, i = -1, n = coordinates2.length;
          while (++i < n) if (containsPolygon(coordinates2[i], point2)) return true;
          return false;
        },
        GeometryCollection: function(object2, point2) {
          var geometries = object2.geometries, i = -1, n = geometries.length;
          while (++i < n) if (containsGeometry(geometries[i], point2)) return true;
          return false;
        }
      };
      function containsGeometry(geometry, point2) {
        return geometry && containsGeometryType.hasOwnProperty(geometry.type) ? containsGeometryType[geometry.type](geometry, point2) : false;
      }
      function containsPoint(coordinates2, point2) {
        return distance(coordinates2, point2) === 0;
      }
      function containsLine(coordinates2, point2) {
        var ao, bo, ab4;
        for (var i = 0, n = coordinates2.length; i < n; i++) {
          bo = distance(coordinates2[i], point2);
          if (bo === 0) return true;
          if (i > 0) {
            ab4 = distance(coordinates2[i], coordinates2[i - 1]);
            if (ab4 > 0 && ao <= ab4 && bo <= ab4 && (ao + bo - ab4) * (1 - Math.pow((ao - bo) / ab4, 2)) < epsilon22 * ab4)
              return true;
          }
          ao = bo;
        }
        return false;
      }
      function containsPolygon(coordinates2, point2) {
        return !!polygonContains(coordinates2.map(ringRadians), pointRadians(point2));
      }
      function ringRadians(ring) {
        return ring = ring.map(pointRadians), ring.pop(), ring;
      }
      function pointRadians(point2) {
        return [point2[0] * radians, point2[1] * radians];
      }
      function contains(object2, point2) {
        return (object2 && containsObjectType.hasOwnProperty(object2.type) ? containsObjectType[object2.type] : containsGeometry)(object2, point2);
      }
      function graticuleX(y02, y12, dy) {
        var y = d3Array.range(y02, y12 - epsilon2, dy).concat(y12);
        return function(x) {
          return y.map(function(y2) {
            return [x, y2];
          });
        };
      }
      function graticuleY(x02, x12, dx) {
        var x = d3Array.range(x02, x12 - epsilon2, dx).concat(x12);
        return function(y) {
          return x.map(function(x2) {
            return [x2, y];
          });
        };
      }
      function graticule() {
        var x12, x02, X12, X02, y12, y02, Y12, Y02, dx = 10, dy = dx, DX = 90, DY = 360, x, y, X, Y, precision = 2.5;
        function graticule2() {
          return { type: "MultiLineString", coordinates: lines() };
        }
        function lines() {
          return d3Array.range(ceil(X02 / DX) * DX, X12, DX).map(X).concat(d3Array.range(ceil(Y02 / DY) * DY, Y12, DY).map(Y)).concat(d3Array.range(ceil(x02 / dx) * dx, x12, dx).filter(function(x2) {
            return abs(x2 % DX) > epsilon2;
          }).map(x)).concat(d3Array.range(ceil(y02 / dy) * dy, y12, dy).filter(function(y2) {
            return abs(y2 % DY) > epsilon2;
          }).map(y));
        }
        graticule2.lines = function() {
          return lines().map(function(coordinates2) {
            return { type: "LineString", coordinates: coordinates2 };
          });
        };
        graticule2.outline = function() {
          return {
            type: "Polygon",
            coordinates: [
              X(X02).concat(
                Y(Y12).slice(1),
                X(X12).reverse().slice(1),
                Y(Y02).reverse().slice(1)
              )
            ]
          };
        };
        graticule2.extent = function(_) {
          if (!arguments.length) return graticule2.extentMinor();
          return graticule2.extentMajor(_).extentMinor(_);
        };
        graticule2.extentMajor = function(_) {
          if (!arguments.length) return [[X02, Y02], [X12, Y12]];
          X02 = +_[0][0], X12 = +_[1][0];
          Y02 = +_[0][1], Y12 = +_[1][1];
          if (X02 > X12) _ = X02, X02 = X12, X12 = _;
          if (Y02 > Y12) _ = Y02, Y02 = Y12, Y12 = _;
          return graticule2.precision(precision);
        };
        graticule2.extentMinor = function(_) {
          if (!arguments.length) return [[x02, y02], [x12, y12]];
          x02 = +_[0][0], x12 = +_[1][0];
          y02 = +_[0][1], y12 = +_[1][1];
          if (x02 > x12) _ = x02, x02 = x12, x12 = _;
          if (y02 > y12) _ = y02, y02 = y12, y12 = _;
          return graticule2.precision(precision);
        };
        graticule2.step = function(_) {
          if (!arguments.length) return graticule2.stepMinor();
          return graticule2.stepMajor(_).stepMinor(_);
        };
        graticule2.stepMajor = function(_) {
          if (!arguments.length) return [DX, DY];
          DX = +_[0], DY = +_[1];
          return graticule2;
        };
        graticule2.stepMinor = function(_) {
          if (!arguments.length) return [dx, dy];
          dx = +_[0], dy = +_[1];
          return graticule2;
        };
        graticule2.precision = function(_) {
          if (!arguments.length) return precision;
          precision = +_;
          x = graticuleX(y02, y12, 90);
          y = graticuleY(x02, x12, precision);
          X = graticuleX(Y02, Y12, 90);
          Y = graticuleY(X02, X12, precision);
          return graticule2;
        };
        return graticule2.extentMajor([[-180, -90 + epsilon2], [180, 90 - epsilon2]]).extentMinor([[-180, -80 - epsilon2], [180, 80 + epsilon2]]);
      }
      function graticule10() {
        return graticule()();
      }
      function interpolate(a, b) {
        var x02 = a[0] * radians, y02 = a[1] * radians, x12 = b[0] * radians, y12 = b[1] * radians, cy0 = cos(y02), sy0 = sin(y02), cy1 = cos(y12), sy1 = sin(y12), kx0 = cy0 * cos(x02), ky0 = cy0 * sin(x02), kx1 = cy1 * cos(x12), ky1 = cy1 * sin(x12), d = 2 * asin(sqrt(haversin(y12 - y02) + cy0 * cy1 * haversin(x12 - x02))), k = sin(d);
        var interpolate2 = d ? function(t) {
          var B2 = sin(t *= d) / k, A = sin(d - t) / k, x = A * kx0 + B2 * kx1, y = A * ky0 + B2 * ky1, z = A * sy0 + B2 * sy1;
          return [
            atan2(y, x) * degrees,
            atan2(z, sqrt(x * x + y * y)) * degrees
          ];
        } : function() {
          return [x02 * degrees, y02 * degrees];
        };
        interpolate2.distance = d;
        return interpolate2;
      }
      var identity = (x) => x;
      var areaSum$1 = new d3Array.Adder(), areaRingSum$1 = new d3Array.Adder(), x00, y00, x0$1, y0$1;
      var areaStream$1 = {
        point: noop,
        lineStart: noop,
        lineEnd: noop,
        polygonStart: function() {
          areaStream$1.lineStart = areaRingStart$1;
          areaStream$1.lineEnd = areaRingEnd$1;
        },
        polygonEnd: function() {
          areaStream$1.lineStart = areaStream$1.lineEnd = areaStream$1.point = noop;
          areaSum$1.add(abs(areaRingSum$1));
          areaRingSum$1 = new d3Array.Adder();
        },
        result: function() {
          var area3 = areaSum$1 / 2;
          areaSum$1 = new d3Array.Adder();
          return area3;
        }
      };
      function areaRingStart$1() {
        areaStream$1.point = areaPointFirst$1;
      }
      function areaPointFirst$1(x, y) {
        areaStream$1.point = areaPoint$1;
        x00 = x0$1 = x, y00 = y0$1 = y;
      }
      function areaPoint$1(x, y) {
        areaRingSum$1.add(y0$1 * x - x0$1 * y);
        x0$1 = x, y0$1 = y;
      }
      function areaRingEnd$1() {
        areaPoint$1(x00, y00);
      }
      var x0$2 = Infinity, y0$2 = x0$2, x1 = -x0$2, y1 = x1;
      var boundsStream$1 = {
        point: boundsPoint$1,
        lineStart: noop,
        lineEnd: noop,
        polygonStart: noop,
        polygonEnd: noop,
        result: function() {
          var bounds2 = [[x0$2, y0$2], [x1, y1]];
          x1 = y1 = -(y0$2 = x0$2 = Infinity);
          return bounds2;
        }
      };
      function boundsPoint$1(x, y) {
        if (x < x0$2) x0$2 = x;
        if (x > x1) x1 = x;
        if (y < y0$2) y0$2 = y;
        if (y > y1) y1 = y;
      }
      var X0$1 = 0, Y0$1 = 0, Z0$1 = 0, X1$1 = 0, Y1$1 = 0, Z1$1 = 0, X2$1 = 0, Y2$1 = 0, Z2$1 = 0, x00$1, y00$1, x0$3, y0$3;
      var centroidStream$1 = {
        point: centroidPoint$1,
        lineStart: centroidLineStart$1,
        lineEnd: centroidLineEnd$1,
        polygonStart: function() {
          centroidStream$1.lineStart = centroidRingStart$1;
          centroidStream$1.lineEnd = centroidRingEnd$1;
        },
        polygonEnd: function() {
          centroidStream$1.point = centroidPoint$1;
          centroidStream$1.lineStart = centroidLineStart$1;
          centroidStream$1.lineEnd = centroidLineEnd$1;
        },
        result: function() {
          var centroid2 = Z2$1 ? [X2$1 / Z2$1, Y2$1 / Z2$1] : Z1$1 ? [X1$1 / Z1$1, Y1$1 / Z1$1] : Z0$1 ? [X0$1 / Z0$1, Y0$1 / Z0$1] : [NaN, NaN];
          X0$1 = Y0$1 = Z0$1 = X1$1 = Y1$1 = Z1$1 = X2$1 = Y2$1 = Z2$1 = 0;
          return centroid2;
        }
      };
      function centroidPoint$1(x, y) {
        X0$1 += x;
        Y0$1 += y;
        ++Z0$1;
      }
      function centroidLineStart$1() {
        centroidStream$1.point = centroidPointFirstLine;
      }
      function centroidPointFirstLine(x, y) {
        centroidStream$1.point = centroidPointLine;
        centroidPoint$1(x0$3 = x, y0$3 = y);
      }
      function centroidPointLine(x, y) {
        var dx = x - x0$3, dy = y - y0$3, z = sqrt(dx * dx + dy * dy);
        X1$1 += z * (x0$3 + x) / 2;
        Y1$1 += z * (y0$3 + y) / 2;
        Z1$1 += z;
        centroidPoint$1(x0$3 = x, y0$3 = y);
      }
      function centroidLineEnd$1() {
        centroidStream$1.point = centroidPoint$1;
      }
      function centroidRingStart$1() {
        centroidStream$1.point = centroidPointFirstRing;
      }
      function centroidRingEnd$1() {
        centroidPointRing(x00$1, y00$1);
      }
      function centroidPointFirstRing(x, y) {
        centroidStream$1.point = centroidPointRing;
        centroidPoint$1(x00$1 = x0$3 = x, y00$1 = y0$3 = y);
      }
      function centroidPointRing(x, y) {
        var dx = x - x0$3, dy = y - y0$3, z = sqrt(dx * dx + dy * dy);
        X1$1 += z * (x0$3 + x) / 2;
        Y1$1 += z * (y0$3 + y) / 2;
        Z1$1 += z;
        z = y0$3 * x - x0$3 * y;
        X2$1 += z * (x0$3 + x);
        Y2$1 += z * (y0$3 + y);
        Z2$1 += z * 3;
        centroidPoint$1(x0$3 = x, y0$3 = y);
      }
      function PathContext(context) {
        this._context = context;
      }
      PathContext.prototype = {
        _radius: 4.5,
        pointRadius: function(_) {
          return this._radius = _, this;
        },
        polygonStart: function() {
          this._line = 0;
        },
        polygonEnd: function() {
          this._line = NaN;
        },
        lineStart: function() {
          this._point = 0;
        },
        lineEnd: function() {
          if (this._line === 0) this._context.closePath();
          this._point = NaN;
        },
        point: function(x, y) {
          switch (this._point) {
            case 0: {
              this._context.moveTo(x, y);
              this._point = 1;
              break;
            }
            case 1: {
              this._context.lineTo(x, y);
              break;
            }
            default: {
              this._context.moveTo(x + this._radius, y);
              this._context.arc(x, y, this._radius, 0, tau);
              break;
            }
          }
        },
        result: noop
      };
      var lengthSum$1 = new d3Array.Adder(), lengthRing, x00$2, y00$2, x0$4, y0$4;
      var lengthStream$1 = {
        point: noop,
        lineStart: function() {
          lengthStream$1.point = lengthPointFirst$1;
        },
        lineEnd: function() {
          if (lengthRing) lengthPoint$1(x00$2, y00$2);
          lengthStream$1.point = noop;
        },
        polygonStart: function() {
          lengthRing = true;
        },
        polygonEnd: function() {
          lengthRing = null;
        },
        result: function() {
          var length2 = +lengthSum$1;
          lengthSum$1 = new d3Array.Adder();
          return length2;
        }
      };
      function lengthPointFirst$1(x, y) {
        lengthStream$1.point = lengthPoint$1;
        x00$2 = x0$4 = x, y00$2 = y0$4 = y;
      }
      function lengthPoint$1(x, y) {
        x0$4 -= x, y0$4 -= y;
        lengthSum$1.add(sqrt(x0$4 * x0$4 + y0$4 * y0$4));
        x0$4 = x, y0$4 = y;
      }
      function PathString() {
        this._string = [];
      }
      PathString.prototype = {
        _radius: 4.5,
        _circle: circle$1(4.5),
        pointRadius: function(_) {
          if ((_ = +_) !== this._radius) this._radius = _, this._circle = null;
          return this;
        },
        polygonStart: function() {
          this._line = 0;
        },
        polygonEnd: function() {
          this._line = NaN;
        },
        lineStart: function() {
          this._point = 0;
        },
        lineEnd: function() {
          if (this._line === 0) this._string.push("Z");
          this._point = NaN;
        },
        point: function(x, y) {
          switch (this._point) {
            case 0: {
              this._string.push("M", x, ",", y);
              this._point = 1;
              break;
            }
            case 1: {
              this._string.push("L", x, ",", y);
              break;
            }
            default: {
              if (this._circle == null) this._circle = circle$1(this._radius);
              this._string.push("M", x, ",", y, this._circle);
              break;
            }
          }
        },
        result: function() {
          if (this._string.length) {
            var result = this._string.join("");
            this._string = [];
            return result;
          } else {
            return null;
          }
        }
      };
      function circle$1(radius) {
        return "m0," + radius + "a" + radius + "," + radius + " 0 1,1 0," + -2 * radius + "a" + radius + "," + radius + " 0 1,1 0," + 2 * radius + "z";
      }
      function index(projection2, context) {
        var pointRadius = 4.5, projectionStream, contextStream;
        function path(object2) {
          if (object2) {
            if (typeof pointRadius === "function") contextStream.pointRadius(+pointRadius.apply(this, arguments));
            geoStream(object2, projectionStream(contextStream));
          }
          return contextStream.result();
        }
        path.area = function(object2) {
          geoStream(object2, projectionStream(areaStream$1));
          return areaStream$1.result();
        };
        path.measure = function(object2) {
          geoStream(object2, projectionStream(lengthStream$1));
          return lengthStream$1.result();
        };
        path.bounds = function(object2) {
          geoStream(object2, projectionStream(boundsStream$1));
          return boundsStream$1.result();
        };
        path.centroid = function(object2) {
          geoStream(object2, projectionStream(centroidStream$1));
          return centroidStream$1.result();
        };
        path.projection = function(_) {
          return arguments.length ? (projectionStream = _ == null ? (projection2 = null, identity) : (projection2 = _).stream, path) : projection2;
        };
        path.context = function(_) {
          if (!arguments.length) return context;
          contextStream = _ == null ? (context = null, new PathString()) : new PathContext(context = _);
          if (typeof pointRadius !== "function") contextStream.pointRadius(pointRadius);
          return path;
        };
        path.pointRadius = function(_) {
          if (!arguments.length) return pointRadius;
          pointRadius = typeof _ === "function" ? _ : (contextStream.pointRadius(+_), +_);
          return path;
        };
        return path.projection(projection2).context(context);
      }
      function transform(methods) {
        return {
          stream: transformer(methods)
        };
      }
      function transformer(methods) {
        return function(stream) {
          var s = new TransformStream();
          for (var key in methods) s[key] = methods[key];
          s.stream = stream;
          return s;
        };
      }
      function TransformStream() {
      }
      TransformStream.prototype = {
        constructor: TransformStream,
        point: function(x, y) {
          this.stream.point(x, y);
        },
        sphere: function() {
          this.stream.sphere();
        },
        lineStart: function() {
          this.stream.lineStart();
        },
        lineEnd: function() {
          this.stream.lineEnd();
        },
        polygonStart: function() {
          this.stream.polygonStart();
        },
        polygonEnd: function() {
          this.stream.polygonEnd();
        }
      };
      function fit(projection2, fitBounds, object2) {
        var clip2 = projection2.clipExtent && projection2.clipExtent();
        projection2.scale(150).translate([0, 0]);
        if (clip2 != null) projection2.clipExtent(null);
        geoStream(object2, projection2.stream(boundsStream$1));
        fitBounds(boundsStream$1.result());
        if (clip2 != null) projection2.clipExtent(clip2);
        return projection2;
      }
      function fitExtent(projection2, extent2, object2) {
        return fit(projection2, function(b) {
          var w = extent2[1][0] - extent2[0][0], h = extent2[1][1] - extent2[0][1], k = Math.min(w / (b[1][0] - b[0][0]), h / (b[1][1] - b[0][1])), x = +extent2[0][0] + (w - k * (b[1][0] + b[0][0])) / 2, y = +extent2[0][1] + (h - k * (b[1][1] + b[0][1])) / 2;
          projection2.scale(150 * k).translate([x, y]);
        }, object2);
      }
      function fitSize(projection2, size, object2) {
        return fitExtent(projection2, [[0, 0], size], object2);
      }
      function fitWidth(projection2, width, object2) {
        return fit(projection2, function(b) {
          var w = +width, k = w / (b[1][0] - b[0][0]), x = (w - k * (b[1][0] + b[0][0])) / 2, y = -k * b[0][1];
          projection2.scale(150 * k).translate([x, y]);
        }, object2);
      }
      function fitHeight(projection2, height, object2) {
        return fit(projection2, function(b) {
          var h = +height, k = h / (b[1][1] - b[0][1]), x = -k * b[0][0], y = (h - k * (b[1][1] + b[0][1])) / 2;
          projection2.scale(150 * k).translate([x, y]);
        }, object2);
      }
      var maxDepth = 16, cosMinDistance = cos(30 * radians);
      function resample(project, delta2) {
        return +delta2 ? resample$1(project, delta2) : resampleNone(project);
      }
      function resampleNone(project) {
        return transformer({
          point: function(x, y) {
            x = project(x, y);
            this.stream.point(x[0], x[1]);
          }
        });
      }
      function resample$1(project, delta2) {
        function resampleLineTo(x02, y02, lambda02, a0, b0, c0, x12, y12, lambda12, a1, b1, c1, depth, stream) {
          var dx = x12 - x02, dy = y12 - y02, d2 = dx * dx + dy * dy;
          if (d2 > 4 * delta2 && depth--) {
            var a = a0 + a1, b = b0 + b1, c = c0 + c1, m = sqrt(a * a + b * b + c * c), phi2 = asin(c /= m), lambda22 = abs(abs(c) - 1) < epsilon2 || abs(lambda02 - lambda12) < epsilon2 ? (lambda02 + lambda12) / 2 : atan2(b, a), p = project(lambda22, phi2), x2 = p[0], y2 = p[1], dx2 = x2 - x02, dy2 = y2 - y02, dz = dy * dx2 - dx * dy2;
            if (dz * dz / d2 > delta2 || abs((dx * dx2 + dy * dy2) / d2 - 0.5) > 0.3 || a0 * a1 + b0 * b1 + c0 * c1 < cosMinDistance) {
              resampleLineTo(x02, y02, lambda02, a0, b0, c0, x2, y2, lambda22, a /= m, b /= m, c, depth, stream);
              stream.point(x2, y2);
              resampleLineTo(x2, y2, lambda22, a, b, c, x12, y12, lambda12, a1, b1, c1, depth, stream);
            }
          }
        }
        return function(stream) {
          var lambda002, x002, y002, a00, b00, c00, lambda02, x02, y02, a0, b0, c0;
          var resampleStream = {
            point: point2,
            lineStart,
            lineEnd,
            polygonStart: function() {
              stream.polygonStart();
              resampleStream.lineStart = ringStart;
            },
            polygonEnd: function() {
              stream.polygonEnd();
              resampleStream.lineStart = lineStart;
            }
          };
          function point2(x, y) {
            x = project(x, y);
            stream.point(x[0], x[1]);
          }
          function lineStart() {
            x02 = NaN;
            resampleStream.point = linePoint2;
            stream.lineStart();
          }
          function linePoint2(lambda, phi) {
            var c = cartesian([lambda, phi]), p = project(lambda, phi);
            resampleLineTo(x02, y02, lambda02, a0, b0, c0, x02 = p[0], y02 = p[1], lambda02 = lambda, a0 = c[0], b0 = c[1], c0 = c[2], maxDepth, stream);
            stream.point(x02, y02);
          }
          function lineEnd() {
            resampleStream.point = point2;
            stream.lineEnd();
          }
          function ringStart() {
            lineStart();
            resampleStream.point = ringPoint;
            resampleStream.lineEnd = ringEnd;
          }
          function ringPoint(lambda, phi) {
            linePoint2(lambda002 = lambda, phi), x002 = x02, y002 = y02, a00 = a0, b00 = b0, c00 = c0;
            resampleStream.point = linePoint2;
          }
          function ringEnd() {
            resampleLineTo(x02, y02, lambda02, a0, b0, c0, x002, y002, lambda002, a00, b00, c00, maxDepth, stream);
            resampleStream.lineEnd = lineEnd;
            lineEnd();
          }
          return resampleStream;
        };
      }
      var transformRadians = transformer({
        point: function(x, y) {
          this.stream.point(x * radians, y * radians);
        }
      });
      function transformRotate(rotate) {
        return transformer({
          point: function(x, y) {
            var r = rotate(x, y);
            return this.stream.point(r[0], r[1]);
          }
        });
      }
      function scaleTranslate(k, dx, dy, sx, sy) {
        function transform2(x, y) {
          x *= sx;
          y *= sy;
          return [dx + k * x, dy - k * y];
        }
        transform2.invert = function(x, y) {
          return [(x - dx) / k * sx, (dy - y) / k * sy];
        };
        return transform2;
      }
      function scaleTranslateRotate(k, dx, dy, sx, sy, alpha) {
        if (!alpha) return scaleTranslate(k, dx, dy, sx, sy);
        var cosAlpha = cos(alpha), sinAlpha = sin(alpha), a = cosAlpha * k, b = sinAlpha * k, ai = cosAlpha / k, bi = sinAlpha / k, ci = (sinAlpha * dy - cosAlpha * dx) / k, fi = (sinAlpha * dx + cosAlpha * dy) / k;
        function transform2(x, y) {
          x *= sx;
          y *= sy;
          return [a * x - b * y + dx, dy - b * x - a * y];
        }
        transform2.invert = function(x, y) {
          return [sx * (ai * x - bi * y + ci), sy * (fi - bi * x - ai * y)];
        };
        return transform2;
      }
      function projection(project) {
        return projectionMutator(function() {
          return project;
        })();
      }
      function projectionMutator(projectAt) {
        var project, k = 150, x = 480, y = 250, lambda = 0, phi = 0, deltaLambda = 0, deltaPhi = 0, deltaGamma = 0, rotate, alpha = 0, sx = 1, sy = 1, theta = null, preclip = clipAntimeridian, x02 = null, y02, x12, y12, postclip = identity, delta2 = 0.5, projectResample, projectTransform, projectRotateTransform, cache, cacheStream;
        function projection2(point2) {
          return projectRotateTransform(point2[0] * radians, point2[1] * radians);
        }
        function invert(point2) {
          point2 = projectRotateTransform.invert(point2[0], point2[1]);
          return point2 && [point2[0] * degrees, point2[1] * degrees];
        }
        projection2.stream = function(stream) {
          return cache && cacheStream === stream ? cache : cache = transformRadians(transformRotate(rotate)(preclip(projectResample(postclip(cacheStream = stream)))));
        };
        projection2.preclip = function(_) {
          return arguments.length ? (preclip = _, theta = void 0, reset()) : preclip;
        };
        projection2.postclip = function(_) {
          return arguments.length ? (postclip = _, x02 = y02 = x12 = y12 = null, reset()) : postclip;
        };
        projection2.clipAngle = function(_) {
          return arguments.length ? (preclip = +_ ? clipCircle(theta = _ * radians) : (theta = null, clipAntimeridian), reset()) : theta * degrees;
        };
        projection2.clipExtent = function(_) {
          return arguments.length ? (postclip = _ == null ? (x02 = y02 = x12 = y12 = null, identity) : clipRectangle(x02 = +_[0][0], y02 = +_[0][1], x12 = +_[1][0], y12 = +_[1][1]), reset()) : x02 == null ? null : [[x02, y02], [x12, y12]];
        };
        projection2.scale = function(_) {
          return arguments.length ? (k = +_, recenter()) : k;
        };
        projection2.translate = function(_) {
          return arguments.length ? (x = +_[0], y = +_[1], recenter()) : [x, y];
        };
        projection2.center = function(_) {
          return arguments.length ? (lambda = _[0] % 360 * radians, phi = _[1] % 360 * radians, recenter()) : [lambda * degrees, phi * degrees];
        };
        projection2.rotate = function(_) {
          return arguments.length ? (deltaLambda = _[0] % 360 * radians, deltaPhi = _[1] % 360 * radians, deltaGamma = _.length > 2 ? _[2] % 360 * radians : 0, recenter()) : [deltaLambda * degrees, deltaPhi * degrees, deltaGamma * degrees];
        };
        projection2.angle = function(_) {
          return arguments.length ? (alpha = _ % 360 * radians, recenter()) : alpha * degrees;
        };
        projection2.reflectX = function(_) {
          return arguments.length ? (sx = _ ? -1 : 1, recenter()) : sx < 0;
        };
        projection2.reflectY = function(_) {
          return arguments.length ? (sy = _ ? -1 : 1, recenter()) : sy < 0;
        };
        projection2.precision = function(_) {
          return arguments.length ? (projectResample = resample(projectTransform, delta2 = _ * _), reset()) : sqrt(delta2);
        };
        projection2.fitExtent = function(extent2, object2) {
          return fitExtent(projection2, extent2, object2);
        };
        projection2.fitSize = function(size, object2) {
          return fitSize(projection2, size, object2);
        };
        projection2.fitWidth = function(width, object2) {
          return fitWidth(projection2, width, object2);
        };
        projection2.fitHeight = function(height, object2) {
          return fitHeight(projection2, height, object2);
        };
        function recenter() {
          var center2 = scaleTranslateRotate(k, 0, 0, sx, sy, alpha).apply(null, project(lambda, phi)), transform2 = scaleTranslateRotate(k, x - center2[0], y - center2[1], sx, sy, alpha);
          rotate = rotateRadians(deltaLambda, deltaPhi, deltaGamma);
          projectTransform = compose(project, transform2);
          projectRotateTransform = compose(rotate, projectTransform);
          projectResample = resample(projectTransform, delta2);
          return reset();
        }
        function reset() {
          cache = cacheStream = null;
          return projection2;
        }
        return function() {
          project = projectAt.apply(this, arguments);
          projection2.invert = project.invert && invert;
          return recenter();
        };
      }
      function conicProjection(projectAt) {
        var phi02 = 0, phi12 = pi / 3, m = projectionMutator(projectAt), p = m(phi02, phi12);
        p.parallels = function(_) {
          return arguments.length ? m(phi02 = _[0] * radians, phi12 = _[1] * radians) : [phi02 * degrees, phi12 * degrees];
        };
        return p;
      }
      function cylindricalEqualAreaRaw(phi02) {
        var cosPhi02 = cos(phi02);
        function forward(lambda, phi) {
          return [lambda * cosPhi02, sin(phi) / cosPhi02];
        }
        forward.invert = function(x, y) {
          return [x / cosPhi02, asin(y * cosPhi02)];
        };
        return forward;
      }
      function conicEqualAreaRaw(y02, y12) {
        var sy0 = sin(y02), n = (sy0 + sin(y12)) / 2;
        if (abs(n) < epsilon2) return cylindricalEqualAreaRaw(y02);
        var c = 1 + sy0 * (2 * n - sy0), r0 = sqrt(c) / n;
        function project(x, y) {
          var r = sqrt(c - 2 * n * sin(y)) / n;
          return [r * sin(x *= n), r0 - r * cos(x)];
        }
        project.invert = function(x, y) {
          var r0y = r0 - y, l = atan2(x, abs(r0y)) * sign(r0y);
          if (r0y * n < 0)
            l -= pi * sign(x) * sign(r0y);
          return [l / n, asin((c - (x * x + r0y * r0y) * n * n) / (2 * n))];
        };
        return project;
      }
      function conicEqualArea() {
        return conicProjection(conicEqualAreaRaw).scale(155.424).center([0, 33.6442]);
      }
      function albers() {
        return conicEqualArea().parallels([29.5, 45.5]).scale(1070).translate([480, 250]).rotate([96, 0]).center([-0.6, 38.7]);
      }
      function multiplex(streams) {
        var n = streams.length;
        return {
          point: function(x, y) {
            var i = -1;
            while (++i < n) streams[i].point(x, y);
          },
          sphere: function() {
            var i = -1;
            while (++i < n) streams[i].sphere();
          },
          lineStart: function() {
            var i = -1;
            while (++i < n) streams[i].lineStart();
          },
          lineEnd: function() {
            var i = -1;
            while (++i < n) streams[i].lineEnd();
          },
          polygonStart: function() {
            var i = -1;
            while (++i < n) streams[i].polygonStart();
          },
          polygonEnd: function() {
            var i = -1;
            while (++i < n) streams[i].polygonEnd();
          }
        };
      }
      function albersUsa() {
        var cache, cacheStream, lower48 = albers(), lower48Point, alaska = conicEqualArea().rotate([154, 0]).center([-2, 58.5]).parallels([55, 65]), alaskaPoint, hawaii = conicEqualArea().rotate([157, 0]).center([-3, 19.9]).parallels([8, 18]), hawaiiPoint, point2, pointStream = { point: function(x, y) {
          point2 = [x, y];
        } };
        function albersUsa2(coordinates2) {
          var x = coordinates2[0], y = coordinates2[1];
          return point2 = null, (lower48Point.point(x, y), point2) || (alaskaPoint.point(x, y), point2) || (hawaiiPoint.point(x, y), point2);
        }
        albersUsa2.invert = function(coordinates2) {
          var k = lower48.scale(), t = lower48.translate(), x = (coordinates2[0] - t[0]) / k, y = (coordinates2[1] - t[1]) / k;
          return (y >= 0.12 && y < 0.234 && x >= -0.425 && x < -0.214 ? alaska : y >= 0.166 && y < 0.234 && x >= -0.214 && x < -0.115 ? hawaii : lower48).invert(coordinates2);
        };
        albersUsa2.stream = function(stream) {
          return cache && cacheStream === stream ? cache : cache = multiplex([lower48.stream(cacheStream = stream), alaska.stream(stream), hawaii.stream(stream)]);
        };
        albersUsa2.precision = function(_) {
          if (!arguments.length) return lower48.precision();
          lower48.precision(_), alaska.precision(_), hawaii.precision(_);
          return reset();
        };
        albersUsa2.scale = function(_) {
          if (!arguments.length) return lower48.scale();
          lower48.scale(_), alaska.scale(_ * 0.35), hawaii.scale(_);
          return albersUsa2.translate(lower48.translate());
        };
        albersUsa2.translate = function(_) {
          if (!arguments.length) return lower48.translate();
          var k = lower48.scale(), x = +_[0], y = +_[1];
          lower48Point = lower48.translate(_).clipExtent([[x - 0.455 * k, y - 0.238 * k], [x + 0.455 * k, y + 0.238 * k]]).stream(pointStream);
          alaskaPoint = alaska.translate([x - 0.307 * k, y + 0.201 * k]).clipExtent([[x - 0.425 * k + epsilon2, y + 0.12 * k + epsilon2], [x - 0.214 * k - epsilon2, y + 0.234 * k - epsilon2]]).stream(pointStream);
          hawaiiPoint = hawaii.translate([x - 0.205 * k, y + 0.212 * k]).clipExtent([[x - 0.214 * k + epsilon2, y + 0.166 * k + epsilon2], [x - 0.115 * k - epsilon2, y + 0.234 * k - epsilon2]]).stream(pointStream);
          return reset();
        };
        albersUsa2.fitExtent = function(extent2, object2) {
          return fitExtent(albersUsa2, extent2, object2);
        };
        albersUsa2.fitSize = function(size, object2) {
          return fitSize(albersUsa2, size, object2);
        };
        albersUsa2.fitWidth = function(width, object2) {
          return fitWidth(albersUsa2, width, object2);
        };
        albersUsa2.fitHeight = function(height, object2) {
          return fitHeight(albersUsa2, height, object2);
        };
        function reset() {
          cache = cacheStream = null;
          return albersUsa2;
        }
        return albersUsa2.scale(1070);
      }
      function azimuthalRaw(scale2) {
        return function(x, y) {
          var cx = cos(x), cy = cos(y), k = scale2(cx * cy);
          if (k === Infinity) return [2, 0];
          return [
            k * cy * sin(x),
            k * sin(y)
          ];
        };
      }
      function azimuthalInvert(angle2) {
        return function(x, y) {
          var z = sqrt(x * x + y * y), c = angle2(z), sc = sin(c), cc2 = cos(c);
          return [
            atan2(x * sc, z * cc2),
            asin(z && y * sc / z)
          ];
        };
      }
      var azimuthalEqualAreaRaw = azimuthalRaw(function(cxcy) {
        return sqrt(2 / (1 + cxcy));
      });
      azimuthalEqualAreaRaw.invert = azimuthalInvert(function(z) {
        return 2 * asin(z / 2);
      });
      function azimuthalEqualArea() {
        return projection(azimuthalEqualAreaRaw).scale(124.75).clipAngle(180 - 1e-3);
      }
      var azimuthalEquidistantRaw = azimuthalRaw(function(c) {
        return (c = acos(c)) && c / sin(c);
      });
      azimuthalEquidistantRaw.invert = azimuthalInvert(function(z) {
        return z;
      });
      function azimuthalEquidistant() {
        return projection(azimuthalEquidistantRaw).scale(79.4188).clipAngle(180 - 1e-3);
      }
      function mercatorRaw(lambda, phi) {
        return [lambda, log(tan((halfPi + phi) / 2))];
      }
      mercatorRaw.invert = function(x, y) {
        return [x, 2 * atan(exp(y)) - halfPi];
      };
      function mercator() {
        return mercatorProjection(mercatorRaw).scale(961 / tau);
      }
      function mercatorProjection(project) {
        var m = projection(project), center2 = m.center, scale2 = m.scale, translate = m.translate, clipExtent = m.clipExtent, x02 = null, y02, x12, y12;
        m.scale = function(_) {
          return arguments.length ? (scale2(_), reclip()) : scale2();
        };
        m.translate = function(_) {
          return arguments.length ? (translate(_), reclip()) : translate();
        };
        m.center = function(_) {
          return arguments.length ? (center2(_), reclip()) : center2();
        };
        m.clipExtent = function(_) {
          return arguments.length ? (_ == null ? x02 = y02 = x12 = y12 = null : (x02 = +_[0][0], y02 = +_[0][1], x12 = +_[1][0], y12 = +_[1][1]), reclip()) : x02 == null ? null : [[x02, y02], [x12, y12]];
        };
        function reclip() {
          var k = pi * scale2(), t = m(rotation(m.rotate()).invert([0, 0]));
          return clipExtent(x02 == null ? [[t[0] - k, t[1] - k], [t[0] + k, t[1] + k]] : project === mercatorRaw ? [[Math.max(t[0] - k, x02), y02], [Math.min(t[0] + k, x12), y12]] : [[x02, Math.max(t[1] - k, y02)], [x12, Math.min(t[1] + k, y12)]]);
        }
        return reclip();
      }
      function tany(y) {
        return tan((halfPi + y) / 2);
      }
      function conicConformalRaw(y02, y12) {
        var cy0 = cos(y02), n = y02 === y12 ? sin(y02) : log(cy0 / cos(y12)) / log(tany(y12) / tany(y02)), f = cy0 * pow(tany(y02), n) / n;
        if (!n) return mercatorRaw;
        function project(x, y) {
          if (f > 0) {
            if (y < -halfPi + epsilon2) y = -halfPi + epsilon2;
          } else {
            if (y > halfPi - epsilon2) y = halfPi - epsilon2;
          }
          var r = f / pow(tany(y), n);
          return [r * sin(n * x), f - r * cos(n * x)];
        }
        project.invert = function(x, y) {
          var fy = f - y, r = sign(n) * sqrt(x * x + fy * fy), l = atan2(x, abs(fy)) * sign(fy);
          if (fy * n < 0)
            l -= pi * sign(x) * sign(fy);
          return [l / n, 2 * atan(pow(f / r, 1 / n)) - halfPi];
        };
        return project;
      }
      function conicConformal() {
        return conicProjection(conicConformalRaw).scale(109.5).parallels([30, 30]);
      }
      function equirectangularRaw(lambda, phi) {
        return [lambda, phi];
      }
      equirectangularRaw.invert = equirectangularRaw;
      function equirectangular() {
        return projection(equirectangularRaw).scale(152.63);
      }
      function conicEquidistantRaw(y02, y12) {
        var cy0 = cos(y02), n = y02 === y12 ? sin(y02) : (cy0 - cos(y12)) / (y12 - y02), g = cy0 / n + y02;
        if (abs(n) < epsilon2) return equirectangularRaw;
        function project(x, y) {
          var gy = g - y, nx = n * x;
          return [gy * sin(nx), g - gy * cos(nx)];
        }
        project.invert = function(x, y) {
          var gy = g - y, l = atan2(x, abs(gy)) * sign(gy);
          if (gy * n < 0)
            l -= pi * sign(x) * sign(gy);
          return [l / n, g - sign(n) * sqrt(x * x + gy * gy)];
        };
        return project;
      }
      function conicEquidistant() {
        return conicProjection(conicEquidistantRaw).scale(131.154).center([0, 13.9389]);
      }
      var A1 = 1.340264, A2 = -0.081106, A3 = 893e-6, A4 = 3796e-6, M = sqrt(3) / 2, iterations = 12;
      function equalEarthRaw(lambda, phi) {
        var l = asin(M * sin(phi)), l2 = l * l, l6 = l2 * l2 * l2;
        return [
          lambda * cos(l) / (M * (A1 + 3 * A2 * l2 + l6 * (7 * A3 + 9 * A4 * l2))),
          l * (A1 + A2 * l2 + l6 * (A3 + A4 * l2))
        ];
      }
      equalEarthRaw.invert = function(x, y) {
        var l = y, l2 = l * l, l6 = l2 * l2 * l2;
        for (var i = 0, delta, fy, fpy; i < iterations; ++i) {
          fy = l * (A1 + A2 * l2 + l6 * (A3 + A4 * l2)) - y;
          fpy = A1 + 3 * A2 * l2 + l6 * (7 * A3 + 9 * A4 * l2);
          l -= delta = fy / fpy, l2 = l * l, l6 = l2 * l2 * l2;
          if (abs(delta) < epsilon22) break;
        }
        return [
          M * x * (A1 + 3 * A2 * l2 + l6 * (7 * A3 + 9 * A4 * l2)) / cos(l),
          asin(sin(l) / M)
        ];
      };
      function equalEarth() {
        return projection(equalEarthRaw).scale(177.158);
      }
      function gnomonicRaw(x, y) {
        var cy = cos(y), k = cos(x) * cy;
        return [cy * sin(x) / k, sin(y) / k];
      }
      gnomonicRaw.invert = azimuthalInvert(atan);
      function gnomonic() {
        return projection(gnomonicRaw).scale(144.049).clipAngle(60);
      }
      function identity$1() {
        var k = 1, tx = 0, ty = 0, sx = 1, sy = 1, alpha = 0, ca3, sa, x02 = null, y02, x12, y12, kx = 1, ky = 1, transform2 = transformer({
          point: function(x, y) {
            var p = projection2([x, y]);
            this.stream.point(p[0], p[1]);
          }
        }), postclip = identity, cache, cacheStream;
        function reset() {
          kx = k * sx;
          ky = k * sy;
          cache = cacheStream = null;
          return projection2;
        }
        function projection2(p) {
          var x = p[0] * kx, y = p[1] * ky;
          if (alpha) {
            var t = y * ca3 - x * sa;
            x = x * ca3 + y * sa;
            y = t;
          }
          return [x + tx, y + ty];
        }
        projection2.invert = function(p) {
          var x = p[0] - tx, y = p[1] - ty;
          if (alpha) {
            var t = y * ca3 + x * sa;
            x = x * ca3 - y * sa;
            y = t;
          }
          return [x / kx, y / ky];
        };
        projection2.stream = function(stream) {
          return cache && cacheStream === stream ? cache : cache = transform2(postclip(cacheStream = stream));
        };
        projection2.postclip = function(_) {
          return arguments.length ? (postclip = _, x02 = y02 = x12 = y12 = null, reset()) : postclip;
        };
        projection2.clipExtent = function(_) {
          return arguments.length ? (postclip = _ == null ? (x02 = y02 = x12 = y12 = null, identity) : clipRectangle(x02 = +_[0][0], y02 = +_[0][1], x12 = +_[1][0], y12 = +_[1][1]), reset()) : x02 == null ? null : [[x02, y02], [x12, y12]];
        };
        projection2.scale = function(_) {
          return arguments.length ? (k = +_, reset()) : k;
        };
        projection2.translate = function(_) {
          return arguments.length ? (tx = +_[0], ty = +_[1], reset()) : [tx, ty];
        };
        projection2.angle = function(_) {
          return arguments.length ? (alpha = _ % 360 * radians, sa = sin(alpha), ca3 = cos(alpha), reset()) : alpha * degrees;
        };
        projection2.reflectX = function(_) {
          return arguments.length ? (sx = _ ? -1 : 1, reset()) : sx < 0;
        };
        projection2.reflectY = function(_) {
          return arguments.length ? (sy = _ ? -1 : 1, reset()) : sy < 0;
        };
        projection2.fitExtent = function(extent2, object2) {
          return fitExtent(projection2, extent2, object2);
        };
        projection2.fitSize = function(size, object2) {
          return fitSize(projection2, size, object2);
        };
        projection2.fitWidth = function(width, object2) {
          return fitWidth(projection2, width, object2);
        };
        projection2.fitHeight = function(height, object2) {
          return fitHeight(projection2, height, object2);
        };
        return projection2;
      }
      function naturalEarth1Raw(lambda, phi) {
        var phi2 = phi * phi, phi4 = phi2 * phi2;
        return [
          lambda * (0.8707 - 0.131979 * phi2 + phi4 * (-0.013791 + phi4 * (3971e-6 * phi2 - 1529e-6 * phi4))),
          phi * (1.007226 + phi2 * (0.015085 + phi4 * (-0.044475 + 0.028874 * phi2 - 5916e-6 * phi4)))
        ];
      }
      naturalEarth1Raw.invert = function(x, y) {
        var phi = y, i = 25, delta;
        do {
          var phi2 = phi * phi, phi4 = phi2 * phi2;
          phi -= delta = (phi * (1.007226 + phi2 * (0.015085 + phi4 * (-0.044475 + 0.028874 * phi2 - 5916e-6 * phi4))) - y) / (1.007226 + phi2 * (0.015085 * 3 + phi4 * (-0.044475 * 7 + 0.028874 * 9 * phi2 - 5916e-6 * 11 * phi4)));
        } while (abs(delta) > epsilon2 && --i > 0);
        return [
          x / (0.8707 + (phi2 = phi * phi) * (-0.131979 + phi2 * (-0.013791 + phi2 * phi2 * phi2 * (3971e-6 - 1529e-6 * phi2)))),
          phi
        ];
      };
      function naturalEarth1() {
        return projection(naturalEarth1Raw).scale(175.295);
      }
      function orthographicRaw(x, y) {
        return [cos(y) * sin(x), sin(y)];
      }
      orthographicRaw.invert = azimuthalInvert(asin);
      function orthographic() {
        return projection(orthographicRaw).scale(249.5).clipAngle(90 + epsilon2);
      }
      function stereographicRaw(x, y) {
        var cy = cos(y), k = 1 + cos(x) * cy;
        return [cy * sin(x) / k, sin(y) / k];
      }
      stereographicRaw.invert = azimuthalInvert(function(z) {
        return 2 * atan(z);
      });
      function stereographic() {
        return projection(stereographicRaw).scale(250).clipAngle(142);
      }
      function transverseMercatorRaw(lambda, phi) {
        return [log(tan((halfPi + phi) / 2)), -lambda];
      }
      transverseMercatorRaw.invert = function(x, y) {
        return [-y, 2 * atan(exp(x)) - halfPi];
      };
      function transverseMercator() {
        var m = mercatorProjection(transverseMercatorRaw), center2 = m.center, rotate = m.rotate;
        m.center = function(_) {
          return arguments.length ? center2([-_[1], _[0]]) : (_ = center2(), [_[1], -_[0]]);
        };
        m.rotate = function(_) {
          return arguments.length ? rotate([_[0], _[1], _.length > 2 ? _[2] + 90 : 90]) : (_ = rotate(), [_[0], _[1], _[2] - 90]);
        };
        return rotate([0, 0, 90]).scale(159.155);
      }
      exports2.geoAlbers = albers;
      exports2.geoAlbersUsa = albersUsa;
      exports2.geoArea = area2;
      exports2.geoAzimuthalEqualArea = azimuthalEqualArea;
      exports2.geoAzimuthalEqualAreaRaw = azimuthalEqualAreaRaw;
      exports2.geoAzimuthalEquidistant = azimuthalEquidistant;
      exports2.geoAzimuthalEquidistantRaw = azimuthalEquidistantRaw;
      exports2.geoBounds = bounds;
      exports2.geoCentroid = centroid;
      exports2.geoCircle = circle;
      exports2.geoClipAntimeridian = clipAntimeridian;
      exports2.geoClipCircle = clipCircle;
      exports2.geoClipExtent = extent;
      exports2.geoClipRectangle = clipRectangle;
      exports2.geoConicConformal = conicConformal;
      exports2.geoConicConformalRaw = conicConformalRaw;
      exports2.geoConicEqualArea = conicEqualArea;
      exports2.geoConicEqualAreaRaw = conicEqualAreaRaw;
      exports2.geoConicEquidistant = conicEquidistant;
      exports2.geoConicEquidistantRaw = conicEquidistantRaw;
      exports2.geoContains = contains;
      exports2.geoDistance = distance;
      exports2.geoEqualEarth = equalEarth;
      exports2.geoEqualEarthRaw = equalEarthRaw;
      exports2.geoEquirectangular = equirectangular;
      exports2.geoEquirectangularRaw = equirectangularRaw;
      exports2.geoGnomonic = gnomonic;
      exports2.geoGnomonicRaw = gnomonicRaw;
      exports2.geoGraticule = graticule;
      exports2.geoGraticule10 = graticule10;
      exports2.geoIdentity = identity$1;
      exports2.geoInterpolate = interpolate;
      exports2.geoLength = length;
      exports2.geoMercator = mercator;
      exports2.geoMercatorRaw = mercatorRaw;
      exports2.geoNaturalEarth1 = naturalEarth1;
      exports2.geoNaturalEarth1Raw = naturalEarth1Raw;
      exports2.geoOrthographic = orthographic;
      exports2.geoOrthographicRaw = orthographicRaw;
      exports2.geoPath = index;
      exports2.geoProjection = projection;
      exports2.geoProjectionMutator = projectionMutator;
      exports2.geoRotation = rotation;
      exports2.geoStereographic = stereographic;
      exports2.geoStereographicRaw = stereographicRaw;
      exports2.geoStream = geoStream;
      exports2.geoTransform = transform;
      exports2.geoTransverseMercator = transverseMercator;
      exports2.geoTransverseMercatorRaw = transverseMercatorRaw;
      Object.defineProperty(exports2, "__esModule", { value: true });
    });
  }
});

// node_modules/point-in-polygon/flat.js
var require_flat = __commonJS({
  "node_modules/point-in-polygon/flat.js"(exports, module) {
    module.exports = function pointInPolygonFlat(point2, vs, start, end) {
      var x = point2[0], y = point2[1];
      var inside = false;
      if (start === void 0) start = 0;
      if (end === void 0) end = vs.length;
      var len = (end - start) / 2;
      for (var i = 0, j = len - 1; i < len; j = i++) {
        var xi = vs[start + i * 2 + 0], yi = vs[start + i * 2 + 1];
        var xj = vs[start + j * 2 + 0], yj = vs[start + j * 2 + 1];
        var intersect = yi > y !== yj > y && x < (xj - xi) * (y - yi) / (yj - yi) + xi;
        if (intersect) inside = !inside;
      }
      return inside;
    };
  }
});

// node_modules/point-in-polygon/nested.js
var require_nested = __commonJS({
  "node_modules/point-in-polygon/nested.js"(exports, module) {
    module.exports = function pointInPolygonNested(point2, vs, start, end) {
      var x = point2[0], y = point2[1];
      var inside = false;
      if (start === void 0) start = 0;
      if (end === void 0) end = vs.length;
      var len = end - start;
      for (var i = 0, j = len - 1; i < len; j = i++) {
        var xi = vs[i + start][0], yi = vs[i + start][1];
        var xj = vs[j + start][0], yj = vs[j + start][1];
        var intersect = yi > y !== yj > y && x < (xj - xi) * (y - yi) / (yj - yi) + xi;
        if (intersect) inside = !inside;
      }
      return inside;
    };
  }
});

// node_modules/point-in-polygon/index.js
var require_point_in_polygon = __commonJS({
  "node_modules/point-in-polygon/index.js"(exports, module) {
    var pointInPolygonFlat = require_flat();
    var pointInPolygonNested = require_nested();
    module.exports = function pointInPolygon2(point2, vs, start, end) {
      if (vs.length > 0 && Array.isArray(vs[0])) {
        return pointInPolygonNested(point2, vs, start, end);
      } else {
        return pointInPolygonFlat(point2, vs, start, end);
      }
    };
    module.exports.nested = pointInPolygonNested;
    module.exports.flat = pointInPolygonFlat;
  }
});

// node_modules/robust-predicates/umd/orient2d.min.js
var require_orient2d_min = __commonJS({
  "node_modules/robust-predicates/umd/orient2d.min.js"(exports, module) {
    !(function(t, e) {
      "object" == typeof exports && "undefined" != typeof module ? e(exports) : "function" == typeof define && define.amd ? define(["exports"], e) : e((t = t || self).predicates = {});
    })(exports, function(t) {
      "use strict";
      const e = 134217729, n = 33306690738754706e-32;
      function r(t2, e2, n2, r2, o2) {
        let f2, i2, u5, c2, s2 = e2[0], a2 = r2[0], d2 = 0, l2 = 0;
        a2 > s2 == a2 > -s2 ? (f2 = s2, s2 = e2[++d2]) : (f2 = a2, a2 = r2[++l2]);
        let p = 0;
        if (d2 < t2 && l2 < n2) for (a2 > s2 == a2 > -s2 ? (u5 = f2 - ((i2 = s2 + f2) - s2), s2 = e2[++d2]) : (u5 = f2 - ((i2 = a2 + f2) - a2), a2 = r2[++l2]), f2 = i2, 0 !== u5 && (o2[p++] = u5); d2 < t2 && l2 < n2; ) a2 > s2 == a2 > -s2 ? (u5 = f2 - ((i2 = f2 + s2) - (c2 = i2 - f2)) + (s2 - c2), s2 = e2[++d2]) : (u5 = f2 - ((i2 = f2 + a2) - (c2 = i2 - f2)) + (a2 - c2), a2 = r2[++l2]), f2 = i2, 0 !== u5 && (o2[p++] = u5);
        for (; d2 < t2; ) u5 = f2 - ((i2 = f2 + s2) - (c2 = i2 - f2)) + (s2 - c2), s2 = e2[++d2], f2 = i2, 0 !== u5 && (o2[p++] = u5);
        for (; l2 < n2; ) u5 = f2 - ((i2 = f2 + a2) - (c2 = i2 - f2)) + (a2 - c2), a2 = r2[++l2], f2 = i2, 0 !== u5 && (o2[p++] = u5);
        return 0 === f2 && 0 !== p || (o2[p++] = f2), p;
      }
      function o(t2) {
        return new Float64Array(t2);
      }
      const f = 33306690738754716e-32, i = 22204460492503146e-32, u4 = 11093356479670487e-47, c = o(4), s = o(8), a = o(12), d = o(16), l = o(4);
      t.orient2d = function(t2, o2, p, b, y, h) {
        const M = (o2 - h) * (p - y), x = (t2 - y) * (b - h), j = M - x;
        if (0 === M || 0 === x || M > 0 != x > 0) return j;
        const m = Math.abs(M + x);
        return Math.abs(j) >= f * m ? j : -(function(t3, o3, f2, p2, b2, y2, h2) {
          let M2, x2, j2, m2, _, v2, w, A, F, O, P, g, k, q, z, B2, C, D2;
          const E = t3 - b2, G = f2 - b2, H = o3 - y2, I = p2 - y2;
          _ = (z = (A = E - (w = (v2 = e * E) - (v2 - E))) * (O = I - (F = (v2 = e * I) - (v2 - I))) - ((q = E * I) - w * F - A * F - w * O)) - (P = z - (C = (A = H - (w = (v2 = e * H) - (v2 - H))) * (O = G - (F = (v2 = e * G) - (v2 - G))) - ((B2 = H * G) - w * F - A * F - w * O))), c[0] = z - (P + _) + (_ - C), _ = (k = q - ((g = q + P) - (_ = g - q)) + (P - _)) - (P = k - B2), c[1] = k - (P + _) + (_ - B2), _ = (D2 = g + P) - g, c[2] = g - (D2 - _) + (P - _), c[3] = D2;
          let J = (function(t4, e2) {
            let n2 = e2[0];
            for (let r2 = 1; r2 < t4; r2++) n2 += e2[r2];
            return n2;
          })(4, c), K = i * h2;
          if (J >= K || -J >= K) return J;
          if (M2 = t3 - (E + (_ = t3 - E)) + (_ - b2), j2 = f2 - (G + (_ = f2 - G)) + (_ - b2), x2 = o3 - (H + (_ = o3 - H)) + (_ - y2), m2 = p2 - (I + (_ = p2 - I)) + (_ - y2), 0 === M2 && 0 === x2 && 0 === j2 && 0 === m2) return J;
          if (K = u4 * h2 + n * Math.abs(J), (J += E * m2 + I * M2 - (H * j2 + G * x2)) >= K || -J >= K) return J;
          _ = (z = (A = M2 - (w = (v2 = e * M2) - (v2 - M2))) * (O = I - (F = (v2 = e * I) - (v2 - I))) - ((q = M2 * I) - w * F - A * F - w * O)) - (P = z - (C = (A = x2 - (w = (v2 = e * x2) - (v2 - x2))) * (O = G - (F = (v2 = e * G) - (v2 - G))) - ((B2 = x2 * G) - w * F - A * F - w * O))), l[0] = z - (P + _) + (_ - C), _ = (k = q - ((g = q + P) - (_ = g - q)) + (P - _)) - (P = k - B2), l[1] = k - (P + _) + (_ - B2), _ = (D2 = g + P) - g, l[2] = g - (D2 - _) + (P - _), l[3] = D2;
          const L = r(4, c, 4, l, s);
          _ = (z = (A = E - (w = (v2 = e * E) - (v2 - E))) * (O = m2 - (F = (v2 = e * m2) - (v2 - m2))) - ((q = E * m2) - w * F - A * F - w * O)) - (P = z - (C = (A = H - (w = (v2 = e * H) - (v2 - H))) * (O = j2 - (F = (v2 = e * j2) - (v2 - j2))) - ((B2 = H * j2) - w * F - A * F - w * O))), l[0] = z - (P + _) + (_ - C), _ = (k = q - ((g = q + P) - (_ = g - q)) + (P - _)) - (P = k - B2), l[1] = k - (P + _) + (_ - B2), _ = (D2 = g + P) - g, l[2] = g - (D2 - _) + (P - _), l[3] = D2;
          const N = r(L, s, 4, l, a);
          _ = (z = (A = M2 - (w = (v2 = e * M2) - (v2 - M2))) * (O = m2 - (F = (v2 = e * m2) - (v2 - m2))) - ((q = M2 * m2) - w * F - A * F - w * O)) - (P = z - (C = (A = x2 - (w = (v2 = e * x2) - (v2 - x2))) * (O = j2 - (F = (v2 = e * j2) - (v2 - j2))) - ((B2 = x2 * j2) - w * F - A * F - w * O))), l[0] = z - (P + _) + (_ - C), _ = (k = q - ((g = q + P) - (_ = g - q)) + (P - _)) - (P = k - B2), l[1] = k - (P + _) + (_ - B2), _ = (D2 = g + P) - g, l[2] = g - (D2 - _) + (P - _), l[3] = D2;
          const Q = r(N, a, 4, l, d);
          return d[Q - 1];
        })(t2, o2, p, b, y, h, m);
      }, t.orient2dfast = function(t2, e2, n2, r2, o2, f2) {
        return (e2 - f2) * (n2 - o2) - (t2 - o2) * (r2 - f2);
      }, Object.defineProperty(t, "__esModule", { value: true });
    });
  }
});

// node_modules/concaveman/index.js
var require_concaveman = __commonJS({
  "node_modules/concaveman/index.js"(exports, module) {
    "use strict";
    var RBush = require_rbush();
    var Queue = require_tinyqueue();
    var pointInPolygon2 = require_point_in_polygon();
    var orient = require_orient2d_min().orient2d;
    if (Queue.default) {
      Queue = Queue.default;
    }
    module.exports = concaveman2;
    module.exports.default = concaveman2;
    function concaveman2(points, concavity, lengthThreshold) {
      concavity = Math.max(0, concavity === void 0 ? 2 : concavity);
      lengthThreshold = lengthThreshold || 0;
      var hull = fastConvexHull(points);
      var tree = new RBush(16);
      tree.toBBox = function(a2) {
        return {
          minX: a2[0],
          minY: a2[1],
          maxX: a2[0],
          maxY: a2[1]
        };
      };
      tree.compareMinX = function(a2, b2) {
        return a2[0] - b2[0];
      };
      tree.compareMinY = function(a2, b2) {
        return a2[1] - b2[1];
      };
      tree.load(points);
      var queue = [];
      for (var i = 0, last; i < hull.length; i++) {
        var p = hull[i];
        tree.remove(p);
        last = insertNode(p, last);
        queue.push(last);
      }
      var segTree = new RBush(16);
      for (i = 0; i < queue.length; i++) segTree.insert(updateBBox(queue[i]));
      var sqConcavity = concavity * concavity;
      var sqLenThreshold = lengthThreshold * lengthThreshold;
      while (queue.length) {
        var node = queue.shift();
        var a = node.p;
        var b = node.next.p;
        var sqLen = getSqDist(a, b);
        if (sqLen < sqLenThreshold) continue;
        var maxSqLen = sqLen / sqConcavity;
        p = findCandidate(tree, node.prev.p, a, b, node.next.next.p, maxSqLen, segTree);
        if (p && Math.min(getSqDist(p, a), getSqDist(p, b)) <= maxSqLen) {
          queue.push(node);
          queue.push(insertNode(p, node));
          tree.remove(p);
          segTree.remove(node);
          segTree.insert(updateBBox(node));
          segTree.insert(updateBBox(node.next));
        }
      }
      node = last;
      var concave = [];
      do {
        concave.push(node.p);
        node = node.next;
      } while (node !== last);
      concave.push(node.p);
      return concave;
    }
    function findCandidate(tree, a, b, c, d, maxDist, segTree) {
      var queue = new Queue([], compareDist);
      var node = tree.data;
      while (node) {
        for (var i = 0; i < node.children.length; i++) {
          var child = node.children[i];
          var dist = node.leaf ? sqSegDist(child, b, c) : sqSegBoxDist(b, c, child);
          if (dist > maxDist) continue;
          queue.push({
            node: child,
            dist
          });
        }
        while (queue.length && !queue.peek().node.children) {
          var item = queue.pop();
          var p = item.node;
          var d0 = sqSegDist(p, a, b);
          var d1 = sqSegDist(p, c, d);
          if (item.dist < d0 && item.dist < d1 && noIntersections(b, p, segTree) && noIntersections(c, p, segTree)) return p;
        }
        node = queue.pop();
        if (node) node = node.node;
      }
      return null;
    }
    function compareDist(a, b) {
      return a.dist - b.dist;
    }
    function sqSegBoxDist(a, b, bbox2) {
      if (inside(a, bbox2) || inside(b, bbox2)) return 0;
      var d1 = sqSegSegDist(a[0], a[1], b[0], b[1], bbox2.minX, bbox2.minY, bbox2.maxX, bbox2.minY);
      if (d1 === 0) return 0;
      var d2 = sqSegSegDist(a[0], a[1], b[0], b[1], bbox2.minX, bbox2.minY, bbox2.minX, bbox2.maxY);
      if (d2 === 0) return 0;
      var d3 = sqSegSegDist(a[0], a[1], b[0], b[1], bbox2.maxX, bbox2.minY, bbox2.maxX, bbox2.maxY);
      if (d3 === 0) return 0;
      var d4 = sqSegSegDist(a[0], a[1], b[0], b[1], bbox2.minX, bbox2.maxY, bbox2.maxX, bbox2.maxY);
      if (d4 === 0) return 0;
      return Math.min(d1, d2, d3, d4);
    }
    function inside(a, bbox2) {
      return a[0] >= bbox2.minX && a[0] <= bbox2.maxX && a[1] >= bbox2.minY && a[1] <= bbox2.maxY;
    }
    function noIntersections(a, b, segTree) {
      var minX = Math.min(a[0], b[0]);
      var minY = Math.min(a[1], b[1]);
      var maxX = Math.max(a[0], b[0]);
      var maxY = Math.max(a[1], b[1]);
      var edges = segTree.search({ minX, minY, maxX, maxY });
      for (var i = 0; i < edges.length; i++) {
        if (intersects(edges[i].p, edges[i].next.p, a, b)) return false;
      }
      return true;
    }
    function cross(p1, p2, p3) {
      return orient(p1[0], p1[1], p2[0], p2[1], p3[0], p3[1]);
    }
    function intersects(p1, q1, p2, q2) {
      return p1 !== q2 && q1 !== p2 && cross(p1, q1, p2) > 0 !== cross(p1, q1, q2) > 0 && cross(p2, q2, p1) > 0 !== cross(p2, q2, q1) > 0;
    }
    function updateBBox(node) {
      var p1 = node.p;
      var p2 = node.next.p;
      node.minX = Math.min(p1[0], p2[0]);
      node.minY = Math.min(p1[1], p2[1]);
      node.maxX = Math.max(p1[0], p2[0]);
      node.maxY = Math.max(p1[1], p2[1]);
      return node;
    }
    function fastConvexHull(points) {
      var left = points[0];
      var top = points[0];
      var right = points[0];
      var bottom = points[0];
      for (var i = 0; i < points.length; i++) {
        var p = points[i];
        if (p[0] < left[0]) left = p;
        if (p[0] > right[0]) right = p;
        if (p[1] < top[1]) top = p;
        if (p[1] > bottom[1]) bottom = p;
      }
      var cull = [left, top, right, bottom];
      var filtered = cull.slice();
      for (i = 0; i < points.length; i++) {
        if (!pointInPolygon2(points[i], cull)) filtered.push(points[i]);
      }
      return convexHull(filtered);
    }
    function insertNode(p, prev) {
      var node = {
        p,
        prev: null,
        next: null,
        minX: 0,
        minY: 0,
        maxX: 0,
        maxY: 0
      };
      if (!prev) {
        node.prev = node;
        node.next = node;
      } else {
        node.next = prev.next;
        node.prev = prev;
        prev.next.prev = node;
        prev.next = node;
      }
      return node;
    }
    function getSqDist(p1, p2) {
      var dx = p1[0] - p2[0], dy = p1[1] - p2[1];
      return dx * dx + dy * dy;
    }
    function sqSegDist(p, p1, p2) {
      var x = p1[0], y = p1[1], dx = p2[0] - x, dy = p2[1] - y;
      if (dx !== 0 || dy !== 0) {
        var t = ((p[0] - x) * dx + (p[1] - y) * dy) / (dx * dx + dy * dy);
        if (t > 1) {
          x = p2[0];
          y = p2[1];
        } else if (t > 0) {
          x += dx * t;
          y += dy * t;
        }
      }
      dx = p[0] - x;
      dy = p[1] - y;
      return dx * dx + dy * dy;
    }
    function sqSegSegDist(x0, y0, x1, y1, x2, y2, x3, y3) {
      var ux = x1 - x0;
      var uy = y1 - y0;
      var vx = x3 - x2;
      var vy = y3 - y2;
      var wx = x0 - x2;
      var wy = y0 - y2;
      var a = ux * ux + uy * uy;
      var b = ux * vx + uy * vy;
      var c = vx * vx + vy * vy;
      var d = ux * wx + uy * wy;
      var e = vx * wx + vy * wy;
      var D2 = a * c - b * b;
      var sc, sN, tc, tN;
      var sD = D2;
      var tD = D2;
      if (D2 === 0) {
        sN = 0;
        sD = 1;
        tN = e;
        tD = c;
      } else {
        sN = b * e - c * d;
        tN = a * e - b * d;
        if (sN < 0) {
          sN = 0;
          tN = e;
          tD = c;
        } else if (sN > sD) {
          sN = sD;
          tN = e + b;
          tD = c;
        }
      }
      if (tN < 0) {
        tN = 0;
        if (-d < 0) sN = 0;
        else if (-d > a) sN = sD;
        else {
          sN = -d;
          sD = a;
        }
      } else if (tN > tD) {
        tN = tD;
        if (-d + b < 0) sN = 0;
        else if (-d + b > a) sN = sD;
        else {
          sN = -d + b;
          sD = a;
        }
      }
      sc = sN === 0 ? 0 : sN / sD;
      tc = tN === 0 ? 0 : tN / tD;
      var cx = (1 - sc) * x0 + sc * x1;
      var cy = (1 - sc) * y0 + sc * y1;
      var cx2 = (1 - tc) * x2 + tc * x3;
      var cy2 = (1 - tc) * y2 + tc * y3;
      var dx = cx2 - cx;
      var dy = cy2 - cy;
      return dx * dx + dy * dy;
    }
    function compareByX(a, b) {
      return a[0] === b[0] ? a[1] - b[1] : a[0] - b[0];
    }
    function convexHull(points) {
      points.sort(compareByX);
      var lower = [];
      for (var i = 0; i < points.length; i++) {
        while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], points[i]) <= 0) {
          lower.pop();
        }
        lower.push(points[i]);
      }
      var upper = [];
      for (var ii = points.length - 1; ii >= 0; ii--) {
        while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], points[ii]) <= 0) {
          upper.pop();
        }
        upper.push(points[ii]);
      }
      upper.pop();
      lower.pop();
      return lower.concat(upper);
    }
  }
});

// scripts/lib/util.mjs
import { createHash, randomUUID } from "node:crypto";
import { realpathSync } from "node:fs";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
var sha256 = (value) => createHash("sha256").update(typeof value === "string" ? value : stableJson(value)).digest("hex");
var stableJson = (value) => JSON.stringify(sortObject(value));
var uniqueId = (prefix) => `${prefix}-${Date.now().toString(36)}-${randomUUID().slice(0, 8)}`;
function sortObject(value) {
  if (Array.isArray(value)) return value.map(sortObject);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, sortObject(value[key])]));
}
async function readJson(path) {
  return JSON.parse(await readFile(path, "utf8"));
}
async function writeJsonAtomic(path, value) {
  await mkdir(dirname(path), { recursive: true });
  const temp = `${path}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}
`, { mode: 384 });
  await rename(temp, path);
}
var ageMinutes = (time, now = /* @__PURE__ */ new Date()) => (now.getTime() - new Date(time).getTime()) / 6e4;
var clampText = (text, length = 500) => String(text ?? "").replace(/\s+/g, " ").trim().slice(0, length);
function isMainModule(metaUrl, argv = process.argv) {
  if (!argv[1]) return false;
  try {
    return realpathSync(fileURLToPath(metaUrl)) === realpathSync(argv[1]);
  } catch {
    return metaUrl === pathToFileURL(resolve(argv[1])).href;
  }
}

// scripts/lib/config.mjs
var import__ = __toESM(require__(), 1);
import { readFile as readFile2 } from "node:fs/promises";
import { dirname as dirname2, resolve as resolve2 } from "node:path";
import { fileURLToPath as fileURLToPath2 } from "node:url";
var here = dirname2(fileURLToPath2(import.meta.url));
var defaultConfigPath = resolve2(here, "../../config/config.json");
var defaultSchemaPath = resolve2(here, "../../config/config.schema.json");
var defaultBrowserConfigPath = resolve2(here, "../../config/agent-browser.json");
async function loadConfig(path = defaultConfigPath) {
  const [config, schema] = await Promise.all([readJsonWithPath(path), readJsonWithPath(defaultSchemaPath)]);
  const ajv = new import__.default({ allErrors: true, strict: false });
  const validate = ajv.compile(schema);
  if (!validate(config)) throw new ConfigError(validate.errors.map(formatAjvError));
  validateSemantics(config);
  config.browser.configPath = resolve2(dirname2(path), config.browser.configPath);
  return config;
}
async function readJsonWithPath(path) {
  try {
    return JSON.parse(await readFile2(path, "utf8"));
  } catch (error) {
    throw new ConfigError([`${path}: ${error.message}`]);
  }
}
function formatAjvError(error) {
  return `${error.instancePath || "/"} ${error.message}`;
}
function validateSemantics(config) {
  const errors = [];
  uniqueBy(config.sources, (value) => value.id, "/sources id", errors);
  uniqueBy(config.sources, (value) => value.order, "/sources order", errors);
  uniqueBy(config.requestedProducts.products, (value) => value.productKey, "/requestedProducts/products productKey", errors);
  const aliases = /* @__PURE__ */ new Map();
  for (const product of config.requestedProducts.products) {
    for (const rawAlias of product.aliases) {
      const alias = normalizeFuelLabel(rawAlias);
      if (aliases.has(alias) && aliases.get(alias) !== product.productKey) errors.push(`/requestedProducts alias ${JSON.stringify(alias)} belongs to both ${aliases.get(alias)} and ${product.productKey}`);
      aliases.set(alias, product.productKey);
    }
  }
  const members = config.identity.manualOverrides.flatMap((o) => o.members.map((m) => ({ ...m, stationKey: o.stationKey })));
  uniqueBy(members, (value) => `${value.source}:${value.sourceStationId}`, "/identity/manualOverrides members", errors);
  for (const override of config.identity.manualOverrides) uniqueBy(override.members, (value) => value.source, `/identity/manualOverrides/${override.stationKey} sources`, errors);
  const f = config.freshness;
  if (!(f.freshMinutes < f.recentMinutes && f.recentMinutes <= f.staleMinutes && f.staleMinutes <= f.expireMinutes)) errors.push("/freshness thresholds must be monotonic: fresh < recent <= stale <= expire");
  const q = config.queue.ordinalMaxVehicles;
  if (!(q.NONE <= q.SHORT && q.SHORT < q.MEDIUM && q.MEDIUM < q.LONG)) errors.push("/queue/ordinalMaxVehicles must be monotonic");
  if (config.area.kind === "rectangle" && !(config.area.south < config.area.north && config.area.west < config.area.east)) errors.push("/area rectangle bounds are reversed");
  if (errors.length) throw new ConfigError(errors);
}
function uniqueBy(items, key, label, errors) {
  const seen = /* @__PURE__ */ new Set();
  for (const item of items) {
    const value = key(item);
    if (seen.has(value)) errors.push(`${label} contains duplicate ${JSON.stringify(value)}`);
    seen.add(value);
  }
}
var ConfigError = class extends Error {
  constructor(errors) {
    super(`Invalid fuel-watch config:
${errors.map((e) => `- ${e}`).join("\n")}`);
    this.name = "ConfigError";
    this.errors = errors;
  }
};

// node_modules/@turf/helpers/dist/esm/index.js
var earthRadius = 63710088e-1;
var factors = {
  centimeters: earthRadius * 100,
  centimetres: earthRadius * 100,
  cm: earthRadius * 100,
  degrees: 360 / (2 * Math.PI),
  deg: 360 / (2 * Math.PI),
  feet: earthRadius * 3.28084,
  ft: earthRadius * 3.28084,
  inches: earthRadius * 39.37,
  in: earthRadius * 39.37,
  kilometers: earthRadius / 1e3,
  kilometres: earthRadius / 1e3,
  km: earthRadius / 1e3,
  meters: earthRadius,
  metres: earthRadius,
  m: earthRadius,
  miles: earthRadius / 1609.344,
  mi: earthRadius / 1609.344,
  millimeters: earthRadius * 1e3,
  millimetres: earthRadius * 1e3,
  mm: earthRadius * 1e3,
  nauticalmiles: earthRadius / 1852,
  nmi: earthRadius / 1852,
  radians: 1,
  rad: 1,
  yards: earthRadius * 1.0936,
  yd: earthRadius * 1.0936
};
function feature(geom, properties, options = {}) {
  const feat = { type: "Feature" };
  if (options.id === 0 || options.id) {
    feat.id = options.id;
  }
  if (options.bbox) {
    feat.bbox = options.bbox;
  }
  feat.properties = properties || {};
  feat.geometry = geom;
  return feat;
}
function point(coordinates, properties, options = {}) {
  if (!coordinates) {
    throw new Error("coordinates is required");
  }
  if (!Array.isArray(coordinates)) {
    throw new Error("coordinates must be an Array");
  }
  if (coordinates.length < 2) {
    throw new Error("coordinates must be at least 2 numbers long");
  }
  if (!isNumber(coordinates[0]) || !isNumber(coordinates[1])) {
    throw new Error("coordinates must contain numbers");
  }
  const geom = {
    type: "Point",
    coordinates
  };
  return feature(geom, properties, options);
}
function polygon(coordinates, properties, options = {}) {
  for (const ring of coordinates) {
    if (ring.length < 4) {
      throw new Error(
        "Each LinearRing of a Polygon must have 4 or more Positions."
      );
    }
    if (ring[ring.length - 1].length !== ring[0].length) {
      throw new Error("First and last Position are not equivalent.");
    }
    for (let j = 0; j < ring[ring.length - 1].length; j++) {
      if (ring[ring.length - 1][j] !== ring[0][j]) {
        throw new Error("First and last Position are not equivalent.");
      }
    }
  }
  const geom = {
    type: "Polygon",
    coordinates
  };
  return feature(geom, properties, options);
}
function featureCollection(features, options = {}) {
  const fc = { type: "FeatureCollection" };
  if (options.id) {
    fc.id = options.id;
  }
  if (options.bbox) {
    fc.bbox = options.bbox;
  }
  fc.features = features;
  return fc;
}
function radiansToLength(radians, units = "kilometers") {
  const factor = factors[units];
  if (!factor) {
    throw new Error(units + " units is invalid");
  }
  return radians * factor;
}
function lengthToRadians(distance, units = "kilometers") {
  const factor = factors[units];
  if (!factor) {
    throw new Error(units + " units is invalid");
  }
  return distance / factor;
}
function isNumber(num) {
  return !isNaN(num) && num !== null && !Array.isArray(num);
}

// node_modules/@turf/invariant/dist/esm/index.js
function getCoord(coord) {
  if (!coord) {
    throw new Error("coord is required");
  }
  if (!Array.isArray(coord)) {
    if (coord.type === "Feature" && coord.geometry !== null && coord.geometry.type === "Point") {
      return [...coord.geometry.coordinates];
    }
    if (coord.type === "Point") {
      return [...coord.coordinates];
    }
  }
  if (Array.isArray(coord) && coord.length >= 2 && !Array.isArray(coord[0]) && !Array.isArray(coord[1])) {
    return [...coord];
  }
  throw new Error("coord must be GeoJSON Point or an Array of numbers");
}
function getGeom(geojson) {
  if (geojson.type === "Feature") {
    return geojson.geometry;
  }
  return geojson;
}

// node_modules/@turf/meta/dist/esm/index.js
function coordEach(geojson, callback, excludeWrapCoord) {
  if (geojson === null) return;
  var j, k, l, geometry, stopG, coords, geometryMaybeCollection, wrapShrink = 0, coordIndex = 0, isGeometryCollection, type = geojson.type, isFeatureCollection = type === "FeatureCollection", isFeature = type === "Feature", stop = isFeatureCollection ? geojson.features.length : 1;
  for (var featureIndex = 0; featureIndex < stop; featureIndex++) {
    geometryMaybeCollection = isFeatureCollection ? (
      // @ts-expect-error: Known type conflict
      geojson.features[featureIndex].geometry
    ) : isFeature ? (
      // @ts-expect-error: Known type conflict
      geojson.geometry
    ) : geojson;
    isGeometryCollection = geometryMaybeCollection ? geometryMaybeCollection.type === "GeometryCollection" : false;
    stopG = isGeometryCollection ? geometryMaybeCollection.geometries.length : 1;
    for (var geomIndex = 0; geomIndex < stopG; geomIndex++) {
      var multiFeatureIndex = 0;
      var geometryIndex = 0;
      geometry = isGeometryCollection ? geometryMaybeCollection.geometries[geomIndex] : geometryMaybeCollection;
      if (geometry === null) continue;
      coords = geometry.coordinates;
      var geomType = geometry.type;
      wrapShrink = excludeWrapCoord && (geomType === "Polygon" || geomType === "MultiPolygon") ? 1 : 0;
      switch (geomType) {
        case null:
          break;
        case "Point":
          if (
            // @ts-expect-error: Known type conflict
            callback(
              coords,
              coordIndex,
              featureIndex,
              multiFeatureIndex,
              geometryIndex
            ) === false
          )
            return false;
          coordIndex++;
          multiFeatureIndex++;
          break;
        case "LineString":
        case "MultiPoint":
          for (j = 0; j < coords.length; j++) {
            if (
              // @ts-expect-error: Known type conflict
              callback(
                coords[j],
                coordIndex,
                featureIndex,
                multiFeatureIndex,
                geometryIndex
              ) === false
            )
              return false;
            coordIndex++;
            if (geomType === "MultiPoint") multiFeatureIndex++;
          }
          if (geomType === "LineString") multiFeatureIndex++;
          break;
        case "Polygon":
        case "MultiLineString":
          for (j = 0; j < coords.length; j++) {
            for (k = 0; k < coords[j].length - wrapShrink; k++) {
              if (
                // @ts-expect-error: Known type conflict
                callback(
                  coords[j][k],
                  coordIndex,
                  featureIndex,
                  multiFeatureIndex,
                  geometryIndex
                ) === false
              )
                return false;
              coordIndex++;
            }
            if (geomType === "MultiLineString") multiFeatureIndex++;
            if (geomType === "Polygon") geometryIndex++;
          }
          if (geomType === "Polygon") multiFeatureIndex++;
          break;
        case "MultiPolygon":
          for (j = 0; j < coords.length; j++) {
            geometryIndex = 0;
            for (k = 0; k < coords[j].length; k++) {
              for (l = 0; l < coords[j][k].length - wrapShrink; l++) {
                if (
                  // @ts-expect-error: Known type conflict
                  callback(
                    coords[j][k][l],
                    coordIndex,
                    featureIndex,
                    multiFeatureIndex,
                    geometryIndex
                  ) === false
                )
                  return false;
                coordIndex++;
              }
              geometryIndex++;
            }
            multiFeatureIndex++;
          }
          break;
        case "GeometryCollection":
          for (j = 0; j < geometry.geometries.length; j++)
            if (
              // @ts-expect-error: Known type conflict
              coordEach(geometry.geometries[j], callback, excludeWrapCoord) === false
            )
              return false;
          break;
        default:
          throw new Error("Unknown Geometry Type");
      }
    }
  }
}
function featureEach(geojson, callback) {
  if (geojson.type === "Feature") {
    callback(geojson, 0);
  } else if (geojson.type === "FeatureCollection") {
    for (var i = 0; i < geojson.features.length; i++) {
      if (callback(geojson.features[i], i) === false) break;
    }
  }
}
function geomEach(geojson, callback) {
  var i, j, g, geometry, stopG, geometryMaybeCollection, isGeometryCollection, featureProperties, featureBBox, featureId, featureIndex = 0, isFeatureCollection = geojson.type === "FeatureCollection", isFeature = geojson.type === "Feature", stop = isFeatureCollection ? geojson.features.length : 1;
  for (i = 0; i < stop; i++) {
    geometryMaybeCollection = isFeatureCollection ? (
      // @ts-expect-error: Known type conflict
      geojson.features[i].geometry
    ) : isFeature ? (
      // @ts-expect-error: Known type conflict
      geojson.geometry
    ) : geojson;
    featureProperties = isFeatureCollection ? (
      // @ts-expect-error: Known type conflict
      geojson.features[i].properties
    ) : isFeature ? (
      // @ts-expect-error: Known type conflict
      geojson.properties
    ) : {};
    featureBBox = isFeatureCollection ? (
      // @ts-expect-error: Known type conflict
      geojson.features[i].bbox
    ) : isFeature ? (
      // @ts-expect-error: Known type conflict
      geojson.bbox
    ) : void 0;
    featureId = isFeatureCollection ? (
      // @ts-expect-error: Known type conflict
      geojson.features[i].id
    ) : isFeature ? (
      // @ts-expect-error: Known type conflict
      geojson.id
    ) : void 0;
    isGeometryCollection = geometryMaybeCollection ? geometryMaybeCollection.type === "GeometryCollection" : false;
    stopG = isGeometryCollection ? geometryMaybeCollection.geometries.length : 1;
    for (g = 0; g < stopG; g++) {
      geometry = isGeometryCollection ? geometryMaybeCollection.geometries[g] : geometryMaybeCollection;
      if (geometry === null) {
        if (
          // @ts-expect-error: Known type conflict
          callback(
            // @ts-expect-error: Known type conflict
            null,
            featureIndex,
            featureProperties,
            featureBBox,
            featureId
          ) === false
        )
          return false;
        continue;
      }
      switch (geometry.type) {
        case "Point":
        case "LineString":
        case "MultiPoint":
        case "Polygon":
        case "MultiLineString":
        case "MultiPolygon": {
          if (
            // @ts-expect-error: Known type conflict
            callback(
              geometry,
              featureIndex,
              featureProperties,
              featureBBox,
              featureId
            ) === false
          )
            return false;
          break;
        }
        case "GeometryCollection": {
          for (j = 0; j < geometry.geometries.length; j++) {
            if (
              // @ts-expect-error: Known type conflict
              callback(
                geometry.geometries[j],
                featureIndex,
                featureProperties,
                featureBBox,
                featureId
              ) === false
            )
              return false;
          }
          break;
        }
        default:
          throw new Error("Unknown Geometry Type");
      }
    }
    featureIndex++;
  }
}
function geomReduce(geojson, callback, initialValue) {
  var previousValue = initialValue;
  geomEach(
    geojson,
    function(currentGeometry, featureIndex, featureProperties, featureBBox, featureId) {
      if (featureIndex === 0 && initialValue === void 0)
        previousValue = currentGeometry;
      else
        previousValue = callback(
          // @ts-expect-error: Known type conflict
          previousValue,
          currentGeometry,
          featureIndex,
          featureProperties,
          featureBBox,
          featureId
        );
    }
  );
  return previousValue;
}

// node_modules/@turf/area/dist/esm/index.js
function area(geojson) {
  return geomReduce(
    geojson,
    (value, geom) => {
      return value + calculateArea(geom);
    },
    0
  );
}
function calculateArea(geom) {
  let total = 0;
  let i;
  switch (geom.type) {
    case "Polygon":
      return polygonArea(geom.coordinates);
    case "MultiPolygon":
      for (i = 0; i < geom.coordinates.length; i++) {
        total += polygonArea(geom.coordinates[i]);
      }
      return total;
    case "Point":
    case "MultiPoint":
    case "LineString":
    case "MultiLineString":
      return 0;
  }
  return 0;
}
function polygonArea(coords) {
  let total = 0;
  if (coords && coords.length > 0) {
    total += Math.abs(ringArea(coords[0]));
    for (let i = 1; i < coords.length; i++) {
      total -= Math.abs(ringArea(coords[i]));
    }
  }
  return total;
}
var FACTOR = earthRadius * earthRadius / 2;
var PI_OVER_180 = Math.PI / 180;
function ringArea(coords) {
  const coordsLength = coords.length - 1;
  if (coordsLength <= 2) return 0;
  let total = 0;
  let i = 0;
  while (i < coordsLength) {
    const lower = coords[i];
    const middle = coords[i + 1 === coordsLength ? 0 : i + 1];
    const upper = coords[i + 2 >= coordsLength ? (i + 2) % coordsLength : i + 2];
    const lowerX = lower[0] * PI_OVER_180;
    const middleY = middle[1] * PI_OVER_180;
    const upperX = upper[0] * PI_OVER_180;
    total += (upperX - lowerX) * Math.sin(middleY);
    i++;
  }
  return total * FACTOR;
}

// node_modules/@turf/bbox/dist/esm/index.js
function bbox(geojson, options = {}) {
  if (geojson.bbox != null && true !== options.recompute) {
    return geojson.bbox;
  }
  const result = [Infinity, Infinity, -Infinity, -Infinity];
  coordEach(geojson, (coord) => {
    if (result[0] > coord[0]) {
      result[0] = coord[0];
    }
    if (result[1] > coord[1]) {
      result[1] = coord[1];
    }
    if (result[2] < coord[0]) {
      result[2] = coord[0];
    }
    if (result[3] < coord[1]) {
      result[3] = coord[1];
    }
  });
  return result;
}

// node_modules/@turf/bbox-polygon/dist/esm/index.js
function bboxPolygon(bbox2, options = {}) {
  const west = Number(bbox2[0]);
  const south = Number(bbox2[1]);
  const east = Number(bbox2[2]);
  const north = Number(bbox2[3]);
  if (bbox2.length === 6) {
    throw new Error(
      "@turf/bbox-polygon does not support BBox with 6 positions"
    );
  }
  const lowLeft = [west, south];
  const topLeft = [west, north];
  const topRight = [east, north];
  const lowRight = [east, south];
  return polygon(
    [[lowLeft, lowRight, topRight, topLeft, lowLeft]],
    options.properties,
    { bbox: bbox2, id: options.id }
  );
}

// node_modules/point-in-polygon-hao/node_modules/robust-predicates/esm/util.js
var epsilon = 11102230246251565e-32;
var splitter = 134217729;
var resulterrbound = (3 + 8 * epsilon) * epsilon;
function sum(elen, e, flen, f, h) {
  let Q, Qnew, hh, bvirt;
  let enow = e[0];
  let fnow = f[0];
  let eindex = 0;
  let findex = 0;
  if (fnow > enow === fnow > -enow) {
    Q = enow;
    enow = e[++eindex];
  } else {
    Q = fnow;
    fnow = f[++findex];
  }
  let hindex = 0;
  if (eindex < elen && findex < flen) {
    if (fnow > enow === fnow > -enow) {
      Qnew = enow + Q;
      hh = Q - (Qnew - enow);
      enow = e[++eindex];
    } else {
      Qnew = fnow + Q;
      hh = Q - (Qnew - fnow);
      fnow = f[++findex];
    }
    Q = Qnew;
    if (hh !== 0) {
      h[hindex++] = hh;
    }
    while (eindex < elen && findex < flen) {
      if (fnow > enow === fnow > -enow) {
        Qnew = Q + enow;
        bvirt = Qnew - Q;
        hh = Q - (Qnew - bvirt) + (enow - bvirt);
        enow = e[++eindex];
      } else {
        Qnew = Q + fnow;
        bvirt = Qnew - Q;
        hh = Q - (Qnew - bvirt) + (fnow - bvirt);
        fnow = f[++findex];
      }
      Q = Qnew;
      if (hh !== 0) {
        h[hindex++] = hh;
      }
    }
  }
  while (eindex < elen) {
    Qnew = Q + enow;
    bvirt = Qnew - Q;
    hh = Q - (Qnew - bvirt) + (enow - bvirt);
    enow = e[++eindex];
    Q = Qnew;
    if (hh !== 0) {
      h[hindex++] = hh;
    }
  }
  while (findex < flen) {
    Qnew = Q + fnow;
    bvirt = Qnew - Q;
    hh = Q - (Qnew - bvirt) + (fnow - bvirt);
    fnow = f[++findex];
    Q = Qnew;
    if (hh !== 0) {
      h[hindex++] = hh;
    }
  }
  if (Q !== 0 || hindex === 0) {
    h[hindex++] = Q;
  }
  return hindex;
}
function estimate(elen, e) {
  let Q = e[0];
  for (let i = 1; i < elen; i++) Q += e[i];
  return Q;
}
function vec(n) {
  return new Float64Array(n);
}

// node_modules/point-in-polygon-hao/node_modules/robust-predicates/esm/orient2d.js
var ccwerrboundA = (3 + 16 * epsilon) * epsilon;
var ccwerrboundB = (2 + 12 * epsilon) * epsilon;
var ccwerrboundC = (9 + 64 * epsilon) * epsilon * epsilon;
var B = vec(4);
var C1 = vec(8);
var C2 = vec(12);
var D = vec(16);
var u = vec(4);
function orient2dadapt(ax, ay, bx, by, cx, cy, detsum) {
  let acxtail, acytail, bcxtail, bcytail;
  let bvirt, c, ahi, alo, bhi, blo, _i, _j, _0, s1, s0, t1, t0, u32;
  const acx = ax - cx;
  const bcx = bx - cx;
  const acy = ay - cy;
  const bcy = by - cy;
  s1 = acx * bcy;
  c = splitter * acx;
  ahi = c - (c - acx);
  alo = acx - ahi;
  c = splitter * bcy;
  bhi = c - (c - bcy);
  blo = bcy - bhi;
  s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
  t1 = acy * bcx;
  c = splitter * acy;
  ahi = c - (c - acy);
  alo = acy - ahi;
  c = splitter * bcx;
  bhi = c - (c - bcx);
  blo = bcx - bhi;
  t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
  _i = s0 - t0;
  bvirt = s0 - _i;
  B[0] = s0 - (_i + bvirt) + (bvirt - t0);
  _j = s1 + _i;
  bvirt = _j - s1;
  _0 = s1 - (_j - bvirt) + (_i - bvirt);
  _i = _0 - t1;
  bvirt = _0 - _i;
  B[1] = _0 - (_i + bvirt) + (bvirt - t1);
  u32 = _j + _i;
  bvirt = u32 - _j;
  B[2] = _j - (u32 - bvirt) + (_i - bvirt);
  B[3] = u32;
  let det = estimate(4, B);
  let errbound = ccwerrboundB * detsum;
  if (det >= errbound || -det >= errbound) {
    return det;
  }
  bvirt = ax - acx;
  acxtail = ax - (acx + bvirt) + (bvirt - cx);
  bvirt = bx - bcx;
  bcxtail = bx - (bcx + bvirt) + (bvirt - cx);
  bvirt = ay - acy;
  acytail = ay - (acy + bvirt) + (bvirt - cy);
  bvirt = by - bcy;
  bcytail = by - (bcy + bvirt) + (bvirt - cy);
  if (acxtail === 0 && acytail === 0 && bcxtail === 0 && bcytail === 0) {
    return det;
  }
  errbound = ccwerrboundC * detsum + resulterrbound * Math.abs(det);
  det += acx * bcytail + bcy * acxtail - (acy * bcxtail + bcx * acytail);
  if (det >= errbound || -det >= errbound) return det;
  s1 = acxtail * bcy;
  c = splitter * acxtail;
  ahi = c - (c - acxtail);
  alo = acxtail - ahi;
  c = splitter * bcy;
  bhi = c - (c - bcy);
  blo = bcy - bhi;
  s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
  t1 = acytail * bcx;
  c = splitter * acytail;
  ahi = c - (c - acytail);
  alo = acytail - ahi;
  c = splitter * bcx;
  bhi = c - (c - bcx);
  blo = bcx - bhi;
  t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
  _i = s0 - t0;
  bvirt = s0 - _i;
  u[0] = s0 - (_i + bvirt) + (bvirt - t0);
  _j = s1 + _i;
  bvirt = _j - s1;
  _0 = s1 - (_j - bvirt) + (_i - bvirt);
  _i = _0 - t1;
  bvirt = _0 - _i;
  u[1] = _0 - (_i + bvirt) + (bvirt - t1);
  u32 = _j + _i;
  bvirt = u32 - _j;
  u[2] = _j - (u32 - bvirt) + (_i - bvirt);
  u[3] = u32;
  const C1len = sum(4, B, 4, u, C1);
  s1 = acx * bcytail;
  c = splitter * acx;
  ahi = c - (c - acx);
  alo = acx - ahi;
  c = splitter * bcytail;
  bhi = c - (c - bcytail);
  blo = bcytail - bhi;
  s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
  t1 = acy * bcxtail;
  c = splitter * acy;
  ahi = c - (c - acy);
  alo = acy - ahi;
  c = splitter * bcxtail;
  bhi = c - (c - bcxtail);
  blo = bcxtail - bhi;
  t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
  _i = s0 - t0;
  bvirt = s0 - _i;
  u[0] = s0 - (_i + bvirt) + (bvirt - t0);
  _j = s1 + _i;
  bvirt = _j - s1;
  _0 = s1 - (_j - bvirt) + (_i - bvirt);
  _i = _0 - t1;
  bvirt = _0 - _i;
  u[1] = _0 - (_i + bvirt) + (bvirt - t1);
  u32 = _j + _i;
  bvirt = u32 - _j;
  u[2] = _j - (u32 - bvirt) + (_i - bvirt);
  u[3] = u32;
  const C2len = sum(C1len, C1, 4, u, C2);
  s1 = acxtail * bcytail;
  c = splitter * acxtail;
  ahi = c - (c - acxtail);
  alo = acxtail - ahi;
  c = splitter * bcytail;
  bhi = c - (c - bcytail);
  blo = bcytail - bhi;
  s0 = alo * blo - (s1 - ahi * bhi - alo * bhi - ahi * blo);
  t1 = acytail * bcxtail;
  c = splitter * acytail;
  ahi = c - (c - acytail);
  alo = acytail - ahi;
  c = splitter * bcxtail;
  bhi = c - (c - bcxtail);
  blo = bcxtail - bhi;
  t0 = alo * blo - (t1 - ahi * bhi - alo * bhi - ahi * blo);
  _i = s0 - t0;
  bvirt = s0 - _i;
  u[0] = s0 - (_i + bvirt) + (bvirt - t0);
  _j = s1 + _i;
  bvirt = _j - s1;
  _0 = s1 - (_j - bvirt) + (_i - bvirt);
  _i = _0 - t1;
  bvirt = _0 - _i;
  u[1] = _0 - (_i + bvirt) + (bvirt - t1);
  u32 = _j + _i;
  bvirt = u32 - _j;
  u[2] = _j - (u32 - bvirt) + (_i - bvirt);
  u[3] = u32;
  const Dlen = sum(C2len, C2, 4, u, D);
  return D[Dlen - 1];
}
function orient2d(ax, ay, bx, by, cx, cy) {
  const detleft = (ay - cy) * (bx - cx);
  const detright = (ax - cx) * (by - cy);
  const det = detleft - detright;
  const detsum = Math.abs(detleft + detright);
  if (Math.abs(det) >= ccwerrboundA * detsum) return det;
  return -orient2dadapt(ax, ay, bx, by, cx, cy, detsum);
}

// node_modules/point-in-polygon-hao/node_modules/robust-predicates/esm/orient3d.js
var o3derrboundA = (7 + 56 * epsilon) * epsilon;
var o3derrboundB = (3 + 28 * epsilon) * epsilon;
var o3derrboundC = (26 + 288 * epsilon) * epsilon * epsilon;
var bc = vec(4);
var ca = vec(4);
var ab = vec(4);
var at_b = vec(4);
var at_c = vec(4);
var bt_c = vec(4);
var bt_a = vec(4);
var ct_a = vec(4);
var ct_b = vec(4);
var bct = vec(8);
var cat = vec(8);
var abt = vec(8);
var u2 = vec(4);
var _8 = vec(8);
var _8b = vec(8);
var _16 = vec(16);
var _12 = vec(12);
var fin = vec(192);
var fin2 = vec(192);

// node_modules/point-in-polygon-hao/node_modules/robust-predicates/esm/incircle.js
var iccerrboundA = (10 + 96 * epsilon) * epsilon;
var iccerrboundB = (4 + 48 * epsilon) * epsilon;
var iccerrboundC = (44 + 576 * epsilon) * epsilon * epsilon;
var bc2 = vec(4);
var ca2 = vec(4);
var ab2 = vec(4);
var aa = vec(4);
var bb = vec(4);
var cc = vec(4);
var u3 = vec(4);
var v = vec(4);
var axtbc = vec(8);
var aytbc = vec(8);
var bxtca = vec(8);
var bytca = vec(8);
var cxtab = vec(8);
var cytab = vec(8);
var abt2 = vec(8);
var bct2 = vec(8);
var cat2 = vec(8);
var abtt = vec(4);
var bctt = vec(4);
var catt = vec(4);
var _82 = vec(8);
var _162 = vec(16);
var _16b = vec(16);
var _16c = vec(16);
var _32 = vec(32);
var _32b = vec(32);
var _48 = vec(48);
var _64 = vec(64);
var fin3 = vec(1152);
var fin22 = vec(1152);

// node_modules/point-in-polygon-hao/node_modules/robust-predicates/esm/insphere.js
var isperrboundA = (16 + 224 * epsilon) * epsilon;
var isperrboundB = (5 + 72 * epsilon) * epsilon;
var isperrboundC = (71 + 1408 * epsilon) * epsilon * epsilon;
var ab3 = vec(4);
var bc3 = vec(4);
var cd = vec(4);
var de = vec(4);
var ea = vec(4);
var ac = vec(4);
var bd = vec(4);
var ce = vec(4);
var da = vec(4);
var eb = vec(4);
var abc = vec(24);
var bcd = vec(24);
var cde = vec(24);
var dea = vec(24);
var eab = vec(24);
var abd = vec(24);
var bce = vec(24);
var cda = vec(24);
var deb = vec(24);
var eac = vec(24);
var adet = vec(1152);
var bdet = vec(1152);
var cdet = vec(1152);
var ddet = vec(1152);
var edet = vec(1152);
var abdet = vec(2304);
var cddet = vec(2304);
var cdedet = vec(3456);
var deter = vec(5760);
var _83 = vec(8);
var _8b2 = vec(8);
var _8c = vec(8);
var _163 = vec(16);
var _24 = vec(24);
var _482 = vec(48);
var _48b = vec(48);
var _96 = vec(96);
var _192 = vec(192);
var _384x = vec(384);
var _384y = vec(384);
var _384z = vec(384);
var _768 = vec(768);
var xdet = vec(96);
var ydet = vec(96);
var zdet = vec(96);
var fin4 = vec(1152);

// node_modules/point-in-polygon-hao/dist/esm/index.js
function pointInPolygon(p, polygon2) {
  var i;
  var ii;
  var k = 0;
  var f;
  var u1;
  var v1;
  var u22;
  var v2;
  var currentP;
  var nextP;
  var x = p[0];
  var y = p[1];
  var numContours = polygon2.length;
  for (i = 0; i < numContours; i++) {
    ii = 0;
    var contour = polygon2[i];
    var contourLen = contour.length - 1;
    currentP = contour[0];
    if (currentP[0] !== contour[contourLen][0] && currentP[1] !== contour[contourLen][1]) {
      throw new Error("First and last coordinates in a ring must be the same");
    }
    u1 = currentP[0] - x;
    v1 = currentP[1] - y;
    for (ii; ii < contourLen; ii++) {
      nextP = contour[ii + 1];
      u22 = nextP[0] - x;
      v2 = nextP[1] - y;
      if (v1 === 0 && v2 === 0) {
        if (u22 <= 0 && u1 >= 0 || u1 <= 0 && u22 >= 0) {
          return 0;
        }
      } else if (v2 >= 0 && v1 <= 0 || v2 <= 0 && v1 >= 0) {
        f = orient2d(u1, u22, v1, v2, 0, 0);
        if (f === 0) {
          return 0;
        }
        if (f > 0 && v2 > 0 && v1 <= 0 || f < 0 && v2 <= 0 && v1 > 0) {
          k++;
        }
      }
      currentP = nextP;
      v1 = v2;
      u1 = u22;
    }
  }
  if (k % 2 === 0) {
    return false;
  }
  return true;
}

// node_modules/@turf/boolean-point-in-polygon/dist/esm/index.js
function booleanPointInPolygon(point2, polygon2, options = {}) {
  if (!point2) {
    throw new Error("point is required");
  }
  if (!polygon2) {
    throw new Error("polygon is required");
  }
  const pt = getCoord(point2);
  const geom = getGeom(polygon2);
  const type = geom.type;
  const bbox2 = polygon2.bbox;
  let polys = geom.coordinates;
  if (bbox2 && inBBox(pt, bbox2) === false) {
    return false;
  }
  if (type === "Polygon") {
    polys = [polys];
  }
  for (var i = 0; i < polys.length; ++i) {
    const polyResult = pointInPolygon(pt, polys[i]);
    if (polyResult === 0 && !options.ignoreBoundary) return true;
    else if (polyResult) return true;
  }
  return false;
}
function inBBox(pt, bbox2) {
  return bbox2[0] <= pt[0] && bbox2[1] <= pt[1] && bbox2[2] >= pt[0] && bbox2[3] >= pt[1];
}

// node_modules/@turf/center/dist/esm/index.js
function center(geojson, options = {}) {
  const ext = bbox(geojson);
  const x = (ext[0] + ext[2]) / 2;
  const y = (ext[1] + ext[3]) / 2;
  return point([x, y], options.properties, options);
}

// node_modules/@turf/buffer/dist/esm/index.js
var import_jsts = __toESM(require_jsts_min(), 1);
var import_d3_geo = __toESM(require_d3_geo(), 1);
var { BufferOp, GeoJSONReader, GeoJSONWriter } = import_jsts.default;
function buffer(geojson, radius, options) {
  options = options || {};
  var units = options.units || "kilometers";
  var steps = options.steps || 8;
  if (!geojson) throw new Error("geojson is required");
  if (typeof options !== "object") throw new Error("options must be an object");
  if (typeof steps !== "number") throw new Error("steps must be an number");
  if (radius === void 0) throw new Error("radius is required");
  if (steps <= 0) throw new Error("steps must be greater than 0");
  var results = [];
  switch (geojson.type) {
    case "GeometryCollection":
      geomEach(geojson, function(geometry) {
        var buffered = bufferFeature(geometry, radius, units, steps);
        if (buffered) results.push(buffered);
      });
      return featureCollection(results);
    case "FeatureCollection":
      featureEach(geojson, function(feature2) {
        var multiBuffered = bufferFeature(feature2, radius, units, steps);
        if (multiBuffered) {
          featureEach(multiBuffered, function(buffered) {
            if (buffered) results.push(buffered);
          });
        }
      });
      return featureCollection(results);
  }
  return bufferFeature(geojson, radius, units, steps);
}
function bufferFeature(geojson, radius, units, steps) {
  var properties = geojson.properties || {};
  var geometry = geojson.type === "Feature" ? geojson.geometry : geojson;
  if (geometry.type === "GeometryCollection") {
    var results = [];
    geomEach(geojson, function(geometry2) {
      var buffered2 = bufferFeature(geometry2, radius, units, steps);
      if (buffered2) results.push(buffered2);
    });
    return featureCollection(results);
  }
  var projection = defineProjection(geometry);
  var projected = {
    type: geometry.type,
    coordinates: projectCoords(geometry.coordinates, projection)
  };
  var reader = new GeoJSONReader();
  var geom = reader.read(projected);
  var distance = radiansToLength(lengthToRadians(radius, units), "meters");
  var buffered = BufferOp.bufferOp(geom, distance, steps);
  var writer = new GeoJSONWriter();
  buffered = writer.write(buffered);
  if (coordsIsNaN(buffered.coordinates)) return void 0;
  var result = {
    type: buffered.type,
    coordinates: unprojectCoords(buffered.coordinates, projection)
  };
  return feature(result, properties);
}
function coordsIsNaN(coords) {
  if (Array.isArray(coords[0])) return coordsIsNaN(coords[0]);
  return isNaN(coords[0]);
}
function projectCoords(coords, proj) {
  if (typeof coords[0] !== "object") {
    return proj(coords);
  }
  return coords.map(function(coord) {
    return projectCoords(coord, proj);
  });
}
function unprojectCoords(coords, proj) {
  if (typeof coords[0] !== "object") {
    return proj.invert(coords);
  }
  return coords.map(function(coord) {
    return unprojectCoords(coord, proj);
  });
}
function defineProjection(geojson) {
  var coords = center(geojson).geometry.coordinates;
  var rotation = [-coords[0], -coords[1]];
  return (0, import_d3_geo.geoAzimuthalEquidistant)().rotate(rotation).scale(earthRadius);
}

// node_modules/@turf/convex/dist/esm/index.js
var import_concaveman = __toESM(require_concaveman(), 1);
function convex(geojson, options = {}) {
  options.concavity = options.concavity || Infinity;
  const points = [];
  coordEach(geojson, (coord) => {
    points.push([coord[0], coord[1]]);
  });
  if (!points.length) {
    return null;
  }
  const convexHull = (0, import_concaveman.default)(points, options.concavity);
  if (convexHull.length > 3) {
    return polygon([convexHull], options.properties);
  }
  return null;
}

// node_modules/@turf/kinks/dist/esm/index.js
function kinks(featureIn) {
  let coordinates;
  let feature2;
  const results = {
    type: "FeatureCollection",
    features: []
  };
  if (featureIn.type === "Feature") {
    feature2 = featureIn.geometry;
  } else {
    feature2 = featureIn;
  }
  if (feature2.type === "LineString") {
    coordinates = [feature2.coordinates];
  } else if (feature2.type === "MultiLineString") {
    coordinates = feature2.coordinates;
  } else if (feature2.type === "MultiPolygon") {
    coordinates = [].concat(...feature2.coordinates);
  } else if (feature2.type === "Polygon") {
    coordinates = feature2.coordinates;
  } else {
    throw new Error(
      "Input must be a LineString, MultiLineString, Polygon, or MultiPolygon Feature or Geometry"
    );
  }
  coordinates.forEach((line1) => {
    coordinates.forEach((line2) => {
      for (let i = 0; i < line1.length - 1; i++) {
        for (let k = i; k < line2.length - 1; k++) {
          if (line1 === line2) {
            if (Math.abs(i - k) === 1) {
              continue;
            }
            if (
              // segments are first and last segment of lineString
              i === 0 && k === line1.length - 2 && // lineString is closed
              line1[i][0] === line1[line1.length - 1][0] && line1[i][1] === line1[line1.length - 1][1]
            ) {
              continue;
            }
          }
          const intersection = lineIntersects(
            line1[i][0],
            line1[i][1],
            line1[i + 1][0],
            line1[i + 1][1],
            line2[k][0],
            line2[k][1],
            line2[k + 1][0],
            line2[k + 1][1]
          );
          if (intersection) {
            results.features.push(point([intersection[0], intersection[1]]));
          }
        }
      }
    });
  });
  return results;
}
function lineIntersects(line1StartX, line1StartY, line1EndX, line1EndY, line2StartX, line2StartY, line2EndX, line2EndY) {
  let denominator;
  let a;
  let b;
  let numerator1;
  let numerator2;
  const result = {
    x: null,
    y: null,
    onLine1: false,
    onLine2: false
  };
  denominator = (line2EndY - line2StartY) * (line1EndX - line1StartX) - (line2EndX - line2StartX) * (line1EndY - line1StartY);
  if (denominator === 0) {
    if (result.x !== null && result.y !== null) {
      return result;
    } else {
      return false;
    }
  }
  a = line1StartY - line2StartY;
  b = line1StartX - line2StartX;
  numerator1 = (line2EndX - line2StartX) * a - (line2EndY - line2StartY) * b;
  numerator2 = (line1EndX - line1StartX) * a - (line1EndY - line1StartY) * b;
  a = numerator1 / denominator;
  b = numerator2 / denominator;
  result.x = line1StartX + a * (line1EndX - line1StartX);
  result.y = line1StartY + a * (line1EndY - line1StartY);
  if (a >= 0 && a <= 1) {
    result.onLine1 = true;
  }
  if (b >= 0 && b <= 1) {
    result.onLine2 = true;
  }
  if (result.onLine1 && result.onLine2) {
    return [result.x, result.y];
  } else {
    return false;
  }
}

// scripts/lib/geometry.mjs
function resolveArea(areaConfig) {
  let shape;
  let anchors = [];
  if (areaConfig.kind === "rectangle") {
    shape = bboxPolygon([areaConfig.west, areaConfig.south, areaConfig.east, areaConfig.north]);
  } else if (areaConfig.kind === "polygon") {
    const ring = closeRing(areaConfig.coordinates);
    shape = polygon([ring]);
    if (kinks(shape).features.length) throw new Error("Area polygon self-intersects");
  } else {
    anchors = areaConfig.anchors;
    const unique = dedupePoints(anchors.map((a) => a.point));
    if (unique.length < 3) throw new Error("Area needs at least three unique anchors");
    const hull = convex(featureCollection(unique.map((p) => point(p))));
    if (!hull) throw new Error("Area anchors are collinear");
    shape = areaConfig.bufferMeters > 0 ? buffer(hull, areaConfig.bufferMeters / 1e3, { units: "kilometers", steps: 16 }) : hull;
  }
  if (!shape || area(shape) <= 0) throw new Error("Area polygon is empty");
  if (area(shape) > 2e9) throw new Error("Area polygon is implausibly large");
  const coordinates = shape.geometry.coordinates[0];
  return { label: areaConfig.label, polygon: coordinates, areaHash: sha256(coordinates), feature: shape, anchors };
}
function isInsideArea(coordinate, resolvedArea, { anchorLabels = [], stationLabel } = {}) {
  if (stationLabel && anchorLabels.some((label) => samePlace(label, stationLabel))) return true;
  return booleanPointInPolygon(point(coordinate), resolvedArea.feature, { ignoreBoundary: false });
}
function samePlace(a, b) {
  const normalize = (value) => String(value).normalize("NFKC").toLowerCase().replaceAll("\u0451", "\u0435").replace(/[^\p{L}\p{N}]+/gu, " ").replace(/^(г\s+)?волгоград\s+/u, "").trim();
  const aa2 = normalize(a), bb2 = normalize(b);
  return Boolean(aa2) && aa2 === bb2;
}
function haversineMeters(a, b) {
  const rad = (value) => value * Math.PI / 180;
  const dLat = rad(b[1] - a[1]);
  const dLon = rad(b[0] - a[0]);
  const lat1 = rad(a[1]);
  const lat2 = rad(b[1]);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 63710088e-1 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}
function closeRing(coordinates) {
  const ring = dedupeConsecutive(coordinates);
  if (ring.length < 3) throw new Error("Polygon needs at least three points");
  const first = ring[0], last = ring.at(-1);
  if (first[0] !== last[0] || first[1] !== last[1]) ring.push([...first]);
  return ring;
}
function dedupePoints(points) {
  return [...new Map(points.map((p) => [p.join(","), p])).values()];
}
function dedupeConsecutive(points) {
  return points.filter((p, i) => i === 0 || p[0] !== points[i - 1][0] || p[1] !== points[i - 1][1]);
}

export {
  sha256,
  stableJson,
  uniqueId,
  readJson,
  writeJsonAtomic,
  ageMinutes,
  clampText,
  isMainModule,
  defaultConfigPath,
  defaultSchemaPath,
  defaultBrowserConfigPath,
  loadConfig,
  resolveArea,
  isInsideArea,
  haversineMeters
};
