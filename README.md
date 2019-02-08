# js-commander-example

# Value tracking

Value tracking allows a program to run incrementally, that is, with only
changes recomputed. It includes a compiler which transforms the code such that
every value is tracked, so that it can be tagged with its last update and its
dependencies. In addition every expression and function call is redirected
through a function which may be used to memoize them. The foundation for it is
similar to F# Computation Expressions or perhaps monad transformers in other
languages.

For example let's transform the following code to track values:

```javascript
const a = 1;
const b = 2;
const c = a + b;
```

Transformed (by hand) (code also in src/example.js):

```javascript
const updateStep = function() {
  let updateCounter = 0;
  return () => updateCounter++;
}();

// Step 1
const a = {
  name: 'a',
  lastUpdate: updateStep(),
  deps: new Set([]),
  value: () => 1
};
const b = {
  name: 'b',
  lastUpdate: updateStep(),
  deps: new Set([]),
  value: () => 2
};
const c = {
  name: 'c',
  lastUpdate: Math.max(a.lastUpdate, b.lastUpdate),
  deps: new Set([a, b]),
  value: () => a.value() + b.value(),
};

console.log("Step 1");
console.log(c.value());
console.log("");

// Step 2
const memoize = function(trackedValue) {
  const oldValue = trackedValue.value;
  trackedValue.value = () => {
    if (!trackedValue.hasOwnProperty('cache')) {
      console.log("computing", trackedValue.name, "for the first time");
      trackedValue.cache = oldValue();
      trackedValue.lastUpdate = updateStep();
    }
    const depsLastUpdate = [...trackedValue.deps].map(a => a.lastUpdate).reduce((a, b) => Math.max(a, b), 0);
    if (trackedValue.lastUpdate < depsLastUpdate) {
      console.log("recomputing", trackedValue.name, 'because', trackedValue.lastUpdate, '<=', depsLastUpdate);
      trackedValue.lastUpdate = depsLastUpdate;
      trackedValue.cache = oldValue();
    }
    return trackedValue.cache;
  };
}

const updateLiteral = (trackedValue, newValue) => {
  const oldValue = trackedValue.cache;
  if (newValue != oldValue) {
    console.log("updating", trackedValue.name, 'to', newValue);
    trackedValue.lastUpdate = updateStep();
    trackedValue.value = () => newValue;
  };
};

const all = [a, b, c];
all.map(x => memoize(x));

console.log("Step 2");
console.log(c.value());
updateLiteral(a, 3);
console.log(c.value());
console.log(c.value());
```

The output is:
```
Step 1
3

Step 2
computing c for the first time
computing a for the first time
computing b for the first time
3
updating a to 3
recomputing c because 4 <= 5
5
5
```
