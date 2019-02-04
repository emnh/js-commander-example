/*jshint esversion: 6 */

const $ = require('jquery');
const immer = require("immer");
const produce = immer.produce;

const hljs = require('highlight.js/lib/highlight');
const javascript = require('highlight.js/lib/languages/javascript');
hljs.registerLanguage('javascript', javascript);
require('highlight.js/styles/dracula.css');

const steps = [];

function resetTarget(state) {
  const target = $(state.target);
  target.empty();
  return state;
}

function addCanvas(state) {
  const target = $(state.target);
  target.append("<canvas/>");
  target.css("margin", "0px");
  target.css("overflow", "hidden");
  const canvas = target.find("canvas")[0];
  return produce(state, draftState => {
    draftState.canvas = canvas;
  });
}

function resizeCanvas(state) {
  state.canvas.width = $(state.target).width();
  state.canvas.height = $(state.target).height();
  return state;
}

function get2DContext(state) {
  const ctx = state.canvas.getContext("2d");
  return produce(state, draftState => {
    draftState.ctx = ctx;
  });
}

function drawToCanvas(state) {
  const canvas = state.canvas;
  const ctx = state.ctx;
  ctx.fillStyle = "orange";
  ctx.fillRect(0, 0, canvas.width, canvas.height / 2);
  ctx.fillStyle = "black";
  ctx.fillRect(0, canvas.height / 2, canvas.width, canvas.height / 2);
  return state;
}

function evaluate(step, fname, state, callback) {
  const fns = step.funtree[fname];
  let newState = state === undefined ? step.state : state;
  for (let i = 0; i < fns.length; i++) {
    const fn = fns[i];
    const oldState = newState;
    if (typeof fn === 'string') {
      newState = evaluate(step, fn, newState, callback);
    } else {
      newState = fn(newState);
      if (callback !== undefined) {
        callback({
          oldState: oldState,
          newState: newState,
          fn: fn.toString()
        });
      }
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
    resetTarget: [resetTarget],
    addCanvas: [addCanvas],
    resizeCanvas: [resizeCanvas],
    get2DContext: [get2DContext],
    drawToCanvas: [drawToCanvas],
    main: [
      'resetTarget',
      'addCanvas',
      'resizeCanvas',
      'get2DContext',
      'drawToCanvas'
    ]
  }
});
//evaluate(steps[0], 'main');

function drawToCanvas2(state) {
  const canvas = state.canvas;
  const ctx = state.ctx;
  ctx.fillStyle = "red";
  ctx.fillRect(0, 0, canvas.width, canvas.height / 2);
  ctx.fillStyle = "black";
  ctx.fillRect(0, canvas.height / 2, canvas.width, canvas.height / 2);
  return state;
}

steps.push(produce(steps[0], step2 => {
  step2.funtree.drawToCanvas = [drawToCanvas2];
}, function(patches, inversePatches) {
  console.log("patches", patches);
}));
//evaluate(steps[1], 'main');

function clickStep(i) {
  return function() {
    $("#stepCode").empty();
    $("#stepCode").append("<h1>Code for step " + (i + 1) + "</h1>");
    $("#stepCode").append(
      "<p>" +
      "Functions are evaluated in order " +
      "with returned state of the first function passed to the next." +
      "</p>");
    const step = produce(steps[i], step => {
      step.state.target = '#stepContent';
    });
    const jstr = function(obj) {
      return JSON.stringify(obj, null, 2);
    };
    var first = true;
    const callback = function(data) {
      const before = jstr(data.oldState);
      const code = data.fn;
      const after = jstr(data.newState);
      if (first) {
      	$("#stepCode").append("<a href='#' class='showstate'>Show state</a>");
        $("#stepCode").append(
          "<pre class='state hidden'>" +
          "<code class='hljs javascript'>" +
          "state = " + hljs.highlight('javascript', before).value + ";" +
          "</code>" +
          "</pre>");
        first = false;
      }
      const hicode = hljs.highlight('javascript', code).value;
      $("#stepCode")
        .append(
        	"<div><pre style='display: inline-block;'>" + 
            "<code class='hljs javascript'/></pre></div>")
        .find("code").last().html(hicode);
      $("#stepCode").append("<a href='#' class='showstate'>Show state</a>");
      $("#stepCode").append(
        "<pre class='state hidden'>" +
        "<code class='hljs javascript'>" +
        "state = " + hljs.highlight('javascript', after).value + ";" +
        "</code>" +
        "</pre>");
    };
    evaluate(step, 'main', undefined, callback);
    $("#stepCode a.showstate").click(function(evt) {
      $(evt.target).next("pre.state").toggleClass("hidden");
    });
  };
}

function setupTutorial() {
  $("body").append("<ul style='float: left; margin-right: 20px;' id='steps'/>");
  $("body").append(`
<style>
.state {
	border: 1px solid black;
}
.hidden {
	display: none;
}
pre code {
  font: normal 10pt Consolas, Monaco, monospace;
}
</style>
`);
  for (var i = 0; i < steps.length; i++) {
    $("#steps").append(
      "<li id='step" + i + "'><a href='#'><h2>Step " +
      (i + 1) +
      "</h2></a></li>");
    $("#step" + i).click(clickStep(i));
  }
  $("body").append("<div " + 
      "style='padding-left: 20px; border: 1px solid black; " +
      "float: left; width: 45vw; height: 90vh; overflow: scroll;' " +
      " id='stepCode'></div>");
  $("body").append("<div " + 
      "style='border: 1px solid black; " +
      "float: left; width: 45vw; height: 90vh;' " +
      " id='stepContent'></div>");
}
setupTutorial();
clickStep(0)();