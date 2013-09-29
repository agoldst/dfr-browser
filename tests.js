
dt_ok = function () {
    // unroll sparse matrix
    // column indices = rep(seq_along(diff(p)),diff(p))
    my._dt = [];
    for (j = 0; j < parsed.p.length - 1; j += 1) {
        for (i = parsed.p[j]; i < parsed.p[j + 1]; i += 1) {
            row = parsed.i[i];
            if (!my._dt[row]) {
                my._dt[row] = [];
            }

            my._dt[row][j] = parsed.x[i];
        }
    }
    for (d = 0; d < this.n_docs(); d += 1) {
        for (t = 0; t < this.n(); t += 1) {
            if (this.dt(d, t) != my._dt[d][t]) { // works if _dt[d][t] undef?
                return false;
            }
        }
    }
    return true;
};
            
yearly_topic = function () {
    // TODO do it just for a single topic t: faster?? on sparse column
    var counts, totals, result, i, y, t;

    // cached? 
    if (my.yearly_topic) {
        return my.yearly_topic;
    }
    if (!this.dt() || !this.meta()) {
        return undefined;
    }

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

