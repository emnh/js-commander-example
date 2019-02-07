const macros = require('./macros.js');
const esprima = require('esprima');
const escodegen = require('escodegen');
const expandMacro = macros.expandMacro;

const escope = require('escope');
const estraverse = require('estraverse');

/* List of syntax nodes from
* https://github.com/jquery/esprima/blob/master/src/syntax.ts .*/

const ForStatement = function(x) {
  const t = expr('_state.unliftValue(x)');
  t.arguments[0] = x.test;
  x.test = t;
  return x;
};

const FunctionDeclaration = function(x) {
  // Add _state as first parameter
  x.params.unshift(expr('_state'));
  return x;
};

const cmpNode = function(a, b) {
  //return JSON.stringify(a) === JSON.stringify(b);
  return a.nodeIndex === b.nodeIndex;
};

const logNode = function(text, node) {
  console.log(text, expr(escodegen.generate(node)));
};

const CallExpression = function(x, opts) {

  const list = opts.list;
  const localFunctions = opts.localFunctions;
  const idCounter = opts.idCounter;
  const libFunctions = opts.libFunctions;
  const scope = opts.scope;
  
  if (localFunctions[x.callee.name] !== undefined) {
    // Add _state as first argument
    x.arguments.unshift(expr('_state'));
  } else {
    const t = expr('_state.liftFunction()');
  	console.log("x", escodegen.generate(x));
  }
  
  return x;
};

/*
const CallExpression = function(x, opts) {

  const list = opts.list;
  const localFunctions = opts.localFunctions;
  const idCounter = opts.idCounter;
  const libFunctions = opts.libFunctions;
  const scope = opts.scope;
  
  let addPrefix = true;
  let liftIt = x => {
    const bindThis2 = null;
    const ret = '(_state.liftFunction(null, ' + x + ', ' + bindThis2 + '))';
    console.log("liftIt", x, ret);
    return ret;
  };
  
  if (localFunctions[x.callee.name] !== undefined) {
    // Add _state as first argument
    x.arguments.unshift(expr('_state'));
    liftIt = x => x;
  } else {    
    const name =
          escodegen.generate(x.callee)
    		.replace('new ', '')
    		.replace('_state.', '')
    		.split(/[\.(]/)[0];
   	//if (window[name] !== undefined) {
    //console.log("scope", scope);
    
    const inScope = scope.variables.filter(x => x.name === name).length > 0;
    
    if (!inScope && name !== 'liftFunction' && name !== 'liftValue') {
      //console.log("x", escodegen.generate(x), name);
      libFunctions[name] = true;
    } else {
      addPrefix = false;
      const t = expr('_state.unliftValue(x)');
      //logNode('xxx', x);
      t.arguments[0] = x.callee.object;
      x.callee.object = t;
    }
  }
  
  // Replace function(...) with _state.function(...)
  const xs = escodegen.generate(x.callee);
  const isNew = xs.indexOf('new ') === 0;
  const pfx = 
        (isNew ? 'new ' : '') +
        (!addPrefix || (xs.indexOf('_state.') === 0) ? '' : '_state.');
  
  const e = liftIt(pfx + xs.replace('new ', ''));
  
  
  //console.log("e", e);
  const t = expr(e);
  x.callee = t;

  return x;
};
*/

const AssignmentExpression = function(x) {
  const op = x.operator[0];
  if (op === '=') {
    return x;
  }
  const t3 =
        expr('_state.liftFunction(2, (a, b) => a ' + op + ' b)(A, B)');
  t3.arguments[0] = x.left;
  t3.arguments[1] = x.right;
  const t4 = expr('a = b');
  t4.left = x.left;
  t4.right = t3;
  return t4;
};

const UpdateExpression = function(x) {
  const op = x.operator;
  const t3 =
        x.prefix ?
        expr('_state.liftFunction(1, a => a)(A, ' + op + 'A.value)') :
  expr('_state.liftFunction(1, a => a)(A, A.value' + op + ')');
  t3.arguments[0] = x.argument;
  t3.arguments[1].argument.object = x.argument;
  return t3;
};

