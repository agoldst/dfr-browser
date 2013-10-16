/*global d3, queue, model */

/* declaration of global object (initialized in setup_vis) */
var VIS = {
    ready: { }, // which viz already generated?
    last: { }, // which subviews last shown?
    bib_sort: {
        major: "year",
        minor: "alpha"
    },
    overview_words: 15,     // may need adjustment
    model_view: {
        aspect: 1.3333,
        words: 4,           // may need adjustment
        size_range: [7, 18] // points. may need adjustment
    },
    topic_view: {
        words: 50,
        words_increment: 5,
        docs: 20,           // should be divisible by docs_increment
        docs_increment: 5,
        w: 640, // initial guess, adjusted to proportion of container width
        h: 300, // fixed
        m: {
            left: 40,
            right: 20,
            top: 20,
            bottom: 20
        },
        bar_width: 300, // in days!
        ticks: 10 // applied to both x and y axes
    }, 
    doc_view: {
        topics: 10,         // should be divisible by...
        topics_increment: 2 
    },
    float_format: function (x) {
        return d3.round(x, 3);
    },
    percent_format: d3.format(".1%"),
    cite_date_format: d3.time.format("%B %Y"),
    uri_proxy: "",
    prefab_plots: true // use SVG or look for image files for plots?
};

/* declaration of functions */

