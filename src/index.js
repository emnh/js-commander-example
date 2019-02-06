/*
  TODO:
  - Automatic function hook-up resolution based on matching inputs / outputs.
  - Function registry for indirection and hot reload without server / webpack.
  - GLSL handling.
  - Replace window references with a ./hot.js module for hot reload related features.
  - Prefer regular functions, not "state" functions,
    but find a way to automatically bind them to state.
    Perhaps regular arguments and return a dictionary, then esprima map it?
  - Error propagation.
*/

const webgl = require('./webgl.js');
const editor = require('./editor.js');
const tutorial = require('./tutorial.js');

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
  return state.produce(state, s => {
    s.canvas = canvas;
  });
}

function addFPSCanvas(state) {
  const target = state.$(state.target);
  target.append("<canvas id='fpsCanvas' width='60' height='30'/>");
  const jqCanvas = target.find("#fpsCanvas");
  jqCanvas
  	.css("position", "absolute")
  	.css("top", "0px")
  	.css("left", "0px");
  	//.css("margin-top", "-" + 2 * state.$(state.target).height() + "px");
  const canvas = jqCanvas[0];
  const ctx = canvas.getContext("2d");
  return state.produce(state, s => {
    s.fpsCanvas = canvas;
    s.fpsCtx = ctx;
  });
}

function resizeCanvas(state) {
  state.canvas.width = state.$(state.target).width();
  state.canvas.height = state.$(state.target).height();
  return state;
}

