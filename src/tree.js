/* jshint esversion: 6 */

require('jquery.fancytree/dist/skin-lion/ui.fancytree.css');

const $ = require('jquery');
// window.jQuery = $;
// window.$ = $;

const jqueryUI = require('webpack-jquery-ui');
require('webpack-jquery-ui/css');
const contextmenu = require('ui-contextmenu/jquery.ui-contextmenu');

const fancytree = require('jquery.fancytree');
require('jquery.fancytree/dist/modules/jquery.fancytree.dnd5');
require('jquery.fancytree/dist/modules/jquery.fancytree.edit');
require('jquery.fancytree/dist/modules/jquery.fancytree.gridnav');
require('jquery.fancytree/dist/modules/jquery.fancytree.table');
require('jquery.fancytree/dist/modules/jquery.fancytree.filter');

$(function() {
  $("head").append(`
  <style type="text/css">
    .ui-menu {
      width: 180px;
      font-size: 63%;
    }
    .ui-menu kbd { /* Keyboard shortcuts for ui-contextmenu titles */
      float: right;
    }
    /* custom alignment (set by 'renderColumns'' event) */
    .alignLeft {
       text-align: left;
    }
    .alignRight {
       text-align: right;
    }
    .alignCenter {
       text-align: center;
    }
  </style>`);
});

