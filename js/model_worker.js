/*global importScripts, doc_topics_matrix, utils, onmessage, postMessage */
"use strict";
importScripts("dt.js", "utils.js");

var my = { },
    topic_docs,
    doc_topics;

onmessage = function (e) {
    console.log("message received at worker: " + e.data.what);
    if (e.data.what === "set") {
        my.dt = doc_topics_matrix(e.data.dt);
        postMessage({ what: "ready" });
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
    } else {
        postMessage({ what: "error" });
    }
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