const BinaryExpression = function(x) {
  const op = x.operator;
  const t3 =
        expr('_state.liftFunction(2, (a, b) => a ' + op + ' b)(A, B)');
  t3.arguments[0] = x.left;
  t3.arguments[1] = x.right;
  return t3;
};

const Literal = function(x, opts) {
  
  const list = opts.list;
  const localFunctions = opts.localFunctions;
  const idCounter = opts.idCounter;
  const libFunctions = opts.libFunctions;
  const scope = opts.scope;
  
  const funName = 'getLiteral' + idCounter[0];
  const t2 =
        esprima.parse(
          'const ' + funName +
          ' = function(_state) {\n' +
          'return _state.liftValue(a, _state.getLiteral' + idCounter[0] + '.lastUpdate, ' + idCounter[0] + ')' +
          '};\n');
  const t3 = t2.body[0].declarations[0].init.body.body[0].argument;
  t3.arguments[0] = x;
  const newBody = escodegen.generate(t2);
  list.push({
    funName: funName,
    body: newBody
  });
  idCounter[0]++;

  return expr('_state.' + funName + '(_state)');
};

const NewExpression = function(x) {
  return x;
};

const Identifier = function(x, opts) {
  let scope = opts.scope;
  let inScope = false;
  const cmpName = y => y.name === x.name;
  while (scope !== null) {
  	inScope = inScope || scope.variables.filter(cmpName).length > 0;
    scope = scope.upper;
  }
  inScope = inScope || x.name === 'REPLACE';
  const isMember = x.parent.type === 'MemberExpression' && cmpNode(x, x.parent.property);
  const usePrefix = !inScope && !isMember;
  const pfx = usePrefix ? '_state.' : '';
  const liftFun =
  	usePrefix ?
        (x => '_state.liftFunction(null, ' + x + ')') :
  		x => x;
  const e = liftFun(pfx + x.name);
  if (usePrefix) {
    opts.libFunctions[x.name] = true;
  	console.log("id", e, isMember, x === x.parent.property);
  }
  const t = expr(e);
  
  return t;
};

const MemberExpression = function(x) {
  
  //logNode("mm", x);
  //console.log("member", x.computed, escodegen.generate(x));
  
  const pfx = '_state.';
  if (x.computed) {
    const t =
      expr('_state.liftFunction(1, (a, b) => a[b])(A, B)');
    t.arguments[0] = x.object;
    t.arguments[1] = x.property;
    x = t;
  } else {
    const name = escodegen.generate(x.property);
    const t =
      expr('_state.liftFunction(1, a => a.' + name + ')(A)');
    const t2 = expr(escodegen.generate(x.object));
    t.arguments[0] = t2;
    x = t;
  }
  
  console.log("member", x);
  
  return x;
};

