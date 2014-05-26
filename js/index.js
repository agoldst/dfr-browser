/*global d3, $, JSZip, model, utils, dfb, view, window, document */
"use strict";

/* declaration of global object (initialized in setup_vis) */
var VIS = {
    ready: { }, // which viz already generated?
    last: { }, // which subviews last shown?
    view_updating: false, // do we need to redraw the whole view?
    bib_sort: {
        major: "year",
        minor: "alpha"
    },
    overview_words: 15,     // may need adjustment
    model_view: {
        w: 1140,            // px: the bootstrap container width
        aspect: 1.3333,     // for calculating height
        words: 4,           // may need adjustment
        size_range: [7, 18], // points. may need adjustment
        stroke_range: 6,    // max. perimeter thickness
        yearly: {
            w: 1090,
            h: 800,
            m: {
                left: 20,
                right: 20,
                top: 20,
                bottom: 20
            },
            label_threshold: 40 // px
        },
        list: {
            spark: {
                w: 70,
                h: 20,
                m: {
                    left: 2,
                    right: 2,
                    top: 2,
                    bottom: 2
                },
                bar_width: 300
            }
        }
    },
    topic_view: {
        words: 50,
        words_increment: 5,
        docs: 20,           // should be divisible by docs_increment
        docs_increment: 5,
        w: 640, // fixed dimensions; this will need tweaking
        h: 300,
        m: {
            left: 40,
            right: 20,
            top: 20,
            bottom: 20
        },
        bar_width: 90, // in days!
        ticks: 10 // applied to both x and y axes
    },
    word_view: {
        n_min: 10, // words per topic
        topic_label_padding: 8, // pt
        topic_label_size: 14, // pt
        row_height: 80, // pt
        svg_rows: 10, // * row_height gives min. height for svg element
        w: 1000,
        m: {
            left: 100,
            right: 40,
            top: 20,
            bottom: 0
        }
    },
    doc_view: {
        topics: 10,         // should be divisible by...
        topics_increment: 2
    },
    float_format: function (x) {
        return d3.round(x, 3);
    },
    tooltip: {              // tooltip div parameters
        offset: {
            x: 10,          // px
            y: 0
        }
    },
    percent_format: d3.format(".1%"),
    cite_date_format: d3.time.format("%B %Y"),
    uri_proxy: ""
};

/* declaration of functions */

var bib_sort,   // bibliography sorting
    topic_label,        // stringifiers
    topic_link,
    topic_hash,
    doc_author_string,
    cite_doc,
    cite_docs,
    citation,
    render_updown,      // view generation
    topic_view,
    topic_view_words,
    topic_view_docs,
    plot_topic_yearly,
    word_view,
    words_view,
    doc_view,
    bib_view,
    about_view,
    model_view,
    model_view_list,
    model_view_plot,
    model_view_yearly,
    yearly_stacked_series,
    set_view,
    view_refresh,
    setup_vis,          // initialization
    read_files,
    main;               // main program


// utility functions
// -----------------

// bibliography sorting
bib_sort = function (m, major, minor) {
    var result = {
            headings: [],
            docs: []
        },
        docs,
        major_key,
        minor_key,
        cur_major,
        i,
        last,
        get_id = function (d) { return d.id; },
        partition = [];

    if (major === "decade") {
        major_key = function (i) {
            return Math.floor(m.meta(i).date.getFullYear() / 10).toString() +
                "0s";
        };
    } else if (major === "year") {
        major_key = function (i) {
            return m.meta(i).date.getFullYear();
        };
    } else if (major === "journal") {
        major_key = function (i) {
            return m.meta(i).journaltitle;
        };
    } else {
        // default to alphabetical by author
        major_key = function (i) {
            return doc_author_string(m.meta(i)).replace(/^\W*/, "")[0]
                .toUpperCase();
        };
    }

    if (minor === "date") {
        minor_key = function (i) {
            return +m.meta(i).date;
        };
    } else if (minor === "journal") {
        minor_key = function (i) {
            var doc = m.meta(i),
                result_m = doc.journaltitle;

            result_m += d3.format("05d")(doc.volume);
            result_m += d3.format("05d")(doc.issue ? 0
                    : doc.issue.replace(/\/.*$/, ""));
            if (doc.pagerange.search(/^\d/) !== -1) {
                result_m += d3.format("05d")(doc.pagerange.match(/^(\d+)/)[1]);
            } else {
                result_m += doc.pagerange;
            }
            return result_m;
        };
    } else {
        // default to alphabetical by author then title
        minor_key = function (i) {
            return doc_author_string(m.meta(i)) + m.meta(i).title;
        };
    }

    docs = d3.range(m.n_docs())
        .map(function (d) {
            return {
                id: d,
                major: major_key(d),
                minor: minor_key(d)
            };
        })
        .sort(function (a, b) {
            return d3.ascending(a.major, b.major) ||
                d3.ascending(a.minor, b.minor) ||
                d3.ascending(a.id, b.id); // stabilize sort
        });

    for (i = 0, cur_major = ""; i < docs.length; i += 1) {
        if (docs[i].major !== cur_major) {
            partition.push(i);
            result.headings.push(docs[i].major);
            cur_major = docs[i].major;
        }
    }
    partition.shift(); // correct for "0" always getting added at the start
    partition.push(docs.length); // make sure we get the tail 

    for (i = 0, last = 0; i < partition.length; i += 1) {
        result.docs.push(docs.slice(last, partition[i]).map(get_id));
        last = partition[i];
    }

    return result;
};



