const macros = require('./macros.js');
const memoize = require('./memoize.js');
const expandMacro = macros.expandMacro;
const immer = require('immer');
const produce = immer.produce;

function testMemoize() {
  const sum = function(a, b) {
    return a + b;
  };

  const calc = function() {
    let s = 0;
    for (let i = 0; i < 10; i++) {
      s += sum(1, i);
    }
    return s;
  };

  const main = function() {
    return calc();
  };

  function callGraph(mem) {
    const sum = mem(2, function(a, b) {
      return a + b;
    });

    const calc = mem(0, function () {
      let s = 0;
      for (let i = 0; i < 10; i++) {
        s += funtree.sum(1, i);
      }
      return s;
    });

    const main = mem(0, function() {
      return funtree.calc();
    });

    const funtree = {
      sum: sum,
      calc: calc,
      main: main
    };

    return funtree;
  }

  function timeit(f, n) {
    const before = performance.now();
    let checksum = 0;
    for (let i = 0; i < n; i++) {
      checksum += f();
    }
    const after = performance.now();
    return {
      time: after - before,
      iterations: n,
      result: checksum
    };
  }

  const n = 1000000;

  const funtree = callGraph(function(numArgs, f) {
      return f;
  });

  const sum2 = function(a, b) { return b + a; };

  const sum3 = function(a, b) { return a + b; };

  const calc2 = funtree.main;

  const calc4 = callGraph(memoize.memoize).main;

  const calc5 = callGraph(memoize.memoize2).main;

  const calc6 = callGraph(memoize.memoize3).main;

  const funtree2 = callGraph(memoize.memoize3);
  funtree2.sum = sum3;
  const calc7 = funtree2.main;

  console.log("calc", timeit(main, n));
  console.log("fake memoized calc", timeit(calc2, n));
  funtree.sum = sum2;
  console.log("fake updated memoized calc", timeit(calc2, n));
  console.log("memoized calc", timeit(calc4, n));
  console.log("memoized2 calc", timeit(calc5, n));
  console.log("memoized3 calc", timeit(calc6, n));
  console.log("updated memoized3 calc", timeit(calc7, n));
}

function testValueTracking() {

  const liftValue = function(val, lastUpdate, name) {
    return {
      lastUpdate: lastUpdate,
      deps: new Set([name]),
      value: val
    };
  };
  
  const liftFunction = function(f) {
    return function() {
      const args = Array.prototype.slice.call(arguments);
      return {
        lastUpdate: args.reduce((a, b) => Math.max(a.lastUpdate, b.lastUpdate)),
        deps: args.reduce((a, b) => new Set([...a.deps, ...b.deps])),
        value: f.apply(this, args.map(x => x.value))
      };
    };
  };
  
  const plus = liftFunction((a, b) => a + b);
  
  const a = liftValue(1, 0, 'a');
  const b = liftValue(2, 1, 'b');
  const c = plus(a, b);
  
  console.log(c, [...c.deps]);
}


testValueTracking();