export const SyntaxRewrite = {
    AssignmentExpression: AssignmentExpression,
    AssignmentPattern: 'AssignmentPattern',
    ArrayExpression: 'ArrayExpression',
    ArrayPattern: 'ArrayPattern',
    ArrowFunctionExpression: 'ArrowFunctionExpression',
    AwaitExpression: 'AwaitExpression',
    BlockStatement: 'BlockStatement',
    BinaryExpression: BinaryExpression,
    BreakStatement: 'BreakStatement',
    CallExpression: CallExpression,
    CatchClause: 'CatchClause',
    ClassBody: 'ClassBody',
    ClassDeclaration: 'ClassDeclaration',
    ClassExpression: 'ClassExpression',
    ConditionalExpression: 'ConditionalExpression',
    ContinueStatement: 'ContinueStatement',
    DoWhileStatement: 'DoWhileStatement',
    DebuggerStatement: 'DebuggerStatement',
    EmptyStatement: 'EmptyStatement',
    ExportAllDeclaration: 'ExportAllDeclaration',
    ExportDefaultDeclaration: 'ExportDefaultDeclaration',
    ExportNamedDeclaration: 'ExportNamedDeclaration',
    ExportSpecifier: 'ExportSpecifier',
    ExpressionStatement: 'ExpressionStatement',
    ForStatement: ForStatement,
    ForOfStatement: 'ForOfStatement',
    ForInStatement: 'ForInStatement',
    FunctionDeclaration: FunctionDeclaration,
    FunctionExpression: 'FunctionExpression',
    Identifier: Identifier,
    IfStatement: 'IfStatement',
    Import: 'Import',
    ImportDeclaration: 'ImportDeclaration',
    ImportDefaultSpecifier: 'ImportDefaultSpecifier',
    ImportNamespaceSpecifier: 'ImportNamespaceSpecifier',
    ImportSpecifier: 'ImportSpecifier',
    Literal: Literal,
    LabeledStatement: 'LabeledStatement',
    LogicalExpression: 'LogicalExpression',
    MemberExpression: MemberExpression,
    MetaProperty: 'MetaProperty',
    MethodDefinition: 'MethodDefinition',
    NewExpression: NewExpression,
    ObjectExpression: 'ObjectExpression',
    ObjectPattern: 'ObjectPattern',
    Program: 'Program',
    Property: 'Property',
    RestElement: 'RestElement',
    ReturnStatement: 'ReturnStatement',
    SequenceExpression: 'SequenceExpression',
    SpreadElement: 'SpreadElement',
    Super: 'Super',
    SwitchCase: 'SwitchCase',
    SwitchStatement: 'SwitchStatement',
    TaggedTemplateExpression: 'TaggedTemplateExpression',
    TemplateElement: 'TemplateElement',
    TemplateLiteral: 'TemplateLiteral',
    ThisExpression: 'ThisExpression',
    ThrowStatement: 'ThrowStatement',
    TryStatement: 'TryStatement',
    UnaryExpression: 'UnaryExpression',
    UpdateExpression: UpdateExpression,
    VariableDeclaration: 'VariableDeclaration',
    VariableDeclarator: 'VariableDeclarator',
    WhileStatement: 'WhileStatement',
    WithStatement: 'WithStatement',
    YieldExpression: 'YieldExpression'
};

function walk(code, parentNode, node, postProcess, scope) {
  // skipAddValueTrack
  if (node !== null && node !== undefined && node.hasOwnProperty('type')) {
    if (node.hasOwnProperty('scope')) {
      scope = node.scope;
    }
    var newNode = {};
    for (var prop in node) {
      var value = node[prop];
      var newValue;
      if (prop === 'scope' || prop === 'parent') {
        newValue = value;
      } else if (node.type == "Program" && prop == 'tokens') {
        /* Don't process the raw tokens, only AST */
        newValue = value;
      } else if (Array.isArray(value)) {
        newValue = [];
        for (var i = 0; i < value.length; i++) {
          newValue.push(walk(code, newNode, value[i], postProcess, scope));
        }
      } else {
        newValue = walk(code, newNode, value, postProcess, scope);
      }
      newNode[prop] = newValue;
    }
    node = postProcess(code, parentNode, newNode, scope);
  }
  return node;
}

function rewrite(code, ast, postProcess) {
  // skipAddValueTrack
  return walk(code, null, ast, postProcess, null);
}

const liftValue = function(val, lastUpdate, name) {
  // skipAddValueTrack
  return {
    lastUpdate: lastUpdate,
    deps: new Set([name]),
    value: val,
    lifted: true
  };
};

const unliftValue = function(obj) {
  return obj.value;
};

