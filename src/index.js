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
  const split = Math.floor(mid + mid * Math.sin(new Date().getTime() * 5.0 / 1000.0) / 2);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = color1;
  ctx.fillRect(0, 0, canvas.width, split);
  ctx.fillStyle = color2;
  ctx.fillRect(0, split, canvas.width, canvas.height  - split);
}

function drawToCanvas(state) {
  drawSplit(state.canvas, state.ctx, "orange", "black");
  return state;
}

function drawToCanvas2(state) {
  drawSplit(state.canvas, state.ctx, "red", "green");
  return state;
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
    draw: [drawToCanvas],
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
  s.funtree.drawToCanvas = [drawToCanvas2];
}, function(patches, inversePatches) {
  //console.log("patches", patches);
}));

const tutorial = require('./tutorial.js');
tutorial.setupTutorial(steps);