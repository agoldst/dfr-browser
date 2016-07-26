/*global d3, view */
"use strict";

// ---- metadata specification ----
//
// This object stores metadata. The object returned by metadata(...) does the
// following:
//
// from_string(s): load data from text s (called by browser().load()). Calls
//     validate() after loading.
// doc(id): access metadata for document or documents with IDs id
// doc_id(i), doc_index(id): convert an index i into an ID and vice-versa
// n_docs: say how many documents there are
// condition: get/set conditioning variable & calculate bins if needed
//
// The constructor parameter in metadata(spec) supplies initial values for
// private data. The following fields of spec are used here:
//
// date_field: name of column to parse as a date (if any)
// id: name of column to use as a doc identifier. Must be unique. If missing,
// documents will be accessed and identified by their numeric index (from 0).
//
// metadata() is a generic. By default, dfr-browser uses the derived object
// constructed with metadata.dfr() (see src/metadata/dfr.js), which understands
// DfR metadata.

var metadata = function (spec) {
    var my = spec || { },
        that = { },
        validate,
        from_string,
        bib,
        id_field,
        doc,
        doc_id,
        doc_index,
        n_docs,
        condition;

    // constructor: initialize conditionals
    my.conditionals = d3.map();
    my.by_id = { };

    // default method: d3 csv parsing
    from_string = function (s) {
        if (typeof s !== "string") {
            return;
        }
        my.docs = d3.csv.parse(s);
        validate();
    };
    that.from_string = from_string;

    validate = function () {
        if (!Array.isArray(my.docs)) {
            return;
        }
        if (my.id && !my.docs[0].hasOwnProperty(my.id)) {
            view.warning("Metadata does not have an ID column named " + my.id);
            my.id = undefined;
        }
        if (my.date_field && !Array.isArray(my.date_field)) {
            my.date_field = [my.date_field];
        }
        my.date_field = my.date_field.filter(function (k) {
            var result = my.docs[0].hasOwnProperty(k);
            if (!result) {
                view.warning("Did not find specified date field " + k);
            }
            return result;
        });
        my.docs.forEach(function (d) {
            my.date_field.forEach(function (k) { d[k] = new Date(d[k]); });
        });
    };
    that.validate = validate;

    bib = function (b) {
        if (typeof b === "object") {
            my.bib = b;
        }
        return my.bib;
    };
    that.bib = bib;

    id_field = function (id) {
        if (id !== undefined) {
            my.id = id;
        }
        return my.id;
    };
    that.id_field = id_field;

    // document accessor. doc() gives the array of all docs, for a single index
    // value i doc(i) gives a single doc, and for an array i doc(i) gives an
    // array. If my.id is set, access is by matching on values in the field
    // my.id rather than the numeric index.
    //
    // doc_id turns numeric indices into ID values; doc_index turns ID values
    // into numeric indices.
    doc = function (i) {
        var ind;
        if (i === undefined) {
            return my.docs;
        }

        ind = doc_index(i);
        if (Array.isArray(ind)) {
            return ind.map(function (j) { return my.docs[j]; });
        }

        return my.docs[ind];
    };
    that.doc = doc;

    doc_id = function (i) {
        if (i === undefined) {
            return my.docs.map(function (d, j) { return doc_id(j); });
        }

        if (my.id === undefined) {
            return i;
        }

        if (Array.isArray(i)) {
            return i.map(function (j) { return my.docs[j][my.id]; });
        }

        return my.docs[i][my.id];
    };
    that.doc_id = doc_id;

    doc_index = function (id) {
        if (Array.isArray(id)) {
            return id.map(doc_index);
        }

        if (!my.id) {
            return +id;
        }

        if (my.by_id[my.id] === undefined) {
            my.by_id[my.id] = d3.map();
            my.docs.forEach(function (doc, j) {
                my.by_id[my.id].set(doc[my.id], j);
            });
            if (my.by_id[my.id].size() !== my.docs.length) {
                view.error("Document IDs in metadata column \"" + my.id
                        + "\" are not unique.");
            }
        }
        return my.by_id[my.id].get(id);
    };
    that.doc_index = doc_index;

    n_docs = function () {
        if (my.docs) {
            return my.docs.length;
        }
    };
    that.n_docs = n_docs;

    // Which variables can we condition topic distributions on?  condition()
    // gets/sets key translators, one for each variable. See metadata.key and
    // metadata.key.time below.

    condition = function (key, f, spec) {
        if (f === undefined) {
            return my.conditionals.get(key);
        }
        my.conditionals.set(key, f(spec, my.docs));
        return this;
    };
    that.condition = condition;

    return that;
};

// Metadata category key translators. A translator t does the following things:
//
// t(doc) should return a "key" string designating the level of the metadata
// variable (e.g. year of publication) for doc.
//
// t.invert(key) should turn a key string into a value suitable for plotting
// (e.g. a Date).
//
// t.display(key) should turn a key string into a human-readable value.
//
// t.range should be a sorted array representing the range of keys. For
// continuously-valued variables, this might include keys that do not
// correspond to any items in the actual dataset but lie between keys that do.

