/*global d3, queue */

/* declaration of global object (initialized in setup_vis) */
var VIS = {
    loaded: { }, // which data already loaded?
    ready: { }, // which viz already generated?
    bib_sort: {
        major: "year",
        minor: "alpha"
    },
    overview_words: 15,     // TODO set these parameters interactively
    topic_view_words: 50,
    topic_view_docs: 20,
    doc_view_topics: 10,
    float_format: function (x) {
        return d3.round(x, 3);
    },
    percent_format: d3.format(".1%"),
    cite_date_format: d3.time.format("%B %Y"),
    uri_proxy: ".proxy.libraries.rutgers.edu",
    prefab_plots: true, // use SVG or look for image files for plots?
    plot: {
        w: 640, // TODO hardcoding = bad
        h: 300,
        m: {
            left: 40,
            right: 20,
            top: 20,
            bottom: 20
        },
        bar_width: 300, // in days!
        ticks: 10 // applied to both x and y axes
    }
};

/* declaration of functions */

var model,          // model specification
    top_words,      // rankers and sorters
    word_topics,
    top_docs,
    doc_topics,
    doc_sort_key,
    bib_sort,
    topic_label,    // stringifiers
    topic_link,
    cite_doc,
    doc_uri,
    topic_view,     // view generation
    plot_topic_yearly,
    word_view,
    doc_view,
    bib_view,
    about_view,
    model_view,
    view_refresh,
    view_loading,
    setup_vis,      // initialization
    plot_svg,
    read_files,
    main;           // main program

// model specification
// -------------------
// data stored internally as follows:
// tw: array of d3.map()s keyed to words as strings
// dt: docs in rows, topic counts in columns
// alpha: alpha values for topics
// meta: array of objects holding document citations

model = function (spec) {
    var my = spec || { }, // private members
        that = { }, // resultant object
        // methods
        info, dt, n_docs, doc_len, tw, n, n_top_words, alpha, meta,
        yearly_topic, topic_yearly, doc_year, yearly_total,
        set_dt, set_tw, set_meta;


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
            for(n = 1; n < my.dt.p.length; n += 1) {
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
            my.doc_len = [];
        }
        if(!my.doc_len[d]) {
            my.doc_len[d] = this.dt.row_sum(d);
        }
        return my.doc_len[d];
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

    return that;
};


// utility functions
// -----------------

// -- rankers
//    -------

top_words = function (m, t, n) {
    var w;
    w = m.tw(t).keys().sort(function (j, k) {
        return d3.descending(m.tw(t, j), m.tw(t, k));
    });

    return w.slice(0, n);
};

word_topics = function (m, word) {
    var t, row, word_wt,
        result = [],
        calc_rank = function (row) {
            // zero-based rank = (# of words strictly greater than word)
            return row.values().reduce(function (acc, cur) {
                return cur > word_wt ? acc + 1 : acc;
            },
                0);
        };

    for (t = 0; t < m.n(); t += 1) {
        row = m.tw(t);
        if (row.has(word)) {
            word_wt = row.get(word);
            result.push([t, calc_rank(row)]);
        }
    }
    return result;
};

top_docs = function (m, t, n) {
    var docs, wts, wt, insert, i,
        weight;

    // naive document ranking: just by the proportion of words assigned to t 
    // which does *not* necessarily give the docs where t is most salient

    weight = function (d) {
        return m.dt(d,t) / m.doc_len(d);
    };
    // initial guess
    docs = d3.range(n);
    wts = docs.map(weight);
    docs.sort(function (a, b) {
        return d3.ascending(wts[a], wts[b]);
    });
    wts = docs.map(function (d) { return wts[d]; });

    for (i = n; i < m.n_docs(); i += 1) {
        wt = weight(i);
        insert = d3.bisectLeft(wts, wt);
        if (insert > 0) {
            docs.splice(insert, 0, i);
            docs.shift();
            wts.splice(insert, 0, wt);
            wts.shift();
        }
    }

    return docs.reverse(); // biggest first
};