var doc_journal_sort,   // bibliography sorting
    bib_sort,
    topic_label,        // stringifiers
    topic_link,
    doc_author_string,
    cite_doc,
    doc_uri,
    render_updown,      // view generation
    add_weight_cells,
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
    topic_coords_grid,
    view_refresh,
    view_loading,
    view_error,
    setup_vis,          // initialization
    plot_svg,
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
        major_key, minor_key,
        cur_major, i, last,
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
            return doc_author_string(m, i).replace(/^\W*/, "")[0]
                .toUpperCase();
        };
    }

    if (minor === "date") {
        minor_key = function (i) {
            return +m.meta(i).date;
        };
    } else if (minor == "journal") {
        minor_key = function (i) {
            var doc = m.meta(i),
                result = doc.journaltitle;

            result += d3.format("05d")(doc.volume);
            result += d3.format("05d")(doc.issue ? 0
                    : doc.issue.replace(/\/.*$/, ""));
            if (doc.pagerange.search(/^\d/) !== -1) {
                result += d3.format("05d")(doc.pagerange.match(/^(\d+)/)[1]);
            } else {
                result += doc.pagerange;
            }
            return result;
        };
    }
    else {
        // default to alphabetical by author then title
        minor_key = function (i) {
            return doc_author_string(m, i) + m.meta(i).title;
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
            var M = d3.ascending(a.major, b.major);
            return (M !== 0) ? M : d3.ascending(a.minor, b.minor);
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
        result.docs.push(docs.slice(last, partition[i])
                .map(function (d) {
                    return d.id;
                })
        );
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
    label += m.topic_words(t, n).join(" ");
    return label;
};

topic_link = function (t) {
    return "#/topic/" + (t + 1);
};

doc_author_string = function (m, i) {
    var doc = m.meta(i),
        lead, lead_trail,
        result;

    if(doc.authors.length > 0) {
        lead = doc.authors[0].replace(/,/g, "").split(" ");
        // check for Jr., Sr., 2nd, etc.
        // Can mess up if last name is actually the letter I, X, or V.
        lead_trail = lead.pop();
        if (lead.length >= 2
                && (lead_trail.search(/^(\d|Jr|Sr|[IXV]+$)/) !== -1)) {
            result = lead.pop().replace(/_$/, "");
            lead_trail = ", " + lead_trail.replace(/\W*$/, "");
            
        }
        else {
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
    var doc, lead, result;

    doc = m.meta(d);
    result = doc_author_string(m, d);

    // don't duplicate trailing period on middle initial etc.
    result = result.replace(/\.?$/,". ");
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

doc_uri = function (m, d) {
    return "http://dx.doi.org"
        + VIS.uri_proxy
        + "/"
        + m.meta(d).doi;
};

// utility for views
// -----------------

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
    })();
};

// Principal view-generating functions
// -----------------------------------

topic_view = function (m, t) {
    var view = d3.select("div#topic_view"),
        img;

    if (!m.meta() || !m.dt() || !m.tw() || !m.doc_len()) {
        // not ready yet; show loading message
        view_loading(true);
        return true;
    }

    // TODO don't need anything but tw to show topic words h2 and div; so can 
    // have div-specific loading messages instead

    if (!isFinite(t) || t < 0 || t >= m.n()) {
        d3.select("#topic_view_help").classed("hidden", false);
        d3.select("#topic_view_main").classed("hidden", true);
        view_loading(false);
        return true;
    } else {
        d3.select("#topic_view_help").classed("hidden", true);
        d3.select("#topic_view_main").classed("hidden", false);
    }

    // heading information
    // -------------------

    view.select("h2#topic_header")
        .text(topic_label(m, t, VIS.overview_words));

    view.select("p#topic_remark")
        .text("α = " + VIS.float_format(m.alpha(t)));

    // table of top words and weights
    // ------------------------------

    // with up/down buttons
    render_updown("button#topic_words", VIS.topic_view.words,
            VIS.topic_view.words_increment, m.n_top_words(),
            VIS.topic_view.words_increment, function (n) {
                topic_view_words(m, t, n);
                // Ensure the initial count persists in another topic view
                VIS.topic_view.words = n;
            });

    // table of top articles
    // ---------------------

    // with up/down buttons
    render_updown("button#topic_docs", VIS.topic_view.docs,
            VIS.topic_view.docs_increment, m.n_docs(),
            VIS.topic_view.docs_increment, function (n) {
                topic_view_docs(m, t, n);
                // Ensure the initial count persists in another topic view
                VIS.topic_view.docs = n;
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

topic_view_words = function (m, t, n) {
    var trs_w,
        words = m.topic_words(t, n).map(function (w) {
            return {
                word: w,
                weight: m.tw(t, w)
            };
        });

    trs_w = d3.select("table#topic_words tbody")
        .selectAll("tr")
        .data(words);

    trs_w.enter().append("tr");
    trs_w.exit().remove();

    // clear rows
    trs_w.selectAll("td").remove();

    trs_w.append("td").append("a")
        .attr("href", function (w) {
            return "#/word/" + w.word;
        })
        .text(function (w) { return w.word; });

    add_weight_cells(trs_w, "weight", words[0].weight);

};

add_weight_cells = function (sel, wt, max) {
    sel.append("td").classed("weight", true)
        .append("div")
            .classed("proportion", true)
            .style("margin-left", function (w) {
                return d3.format(".1%")(1 - w[wt] / max);
            })
            .append("span")
                .classed("proportion", true)
                .text(function (w) {
                    return w.weight;
                });
};

topic_view_docs = function (m, t, n) {
    var trs_d;

    trs_d = d3.select("table#topic_docs tbody")
        .selectAll("tr")
        .data(m.topic_docs(t, n));

    trs_d.enter().append("tr");
    trs_d.exit().remove();

    // clear rows
    trs_d.selectAll("td").remove();

    trs_d
        .append("td").append("a")
        .attr("href", function (d) {
            return "#/doc/" + d.doc;
        })
        .html(function (d) {
            return cite_doc(m, d.doc);
        });

    add_weight_cells(trs_d, "frac", 1);

    trs_d
        .append("td")
        .text(function (d) {
            return VIS.percent_format(d.frac);
        });

    trs_d
        .append("td")
        .text(function (d) {
            return d.weight;
        });
};

plot_topic_yearly = function(m, t) {
    var year_seq, series = [],
        w, scale_x, scale_y,
        rects, axis_x, axis_y, 
        spec = VIS.topic_view,
        svg;

    spec.w = $("#main_container").width() * 0.6667;
    svg = plot_svg("div#topic_plot", spec);

    series = m.topic_yearly(t).keys().sort().map(function (y) {
        return [new Date(+y, 0, 1), m.topic_yearly(t).get(y)];
    });

    scale_x = d3.time.scale()
        .domain([series[0][0],
                d3.time.day.offset(series[series.length - 1][0],
                    VIS.topic_view.bar_width)])
        .range([0, VIS.topic_view.w]);
        //.nice();

    w = scale_x(d3.time.day.offset(series[0][0],VIS.topic_view.bar_width)) -
        scale_x(series[0][0]);


    scale_y = d3.scale.linear()
        .domain([0, d3.max(series, function (d) {
            return d[1];
        })])
        .range([VIS.topic_view.h, 0])
        .nice();

    // axes
    // ----

    // clear
    svg.selectAll("g.axis").remove();

    // x axis
    svg.append("g")
        .classed("axis",true)
        .classed("x",true)
        .attr("transform","translate(0," + VIS.topic_view.h + ")")
        .call(d3.svg.axis()
            .scale(scale_x)
            .orient("bottom")
            .ticks(d3.time.years,VIS.topic_view.ticks));

    // y axis
    svg.append("g")
        .classed("axis",true)
        .classed("y",true)
        .call(d3.svg.axis()
            .scale(scale_y)
            .orient("left")
            .tickSize(-VIS.topic_view.w)
            .outerTickSize(0)
            .tickFormat(VIS.percent_format)
            .ticks(VIS.topic_view.ticks));

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
            return VIS.topic_view.h - scale_y(d[1]);
        });
};


word_view = function (m, w) {
    var view = d3.select("div#word_view"),
        word = w,
        trs, topics;

    if (!m.tw()) {
        view_loading(true);
        return true;
    }
    view_loading(false);

    // word form setup
    d3.select("form#word_view_form")
        .on("submit", function () {
            var input_word = d3.select("input#word_input")
                .property("value")
                .toLowerCase();
            window.location.hash = "/word/" + input_word;
        });

    if (word) {
        view.select("#word_view_help").classed("hidden", true);
    } else {
        view.select("#word_view_help").classed("hidden", false);
        if (VIS.last.word) {
            word = VIS.last.word; // fall back to last word if available
            view.select("a#last_word") 
                .attr("href", "#/word/" + word)
                .text(document.URL.replace(/#.*$/,"") + "#/word/" + word);
            view.select("#last_word_help").classed("hidden", false);
        } else {
            view.select("#word_view_main").classed("hidden", true);
            return true;
        }
    }
    view.select("#word_view_main").classed("hidden", false);

    VIS.last.word = word;
    view.select("h2#word_header")
        .text(word);

    topics = m.word_topics(word);

    view.select("#word_no_topics").classed("hidden", topics.length !== 0);
    view.select("table#word_topics").classed("hidden", topics.length === 0);

    trs = view.select("table#word_topics tbody")
        .selectAll("tr")
        .data(topics);

    trs.enter().append("tr");
    trs.exit().remove();

    // clear rows
    trs.selectAll("td").remove();

    trs.append("td")
        .text(function (d) {
            return d.rank + 1; // user-facing rank is 1-based
        });

    trs.append("td").append("a")
        .text(function (d) {
            return topic_label(m, d.topic, VIS.overview_words);
        })
        .attr("href", function (d) {
            return topic_link(d.topic);
        });

    return true;
    // (later: time graph)
};

words_view = function (m) {
    if (!m.tw()) {
        view_loading(true);
        return true;
    }
    view_loading(false);

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
    var view = d3.select("div#doc_view"),
        doc = d,
        topics, trs;

    if (!m.meta() || !m.dt() || !m.tw() || !m.doc_len()) {
        view_loading(true);
        return true;
    }
    
    view_loading(false);

    if (!isFinite(doc) || doc < 0 || doc >= m.n_docs()) {
        d3.select("#doc_view_help").classed("hidden", false);
        if (VIS.last.doc === undefined) {
            d3.select("#doc_view_main").classed("hidden", true);
            return true;
        } else {
            doc = VIS.last.doc; // fall back to last doc if none entered
            view.select("a#last_doc") 
                .attr("href", "#/doc/" + doc)
                .text(document.URL.replace(/#.*$/,"") + "#/doc/" + doc);
            view.select("#last_doc_help").classed("hidden", false);
        }
    } else {
        d3.select("#doc_view_help").classed("hidden", true);
        VIS.last.doc = doc;
    }
    d3.select("#doc_view_main").classed("hidden", false);

    view.select("h2#doc_header")
        .html(cite_doc(m, doc));

    view.select("#doc_remark")
        .html(m.doc_len(doc) + " tokens. "
                + '<a class ="external" href="'
                + doc_uri(m, doc)
                + '">View '
                + m.meta(doc).doi
                + " on JSTOR</a>");

    topics = m.doc_topics(doc, m.n());
    render_updown("button#doc_topics", VIS.doc_view.topics,
        VIS.doc_view.topics_increment, topics.length,
        VIS.doc_view.topics_increment,
        function (n) {
            // Ensure the initial count persists in another doc view
            VIS.doc_view.topics = n;
            trs = view.select("table#doc_topics tbody")
                .selectAll("tr")
                .data(topics.slice(0, n));

            trs.enter().append("tr");
            trs.exit().remove();

            // clear rows
            trs.selectAll("td").remove();

            trs.append("td")
                .append("a")
                    .attr("href", function (t) {
                        return topic_link(t.topic);
                    })
                    .text(function (t) {
                        return topic_label(m, t.topic, VIS.overview_words);
                    });

            add_weight_cells(trs, "weight", m.doc_len(doc));

            trs.append("td")
                .text(function (t) {
                    return t.weight;
                });
            trs.append("td")
                .text(function (t) {
                    return VIS.percent_format(t.weight / m.doc_len(doc));
                });
        });

    return true;

    // (later: nearby documents)
};

bib_view = function (m, maj, min) {
    var view = d3.select("div#bib_view"),
        major = maj, minor = min,
        ordering, nav_as, sections, panels, as;

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
        view_loading(true);
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
            window.location.hash = "/bib/" + sorting.replace(/_/,"/");
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
        .on("click", function () {
            var is_down = d3.select(this)
                .select("span")
                .classed("glyphicon-chevron-down"),
                sorter = is_down ? d3.descending : d3.ascending;

            d3.select(this).select("span")
                .classed("glyphicon-chevron-down", !is_down)
                .classed("glyphicon-chevron-up", is_down);
            
            d3.selectAll("div#bib_main div.panel-default")
                .sort(sorter)
                .order();
        });

    ordering = bib_sort(m, major, minor);

    // clear listings
    view.selectAll("div#bib_main > div.panel").remove();

    sections = view.select("div#bib_main")
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

    view_loading(false);

    // TODO smooth sliding-in / -out appearance of navbar would be nicer

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

model_view = function (m, type) {
    var type_chosen = type || VIS.last.model,
        coords;

    // if loading scaled coordinates failed,
    // we expect m.topic_scaled() to be defined but empty, so we'll pass this,
    // but fall through to choosing the grid below
    if (!m.tw() || !m.topic_scaled()) {
        view_loading(true);
        return true;
    }

    if (type_chosen === "list") {
        d3.select("#model_view_plot").classed("hidden", true);
        d3.select("#model_view_plot_help").classed("hidden", true);
        d3.select("#reset_zoom").classed("disabled", true);
        model_view_list(m);
        d3.select("#model_view_list").classed("hidden", false);
    } else {
        d3.select("#model_view_list").classed("hidden", true);
        if (type_chosen === "scaled" && m.topic_scaled().length === m.n()) {
            coords = m.topic_scaled();
        } else if (type_chosen === "grid") {
            coords = topic_coords_grid(m.n());
        } else {
            // default to grid
            type_chosen = "grid";
            coords = topic_coords_grid(m.n());
        }
        model_view_plot(m, coords);
        d3.select("#model_view_plot_help").classed("hidden", false);
        d3.select("#reset_zoom").classed("disabled", false);
        d3.select("#model_view_plot").classed("hidden", false);
    }
    VIS.last.model = type_chosen;

    // ensure pill highlighting
    d3.selectAll("#nav_model li.active").classed("active",false);
    d3.select("#nav_model_" + type_chosen).classed("active",true);
    view_loading(false);
    return true;
};

model_view_list = function (m) {
    var trs;

    trs = d3.select("#model_view_list table tbody")
        .selectAll("tr")
        .data(d3.range(m.n()))
        .enter().append("tr");

    trs.append("td").append("a")
        .text(function (t) { return t + 1; }) // sigh
        .attr("href", topic_link);

    trs.append("td").append("a")
        .text(function (t) {
            return m.topic_words(t, VIS.overview_words).join(" ");
        })
        .attr("href", topic_link);

    trs.append("td")
        .text(function (t) {
            return VIS.float_format(m.alpha(t));
        });
};

model_view_plot = function(m, coords) {
    var svg_w, spec, svg, cloud_size, circle_radius, range_padding,
        domain_x, domain_y,
        scale_x, scale_y, scale_size,
        gs, translation, zoom;

    svg_w  = $("#main_container").width();

    spec = {
        w: svg_w,
        h: Math.floor(svg_w / VIS.model_view.aspect),
        m: {
            left: 0,
            right: 0,
            top: 0,
            bottom: 0
        }
    };

    svg = plot_svg("#model_view_plot", spec);

    // zoom-target rectangle
    svg.selectAll("rect.bg")
        .data([1])
        .enter().append("rect")
            .attr("width", spec.w)
            .attr("height", spec.h)
            .classed("bg", true);

    domain_x = d3.extent(coords, function (d) {
            return d[0];
    });
    domain_y = d3.extent(coords, function (d) {
            return d[1];
    });

    circle_radius = Math.floor(spec.w /
            (2 * Math.sqrt(VIS.model_view.aspect * m.n())));
     // Allow the cloud to spill outside circle a little
    cloud_size = Math.floor(circle_radius * 2.1);

    range_padding = 1.1 * circle_radius;

    scale_x = d3.scale.linear()
        .domain(domain_x)
        .range([range_padding, spec.w - range_padding]);

    scale_y = d3.scale.linear()
        .domain(domain_y)
        .range([spec.h - range_padding, range_padding]);

    scale_size = d3.scale.sqrt()
        .domain([0, 1])
        .range(VIS.model_view.size_range);

    gs = svg.selectAll("g")
        .data(coords.map(function (p, j) {
            return { x: p[0], y: p[1], t: j };
        }));

    gs.enter().append("g")
        .each(function (p, t) {
            var g = d3.select(this),
                max_wt = m.tw(t, m.topic_words(t, 1)),
                wds = m.topic_words(t, VIS.model_view.words)
                    .map(function (w) {
                        return {
                            text: w,
                            size: Math.floor(scale_size(m.tw(t, w) / max_wt))
                        };
                    }),
                up, down, toggle, i;

            g.append("circle")
                .attr("cx", 0)
                .attr("cy", 0)
                .attr("r", circle_radius)
                .classed("topic_cloud", true)
                .on("click", function (p) {
                    window.location.hash = "/topic/" + (t + 1);
                })
                .on("mouseover", function (p) {
                    gs.sort(function (a, b) {
                            if (a.t === b.t) {
                                return 0;
                            } else if (a.t === t) {
                                return 1;
                            } else if (b.t === t) {
                                return -1;
                            } else {
                                return d3.ascending(a.t, b.t);
                            }
                        })
                        .order();
                    d3.select("p#topic_hover")
                        .text("Click for more on topic "
                            + topic_label(m, t, 3));
                })
                .on("mouseout",function() {
                    gs.sort(function (a, b) {
                            return d3.ascending(a.t, b.t);
                        })
                        .order();
                    d3.select("p#topic_hover")
                        .text("Click a topic for more detail");
                });

            up = 0;
            down = 0;
            toggle = false;
            for (i = 0; i < wds.length; i += 1, toggle = !toggle) {
                if (toggle) {
                    wds[i].y = up;
                    up -= wds[i].size;
                } else {
                    down += wds[i].size;
                    wds[i].y = down;
                }
                if (up - cloud_size / 2 < wds[i].size
                        && down > cloud_size / 2) {
                    break;
                }
            }

            g.selectAll("text")
                .data(wds.slice(0, i))
                .enter().append("text")
                    .text(function (wd) {
                        return wd.text;
                    })
                    .style("font-size", function (wd) {
                        return wd.size + "px";
                    })
                    .attr("x", 0)
                    .attr("y", function (wd) {
                        return wd.y;
                    })
                    .on("click", function (wd) {
                        window.location.hash = "/topic/" + (t + 1);
                    }) 
                    .classed("topic_label", true);
                    // TODO coloring
        });

    translation = function (p) {
        var result = "translate(" + scale_x(p.x);
        result += "," + scale_y(p.y) + ")";
        return result;
    };

    gs.transition()
        .duration(1000)
        .attr("transform", translation);

    zoom = d3.behavior.zoom()
        .x(scale_x)
        .y(scale_y)
        .scaleExtent([1, 10])
        .on("zoom", function () {
            if (VIS.zoom_transition) {
                gs.transition()
                    .duration(1000)
                    .attr("transform", translation);
                VIS.zoom_transition = false;
            } else {
                gs.attr("transform", translation);
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
};

topic_coords_grid = function (n) {
    var n_col = Math.floor(Math.sqrt(VIS.model_view.aspect * n)),
        n_row = Math.floor(n / n_col),
        remain = n - n_row * n_col,
        i, j,
        result = [];

    // Rectangular grid. TODO: closest possible packing?
    for (i = n_row - 1; i >= 0; i -= 1, remain -= 1) {
        for (j = 0; j < n_col + (remain > 0) ? 1 : 0; j += 1) {
            result.push([j + 0.5, i + 0.5]);
        }
    }

    return result;
};


view_loading = function (flag) {
    d3.select("div#loading").classed("hidden", !flag);
};

view_error = function (msg) {
    d3.select("div#error").append("div")
        .classed("alert", true)
        .classed("alert-danger", true)
        .append("p")
            .text(msg);
    d3.select("div#error").classed("hidden", false);
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
            success = model_view(m, param);
            break;
        case "about":
            success = about_view(m);
            break;
        case "bib":
            success = bib_view(m, param, view_parsed[3]);
            break;
        case "topic":
            param = +param - 1;
            success = topic_view(m, param);
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

    VIS.cur_view.classed("hidden", false);

    // ensure highlighting of nav link
    d3.selectAll("#nav_main li.active").classed("active",false);
    d3.select("li#nav_" + view_parsed[1]).classed("active",true);
};


// initialization
// --------------

// global visualization setup
setup_vis = function (m) {
    var key, tab_click;

    // load any preferences stashed in model info
    // TODO if info.VIS.whatever is an object, it will completely replace
    // VIS.whatever; union would be better

    if (m.info().VIS) {
        for (key in m.info().VIS) {
            if (m.info().VIS.hasOwnProperty(key)
                    && typeof(m.info().VIS[key] !== 'function')) {
                VIS[key] = m.info().VIS[key];
            }
        }
    }

    // model title
    d3.selectAll(".model_title")
        .html(m.info().title);

    // hashchange handler
    window.onhashchange = function () {
        view_refresh(m, window.location.hash, false);
    };

    // TODO settings controls
};

plot_svg = function (selector, spec) {
    var svg;

    if (!VIS.svg) {
        VIS.svg = d3.map();
    }
    if (VIS.svg.has(selector)) {
        return VIS.svg.get(selector);
    }

    // mbostock margin convention
    // http://bl.ocks.org/mbostock/3019563
    svg = d3.select(selector)
        .append("svg")
            .attr("width", spec.w + spec.m.left + spec.m.right)
            .attr("height", spec.h + spec.m.top + spec.m.bottom)
        // g element passes on xform to all contained elements
        .append("g")
            .attr("transform",
                  "translate(" + spec.m.left + "," + spec.m.top + ")");

    VIS.svg.set(selector, svg);
    return svg;
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
    
    // otherwise, we have to fetch it, and possibly unzip it
    if (target.search(/\.zip$/) > 0) {
        return d3.xhr(target)
            .responseType("arraybuffer")
            .get(function (error, response) {
                var zip, text;
                if (response.status == 200) {
                    zip = new JSZip(response.response);
                    text = zip.file(target_base.replace(/\.zip$/, "")).asText();
                }
                return callback(error, text);
            });
    } else {
        return d3.text(target, function (error, s) {
            return callback(error, s);
        });
    }
};


// main
// ----

main = function () {
    load_data(dfb.files.info,function (error, info_s) {
        // callback, invoked when ready 
        var m = model({ info: JSON.parse(info_s) });
        setup_vis(m);

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
            if (typeof(tw_s) === 'string') {
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
                view_error("Unable to load topic words from " + dfb.files.tw);
            }
        });
        load_data(dfb.files.doc_len, function (error, doc_len_s) {
            m.set_doc_len(doc_len_s);
            view_refresh(m, window.location.hash);
        });
        load_data(dfb.files.topic_scaled, function (error, s) {
            if (typeof(s) === 'string') {
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

