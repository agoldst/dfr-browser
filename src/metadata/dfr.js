/*global d3, metadata */
"use strict";

// ---- metadata specification: DfR ----
//
// Metadata storage specialized for DfR. from_string() expects eight DfR
// metadata columns (trimmed as by dfrtopics::export_browser_data).
//
// In addition to the parameters for the base metadata() object,
// metadata.dfr(spec) can have the following additional parameter in spec:
//
// extra_fields: array of names for columns beyond the expected eight. If
// missing (or there are more columns than extra_fields), column 9 is named X1,
// column 10 is named X2, etc.

metadata.dfr = function (spec) {
    var my = spec || { },
        that,
        from_string;

    // ensure date_field is an array including "date"
    my.date_field = my.date_field || ["date"];
    if (!Array.isArray(my.date_field)) {
        my.date_field = [my.date_field];
    }
    if (my.date_field.indexOf("date") === -1) {
        my.date_field.push("date");
    }

    // constructor: build from parent
    that = metadata(my);
    if (!Array.isArray(my.extra_fields)) {    // validate extra_fields
        my.extra_fields = [ ];
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
            // 0  1     2      3       4      5     6       7
            // id,title,author,journal,volume,issue,pubdate,pagerange

            // TODO don't rename these variables. MAN.
            result = {
                doi: d[0].trim(), // id
                title: d[1].trim(),
                authors: d[2].trim(),
                journal: d[3].trim(),
                volume: d[4].trim(),
                issue: d[5].trim(),
                date: d[6].trim(), // pubdate (UTC) converted by validate()
                pagerange: d[7].trim()
                    .replace(/^p?p\. /, "")
                    .replace(/-/g, "–")
            };
            // now add extra columns
            d.slice(8, d.length).forEach(function (x, i) {
                result[my.extra_fields[i] || "X" + String(i + 1)] = x.trim();
            });

            return result;
        });
        that.validate();
    };
    that.from_string = from_string;

    return that;
};
