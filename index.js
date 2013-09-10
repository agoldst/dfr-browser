/*global d3, queue */

/* declaration of global object (initialized in setup_vis) */
var VIS;

/* declaration of functions */

var model,          // model specification
    top_words,      // rankers and sorters
    word_topics,
    top_docs,
    doc_topics,
    bib_sort,
    topic_label,    // stringifiers
    topic_link,
    cite_doc,
    doc_uri,
    topic_view,     // view generation
    word_view,
    doc_view,
    bib_view,
    about_view,
    model_view,
    view_refresh,
    setup_vis,      // initialization
    read_files,
    main;           // main program

// model specification
// -------------------

model = function () {
    return {
        tw: [],     // array of d3.map()s
        dt: [],     // docs in rows, topic counts in columns
        alpha: [],  // alpha value for topics
        meta: [],   // document citations
        n: 0,
        n_top_words: 0
    };
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

bib_sort = function (m) {
    var result = {
            headings: [],
            docs: []
        },
        docs = d3.range(m.meta.length),
        dec,
        i,
        last,
        cur_dec,
        partition = [];

    // TODO other sorting / sectioning than date / decade

    docs = docs.sort(function (a, b) {
        return d3.ascending(+m.meta[a].date, +m.meta[b].date);
    });

    for (i = 0; i < docs.length; i += 1) {
        dec = Math.floor(m.meta[docs[i]].date.getFullYear() / 10);
        if (dec !== cur_dec) {
            partition.push(i);
            result.headings.push(dec.toString() + "0s");
            cur_dec = dec;
        }
    }
    partition.shift(); // correct for "0" always getting added at the start
    partition.push(docs.length); // make sure we get the tail 

    for (i = 0, last = 0; i < partition.length; i += 1) {
        result.docs.push(docs.slice(last, partition[i]));
        last = partition[i];
    }

    return result;
};

// -- stringifiers
//    ------------

topic_label = function (m, t, n) {
    var label;

    label = d3.format("03d")(t + 1); // user-facing index is 1-based
    label += " ";
    label += top_words(m, t, n).join(" ");
    return label;
};

topic_link = function(t) {
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

    // Could do "proper" date formatting via d3.time.format() instead
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
    var view, as, docs;

    console.log("View for topic " + (t + 1));
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


    as = view.select("div#topic_words")
        .selectAll("a")
        .data(top_words(m, t, m.n_top_words));

    as.enter()
        .append("a");

    as.exit().remove();

    as
        .attr("href", function (w) {
            return "#/word/" + w;
        })
        .text(function (w) {
            return m.tw[t].get(w) + " " + w;
        });


    // get top articles
    // ----------------

    docs = top_docs(m, t, VIS.topic_view_docs);

    as = view.select("div#topic_docs")
        .selectAll("a")
        .data(docs);

    as.enter()
        .append("a");

    as.exit().remove();

    as
        .attr("href", function (d) {
            return "#/doc/" + d;
        })
        .html(function (d) {
            var weight, frac;

            weight = m.dt[d][t];
            frac = weight / m.doc_len[d];
            return weight.toString() + " ("
                + VIS.float_format(frac) + ") "
                + cite_doc(m, d);
        });


    return true;
    // TODO visualize word and doc weights as lengths
    // (later: time graph)
    // (later: nearby topics by J-S div or cor on log probs)
};

word_view = function (m, word) {
    var view, as, topics;

    console.log("View for word " + word);

    view = d3.select("div#word_view");

    view.select("h2")
        .text(word);

    topics = word_topics(m, word);
    topics = topics.sort(function (a, b) {
        return d3.ascending(a[1], b[1]);
    });
    as = view.selectAll("a")
        .data(topics);

    as.enter().append("a");
    as.exit().remove();

    as
        .text(function (d) {
            return "Ranked " + (d[1] + 1) // user-facing rank is 1-based
                + " in " + topic_label(m, d[0], VIS.overview_words);
        })
        .attr("href", function (d) {
            return topic_link(d[0]);
        });

    return true;
    // (later: time graph)
};

doc_view = function (m, doc) {
    var view, as;

    console.log("View for doc " + doc);

    if(doc < 0 || doc >= m.dt.length) {
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

    as = view.select("div#doc_topics")
        .selectAll("a")
        .data(doc_topics(m, doc, VIS.doc_view_topics));

    as.enter().append("a");
    as.exit().remove();
    as
        .attr("href",topic_link)
        .text(function (t) {
            var label, score;
            score = m.dt[doc][t];
            label = score.toString();
            label += " (" + VIS.float_format(score / m.doc_len[doc]) + ") ";
            label += topic_label(m, t, VIS.overview_words);
            return label;
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
        ordering = bib_sort(m);

        nav_as = view.select("nav")
            .selectAll("a")
            .data(ordering.headings);

        nav_as.enter().append("a");
        nav_as.exit().remove();

        // TODO fix page-jumping #links
        /*
        nav_as
            .attr("href", function (h) { return "#" + h; })
            .text(function (h) { return h; });
        */
        nav_as
            .attr("href", "#/bib")
            .text(function (h) { return h; });

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
            .attr("href", function(d) {
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
    var as;

    console.log("Overview");

    if (!VIS.model_view_ready) {

        as = d3.select("div#overview_topic_list")
            .selectAll("a")
            .data(d3.range(m.n));

        as.enter().append("a");

        as.exit().remove();

        as.text(function (t) {
            var label;

            label = topic_label(m, t, VIS.overview_words);
            label += " (α = " + VIS.float_format(m.alpha[t]) + ")";
            return label;
        });

        as.attr("href",topic_link);

        VIS.model_view_ready = true;
    }

    return true;

    // TODO visualize alphas
    // (later: word clouds)
    // (later: grid of time graphs)
    // (later: multi-dimensional scaling projection showing topic clusters)
};

view_refresh = function (m,v) {
    var view_parsed, param, success;

    view_parsed = v.split("/");
    param = view_parsed[2];

    if(VIS.cur_view !== undefined) {
        VIS.cur_view.classed("hidden",true);
    }

    switch(view_parsed[1]) {
        case undefined:
            view_parsed[1] = "model";
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
            param = +param - 1;
            success = topic_view(m,param);
            break;
        case "word":
            success = word_view(m,param);
            break;
        case "doc":
            param = +param;
            success = doc_view(m,param);
            break; 
        default:
            success = false;
            break; 
    };

    if(success) {
        VIS.cur_view = d3.select("div#" + view_parsed[1] + "_view");
    }
    else {
        if(VIS.cur_view === undefined) {
            // fall back on model_view
            VIS.cur_view = d3.select("div#model_view");
            model_view(m);
        }
    }


    VIS.cur_view.classed("hidden",false);
};


// initialization
// --------------

setup_vis = function (m) {
    // set visualization parameters on the global object VIS
    VIS = {
        model_view_ready: false,
        bib_ready: false,
        overview_words: 15,     // TODO set these parameters interactively
        topic_view_words: 50,
        topic_view_docs: 20,
        doc_view_topics: 10,
        float_format: function (x) {
            return d3.round(x, 3);
        },
        cite_date_format: d3.time.format("%B %Y"),
        uri_proxy: ".proxy.libraries.rutgers.edu",
        topic_scale: undefined // color scale
    };

    // hashchange handler

    window.onhashchange = function () {
        view_refresh(m,window.location.hash);
    };
    
    // load model information and stick it in page header elements

    d3.select("#model_title")
        .text(m.model_meta.title);
    d3.select("div#meta_info")
        .html(m.model_meta.meta_info);

    // scales

    VIS.topic_scale = d3.scale.ordinal()
        .domain(d3.range(m.n))
        .range(d3.range(m.n).map(function (t) {
            return d3.hsl(360 * t / m.n, 0.5, 0.8).toString();
        }));

};

read_files = function (ready) {
    var m, process_keys, access_meta, process_files;

    // initialize model object
    m = model();

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
        view_refresh(m,window.location.hash);
    });
};

// execution

main();