// TODO user faster "top N" algorithm as in top_docs ?
doc_topics = function (m, d, n) {
    return d3.range(m.n())
        .sort(function (a, b) {
            return d3.descending(m.dt(d, a), m.dt(d, b));
        })
        .slice(0, n);
};

/*
// h/t http://jsperf.com/code-review-1480
function binary_search_iterative2(arr, ele) {
  var beginning = 0, end = arr.length,
      target;
  while (true) {
      target = ((beginning + end) >> 1);
      if ((target === end || target === beginning) && arr[target] !== ele) {
          return -1;
      }
      if (arr[target] > ele) {
          end = target;
      } else if (arr[target] < ele) {
          beginning = target;
      } else {
          return target;
      }
  }
} */

doc_sort_key = function (m, i) {
    var names;
    // TODO shouldn't really combine sort key and extracting the first letter
    // also, this fails when author name ends with Jr, 2nd, (xxx), etc.
    if (m.meta(i).authors.length > 0) {
        names = m.meta(i).authors[0].split(" ");
        return names[names.length - 1][0].toUpperCase(); // N.B. casefolding
    } else {
        return "[Anon]";
    }
};

bib_sort = function (m, major, minor) {
    var result = {
            headings: [],
            docs: []
        },
        docs = d3.range(m.n_docs()),
        major_sort, major_split, minor_sort,
        major_key, cur_major,
        i, last,
        partition = [];

    if (major === "decade") {
        major_split = function (i) {
            return Math.floor(m.meta(i).date.getFullYear() / 10).toString() +
                "0s";
        };

        major_sort = function (a, b) {
            return d3.ascending(+m.meta(a).date, +m.meta(b).date);
        };
    } else if (major === "year") {
        major_split = function (i) {
            return m.meta(i).date.getFullYear();
        };

        major_sort = function (a, b) {
            return d3.ascending(+m.meta(a).date, +m.meta(b).date);
        };
    } else {
        if (major !== "alpha") {
            console.log("Unknown bib_sort: " + major + "; defaulting to alpha");
        }
        // alphabetical
        major_split = function (i) {
            return doc_sort_key(m, i);
        };
        major_sort = function (a, b) {
            return d3.ascending(doc_sort_key(m, a), doc_sort_key(m, b));
        };
    }


    if (minor === "date") {
        minor_sort = function(a, b) {
            return d3.ascending(+m.meta(a).date, +m.meta(b).date);
        };
    } else  {
        if (minor !== "alpha") {
            console.log("Unknown bib_sort: " + minor + "; defaulting to alpha");
        }
        // alphabetical
        minor_sort = function (a, b) {
            return d3.ascending(doc_sort_key(m, a), doc_sort_key(m, b));
        };
    }

    docs = docs.sort(major_sort);
    for (i = 0; i < docs.length; i += 1) {
        major_key = major_split(docs[i]);
        if (major_key !== cur_major) {
            partition.push(i);
            result.headings.push(major_key);
            cur_major = major_key;
        }
    }
    partition.shift(); // correct for "0" always getting added at the start
    partition.push(docs.length); // make sure we get the tail 

    for (i = 0, last = 0; i < partition.length; i += 1) {
        result.docs.push(docs.slice(last, partition[i]).sort(minor_sort));
        last = partition[i];
    }

    return result;
};



// -- stringifiers
//    ------------

topic_label = function (m, t, n) {
    var label;

    label = String(t + 1); // user-facing index is 1-based
    label += " ";
    label += top_words(m, t, n).join(" ");
    return label;
};

topic_link = function (t) {
    return "#/topic/" + (t + 1);
};

