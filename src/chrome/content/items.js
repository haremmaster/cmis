/*
Copyright 2012 Christopher Hoobin. All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are
met:

1. Redistributions of source code must retain the above copyright
notice, this list of conditions and the following disclaimer.

2. Redistributions in binary form must reproduce the above
copyright notice, this list of conditions and the following
disclaimer in the documentation and/or other materials provided
with the distribution.

THIS SOFTWARE IS PROVIDED BY CHRISTOPHER HOOBIN ''AS IS'' AND ANY
EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR
PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL CHRISTOPHER HOOBIN OR
CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL,
EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO,
PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR
PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF
LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING
NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

The views and conclusions contained in the software and documentation
are those of the authors and should not be interpreted as representing
official policies, either expressed or implied, of Christopher Hoobin.
*/

Components.utils.import("resource://gre/modules/Services.jsm");
Components.utils.import("resource://gre/modules/XPCOMUtils.jsm");

if (!moongiraffe) var moongiraffe = {};
if (!moongiraffe.Cmis) moongiraffe.Cmis = {};
if (!moongiraffe.Cmis.menu) moongiraffe.Cmis.menu = {};

moongiraffe.Cmis.menu.items = {
    tree: null,
    treeview: null,

    load: function() {
        var branch = Services.prefs.getBranch("extensions.cmis@moongiraffe.net.");

        var list = branch.getComplexValue("directoryList", Components.interfaces.nsISupportsString).data;

        var data = this.loaddata(list);

        this.tree = document.getElementById("tree");

        this.treeview = new Treeview(data);

        this.tree.view = this.treeview;

        this.treeview.invalidate();

        this.select();
    },

    loaddata: function(list) {
        var items = [];

        if (list === "")
            return items;

        var data = list.split("|");

        for (var i = 0; i < data.length; i++)
            items.push(new Item(data[i]));

        return items;
    },

    update: function() {
        var list = "";

        var count = this.treeview.rowCount;

        var first = true;

        for(var i = 0; i < count; i++) {
            if (first)
                first = false;
            else
                list += "|";

            if (this.treeview.items[i].container)
                list += ">";
            else if (this.treeview.items[i].separator)
                list += "-";
            else
                list += ".";

            list += "!" + this.treeview.items[i].depth;

            if (this.treeview.items[i].separator)
                continue;

            list += "!" + this.treeview.getCellText(i, "name");

            if (this.treeview.items[i].container) // submenu
                continue;

            list += "!" + this.treeview.getCellText(i, "path") + "!" + this.treeview.getCellText(i, "prefix");
        }

        var branch = Services.prefs.getBranch("extensions.cmis@moongiraffe.net.");

        var string = Components.classes["@mozilla.org/supports-string;1"]
            .createInstance(Components.interfaces.nsISupportsString);

        string.data = list;

        branch.setComplexValue("directoryList", Components.interfaces.nsISupportsString, string);

        return true;
    },

    select: function() {
        var index = this.treeview.selection.currentIndex;

        var count = this.treeview.rowCount;

        document.getElementById("button-up").disabled = false;

        if (index == 0 && this.treeview.items[0].depth == 0) {
            document.getElementById("button-up").disabled = true;
        }

        document.getElementById("button-down").disabled = false;

        if (index < 0) {
            document.getElementById("button-down").disabled = true;
        }
        else if (this.treeview.items[index].container) {
            var children = this.treeview.containerchildren(index);
            if (index + children == count - 1 && this.treeview.items[index].depth == 0)
                document.getElementById("button-down").disabled = true;
        }
        else if (index == count - 1 && this.treeview.items[count - 1].depth == 0) {
            document.getElementById("button-down").disabled = true;
        }

        document.getElementById("button-delete").disabled = index < 0;

        document.getElementById("button-edit").disabled = index < 0 || this.treeview.isSeparator(index);

        return true;
    },

    newitem: function(container) {
        var item = new Item();

        item.container = container;

        window.openDialog(
            "chrome://cmis/content/edit.xul",
            null,
            "chrome,modal,centerscreen,resizable=yes,dependent=yes",
            item);

        if (item.name === "")
            return;

        if (!item.container && item.path === "")
            return;

        this.treeview.insert(item);

        this.treeview.invalidate();

        this.update();
    },

    separator: function() {
        this.treeview.insert(new Item("-!0")); // new separator at depth 0
        this.update();
    },

    edit: function() {
        var index = this.treeview.selection.currentIndex;

        if (index < 0)
            return;

        window.openDialog(
            "chrome://cmis/content/edit.xul",
            null,
            "chrome,modal,centerscreen,resizable=yes,dependent=yes",
            this.treeview.items[index]);

        this.treeview.invalidate();

        this.update();
    },

    delete: function() {
        this.treeview.delete();
        this.update();
    },

    move: function(up) {
        var from = this.treeview.selection.currentIndex;
        var to;

        this.tree.focus();

        if (up) {
            if (from <= 0)
                return;

            to = from - 1;
        }
        else {
            if (from == this.treeview.rowCount - 1) {
                if (this.treeview.items[from].depth == 0)
                    return;

                to = from;
            }
            else {
                to = from + 1;
            }
        }

        this.treeview.swap(up, to, from);

        this.tree.focus();

        this.treeview.invalidate();

        this.update();
    }
};

