/*global d3, utils, bib, Worker */
"use strict";
var model;

// model specification
// -------------------
// data stored internally as follows:
// tw: array of d3.map()s keyed to words as strings
// alpha: alpha values for topics
// meta: array of objects holding document citations

model = function (spec) {
    var my = spec || { }, // private members
        that = { }, // resultant object
        info, // accessors and pseudo-accessors
        n_docs,
        has_dt,
        tw,
        n,
        n_top_words,
        total_tokens,
        topic_total,
        alpha,
        meta,
        vocab,
        topic_scaled,
        topic_yearly, // time-slicing
        valid_year,
        yearly_total,
        topic_docs, // most salient _ in _
        topic_words,
        doc_topics,
        word_topics,
        year_topics,
        set_dt, // methods for loading model data from strings 
        set_tw,
        set_meta,
        set_topic_scaled;

    my.ready = { };
    my.worker = new Worker("js/worker.min.js");
    my.worker.fs = d3.map();
    my.worker.onmessage = function (e) {
        var f = my.worker.fs.get(e.data.what);
        if (f) {
            f(e.data.result);
        }
    };
    my.worker.callback = function (key, f) {
        my.worker.fs.set(key, f);
    };

    info = function (model_meta) {
        if (model_meta) {
            my.info = model_meta;
        }
        return my.info;
    };
    that.info = info;

    n_docs = function () {
        var result;
        if (my.n_docs !== undefined) {
            result = my.n_docs;
        } else if (my.meta) {
            result = my.meta.length;
        } 

        return result; // undefined if my.meta is missing
    };
    that.n_docs = n_docs;

    // has dt been loaded?
    has_dt = function () {
        return !!my.ready.dt;
    };
    that.has_dt = has_dt;

    // access top key words per topic
    tw = function (t, word) {
        if (!my.tw) {
            return undefined;
        }

        // tw() for the whole list of hashes
        if (t === undefined) {
            return my.tw;
        }

        // tw(t) for a particular topic
        if (word === undefined) {
            return my.tw[t];
        }

        // tw(t, word) for the weight of word in topic t
        return my.tw[t].get(word);
    };
    that.tw = tw;

    // number of topics
    n = function () {
        return my.n;
    };
    that.n = n;

    // number of top words per topic stored in tw
    n_top_words = function () {
        if (!this.tw()) {
            return undefined;
        }

        return my.tw[0].keys().length;
    };
    that.n_top_words = n_top_words;

    total_tokens = function (callback) {
        if (!my.total_tokens) {
            my.worker.callback("total_tokens", function (tot) {
                my.total_tokens = tot;
                callback(tot);
            });
            my.worker.postMessage({ what: "total_tokens" });
        } else { 
            callback(my.total_tokens);
        }
    };
    that.total_tokens = total_tokens;

    topic_total = function (t, callback) {
        var topic = isFinite(t) ? t : "all";
        my.worker.callback("topic_total/" + topic, callback);
        my.worker.postMessage({
            what: "topic_total",
            t: topic
        });
    };
    that.topic_total = topic_total;

    // alpha hyperparameters
    alpha = function (t) {
        if (!my.alpha) {
            return undefined;
        }

        // alpha() for all of them or alpha(t) for just one
        return isFinite(t) ? my.alpha[t] : my.alpha;
    };
    that.alpha = alpha;

    // metadata table
    meta = function (d) {
        if (!my.meta) {
            return undefined;
        }

        // meta(d) for one row of doc metadata or meta() for all of them
        if (typeof d === 'number') {
            return my.meta[d];
        }
        
        if (d === undefined) {
            return my.meta;
        }

        // otherwise, assume d is an array of indices
        return d.map(function (j) { return my.meta[j]; });
    };
    that.meta = meta;

    // validate dates
    valid_year = function (y) {
        if (!my.years) {
            return undefined;
        }
        return my.years.has(y);
    };
    that.valid_year = valid_year;

    // aggregate vocabulary of all top words in tw
    vocab = function () {
        var result;
        // memoization
        if (my.vocab) {
            return my.vocab;
        }
        if (!this.tw()) {
            return undefined;
        }

        result = d3.set();
        this.tw().map(function (words) {
            words.keys().map(function (w) {
                result.add(w);
            });
        });
        my.vocab = result.values().sort();
        return my.vocab;
    };
    that.vocab = vocab;

    // scaled coordinates for topics
    topic_scaled = function (t) {
        if (!my.topic_scaled) {
            return undefined;
        }

        // topic_scaled() for all of them
        if (t === undefined) {
            return my.topic_scaled;
        }

        // topic_scaled(t) for coordinates for topic t
        return my.topic_scaled[t];
    };
    that.topic_scaled = topic_scaled;

    // get aggregate topic counts over years
    yearly_total = function (year, callback) {
        var y = (year === undefined) ? "all" : year,
            f = callback;
        if (y === "all") {
            f = function (yearly_total) {
                callback(d3.map(yearly_total));
            };
        }
        my.worker.callback("yearly_total/" + y, f);
        my.worker.postMessage({
            what: "yearly_total",
            y: y
        });
    };
    that.yearly_total = yearly_total;

    // yearly proportions for topic t
    topic_yearly = function (t, callback) {
        var topic = (t === undefined) ? "all" : t,
            f;
        if (topic === "all") {
            f = function (yearly) {
                callback(yearly.map(d3.map));
            };
        } else {
            f = function (yearly) {
                callback(d3.map(yearly));
            };
        }
        my.worker.callback("topic_yearly/" + topic, f);
        my.worker.postMessage({
            what: "topic_yearly",
            t: topic
        });
    };
    that.topic_yearly = topic_yearly;

    // Get n top documents for topic t. Uses a naive document ranking,
    // by the proportion of words assigned to t, which does *not*
    // necessarily give the docs where t is most salient
    topic_docs = function (t, n, year, callback) {
        var n_req = n, f = callback;
        if (year !== undefined) {
            n_req = this.n_docs();
            f = function (docs) {
                var year_docs = docs.filter(function (d) {
                    return that.meta(d.doc).date.getUTCFullYear() === +year;
                });
                return callback(utils.shorten(year_docs, n));
            };
        }

        my.worker.callback("topic_docs/" + t + "/" + n_req, f);
        my.worker.postMessage({
            what: "topic_docs",
            t: t,
            n: n_req
        });
    };
    that.topic_docs = topic_docs;

    // Get n top topics for document d. Unlike with docs, no reason to
    // go to lengths to avoid sorting n_topics entries, since
    // n_topics << n_docs. The expensive step is the row slice, which we
    // have to do anyway.
    doc_topics = function (d, n, callback) {
        my.worker.callback("doc_topics/" + d + "/" + n, callback);
        my.worker.postMessage({
            what: "doc_topics",
            d: d,
            n: n
        });
    };
    that.doc_topics = doc_topics;

    // Get n top words for topic t.
    topic_words = function (t, n) {
        var n_words = n || this.n_top_words(),
            words;
        if (t === undefined) {
            return d3.range(this.n()).map(function (topic) {
                return that.topic_words(topic, n);
            });
        }
        
        words = this.tw(t).entries(); // d3.map method
        words.sort(function (w1, w2) {
            return d3.descending(w1.value, w2.value) ||
                d3.ascending(w1.key, w2.key); // stabilize sort: alphabetical
        });

        return utils.shorten(words, n_words, function (ws, i) {
            return ws[i].value;
        })
            .map(function (w) {
                return {
                    word: w.key,
                    weight: w.value
                };
            });
    };
    that.topic_words = topic_words;

    // Get n top topics for a word.
    word_topics = function (word, n) {
        var t, row, word_wt,
            n_topics = n || this.n_top_words(),
            result = [],
            calc_rank = function (row) {
                // zero-based rank = (# of words strictly greater than word)
                return row.values().reduce(function (acc, cur) {
                    return cur > word_wt ? acc + 1 : acc;
                },
                    0);
            };

        for (t = 0; t < this.n(); t += 1) {
            row = this.tw(t);
            if (row.has(word)) {
                word_wt = row.get(word);
                result.push({
                    topic: t,
                    rank: calc_rank(row)
                });
            }
        }
        result.sort(function (a, b) {
            return d3.ascending(a.rank, b.rank) ||
                d3.ascending(a.topic, b.topic); // stabilize sort
        });
        return utils.shorten(result, n_topics, function (topics, i) {
            return topics[i].rank;
        });
    };
    that.word_topics = word_topics;

    year_topics = function (year, n) {
        // TODO DEPRECATED. Not used by the browser.
        var t, series, result = [];

        // *Could* calculate totals just for this year, but that still
        // requires running over all the documents to find those that
        // belong to the right year, and since we're comparing topics
        // we're cursed to traverse all of the doc-topics matrix anyway.

        for (t = 0; t < this.n(); t += 1) {
            series = this.topic_yearly(t);
            result.push({
                topic: t,
                weight: series.get(year) || 0 // TODO raw weighting or...?
            });
        }
        result.sort(function (a, b) {
            return d3.descending(a.weight, b.weight) ||
                d3.ascending(a.topic, b.topic); // stabilize sort
        });

        return utils.shorten(result, n);
    };
    that.year_topics = year_topics;

    // load tw from a string of JSON
    set_tw = function (tw_s) {
        var parsed;

        if (typeof tw_s !== 'string') {
            return;
        }

        parsed = JSON.parse(tw_s);
        my.alpha = parsed.alpha;
        my.tw = parsed.tw.map(function (topic) {
            var result = d3.map();
            topic.words.map(function (w, j) {
                result.set(w, topic.weights[j]);
            });
            return result;
        });

        if (!my.n) {
            my.n = my.alpha.length;
        }
    };
    that.set_tw = set_tw;

    // load dt from a string of JSON
    // callback should take one parameter, a Boolean indicating success
    set_dt = function (dt_s, callback) {
        if (typeof dt_s  !== 'string') {
            callback(false);
        }

        my.worker.callback("set_dt", function (result) {
            my.ready.dt = result;
            callback(result);
        });
        my.worker.postMessage({
            what: "set_dt",
            dt: JSON.parse(dt_s)
        });
    };
    that.set_dt = set_dt;

    // load meta from a string of CSV lines
    set_meta = function (meta_s) {
        var s, doc_years = [ ];
        if (typeof meta_s !== 'string') {
            return;
        }

        // strip blank "rows" at start or end
        s = meta_s.replace(/^\n*/, "")
            .replace(/\n*$/, "\n");

        // -infinity: nothing pre-Gutenberg in JSTOR
        my.start_date = new Date(1000, 0, 1);
        my.end_date = new Date(); // today

        my.meta = d3.csv.parseRows(s, function (d, j) {
            var doc = bib.parse(d);

            doc_years.push(doc.date.getUTCFullYear()); // store to pass into worker
            // set min and max date range
            my.start_date = doc.date < my.start_date ? doc.date : my.start_date;
            my.end_date = doc.date > my.end_date ? doc.date : my.end_date;

            return doc;
        });

        my.worker.callback("set_doc_years", function (result) {
            my.ready.doc_years = result;
        });
        my.worker.postMessage({
            what: "set_doc_years",
            doc_years: doc_years
        });
        my.years = d3.set(doc_years);
    };
    that.set_meta = set_meta;

    // load scaled topic coordinates from a string of CSV lines
    set_topic_scaled = function (ts_s) {
        var s;
        if (typeof ts_s  !== 'string') {
            return;
        }

        // strip blank "rows" at start or end
        s = ts_s.replace(/^\n*/, "")
            .replace(/\n*$/, "\n");
        my.topic_scaled = d3.csv.parseRows(s, function (row) {
            return row.map(parseFloat);
        });
    };
    that.set_topic_scaled = set_topic_scaled;

    return that;
};
