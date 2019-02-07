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
    const t = expr('x.call(args)');
    t.callee.object = x.callee;
    t.arguments = x.arguments;
    console.log("t", t);
  	console.log("xx", escodegen.generate(x));
    return t;
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
        //(x => '_state.liftFunction(null, ' + x + ')') :
  		x => x :
  		x => x;
  const e = liftFun(pfx + x.name);
  if (usePrefix) {
    opts.libFunctions[x.name] = true;
  	//console.log("id", e, isMember, x === x.parent.property);
  }
  const t = expr(e);

  return t;
};

const MemberExpression = function(x, opts) {

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

    const fname = 'getMember' + name;
    const fbody = 'const ' + fname + ' = _state => _state.liftFunction(1, a => a.' + name + ');';
    opts.register(fname, fbody);

    const t =
      expr(fname + '(_state, A)');
      // expr('_state.liftFunction(1, a => a.' + name + ', "arg0")(A)');
    const t2 = expr(escodegen.generate(x.object));
    //t.callee.arguments[2] = t2;
    t.arguments[1] = t2;
    //const t3 = expr("identity(" + escodegen.generate(t) + ")");
    x = t;
  }

  //console.log("member", x);

  return x;
};

