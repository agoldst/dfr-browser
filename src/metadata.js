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
        condition,
        conditionals;

    // constructor: initialize conditionals
    // empty map if spec.conditionals undefined
    my.conditionals = d3.map(my.conditionals);

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

    // Which variables can we condition topic distributions on?
    // condition() gets/sets key translators, one for each variable. A
    // translator t should do two things: t(doc) should return a "key"
    // string designating the level of the metadata variable (e.g. year
    // of publication) for doc; t.invert(key) should turn a key string
    // into a value suitable for plotting (e.g. a Date). It might just
    // be the identity. See metadata.key and metadata.key.time below.
    //
    // conditionals() returns the d3.map of all the pairings.

    conditionals = function () {
        return my.conditionals;
    };
    that.conditionals = conditionals;

    condition = function (key, value) {
        if (value === undefined) {
            return my.conditionals.get(key);
        }
        my.conditionals.set(key, value);
        return this;
    };
    that.condition = condition;

    return that;
};

metadata.key = {
    // Basic conditional key translator: subscript doc, "invert" is identity
    category: function (k) {
        var result = function (doc) {
            return doc[k];
        };
        result.invert = function (key) {
            return key;
        };
        return result;
    },

    // Utility for generating conditional key/inverter for time
    // metadata.time_key("%Y") is for conditioning by year
    time: function (fmt) {
        var formatter = d3.time.format.utc(fmt),
            result;

        result = function (doc) {
            return formatter(doc.date);
        };
        result.invert = function (key) {
            return formatter.parse(key);
        };
        return result;
    }
};