cite_doc = function (m, d) {
    var doc, lead, result;

    doc = m.meta(d);
    // TODO factor out sort-name extraction (to use with doc_sort_key too)
    // fails on Jr., 2nd, etc.
    if(doc.authors.length > 0) {
        lead = doc.authors[0].split(" ");
        result = lead.pop() + ", ";
        result += lead.join(" ");
        if(doc.authors.length > 1) {
            if(doc.authors.length > 2) {
                result += ", ";
                result += doc.authors
                    .slice(1,doc.authors.length - 1)
                    .join(", ");
            }
            result += ", and " + doc.authors[doc.authors.length - 1];
        }
    } else {
            result = "[Anon]";
    }

    result += ". ";
    result += '"' + doc.title + '."';
    result += " <em>" + doc.journaltitle + "</em> ";
    result += doc.volume + ", no. " + doc.issue;

    result += " (" + VIS.cite_date_format(doc.date) + "): ";
    result += doc.pagerange + ".";

    result = result.replace(/_/g, ",");
    result = result.replace(/\t/g, "");

    return result;
};

doc_uri = function (m, d) {
    return "http://dx.doi.org"
        + VIS.uri_proxy
        + "/"
        + m.meta(d).doi;
};


// Principal view-generating functions
// -----------------------------------

topic_view = function (m, t) {
    var view = d3.select("div#topic_view"),
        trs_w, trs_d, img;

    if (!m.meta() || !m.dt() || !m.tw()) {
        // not ready yet; show loading message
        view_loading(true);
        return true;
    }

    // TODO don't need anything but tw to show topic words h2 and div; so can 
    // have div-specific loading messages instead

    // get top words and weights
    // -------------------------

    view.select("h2")
        .text(topic_label(m, t, VIS.overview_words));

    view.select("p#topic_remark")
        .text("α = " + VIS.float_format(m.alpha(t)));


    trs_w = view.select("table#topic_words tbody")
        .selectAll("tr")
        .data(top_words(m, t, m.n_top_words()));

    trs_w.enter().append("tr");
    trs_w.exit().remove();

    // clear rows
    trs_w.selectAll("td").remove();

    trs_w
        .append("td").append("a")
        .attr("href", function (w) {
            return "#/word/" + w;
        })
        .text(function (w) { return w; });

    trs_w
        .append("td")
        .text(function (w) {
            return m.tw(t,w);
        });


    // get top articles
    // ----------------

    trs_d = view.select("table#topic_docs tbody")
        .selectAll("tr")
        .data(top_docs(m, t, VIS.topic_view_docs));

    trs_d.enter().append("tr");
    trs_d.exit().remove();

    // clear rows
    trs_d.selectAll("td").remove();

    trs_d
        .append("td").append("a")
        .attr("href", function (d) {
            return "#/doc/" + d;
        })
        .html(function (d) {
            return cite_doc(m, d);
        });

    trs_d
        .append("td")
        .text(function (d) {
            return VIS.percent_format(m.dt(d, t) / m.doc_len(d));
        });

    trs_d
        .append("td")
        .text(function (d) {
            return m.dt(d, t);
        });


    // Plot topic over time
    // --------------------

    if (VIS.prefab_plots) {
        // Set image link
        img = d3.select("#topic_plot img");
        if(img.empty()) {
            img = d3.select("#topic_plot").append("img"); 
        }

        img.attr("src", "topic_plot/" + d3.format("03d")(t + 1) + ".png")
            .attr("title", "yearly proportion of topic " + (t + 1));
    }
    else {
        plot_topic_yearly(m, t);
    }
    view_loading(false);

    return true;
    // TODO visualize word and doc weights as lengths
    // (later: nearby topics by J-S div or cor on log probs)
};

