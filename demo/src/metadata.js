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
        date_field,
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
        if (my.date_field && my.docs[0].hasOwnProperty(my.date_field)) {
            my.docs.forEach(function (d) {
                d[my.date_field] = new Date(d[my.date_field]);
            });
        }
    };
    that.from_string = from_string;

    date_field = function (key) {
        if (typeof key === "string") {
            my.date_field = key;
            return this;
        }

        return my.date_field;
    };
    that.date_field = date_field;

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

    // Which variables can we condition topic distributions on?  condition()
    // gets/sets key translators, one for each variable. See metadata.key and
    // metadata.key.time below.
    //
    // conditionals() returns the d3.map of all the pairings.

    conditionals = function () {
        return my.conditionals;
    };
    that.conditionals = conditionals;

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