const liftFunction = function(numArgs, f, bindThis) {
  const isFunction = function(obj) {
    return !!(obj && obj.constructor && obj.call && obj.apply);
  };

  // skipAddValueTrack
  if (f.hasOwnProperty('lifted') && isFunction(f.value)) {
    f = f.value;
  }
  if (!isFunction(f)) {
    console.log("f is not a function", f);
    return f; //function() { return f; };
    //throw new Error('f is not a function');
  }
  return function() {
    const args = 
          numArgs === null ?
          	Array.prototype.slice.call(arguments) :
          	Array.prototype.slice.call(arguments, 0, numArgs);
   	//console.log("applying", f, "args", args);
    let ret = null;
    if (args.length === 0) {
      ret = {
        lastUpdate: Math.round(new Date().getTime() / 1000.0),
        deps: new Set([]), // TODO: f?
        value: f.apply(bindThis, []),
        lifted: true
      };
    } else if (args.length === 1) {
      ret = {
        lastUpdate: args[0].lastUpdate,
        deps: new Set([...args[0].deps]),
        value: f.apply(bindThis, [args[0].value]),
        lifted: true
      };
    } else {
      ret = {
        lastUpdate: args.map(a => a.lastUpdate).reduce((a, b) => Math.max(a, b)),
        deps: args.map(a => a.deps).reduce((a, b) => new Set([...a, ...b])),
        value: f.apply(bindThis, args.map(x => x.value)),
        lifted: true
      };
    }
    console.log("ret", ret);
    if (isFunction(ret.value)) {
      console.log("ret.value is a function", ret.value, args[0].value);
      const ret2 = liftFunction(null, ret.value, args[0].value);
      ret2.lastUpdate = ret.lastUpdate;
      ret2.deps  = ret.deps;
      ret2.value = ret.value;
      ret2.lifted = ret.lifted;
      return ret2;
    }
    return ret;
  };
};

function expr(code) {
  try {
  	return esprima.parse(code).body[0].expression;
  } catch(err) {
    console.log(code);
    throw(err);
  }
}

function addScope(ast) {  
  const scopeManager = escope.analyze(ast);
  let currentScope = scopeManager.acquire(ast);   // global scope

  estraverse.traverse(ast, {
      enter: function(node, parent) {
          if (/Function/.test(node.type)) {
            currentScope = scopeManager.acquire(node);  // get current function scope
            node.scope = currentScope;
          }
      },
      leave: function(node, parent) {
          if (/Function/.test(node.type)) {
              currentScope = currentScope.upper;  // set to parent scope
          }
      }
  });
}

export function addValueTrack(code, parsedContainer) {
  const list = [];
  const localFunctions = {};
  const libFunctions = {};
  
  addScope(parsedContainer);
  
  const parsed2 = parsedContainer.body[0].body;
  
  let idCounter = [0];

  let nodeCounter = 0;
  const addParents = (code, parentNode, x, scope) => {
    x.nodeIndex = nodeCounter++;
    x.parent = parentNode;
    return x;
  };
  
  const parsed = rewrite(code, parsed2, addParents);
  
  const pp = (code, parentNode, x, scope) => {
    
    if (typeof SyntaxRewrite[x.type] !== 'string') {
      const opts = {
        list: list,
        localFunctions: localFunctions,
        idCounter: idCounter,
        libFunctions: libFunctions,
        scope: scope
      };
      return SyntaxRewrite[x.type](x, opts);
    } else {
      return x;
    }
    
  };
  
  // Get local functions
  for (let i = 0; i < parsed.body.length; i++) {
      let decl = parsed.body[i];
      if (decl.type === 'ExportNamedDeclaration')  {
        decl = decl.declaration;
      }
      if (decl.type === 'FunctionDeclaration')  {
        const funName = decl.id.name;
        localFunctions[funName] = true;
      }
  }

  // Rewrite function graph
  for (let i = 0; i < parsed.body.length; i++) {
    let decl = parsed.body[i];
    if (decl.type === 'ExportNamedDeclaration')  {
      decl = decl.declaration;
    }
    if (decl.type === 'FunctionDeclaration')  {
      const funName = decl.id.name;
      const template = esprima.parse('const ' + funName + ' = 0;');

      decl.id.name = 'REPLACE';
      const rdecl = rewrite(code, decl, pp);
      template.body[0].declarations[0].init = rdecl;
      const newBody = escodegen.generate(template).replace(' REPLACE', '');
      list.push({
        funName: funName,
        body: newBody
      });
    } else {
      list.push({
        funName: undefined,
        body: escodegen.generate(decl)
      });
    }
  }
  
  list.push({
    funName: 'liftValue',
    body: 'const liftValue = ' + liftValue.toString() + ';\n\n'
  });
  list.push({
    funName: 'unliftValue',
    body: 'const unliftValue = ' + unliftValue.toString() + ';\n\n'
  });
  list.push({
    funName: 'liftFunction',
    body: 'const liftFunction = ' + liftFunction.toString() + ';\n\n'
  });
  
  const locfuns = list.map(x => '  ' + x.funName + ": " + x.funName);
  
  for (let key in libFunctions) {
    if (window.App[key] === undefined) {
      throw new Error('Missing library in window.App: ' + key);
    }
  }
  
  const libfuns = Object.keys(libFunctions).map(x => '  ' + x + ": liftValue(window.App." + x + ')');
  const ret =
    '(function() {\n' +
  	(list.map(x => x.body)).join('\n\n') +
    '\n\nreturn {\n' +
    locfuns.concat(libfuns).join(', \n') +
    '\n};\n\n' +
    '});\n';
  return ret;
  //return '// ' + main + '\nreturn 0;';
}

