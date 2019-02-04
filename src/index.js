/*jshint esversion: 6 */

const $ = require('jquery');
const immer = require("immer");
const produce = immer.produce;

const hljs = require('highlight.js/lib/highlight');
const javascript = require('highlight.js/lib/languages/javascript');
hljs.registerLanguage('javascript', javascript);
require('highlight.js/styles/dracula.css');

const tree = require('./tree.js');

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
    
    $("#stepCode").append(`
    <div>
      <label>Search: <input id="input1"/></label>
    </div>
    <table id="tree">
      <colgroup>
      <col width="30px">
      <col width="10px">
      <col width="200px">
      <col width="200px">
	  <col width="10px">
      </colgroup>
      <thead>
        <tr>
			<th></th>
			<th>#</th>
			<th>Function</th>
			<th>Code</th>
			<th></th>
		</tr>
      </thead>
      <tbody>
        <!-- Define a row template for all invariant markup: -->
        <tr>
          <td class="alignCenter"></td>
          <td></td>
          <td></td>
          <td>
			<pre style='display: inline-block; margin: 0px;'></pre>
		  </td>
		  <td></td>
        </tr>
      </tbody>
    </table>
	`);
    $("#tree pre").append("<code class='hljs javascript'/>");
    
    const renderColumns = function(event, data) {
      var node = data.node;
      var $tdList = $(node.tr).find(">td");

      // (Index #0 is rendered by fancytree by adding the checkbox)
      // Set column #1 info from node data:
      $tdList.eq(1).text(node.getIndexHier());
      // (Index #2 is rendered by fancytree)
      // Set column #3 info from node data:
      $tdList.eq(3).find("code").html(node.data.code);
      //$tdList.eq(4).find("code").html(node.data.state);
    };
    
    tree.addTree("#stepCode", renderColumns);
    const ftree = $("#tree").fancytree("getTree");
    
    const allCode = [];
    
    const callback = function(data) {
      const before = jstr(data.oldState);
      const code = data.fn;
      const after = jstr(data.newState);
      const hicode = hljs.highlight('javascript', code).value;
      const afterCode =
      	"state = " + hljs.highlight('javascript', after).value + ";";
      const title = code.match(/function ([^ (]+)/)[1];
      allCode.push(hicode);
      
      ftree.rootNode.addChildren({
        title: title,
        folder: true,
        //expanded: true,
        children: [
          {
            title: "Body",
            code: hicode
          },
          {
            title: "Returned State",
            folder: true,
            children: [{
              title: "",
              code: afterCode
            }]
          }
        ]
      });
    };
    
    evaluate(step, 'main', undefined, callback);
 
    /*
    ftree.rootNode.addChildren({
        title: 'All the code',
        folder: true,
        expanded: true,
        children: [
          {
            title: "Body",
            code: allCode.join('\n\n')
          }
        ]
      });
    */
    
    $("#stepCode")
        .append(
      		"<h2 style='margin-block-end: 0px;'>All the code:</h2>" +
        	"<pre style='display: inline-block; margin-top: 0px;'>" + 
            "<code class='hljs javascript'/></pre>")
        .find("code").last().html(allCode.join('\n\n'));
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
      "float: left; width: 45vw; height: 95vh; overflow: scroll;' " +
      " id='stepCode'></div>");
  $("body").append("<div " + 
      "style='border: 1px solid black; " +
      "float: left; width: 40vw; height: 95vh;' " +
      " id='stepContent'></div>");
}
setupTutorial();
clickStep(0)();