// https://developer.mozilla.org/en/XUL_Tutorial/Tree_View_Details
// https://developer.mozilla.org/en/XUL_Tutorial/Custom_Tree_Views
// https://developer.mozilla.org/en-US/docs/XUL_Tutorial/More_Tree_Features
// https://developer.mozilla.org/en-US/docs/XPCOM_Interface_Reference/nsITreeView

function Item(string) {
    this.container = false;
    this.separator = false;
    this.depth = 0;
    this.name = "";
    this.path = "";
    this.prefix = "";

    if (string !== undefined) {
        var data = string.split("!");

        // All items have a depth field.
        this.depth = parseInt(data[1]);

        if (data[0] === "-") {
            this.separator = true;
            return;
        }

        // Submenu and item elements have a name field.
        this.name = data[2];

        if (data[0] === '>') {
            this.container = true;
            return;
        }

        // Only item elements have a path and prefix field.
        this.path = data[3];
        this.prefix = data[4];
    }
}

Item.prototype.toString = function() {
    var str = "[ ";

    if (this.separator) {
        str += "- ";
        str += this.depth;
    }
    else if (this.container) {
        str += "> ";
        str += this.depth + ", ";
        str += this.name;
    }
    else  {
        str += ". ";
        str += this.depth + ", ";
        str += this.name + ", ";
        str += this.path + ", ";
        str += this.prefix;
    }

    str += " ]";

    return str;
}

function Treeview(items) {
    this.items = items;
    this.treebox = null;
    this.selection = null;
}