function get2DContext(state) {
  const ctx = state.canvas.getContext("2d");
  return state.produce(state, s => {
    s.ctx = ctx;
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
          	ret.history[(ret.index + 1) % historyLength] : 0;
    ret.movingSum += (update ? tick - sub : 0);
    ret.average = ret.sampleCount > 1 ? ret.movingSum / (ret.sampleCount - 1) : 0;
    //console.log("ms", 144 * tick, 144 * sub, ret.sampleCount - 1, 144 * ret.average);
    ret.fps = ret.average > 0 ? 1.0 / ret.average : 0.0;
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
  funtree.preAnim.push(updateTick);
}

function drawFPS(state, canvas, ctx, color1, color2) {
  const tick = state.tick();
  const offset = 0; //canvas.width <= 90 ? canvas.width / 2 : 0;
  const w = offset + tick.frameIndex % (canvas.width - offset);
  const split = canvas.height - Math.floor((tick.fps / tick.maxfps) * 0.5 * canvas.height);
  ctx.font = "12px Arial";
  ctx.fillStyle = color1;
  ctx.clearRect(0, 0, canvas.width - offset, 12);
  ctx.fillRect(0, 0, canvas.width - offset, 12);
  ctx.fillStyle = color2;
  ctx.fillText(
    Math.floor(tick.fps).toString() +
    //'(' + Math.floor(tick.maxfps).toString() + ')' +
    ' FPS', 5, 12);
  ctx.clearRect(w + 1, 0, 1, canvas.height);
  ctx.fillStyle = 'blue';
  ctx.fillRect(w + 1, 0, 1, canvas.height);
  ctx.fillStyle = color1;
  ctx.fillRect(w, 0, 1, split);
  ctx.fillStyle = color2;
  ctx.fillRect(w, split, 1, canvas.height - split);
}

function addConfig(state) {
  let config = {};
  const f = (name, value) => {
    if (name === undefined) {
      return config;
    }
    if (value === undefined) {
      return config[name];
    }
    config = state.produce(config, c => {
      c[name] = value;
      c.lastUpdate = performance.now() / 1000.0;
    });
    return value;
  };
  state.$(state.target)
  	.append("<div id='config' />")
    .find("#config")
    .css("position", "absolute")
  	.css("top", "20px")
  	.css("right", "40px");
  return state.produce(state, s => {
    s.config = f;
  });
}

function serializeConfig(state) {
  const config = state.config();
  return (
    state.sconfig !== undefined && config.lastUpdate === state.sconfig.lastUpdate ?
      state :
      state.produce(state, s => {
        s.sconfig = config;
      }));
}

function addColorConfig(state, name, value) {
  state.$("#config")
    .append("<input id='" + name + "' type='color' style='display: block;'/>")
  	.find("#" + name)
    .change((evt) => {
      console.log(name, evt.target.value);
      state.config(name, evt.target.value);
    })
  	.val(value);
  state.config(name, value);
  return state;
}

function functionList(parseTree) {
	return 'return 2;';  
}

function expandMacro(f, result) {
  // When file is saved and parsed successfully,
  // expandMacro(f, function() { })
  // is automatically replaced with
  // expandMacro(f, function() { f() })
  return result();
}

function main() {
  const immer = require("immer");
  const produce = immer.produce;
  
  const funtree = expandMacro(functionList, function() {
    
  });

  const steps = [];

  steps.push({
    title: ['2D', 'Draw Orange + Black'],
    state: {},
    funtree: {
      getLibs: [getLibs],
      resetTarget: [resetTarget],
      addCanvas: [addCanvas],
      resizeCanvas: [resizeCanvas],
      getContext: [get2DContext],
      anim: [
        { 
         call: drawSplit,
         args: s => ([s.canvas, s.ctx, "orange", "black"]),
         ret: (s, x) => s
        }
      ],
      prepare: [
        'getLibs',
        'resetTarget',
        'addCanvas',
        'resizeCanvas',
        'getContext',
      ],
      main: [
        'prepare',
        'anim'
      ],
    }
  });

  steps.push(produce(steps[steps.length - 1], s => {
    s.title = ['2D', 'Draw Red + Green'];
    s.parent = steps[steps.length - 1];
    s.funtree.anim = [
      { 
         call: drawSplit,
         args: s => ([s.canvas, s.ctx, "red", "green"]),
         ret: (s, x) => s
        }
    ];
  }, function(patches, inversePatches) {
    //console.log("patches", patches);
  }));

  steps.push(produce(steps[steps.length - 1], s => {
    s.title = ['2D', 'Draw FPS'];
    s.parent = steps[steps.length - 1];
    s.funtree.anim = ['preAnim', 'mainAnim'];
    s.funtree.preAnim = [];
    s.funtree.mainAnim = [
      {
        call: drawFPS,
        args: s => ([s, s.canvas, s.ctx, "orange", "black"]),
        ret: (s, x) => s
      }
    ];
    addAndUpdateTick(s.funtree);
  }, function(patches, inversePatches) {
    //console.log("patches", patches);
  }));
  
  steps.push(produce(steps[steps.length - 1], s => {
    s.title = ['2D', 'Configure Color'];
    s.parent = steps[steps.length - 1];
    s.funtree.preAnim.push(serializeConfig);
    s.funtree.mainAnim = [
      {
        call: drawFPS,
        args: s => ([s, s.canvas, s.ctx, s.config('color1'), s.config('color2')]),
        ret: (s, x) => s
      }
    ];
    s.funtree.addConfig = [addConfig];
    s.funtree.prepare.push('addConfig');
    s.funtree.addColorConfig = [
      {
        call: addColorConfig,
        args: s => ([s, 'color1', '#ff8040']),
        ret: (s, x) => x
      },
      {
        call: addColorConfig,
        args: s => ([s, 'color2', '#000000']),
        ret: (s, x) => x
      }
    ];
    s.funtree.prepare.push('addColorConfig');
  }, function(patches, inversePatches) {
    //console.log("patches", patches);
  }));
  
  // START OF 3D
  
  steps.push(produce(steps[steps.length - 1], s => {
    s.title = ['3D', 'Clear Canvas'];
    s.parent = steps[steps.length - 1];
    s.funtree.getContext = [webgl.getGLContext];
    s.funtree.clearCanvas = [webgl.clearCanvas];
    s.funtree.mainAnim = ['clearCanvas'];
  }));
  
  steps.push(produce(steps[steps.length - 1], s => {
    s.title = ['3D', 'Draw Square'];
    s.parent = steps[steps.length - 1];
    s.funtree.prepare.push(webgl.drawSquare);
    s.funtree.prepare.push(addFPSCanvas);
    s.funtree.mainAnim = [
      {
        call: drawFPS,
        args: s => ([s, s.fpsCanvas, s.fpsCtx, 'green', 'pink']),
        ret: (s, x) => s
      },
      {
        call: webgl.drawScene,
        args: s => ([s.gl, s.programInfo, s.buffers]),
        ret: (s, x) => s
      }
    ];
  }));

  tutorial.setupTutorial(steps);
  
  //console.log("main done");
}

if (module.hot) {
  module.hot.accept(function() {
	console.log('Problem accepting updated self!');
  });

  module.hot.decline('./editor.js');
}

if (window.loaded === undefined) {
  require('jquery')(function() {
    editor.main();
	main();
  });
  window.loaded = true;
} else {
  require('jquery')(function() {
    main();
  });
}
