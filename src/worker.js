/*global importScripts, utils, onmessage, postMessage */
"use strict";
importScripts("utils.min.js");

var my = { },
    doc_topics_matrix,
    total_tokens,
    topic_docs,
    doc_topics,
    topic_yearly,
    yearly_total;

doc_topics_matrix = function (data) { 
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
        var result, t, i;
        if (!this.x) {
            return undefined;
        }

        // memoize, at least
        if (!my.row_sum) {
            my.row_sum = [ ];
        }

        if (d === undefined) {
            for (t = 0; t < this.n; t += 1) {
                for (i = this.p[t]; i < this.p[t + 1]; i += 1) {
                    if (my.row_sum[this.i[i]] === undefined) {
                        my.row_sum[this.i[i]] = 0;
                    }
                    my.row_sum[this.i[i]] += this.x[i];
                }
            }
            return my.row_sum;
        }

        // single row calculation: can't do better than ncol lookup calls
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
            for (i = 0; i < this.n; i += 1) {
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

total_tokens = function () {
    var i, result = 0;
    for (i = 0; i < my.dt.x.length; i += 1) {
        result += my.dt.x[i];
    }
    return result;
};

topic_docs = function (t, n) {
    var p0 = my.dt.p[t],
        p1 = my.dt.p[t + 1],
        p,
        docs = [ ],
        bisect,
        insert,
        i,
        result = [];

    // column slice
    // TODO speed bottleneck: all that row-summing gets slooow
    // because row-slicing is slow on the col-compressed matrix
    for (p = p0; p < p1; p += 1) {
        docs.push({
            doc: my.dt.i[p],
            frac: my.dt.x[p] / my.dt.row_sum(my.dt.i[p]),
            weight: my.dt.x[p]
        });
    }

    // return them all, sorted, if there are fewer than n hits
    if (n >= docs.length) {
        docs.sort(function (a, b) {
            return utils.desc(a.frac, b.frac) ||
                utils.desc(a.doc, b.doc); // stabilize sort
        });
        return docs;
    }

    // initial guess. simplifies the conditionals below to do it this way,
    // and sorting n elements is no biggie

    result = docs.slice(0, n).sort(function (a, b) {
        return utils.asc(a.frac, b.frac) ||
            utils.asc(a.doc, b.doc); // stabilize sort
    });

    bisect = utils.bisector_left(function (d) { return d.frac; });

    for (i = n; i < docs.length; i += 1) {
        insert = bisect(result, docs[i].frac);
        if (insert > 0) {
            result.splice(insert, 0, docs[i]);
            result.shift();
        } else if (result[0].frac === docs[i].frac) {
            // insert = 0 but a tie
            result.unshift(docs[i]);
        }
    }

    // biggest first
    return utils.shorten(result.reverse(), n, function (xs, i) {
        return xs[i].frac;
    });
};

doc_topics = function (d, n) {
    var topics = [ ], t, x;

    for (t = 0; t < my.dt.n; t += 1) {
        x = my.dt.get(d, t);
        if (x > 0) {
            topics.push({ topic: t, weight: x });
        }
    }
        
    topics.sort(function (a, b) {
        return utils.desc(a.weight, b.weight) ||
            utils.desc(a.t, b.t); // stabilize sort
    });

    return utils.shorten(topics, n, function (topics, i) {
        return topics[i].weight;
    });
};


// yearly proportions for topic t
topic_yearly = function (t) {
    var result, j, y;

    // cached? 
    if (!my.topic_yearly) {
        my.topic_yearly = [];
    }

    if (t === undefined) {
        result = [ ];
        for (j = 0; j < my.dt.n; j += 1) {
            result.push(topic_yearly(j));
        }
        return result;
    }

    if (my.topic_yearly[t]) {
        return my.topic_yearly[t];
    }

    // Formally an array but we'll use it as a hash with numeric keys
    result = [ ];

    for (j = my.dt.p[t]; j < my.dt.p[t + 1]; j += 1) {
        y = my.doc_years[my.dt.i[j]];
        if (result[y]) {
            result[y] += my.dt.x[j];
        } else {
            result[y] = my.dt.x[j];
        }
    }

    // The spec says: only called on array elements that are defined
    // Divide through
    result.forEach(function (weight, year) {
        result[year] /= yearly_total(year);
    });

    // cache if this is the first time through
    my.topic_yearly[t] = result;
    return result;
};

// get aggregate topic counts over years
yearly_total = function (year) {
    var tally, y, n;
    // memoization
    if (!my.yearly_total) {
        // Formally an array, but we'll use it as a hash w/ numeric keys
        tally = [ ];
        for (n = 0; n < my.dt.i.length; n += 1) {
            y = my.doc_years[my.dt.i[n]];
            if (tally[y]) {
                tally[y] += my.dt.x[n];
            } else {
                tally[y] = my.dt.x[n];
            }
        }
        my.yearly_total = tally;
    }

    return isFinite(year) ? my.yearly_total[year] : my.yearly_total;
};

// main dispatch
onmessage = function (e) {
    if (e.data.what === "set_dt") {
        my.dt = doc_topics_matrix(e.data.dt);
        // precalculate row sums
        if (my.dt) {
            my.dt.row_sum();
        }
        postMessage({
            what: "set_dt",
            result: my.dt !== undefined
        });
    } else if (e.data.what === "set_doc_years") {
        my.doc_years = e.data.doc_years;
        postMessage({
            what: "set_doc_years",
            result: my.doc_years !== undefined
        });
    } else if (e.data.what === "total_tokens") {
        postMessage({
            what: "total_tokens",
            result: total_tokens()
        });
    } else if (e.data.what === "topic_docs") {
        postMessage({
            what: "topic_docs/" + e.data.t + "/" + e.data.n,
            result: topic_docs(e.data.t, e.data.n)
        });
    } else if (e.data.what === "doc_topics") {
        postMessage({
            what: "doc_topics/" + e.data.d + "/" + e.data.n,
            result: doc_topics(e.data.d, e.data.n)
        });
    } else if (e.data.what === "topic_total") {
        postMessage({
            what: "topic_total/" + e.data.t,
            result: my.dt.col_sum(e.data.t === "all" ? undefined : e.data.t)
        });
    } else if (e.data.what === "topic_yearly") {
        postMessage({
            what: "topic_yearly/" + e.data.t,
            result: topic_yearly(e.data.t === "all" ? undefined : e.data.t)
        });
    } else if (e.data.what === "yearly_total") {
        postMessage({
            what: "yearly_total/" + e.data.y,
            result: yearly_total(e.data.y === "all" ? undefined : e.data.y)
        });
    } else {
        postMessage({ what: "error" });
    }
};
