/*global d3, utils */
"use strict";
var model;

// model specification
// -------------------
// data stored internally as follows:
// tw: array of d3.map()s keyed to words as strings
// dt: column-compressed sparse matrix { i, p, x }
// alpha: alpha values for topics
// meta: array of objects holding document citations

model = function (spec) {
    var my = spec || { }, // private members
        that = { }, // resultant object
        info, // accessors and pseudo-accessors
        dt,
        n_docs,
        tw,
        n,
        n_top_words,
        total_tokens,
        alpha,
        meta,
        vocab,
        topic_scaled,
        topic_yearly, // time-slicing
        doc_year,
        valid_year,
        yearly_total,
        years,
        topic_docs, // most salient _ in _
        topic_words,
        doc_topics,
        word_topics,
        year_topics,
        set_dt, // methods for loading model data from strings 
        set_tw,
        set_meta,
        set_topic_scaled;


    info = function (model_meta) {
        if (model_meta) {
            my.info = model_meta;
        }
        return my.info;
    };
    that.info = info;

    dt = function (d, t) {
        var p0, p;
        if (!my.dt) {
            return undefined;
        }

        // dt() for the whole matrix
        if (d === undefined) {
            return my.dt;
        }

        // dt(d) for a whole document row
        if (t === undefined) {
            return d3.range(this.n()).map(function (j) {
                return this.dt(d, j);
            });
        }

        // dt(d, t) for one entry
        p0 = my.dt.p[t];
        p = d3.bisectLeft(my.dt.i.slice(p0, my.dt.p[t + 1]), d);

        // if there is no d entry for column t, return 0
        return (my.dt.i[p + p0] === d) ? my.dt.x[p + p0] : 0;
    };
    // a naive row_sum method for the dt object
    dt.row_sum = function (d) {
        var result, t;
        if (!my.dt) {
            return undefined;
        }

        // memoize, at least
        if (!my.dt_row_sum) {
            my.dt_row_sum = [ ];
        }

        if (!my.dt_row_sum[d]) {
            result = 0;
            for (t = 0; t < my.n; t += 1) {
                result += this(d, t);
            }
            my.dt_row_sum[d] = result;
        }
        return my.dt_row_sum[d];
    };
    // a col_sum method: this takes advantages of the column compression
    dt.col_sum = function (t) {
        var i;

        // memoization
        if (!my.col_sums) {
            my.col_sums = [];
        }

        // dt.col_sum() returns an array of sums
        if (t === undefined) {
            return d3.range(my.n).map(this.col_sum);
        }

        // otherwise, return the sum for column t
        if (!my.col_sums[t]) {
            my.col_sums[t] = 0;
            for (i = my.dt.p[t]; i < my.dt.p[t + 1]; i += 1) {
                my.col_sums[t] += my.dt.x[i];
            }
        }
        return my.col_sums[t];
    };
    that.dt = dt;

    n_docs = function () {
        var result;
        if (my.n_docs !== undefined) {
            result = my.n_docs;
        } else if (my.meta) {
            result = my.meta.length;
        } else if (my.dt) {
            result = -1;
            // n_docs = max row index
            // for each column, the row indices are in order in my.dt.i,
            // so we only need to look at the last row index for each column
            for (n = 1; n < my.dt.p.length; n += 1) {
                if (result < my.dt.i[my.dt.p[n] - 1]) {
                    result = my.dt.i[my.dt.p[n] - 1];
                }
            }
            result += 1;
        }
        my.n_docs = result;
        return result; // undefined if both my.meta and my.dt are missing
    };
    that.n_docs = n_docs;

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

    total_tokens = function () {
        if (!this.dt()) {
            return undefined;
        }

        if (!my.total_tokens) {
            my.total_tokens = d3.sum(my.dt.x);
        }

        return my.total_tokens;
    };
    that.total_tokens = total_tokens;

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
        return isFinite(d) ? my.meta[d] : my.meta;
    };
    that.meta = meta;

    // convenience function for getting doc dates as years
    doc_year = function (d) {
        if (!my.meta) {
            return undefined;
        }

        // memoization
        if (!my.doc_year) {
            my.doc_year = [];
        }
        if (my.doc_year[d] !== undefined) {
            return my.doc_year[d];
        }

        my.doc_year[d] = meta(d).date.getFullYear();
        return my.doc_year[d];
    };
    that.doc_year = doc_year;

    valid_year = function (y, t) {
        if (!my.meta || !my.dt || !isFinite(y)) {
            return undefined;
        }

        // This looks egregious, but we're going to cache these results
        // anyway.
        return this.topic_yearly(t).has(y);
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
    yearly_total = function (year) {
        var tally, y;
        // memoization
        if (!my.yearly_total) {
            tally = d3.map();
            for (n = 0; n < my.dt.i.length; n += 1) {
                y = this.doc_year(my.dt.i[n]);
                if (tally.has(y)) {
                    tally.set(y, tally.get(y) + my.dt.x[n]);
                } else {
                    tally.set(y, my.dt.x[n]);
                }
            }
            my.yearly_total = tally;
        }

        return isFinite(year) ? my.yearly_total.get(year) : my.yearly_total;
    };
    that.yearly_total = yearly_total;

    years = function () {
        return this.yearly_total().keys();
    };
    that.years = years;

    // yearly proportions for topic t
    topic_yearly = function (t) {
        var result, j, y;

        // cached? 
        if (!my.topic_yearly) {
            my.topic_yearly = [];
        } else if (my.topic_yearly[t]) {
            return my.topic_yearly[t];
        }
        if (!this.dt() || !this.meta()) {
            return undefined;
        }

        result = d3.map();

        for (j = my.dt.p[t]; j < my.dt.p[t + 1]; j += 1) {
            y = this.doc_year(my.dt.i[j]);
            if (result.has(y)) {
                result.set(y, result.get(y) + my.dt.x[j]);
            } else {
                result.set(y, my.dt.x[j]);
            }
        }

        // divide through
        result.forEach(function (y, w) {
            // have to use "that" and not "this" because "this" changes
            // inside forEach
            result.set(y, w / that.yearly_total(y));
        });

        // cache if this is the first time through
        my.topic_yearly[t] = result;
        return result;
    };
    that.topic_yearly = topic_yearly;

    // Get n top documents for topic t. Uses a naive document ranking,
    // by the proportion of words assigned to t, which does *not*
    // necessarily give the docs where t is most salient
    topic_docs = function (t, n) {
        var p0 = my.dt.p[t],
            p1 = my.dt.p[t + 1],
            docs,
            bisect,
            insert,
            i,
            result = [];

        // column slice
        docs = d3.range(p0, p1).map(function (p) {
            return {
                doc: my.dt.i[p],
                frac: my.dt.x[p] / that.dt.row_sum(my.dt.i[p]),
                weight: my.dt.x[p]
            };
        });

        // return them all, sorted, if there are fewer than n hits
        if (n >= docs.length) {
            docs.sort(function (a, b) {
                return d3.descending(a.frac, b.frac) ||
                    d3.descending(a.doc, b.doc); // stabilize sort
            });
            return docs;
        }

        // initial guess. simplifies the conditionals below to do it this way,
        // and sorting n elements is no biggie

        result = docs.slice(0, n).sort(function (a, b) {
            return d3.ascending(a.frac, b.frac) ||
                d3.ascending(a.doc, b.doc); // stabilize sort
        });

        bisect = d3.bisector(function (d) { return d.frac; }).left;

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
    that.topic_docs = topic_docs;

    // Get n top topics for document d. Unlike with docs, no reason to
    // go to lengths to avoid sorting n_topics entries, since
    // n_topics << n_docs. The expensive step is the row slice, which we
    // have to do anyway.
    doc_topics = function (d, n) {
        var topics;

        topics = d3.range(my.n)
            .map(function (t) {
                return {
                    topic: t,
                    weight: that.dt(d, t)
                };
            })
            .filter(function (d) {
                return d.weight > 0;
            })
            .sort(function (a, b) {
                return d3.descending(a.weight, b.weight) ||
                    d3.descending(a.t, b.t); // stabilize sort
            });


        return utils.shorten(topics, n, function (topics, i) {
            return topics[i].weight;
        });
    };
    that.doc_topics = doc_topics;

    // Get n top words for topic t.
    topic_words = function (t, n) {
        var n_words = n || this.n_top_words(),
            words = this.tw(t).entries(); // d3.map method
        words.sort(function (w1, w2) {
            return d3.descending(w1.value, w2.value) ||
                d3.ascending(w1.key, w2.key); // stabilize sort: alphabetical
        });

        return utils.shorten(words, n_words, function (ws, i) {
            return ws[i].value;
        })
            .map(function (w) { return w.key; });
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
    set_dt = function (dt_s) {
        if (typeof dt_s  !== 'string') {
            return;
        }
        my.dt = JSON.parse(dt_s);
        if (!my.n) {
            my.n = my.dt.p.length - 1;
        }
    };
    that.set_dt = set_dt;

    // load meta from a string of CSV lines
    set_meta = function (meta_s) {
        var s;
        if (typeof meta_s !== 'string') {
            return;
        }

        // strip blank "rows" at start or end
        s = meta_s.replace(/^\n*/, "")
            .replace(/\n*$/, "\n");

        my.start_date = new Date(1000, 0, 1); // nothing pre-Gutenberg in JSTOR
        my.end_date = new Date(); // today

        my.meta = d3.csv.parseRows(s, function (d, j) {
        // no header, but this is the column order:
        // 0  1     2      3            4      5     6       7      
        // id,title,author,journaltitle,volume,issue,pubdate,pagerange
            var a_str = d[2].trim(), // author
                date = new Date(d[6].trim()); // pubdate

                // set min and max date range
                my.start_date = date < my.start_date ? date : my.start_date;
                my.end_date = date > my.end_date ? date : my.end_date;

            return {
                doi: d[0].trim(), // id
                title: d[1].trim(),
                authors: a_str === "" ? [] : a_str.split("\t"),
                journaltitle: d[3].trim(),
                volume: d[4].trim(),
                issue: d[5].trim(),
                date: date, // pubdate
                pagerange: d[7].trim()
                    .replace(/^p?p\. /, "")
                    .replace(/-/g, "–")
            };
        });
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