// -- stringifiers
//    ------------

topic_label = function (m, t, n) {
    return view.topic.label(t, m.topic_words(t, n));
};

topic_link = function (t) {
    return "#" + topic_hash(t);
};

topic_hash = function (t) {
    return "/topic/" + String(t + 1);
};

doc_author_string = function (doc) {
    var lead,
        lead_trail,
        result;

    if (doc.authors.length > 0) {
        lead = doc.authors[0].replace(/,/g, "").split(" ");
        // check for Jr., Sr., 2nd, etc.
        // Can mess up if last name is actually the letter I, X, or V.
        lead_trail = lead.pop();
        if (lead.length >= 2
                && (lead_trail.search(/^(\d|Jr|Sr|[IXV]+$)/) !== -1)) {
            result = lead.pop().replace(/_$/, "");
            lead_trail = ", " + lead_trail.replace(/\W*$/, "");
        } else {
            result = lead_trail;
            lead_trail = "";
        }
        result += ", " + lead.join(" ") + lead_trail;
        if (doc.authors.length > 1) {
            // "et al" is better for real bibliography, but it's
            // actually worth being able to search all the multiple authors
            /*if (doc.authors.length > 3) {
                result += ", " + doc.authors.slice(1, 3).join(", ");
                result += "et al.";
            } else {*/
            if (doc.authors.length > 2) {
                result += ", ";
                result += doc.authors
                    .slice(1, doc.authors.length - 1)
                    .join(", ");
            }
            result += ", and " + doc.authors[doc.authors.length - 1];
        }
    } else {
        result = "[Anon]";
    }

    return result;
};

cite_doc = function (m, d) {
    return citation(m.meta(d));
};

cite_docs = function (m, ds) {
    return m.meta(ds).map(citation);
};

citation = function (doc) {
    var result = doc_author_string(doc);

    // don't duplicate trailing period on middle initial etc.
    result = result.replace(/\.?$/, ". ");
    result += '"' + doc.title + '."';
    result += " <em>" + doc.journaltitle + "</em> ";
    result += doc.volume;
    if (doc.issue) {
        result += ", no. " + doc.issue;
    }

    result += " (" + VIS.cite_date_format(doc.date) + "): ";
    result += doc.pagerange + ".";

    result = result.replace(/\.\./g, ".");
    result = result.replace(/_/g, ",");
    result = result.replace(/\t/g, "");

    return result;
};


// utility for views
// -----------------

// Renders buttons for incrementing and decrementing a counter. The state
// of the counter is stored privately by making it a variable within a closure
// that is immediately evaluated.
render_updown = function (selector, start, min, max, increment, render) {
    return (function () {
        var counter = start;
        if (counter <= min) {
            counter = min;
            d3.select(selector + "_up").classed("disabled", true);
        } else if (counter >= max) {
            counter = max;
            d3.select(selector + "_down").classed("disabled", true);
        }
        d3.select(selector + "_down")
            .on("click", function () {
                counter += increment;
                if (counter > max) {
                    counter = Math.ceil(max / increment) * increment;
                    d3.select(this).classed("disabled", true);
                }
                d3.select(selector + "_up").classed("disabled", false);
                render(counter);
            });

        d3.select(selector + "_up")
            .on("click", function () {
                counter -= increment;
                if (counter < min) {
                    counter = increment;
                    d3.select(this).classed("disabled", true);
                }
                d3.select(selector + "_down").classed("disabled", false);
                render(counter);
            });

        render(counter);
    }());
};

// Principal view-generating functions
// -----------------------------------

topic_view = function (m, t, year) {
    var words;

    if (!m.meta() || !m.dt() || !m.tw()) {
        // not ready yet; show loading message
        view.loading(true);
        return true;
    }

    // TODO don't need anything but tw to show topic words h2 and div; so can 
    // have div-specific loading messages instead

    // if the topic is missing or unspecified, show the help
    if (!isFinite(t) || t < 0 || t >= m.n()) {
        d3.select("#topic_view_help").classed("hidden", false);
        d3.select("#topic_view_main").classed("hidden", true);
        view.loading(false);
        return true;
    }

    words = m.topic_words(t);

    view.topic({
        t: t,
        year: year,
        words: words,
        alpha: m.alpha(t),
        col_sum: m.dt().col_sum(t),
        total_tokens: m.total_tokens()
    });

    view.topic.words(utils.shorten(words, VIS.topic_view.words));

    m.topic_yearly(t, function (yearly) {
        view.topic.yearly({
            t: t,
            year: year,
            yearly: yearly
        });
    });

    view.calculating("#topic_docs", true); 
    m.topic_docs(t, VIS.topic_view.docs, year, function (docs) {
        view.calculating("#topic_docs", false);
        view.topic.docs({
            t: t,
            docs: docs,
            citations: cite_docs(m, docs.map(function (d) { return d.doc; })),
            year: year
        });
    });

    view.loading(false);
    return true;
    // (later: nearby topics by J-S div or cor on log probs)
};






