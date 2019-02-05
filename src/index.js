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
  ctx.fillRect(0, split, canvas.width, canvas.height - split);
}

function addTick(state) {
  var counter = performance.now() / 1000.0;
  var tick = 0.0;
  const historyLength = 60;
  const history = [];
  for (let i = 0; i < historyLength; i++) {
    history.push(0);
  }
  const ret = {
    startTime: counter,
    tick: tick,
    frameIndex: 0,
    movingSum: 0,
    index: 0,
    sampleCount: 0,
    average: 0,
    history: history,
    fps: 0,
    maxfps: 0
  };
  const f = (update) => {
    const nextCounter = performance.now() / 1000.0;
    ret.frameIndex = update ? ret.frameIndex + 1 : ret.frameIndex;
    tick = update ? nextCounter - counter : tick;
    counter = update ? nextCounter : counter;
    ret.history[ret.index] = update ? tick : ret.history[ret.index];
    ret.sampleCount = Math.min(historyLength, update ? ret.sampleCount + 1 : ret.sampleCount);
    const sub =
          ret.sampleCount >= historyLength ? 
          	ret.history[(ret.index + historyLength - 1) % historyLength] : 0;
    ret.movingSum += (update ? tick - sub : 0);
    ret.average = ret.movingSum / ret.sampleCount;
    ret.fps = 1.0 / ret.average;
    ret.maxfps = 
      ret.sampleCount >= historyLength ?
      	Math.max(ret.fps, ret.maxfps) :
    	ret.fps;
    ret.index = update ? (ret.index + 1) % historyLength : ret.index;
    ret.tick = tick;
    //console.log(ret.average);
    return ret;
  };
  return state.produce(state, s => {
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
  funtree.anim.unshift(updateTick);
}

function drawFPS(state, canvas, ctx, color1, color2) {
  const tick = state.tick();
  const w = tick.frameIndex % canvas.width;
  const split = canvas.height - Math.floor((tick.fps / tick.maxfps) * 0.5 * canvas.height);
  ctx.font = "30px Arial";
  ctx.fillStyle = color1;
  ctx.clearRect(0, 0, 300, 100);
  ctx.fillRect(0, 0, 300, 100);
  ctx.fillStyle = color2;
  ctx.fillText(
    Math.floor(tick.fps).toString() + ' FPS / ' +
    Math.floor(tick.maxfps).toString() + ' MAX', 10, 50);
  ctx.clearRect(w + 1, 0, 1, canvas.height);
  ctx.fillStyle = 'blue';
  ctx.fillRect(w + 1, 0, 1, canvas.height);
  ctx.fillStyle = color1;
  ctx.fillRect(w, 0, 1, split);
  ctx.fillStyle = color2;
  ctx.fillRect(w, split, 1, canvas.height - split);
}

(function() {
  const immer = require("immer");
  const produce = immer.produce;

  const steps = [];

  steps.push({
    title: 'Draw Orange + Black',
    state: {},
    funtree: {
      getLibs: [getLibs],
      resetTarget: [resetTarget],
      addCanvas: [addCanvas],
      resizeCanvas: [resizeCanvas],
      get2DContext: [get2DContext],
      anim: [
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
        'anim'
      ],
    }
  });

  steps.push(produce(steps[steps.length - 1], s => {
    s.title = 'Draw Red + Green';
    s.parent = steps[steps.length - 1];
    s.funtree.anim = [
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
    s.title = 'Draw FPS';
    s.parent = steps[steps.length - 1];
    s.funtree.anim = [
      {
        call: drawFPS,
        args: state => ([state, state.canvas, state.ctx, "orange", "black"]),
        ret: (state, x) => state
      }
    ];
    addAndUpdateTick(s.funtree);
  }, function(patches, inversePatches) {
    //console.log("patches", patches);
  }));

  const tutorial = require('./tutorial.js');
  tutorial.setupTutorial(steps);
})();