plot_topic_yearly = function(m, t) {
    var year_seq, series = [],
        w, scale_x, scale_y,
        rects, axis_x, axis_y, 
        svg = plot_svg();

    series = m.topic_yearly(t).keys().sort().map(function (y) {
        return [new Date(+y, 0, 1), m.topic_yearly(t).get(y)];
    });

    scale_x = d3.time.scale()
        .domain([series[0][0],
                d3.time.day.offset(series[series.length - 1][0],
                    VIS.plot.bar_width)])
        .range([0, VIS.plot.w]);
        //.nice();

    w = scale_x(d3.time.day.offset(series[0][0],VIS.plot.bar_width)) -
        scale_x(series[0][0]);


    scale_y = d3.scale.linear()
        .domain([0, d3.max(series, function (d) {
            return d[1];
        })])
        .range([VIS.plot.h, 0])
        .nice();

    // axes
    // ----

    // clear
    svg.selectAll("g.axis").remove();

    // x axis
    svg.append("g")
        .classed("axis",true)
        .classed("x",true)
        .attr("transform","translate(0," + VIS.plot.h + ")")
        .call(d3.svg.axis()
            .scale(scale_x)
            .orient("bottom")
            .ticks(d3.time.years,VIS.plot.ticks));

    // y axis
    svg.append("g")
        .classed("axis",true)
        .classed("y",true)
        .call(d3.svg.axis()
            .scale(scale_y)
            .orient("left")
            .tickSize(-VIS.plot.w)
            .outerTickSize(0)
            .tickFormat(VIS.percent_format)
            .ticks(VIS.plot.ticks));

    svg.selectAll("g.axis.y g").filter(function(d) { return d; })
        .classed("minor", true);

    // bars
    // ----

    // clear
    svg.selectAll("rect.topic_proportion").remove();

    rects = svg.selectAll("rect")
        .data(series);

    rects.enter().append("rect");

    rects.classed("topic_proportion",true)
        .attr("x", function (d) {
            return scale_x(d[0]);
        })
        .attr("y", function (d) {
            return scale_y(d[1]);
        })
        .attr("width",w)
        .attr("height", function (d) {
            return VIS.plot.h - scale_y(d[1]);
        });
};


word_view = function (m, word) {
    var view = d3.select("div#word_view"),
        trs, topics;

    if (word === undefined) {
        return false;
    }

    if (!m.tw()) {
        view_loading(true);
        return true;
    }


    view.select("h2")
        .text(word);

    topics = word_topics(m, word);
    topics = topics.sort(function (a, b) {
        return d3.ascending(a[1], b[1]);
    });

    // TODO alert if topics.length == 0

    trs = view.select("table#word_topics tbody")
        .selectAll("tr")
        .data(topics);

    trs.enter().append("tr");
    trs.exit().remove();

    // clear rows
    trs.selectAll("td").remove();

    trs.append("td")
        .text(function (d) {
            return d[1] + 1; // user-facing rank is 1-based
        });

    trs.append("td").append("a")
        .text(function (d) {
            return topic_label(m, d[0], VIS.overview_words);
        })
        .attr("href", function (d) {
            return topic_link(d[0]);
        });

    view_loading(false);
    return true;

    // (later: time graph)
};

doc_view = function (m, doc) {
    var view = d3.select("div#doc_view"),
        trs;

    if (!m.meta() || !m.dt() || !m.tw()) {
        view_loading(true);
        return true;
    }
    
    // TODO asynchronous loading of different pieces of view

    view.select("#doc_view h2")
        .html(cite_doc(m, doc));

    view.select("p#doc_remark")
        .html(m.doc_len(doc) + " tokens. "
                + '<a class ="external" href="'
                + doc_uri(m, doc)
                + '">View '
                + m.meta(doc).doi
                + " on JSTOR</a>");

    trs = view.select("table#doc_topics tbody")
        .selectAll("tr")
        .data(doc_topics(m, doc, VIS.doc_view_topics));

    trs.enter().append("tr");
    trs.exit().remove();

    // clear rows
    trs.selectAll("td").remove();

    trs.append("td").append("a")
        .attr("href", topic_link)
        .text(function (t) {
            return topic_label(m, t, VIS.overview_words);
        });
    trs.append("td")
        .text(function (t) {
            return m.dt(doc, t);
        });
    trs.append("td")
        .text(function (t) {
            return VIS.percent_format(m.dt(doc, t) / m.doc_len(doc));
        });

    view_loading(false);
    return true;
    // TODO visualize topic proportions as rectangles at the very least

    // (later: nearby documents)
};

