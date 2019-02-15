# js-commander-example

# Goals
 - Differential programming.
  - All program history is represented and can be viewed by timeline.
  - Bug fixes apply to all versions.
 - Hot reloading. Only changes recomputed.

# Usage scenarios
 - A form of type checking? Differential type checking?
 - Testing. Recording of tests.
 - Watches. What caused value x to change? When did it change?
 - Instant live coding updates.
 - Separation of pure and impure functions.
 - Configuration updates.
 - Change propagation.

# TODO
 - Finish the example by not recalling addCanvas. Invent a mechanism for doing so.
 - Figure out how does value tracking impact the example using cycle.js.
 - Implement a WebGL wrapper for hot reloading.
 - Write live tutorial based on README explaining the concepts.

# Resources
 - https://stackoverflow.com/questions/3202606/javascript-dependency-management
 - https://glebbahmutov.com/blog/test-if-a-function-is-pure-revisited/
 - https://github.com/MithrilJS/mithril.js
 - https://cycle.js.org/getting-started.html
 - https://stackoverflow.com/questions/384286/javascript-isdom-how-do-you-check-if-a-javascript-object-is-a-dom-object
 - https://stackoverflow.com/questions/20983416/if-you-call-glbufferdata-after-already-calling-it-on-a-buffer-is-there-a-memory
 - https://github.com/BabylonJS/Spector.js/blob/master/documentation/apis.md
 - https://0fps.net/2012/07/12/smooth-voxel-terrain-part-2/
 - https://github.com/tdhooper/glsl-marching-cubes
 - https://www.miaumiau.cat/2017/01/gpu-marching-cubes-from-particle-clouds-in-webgl-part-2-marching-cubes-steps/
 - https://stemkoski.github.io/Three.js/Marching-Cubes.html
 - http://dev.miaumiau.cat/sph/
 - https://directtovideo.wordpress.com/2011/05/03/numb-res/
 - https://github.com/Scrawk/Marching-Cubes-On-The-GPU
 - http://stack.gl/packages/
 - https://github.com/stackgl/glsl-transpiler
 - https://github.com/tunabrain/gpu-fluid (histopyramids, but C++)
 - https://github.com/smistad/GPU-Marching-Cubes
 - https://folk.uio.no/erikd/histo/hpmarchertalk.pdf
 - https://github.com/sintefmath/hpmc
 - https://www.youtube.com/watch?v=zdTcAg_G0Go
 - https://github.com/rlguy/GridFluidSim3D
 - https://github.com/shrekshao/MoveWebGL1EngineToWebGL2/blob/master/Move-a-WebGL-1-Engine-To-WebGL-2-Blog-1.md
 - https://fluxml.ai/2019/02/07/what-is-differentiable-programming.html
 - https://arxiv.org/abs/1810.07951
 - https://en.wikipedia.org/wiki/Newton%27s_method
 - https://github.com/FluxML/Zygote.jl
 - https://github.com/iffsid/ad.js#readme
 - https://github.com/ehaas/js-autodiff
 - https://en.wikipedia.org/wiki/Automatic_differentiation
 - http://sunnyday.mit.edu/16.355/wirth-refinement.html
 - https://en.wikipedia.org/wiki/Monad_(functional_programming)

# Separation of concerns

There are multiple more or less independent concerns when dealing with hot
reloading and change propagation. These are:

 - Stateless: JavaScript pure function computations
 - Stateful: DOM
 - Stateful: 2D Canvas
 - Stateful: WebGL

Value tracking deals only with the first concern.

# Pure function considerations

This project handles pure javascript functions as first priority. This project
is not a DOM handler. It does not contain a virtual DOM. For that you should
use a DOM framework like Cycle.js that allows you to keep your functions pure.

That being said, the project does consider any function call that is passed a
DOM node as an argument as impure. There is a mechanism implemented that checks
for changes to properties of DOM elements, for example canvas.width, and only
recomputes on value change. Furthermore, there is a small list of standard
API functions that are tagged pure, such as Math.sin, or impure, such as
Math.random. This should suffice for some smaller codebase, but for real
production codebase it is recommended to go with a framework like Cycle.js
that allows you to sandbox DOM interaction and keep your functions pure.
Either that or iterate over your called function list and tag functions as
pure or impure.

You can change if the default setting is to consider unknown functions pure or
impure. Considering an impure function pure will lead to not recomputing in
spite of changes, while considering a pure function impure will recompute too
much and waste computing resources.

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