export function addTree(container, renderColumns) {

  var CLIPBOARD = null;

  /*
  $(container).append(`
    <h1>Example: tree grid with keyboard navigation, DnD, and editing capabilites </h1>
    <div class="description">
      Bringing it all together: this sample combines different extensions and
      custom events to implement an editable tree grid:
      <ul>
        <li>'ext-dnd' to re-order nodes using drag-and-drop.</li>
        <li>'ext-table' + 'ext-gridnav' to implement a tree grid.<br>
          Try <kbd>UP / DOWN / LEFT / RIGHT</kbd>, <kbd>TAB</kbd>, <kbd>Shift+TAB</kbd>
          to navigate between grid cells. Note that embedded input controls
          remain functional.
        </li>
        <li>'ext-edit': inline editing.<br>
          Try <kbd>F2</kbd> to rename a node.<br>
          <kbd>Ctrl+N</kbd>, <kbd>Ctrl+Shift+N</kbd> to add nodes (Quick-enter: add new nodes until
          [enter] is hit on an empty title).
        </li>
        <li>Extended keyboard shortcuts:<br>
          <kbd>Ctrl+C</kbd>, <kbd>Ctrl+X</kbd>, <kbd>Ctrl+P</kbd> for copy/paste,<br>
          <kbd>Ctrl+UP</kbd>, <kbd>Ctrl+DOWN</kbd>, <kbd>Ctrl+LEFT</kbd>, <kbd>Ctrl+RIGHT</kbd> to move nodes around and change indentation.
        </li>
        <li>3rd-party <a href="https://github.com/mar10/jquery-ui-contextmenu">contextmenu</a> for additional edit commands</li>
      </ul>
    </div>
  `);
  */

  $("#tree").fancytree({
    checkbox: true,
    titlesTabbable: true,     // Add all node titles to TAB chain
    quicksearch: true,        // Jump to nodes when pressing first character
    source: [],
    extensions: ["edit", "dnd5", "table", "gridnav", "filter"],
    dnd5: {
      preventVoidMoves: true,
      preventRecursiveMoves: true,
      autoExpandMS: 400,
      dragStart: function(node, data) {
        return true;
      },
      dragEnter: function(node, data) {
        // return ["before", "after"];
        return true;
      },
      dragDrop: function(node, data) {
        data.otherNode.moveTo(node, data.hitMode);
      }
    },
    edit: {
      triggerStart: ["f2", "shift+click", "mac+enter"],
      close: function(event, data) {
        if( data.save && data.isNew ){
          // Quick-enter: add new nodes until we hit [enter] on an empty title
          $("#tree").trigger("nodeCommand", {cmd: "addSibling"});
        }
      }
    },
    table: {
      indentation: 20,
      nodeColumnIdx: 2,
      checkboxColumnIdx: 0
    },
    gridnav: {
      autofocusInput: false,
      handleCursorKeys: true
    },

    /*
    lazyLoad: function(event, data) {
      data.result = {url: "../demo/ajax-sub2.json"};
    },
    */
    createNode: function(event, data) {
      var node = data.node,
        $tdList = $(node.tr).find(">td");

      // Span the remaining columns if it's a folder.
      // We can do this in createNode instead of renderColumns, because
      // the 'isFolder' status is unlikely to change later
      if( node.isFolder() ) {
        $tdList.eq(2)
          .prop("colspan", 6)
          .nextAll().remove();
      }
    },
    renderColumns: renderColumns
  }).on("nodeCommand", function(event, data){
    // Custom event handler that is triggered by keydown-handler and
    // context menu:
    var refNode, moveMode,
      tree = $(this).fancytree("getTree"),
      node = tree.getActiveNode();

    switch( data.cmd ) {
    case "moveUp":
      refNode = node.getPrevSibling();
      if( refNode ) {
        node.moveTo(refNode, "before");
        node.setActive();
      }
      break;
    case "moveDown":
      refNode = node.getNextSibling();
      if( refNode ) {
        node.moveTo(refNode, "after");
        node.setActive();
      }
      break;
    case "indent":
      refNode = node.getPrevSibling();
      if( refNode ) {
        node.moveTo(refNode, "child");
        refNode.setExpanded();
        node.setActive();
      }
      break;
    case "outdent":
      if( !node.isTopLevel() ) {
        node.moveTo(node.getParent(), "after");
        node.setActive();
      }
      break;
    case "rename":
      node.editStart();
      break;
    case "remove":
      refNode = node.getNextSibling() || node.getPrevSibling() || node.getParent();
      node.remove();
      if( refNode ) {
        refNode.setActive();
      }
      break;
    case "addChild":
      node.editCreateNode("child", "");
      break;
    case "addSibling":
      node.editCreateNode("after", "");
      break;
    case "cut":
      CLIPBOARD = {mode: data.cmd, data: node};
      break;
    case "copy":
      CLIPBOARD = {
        mode: data.cmd,
        data: node.toDict(function(n){
          delete n.key;
        })
      };
      break;
    case "clear":
      CLIPBOARD = null;
      break;
    case "paste":
      if( CLIPBOARD.mode === "cut" ) {
        // refNode = node.getPrevSibling();
        CLIPBOARD.data.moveTo(node, "child");
        CLIPBOARD.data.setActive();
      } else if( CLIPBOARD.mode === "copy" ) {
        node.addChildren(CLIPBOARD.data).setActive();
      }
      break;
    default:
      alert("Unhandled command: " + data.cmd);
      return;
    }

  // }).on("click dblclick", function(e){
  //   console.log( e, $.ui.fancytree.eventToString(e) );

  }).on("keydown", function(e){
    var cmd = null;

    // console.log(e.type, $.ui.fancytree.eventToString(e));
    switch( $.ui.fancytree.eventToString(e) ) {
    case "ctrl+shift+n":
    case "meta+shift+n": // mac: cmd+shift+n
      cmd = "addChild";
      break;
    case "ctrl+c":
    case "meta+c": // mac
      cmd = "copy";
      break;
    case "ctrl+v":
    case "meta+v": // mac
      cmd = "paste";
      break;
    case "ctrl+x":
    case "meta+x": // mac
      cmd = "cut";
      break;
    case "ctrl+n":
    case "meta+n": // mac
      cmd = "addSibling";
      break;
    case "del":
    case "meta+backspace": // mac
      cmd = "remove";
      break;
    // case "f2":  // already triggered by ext-edit pluging
    //   cmd = "rename";
    //   break;
    case "ctrl+up":
      cmd = "moveUp";
      break;
    case "ctrl+down":
      cmd = "moveDown";
      break;
    case "ctrl+right":
    case "ctrl+shift+right": // mac
      cmd = "indent";
      break;
    case "ctrl+left":
    case "ctrl+shift+left": // mac
      cmd = "outdent";
    }
    if( cmd ){
      $(this).trigger("nodeCommand", {cmd: cmd});
      // e.preventDefault();
      // e.stopPropagation();
      return false;
    }
  });

  /*
   * Tooltips
   */
  // $("#tree").tooltip({
  //   content: function () {
  //     return $(this).attr("title");
  //   }
  // });

  /*
   * Context menu (https://github.com/mar10/jquery-ui-contextmenu)
   */
  $("#tree").contextmenu({
    delegate: "span.fancytree-node",
    menu: [
      {title: "Edit <kbd>[F2]</kbd>", cmd: "rename", uiIcon: "ui-icon-pencil" },
      {title: "Delete <kbd>[Del]</kbd>", cmd: "remove", uiIcon: "ui-icon-trash" },
      {title: "----"},
      {title: "New sibling <kbd>[Ctrl+N]</kbd>", cmd: "addSibling", uiIcon: "ui-icon-plus" },
      {title: "New child <kbd>[Ctrl+Shift+N]</kbd>", cmd: "addChild", uiIcon: "ui-icon-arrowreturn-1-e" },
      {title: "----"},
      {title: "Cut <kbd>Ctrl+X</kbd>", cmd: "cut", uiIcon: "ui-icon-scissors"},
      {title: "Copy <kbd>Ctrl-C</kbd>", cmd: "copy", uiIcon: "ui-icon-copy"},
      {title: "Paste as child<kbd>Ctrl+V</kbd>", cmd: "paste", uiIcon: "ui-icon-clipboard", disabled: true }
      ],
    beforeOpen: function(event, ui) {
      var node = $.ui.fancytree.getNode(ui.target);
      $("#tree").contextmenu("enableEntry", "paste", !!CLIPBOARD);
      node.setActive();
    },
    select: function(event, ui) {
      var that = this;
      // delay the event, so the menu can close and the click event does
      // not interfere with the edit control
      setTimeout(function(){
        $(that).trigger("nodeCommand", {cmd: ui.cmd});
      }, 100);
    }
  });
};

