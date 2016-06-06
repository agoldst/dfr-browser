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

metadata.key = {
    // Basic conditional key translator: subscript doc, "invert" is identity
    category: function (p) {
        var result = function (doc) {
            return doc[p.key];
        };
        result.invert = function (key) {
            return key;
        };
        return result;
    },

    // TODO but be careful about numeric -> string & alphabetic sort later on
    continuous: function (p, docs) {
        var start = d3.min(docs, function (d) { return d[p.key]; }),
            result;
        result = function (doc) {
                return start +
                    Math.floor((doc[p.key] - start) / p.step) * p.step;
            };
        result.invert = function (key) {
            return +key;
        };
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
        var start = d3.min(docs, function (d) { return d.date; }),
            rounder, formatter, result,
            fmt = p.format,
            n = p.n || 1,
            unit = d3.time[p.unit].utc;

        // rounder: overridden for ms units at default: below
        // also overriden if n = 1 below
        rounder = (function () {
            // Brute force: step function as a table lookup.  Needed because
            // of the nightmare of leap days, DST, etc.  The strategy is to
            // store an array of steps which we'll grow as needed, then find
            // the argument's place in the array using bisection.  The array
            // persists because this is a closure.  This is overkill for
            // years and months, which could be implemented more simply, but
            // for code simplicity we'll just write the generic solution.
            var steps = [start], tail = start;

            return function (dt) {
                if (dt > tail) {
                    // can't use unit.range because that has different
                    // behavior (clamping at segment boundaries)
                    tail = unit.offset(tail, n);
                    while (tail < dt) {
                        steps.push(tail);
                        tail = unit.offset(tail, n);
                    }
                    return tail;
                }

                return steps[d3.bisect(steps, dt) - 1];
            }; 
        }());

        // choose key format, and possibly override rounder
        switch (p.unit) {
            case "year":
                fmt = fmt || "%Y";
                break;

            case "month":
                fmt = fmt || "%Y-%m";
                break;

            case "day": 
                // default rounder
                fmt = fmt || "%Y-%m-%d";
                break;

            case "hour": 
                // default rounder
                fmt = fmt || "%Y-%m-%d %H:00";
                break;

            case "minute": 
                // default rounder
                fmt = fmt || "%Y-%m-%d %H:%M";
                break;

            case "second": 
                // default rounder
                fmt = fmt || "%Y-%m-%d %H:%M:%S";
                break;

            default:
                // numerical rounding instead
                // n taken to be in the native time unit (ms)
                rounder = function (dt) { 
                    return new Date(+start +
                        Math.floor((+dt - +start) / n) * n);
                };
                fmt = fmt || "%Y-%m-%dT%H:%M:%S.%LZ";
                break;
        }
        formatter = d3.time.format.utc(fmt);
        if (n === 1) {
            // then never mind all the palaver about rounding, we can just
            // use d3's formatting as our step function
            result = function (doc) {
                return formatter(doc.date);
            };
        } else {
            // Okay, palaver away
            result = function (doc) {
                return formatter(rounder(doc.date));
            };
        }
        result.invert = function (key) {
            return formatter.parse(key);
        };
        return result;
    }
};
