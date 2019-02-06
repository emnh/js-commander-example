export function functionList(parseTree) {
	return 'return 2;';  
}

export function expandMacro(f, result) {
  // When file is saved and parsed successfully,
  // expandMacro(f, function() { })
  // is automatically replaced with
  // expandMacro(f, function() { f() })
  return result();
}