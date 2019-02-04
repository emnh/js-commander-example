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

function drawSplit(canvas, ctx, color1, color2) {
  const mid = canvas.height / 2;
  const split = Math.floor(mid + mid * Math.sin(new Date().getTime() * 1.0 / 1000.0) / 2);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = color1;
  ctx.fillRect(0, 0, canvas.width, split);
  ctx.fillStyle = color2;
  ctx.fillRect(0, split, canvas.width, canvas.height  - split);
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
    main: [
      'getLibs',
      'resetTarget',
      'addCanvas',
      'resizeCanvas',
      'get2DContext',
      'draw'
    ],
    anim: ['draw']
  }
});

steps.push(produce(steps[0], s => {
  s.parent = steps[0];
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

const tutorial = require('./tutorial.js');
tutorial.setupTutorial(steps);