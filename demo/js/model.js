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
        // methods
        info, dt, n_docs, doc_len, tw, n, n_top_words, alpha, meta, vocab,
        topic_scaled,
        yearly_topic, topic_yearly, doc_year, yearly_total,
        topic_docs, topic_words, doc_topics, word_topics,
        set_dt, set_tw, set_meta, set_doc_len, set_topic_scaled;


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
        } else if (d === undefined ) {
            return my.dt;
        } else if (t === undefined) {
            return d3.range(this.n()).map(function (j) {
                return this.dt(d, j);
            });
        } else {
            p0 = my.dt.p[t];
            p = d3.bisectLeft(my.dt.i.slice(p0, my.dt.p[t + 1]),d);
            if (my.dt.i[p + p0] === d) {
                return my.dt.x[p + p0];
            } else {
                return 0;
            }

        }
    };
    dt.row_sum = function (d) {
        var result, t, n;
        if (!my.dt) {
            return undefined;
        }
        result = 0;
        for (t = 0; t < my.n; t += 1) {
            result += this(d, t);
        }
        return result;
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

    doc_len = function (d) {
        if (!my.doc_len) {
            return undefined;
            //my.doc_len = [];
        } else if (d === undefined) {
            return my.doc_len;
        } else {
            /*
            if(!my.doc_len[d]) {
                my.doc_len[d] = this.dt.row_sum(d);
            }
            */
            return my.doc_len[d];
        }
    };
    that.doc_len = doc_len;

    tw = function (t, word) {
        if (!my.tw) {
            return undefined;
        } else if (t === undefined) {
            return my.tw;
        } else if (word === undefined) {
            return my.tw[t];
        } else {
            return my.tw[t].get(word);
        }
    };
    that.tw = tw;

    n = function () {
        return my.n;
    };
    that.n = n;

    n_top_words = function () {
        if (!this.tw()) {
            return undefined;
        } else {
            return my.tw[0].keys().length;
        }
    };
    that.n_top_words = n_top_words;

    alpha = function (t) {
        if (!my.alpha) {
            return undefined;
        }
        return isFinite(t) ? my.alpha[t] : my.alpha;
    };
    that.alpha = alpha;

    meta = function (d) {
        if (!my.meta) {
            return undefined;
        }
        return isFinite(d) ? my.meta[d] : my.meta;
    };
    that.meta = meta;
    
    doc_year = function (d) {
        if (!my.meta) {
            return undefined;
        }
        if (!my.doc_year) {
            my.doc_year = [];
        }
        if (my.doc_year[d] !== undefined) {
            return my.doc_year[d];
        } else {
            my.doc_year[d] = meta(d).date.getFullYear();
            return my.doc_year[d];
        }
    };
    that.doc_year = doc_year;

    vocab = function () {
        var result;
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

    topic_scaled = function (t) {
        if (!my.topic_scaled) {
            return undefined;
        } else if (t === undefined) {
            return my.topic_scaled;
        } else {
            return my.topic_scaled[t];
        }
    };
    that.topic_scaled = topic_scaled;

    yearly_total = function (y) {
        var result;
        if (my.yearly_total) {
            return my.yearly_total.get(y);
        } else {
            result = d3.map();
            for (n = 0; n < my.dt.i.length; n += 1) {
                y = this.doc_year(my.dt.i[n]);
                if (result.has(y)) {
                    result.set(y, result.get(y) + my.dt.x[n]);
                }
                else {
                    result.set(y, my.dt.x[n]);
                }
            }
            my.yearly_total = result;
            return result.get(y);
        }
    }; 
    that.yearly_total = yearly_total;

    topic_yearly = function (t) {
        var result, n, y;

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

        for (n = my.dt.p[t]; n < my.dt.p[t + 1]; n += 1) {
            y = this.doc_year(my.dt.i[n]);
            if (result.has(y)) {
                result.set(y, result.get(y) + my.dt.x[n]);
            } else {
                result.set(y, my.dt.x[n]);
            }
        }

        // divide through
        result.forEach(function (y, w) {
            result.set(y, w / that.yearly_total(y));
        });

        // cache if this is the first time through
        my.topic_yearly[t] = result;
        return result;
    };
    that.topic_yearly = topic_yearly;

    topic_docs = function (t, n) {
        var p0 = my.dt.p[t],
            p1 = my.dt.p[t + 1],
            m = this,
            docs, bisect, insert, i, result = [];
        // naive document ranking, by the proportion of words assigned to t,
        // which does *not* necessarily give the docs where t is most salient

        // column slice
        docs = d3.range(p0, p1).map(function (p) {
            return {
                doc: my.dt.i[p],
                frac: my.dt.x[p] / m.doc_len(my.dt.i[p]),
                weight: my.dt.x[p]
            };
        });

        if (n >= docs.length) {
            docs.sort(function (a, b) {
                return d3.descending(a.frac, b.frac);
            });
            return docs;
        }

        // initial guess. simplifies the conditionals below to do it this way,
        // and sorting n elements is no biggie
        result = docs.slice(0, n).sort(function (a, b) {
            return d3.ascending(a.frac, b.frac);
        });

        bisect = d3.bisector(function (d) { return d.frac; }).left;

        for (i = n; i < docs.length; i += 1) {
            insert = bisect(result, docs[i].frac);
            if (insert > 0) {
                result.splice(insert, 0, docs[i]);
                result.shift();
            } else if (result[0].frac === docs[i].frac) {
                // insert = 0, tie
                result.unshift(docs[i]);
            }
        }

        // biggest first
        return utils.shorten(result.reverse(), n, function (xs, i) {
            return xs[i].frac;
        });
    };
    that.topic_docs = topic_docs;

    // unlike with docs, no reason to go to lengths to avoid sorting n_topics
    // entries, since n_topics << n_docs. The expensive step is the row slice, 
    // which we have to do anyway.
    doc_topics = function (d, n) {
        var m = this,
            topics, i;
        topics = d3.range(my.n)
            .map(function (t) {
                return {
                    topic: t,
                    weight: m.dt(d, t)
                };
            })
            .filter(function (d) {
                return d.weight > 0;
            })
            .sort(function (a, b) {
                return d3.descending(a.weight, b.weight);
            });


        return utils.shorten(topics, n, function (topics, i) {
            return topics[i].weight;
        });
    };
    that.doc_topics = doc_topics;

    topic_words = function (t, n) {
        var n_words = n || this.n_top_words(),
            m = this,
            words = this.tw(t).entries(); // d3.map method
        words.sort(function (w1, w2) {
            return d3.descending(w1.value, w2.value);
        });
        return utils.shorten(words, n_words, function (ws, i) {
            return ws[i].value;
        })
        .map(function (w) { return w.key; });
    };
    that.topic_words = topic_words;

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
            return d3.ascending(a.rank, b.rank);
        });
        return utils.shorten(result, n_topics, function (topics, i) {
            return topics[i].rank;
        });
    };
    that.word_topics = word_topics;

    set_tw = function (tw_s) {
        var parsed;

        if (typeof(tw_s) !== 'string') {
            return;
        }

        parsed = JSON.parse(tw_s);
        my.alpha = parsed.alpha;
        my.tw = parsed.tw.map(function (topic) {
            var result = d3.map();
            topic.words.map(function (w, j) {
                result.set(w,topic.weights[j]);
            });
            return result;
        });

        if (!my.n) {
            my.n = my.alpha.length;
        }
    };
    that.set_tw = set_tw;

    set_dt = function (dt_s) {
        if (typeof(dt_s) !== 'string') {
            return;
        }
        my.dt = JSON.parse(dt_s);
        if (!my.n) {
            my.n = my.dt.p.length - 1;
        }
    };
    that.set_dt = set_dt;

    set_meta = function (meta_s) {
        var s;
        if (typeof(meta_s) !== 'string') {
            return;
        }

        // strip blank "rows" at start or end
        s = meta_s.replace(/^\n*/,"")
            .replace(/\n*$/,"\n");

        my.meta = d3.csv.parseRows(s, function (d, j) {
        // no header, but this is the column order:
        // 0  1     2      3            4      5     6       7      
        // id,title,author,journaltitle,volume,issue,pubdate,pagerange
            var a_str = d[2].trim(), // author
                date = new Date(d[6].trim()); // pubdate

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

    set_doc_len = function (s) {
        if (typeof(s) !== 'string') {
            return;
        }
        my.doc_len = JSON.parse(s).doc_len;
    };
    that.set_doc_len = set_doc_len;

    set_topic_scaled = function(ts_s) {
        var s;
        if (typeof(ts_s) !== 'string') {
            return;
        }

        // strip blank "rows" at start or end
        s = ts_s.replace(/^\n*/,"")
            .replace(/\n*$/,"\n");
        my.topic_scaled = d3.csv.parseRows(s, function (row) {
            return row.map(parseFloat);
        });
    };
    that.set_topic_scaled = set_topic_scaled;

    return that;
};