word_view = function (m, w) {
    var div = d3.select("div#word_view"),
        word = w,
        topics, n,
        words = [],
        spec, row_height,
        svg, scale_x, scale_y, scale_bar,
        gs_t, gs_t_enter, gs_w, gs_w_enter,
        tx_w;

    if (!m.tw()) {
        view.loading(true);
        return true;
    }
    view.loading(false);

    // word form setup
    d3.select("form#word_view_form")
        .on("submit", function () {
            d3.event.preventDefault();
            var input_word = d3.select("input#word_input")
                .property("value")
                .toLowerCase();
            window.location.hash = "/word/" + input_word;
        });

    if (word) {
        div.select("#word_view_help").classed("hidden", true);
    } else {
        div.select("#word_view_help").classed("hidden", false);
        if (VIS.last.word) {
            word = VIS.last.word; // fall back to last word if available
            div.select("a#last_word")
                .attr("href", "#/word/" + word)
                .text(document.URL.replace(/#.*$/, "") + "#/word/" + word);
            div.select("#last_word_help").classed("hidden", false);
        } else {
            div.select("#word_view_main").classed("hidden", true);
            return true;
        }
    }
    div.select("#word_view_main").classed("hidden", false);

    VIS.last.word = word;
    div.selectAll("#word_view span.word") // sets header and help
        .text(word);

    topics = m.word_topics(word);

    div.select("#word_no_topics").classed("hidden", topics.length !== 0);
    div.select("table#word_topics").classed("hidden", topics.length === 0);
    div.select("#word_view_explainer").classed("hidden", topics.length === 0);

    n = 1 + d3.max(topics, function (t) {
        return t.rank; // 0-based, so we rank + 1 
    });
    // now figure out how many words per row, taking account of possible ties
    n = d3.max(topics, function (t) {
        return m.topic_words(t.topic, n).length;
    });
    // but not too few words
    n = Math.max(VIS.word_view.n_min, n);

    words = topics.map(function (t) {
        var max_weight,
            ws = m.topic_words(t.topic).slice(0, n);
        return ws.map(function (tw, i) {
            if (i === 0) {
                max_weight = tw.weight;
            }
            // normalize weights relative to the weight of the word ranked 1
            return {
                word: tw.word,
                weight: tw.weight / max_weight
            };
        });
    });

    spec = {
        w: VIS.word_view.w,
        h: VIS.word_view.row_height * (m.n() + 1),
        m: VIS.word_view.m
    };

    row_height = VIS.word_view.row_height;
    svg = view.plot_svg("#word_view_main", spec);
    // adjust svg height so that scroll bar isn't too long
    // and svg isn't so short it clips things weirdly
    d3.select("#word_view_main svg")
        .attr("height", VIS.word_view.row_height
            * (Math.max(topics.length, VIS.word_view.svg_rows) + 1)
            + spec.m.top + spec.m.bottom);

    scale_x = d3.scale.linear()
        .domain([0, n])
        .range([0, spec.w]);
    scale_y = d3.scale.linear()
        .domain([0, Math.max(1, topics.length - 1)])
        .range([row_height, row_height * topics.length]);
    scale_bar = d3.scale.linear()
        .domain([0, 1])
        .range([0, row_height / 2]);

    gs_t = svg.selectAll("g.topic")
        .data(topics, function (t) { return t.topic; } );

    // transition: update only
    gs_t.transition().duration(1000)
        .attr("transform", function (t, i) {
            return "translate(0," + scale_y(i) + ")";
        });

    gs_t_enter = gs_t.enter().append("g").classed("topic", true)
        .attr("transform", function (t, i) {
            return "translate(0," + scale_y(i) + ")";
        })
        .style("opacity", 0);

    // TODO refine transition timings

    if (!VIS.ready.word) {
        // if this is the first loading, don't leave the user with a totally
        // blank display for any time at all
        d3.selectAll("g.topic").style("opacity", 1);
        VIS.ready.word = true;
    } else {
        d3.transition().duration(1000)
            .ease("linear")
            .each("end", function () {
                d3.selectAll("g.topic").style("opacity", 1);
            });
    }
    
    // and move exit rows out of the way
    gs_t.exit().transition()
        .duration(2000)
        .attr("transform", "translate(0," +
                row_height * (n + gs_t.exit().size()) + ")")
        .remove();

    gs_t_enter.append("rect")
        .classed("interact", true)
        .attr({
            x: -spec.m.left,
            y: -row_height,
            width: spec.m.left,
            height: row_height
        })
        .on("click", function (t) {
            window.location.hash = topic_hash(t.topic);
        });
                
    gs_t_enter.append("text")
        .classed("topic", true)
        .attr({
            x: -VIS.word_view.topic_label_padding,
            y: -(row_height - VIS.word_view.topic_label_size) / 2
        })
        .text(function (t) {
            return "Topic " + (t.topic + 1);
        })
        .style("font-size", VIS.word_view.topic_label_size + "pt");

    gs_w = gs_t.selectAll("g.word")
        .data(function (t, i) { return words[i]; },
                function (d) { return d.word; });

    gs_w_enter = gs_w.enter().append("g").classed("word", true);

    gs_w_enter.append("text")
        .attr("transform", "rotate(-45)");

    gs_w_enter.append("rect")
        .classed("proportion", true)
        .attr({ x: 0, y: 0 });

    gs_w.selectAll("text")
        .text(function (d) { return d.word; });

    gs_w.selectAll("text, rect")
        .on("click", function (d) {
            window.location.hash = "/word/" + d.word;
        })
        .on("mouseover", function () {
            d3.select(this.parentNode).classed("hover", true);
        })
        .on("mouseout", function () {
            d3.select(this.parentNode).classed("hover", false);
        });

    gs_w.classed("selected_word", function (d) {
        return d.word === word;
    });

    gs_w_enter.attr("transform", function (d, j) {
        return "translate(" + scale_x(j) + ",-" + row_height / 2 + ")";
    })
        .attr("opacity", 0);

    // update g positions for word/bars
    tx_w = gs_w.transition()
        //.delay(1000)
        .duration(2000)
        .attr("transform", function (d, j) {
            return "translate(" + scale_x(j) + ",-" + row_height / 2 + ")";
        })
        .attr("opacity", 1)
        .each("end", function () {
            d3.select(this).classed("update_row", false);
        });

    // update word label positions
    tx_w.selectAll("text").attr("x", spec.w / (4 * n));

    // update bar widths
    tx_w.selectAll("rect")
        .attr("width", spec.w / (2 * n))
        .attr("height", function (d) {
            return scale_bar(d.weight);
        });
    // and move exit words out of the way
    gs_w.exit().transition().delay(1000).remove();

    return true;
    // (later: time graph)
};

words_view = function (m) {
    if (!m.tw()) {
        view.loading(true);
        return true;
    }
    view.loading(false);

    d3.select("ul#vocab_list").selectAll("li")
        .data(m.vocab())
        .enter().append("li")
        .append("a")
        .text(function (w) { return w; })
        .attr("href", function (w) {
            return "#/word/" + w;
        });

    return true;
};


doc_view = function (m, d) {
    var div = d3.select("div#doc_view"),
        doc = d;

    if (!m.meta() || !m.dt() || !m.tw()) {
        view.loading(true);
        return true;
    }

    view.loading(false);

    if (!isFinite(doc) || doc < 0 || doc >= m.n_docs()) {
        d3.select("#doc_view_help").classed("hidden", false);

        // if doc is un- or misspecified and there is no last doc, bail
        if (VIS.last.doc === undefined) {
            d3.select("#doc_view_main").classed("hidden", true);
            return true;
        }

        // otherwise, fall back to last doc if none entered
        doc = VIS.last.doc;
        div.select("a#last_doc")
            .attr("href", "#/doc/" + doc)
            .text(document.URL.replace(/#.*$/, "") + "#/doc/" + doc);
        div.select("#last_doc_help").classed("hidden", false);
    } else {
        d3.select("#doc_view_help").classed("hidden", true);
        VIS.last.doc = doc;
    }
    d3.select("#doc_view_main").classed("hidden", false);

    view.calculating("#doc_view", true);
    m.doc_topics(doc, m.n(), function (topics) {
        view.calculating("#doc_view", false);
        view.doc({
            topics: topics,
            meta: m.meta(doc),
            total_tokens: d3.sum(topics, function (t) { return t.weight; }),
            words: topics.map(function (t) {
                return m.topic_words(t.topic, VIS.overview_words);
            })
        });
    });

    return true;

    // TODO nearby documents list
};

bib_view = function (m, maj, min) {
    var div = d3.select("div#bib_view"),
        major = maj,
        minor = min,
        ordering,
        sections,
        panels,
        as;

    if (major === undefined) {
        major = VIS.bib_sort.major;
    }
    if (minor === undefined) {
        minor = VIS.bib_sort.minor;
    }

    if (VIS.last.bib) {
        if (VIS.last.bib.major === major && VIS.last.bib.minor === minor) {
            return true;
        }
    }

    if (!m.meta()) {
        view.loading(true);
        return true;
    }

    VIS.last.bib = {
        major: major,
        minor: minor
    };

    // set up sort order menu
    d3.select("select#select_bib_sort option")
        .each(function () {
            this.selected = (this.value === major + "_" + minor);
        });
    d3.select("select#select_bib_sort")
        .on("change", function () {
            var sorting;
            d3.selectAll("#select_bib_sort option").each(function () {
                if (this.selected) {
                    sorting = this.value;
                }
            });
            window.location.hash = "/bib/" + sorting.replace(/_/, "/");
        });

    // set up rest of toolbar
    d3.select("button#bib_collapse_all")
        .on("click", function () {
            $(".panel-collapse").collapse("hide");
        });
    d3.select("button#bib_expand_all")
        .on("click", function () {
            $(".panel-collapse").collapse("show");
        });
    d3.select("button#bib_sort_dir")
        .on("click", (function () {
            var descend = true;
            return function () {
                d3.selectAll("div#bib_main div.panel-default")
                    .sort(descend ? d3.descending : d3.ascending)
                    .order(); // stable because bound data is just indices
                descend = !descend;
            };
        }())); // up/down state is preserved in the closure

    ordering = bib_sort(m, major, minor);

    // clear listings
    div.selectAll("div#bib_main > div.panel").remove();

    sections = div.select("div#bib_main")
        .selectAll("div")
        .data(d3.range(ordering.headings.length));

    panels = sections.enter().append("div")
        .classed("panel", true)
        .classed("panel-default", true);

    panels.append("div")
        .classed("panel-heading", true)
        .on("click", function (i) {
            $("#" + ordering.headings[i]).collapse("toggle");
        })
        .on("mouseover", function () {
            d3.select(this).classed("panel_heading_hover", true);
        })
        .on("mouseout", function () {
            d3.select(this).classed("panel_heading_hover", false);
        })
        .append("h2")
            .classed("panel-title", true)
            .html(function (i) {
                var a = '<a class="accordion-toggle"';
                a += ' data-toggle="collapse"';
                a += ' href="#' + ordering.headings[i] + '">';
                a += ordering.headings[i];
                a += '</a>';
                return a;
            });

    as = panels.append("div")
        .classed("panel-collapse", true)
        .classed("collapse", true)
        .classed("in", true)
        .attr("id", function (i) { return ordering.headings[i]; }) 
        .append("div")
            .classed("panel-body", true)
            .classed("bib_section", true)
            .selectAll("a")
                .data(function (i) {
                    return ordering.docs[i];
                });

    as.enter().append("a");
    as.exit().remove();

    as
        .attr("href", function (d) {
            return "#/doc/" + d;
        })
        .html(function (d) {
            return cite_doc(m, d);
        });

    VIS.ready.bib = true;

    view.loading(false);

    // TODO smooth sliding-in / -out appearance of navbar would be nicer

    return true;

};

about_view = function (m) {
    view.about(m.info().meta_info);
    view.loading(false);
    d3.select("#about_view").classed("hidden", false);
    return true;
};

model_view = function (m, type, p1, p2) {
    var type_chosen = type || VIS.last.model || "grid";

    // if loading scaled coordinates failed,
    // we expect m.topic_scaled() to be defined but empty, so we'll pass this,
    // but fall through to choosing the grid below
    if (!m.tw() || !m.topic_scaled()) {
        view.loading(true);
        return true;
    }

    // ensure pill highlighting
    d3.selectAll("#nav_model li.active").classed("active",false);
    d3.select("#nav_model_" + type_chosen).classed("active",true);

    // hide all subviews and controls; we'll reveal the chosen one
    d3.select("#model_view_plot").classed("hidden", true);
    d3.select("#model_view_list").classed("hidden", true);
    d3.select("#model_view_yearly").classed("hidden", true);
    d3.selectAll(".model_view_plot").classed("hidden", true);
    d3.selectAll(".model_view_list").classed("hidden", true);
    d3.selectAll(".model_view_yearly").classed("hidden", true);

    if (type_chosen === "list") {
        if (!m.meta() || !m.dt()) {
            view.loading(true);
            return true;
        }

        model_view_list(m, p1, p2);
        d3.selectAll(".model_view_list").classed("hidden", false);
        d3.select("#model_view_list").classed("hidden", false);
    } else if (type_chosen === "yearly") {
        if (!m.meta() || !m.dt()) {
            view.loading(true);
            return true;
        }

        model_view_yearly(m, p1);
        d3.selectAll(".model_view_yearly").classed("hidden", false);
        d3.select("#model_view_yearly").classed("hidden", false);
    } else { // default to grid
        // if loading scaled coordinates failed,
        // we expect m.topic_scaled() to be defined but empty
        if (!m.topic_scaled() || !m.dt()) {
            view.loading(true);
            return true;
        }

        if (type_chosen === "scaled" && m.topic_scaled().length !== m.n()) {
            // default to grid if there are no scaled coords to be found
            type_chosen = "grid";
        }
        model_view_plot(m, type_chosen);
        d3.selectAll(".model_view_plot").classed("hidden", false);
        d3.select("#model_view_plot").classed("hidden", false);
    }
    VIS.last.model = type_chosen;

    view.loading(false);
    return true;
};

model_view_list = function (m, sort, dir) {
    view.calculating("#model_view_list", true);

    m.topic_total(undefined, function (sums) {
        m.topic_yearly(undefined, function (yearly) {
            view.calculating("#model_view_list", false);
            view.model.list({
                yearly: yearly,
                sums: sums,
                words: m.topic_words(undefined, VIS.overview_words),
                sort: sort,
                dir: dir
            });
        });
    });

    return true;
};

model_view_plot = function (m, type) {
    m.topic_total(undefined, function (totals) {
        view.model.plot({
            type: type,
            words: m.topic_words(undefined, VIS.model_view.words),
            scaled: m.topic_scaled(),
            topic_totals: totals
        });
    });

    return true;
};

model_view_yearly = function (m, type) {
    var spec = VIS.model_view.yearly, svg,
        scale_x, scale_y, axis_x, area,
        scale_color,
        raw,
        to_plot,
        paths, labels, render_labels,
        areas, zoom;

    svg = view.plot_svg("#model_view_yearly", spec);

    raw = type ? (type === "raw") : VIS.last.model_yearly;
    VIS.last.model_yearly = raw;

    to_plot = yearly_stacked_series(m, raw);

    if (!VIS.ready.model_yearly) {
        svg.append("rect")
            .attr("width", spec.w)
            .attr("height", spec.h)
            .classed("bg", true);

        svg.append("clipPath").attr("id", "clip")
            .append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", spec.w)
            .attr("height", spec.h);

        VIS.ready.model_yearly = true;
    } // if (!VIS.ready.model_yearly)

    // scales
    // ------

    // color: a visual cue to distinguish topics. // Unfortunately,
    // 20 colors is as far as any sane person would go, so we'll just
    // stupidly repeat colors at intervals of 20. We can at least
    // make sure repeated colors aren't adjacent.
    // TODO make better (shape, pattern?)
    scale_color = (function () {
        var cat20 = d3.scale.category20(),
            seq = [ ];
            to_plot.order.forEach(function (k, r) { seq[k] = r; });
        return function (t, highlight) {
            var c = cat20(seq[t] % 20);
            return highlight ? d3.hsl(c).brighter(0.5).toString() : c;
        };
    }());

    scale_x = d3.time.scale()
        .domain(to_plot.domain_x)
        .range([0, spec.w]);

    scale_y = d3.scale.linear()
        .domain(to_plot.domain_y)
        .range([spec.h, 0])
        .nice();

    // clear axes
    svg.selectAll("g.axis").remove();

    // x axis (no y axis: streamgraph makes it meaningless)
    axis_x = d3.svg.axis()
        .scale(scale_x)
        .orient("bottom");

    svg.append("g")
        .classed("axis", true)
        .classed("x", true)
        .attr("transform", "translate(0," + spec.h + ")")
        .call(axis_x);

    paths = svg.selectAll("path.topic_area")
        .data(to_plot.data);

    paths.enter()
        .append("path")
        .classed("topic_area", true)
        .attr("clip-path", "url(#clip)")
        .style("fill", function (d) {
            return scale_color(d.t);
        })
        .on("mouseover", function (d) {
            d3.select(this).style("fill", scale_color(d.t, true));
            view.tooltip().text(topic_label(m, d.t, 4));
            view.tooltip().update_pos();
            view.tooltip().show();
        })
        .on("mousemove", function (d) {
            view.tooltip().update_pos();
        })
        .on("mouseout", function (d) {
            d3.select(this).style("fill", scale_color(d.t));
            view.tooltip().hide();
        })
        .on("click", function (d) {
            if (!d3.event.shiftKey) {
                window.location.hash = topic_hash(d.t);
            }
        });

    labels = svg.selectAll("text.layer_label")
        .data(to_plot.data);

    labels.enter().append("text")
        .classed("layer_label", true)
        .attr("clip-path", "url(#clip)");

    render_labels = function (sel) {
        var t, i, xs, cur, show = [ ], max = [ ],
            x0 = scale_x.domain()[0],
            x1 = scale_x.domain()[1],
            y0 = scale_y.domain()[0],
            y1 = scale_y.domain()[1],
            b = scale_y(0); // area heights are b - scale_y(y)
        for (t = 0; t < m.n(); t += 1) {
            show[t] = false;
            xs = to_plot.data[t].values;
            for (i = 0, cur = 0; i < xs.length; i += 1) {
                if (xs[i].x >= x0 && xs[i].x <= x1
                        && xs[i].y0 + xs[i].y >= y0
                        && xs[i].y0 + xs[i].y <= y1) {
                    if (xs[i].y > cur
                            && b - scale_y(xs[i].y) >
                            VIS.model_view.yearly.label_threshold) {
                        show[t] = true;
                        max[t] = i;
                        cur = xs[i].y;
                    }
                }
            }
        }

        sel.attr("display", function (d) {
            return show[d.t] ? "inherit" : "none";
        });

        sel.filter(function (d) { return show[d.t]; })
            .attr("x", function (d) {
                return scale_x(d.values[max[d.t]].x);
            })
            .attr("y", function (d) {
                return scale_y(d.values[max[d.t]].y0 +
                    d.values[max[d.t]].y / 2);
            })
            .text(function (d) {
                return topic_label(m, d.t, 2);
            });
    };

    d3.select("div#model_view_yearly").classed("hidden", false);

    area = d3.svg.area()
        .x(function (d) { return scale_x(d.x); })
        .y0(function (d) { return scale_y(d.y0); })
        .y1(function (d) { return scale_y(d.y0 + d.y); });

    // purely geometric smoothing is possible with
    // area.interpolate("basis");
    // or
    // area.interpolate("monotone");
    // These are quite slow.

    areas = function (d) { return area(d.values); };

    // ensure transition for raw/frac swap
    paths.transition()
        .duration(2000)
        .attr("d", areas);

    render_labels(labels.transition().duration(2000));

    // set up zoom
    zoom = d3.behavior.zoom()
        .x(scale_x)
        .y(scale_y)
        .scaleExtent([1, 5])
        .on("zoom", function () {
            if (VIS.zoom_transition) {
                paths.transition()
                    .duration(2000)
                    .attr("d", areas);
                svg.select("g.x.axis").transition()
                    .duration(2000)
                    .call(axis_x);
                render_labels(labels.transition().duration(2000));
                VIS.zoom_transition = false;
            } else {
                paths.attr("d", areas);
                render_labels(labels);
                svg.select("g.x.axis").call(axis_x);
            }
        });

    // zoom reset button
    d3.select("button#reset_zoom")
        .on("click", function () {
            VIS.zoom_transition = true;
            zoom.translate([0, 0])
                .scale(1)
                .event(svg);
        });

    zoom(svg);

    d3.select("button#yearly_raw_toggle")
        .text(raw ? "Show proportions" : "Show counts")
        .on("click", function () {
            window.location.hash = raw ? "/model/yearly/frac"
                : "/model/yearly/raw";
        });

    d3.selectAll("#yearly_choice li").classed("active", false);
    d3.select(raw ? "#nav_model_yearly_raw" : "#nav_model_yearly_frac")
        .classed("active", true);

    return true;
};


yearly_stacked_series = function (m, raw) {
    var year_keys, years, all_series,
        stack, ord,
        data_frac, data_raw,
        stack_domain_y;

    if (!VIS.model_view.yearly.data) {
        VIS.model_view.yearly.data = { };

        year_keys = m.years().sort(); // TODO deprecated
        years = year_keys.map(function (y) {
            return new Date(+y, 0, 1);
        });

        // save x range
        VIS.model_view.yearly.domain_years = d3.extent(years);

        all_series = d3.range(m.n()).map(function (t) {
            var wts = m.topic_yearly(t),
                series = { t: t };
            series.values = year_keys.map(function (yr, j) {
                var result = {
                    yr: yr,
                    x: years[j],
                    y: wts.get(yr) || 0
                };
                return result;
            });
            return series;
        });

        stack = d3.layout.stack()
            .values(function (d) {
                return d.values;
            })
            .offset("wiggle") // streamgraph
            .order("inside-out"); // pick a "good" layer order

        data_frac = stack(all_series);

        // retrieve layer order (by recalculating it: dumb)
        ord = stack.order()(all_series.map(function (ds) {
            return ds.values.map(function (d) { return [d.x, d.y]; });
        }));

        // for raw-counts, enforce same order, even if not "good"
        stack.order(function (d) {
            return ord;
        });

        data_raw = stack(all_series.map(function (s) {
            return {
                t: s.t,
                values: s.values.map(function (d) {
                    return {
                        x: d.x,
                        y: d.y * m.yearly_total(d.yr)
                    };
                })
            };
        }));

        stack_domain_y = function (xs) {
            return [0, d3.max(xs.map(function (ds) {
                return d3.max(ds.values, function (d) {
                    return d.y0 + d.y;
                });
            }))];
        };

        VIS.model_view.yearly.domain_frac =
            stack_domain_y(data_frac);
        VIS.model_view.yearly.domain_raw =
            stack_domain_y(data_raw);

        VIS.model_view.yearly.order = ord;

        VIS.model_view.yearly.data.frac = data_frac;
        VIS.model_view.yearly.data.raw = data_raw;
    } // if (!VIS.model_view.yearly.data)

    return {
        data: VIS.model_view.yearly.data[raw ? "raw" : "frac"],
        domain_x: VIS.model_view.yearly.domain_years,
        domain_y: VIS.model_view.yearly[raw ? "domain_raw" : "domain_frac"],
        order: VIS.model_view.yearly.order
    };

};

set_view = function (hash) {
    window.location.hash = hash;
};

view_refresh = function (m, v) {
    var view_parsed, param, success;

    view_parsed = v.split("/");
    param = view_parsed[2];

    if (VIS.cur_view !== undefined && !view.updating()) {
        VIS.cur_view.classed("hidden", true);
    }

    switch (view_parsed[1]) {
        case undefined:
            view_parsed[1] = "model";
            success = model_view(m);
            break;
        case "model":
            success = model_view(m, param, view_parsed[3], view_parsed[4]);
            break;
        case "about":
            success = about_view(m);
            break;
        case "bib":
            success = bib_view(m, param, view_parsed[3]);
            break;
        case "topic":
            param = +param - 1;
            success = topic_view(m, param, view_parsed[3]);
            break;
        case "word":
            success = word_view(m, param);
            break;
        case "doc":
            param = +param;
            success = doc_view(m, param);
            break;
        case "words":
            success = words_view(m);
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

    view.updating(false);

    VIS.cur_view.classed("hidden", false);

    // ensure highlighting of nav link
    d3.selectAll("#nav_main li.active").classed("active",false);
    d3.select("li#nav_" + view_parsed[1]).classed("active",true);
};


// initialization
// --------------

// global visualization setup
setup_vis = function (m) {
    // load any preferences stashed in model info
    VIS = utils.deep_replace(VIS, m.info().VIS);

    // model title
    d3.selectAll(".model_title")
        .html(m.info().title);

    // hashchange handler
    window.onhashchange = function () {
        view_refresh(m, window.location.hash, false);
    };

    // TODO settings controls
};

var load_data = function (target, callback) {
    var target_base, target_id;

    if (target === undefined) {
        return callback("target undefined", undefined);
    }
    
    target_base = target.replace(/^.*\//, "");
    target_id = "m__DATA__" + target_base.replace(/\..*$/, "");

    // preprocessed data available in DOM?
    if (document.getElementById(target_id)) {
        return callback(undefined,
                document.getElementById(target_id).innerHTML);
    }
    
    // otherwise, we have to fetch it

    // If the request is for a zip file, we'll unzip.
    // N.B. client-side unzipping only needed if you don't have control
    // over whether the server zips files
    if (target.search(/\.zip$/) > 0) {
        return d3.xhr(target)
            .responseType("arraybuffer")
            .get(function (error, response) {
                var zip, text;
                if (response.status === 200) {
                    zip = new JSZip(response.response);
                    text = zip.file(target_base.replace(/\.zip$/, "")).asText();
                }
                return callback(error, text);
            });
    }
    
    // Otherwise, no unzipping
    return d3.text(target, function (error, s) {
        return callback(error, s);
    });
};


// main
// ----

main = function () {
    load_data(dfb.files.info,function (error, info_s) {
        // callback, invoked when ready 
        var m = model({ info: JSON.parse(info_s) });
        setup_vis(m);

        // TODO no need to globally expose the model, but handy for debugging
        // __DEV_ONLY__
        VIS.m = m;
        // __END_DEV_ONLY__

        // now launch remaining data loading; ask for a refresh when done
        load_data(dfb.files.meta, function (error, meta_s) {
            m.set_meta(meta_s);
            view_refresh(m, window.location.hash);
        });
        load_data(dfb.files.dt, function (error, dt_s) {
            m.set_dt(dt_s);
            view_refresh(m, window.location.hash);
        });
        load_data(dfb.files.tw, function (error, tw_s) {
            if (typeof tw_s === 'string') {
                m.set_tw(tw_s);

                // Set up topic menu: remove loading message
                d3.select("ul#topic_dropdown").selectAll("li").remove();
                // Add menu items
                d3.select("ul#topic_dropdown").selectAll("li")
                    .data(d3.range(m.n()))
                    .enter().append("li").append("a")
                    .text(function (topic) {
                        return topic_label(m, topic, VIS.model_view.words);
                    })
                    .attr("href", topic_link);

                view_refresh(m, window.location.hash);
            } else {
                view.error("Unable to load topic words from " + dfb.files.tw);
            }
        });
        load_data(dfb.files.topic_scaled, function (error, s) {
            if (typeof s === 'string') {
                m.set_topic_scaled(s);
            } else {
                // if missing, just gray out the button for the view
                m.set_topic_scaled("");
                d3.select("#nav_model_scaled")
                    .classed("disabled", true)
                    .select("a")
                        .attr("href", "#/model/scaled");
            }

            view_refresh(m, window.location.hash);
        });

        view_refresh(m, window.location.hash);
    });
};

// execution

main();