metadata.key = {
    // Basic conditional key translator: subscript doc
    ordinal: function (p, docs) {
        var result = function (doc) {
            return doc[p.field].replace(/\s/g, "_");
        };
        result.invert = function (key) {
            return key.replace(/_/g, " ");
        };
        result.display = result.invert;
        result.range = d3.set(docs.map(result)).values();
        result.range.sort();
        return result;
    },

    continuous: function (p, docs) {
        var ext = d3.extent(docs, function (d) { return +d[p.field]; }),
            f, z, fmt, result;

        // start at a step value <= data minimum
        ext[0] = Math.floor(ext[0] / p.step) * p.step;

        // To get keys from continuous values, we apply a step function
        // and then an ORDER-PRESERVING string conversion.

        // Choose decimal precision for string conversion
        f = Math.floor(Math.log10(p.step));
        // Choose number of leading zeroes for ditto
        z = Math.ceil(Math.log10(d3.max(ext, Math.abs)));
        if (z >= 1) {
            if (f <= 0) {
                fmt = d3.format(
                    "0" + String(z + Math.abs(f) + 1) +
                    "." + String(Math.abs(f)) + "f"
                );
            } else {
                fmt = d3.format("0" + String(z) + ".0f");
            }
        } else {
            // f better be <= 0, then
            fmt = d3.format("." + String(Math.abs(f)) + "f");
        }

        result = function (doc) {
            var stp = ext[0] +
                Math.floor((+doc[p.field] - ext[0]) / p.step) * p.step;
            return fmt(stp);
        };
        result.invert = function (key) {
            return +key;
        };
        result.display = function (key) {
            return String(+key) + "–" + String(+key + p.step);
        };
        result.range = d3.range(Math.floor((ext[1] - ext[0]) / p.step))
            .map(function (x) { return fmt(ext[0] + x * p.step); });
        return result;
    },

    // Utility for generating conditional key/inverter for time.  This gives
    // a step function for times and dates. Sigh. We'll follow
    // d3.time.interval.offset's decisions, mostly. For numerically even
    // intervals, specify "ms" as the unit and give the step size in
    // milliseconds. But note that this will have a tricky interaction with
    // the calendar. On DST switch days, a day is not 24 * 60 * 60 * 1000 ms,
    // so if you cross a DST day in a step, you'll drift. The date format
    // specifies how to construct the string key. If omitted a default is
    // used.

    time: function (p, docs) {
        var ext = d3.extent(docs, function (d) { return d[p.field]; }),
            steps, tail, rounder,
            formatter, result,
            fmt, fmt_display,
            n = p.n || 1,
            unit = d3.time[p.unit].utc;

        // Brute force: step function as a table lookup. Needed because of the
        // nightmare of leap days, DST, etc. The strategy is to store an array
        // of steps which we'll grow as needed, then find the argument's place
        // in the array using bisection. The array persists because this is a
        // closure. This is overkill for years and months, which could be
        // implemented more simply, but for code simplicity we'll just write
        // the generic solution.  We'll override this for ms units at default:
        // in the switch below; we'll ignore it if n = 1 below.
        steps = [ext[0]];
        tail = unit.offset(ext[0], n);

        // can't use unit.range because that has different behavior (clamping
        // at segment boundaries)
        while (tail < ext[1]) {
            steps.push(tail);
            tail = unit.offset(tail, n);
        }
        rounder = function (dt) {
            return steps[d3.bisect(steps, dt) - 1];
        };

        // choose key format, and possibly override rounder
        switch (p.unit) {
            case "year":
                fmt = "%Y";
                break;

            case "month":
                fmt = "%Y-%m";
                break;

            case "day":
                fmt = "%Y-%m-%d";
                break;

            case "hour":
                fmt = "%Y-%m-%d %H:00";
                break;

            case "minute":
                fmt = "%Y-%m-%d %H:%M";
                break;

            case "second":
                fmt = "%Y-%m-%d %H:%M:%S";
                break;

            default:
                // numerical rounding instead
                // n taken to be in the native time unit (ms)
                rounder = function (dt) {
                    return new Date(+ext[0] +
                        Math.floor((+dt - +ext[0]) / n) * n);
                };
                fmt = "%Y-%m-%dT%H:%M:%S.%LZ";
                break;
        }
        formatter = d3.time.format.utc(fmt);
        if (n === 1) {
            // then never mind all the palaver about rounding, we can just
            // use d3's formatting as our step function
            result = function (doc) {
                return formatter(doc[p.field]);
            };
        } else {
            // Okay, palaver away
            result = function (doc) {
                return formatter(rounder(doc[p.field]));
            };
        }
        result.invert = function (key) {
            return formatter.parse(key);
        };

        // display of keys (for #/topic)
        if (p.format) {
            fmt_display = function (key) {
                return d3.time.format.utc(p.format)(formatter.parse(key));
            };
        } else {
            fmt_display = function (key) { return key; };
        }
        if (n === 1) {
            result.display = function (key) {
                return fmt_display(key);
            };
        } else {
            result.display = function (key) {
                return fmt_display(key) + "–" +
                    fmt_display(
                        formatter(unit.offset(formatter.parse(key), n))
                    );
            };
        }
        result.range = steps.map(rounder).map(formatter);
        return result;
    }
};
