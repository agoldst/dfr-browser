/*global utils */
"use strict";

var doc_topics_matrix = function (data) { 
    var my = { },
        that = data;

    if (that.p && that.p.length) {
        that.n = that.p.length - 1;
    }

    that.get = function (d, t) {
        var p0, p, j, result;
        if (!this.x) {
            return undefined;
        }

        // dt() for the whole matrix
        if (d === undefined) {
            return this;
        }

        // dt(d) for a whole document row
        if (t === undefined) {
            result = [ ];
            for (j = 0; j < this.n; j += 1) {
                result.push(this.get(d, j));
            }
            return result;
        }

        // dt(d, t) for one entry
        p0 = this.p[t];
        p = utils.bisect_left(this.i.slice(p0, this.p[t + 1]), d);

        // if there is no d entry for column t, return 0
        result = (this.i[p + p0] === d) ? this.x[p + p0] : 0;
        return result;
    };

    // a naive row_sum method for the dt object
    that.row_sum = function (d) {
        var result, t;
        if (!this.x) {
            return undefined;
        }

        // memoize, at least
        if (!my.row_sum) {
            my.row_sum = [ ];
        }

        if (!my.row_sum[d]) {
            result = 0;
            for (t = 0; t < this.n; t += 1) {
                result += this.get(d, t);
            }
            my.row_sum[d] = result;
        }
        return my.row_sum[d];
    };
    // a col_sum method: this takes advantages of the column compression
    that.col_sum = function (t) {
        var i;

        // memoization
        if (!my.col_sum) {
            my.col_sum = [];
        }

        // dt.col_sum() returns an array of sums
        if (t === undefined) {
            for (i = 0; i <= this.n; i += 1) {
                this.col_sum(i); // stores the result
            }
            return my.col_sum;
        }

        // otherwise, return the sum for column t
        if (!my.col_sum[t]) {
            my.col_sum[t] = 0;
            for (i = this.p[t]; i < this.p[t + 1]; i += 1) {
                my.col_sum[t] += this.x[i];
            }
        }
        return my.col_sum[t];
    };

    return that;
};
