var utils = (function () {
    "use strict";
    var that = {},
        shorten,
        deep_replace,
        clone,
        MAX_CLONE_DEPTH = 10, // "constant"
        asc,
        desc,
        bisector_left;

    // shorten a sorted array to n elements, allowing more than n elements if
    // there are ties at the end
    // xs: array to shorten
    // n: desired length (result is shorter if xs is shorter, longer if there
    //    are ties at the end of xs
    // f: subscripting function: f(xs, i) = xs[i] by default
    shorten = function (xs, n, f) {
        var i, accessor = f;

        if (xs.length <= n) {
            return xs;
        }
        if (typeof f !== 'function') {
            accessor = function (a, i) { return a[i]; };
        }

        for (i = n; i < xs.length; i += 1) {
            if (accessor(xs, i) !== accessor(xs, n - 1)) {
                break;
            }
        }
        return xs.slice(0, i);
    };
    that.shorten = shorten;


    // replace the non-method properties of one object with those of
    // another without overwriting any properties in the original not
    // specified in the replacement
    //
    // x: the original
    // repl: the source of replacements
    // mask: add new properties from replacement not in original?

    deep_replace = function (x, repl, mask) {
        var prop, result = x;
        if (repl === undefined) {
            return result;
        }

        if (x === undefined) {
            return mask ? undefined : repl;
        }

        // we get errors if we treat arrays like ordinary objects
        if (Array.isArray(x) || Array.isArray(repl)) {
            return repl;
        }

        if (typeof repl === "object") {
            if (typeof x !== "object") {
                result = { };
            }
            for (prop in repl) {
                if (repl.hasOwnProperty(prop)
                        && typeof repl[prop] !== 'function'
                        && (!mask || x.hasOwnProperty(prop))) {
                    result[prop] = deep_replace(x[prop], repl[prop], mask);
                }
            }
        } else if (typeof repl !== 'function') {
            result = repl;
        }
        return result;
    };
    that.deep_replace = deep_replace;

    // clone an object's data properties (strings, numbers, and booleans),
    // descending rescursively into arrays or objects. Anything else (e.g.
    // functions) is not cloned but simply returned. The maximum recursion
    // depth is MAX_CLONE_DEPTH to prevent infinite recursion if at some
    // depth an object holds a reference to itself.
    clone = function (X) {
        var cloner;
        cloner = function (x, depth) {
            var prop, result;

            if (typeof x === "string" || typeof x === "number"
                    || typeof x === "boolean") {
                return x;
            }

            if (depth > MAX_CLONE_DEPTH) {
                return undefined;
            }

            if (Array.isArray(x)) {
                return x.map(function (y) {
                    return cloner(y, depth + 1);
                });
            }

            if (typeof x === "object") {
                result = { };
                for (prop in x) {
                    if (x.hasOwnProperty(prop)) {
                        result[prop] = cloner(x[prop], depth + 1);
                    }
                }
                return result;
            }
            // otherwise
            return x;
        };
        return cloner(X, 0);
    };
    that.clone = clone;

    // These three functions are lifted straight from the d3 code so
    // that we can invoke them in a Worker that doesn't have a document
    // context, which d3 requires.
    //
    // For the code by Mike Bostock, see:
    // https://github.com/mbostock/d3/blob/master/src/arrays

    asc = function asc(a, b) {
        return a < b ? -1 : a > b ? 1 : a >= b ? 0 : NaN;
    };
    that.asc = asc;

    desc = function(a, b) {
        return b < a ? -1 : b > a ? 1 : b >= a ? 0 : NaN;
    };
    that.desc = desc;

    bisector_left = function (f) {
        var compare = (typeof f === "function") ?
            function(d, x) { return asc(f(d), x); }
            : asc;

        return function(a, x, lo, hi) {
            var mid;
            if (arguments.length < 3) {
                lo = 0;
            }
            if (arguments.length < 4) {
                hi = a.length;
            }
            while (lo < hi) {
                mid = lo + hi >>> 1;
                if (compare(a[mid], x) < 0) {
                    lo = mid + 1;
                } else {
                    hi = mid;
                }
            }
            return lo;
        };
    };
    that.bisector_left = bisector_left;

    that.bisect_left = that.bisector_left();

    return that;
}());
