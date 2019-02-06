import 'codemirror/lib/codemirror.css';
import 'codemirror/addon/lint/lint.css';

import 'jquery.fancytree/dist/skin-lion/ui.fancytree.css';

const $ = require('jquery');
const d3 = require('d3');
const c3 = require('c3');
const macros = require('./macros.js');

const jshint = require('jshint');
window.JSHINT = jshint.JSHINT;

const cm = require('codemirror');
require('codemirror/mode/javascript/javascript');
require('codemirror/mode/mllike/mllike');
require('codemirror/addon/lint/lint');
require('codemirror/addon/lint/javascript-lint');

// Search/replace

require('codemirror/addon/search/search');
require('codemirror/addon/search/searchcursor');
require('codemirror/addon/search/jump-to-line');
require('codemirror/addon/dialog/dialog');
require('codemirror/addon/dialog/dialog.css');

const fancytree = require('jquery.fancytree');
require('jquery.fancytree/dist/modules/jquery.fancytree.edit');
require('jquery.fancytree/dist/modules/jquery.fancytree.filter');

const esprima = require('esprima');

import hotkeys from 'hotkeys-js';

import { throttle, debounce } from 'throttle-debounce';

const state = {};

function rebind(key, f, opts) {
  hotkeys.unbind(key);
  if (opts !== undefined) {
    hotkeys(key, f);
  } else {
    hotkeys(key, opts, f);
  }
}

function jumpToLine(i) { 
  const editor = state.cm;
  var t = editor.charCoords({line: i, ch: 0}, "local").top; 
  var middleHeight = editor.getScrollerElement().offsetHeight / 2; 
  editor.scrollTo(null, t - middleHeight - 5); 
}

function getFun(funName) {
  $.get("/fun", { funName: funName }, function(data) {
    const dp = JSON.parse(data);
    if (
      dp !== undefined &&
      dp[0] !== undefined &&
      dp[0].app !== undefined) {
      const code = dp[0].app;
      state.cm.getDoc().setValue(code);
    }
  });
}

function getApp(fname, funName) {
  $.get("/app", { fname: fname }, function(data) {
    state.fname = fname;
    state.cm.getDoc().setValue(data);
    if (funName !== undefined) {
      try {
        const code = data;
        const parsed = esprima.parseModule(code, { range: true, loc: true });
        for (let i = 0; i < parsed.body.length; i++) {
          let decl = parsed.body[i];
          if (decl.type === 'ExportNamedDeclaration')  {
            decl = decl.declaration;
          }
          if (decl.type === 'FunctionDeclaration' && decl.id.name === funName)  {
            const line = decl.loc.start.line;
            jumpToLine(line);
            return;
          }
        }
      } catch(err) {
        console.log("failed to jump to function");
      }
    }
  });
}

function getFunctions() {
  $.get("/functions", function(data) {
    const dp = JSON.parse(data);
    const ftree = $("#filesTree").fancytree("getTree");
    for (let i = 0; i < dp.length; i++) {
      const fileParent = ftree.rootNode.findFirst(x => x.title === dp[i].fname);
      const funName = dp[i].funName;
      if (fileParent.findFirst((x) => x.title === funName) === null) {
        fileParent.addChildren({
          title: funName
        });
        fileParent.sortChildren(null, true);
        //fileParent.setExpanded(true);
      }
    }
  });
}

function expandMacros(parsed) {
  function Node(parent, child) {
    this.parent = parent;
    this.child = child;
  }
  
  const q = [new Node(null, parsed)];
  
  while(q.length > 0) {
    const tt = q[0];
    const t = tt.child;
    q.shift();
    if (t !== null && t !== undefined && t.hasOwnProperty('type')) {
      if (t.type === 'CallExpression' && t.callee.name === 'expandMacro') {
        //if (t.type === 'CallExpression') {
        //console.log("top", tt.parent, t);
        //console.log("parent", tt.parent);
        //console.log("child", t.callee.name, t);
        try {
          const frange = t.arguments[0].range;
          const c = frange[0];
          const d = frange[1];

          const range = t.arguments[1].body.range;
          const a = range[0];
          const b = range[1];
  
          const code = state.cm.getDoc().getValue();
          const before = code.substring(0, a);
          const toEval = code.substring(c, d);
          const fn = eval(toEval);
          const result = fn(parsed);
          const comment = "// This function is auto-generated on save\n";
          const middle = '{\n' + comment + result + '\n}';
          const after = code.substring(b);

          const newCode = before + middle + after;

          //console.log("newCode", newCode);

          if (newCode !== code) {
            // Make sure new code also parses
            const parsed2 = esprima.parseModule(newCode, { range: true, loc: true });

            state.cm.getDoc().setValue(newCode);

            return true;
          }

        } catch (err) {
          console.log("error expanding macro", err);
          return false;
        }
      }
      for (let child in t) {
        if (t.hasOwnProperty(child)) {
          if (Array.isArray(t[child])) {
            for (let i = 0; i < t[child].length; i++) {
              q.push(new Node(t, t[child][i]));
            }
            } else {
            q.push(new Node(t, t[child]));
          }
        }
      }
    } 
  }

  return false;
}

