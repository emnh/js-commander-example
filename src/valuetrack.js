const macros = require('./macros.js');
const esprima = require('esprima');
const escodegen = require('escodegen');
const expandMacro = macros.expandMacro;

const escope = require('escope');
const estraverse = require('estraverse');

const cmpNode = function(a, b) {
  //return JSON.stringify(a) === JSON.stringify(b);
  return a.nodeIndex === b.nodeIndex;
};

const logNode = function(text, node) {
  console.log(text, expr(escodegen.generate(node)));
};

const syntaxList = `
AssignmentExpression
AssignmentPattern
ArrayExpression
ArrayPattern
ArrowFunctionExpression
AwaitExpression
BlockStatement
BinaryExpression
BreakStatement
CallExpression
CatchClause
ClassBody
ClassDeclaration
ClassExpression
ConditionalExpression
ContinueStatement
DoWhileStatement
DebuggerStatement
EmptyStatement
ExportAllDeclaration
ExportDefaultDeclaration
ExportNamedDeclaration
ExportSpecifier
ExpressionStatement
ForStatement
ForOfStatement
ForInStatement
FunctionDeclaration
FunctionExpression
Identifier
IfStatement
Import
ImportDeclaration
ImportDefaultSpecifier
ImportNamespaceSpecifier
ImportSpecifier
Literal
LabeledStatement
LogicalExpression
MemberExpression
MetaProperty
MethodDefinition
NewExpression
ObjectExpression
ObjectPattern
Program
Property
RestElement
ReturnStatement
SequenceExpression
SpreadElement
Super
SwitchCase
SwitchStatement
TaggedTemplateExpression
TemplateElement
TemplateLiteral
ThisExpression
ThrowStatement
TryStatement
UnaryExpression
UpdateExpression
VariableDeclaration
VariableDeclarator
WhileStatement
WithStatement
YieldExpression
`;

const defaultHandler = function(x) { return x; };

const AssignmentExpression = defaultHandler;
const AssignmentPattern = defaultHandler;
const ArrayExpression = defaultHandler;
const ArrayPattern = defaultHandler;
const ArrowFunctionExpression = defaultHandler;
const AwaitExpression = defaultHandler;
const BlockStatement = defaultHandler;
const BinaryExpression = defaultHandler;
const BreakStatement = defaultHandler;
const CallExpression = defaultHandler;
const CatchClause = defaultHandler;
const ClassBody = defaultHandler;
const ClassDeclaration = defaultHandler;
const ClassExpression = defaultHandler;
const ConditionalExpression = defaultHandler;
const ContinueStatement = defaultHandler;
const DoWhileStatement = defaultHandler;
const DebuggerStatement = defaultHandler;
const EmptyStatement = defaultHandler;
const ExportAllDeclaration = defaultHandler;
const ExportDefaultDeclaration = defaultHandler;
const ExportNamedDeclaration = defaultHandler;
const ExportSpecifier = defaultHandler;
const ExpressionStatement = defaultHandler;
const ForStatement = defaultHandler;
const ForOfStatement = defaultHandler;
const ForInStatement = defaultHandler;
const FunctionDeclaration = defaultHandler;
const FunctionExpression = defaultHandler;
const Identifier = defaultHandler;
const IfStatement = defaultHandler;
const Import = defaultHandler;
const ImportDeclaration = defaultHandler;
const ImportDefaultSpecifier = defaultHandler;
const ImportNamespaceSpecifier = defaultHandler;
const ImportSpecifier = defaultHandler;
const Literal = defaultHandler;
const LabeledStatement = defaultHandler;
const LogicalExpression = defaultHandler;
const MemberExpression = defaultHandler;
const MetaProperty = defaultHandler;
const MethodDefinition = defaultHandler;
const NewExpression = defaultHandler;
const ObjectExpression = defaultHandler;
const ObjectPattern = defaultHandler;
const Program = defaultHandler;
const Property = defaultHandler;
const RestElement = defaultHandler;
const ReturnStatement = defaultHandler;
const SequenceExpression = defaultHandler;
const SpreadElement = defaultHandler;
const Super = defaultHandler;
const SwitchCase = defaultHandler;
const SwitchStatement = defaultHandler;
const TaggedTemplateExpression = defaultHandler;
const TemplateElement = defaultHandler;
const TemplateLiteral = defaultHandler;
const ThisExpression = defaultHandler;
const ThrowStatement = defaultHandler;
const TryStatement = defaultHandler;
const UnaryExpression = defaultHandler;
const UpdateExpression = defaultHandler;
const VariableDeclaration = defaultHandler;
const VariableDeclarator = defaultHandler;
const WhileStatement = defaultHandler;
const WithStatement = defaultHandler;
const YieldExpression = defaultHandler;

/* List of syntax nodes from
* https://github.com/jquery/esprima/blob/master/src/syntax.ts .*/
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

const identity = function(x) {
  return x;
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
  const fret = function() {
    const args = 
          numArgs === null ?
          	Array.prototype.slice.call(arguments) :
          	Array.prototype.slice.call(arguments, 0, numArgs);
   	//console.log("applying", f, "args", args);
    let ret = null;
    console.log("bindThis", bindThis);
    if (bindThis !== undefined && bindThis.hasOwnProperty('lifted')) {
      bindThis = bindThis.value;
      console.log("bindThis2", bindThis);
    }
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
    //console.log("ret", ret);
    if (isFunction(ret.value)) {
      //ret.call = ret.value;
      ret.call = fret;
    } else {
      ret.call = fret;
    }
    /*
    if (isFunction(ret.value)) {
      //console.log("ret.value is a function", ret.value, ret.value.length, args[0].value);
      const ret2 = liftFunction(null, ret.value, args[0].value);
      ret2.lastUpdate = ret.lastUpdate;
      ret2.deps  = ret.deps;
      ret2.value = ret.value.bind(args[0].value);
      ret2.lifted = ret.lifted;
      return ret2;
    }*/
    return ret;
  };
  return fret;
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
  
  const registered = {};
  const register = function(fname, fbody) {
    if (registered[fname] !== undefined) {
      return;
    }
    registered[fname] = true;
    list.push({
      funName: fname,
      body: fbody
    });
  };
  
  const pp = (code, parentNode, x, scope) => {
    
    if (typeof SyntaxRewrite[x.type] !== 'string') {
      const opts = {
        list: list,
        localFunctions: localFunctions,
        idCounter: idCounter,
        libFunctions: libFunctions,
        scope: scope,
        register: register
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
    funName: 'identity',
    body: 'const identity = ' + identity.toString() + ';\n\n'
  });
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

export function funGraph2() {

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
    console.log("target", target);
    
    resetTarget(target);
    const canvas = addCanvas(target);
    resizeCanvas(canvas, target);
    const ctx = get2DContext(canvas);
    drawSplit(canvas, ctx, 'red', 'green');
  }
}

export function funGraph() {
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

