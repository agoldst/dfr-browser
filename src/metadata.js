/*global d3 */
"use strict";

// ---- metadata specification ----
//
// This object stores metadata. A metadata object should do the following:
//
// from_string: load data from text (called by browser().load())
// doc(i): access metadata for document or documents i
// n_docs: say how many documents there are
//
// metadata() is a generic and not used here except as a template for
// metadata.dfr(), which understands DfR metadata.

var metadata = function (spec) {
    var my = spec || { },
        that = { },
        from_string,
        doc,
        n_docs,
        conditionals;

    // default method: d3 csv parsing
    from_string = function (s) {
        if (typeof s !== "string") {
            return;
        }
        my.docs = d3.csv.parse(s);
    };
    that.from_string = from_string;

    doc = function (i) {
        if (isFinite(i)) {
            return my.docs[i];
        }

        if (i === undefined) {
            return my.docs;
        }

        // otherwise, assume i is an array of indices
        return i.map(function (j) { return my.docs[j]; });
    };
    that.doc = doc;

    n_docs = function () {
        if (my.docs) {
            return my.docs.length;
        }
    };
    that.n_docs = n_docs;

    // Which variables can we condition topic distributions on? This
    // should return a d3.map where keys name the variable and values
    // are functions for extracting variable values from a document
    // (see metadata.dfr.conditionals for an example). This function is
    // invoked by model.set_meta.

    conditionals = function () {
        return d3.map();
    };
    that.conditionals = conditionals;

    return that;
};