function save() {
  let code = state.cm.getDoc().getValue();

  try {
    let parsed = esprima.parseModule(code, { range: true, loc: true });

    for (let i = 0; i < 100; i++) {
      if (!expandMacros(parsed)) {
        break;
      };
      code = state.cm.getDoc().getValue();
      parsed = esprima.parseModule(code, { range: true, loc: true });
    }

    const fname = state.fname;

    let total = 1;
    let completed = 0;
    for (let i = 0; i < parsed.body.length; i++) {
      let decl = parsed.body[i];
      //console.log(decl);
      if (decl.type === 'ExportNamedDeclaration')  {
        decl = decl.declaration;
      }
      if (decl.type === 'FunctionDeclaration')  {
        total++;
        const a = decl.range[0];
        const b = decl.range[1];
        const funName = decl.id.name;
        const body = code.slice(a, b);
        // console.log(funName, body);
        $.post("./postfun", {
          fname: fname,
          funName: funName,
          value: body
        }, function(data) {
          completed++;
          if (completed === total) {
            console.log("all functions saved");
            setTimeout(getFunctions, 1000);
          }
        });
      }
    }
    completed++;
    if (completed === total) {
      console.log("all functions saved");
      setTimeout(getFunctions, 1000);
    }

    $.post("./postapp", {
      fname: fname,
      value: code
    }, function(data) {
    });

    console.log("save");
  } catch (e) {
    console.log(e);
    alert("JavaScript parsing failed!");
  }
}

function open() {
  console.log("open");
}

