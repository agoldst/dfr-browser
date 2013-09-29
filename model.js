
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
        info, dt, n_docs, doc_len, tw, n, n_top_words, alpha, meta,
        yearly_topic, topic_yearly, doc_year, yearly_total,
        set_dt, set_tw, set_meta, set_doc_len;


    info = function (model_meta) {
        if (model_meta) {
            my.info = model_meta;
        } 
        return my.info;
    };
    that.info = info;

    dt = function (d, t) {
        if (!my.dt) {
            return undefined;
        } else if (d === undefined ) {
            return my.dt;
        } else if (t === undefined) {
            // TODO faster row slicing
            return d3.range(this.n()).map(function (j) {
                return this.dt(d, j);
            });
        } else {
            // TODO: jump by powers of two instead of by 1
            for (n = my.dt.p[t]; n < my.dt.p[t + 1]; n += 1) {
                if (my.dt.i[n] == d) {
                    return my.dt.x[n];
                }
                else if (my.dt.i[n] > d) {
                    return 0;
                }
            }
            return 0;
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

    return that;
};
