const macros = require('./macros.js');
const esprima = require('esprima');
const escodegen = require('escodegen');
const expandMacro = macros.expandMacro;

/* List of syntax nodes from
* https://github.com/jquery/esprima/blob/master/src/syntax.ts .*/

export const Syntax = {
    AssignmentExpression: 'AssignmentExpression',
    AssignmentPattern: 'AssignmentPattern',
    ArrayExpression: 'ArrayExpression',
    ArrayPattern: 'ArrayPattern',
    ArrowFunctionExpression: 'ArrowFunctionExpression',
    AwaitExpression: 'AwaitExpression',
    BlockStatement: 'BlockStatement',
    BinaryExpression: 'BinaryExpression',
    BreakStatement: 'BreakStatement',
    CallExpression: 'CallExpression',
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
    ForStatement: 'ForStatement',
    ForOfStatement: 'ForOfStatement',
    ForInStatement: 'ForInStatement',
    FunctionDeclaration: 'FunctionDeclaration',
    FunctionExpression: 'FunctionExpression',
    Identifier: 'Identifier',
    IfStatement: 'IfStatement',
    Import: 'Import',
    ImportDeclaration: 'ImportDeclaration',
    ImportDefaultSpecifier: 'ImportDefaultSpecifier',
    ImportNamespaceSpecifier: 'ImportNamespaceSpecifier',
    ImportSpecifier: 'ImportSpecifier',
    Literal: 'Literal',
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
    UpdateExpression: 'UpdateExpression',
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

const liftFunction = function(f) {
  // skipAddValueTrack
  return function() {
    const args = Array.prototype.slice.call(arguments);
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
  
  let idCounter = 0;

  const pp = (code, parentNode, x) => {
    if (x.type === 'FunctionDeclaration') {
      // Add _state as first parameter
      x.params.unshift(expr('_state'));
      return x;
    } else if (x.type === 'CallExpression') {
      if (localFunctions[x.callee.name] !== undefined) {
        // Add _state as first argument
        x.arguments.unshift(expr('_state'));
        
        // Replace function with _state.function
        x.callee = expr('_state.' + x.callee.name);
      }
      return x;
  	} else if (x.type === 'BinaryExpression') {
      const op = x.operator;
      const t3 =
      	expr('_state.liftFunction((a, b) => a ' + op + ' b)(A, B)');
      t3.arguments[0] = x.left;
      t3.arguments[1] = x.right;
      return t3;
    } else if (x.type === 'Literal') {
      const lastUpdate = Math.round(new Date().getTime());
      const funName = 'getLiteral' + idCounter;
      const t2 =
        esprima.parse(
          'const ' + funName +
          ' = function(_state) {\n' +
          'return _state.liftValue(a, ' + lastUpdate + ', ' + idCounter + ')' +
          '};\n');
      //console.log(t2);
      const t3 = t2.body[0].declarations[0].init.body.body[0].argument;
      t3.arguments[0] = x;
      const newBody = escodegen.generate(t2);
      list.push({
        funName: funName,
        body: newBody
      });
      idCounter++;
      
      return expr(funName + '(_state)');
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

export function applyUpdate(funGraphA, funGraphB) {
  return funGraphB;
}

//console.log(esprima.parse('const fun = 0;'));

export function funGraph() {
  function sum(a, b) {
    return a + b;
  }

  function calc() {
    return sum(1, 2);
  }

  function main() {
    console.log(calc());
  }
}