export function main() {
  $("head").append(`
<style>
  .CodeMirror {
    height: 800px;
  }
  i {
    border: solid black;
    border-width: 0 4px 4px 0;
    display: inline-block;
    padding: 4px;
    position: relative;
    top: -4px;
    margin-right: 6px;
  }

  .right {
    transform: rotate(-45deg);
    -webkit-transform: rotate(-45deg);
  }

  .left {
    transform: rotate(135deg);
    -webkit-transform: rotate(135deg);
  }

  .up {
    transform: rotate(-135deg);
    -webkit-transform: rotate(-135deg);
  }

  .down {
    transform: rotate(45deg);
    -webkit-transform: rotate(45deg);
  }

  .hidden {
    display: none;
  }

  body {
    width: 100vw;
    height: 100vh;
    overflow: hidden;
  }

  #output {
    position: absolute;
    right: 0px;
    bottom: 0px;
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
  #stepstree {
    margin-bottom: 20px;
  }
  #leftside {
    float: left;
    height: 99vh;
    width: 49vw;
    overflow: scroll;
  }
  #stepContent {
    border: 1px solid black;
    float: left;
    width: 50vw;
    height: 99vh;
    position: relative;
  }
</style>
`);

  $("body").append(`
      <div id="mainContent" style="display: inline-block;">
        <div id='leftside'>
          <a href="#"><h1 id="toggleIntro"><i class="arrown right"></i>Introduction</h1></a>
          <div class="hidden" id="divIntro" style="width: 40em;">
            This is a differential programming environment where
            you create new versions of code using the immer library.
            Presentation of the evolution of a program is linear (or tree-shaped) and
            is useful for creating tutorials.
            All history is considered useful and bug fixes and updates due to
            dependencies should thus be applied to all historical versions.
            There are a few cases for virtual alterations to be treated differently:
            <ul>
              <li>Update to new version of dependency: Layer patch to all matching function versions</li>
              <li>Bug fix: Layer patch to all matching function versions</li>
              <li>Feature alteration: Named branch</li>
              <li>Forward evolution: New function version</li>
            </ul>
            Redundancy alteration can be treated in various ways. It is designed to apply bug fixes to all versions of program history:
            <ul>
              <li>Structural patch applied to all matching redundancies. Easy forward evolution, but harder patch making.</li>
              <li>
                Avoiding redundancies through structured historical alterations.
                Requires structural patch making on forward evolution, but enables easier bug fixing.
                This is the approach taken.
              </li>
            </ul>
          </div>
          <a href="#"><h1 id="toggleUser"><i class="arrown right"></i>User Profile</h1></a>
          <div id='divUser' class='hidden'>
            <p>User name: <span id="username"></span></p>
          </div>
          <a href="#"><h1 id="toggleEditor"><i class="arrown down"></i>Editor</h1></a>
          <div id='divEditor'>
            <div id='filesTree'><ul/></div>
            <textarea id="code"></textarea>
            <input type="button" value="Save and run (Ctrl+S)"></input>
          </div>
          <a href="#"><h1 id="toggleSteps"><i class="arrown down"></i>Steps</h1></a>
          <div id='divSteps'></div>
          <a href="#"><h1 id="toggleStepCode"><i class="arrown right"></i>Step Code</h1></a>
          <div id='divStepCode' class='hidden'>
            <div id='stepCode'></div>
          </div>
        </div>
        <div id='stepContent'></div>
      </div>
  `);

  function addToggle(header, div) {
    $(header).click(function() {
      $(header + " > i").toggleClass("down");
      $(header + " > i").toggleClass("right");
      $(div).toggleClass("hidden");
    });
  }
  addToggle('#toggleIntro', '#divIntro');
  addToggle('#toggleUser', '#divUser');
  addToggle('#toggleEditor', '#divEditor');
  addToggle('#toggleSteps', '#divSteps');
  addToggle('#toggleStepCode', '#divStepCode');

  const ta = $("#code")[0];
  state.cm = cm.fromTextArea(ta, {
    lineNumbers: true,
    mode: 'javascript',
    gutters: ["CodeMirror-lint-markers"],
    lint: true
  });
  state.cm.setOption('lint', { options: { esversion: 6 }});

  const hotKeys = {
    'Ctrl-S': save
  };

  var opts = {};

  for (var key in hotKeys) {
    const f = hotKeys[key];
    opts[key] = function(f) {
      return function(cm) { f(); };
    }(f);
    const hkey = key.replace('-', '+').replace('Ctrl', 'ctrl');
    rebind(hkey, function(f) {
      return function(evt, handler) {
        evt.preventDefault();
        f();
      };
    }(f));
  }

  state.cm.setOption("extraKeys", opts);

  const code = '';
  state.cm.getDoc().setValue(code);

  $.get("/username", function(data) {
    $("#username").html(data);
  });

  getApp('index.js');

  $("#filesTree").fancytree({
    activate: function(event, data) {
      const ftree = $("#filesTree").fancytree("getTree");
      if (data.node.parent === ftree.rootNode) {
        const fname = data.node.title;
        getApp(fname);
      } else {
        const fname = data.node.parent.title;
        const funName = data.node.title;
        getApp(fname, funName);
      }
    }
  });
  const ftree = $("#filesTree").fancytree("getTree");
  $.get("/listfiles", function(data) {
    const fnames = JSON.parse(data);
    fnames.sort();
    for (let i = 0; i < fnames.length; i++) {
      ftree.rootNode.addChildren({
        title: fnames[i],
        active: fnames[i] === 'index.js'
      });
    }
    getFunctions();
  });

  const doResize = function() {
    const m = $("#mainContent");
    const dockLeft = false;
    if (dockLeft) {
      const ch = m.offset().top + 5;
      const cw = m.offset().left + m.width() + 5;
      const h = window.innerHeight - ch;
      const w = window.innerWidth - cw;
      $("#output").height(h);
      $("#output").width(w);
    } else {
      const ch = m.offset().top + m.height() + 5;
      const cw = m.offset().left + 5;
      const h = window.innerHeight - ch;
      const w = window.innerWidth - cw;
      $("#output").height(h);
      $("#output").width(w);
    }
  };
  doResize();
  $(window).resize(doResize);
  $("#mainContent").on("DOMSubtreeModified", throttle(1000, doResize));
  setTimeout(doResize, 0);
};

