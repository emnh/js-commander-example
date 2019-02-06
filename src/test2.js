const macros = require('./macros.js');
const memoize = require('./memoize.js');
const expandMacro = macros.expandMacro;
const immer = require('immer');
const produce = immer.produce;

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
  expandMacro(window.App.macros.getAddValueTrack('main'), function() {
// This function is auto-generated on save
{
    return a + b;
}

{
    return sum(1, 2);
}

{
    console.log(calc());
}

// doTest skipped because it contains expandMacro
});
}