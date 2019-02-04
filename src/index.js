/*jshint esversion: 6 */

function getLibs(state) {
  const $ = require('jquery');
  const immer = require("immer");
  const produce = immer.produce;
  
  return produce(state, s => {
    s.$ = $;
    s.produce = produce;
  });
}

function resetTarget(state) {
  const target = state.$(state.target);
  target.empty();
  return state;
}

function addCanvas(state) {
  const target = state.$(state.target);
  target.append("<canvas/>");
  target.css("margin", "0px");
  target.css("overflow", "hidden");
  const canvas = target.find("canvas")[0];
  return state.produce(state, draftState => {
    draftState.canvas = canvas;
  });
}

function resizeCanvas(state) {
  state.canvas.width = state.$(state.target).width();
  state.canvas.height = state.$(state.target).height();
  return state;
}

function get2DContext(state) {
  const ctx = state.canvas.getContext("2d");
  return state.produce(state, draftState => {
    draftState.ctx = ctx;
  });
}

function addStartTime(state) {
  return state.produce(state, draftState => {
    draftState.startTime = new Date().getTime() / 1000.0;
  });
}

function drawSplit(canvas, ctx, color1, color2) {
  const mid = canvas.height / 2;
  const split = Math.floor(mid + mid * Math.sin(new Date().getTime() * 1.0 / 1000.0) / 2);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = color1;
  ctx.fillRect(0, 0, canvas.width, split);
  ctx.fillStyle = color2;
  ctx.fillRect(0, split, canvas.width, canvas.height - split);
}

function addTick(state) {
  var counter = performance.now() / 1000.0;
  var tick = 0.0;
  const f = (update) => {
    const nextCounter = performance.now() / 1000.0;
    tick = update ? nextCounter - counter : tick;
    counter = update ? nextCounter : counter;
    return tick;
  };
  return produce(state, s => {
  	s.tick = f;
  });
}

function updateTick(state) {
  state.tick(true);
  return state;
}

function addAndUpdateTick(funtree) {
  funtree.addTick = [addTick];
  funtree.prepare.push('addTick');
  funtree.draw.unshift(updateTick);
}

function addCounter(state, name) {
  var counter = 0;
  const f = (update) => {
    const oldCounter = counter;
    counter = update ? counter + 1 : counter;
    return oldCounter;
  };
  return produce(state, s => {
  	s[name] = f;
  });
}

function updateCounter(state, name) {
  state[name](true);
  return state;
}

function addAndUpdateCounter(funtree, name) {
  funtree[name] = [
    {
      call: addCounter,
      args: state => ([state, name]),
      ret: (state, x) => x
    }
  ];
  funtree.prepare.push(name);
  funtree.draw.unshift(
    {
      call: updateCounter,
      args: state => ([state, name]),
      ret: (state, x) => x
    });
}

function drawMS(state, canvas, ctx, color1, color2) {
  const mid = canvas.height / 2;
  const time = new Date().getTime() / 1000.0;
  //const split = Math.floor(mid + mid * Math.sin(time) / 2);
  const w = state.frameCounter() % canvas.width;
  const split = Math.floor(state.tick() * 30.0 * canvas.height);
  ctx.clearRect(w, 0, 50, canvas.height);
  ctx.fillStyle = color1;
  ctx.fillRect(w, 0, 1, split);
  ctx.fillStyle = color2;
  ctx.fillRect(w, split, 1, canvas.height - split);
}

const immer = require("immer");
const produce = immer.produce;

const steps = [];

steps.push({
  state: {},
  funtree: {
    getLibs: [getLibs],
    resetTarget: [resetTarget],
    addCanvas: [addCanvas],
    resizeCanvas: [resizeCanvas],
    get2DContext: [get2DContext],
    draw: [
      { 
       call: drawSplit,
       args: state => ([state.canvas, state.ctx, "orange", "black"]),
       ret: (state, x) => state
      }
    ],
    prepare: [
      'getLibs',
      'resetTarget',
      'addCanvas',
      'resizeCanvas',
      'get2DContext',
    ],
    main: [
      'prepare',
      'draw'
    ],
    anim: ['draw']
  }
});

steps.push(produce(steps[steps.length - 1], s => {
  s.parent = steps[steps.length - 1];
  s.funtree.draw = [
    { 
       call: drawSplit,
       args: state => ([state.canvas, state.ctx, "red", "green"]),
       ret: (state, x) => state
      }
  ];
}, function(patches, inversePatches) {
  //console.log("patches", patches);
}));

steps.push(produce(steps[steps.length - 1], s => {
  s.parent = steps[steps.length - 1];
  s.funtree.draw = [
    {
      call: drawMS,
      args: state => ([state, state.canvas, state.ctx, "red", "green"]),
      ret: (state, x) => state
    }
  ];
  addAndUpdateTick(s.funtree);
  s.funtree.addStartTime = [addStartTime];
  addAndUpdateCounter(s.funtree, 'frameCounter');
  s.funtree.prepare.push('addStartTime');
}, function(patches, inversePatches) {
  //console.log("patches", patches);
}));

const tutorial = require('./tutorial.js');
tutorial.setupTutorial(steps);
