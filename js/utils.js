var utils = (function () {
    "use strict";
    var that = {},
        shorten,
        deep_replace,
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
    // specified in the replacement OR adding any properties in the
    // replacement not specified in the original
    //
    // x: the original
    // repl: the source of replacements

    deep_replace = function (x, repl) {
        var prop, result = x;
        if (repl === undefined) {
            return x;
        }

        if (x === undefined) {
            return repl;
        }

        if (typeof repl === "object") {
            for (prop in repl) {
                if (repl.hasOwnProperty(prop)
                        && typeof repl[prop] !== 'function') {
                    result[prop] = deep_replace(x[prop], repl[prop]);
                }
            }
        } else if (typeof repl !== 'function') {
            result = repl;
        }
        return result;
    };
    that.deep_replace = deep_replace;

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
