/*global importScripts, utils, onmessage, postMessage */
"use strict";
importScripts("utils.min.js");

var my = {
        conditional: { } ,
        conditional_total: { },
        doc_categories: { }
    },
    doc_topics_matrix,
    total_tokens,
    topic_docs,
    doc_topics,
    topic_conditional,
    conditional_total,
    topic_docs_conditional,
    PROPER_TOLERANCE = 0.01;

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
    return topic_docs_conditional(t, undefined, undefined, n);
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

topic_conditional = function (v, t) {
    var result, j, key;

    // cached?
    if (!my.conditional[v]) {
        my.conditional[v] = { };
    }

    if (t === undefined) {
        result = [ ];
        for (j = 0; j < my.dt.n; j += 1) {
            result.push(topic_conditional(v, j));
        }
        return result;
    }

    if (my.conditional[v][t]) {
        return my.conditional[v][t];
    }

    result = { };

    for (j = my.dt.p[t]; j < my.dt.p[t + 1]; j += 1) {
        key = my.doc_categories[v][my.dt.i[j]];
        if (result[key]) {
            result[key] += my.dt.x[j];
        } else {
            result[key] = my.dt.x[j];
        }
    }

    // The spec says: only called on array elements that are defined
    // Divide through
    for (key in result) {
        if (result.hasOwnProperty(key)) {
            result[key] /= conditional_total(v, key);
        }
    }

    // cache if this is the first time through
    my.conditional[v][t] = result;
    return result;
};

conditional_total = function (v, key) {
    var tally, k, n;
    // memoization
    if (!my.conditional_total[v]) {
        tally = { };
        for (n = 0; n < my.dt.i.length; n += 1) {
            k = my.doc_categories[v][my.dt.i[n]];
            if (tally[k]) {
                tally[k] += my.dt.x[n];
            } else {
                tally[k] = my.dt.x[n];
            }
        }
        my.conditional_total[v] = tally;
    }

    return (key !== undefined) ? my.conditional_total[v][key]
        : my.conditional_total[v];
};

topic_docs_conditional = function (t, v, key, n) {
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
        if (v === undefined // then: unconditional top docs
                || my.doc_categories[v][my.dt.i[p]] === key) {
            docs.push({
                doc: my.dt.i[p],
                frac: my.dt.x[p] / my.dt.row_sum(my.dt.i[p]),
                weight: my.dt.x[p]
            });
        }
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

// main dispatch
onmessage = function (e) {
    var proper;
    if (e.data.what === "set_dt") {
        my.dt = doc_topics_matrix(e.data.dt);
        // precalculate row sums and detect normalized matrix
        if (my.dt) {
            proper = my.dt.row_sum().reduce(function (acc, x) {
                return acc && Math.abs(x - 1.0) < PROPER_TOLERANCE;
            }, true);
        }
        postMessage({
            what: "set_dt",
            result: { success: my.dt !== undefined, proper: proper }
        });
    } else if (e.data.what === "set_doc_categories") {
        my.doc_categories[e.data.v] = e.data.keys;
        postMessage({
            what: "set_doc_categories/" + e.data.v,
            result: my.doc_categories[e.data.v] !== undefined
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
    } else if (e.data.what === "topic_conditional") {
        postMessage({
            what: "topic_conditional/" + e.data.v + "/" + e.data.t,
            result: topic_conditional(e.data.v,
                e.data.t === "all" ? undefined : e.data.t)
        });
    } else if (e.data.what === "conditional_total") {
        postMessage({
            what: "conditional_total/" + e.data.v + "/" + e.data.key,
            result: conditional_total(e.data.v,
                e.data.key === "all" ? undefined : e.data.key)
        });
    } else if (e.data.what === "topic_docs_conditional") {
        postMessage({
            what: "topic_docs_conditional/" + e.data.t + "/" + e.data.v + "/"
                + e.data.key + "/" + e.data.n,
            result: topic_docs_conditional(e.data.t, e.data.v,
                    e.data.key, e.data.n)
        });
    } else {
        postMessage({ what: "error" });
    }
};
