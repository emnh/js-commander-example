const macros = require('./macros.js');
const esprima = require('esprima');
const escodegen = require('escodegen');
const expandMacro = macros.expandMacro;

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

const CallExpression = function(x, list, localFunctions) {
  if (localFunctions[x.callee.name] !== undefined) {
    // Add _state as first argument
    x.arguments.unshift(expr('_state'));

    // Replace function with _state.function
    x.callee = expr('_state.' + x.callee.name);
  }
  return x;
};

const AssignmentExpression = function(x) {
  const op = x.operator[0];
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

const Literal = function(x, list, localFunctions, idCounter) {
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
    Identifier: 'Identifier',
    IfStatement: 'IfStatement',
    Import: 'Import',
    ImportDeclaration: 'ImportDeclaration',
    ImportDefaultSpecifier: 'ImportDefaultSpecifier',
    ImportNamespaceSpecifier: 'ImportNamespaceSpecifier',
    ImportSpecifier: 'ImportSpecifier',
    Literal: Literal,
    LabeledStatement: 'LabeledStatement',
    LogicalExpression: 'LogicalExpression',
    MemberExpression: 'MemberExpression',
    MetaProperty: 'MetaProperty',
    MethodDefinition: 'MethodDefinition',
    NewExpression: 'NewExpression',
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

function walk(code, parentNode, node, postProcess) {
  // skipAddValueTrack
  if (node !== null && node !== undefined && node.hasOwnProperty('type')) {
    var newNode = {};
    for (var prop in node) {
      var value = node[prop];
      var newValue;
      if (node.type == "Program" && prop == 'tokens') {
        /* Don't process the raw tokens, only AST */
        newValue = value;
      } else if (Array.isArray(value)) {
        newValue = [];
        for (var i = 0; i < value.length; i++) {
          newValue.push(walk(code, newNode, value[i], postProcess));
        }
      } else {
        newValue = walk(code, newNode, value, postProcess);
      }
      newNode[prop] = newValue;
    }
    node = postProcess(code, parentNode, newNode);
  }
  return node;
}

function rewrite(code, ast, postProcess) {
  // skipAddValueTrack
  return walk(code, null, ast, postProcess);
}

const liftValue = function(val, lastUpdate, name) {
  // skipAddValueTrack
  return {
    lastUpdate: lastUpdate,
    deps: new Set([name]),
    value: val
  };
};

const unliftValue = function(obj) {
  return obj.value;
};

const liftFunction = function(numArgs, f) {
  // skipAddValueTrack
  return function() {
    const args = 
          numArgs === null ?
          	Array.prototype.slice.call(arguments) :
          	Array.prototype.slice.call(arguments, 0, numArgs);
   	//console.log("args", args);
    return {
      lastUpdate: args.reduce((a, b) => Math.max(a.lastUpdate, b.lastUpdate)),
      deps: args.reduce((a, b) => new Set([...a.deps, ...b.deps])),
      value: f.apply(this, args.map(x => x.value))
    };
  };
};

function expr(code) {
  return esprima.parse(code).body[0].expression;
}

export function addValueTrack(code, parsed) {
  const list = [];
  const localFunctions = {};
  
  let idCounter = [0];

  const pp = (code, parentNode, x) => {
    
    if (typeof SyntaxRewrite[x.type] !== 'string') {
      return SyntaxRewrite[x.type](x, list, localFunctions, idCounter);
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
  
  const ret =
    '(function() {\n' +
  	(list.map(x => x.body)).join('\n\n') +
    '\n\nreturn {\n' +
    (list.map(x => '  ' + x.funName + ": " + x.funName)).join(', \n') +
    '\n};\n\n' +
    '});\n';
  return ret;
  //return '// ' + main + '\nreturn 0;';
}

function getStamp() {
  return Math.round(new Date().getTime() / 1000.0);
}

export function applyUpdate(funGraphA, funGraphB) {
  if (funGraphA !== undefined) {
    const funGraphC = {};
    for (let key in funGraphB) {
      funGraphB[key].lastUpdate = getStamp();
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
  for (let key in funGraphB) {
    funGraphB[key].lastUpdate = getStamp();
  }
  return funGraphB;
}

//console.log(esprima.parse('fun += 2;'));

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
    console.log(calc());
  }
}
