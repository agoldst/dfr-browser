var utils = (function () {
    var that = {},
        shorten;

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
        if (typeof(f) !== 'function') {
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

    return that;
})();
