/* jshint esversion: 6 */

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

export function getEvaluateCall(fn) {
  return function(s) {
    return evaluateCall(s, fn);
  };
}

export function evaluate(step, fname, state, callback, noeval, mainBody) {
  const fns = step.funtree[fname];
  const toplevel = mainBody === undefined;
  let newState = state === undefined ? step.state : state;
  if (toplevel) {
    mainBody = [
      'function ' + fname + '(state) {',
      '  // tutorial.evaluate(step, "main"); is equivalent to the following:'
    ];
  } else if (fname === 'anim') {
    mainBody.push('  // the following is added to animation loop: ');
  }
  for (let i = 0; i < fns.length; i++) {
    const fn = fns[i];
    const oldState = newState;
    if (typeof fn === 'string') {
      newState = evaluate(step, fn, newState, callback, noeval, mainBody);
    } else if (fn.hasOwnProperty('call')) {
      const efn = getEvaluateCall(fn);
      if (noeval === undefined) {
        newState = efn(newState);
        if (newState === null || newState === undefined) {
          throw new Error("no state returned");
        }
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
        if (newState === null || newState === undefined) {
          throw new Error("no state returned");
        }
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
  }
  if (toplevel && fname === 'main') {
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


function loadStep(animationFrameFuns, steps, id, i) {
  return function() {
    animationFrameFuns.length = 0;
    $("#stepCode").empty();
    $("#stepCode")
      .append(
        "<h2>Code for step " + id + ': ' +
        steps[i].title.join(' ') + "</h2>");
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

    let animState = mainState;
    const flattened = [];
    evaluate(step, 'anim', undefined, function(data) {
      flattened.push(function() {
        animState = data.fnRaw(animState);
        if (animState === undefined) {
          throw new Error('undefined state returned');
        }
      });
    }, true);

    for (let i = 0; i < flattened.length; i++) {
    	animationFrameFuns.push(flattened[i]);
    }

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

function update() {
  for (let i = 0; i < animationFrameFuns.length; i++) {
    const fn = animationFrameFuns[i];
    fn();
  }
  requestAnimationFrame(update);
}

export function setupTutorial(steps) {
  if (window.animationFrameFuns === undefined) {
    window.animationFrameFuns = [];
    update();
  }

  $("#divSteps").empty().append(`
    <div id='stepstree'>
      <ul style='float: left; margin-right: 20px;' id='steps'/>
    </div>
    `);

  const seen = {};
  let i = 0;
  let lastNum = '';
  for (let k = 0; k < steps.length; k++) {
    const prefix = steps[k].title[0];
    const isNewPrefix = seen[prefix] === undefined;
    const j =
        Object.keys(seen).length + (isNewPrefix ? 1 : 0);
    if (isNewPrefix) {
      $("#steps").append(
        "<li class='folder expanded'>" +
        j + ': ' + prefix +
        "<ul id='prefix" + j + "'/></li>");
      i = 0;
    } else {
      i++;
    }
    seen[prefix] = true;
    const stepNum = j + '.' + (i + 1);
    const selected = k + 1 == steps.length ? ' active' : '';
    lastNum = stepNum;
    $("#prefix" + j).append(
      "<li class='folder" + selected + "' id='step" + j + '.' + (i + 1) + '.' + k + "'>" +
      stepNum + ': ' + steps[k].title[steps[k].title.length - 1] +
      "</li>");
  }
  $("#stepstree").fancytree({
      activate: function(event, data) {
        const m = data.node.key.match(/step([0-9]+)\.([0-9]+)\.([0-9]+)/);
        if (m !== null) {
          const id = m[1] + '.' + m[2];
          const i = parseInt(m[3]);
          loadStep(animationFrameFuns, steps, id, i)();
        }
      },
    });
  loadStep(animationFrameFuns, steps, lastNum, steps.length - 1)();
}
