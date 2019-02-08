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
