var utils = (function () {
    "use strict";
    var that = {},
        shorten,
        deep_replace;

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

    return that;
}());
