/*global d3, metadata */
"use strict";

// ---- metadata specification: DfR ----
//
// Metadata storage specialized for DfR. from_string() expects the DfR
// metadata columns (trimmed as by dfrtopics::export_browser_data), and
// conditionals() keys documents by year (used in the display of yearly
// topic proportions).

metadata.dfr = function (spec) {
    var my = spec || { },
        that,
        from_string;

    // constructor: build from parent
    that = metadata(my);

    // set up conditionals
    if (my.conditionals === undefined) {
        if (my.time_key === undefined) {
            my.time_key = "%Y"; // default to year
        }
        my.conditionals = {
            time: metadata.time_key(my.time_key)
        };
    }

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

metadata.time_key = function (fmt) {
    var formatter = d3.time.format.utc(fmt), 
        result;
    
    result = function (doc) {
        return formatter(doc.date);
    };
    result.invert = function (key) {
        return formatter.parse(key);
    };
    return result;
};
