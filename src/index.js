/*jshint esversion: 6 */

const $ = require('jquery');
const immer = require("immer");
const produce = immer.produce;

const steps = [];

function resetBody(state) {
  $("body").empty();
  return state;
}

function addCanvas(state) {
  $("body").append("<canvas id='canvas'/>");
  $("body").css("margin", "0px");
  $("body").css("overflow", "hidden");
  var canvas = document.getElementById("canvas");
  return produce(state, draftState => {
    draftState.canvas = canvas;
  });
}

function resizeCanvas(state) {
  state.canvas.width = window.innerWidth;
  state.canvas.height = window.innerHeight;
  return state;
}

function get2DContext(state) {
  const ctx = state.canvas.getContext("2d");
  return produce(state, draftState => {
    draftState.ctx = ctx;
  });
}

function drawToCanvas(state) {
  const ctx = state.ctx;
  ctx.fillStyle = "orange";
  ctx.fillRect(0, 0, canvas.width, canvas.height / 2);
  ctx.fillStyle = "black";
  ctx.fillRect(0, canvas.height / 2, canvas.width, canvas.height / 2);
  return state;
}

function evaluate(step, fname, state) {
  const fns = step.funtree[fname];
  let newState = state === undefined ? step.state : state;
  for (let i = 0; i < fns.length; i++) {
    const fn = fns[i];
    if (typeof fn === 'string') {
      newState = evaluate(step, fn, newState);
    } else {
      newState = fns[i](newState);
    }
    if (newState === null || newState === undefined) {
      throw new Error("no state returned");
    }
  }
  return newState;
}

steps.push({
  state: {},
  funtree: {
    resetBody: [resetBody],
    addCanvas: [addCanvas],
    resizeCanvas: [resizeCanvas],
    get2DContext: [get2DContext],
    drawToCanvas: [drawToCanvas],
    main: [
      'resetBody',
      'addCanvas',
      'resizeCanvas',
      'get2DContext',
      'drawToCanvas'
    ]
  }
});
//evaluate(steps[0], 'main');

function drawToCanvas2(state) {
  const ctx = state.ctx;
  ctx.fillStyle = "red";
  ctx.fillRect(0, 0, canvas.width, canvas.height / 2);
  ctx.fillStyle = "black";
  ctx.fillRect(0, canvas.height / 2, canvas.width, canvas.height / 2);
  return state;
}

steps.push(produce(steps[0], step2 => {
  step2.funtree.drawToCanvas = [drawToCanvas2];
}));
evaluate(steps[1], 'main');