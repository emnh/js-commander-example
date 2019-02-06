const esprima = require('esprima');
const escodegen = require('escodegen');

export function expandMacro(f, result) {
  return result();
}

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

export function addValueTrack(code, parsed, functionList, main) {
  const list = [];
  
  let idCounter = 0;

  const pp = (code, parentNode, x) => {
    if (x.type === 'BinaryExpression') {
      const op = x.operator;
      const t2 =
      	esprima.parse('liftFunction((a, b) => a ' + op + ' b)(A, B)');
      const t3 = t2.body[0].expression;
      // console.log(x);
      // console.log(t3);
      t3.arguments[0] = x.left;
      t3.arguments[1] = x.right;
      return t3;
    } else if (x.type === 'Literal') {
      const lastUpdate = Math.round(new Date().getTime() / 1000.0);
      const t2 =
        esprima.parse('liftValue(a, ' + lastUpdate + ', ' + idCounter + ')');
      idCounter++;
      const t3 = t2.body[0].expression;
      // console.log(x);
      // console.log(t3);
      t3.arguments[0] = x;
      return t3;
    } else {
      return x;
    }
  };

  for (let i = 0; i < parsed.body.length; i++) {
      let decl = parsed.body[i];
      if (decl.type === 'ExportNamedDeclaration')  {
        decl = decl.declaration;
      }
      if (decl.type === 'FunctionDeclaration')  {
        const a = decl.range[0];
        const b = decl.range[1];
        const funName = decl.id.name;
        if (code.slice(a, b).indexOf('expandMacro') >= 0 ||
            code.slice(a, b).indexOf('skipAddValueTrack') >= 0) {
          const comment = '// ' +
            funName +
            ' skipped because it contains expandMacro or skipAddValueTrack';
          /*list.push({
            funName: funName,
            body: comment
          });*/
          console.log(comment);
          continue;
        }
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
  const ret =
    'const liftValue = ' + liftValue.toString() + ';\n\n' +
    'const liftFunction = ' + liftFunction.toString() + ';\n\n' +
  	(list.map(x => x.body)).join('\n\n') +
    '\n\nreturn {\n' +
    (list.map(x => '  ' + x.funName + ": " + x.funName)).join(', \n') +
    '\n};\n\n';
  console.log(ret);
  return ret;
  //return '// ' + main + '\nreturn 0;';
}

//console.log(esprima.parse('const fun = 0;'));

function sum(a, b) {
  return a + b;
}

function calc() {
  return sum(1, 2);
}

function main() {
  console.log(calc());
}

function doTest() {
  return expandMacro(window.App && window.App.macros.getAddValueTrack(), function() {
// This function is auto-generated on save
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

const sum = function(a, b) {
    return liftFunction((a, b) => a + b)(a, b);
};

const calc = function() {
    return sum(liftValue(1, 1549476372, 0), liftValue(2, 1549476372, 1));
};

const main = function() {
    console.log(calc());
};

return {
  sum: sum, 
  calc: calc, 
  main: main
};


});
}

doTest().main();
