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
        n_docs;

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

    return that;
};

metadata.dfr = function (spec) {
    var my = spec || { },
        that,
        from_string;

    // constructor: build from parent
    that = metadata(my);

    from_string = function (meta_s) {
        var s;
        if (typeof meta_s !== 'string') {
            return;
        }

        // strip blank "rows" at start or end
        s = meta_s.replace(/^\n*/, "")
            .replace(/\n*$/, "\n");

        // assume that there is no column header
        my.docs = d3.csv.parseRows(s, function (d, j) {
            var result;

            // assume these columns:
            // 0  1     2      3            4      5     6       7
            // id,title,author,journaltitle,volume,issue,pubdate,pagerange

            result = {
                doi: d[0].trim(), // id
                title: d[1].trim(),
                authors: d[2].trim(),
                journaltitle: d[3].trim(),
                volume: d[4].trim(),
                issue: d[5].trim(),
                date: new Date(d[6].trim()), // pubdate (UTC)
                pagerange: d[7].trim()
                    .replace(/^p?p\. /, "")
                    .replace(/-/g, "–")
            };
            // calculate years from dates just once and store

            return result;
        });
    };
    that.from_string = from_string;

    return that;
};