bib_view = function (m) {
    var view = d3.select("div#bib_view"),
        ordering, nav_as, sections, headings, as;

    console.log("bibliography view");
    if (VIS.ready.bib) {
        console.log("ready.bib true");
        return true;
    }

    if (!m.meta()) {
        console.log("meta missing");
        view_loading(true);
        return true;
    }

    console.log("executing bib sort of " + m.n_docs() + " docs");
    ordering = bib_sort(m, VIS.bib_sort.major, VIS.bib_sort.minor);

    VIS.ordering = ordering;

    // TODO fix page-jumping #links
    // TODO use bootstrap accordions?
    /*
    nav_as = view.select("nav")
        .selectAll("a")
        .data(ordering.headings);

    nav_as.enter().append("a");
    nav_as.exit().remove();

    nav_as
        .attr("href", function (h) { return "#" + h; })
        .text(function (h) { return h; });
    nav_as
        .attr("href", "#/bib")
        .text(function (h) { return h; });
    */
    sections = view.select("div#bib_main")
        .selectAll("section")
        .data(ordering.headings);

    sections.enter()
        .append("section")
        .append("h2");

    sections.exit().remove();

    headings = sections.selectAll("h2");

    headings
        .attr("id", function (h) {
            return h;
        })
        .text(function (h) { return h; });

    as = sections
        .selectAll("a")
        .data(function (h, i) {
            return ordering.docs[i];
        });

    as.enter().append("a");
    as.exit().remove();

    // TODO list topics in bib entry?

    as
        .attr("href", function (d) {
            return "#/doc/" + d;
        })
        .html(function (d) {
            return cite_doc(m, d);
        });

    VIS.ready.bib = true;

    view_loading(false);
    return true;

};

about_view = function (m) {
    if(!VIS.ready.about) {
        d3.select("div#meta_info")
            .html(m.info().meta_info);
        VIS.ready.about = true;
    }
    d3.select("#about_view").classed("hidden", false);
    return true;
};


model_view = function (m) {
    var view = d3.select("#model_view"),
        trs;

    if (VIS.ready.model) {
        view.classed("hidden", false);
        return true;
    }

    if (!m.tw()) {
        view_loading(true);
        return true;
    }

    trs = d3.select("table#model_topics tbody")
        .selectAll("tr")
        .data(d3.range(m.n()));

    // clear rows
    trs.selectAll("td").remove();

    trs.enter().append("tr");
    trs.exit().remove();

    trs.append("td").append("a")
        .text(function (t) { return t + 1; }) // sigh
        .attr("href", topic_link);

    trs.append("td").append("a")
        .text(function (t) {
            return top_words(m, t, VIS.overview_words).join(" ");
        })
        .attr("href", topic_link);

    trs.append("td")
        .text(function (t) {
            return VIS.float_format(m.alpha(t));
        });

    VIS.ready.model = true;

    view_loading(false);
    return true;

    // TODO visualize alphas
    // (later: word clouds)
    // (later: grid of time graphs)
    // (later: multi-dimensional scaling projection showing topic clusters)
};

view_loading = function (flag) {
    d3.select("div#loading").classed("hidden", !flag);
};

