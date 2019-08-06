/*global d3, utils */
"use strict";

// Bibliography processing: sorting and citing.
//
// New sorting or citing methods can be added by deriving an object from
// this one; see bib_dfr() for how this is done.
//
// In addition to sort() and citation() methods, a bibliography object
// must also be able to say what kinds of sorting are available: sorting().
//
// It also should provide document URLs. The url() method here is a stub
// and should be overriden in the derived object.
//
// Bibliographic data is not stored here; that is the job of the
// metadata object owned by the model.

var bib = function (spec) {
    var my = spec || { },
        that = { },
        sorting,
        sort,
        citation,
        url;

    // to be overridden in subclasses
    if (!my.sorting) {
        my.sorting = [["all_raw", "by raw entry"]];
    }

    // Gets or sets the description of sorting methods.
    //
    // This should be an array of two element arrays. The first element
    // should be a string giving a possible major_minor pairing separated
    // by an underscore; the second element is a human-readable description
    // for use in a sorting options menu (rendered by view.bib).

    sorting = function (srt) {
        if (srt !== undefined) {
            my.sorting = srt;
        }
        return my.sorting;
    };
    that.sorting = sorting;

    // Sort-key functions
    //
    // Every major or minor key in the sorting specification should
    // correspond to a function here that takes a document and returns a
    // string usable as a (lexicographic) sort key. Major keys are also
    // used as section headings in the bibliography display. (To tweak
    // them, set the key function's "display_heading" property to a
    // function. See: bib_dfr().keys.issue.)

    that.keys = { };

    // dummy sort keys: for a major heading, just "All":
    that.keys.all = function () {
        return "All";
    };

    // for a minor, the stringified full object
    that.keys.raw = function (doc) {
        return JSON.stringify(doc);
    };

    // bibliography sorting
    sort = function (p) {
        var result = [],
            docs,
            cmp_maj = p.dir.major ? d3.ascending : d3.descending,
            cmp_min = p.dir.minor ? d3.ascending : d3.descending,
            get_id = function (d) { return d.id; },
            cur_major,
            i, last, partition = [];

        docs = p.docs.map(function (d, j) {
                return {
                    id: p.doc_ids[j],
                    major: that.keys[p.major](d),
                    minor: that.keys[p.minor](d)
                };
            })
            .sort(function (a, b) {
                return cmp_maj(a.major, b.major) ||
                    cmp_min(a.minor, b.minor) ||
                    d3.ascending(a.id, b.id); // stabilize sort
            });

        for (i = 0, cur_major = ""; i < docs.length; i += 1) {
            if (docs[i].major !== cur_major) {
                partition.push(i);
                result.push({
                    heading: docs[i].major
                });
                cur_major = docs[i].major;
            }
        }
        partition.shift(); // correct for "0" always getting added at the start
        partition.push(docs.length); // make sure we get the tail

        for (i = 0, last = 0; i < partition.length; i += 1) {
            result[i].docs = docs.slice(last, partition[i]).map(get_id);
            last = partition[i];
        }

        // decoded equivalent of major keys, if necessary

        if (typeof that.keys[p.major].display_heading === "function") {
            result.forEach(function (o) {
                o.heading_display = that.keys[p.major]
                    .display_heading(o.heading);
            });
        }

        return result;
    };
    that.sort = sort;

    // validate major/minor sort terms. The output is the same as the input,
    // except an invalid term is replaced with undefined.

    sort.validate = function (p) {
        var major = my.sorting.map(function (s) {
                return s[0].split("_")[0];
            }),
            minor = my.sorting.map(function (s) {
                return s[0].split("_")[1];
            }),
            result = p;
        if (major.indexOf(p.major) === -1) {
            result.major = undefined;
        }
        if (minor.indexOf(p.minor) === -1) {
            result.minor = undefined;
        }

        if (p.dir !== "up" && p.dir !== "down") {
            result.dir = undefined;
        }

        return result;
    };

    // Semantics of ascending/descending:
    // Convert a triplet (major, minor, direction) to a doublet
    // (major_direction, minor_direction). Additionally we expect
    // the input to be specified in words, but the output is in Booleans.

    // The stub here is: minor always true
    sort.dir = function (p) {
        return {
            major: p.dir !== "down",
            minor: true
        };
    };

    // Crude citation method
    citation = function (doc) {
        var k, result = "";
        for (k in doc) {
            if (doc.hasOwnProperty(k) && typeof doc[k] === "string") {
                result += doc[k] + ". ";
            }
        }
        return result;
    };
    that.citation = citation;

    // Stub url method
    url = function () {
        return "";
    };
    that.url = url;

    return that;
}; // bib()
