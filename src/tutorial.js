/*jshint esversion: 6 */

const $ = require('jquery');
const immer = require("immer");
const produce = immer.produce;
const jsdiff = require('diff');

const hljs = require('highlight.js/lib/highlight');
const javascript = require('highlight.js/lib/languages/javascript');
hljs.registerLanguage('javascript', javascript);
require('highlight.js/styles/dracula.css');

const highlight = require('highlighter')();

const tree = require('./tree.js');

export function evaluateCall(state, fn) {
  const args = fn.args(state);
  const ret = fn.call.apply(null, args);
  return fn.ret(state, ret);
}

export function evaluate(step, fname, state, callback, noeval, mainBody) {
  const fns = step.funtree[fname];
  let newState = state === undefined ? step.state : state;
  const toplevel = mainBody === undefined;
  if (toplevel) {
    mainBody = [
      'function ' + fname + '(state) {',
      '  // tutorial.evaluate(step, "main"); is equivalent to the following:'
    ];
  }
  for (let i = 0; i < fns.length; i++) {
    const fn = fns[i];
    const oldState = newState;
    if (typeof fn === 'string') {
      console.log("fns", fn);
      newState = evaluate(step, fn, newState, callback, noeval, mainBody);
    } else if (fn.hasOwnProperty('call')) {
      const efn = function(state) {
        return evaluateCall(state, fn);
      };
      if (noeval === undefined) {
        newState = efn(newState);
      }
      mainBody.push('  state = (' + fn.ret + ')(state, '  + fn.call.name + '.apply(null, (' + fn.args + ')(state)));');
      if (callback !== undefined) {
        callback({
          oldState: oldState,
          newState: newState,
          fn: fn.call.toString(),
          fnRaw: efn
        });
      }
    } else {
      if (noeval === undefined) {
      	newState = fn(newState);
      }
      mainBody.push('  state = ' + fn.name + '(state);');
      if (callback !== undefined) {
        callback({
          oldState: oldState,
          newState: newState,
          fn: fn.toString(),
          fnRaw: fn
        });
      }
    }
    if (newState === null || newState === undefined) {
      throw new Error("no state returned");
    }
  }
  if (toplevel) {
    mainBody.push('}');
    callback({
      oldState: state,
      newState: newState,
      fn: mainBody.join('\n'),
      fnRaw: state => newState
    });
  }
  return newState;
}


function loadStep(animationFrameFuns, steps, i) {
  return function() {
    animationFrameFuns.length = 0;
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
      allCode.push(code);

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

    const allParentCode = [];
    const parentCallback = function(data) {
      allParentCode.push(data.fn);
    };
    if (step.parent !== undefined) {
      evaluate(step.parent, 'main', undefined, parentCallback, true);
    }
    const mainState = evaluate(step, 'main', undefined, callback);

    const flattened = [];
    evaluate(step, 'anim', undefined, function(data) {
      flattened.push(function() {
        data.fnRaw(mainState);
      });
    }, true);

    for (let i = 0; i < flattened.length; i++) {
    	animationFrameFuns.push(flattened[i]);
    }

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

    const hicode = hljs.highlight('javascript', allCode.join('\n\n')).value;

    if (step.parent !== undefined) {
      const hicode2 =
            hljs.highlight('javascript', allParentCode.join('\n\n')).value;
      const a = allParentCode.join('\n\n');
      const b = allCode.join('\n\n');
      //const diff = jsdiff.diffWords(a, b); //hicode2, hicode);
      const patch =
            jsdiff.createPatch('step', a, b, '', '');
      //const xmldiff = jsdiff.convertChangesToXML(diff);
      //const hicode3 =
      //      hljs.highlight('javascript', xmldiff).value;

      const hipatch = highlight(patch, 'js.diff');
      $("#stepCode")
        .append(
      		"<h2 style='margin-block-end: 0px;'>Difference from parent step:</h2>" +
        	"<pre style='display: inline-block; margin-top: 0px;'>" +
            "<code class='hljs javascript'/></pre>")
        .find("code").last().html(hipatch);
    }

    $("#stepCode")
        .append(
      		"<h2 style='margin-block-end: 0px;'>All the code:</h2>" +
        	"<pre style='display: inline-block; margin-top: 0px;'>" +
            "<code class='hljs javascript'/></pre>")
        .find("code").last().html(hicode);
  };
}

export function setupTutorial(steps) {
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
.diff-addition {
	background: darkgreen;
}
.diff-deletion {
	background: darkred;
}
</style>
`);
  const animationFrameFuns = [];

  function update() {
    for (let i = 0; i < animationFrameFuns.length; i++) {
      const fn = animationFrameFuns[i];
      fn();
    }
  	requestAnimationFrame(update);
  }
  update();

  for (var i = 0; i < steps.length; i++) {
    $("#steps").append(
      "<li id='step" + i + "'><a href='#'><h2>Step " +
      (i + 1) +
      "</h2></a></li>");
    $("#step" + i).click(loadStep(animationFrameFuns, steps, i));
  }
  $("body").append("<div " +
      "style='padding-left: 20px; border: 1px solid black; " +
      "float: left; width: 45vw; height: 95vh; overflow: scroll;' " +
      " id='stepCode'></div>");
  $("body").append("<div " +
      "style='border: 1px solid black; " +
      "float: left; width: 40vw; height: 95vh;' " +
      " id='stepContent'></div>");
  loadStep(animationFrameFuns, steps, 0)();
}
