const valuetrack = require('./valuetrack.js');

export function getFunctionList(parsed) {
  const list = [];
  for (let i = 0; i < parsed.body.length; i++) {
      let decl = parsed.body[i];
      if (decl.type === 'ExportNamedDeclaration')  {
        decl = decl.declaration;
      }
      if (decl.type === 'FunctionDeclaration')  {
        const a = decl.range[0];
        const b = decl.range[1];
        const funName = decl.id.name;
        list.push(funName);
      }
  }
  return list;
}

export function functionTree(code, parsed) {
  const list = getFunctionList(parsed);
  list.sort();
  const newCode = 
    '{\n' +
    list.map(x => x + ': [' + x + ']').join(',\n') +
    '\n}';
  return 'return ' + newCode + ';';
}

export function getAddValueTrack(main) {
  return function(code, parsed) {
  	const list = getFunctionList(parsed);
  	return valuetrack.addValueTrack(code, parsed, list, main);
  };
}

export function expandMacro(f, result) {
  // When file is saved and parsed successfully,
  // expandMacro(f, function() { })
  // is automatically replaced with
  // expandMacro(f, function() { f() })
  return result();
}