
var dt_ok,
    yearly_topic_ok;

dt_ok = function (m) {
    // unroll sparse matrix
    // column indices = rep(seq_along(diff(p)),diff(p))

    load_data("dt.json", function (error, s) {
        var parsed = JSON.parse(s),
            dt, j, i, d, t;

        dt = [];
        for (j = 0; j < parsed.p.length - 1; j += 1) {
            for (i = parsed.p[j]; i < parsed.p[j + 1]; i += 1) {
                row = parsed.i[i];
                if (!dt[row]) {
                    dt[row] = [];
                }

                dt[row][j] = parsed.x[i];
            }
        }
        for (d = 0; d < m.n_docs(); d += 1) {
            for (t = 0; t < m.n(); t += 1) {
                if (dt[d][t] === undefined) {
                    dt[d][t] = 0;
                }
                if (m.dt(d, t) !== dt[d][t]) {
                    console.log("dt_ok: failed");
                    console.log("d: " + d + "; t: " + t);
                    console.log("m.dt(d, t): " + m.dt(d, t));
                    console.log("dt[d][t]: " + dt[d][t]);
                    return;
                }
            }
        }
        console.log("dt_ok: passed");
    });
};
            
/*
for (n = my.dt.p[t]; n < my.dt.p[t + 1]; n += 1) {
    if (my.dt.i[n] == d) {
        return my.dt.x[n];
    }
    else if (my.dt.i[n] > d) {
        return 0;
    }
}
return 0;
*/

yearly_topic_ok = function () {
    // TODO do it just for a single topic t: faster?? on sparse column
    var counts, totals, result, i, y, t;

    /*
    // cached? 
    if (my.yearly_topic) {
        return my.yearly_topic;
    }
    if (!this.dt() || !this.meta()) {
        return undefined;
    }
    */

    counts = d3.map();
    totals = d3.map();
    result = d3.map();

    for (i = 0; i < this.n_docs(); i += 1) {
        y = this.meta(i).date.getFullYear();
        if (!counts.has(y)) {
            counts.set(y, []);
        }
        if (!totals.has(y)) {
            totals.set(y, 0);
        }

        for (t = 0; t < this.n(); t += 1) {
            if(counts.get(y)[t]) {
                counts.get(y)[t] += this.dt(i, t);
            } else {
                counts.get(y)[t] = this.dt(i, t);
            }
            totals.set(y, totals.get(y) + this.dt(i, t));
        }
    }

    // divide through
    counts.forEach(function (y, wts) {
        result.set(y, wts.map(function (w) {
            return w / totals.get(y);
        }));
    });

    // cache if this is the first time through
    my.yearly_topic = result;
    return result;
};