function getStamp() {
  return Math.round(new Date().getTime() / 1000.0);
}

export function applyUpdate(funGraphA, funGraphB) {
  for (let key in funGraphB) {
    funGraphB[key].lastUpdate = getStamp();
  }
  if (funGraphA !== undefined) {
    const funGraphC = {};
    for (let key in funGraphB) {
      // Compare function bodies, update if necessary
      if (funGraphA[key] !== undefined) {
      	//console.log("body", key, funGraphA[key].toString(), funGraphB[key].toString());
      }
      if (funGraphA[key] !== undefined &&
          funGraphA[key].toString() === funGraphB[key].toString()) {
      	funGraphC[key] = funGraphA[key];
      } else {
        funGraphC[key] = funGraphB[key];
      }
    }
    return funGraphC;
  }
  return funGraphB;
}

console.log(esprima.parse("const target = $('#stepContent')[0];"));

export function funGraph() {

  function resetTarget(target) {
    console.log("target", target);
    target.empty();
  }

  function addCanvas(target) {
    target.append("<canvas/>");
    target.css("margin", "0px");
    target.css("overflow", "hidden");
    const jcanvas = target.find("canvas");
    //const canvas = target.find("canvas")[0];
    const canvas = jcanvas[0];
    console.log("canvas", jcanvas, canvas);
    return canvas;
  }

  function resizeCanvas(canvas, target) {
    canvas.width = target.width();
    canvas.height = target.height();
  }

  function get2DContext(canvas) {
    return canvas.getContext("2d");
  }

  function drawSplit(canvas, ctx, color1, color2) {
    const mid = canvas.height / 2;
    const split = Math.floor(mid + mid * Math.sin(new Date().getTime() * 1.0 / 1000.0) / 2);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = color1;
    ctx.fillRect(0, 0, canvas.width, split);
    ctx.fillStyle = color2;
    ctx.fillRect(0, split, canvas.width, canvas.height - split);
  }
  
  function main() {
    const target = $('#stepContent');
    resetTarget(target);
    const canvas = addCanvas(target);
    resizeCanvas(canvas, target);
    const ctx = get2DContext(canvas);
    drawSplit(canvas, ctx, 'red', 'green');
  }
}

export function funGraph2() {
  function sum(a, b) {
    return a + b;
  }

  function calc() {
    let s = 0;
    
    for (let i = 0; i < 10; i++) {
      s += sum(1, i);
    }
    
    return s;
  }

  function main() {
    $('#stepContent').empty().append('<h1>hello</h1>');
    console.log(calc());
  }
}