view_refresh = function (m, v) {
    var view_parsed, param, success;

    view_parsed = v.split("/");
    param = view_parsed[2];

    if (VIS.cur_view !== undefined) {
        VIS.cur_view.classed("hidden", true);
    }

    switch (view_parsed[1]) {
        case undefined:
            view_parsed[1] = "model";
            success = model_view(m);
            break;
        case "model":
            success = model_view(m);
            break;
        case "about":
            success = about_view(m);
            break;
        case "bib":
            success = bib_view(m);
            break;
        case "topic":
            // TODO interactive specification of param if missing
            // to support raw #/topic links
            param = +param - 1;
            success = topic_view(m, param);
            break;
        case "word":
            // TODO support raw #/word links w/ no param
            success = word_view(m, param);
            break;
        case "doc":
            // TODO support raw #/doc links w/ no param
            // (incl. toggle active state on navbar)
            param = +param;
            success = doc_view(m, param);
            break;
        default:
            success = false;
            break;
    }

    if (success) {
        VIS.cur_view = d3.select("div#" + view_parsed[1] + "_view");
    } else {
        if (VIS.cur_view === undefined) {
            // fall back on model_view
            VIS.cur_view = d3.select("div#model_view");
            model_view(m);
        } 
    }

    VIS.cur_view.classed("hidden",false);

    // ensure highlighting of nav link
    d3.selectAll("li.active").classed("active",false);
    d3.select("li#nav_" + view_parsed[1]).classed("active",true);

};


// initialization
// --------------

// global visualization setup
setup_vis = function (m) {
    var key;

    // ensure plot div has size
    d3.select("div#topic_plot")
        .attr("width", VIS.plot.w + VIS.plot.m.left + VIS.plot.m.right)
        .attr("height", VIS.plot.h + VIS.plot.m.top + VIS.plot.m.bottom);

    // load any preferences stashed in model info

    if (m.info().VIS) {
        for (key in m.info().VIS) {
            if (m.info().VIS.hasOwnProperty(key)
                    && typeof(m.info().VIS[key] !== 'function')) {
                VIS[key] = m.info().VIS[key];
            }
        }
    }

    // model title
    d3.select("#model_title")
        .text(m.info().title);

    // hashchange handler

    window.onhashchange = function () {
        view_refresh(m, window.location.hash, false);
    };


    // TODO settings controls
    
};

plot_svg = function () {
    if(VIS.svg) {
        return VIS.svg;
    }

    // mbostock margin convention
    // http://bl.ocks.org/mbostock/3019563
    VIS.svg = d3.select("div#topic_plot")
        .append("svg")
            .attr("width", VIS.plot.w + VIS.plot.m.left + VIS.plot.m.right)
            .attr("height", VIS.plot.h + VIS.plot.m.top + VIS.plot.m.bottom)
        // g element passes on xform to all contained elements
        .append("g")
            .attr("transform",
                  "translate(" + VIS.plot.m.left + "," + VIS.plot.m.top + ")");

    return VIS.svg;
};

var load_data = function (target, callback) {
    var target_stem = target.replace(/\..*$/, ""),
        target_id;

    if (VIS.loaded[target_stem]) {
        return callback(undefined, undefined);
    }
    
    // preprocessed data available in DOM?
    target_id = "m__DATA__" + target_stem;
    if (document.getElementById(target_id)) {
        VIS.loaded[target] = true;
        return callback(undefined,
                document.getElementById(target_id).innerHTML);
    }
    
    // otherwise, we have to fetch it, and possibly unzip it
    // TODO zipping...
    return d3.text("data/" + target, function (error, s) {
        VIS.loaded[target] = true;
        return callback(error, s);
    });
};


// main
// ----

main = function () {
    load_data("info.json",function (error, info_s) {
        // callback, invoked when ready 
        var m = model({ info: JSON.parse(info_s) });
        setup_vis(m);

        // now launch remaining data loading; ask for a refresh when done
        load_data("meta.csv", function (error, meta_s) {
            m.set_meta(meta_s);
            view_refresh(m, window.location.hash);
        });
        load_data("dt.json", function (error, dt_s) {
            m.set_dt(dt_s);
            view_refresh(m, window.location.hash);
        });
        load_data("tw.json", function (error, tw_s) {
            m.set_tw(tw_s);
            view_refresh(m, window.location.hash);
        });

        view_refresh(m, window.location.hash);
    });
};

// execution

main();

