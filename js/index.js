/*global d3, $, JSZip, model, utils, dfb, window, document */
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
        aspect: 1.3333,
        words: 4,           // may need adjustment
        size_range: [7, 18], // points. may need adjustment
        yearly: {
            topics: 4,
            words: 3,
            pie: 25        // pie diameter (pixels)
        },
        list: {
            spark: {
                w: 50,
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
    model_view_yearly,
    topic_coords_grid,
    view_refresh,
    view_loading,
    view_error,
    setup_vis,          // initialization
    plot_svg,
    append_svg,
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
            return doc_author_string(m, i).replace(/^\W*/, "")[0]
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
        result.docs.push(docs.slice(last, partition[i]).map(get_id));
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
    return "#" + topic_hash(t);
};

topic_hash = function (t) {
    return "/topic/" + String(t + 1);
};

doc_author_string = function (m, i) {
    var doc = m.meta(i),
        lead,
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
    var doc, result;

    doc = m.meta(d);
    result = doc_author_string(m, d);

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

doc_uri = function (m, d) {
    return "http://dx.doi.org"
        + VIS.uri_proxy
        + "/"
        + m.meta(d).doi;
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
    var view = d3.select("div#topic_view");

    if (!m.meta() || !m.dt() || !m.tw() || !m.doc_len()) {
        // not ready yet; show loading message
        view_loading(true);
        return true;
    }

    // TODO don't need anything but tw to show topic words h2 and div; so can 
    // have div-specific loading messages instead

    // if the topic is missing or unspecified, show the help
    if (!isFinite(t) || t < 0 || t >= m.n()) {
        d3.select("#topic_view_help").classed("hidden", false);
        d3.select("#topic_view_main").classed("hidden", true);
        view_loading(false);
        return true;
    }

    // if the year is invalid, we'll just ignore it
    if (!m.valid_year(year, t)) {
        year = undefined;
    }

    // otherwise, proceed to render the view
    d3.select("#topic_view_help").classed("hidden", true);
    d3.select("#topic_view_main").classed("hidden", false);

    // heading information
    // -------------------

    view.select("h2#topic_header")
        .text(topic_label(m, t, VIS.overview_words));

    view.select("p#topic_remark")
        .text("α = " + VIS.float_format(m.alpha(t)));

    // table of top words and weights
    // ------------------------------

    if (!VIS.view_updating) {
        // with up/down buttons
        render_updown("button#topic_words",
            VIS.topic_view.words,
            VIS.topic_view.words_increment,
            m.n_top_words(),
            VIS.topic_view.words_increment,
            function (n) {
                topic_view_words(m, t, n);
                // Ensure the initial count persists in another topic view
                VIS.topic_view.words = n;
            });
    }

    // table of top articles
    // ---------------------

    // with up/down buttons
    render_updown("button#topic_docs",
        VIS.topic_view.docs,
        VIS.topic_view.docs_increment,
        m.n_docs(),
        VIS.topic_view.docs_increment,
        function (n) {
            topic_view_docs(m, t, n, year);
            // Ensure the initial count persists in another topic view
            VIS.topic_view.docs = n;
        });

    // Plot topic over time
    // --------------------
    //

    if (!VIS.view_updating) {
        plot_topic_yearly(m, t, {
            svg: plot_svg("div#topic_plot", VIS.topic_view),
            axes: true,
            clickable: true,
            year: year,
            spec: VIS.topic_view
        });
    }

    VIS.topic_view.updating = false;
    view_loading(false);

    return true;
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

    trs_w.on("click", function (w) {
        window.location.hash ="/word/" + w.word;
    });

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
                .html("&nbsp;");
};

topic_view_docs = function (m, t, n, year) {
    var trs_d, docs, header_text;

    // FIXME transition the table items

    if(isFinite(year)) {
        // TODO cache this?
        docs = m.topic_docs(t, m.n_docs()).filter(function (d) {
            return m.doc_year(d.doc) === +year;
        });
        docs = utils.shorten(docs, n);
        header_text = "Top documents in " + year;

        // the clear-selected-year button
        d3.select("#topic_year_clear")
            .classed("disabled", false)
            .on("click", function () {
                // We know that the next time the tooltip on the bar
                // chart is displayed, the tooltip object's "selected"
                // property will be refreshed. Until then, the property
                // is wrongly still true, but this won't affect anything
                // the user sees.

                d3.select(".selected_year").classed("selected_year", false);
                VIS.view_updating = true;
                window.location.hash = topic_hash(t);
            })
            .classed("hidden", false);
    } else {
        docs = m.topic_docs(t, n);
        header_text = "Top documents";
        d3.select("#topic_year_clear")
            .classed("disabled", true);
    }

    d3.select("h3#topic_docs_header")
        .text(header_text);

    trs_d = d3.select("table#topic_docs tbody")
        .selectAll("tr")
        .data(docs);

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

    trs_d.on("click", function (d) {
        window.location.hash = "/doc/" + d.doc;
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

plot_topic_yearly = function (m, t, param) {
    var series = [],
        scale_x,
        scale_y,
        w,
        w_click,
        bars,
        bars_click,
        tooltip,
        svg = param.svg,
        spec = param.spec;

    series = m.topic_yearly(t).keys().sort().map(function (y) {
        return [new Date(+y, 0, 1), m.topic_yearly(t).get(y)];
    });

    scale_x = d3.time.scale()
        .domain([series[0][0],
                d3.time.day.offset(series[series.length - 1][0],
                    spec.bar_width)])
        .range([0, spec.w]);
        //.nice();

    w = scale_x(d3.time.day.offset(series[0][0], spec.bar_width)) -
        scale_x(series[0][0]);

    w_click = scale_x(d3.time.year.offset(series[0][0], 1)) -
        scale_x(series[0][0]);

    scale_y = d3.scale.linear()
        .domain([0, d3.max(series, function (d) {
            return d[1];
        })])
        .range([spec.h, 0])
        .nice();

    // axes
    // ----

    if (param.axes) {
        // clear
        svg.selectAll("g.axis").remove();

        // x axis
        svg.append("g")
            .classed("axis", true)
            .classed("x", true)
            .attr("transform", "translate(0," + spec.h + ")")
            .call(d3.svg.axis()
                .scale(scale_x)
                .orient("bottom")
                .ticks(d3.time.years, spec.ticks));

        // y axis
        svg.append("g")
            .classed("axis", true)
            .classed("y", true)
            .call(d3.svg.axis()
                .scale(scale_y)
                .orient("left")
                .tickSize(-spec.w)
                .outerTickSize(0)
                .tickFormat(VIS.percent_format)
                .ticks(spec.ticks));

        svg.selectAll("g.axis.y g").filter(function (d) { return d; })
            .classed("minor", true);
    }

    // bars
    // ----

    // clear
    svg.selectAll("g.topic_proportion").remove();

    bars = svg.selectAll("g.topic_proportion")
        .data(series);

    // for each year, we will have two rects in a g: one showing the yearly
    // proportion and an invisible one for mouse interaction,
    // following the example of http://bl.ocks.org/milroc/9842512
    bars.enter().append("g")
        .classed("topic_proportion", true);

    // the g sets the x position of each pair of bars
    bars.attr("transform", function (d) {
        return "translate(" + scale_x(d[0]) + ",0)";
    });

    // set a selected year if any
    bars.classed("selected_year", function (d) {
        return String(d[0].getFullYear()) === param.year;
    });

    if (param.clickable) {
        // add the clickable bars, which are as high as the plot
        // and a year wide
        bars_click = bars.append("rect")
            .classed("interact", true)
            .attr("x", -w_click / 2.0)
            .attr("y", 0)
            .attr("width", w_click)
            .attr("height", function (d) {
                return spec.h;
            });
    }

    // add the visible bars
    bars.append("rect")
        .classed("display", true)
        .attr("x", -w / 2.0)
        .attr("y", function (d) {
            return scale_y(d[1]);
        })
        .attr("width", w)
        .attr("height", function (d) {
            return spec.h - scale_y(d[1]);
        });

    if (param.clickable) {
        bars.on("mouseover", function (d) {
                d3.select(this).classed("hover", true);
            })
            .on("mouseout", function (d) {
                d3.select(this).classed("hover", false);
            });

        // interactivity for the bars
        //
        // first, construct a tooltip object we'll update on mouse events

        tooltip = {
            div: d3.select("div#tooltip"),
            container: d3.select("body").node(),
            selected: false
        };
        if (tooltip.div.empty()) {
            tooltip.div = d3.select("body").append("div")
                .attr("id", "tooltip")
                .classed("bar_tooltip", true);
            tooltip.div.append("p");
        }

        tooltip.update_pos = function () {
            var mouse_pos = d3.mouse(this.container);
            this.div.style({
                    left: (mouse_pos[0] + VIS.tooltip.offset.x) + 'px',
                    top: (mouse_pos[1] + VIS.tooltip.offset.y) + 'px',
                    position: "absolute"
                });
        };
        tooltip.text = function (d) {
            // could condition on this.selected, but it gets too talky
            this.div.select("p")
                .text(d[0].getFullYear());
        };
        tooltip.show = function () {
            this.div.classed("hidden", false);
        };
        tooltip.hide = function () {
            this.div.classed("hidden", true);
        };

        // now set mouse event handlers

        bars_click.on("mouseover", function (d) {
                var g = d3.select(this.parentNode);
                g.select(".display").classed("hover", true); // display bar
                tooltip.selected = g.classed("selected_year");
                tooltip.text(d);
                tooltip.update_pos();
                tooltip.show();
            })
            .on("mousemove", function (d) {
                tooltip.update_pos();
            })
            .on("mouseout", function (d) {
                d3.select(this.parentNode).select(".display") // display bar
                    .classed("hover", false);
                tooltip.hide();
            })
            .on("click", function (d) {
                if(d3.select(this.parentNode).classed("selected_year")) {
                    d3.select(this.parentNode).classed("selected_year", false);
                    tooltip.selected = false;
                    tooltip.text(d);
                    VIS.view_updating = true;
                    window.location.hash = topic_hash(t);
                } else {
                    // TODO selection of multiple years
                    d3.selectAll(".selected_year")
                        .classed("selected_year", false);
                    d3.select(this.parentNode).classed("selected_year", true);
                    tooltip.selected = true;
                    tooltip.text(d);
                    VIS.view_updating = true;
                    window.location.hash = topic_hash(t) + "/" +
                        d[0].getFullYear();
                }
            });
    }

};


word_view = function (m, w) {
    var view = d3.select("div#word_view"),
        word = w,
        trs,
        topics;

    if (!m.tw()) {
        view_loading(true);
        return true;
    }
    view_loading(false);

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
        view.select("#word_view_help").classed("hidden", true);
    } else {
        view.select("#word_view_help").classed("hidden", false);
        if (VIS.last.word) {
            word = VIS.last.word; // fall back to last word if available
            view.select("a#last_word")
                .attr("href", "#/word/" + word)
                .text(document.URL.replace(/#.*$/, "") + "#/word/" + word);
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

    trs.on("click", function (d) {
        window.location.hash = topic_hash(d.topic);
    });
        // TODO visualize rank by instead using bars in columns as in the left-hand-size 
        // of the topic view. Column headers are links to topics, words are word links,
        // highlight the word that's in focus. thicker column borders between topics. 
        // Alternatively: termite-style grid.

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
        topics,
        trs;

    if (!m.meta() || !m.dt() || !m.tw() || !m.doc_len()) {
        view_loading(true);
        return true;
    }

    view_loading(false);

    if (!isFinite(doc) || doc < 0 || doc >= m.n_docs()) {
        d3.select("#doc_view_help").classed("hidden", false);

        // if doc is un- or misspecified and there is no last doc, bail
        if (VIS.last.doc === undefined) {
            d3.select("#doc_view_main").classed("hidden", true);
            return true;
        }

        // otherwise, fall back to last doc if none entered
        doc = VIS.last.doc;
        view.select("a#last_doc")
            .attr("href", "#/doc/" + doc)
            .text(document.URL.replace(/#.*$/, "") + "#/doc/" + doc);
        view.select("#last_doc_help").classed("hidden", false);
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

            trs.on("click", function (t) {
                window.location.hash = topic_hash(t.topic);
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

    // TODO nearby documents list
};

bib_view = function (m, maj, min) {
    var view = d3.select("div#bib_view"),
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
                    .order();
                descend = !descend;
            };
        }())); // up/down state is preserved in the closure

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
    view_loading(false);
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

    // ensure pill highlighting
    d3.selectAll("#nav_model li.active").classed("active",false);
    d3.select("#nav_model_" + type_chosen).classed("active",true);

    // hide all subviews; we'll reveal the chosen one
    d3.select("#model_view_plot").classed("hidden", true);
    d3.select("#model_view_plot_help").classed("hidden", true);
    d3.select("#model_view_list").classed("hidden", true);
    d3.select("#reset_zoom").classed("disabled", true);
    d3.select("button#model_sort_dir").classed("disabled", true);
    d3.select("#model_view_yearly").classed("hidden", true);

    if (type_chosen === "list") {
        if (!m.meta() || !m.dt()) {
            view_loading(true);
            return true;
        }

        model_view_list(m);
        d3.select("button#model_sort_dir").classed("disabled", false);
        d3.select("#model_view_list").classed("hidden", false);
    } else if (type_chosen === "yearly") {
        if (!m.meta() || !m.dt()) {
            view_loading(true);
            return true;
        }

        model_view_yearly(m);
        d3.select("button#model_sort_dir").classed("disabled", false);
        d3.select("#model_view_yearly", "hidden", false);
    } else {
        // if loading scaled coordinates failed,
        // we expect m.topic_scaled() to be defined but empty
        if (!m.topic_scaled()) {
            view_loading(true);
            return true;
        }

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

    view_loading(false);
    return true;
};

model_view_list = function (m) {
    var trs, divs;

    d3.select("button#model_sort_dir").on("click", function () {
        d3.selectAll("#model_view_list table tbody tr")
            .sort(VIS.model_view.list.descend ?
                        d3.descending : d3.ascending)
            .order();
        VIS.model_view.list.descend = !VIS.model_view.list.descend;
    });

    if (VIS.ready.model_list) {
        return true;
    }

    VIS.model_view.list.descend = true;

    trs = d3.select("#model_view_list table tbody")
        .selectAll("tr")
        .data(d3.range(m.n()))
        .enter().append("tr");

    trs.on("click", function (t) {
            window.location.hash = topic_hash(t);
        });

    trs.append("td").append("a")
        .text(function (t) { return t + 1; }) // sigh
        .attr("href", topic_link);

    divs = trs.append("td").append("div").classed("spark", true);
    append_svg(divs, VIS.model_view.list.spark)
        .each(function (t) {
            plot_topic_yearly(m, t, {
                svg: d3.select(this),
                axes: false,
                clickable: false,
                spec: VIS.model_view.list.spark
            });
        });

    trs.append("td").append("a")
        .text(function (t) {
            return m.topic_words(t, VIS.overview_words).join(" ");
        })
        .attr("href", topic_link);

    trs.append("td")
        .text(function (t) {
            return VIS.float_format(m.alpha(t));
        });

    VIS.ready.model_list = true;
    return true;
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
                    window.location.hash = topic_hash(t);
                })
                .on("mouseover", function (p) {
                    gs.sort(function (a, b) {
                            if (a.t === b.t) {
                                return 0;
                            }

                            if (a.t === t) {
                                return 1;
                            }

                            if (b.t === t) {
                                return -1;
                            }

                            // otherwise
                            return d3.ascending(a.t, b.t);
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
                        window.location.hash = topic_hash(t);
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

model_view_yearly = function (m) {
    var topics, trs, tds, colors, arc, pie, gs;

    d3.select("button#model_sort_dir").on("click", function () {
        d3.selectAll("table#year_topics tbody tr")
            .sort(function(a, b) {
                return VIS.model_view.yearly.descend ?
                        d3.descending(a.year, b.year)
                        : d3.ascending(a.year, b.year);
            })
            .order();
        VIS.model_view.yearly.descend = !VIS.model_view.yearly.descend;
    });

    if (VIS.ready.model_yearly) {
        d3.select("div#model_view_yearly").classed("hidden", false);
        return true;
    }

    // default initial order is ascending
    VIS.model_view.yearly.descend = true;

    topics = m.years().sort().map(function (y) {
        return {
            year: y,
            topics: m.year_topics(y, VIS.model_view.yearly.topics),
            total: m.yearly_total(y)
        };
    });

    d3.select("table#year_topics thead tr")
        .selectAll("th.topic")
        .data(d3.range(VIS.model_view.yearly.topics))
        .enter().append("th")
        .text(function (i) {
            var ord = "";
            // range goes from zero; not valid for i > 20
            if (i === 0) {
                ord = "";
            } else if (i === 1) {
                ord = "2nd ";
            } else if (i === 2) {
                ord = "3rd ";
            } else {
                ord = (i + 1) + "th ";
            }
            return ord + "most prominent topic";
        });


    trs = d3.select("table#year_topics tbody").selectAll("tr")
        .data(topics)
        .enter().append("tr");

    trs.append("td")
        .text(function (d) { return d.year; })
        .classed("year", "true");

    tds = trs.selectAll("td.topic")
        .data(function (d, i) {
            return d.topics.map(function (x) {
                return {
                    topic: x.topic,
                    weight: x.weight,
                    i: i // cheapo "pointer" to place in topics array
                };
            });
        })
        .enter()
        .append("td").classed("topic", true);

    tds.on("click", function (d) {
        window.location.hash = "/topic/" + (d.topic + 1) + "/" +
            topics[d.i].year;
    });

    // A visual cue to help spot the same topic in nearby rows
    // Unfortunately, 20 colors is as far as any sane person would go,
    // so we'll just stupidly repeat colors at intervals of 20
    // TODO make better (shape, pattern?)
    colors = d3.scale.category20();

    arc = d3.svg.arc()
        .outerRadius(VIS.model_view.yearly.pie / 2)
        .innerRadius(0);

    pie = d3.layout.pie()
        .sort(null)
        .value(function (x) {
            return x.weight;
        });

    gs = tds.append("div").classed("pie", true)
        .append("svg")
        .attr("height", VIS.model_view.yearly.pie + "px")
        .attr("width", VIS.model_view.yearly.pie + "px")
        .append("g")
        .attr("transform", "translate(" +
            VIS.model_view.yearly.pie / 2 + "," +
            VIS.model_view.yearly.pie / 2 + ")")
        .selectAll("g.arc")
        .data(function (d) {
            var total = 0,
                s = topics[d.i].topics.map(function (x) {
                    total += x.weight;
                    return {
                        weight: x.weight,
                        highlight: (x.topic === d.topic),
                        topic: x.topic
                    };
                });

            // fill out the pie with a dummy element
            s.push({
                weight: 1.0 - total
            });

            return pie(s);
        })
        .enter().append("g").classed("arc", true);

    gs.append("path")
        .attr("d", arc)
        .style("fill", function (d) {
            return isFinite(d.data.topic) ? colors(d.data.topic % 20)
                : "white";
        })
        .classed("highlight", function (d) {
            return Boolean(d.data.highlight);
        });

    tds.append("a")
        .text(function (d) {
            return topic_label(m, d.topic, VIS.model_view.yearly.words);
        })
        .attr("href", function (d) {
            return "#/topic/" + (d.topic + 1) + "/" + topics[d.i].year;
        })
        .style("color", function (d) {
            return colors(d.topic % 20);
        });




    VIS.ready.model_yearly = true;
    d3.select("div#model_view_yearly").classed("hidden", false);
    return true;
};

topic_coords_grid = function (n) {
    var n_col = Math.floor(Math.sqrt(VIS.model_view.aspect * n)),
        n_row = Math.floor(n / n_col),
        remain = n - n_row * n_col,
        i, j,
        result = [];

    // Rectangular grid. TODO: closest possible packing?
    for (i = n_row - 1; i >= 0; i -= 1, remain -= 1) {
        for (j = 0; j < n_col + ((remain > 0) ? 1 : 0); j += 1) {
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

    if (VIS.cur_view !== undefined && !VIS.view_updating) {
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

    VIS.view_updating = false;

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

plot_svg = function (selector, spec) {
    var svg;

    if (!VIS.svg) {
        VIS.svg = d3.map();
    }
    if (VIS.svg.has(selector)) {
        return VIS.svg.get(selector);
    }

    svg = append_svg(d3.select(selector), spec);

    VIS.svg.set(selector, svg);
    return svg;
};

append_svg = function(selection, spec) {
    // mbostock margin convention
    // http://bl.ocks.org/mbostock/3019563
    return selection.append("svg")
            .attr("width", spec.w + spec.m.left + spec.m.right)
            .attr("height", spec.h + spec.m.top + spec.m.bottom)
        // g element passes on xform to all contained elements
        .append("g")
            .attr("transform",
                  "translate(" + spec.m.left + "," + spec.m.top + ")");
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
                view_error("Unable to load topic words from " + dfb.files.tw);
            }
        });
        load_data(dfb.files.doc_len, function (error, doc_len_s) {
            m.set_doc_len(doc_len_s);
            view_refresh(m, window.location.hash);
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

