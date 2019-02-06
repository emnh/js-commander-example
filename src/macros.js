export function functionTree(parsed) {
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
  list.sort();
  const code = 
    '{\n' +
    list.map(x => x + ': [' + x + ']').join(',\n') +
    '\n}';
  return 'return ' + code + ';';
}

export function expandMacro(f, result) {
  // When file is saved and parsed successfully,
  // expandMacro(f, function() { })
  // is automatically replaced with
  // expandMacro(f, function() { f() })
  return result();
}
