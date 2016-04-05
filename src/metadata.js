/*global d3 */
"use strict";

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

var dfr_metadata = function (spec) {
    var my = spec || { },
        that,
        from_string,
        doc_years;

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

        // -infinity: nothing pre-Gutenberg in JSTOR
        my.start_date = new Date(1000, 0, 1);
        my.end_date = new Date(); // today
        my.doc_years = [ ];

        // assume that there is no column header
        my.docs = d3.csv.parseRows(s, function (d, j) {
            var a_str = d[2].trim(), // author
            date = new Date(d[6].trim()), // pubdate (UTC)
            doc;

            // assume these columns:
            // 0  1     2      3            4      5     6       7
            // id,title,author,journaltitle,volume,issue,pubdate,pagerange

            doc = {
                doi: d[0].trim(), // id
                title: d[1].trim(),
                authors: a_str === "" ? []
                    : a_str.split(spec.author_delimiter),
                journaltitle: d[3].trim(),
                volume: d[4].trim(),
                issue: d[5].trim(),
                date: date, // pubdate
                pagerange: d[7].trim()
                    .replace(/^p?p\. /, "")
                    .replace(/-/g, "–")
            };
            // calculate years from dates just once and store
            my.doc_years.push(doc.date.getUTCFullYear());

            return doc;
        });
    };
    that.from_string = from_string;

    doc_years = function () {
        return my.doc_years;
    };
    that.doc_years = doc_years;

    return that;
};
