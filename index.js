/*global d3, queue */

/* declaration of global object (initialized in setup_vis) */
var VIS;

/* declaration of functions */

var model,          // model specification
    top_words,      // rankers and sorters
    word_topics,
    top_docs,
    doc_topics,
    doc_sort_key,
    bib_sort,
    yearly_range,
    topic_yearly,
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
    stringify_model_view,
    view_refresh,
    setup_vis,      // initialization
    plot_svg,
    read_files,
    main;           // main program

// model specification
// -------------------

model = function () {
    var result = {
        tw: [],     // array of d3.map()s
        dt: [],     // docs in rows, topic counts in columns
        alpha: [],  // alpha value for topics
        meta: [],   // document citations
        n: 0,
        n_top_words: 0,
        preprocessed: false
    };

    return result;
};


// utility functions
// -----------------

// -- rankers
//    -------

top_words = function (m, t, n) {
    var w;
    w = m.tw[t].keys().sort(function (j, k) {
        return d3.descending(m.tw[t].get(j), m.tw[t].get(k));
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

    for (t = 0; t < m.n; t += 1) {
        row = m.tw[t];
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
        return m.dt[d][t] / m.doc_len[d];
    };
    // initial guess
    docs = d3.range(n);
    wts = docs.map(weight);
    docs.sort(function (a, b) {
        return d3.ascending(wts[a], wts[b]);
    });
    wts = docs.map(function (d) { return wts[d]; });

    for (i = n; i < m.dt.length; i += 1) {
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
    return d3.range(m.n)
        .sort(function (a, b) {
            return d3.descending(m.dt[d][a], m.dt[d][b]);
        })
        .slice(0, n);
};

doc_sort_key = function (m, i) {
    if (m.meta[i].authors.length > 0) {
        names = m.meta[i].authors[0].split(" ");
        return names[names.length - 1][0].toUpperCase(); // N.B. casefolding
    } else {
        return "[Anon]";
    }
};

bib_sort = function (m,major,minor) {
    var result = {
            headings: [],
            docs: []
        },
        docs = d3.range(m.meta.length),
        major_sort, major_split, minor_sort,
        major, cur_major,
        i, last,
        partition = [];

    if (major === "decade") {
        major_split = function (i) {
            return Math.floor(m.meta[i].date.getFullYear() / 10).toString() +
                "0s";
        };

        major_sort = function (a, b) {
            return d3.ascending(+m.meta[a].date, +m.meta[b].date);
        };
    } else if (major === "year") {
        major_split = function (i) {
            return m.meta[i].date.getFullYear();
        };

        major_sort = function (a, b) {
            return d3.ascending(+m.meta[a].date, +m.meta[b].date);
        };
    } else {
        if (major !== "alpha") {
            console.log("Unknown bib_sort: " + major + "; defaulting to alpha")
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
            return d3.ascending(+m.meta[a].date, +m.meta[b].date);
        };
    } else  {
        if (minor !== "alpha") {
            console.log("Unknown bib_sort: " + minor + "; defaulting to alpha")
        }
        // alphabetical
        minor_sort = function (a, b) {
            return d3.ascending(doc_sort_key(m, a), doc_sort_key(m, b));
        };
    }

    docs = docs.sort(major_sort);
    for (i = 0; i < docs.length; i += 1) {
        major = major_split(docs[i]);
        if (major !== cur_major) {
            partition.push(i);
            result.headings.push(major);
            cur_major = major;
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

yearly_range = function (m) {
    var result;

    // TODO factor out memoization

    // memoize using VIS to store result
    if (VIS.yearly_range !== undefined) {
        return VIS.yearly_range;
    }

    result = d3.extent(m.meta, function (row) {
        return row.date.getFullYear();
    });

    VIS.yearly_range = result;
    return result;
};

topic_yearly = function (m) {
    var counts, totals, result, i, y, t;

    // memoize using VIS to store result
    if (VIS.topic_yearly !== undefined) {
        return VIS.topic_yearly;
    }

    counts = d3.map();
    totals = d3.map();
    result = d3.map();

    for (i = 0; i < m.dt.length; i += 1) {
        y = m.meta[i].date.getFullYear();
        if (!counts.has(y)) {
            counts.set(y, []);
        }
        if (!totals.has(y)) {
            totals.set(y, 0);
        }

        for (t = 0; t < m.n; t += 1) {
            if(counts.get(y)[t]) {
                counts.get(y)[t] += m.dt[i][t];
            } else {
                counts.get(y)[t] = m.dt[i][t];
            }
            totals.set(y, totals.get(y) + m.dt[i][t]);
        }
    }

    // divide through
    counts.forEach(function (y, wts) {
        result.set(y, wts.map(function (w) {
            return w / totals.get(y);
        }));
    });

    // memoize if this is the first time through
    VIS.topic_yearly = result;
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
    var doc, result;

    doc = m.meta[d];
    result = doc.authors.length > 0
        ? doc.authors.join(" and ")
        : "[Anon]";

    result += ", ";
    result += '"' + doc.title + ',"';
    result += " <em>" + doc.journaltitle + "</em> ";
    result += doc.volume + ", no. " + doc.issue;

    result += " (" + VIS.cite_date_format(doc.date) + "): ";
    result += doc.pagerange;

    result = result.replace(/_/g, ",");
    result = result.replace(/\t/g, "");

    return result;
};

doc_uri = function (m, d) {
    return "http://dx.doi.org"
        + VIS.uri_proxy
        + "/"
        + m.meta[d].doi;
};


// Principal view-generating functions
// -----------------------------------

topic_view = function (m, t) {
    var view, trs_w, trs_d,
        img;

    console.log("View for topic " + (t + 1));

    if (!isFinite(t)) {
        return false;
    }

    if (t < 0 || t > m.n) {
        console.log("Invalid topic t = " + t);
        return false;
    }

    view = d3.select("div#topic_view");

    // get top words and weights
    // -------------------------

    view.select("h2")
        .text(topic_label(m, t, VIS.overview_words));

    view.select("p#topic_remark")
        .text("α = " + VIS.float_format(m.alpha[t]));


    trs_w = view.select("table#topic_words tbody")
        .selectAll("tr")
        .data(top_words(m, t, m.n_top_words));

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
            return m.tw[t].get(w);
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
            return VIS.percent_format(m.dt[d][t] / m.doc_len[d]);
        });

    trs_d
        .append("td")
        .text(function (d) {
            return m.dt[d][t];
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
        plot_topic_yearly(m,t);
    }

    return true;
    // TODO visualize word and doc weights as lengths
    // (later: nearby topics by J-S div or cor on log probs)
};

plot_topic_yearly = function(m, t) {
    var year_seq, series = [],
        w, scale_x, scale_y,
        rects, axis_x, axis_y, 
        svg = plot_svg();

    year_seq = topic_yearly(m).keys().sort();
    series = year_seq.map(function (y) {
            return [new Date(+y,0,1), topic_yearly(m).get(y)[t]];
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
    var view, trs, topics;

    console.log("View for word " + word);
    if (word === undefined) {
        return false;
    }

    view = d3.select("div#word_view");

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

    return true;
    // (later: time graph)
};

doc_view = function (m, doc) {
    var view, trs;

    console.log("View for doc " + doc);

    if (!isFinite(doc)) {
        return false;
    }

    if (doc < 0 || doc >= m.dt.length) {
        console.log("Invalid doc id: " + doc);
        return false;
    }

    view = d3.select("div#doc_view");

    view.select("#doc_view h2")
        .html(cite_doc(m, doc));

    view.select("p#doc_remark")
        .html(m.doc_len[doc] + " tokens. "
                + '<a class ="external" href="'
                + doc_uri(m, doc)
                + '">View '
                + m.meta[doc].doi
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
            return m.dt[doc][t];
        });
    trs.append("td")
        .text(function (t) {
            return VIS.percent_format(m.dt[doc][t] / m.doc_len[doc]);
        });

    return true;
    // TODO visualize topic proportions as rectangles at the very least

    // (later: nearby documents)
};

bib_view = function (m) {
    var ordering, view, nav_as, sections, headings, as;

    console.log("Bibliography view");

    view = d3.select("div#bib_view");

    if (!VIS.bib_ready) {
        ordering = bib_sort(m, VIS.bib_sort.major, VIS.bib_sort.minor);

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

        VIS.bib_ready = true;
    }

    // ready
    return true;
};

about_view = function (m) {
    return true;
};


model_view = function (m) {
    var trs;

    console.log("Overview");

    if (!VIS.model_view_ready) {

        trs = d3.select("table#model_topics tbody")
            .selectAll("tr")
            .data(d3.range(m.n));

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
                return VIS.float_format(m.alpha[t]);
            });

        VIS.model_view_ready = true;
    }

    return true;

    // TODO visualize alphas
    // (later: word clouds)
    // (later: grid of time graphs)
    // (later: multi-dimensional scaling projection showing topic clusters)
};

stringify_model_view = function (m) {
    var m_out = m;

    m_out.preprocessed = true;

    // a very wasteful { "key": blargh, "value": blargh } format
    m_out.tw = m.tw.map(function (x) { return x.entries(); });

    d3.selectAll("body div").remove();
    d3.select("body")
        .append("textarea")
        .text(JSON.stringify(m_out));

    return true;
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
        case "stringify_model":
            // special case for this kludgepage. Doesn't change the cur_view
            success = stringify_model_view(m);
            return;
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

    VIS.cur_view.classed("hidden", false);
};


// initialization
// --------------

setup_vis = function (m) {
    // set visualization parameters on the global object VIS
    VIS = {
        model_view_ready: false,
        bib_ready: false,
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

    // preferences stashed in model_meta

    if (m.model_meta.VIS) {
        for (key in m.model_meta.VIS) {
            if (m.model_meta.VIS.hasOwnProperty(key)
                    && typeof(m.model_meta.VIS[key] !== 'function')) {
                VIS[key] = m.model_meta.VIS[key];
            }
        }
    }

    // hashchange handler

    window.onhashchange = function () {
        view_refresh(m, window.location.hash);
    };

    // load model information and stick it in page header elements

    d3.select("#model_title")
        .text(m.model_meta.title);
    d3.select("div#meta_info")
        .html(m.model_meta.meta_info);

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

read_files = function (ready) {
    var m, process_keys, access_meta, process_files;

    // initialize model object
    m = model();

    // look for preprocessed data...
    if (document.getElementById("m__DATA__")) {
        m = JSON.parse(document.getElementById("m__DATA__").innerHTML);

        // reconstruct d3.map()s 
        m.tw = m.tw.map(function (entries) {
            var result = d3.map();
            entries.map(function (kv) {
                result.set(kv.key, kv.value);
            });
            return result;
        });

        // reconstruct Date fields
        m.meta = m.meta.map(function (row) {
            var result = row;
            result.date = new Date(row.date);
            return result;
        });
        ready(m);
        return;
    }

    // ...otherwise, load from files:

    // This "accessor" eats up the rows of keys.csv and returns nothing.
    // It loads the topic-words (but only N most probable) as d3.maps()s
    process_keys = function (d) {
        var t;

        t = +d.topic - 1;   // topics indexed from 1 in keys.csv

        if (!m.tw[t]) {
            m.tw[t] = d3.map();
        }
        m.tw[t].set(d.word, +d.weight);
        // TODO should precalculate ranks here...? or save memory?

        // read topic alpha value

        if (m.alpha[t] === undefined) {
            m.alpha[t] = parseFloat(d.alpha);
        }
    };

    access_meta = function (d) {
        //id,doi,title,author,journaltitle,volume,issue,
        //pubdate,pagerange,publisher,type,reviewed-work
        var a_str = d.author.trim(),
            date = new Date(d.pubdate.trim());

        return {
            authors: a_str === "" ? [] : a_str.split("\t"),
            title: d.title.trim(),
            journaltitle: d.journaltitle.trim(),
            volume: d.volume.trim(),
            issue: d.issue.trim(),
            date: date,
            pagerange: d.pagerange.trim()
                .replace(/^p?p\. /, "")
                .replace(/-/g, "–"),
            doi: d.doi.trim()
        };
    };

    // this callback handles the loaded file data
    process_files = function (error,     // file error d3.csv/d3.text
                              m_meta,    // model_meta.json data
                              keys_dummy,// dummy: eaten up by process_keys
                              dt_text,   // dt.csv as a string
                              meta) {    // meta.csv processed into a list

        // explanatory info about the model 
        m.model_meta = m_meta;

        // set topic count
        m.n = m.tw.length;

        // set count of number of top words given
        m.n_top_words = m.tw[0].keys().length;

        console.log("Read keys.csv: " + m.n + " topics");

        m.dt = d3.csv.parseRows(dt_text, function (row, j) {
            return row.map(function (x) { return +x; });
        });

        console.log("Read dt.csv: " + m.dt.length + " docs");

        // precalculate doc lengths
        m.doc_len = m.dt.map(function (d) { return d3.sum(d); });

        m.meta = meta;

        console.log("Read meta.csv: " + meta.length
            + " citations");

        ready(m); // where the program actually starts
    };

    // actually load the files and call the callback
    queue()
        .defer(d3.json, "data/model_meta.json")
        .defer(d3.csv, "data/keys.csv", process_keys)
        .defer(d3.text, "data/dt.csv")
        .defer(d3.csv, "data/meta.csv", access_meta)
        .await(process_files); // process_files calls ready(m) when done
};

// main
// ----

main = function () {
    read_files(function (m) { // callback, invoked when model is loaded in 
        setup_vis(m);
        view_refresh(m, window.location.hash);
    });
};

// execution

main();