Treeview.prototype = {
    invalidate: function() {
        this.treebox.invalidate();
    },

    shuffleleft: function(index, nitems) {
        var temp = this.items[index];

        for (var i = index; i < index + nitems; i++)
            this.items[i] = this.items[i + 1];

        this.items[index + nitems - 1] = temp;
    },

    shuffleright: function(index, nitems) {
        var temp = this.items[index + nitems - 1];

        for (var i = index + nitems - 2; i >= index; i--)
            this.items[i + 1] = this.items[i];

        this.items[index] = temp;
    },

    containerchildren: function(index) {
        if (!this.items[index].container)
            return 0;

        var children = 0;

        for (var i = 1; index + i < this.items.length; i++) {
            if (this.items[index + i].depth <= this.items[index].depth)
                break;

            children++;
        }

        return children;
    },

    // This is a beast of a function. I have commented up a storm for maintainability :DD
    swap: function(up, to, from) {
        var fromitems = this.containerchildren(from) + 1;

        if (to == from && // If we are an 'item' in the Treeview
            !this.items[from].container && // that is, we are 'not' a container
            from == this.items.length - 1 && // and we are the last 'item'
            this.items[from].depth > 0) { // and the depth of the item is greater than zero
            // we need to incrementally reduce its depth.
            this.items[from].depth--;

            this.selection.select(from);

            // Otherwise the down button does not get set to hidden.
            moongiraffe.Cmis.menu.items.select();
            return;
        }

        if (from + fromitems == this.items.length && // If we are the last 'submenu' of the Treeview
            this.items[from].container && // that is, we 'are' a container
            !up && // we are moving downards
            this.items[from].depth > 0) { // and the depth of the submenu is greater than zero
            // we need to incrementally reduce its depth.
            for (var i = from; i < from + fromitems; i++)
                this.items[i].depth--;

            this.selection.select(from);

            // Otherwise the down button does not get set to hidden.
            moongiraffe.Cmis.menu.items.select();
            return;
        }

        if (to < from) { // Moving upwards.
            // If the item above the submenu we wish to move is an
            // element of a deeper submenu we will increase the depth
            // of the from items until we match.
            if (this.items[to].depth > this.items[from].depth) {
                for (var i = from; i < from + fromitems; i++)
                    this.items[i].depth++;

                this.selection.select(from);
                moongiraffe.Cmis.menu.items.select();
                return;
            }

            // If the item above the submenu we wish to move is a
            // submenu that is the same depth we will increase the
            // depth of the from items.
            if (this.items[to].container && this.items[to].depth == this.items[from].depth) {
                for (var i = from; i < from + fromitems; i++)
                    this.items[i].depth++;

                this.selection.select(from);
                moongiraffe.Cmis.menu.items.select();
                return;
            }

            // If the item above is an actual submenu we have to decrease
            // the from items submenu depth.
            if (this.items[to].container && this.items[to].depth < this.items[from].depth) {
                for (var i = from; i < from + fromitems; i++)
                    this.items[i].depth--;

                // In this case we do not return here. We still have
                // to preform the swap. To move the items out of the
                // current submenu.
            }
        }
        else { // Moving downwards.
            // We have to adjust 'to' past the 'from' submenu items.
            to = from + fromitems;
        }

        // If the depths are equal we need to preform a swap.
        if (this.items[to].depth == this.items[from].depth) {
            // If we are moving a submenu downwards and the to items
            // are also a submenu we nest it inside the new submenu.
            if (this.items[to].container && to > from) {
                for (var i = from; i < from + fromitems; i++)
                    this.items[i].depth++;
            }

            if (to < from) { // Moving upwards. The 'to' index marks the beginning.
                this.shuffleleft(to, fromitems + 1); // Including the 'to' item on the left.
                this.selection.select(to); // Select the new position of the submenu.
            }
            else { // Moving downwards. The 'from' index marks the beginning.
                this.shuffleright(from, fromitems + 1); // Including the 'to' item on the right.
                this.selection.select(from + 1); // Select the new position of the submenu.
            }

            return;
        }

        // If we make it here we increase or decrease the depths of
        // the from items submenu until we match with the two element.
        if (this.items[to].depth > this.items[from].depth) {
            for (var i = from; i < from + fromitems; i++)
                this.items[i].depth++;
        }
        else if (this.items[to].depth < this.items[from].depth) {
            for (var i = from; i < from + fromitems; i++)
                this.items[i].depth--;
        }

        this.selection.select(from);
        moongiraffe.Cmis.menu.items.select();
    },

    insert: function(newItem) {
        this.items.push(newItem);

        this.treebox.rowCountChanged(this.rowCount, 1);

        this.selection.select(this.items.length - 1);

        moongiraffe.Cmis.menu.items.select();
    },

    delete: function() {
        var index = this.selection.currentIndex;

        if (index < 0)
            return;

        var nitems = this.containerchildren(index) + 1;

        this.items.splice(index, nitems);

        this.treebox.rowCountChanged(index, -nitems);

        if (this.items.length > 0)
            this.selection.select(index == 0 ? 0 : index - 1);

        //this.selection.select(index);
        moongiraffe.Cmis.menu.items.select();
    },

    // The functions bellow implement nsITreeView.

    get rowCount() {
        return this.items.length;
    },

    setTree: function(treebox) {
        this.treebox = treebox;
    },

    getCellText: function(row, column) {
        switch (typeof(column) == "object" ? column.id : column) {
        case "name":
            return this.items[row].name;
        case "path":
            return this.items[row].path;
        case "prefix":
            return this.items[row].prefix;
        default:
            return "";
        }
    },

    isSeparator: function(row) {
        return this.items[row].separator;
    },

    isContainer: function(row) {
        return this.items[row].container;
    },

    getParentIndex: function(row) {
        if (this.isContainer(row))
            return -1;

        for (var index = row - 1; index >= 0 ; index--) {
            if (this.isContainer(index))
                return index;
        }

        return -1;
    },

    getLevel: function(row) {
        return this.items[row].depth;
    },

    hasNextSibling: function(row, after) {
        var level = this.getLevel(row);

        for (var index = after + 1; index < this.items.length; index++) {
            var next = this.getLevel(index);
            if (next == level)
                return true;

            if (next < level)
                break;
        }

        return false;
    },

    // Force all submenu's to always be open. This will keep the arrow
    // icon even on empty submenus. It makes it easier to determine
    // what is a subment and what is an item.
    isContainerOpen: function(row) { return true; },
    isContainerEmpty: function(row) { return false; },
    toggleOpenState: function(row) { return; },

    isSorted: function(row) { return false; },
    isEditable: function(row) { return false; },
    cycleHeader: function(col, elem) {},
    selectionChanged: function() {},
    cycleCell: function(row, col) {},
    performAction: function(action) {},
    performActionOnCell: function(action, row, col) {},
    getRowProperties: function(row,props) {},
    getCellProperties: function(row,col,props) {},
    getColumnProperties: function(colid,col,props) {},
    getImageSrc: function getImageSrc(index, column) {},

    // https://bugzilla.mozilla.org/show_bug.cgi?id=654998
    QueryInterface: XPCOMUtils.generateQI([Components.interfaces.nsITreeView]),
};