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
    yearly_stacked_series,
    tooltip,
    view_refresh,
    view_loading,
    view_error,
    view_warning,
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

    if (!m.meta() || !m.dt() || !m.tw()) {
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
        .text("α = " + VIS.float_format(m.alpha(t))
                + "; "
                + VIS.percent_format(m.dt.col_sum(t) / m.total_tokens())
                + " of corpus.");

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

    add_weight_cells(trs_w, function (w) {
        return w.weight / words[0].weight;
    });

};

add_weight_cells = function (sel, f) {
    sel.append("td").classed("weight", true)
        .append("div")
            .classed("proportion", true)
            .style("margin-left", function (w) {
                return d3.format(".1%")(1 - f(w));
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

    add_weight_cells(trs_d, function (d) { return d.frac; });

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
        tip_text,
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
        })
        .style("fill", param.color)
        .style("stroke", param.color);

    if (param.clickable) {
        bars.on("mouseover", function (d) {
                d3.select(this).classed("hover", true);
            })
            .on("mouseout", function (d) {
                d3.select(this).classed("hover", false);
            });

        // interactivity for the bars

        // tooltip text
        tip_text = function (d) { return d[0].getFullYear(); };

        // now set mouse event handlers

        bars_click.on("mouseover", function (d) {
                var g = d3.select(this.parentNode);
                g.select(".display").classed("hover", true); // display bar
                tooltip().text(tip_text(d));
                tooltip().update_pos();
                tooltip().show();
            })
            .on("mousemove", function (d) {
                tooltip().update_pos();
            })
            .on("mouseout", function (d) {
                d3.select(this.parentNode).select(".display") // display bar
                    .classed("hover", false);
                tooltip().hide();
            })
            .on("click", function (d) {
                if(d3.select(this.parentNode).classed("selected_year")) {
                    d3.select(this.parentNode).classed("selected_year", false);
                    tooltip().text(tip_text(d));
                    VIS.view_updating = true;
                    window.location.hash = topic_hash(t);
                } else {
                    // TODO selection of multiple years
                    // should use a brush http://bl.ocks.org/mbostock/6232537
                    d3.selectAll(".selected_year")
                        .classed("selected_year", false);
                    d3.select(this.parentNode).classed("selected_year", true);
                    tooltip().text(tip_text(d));
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
        topics, n,
        words = [],
        spec, row_height,
        svg, scale_x, scale_y, scale_bar,
        gs_t, gs_t_enter, gs_w, gs_w_enter,
        tx_w;

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
    view.selectAll("#word_view span.word") // sets header and help
        .text(word);

    topics = m.word_topics(word);

    view.select("#word_no_topics").classed("hidden", topics.length !== 0);
    view.select("table#word_topics").classed("hidden", topics.length === 0);
    view.select("#word_view_explainer").classed("hidden", topics.length === 0);

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
        return ws.map(function (wrd, i) {
            if (i === 0) {
                max_weight = m.tw(t.topic, wrd);
            }
            // normalize weights relative to the weight of the word ranked 1
            return {
                word: wrd,
                weight: m.tw(t.topic, wrd) / max_weight
            };
        });
    });

    spec = {
        w: VIS.word_view.w,
        h: VIS.word_view.row_height * (m.n() + 1),
        m: VIS.word_view.m
    };

    row_height = VIS.word_view.row_height;
    svg = plot_svg("#word_view_main", spec);
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

    if (!m.meta() || !m.dt() || !m.tw()) {
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
        .html(m.dt.row_sum(doc) + " tokens. "
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

            add_weight_cells(trs, function (t) {
                return t.weight / m.dt.row_sum(doc);
            });

            trs.append("td")
                .text(function (t) {
                    return t.weight;
                });
            trs.append("td")
                .text(function (t) {
                    return VIS.percent_format(t.weight / m.dt.row_sum(doc));
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
                    .order(); // stable because bound data is just indices
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

model_view = function (m, type, p1, p2) {
    var type_chosen = type || VIS.last.model || "grid";

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

    // hide all subviews and controls; we'll reveal the chosen one
    d3.select("#model_view_plot").classed("hidden", true);
    d3.select("#model_view_list").classed("hidden", true);
    d3.select("#model_view_yearly").classed("hidden", true);
    d3.selectAll(".model_view_plot").classed("hidden", true);
    d3.selectAll(".model_view_list").classed("hidden", true);
    d3.selectAll(".model_view_yearly").classed("hidden", true);

    // reveal navbar
    d3.select("#model_view nav").classed("hidden", false);

    if (type_chosen === "list") {
        if (!m.meta() || !m.dt()) {
            view_loading(true);
            return true;
        }

        model_view_list(m, p1, p2);
        d3.selectAll(".model_view_list").classed("hidden", false);
        d3.select("#model_view_list").classed("hidden", false);
    } else if (type_chosen === "yearly") {
        if (!m.meta() || !m.dt()) {
            view_loading(true);
            return true;
        }

        model_view_yearly(m, p1);
        d3.selectAll(".model_view_yearly").classed("hidden", false);
        d3.select("#model_view_yearly").classed("hidden", false);
    } else { // default to grid
        // if loading scaled coordinates failed,
        // we expect m.topic_scaled() to be defined but empty
        if (!m.topic_scaled() || !m.dt()) {
            view_loading(true);
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

    view_loading(false);
    return true;
};

model_view_list = function (m, sort, dir) {
    var trs, divs, token_max,
        keys, sorter, sort_choice, sort_dir;

    if (!VIS.ready.model_list) {
        d3.select("th#model_view_list_year a")
            .text(d3.min(m.years()) + "—" + d3.max(m.years()));

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

        token_max = d3.max(m.dt.col_sum());
        add_weight_cells(trs, function (t) {
            return m.dt.col_sum(t) / token_max;
        });
        trs.append("td")
            .text(function (t) {
                return VIS.percent_format(m.dt.col_sum(t) / m.total_tokens());
            });

        VIS.ready.model_list = true;
    } // if (!VIS.ready.model_list)

    // sorting

    if (!VIS.last.model_list) {
        VIS.last.model_list = { };
    }

    sort_choice = sort || VIS.last.model_list.sort;
    sort_dir = (sort_choice === VIS.last.model_list.sort) ?
        (dir || VIS.last.model_list.dir) : "up";

    keys = d3.range(m.n());
    if (sort_choice === "words") {
        keys = keys.map(function (t) {
            return m.topic_words(t, 5).join(" ");
        });
    } else if (sort_choice === "frac") {
        // default ordering should be largest frac to least,
        // so the sort keys are negative proportions
        keys = keys.map(function (t) {
            return -m.dt.col_sum(t) / m.total_tokens();
        });
    } else if (sort_choice === "year") {
        keys = keys.map(function (t) {
            var result, max_weight = 0;
            m.topic_yearly(t).forEach(function (year, weight) {
                if (weight > max_weight) {
                    result = year;
                    max_weight = weight;
                }
            });
            return result;
        });
    } else {
        // otherwise, enforce the default: by topic number
        sort_choice = "topic";
    }

    if (sort_dir === "down") {
        sorter = function (a, b) {
            return d3.descending(keys[a], keys[b]) ||
                d3.descending(a, b); // stabilize sort
        };
    } else {
        // default: up
        sorter = function (a, b) {
            return d3.ascending(keys[a], keys[b]) ||
                d3.ascending(a, b); // stabilize sort
        };
    }

    // remember for the next time we visit #/model/list
    VIS.last.model_list.sort = sort_choice;
    VIS.last.model_list.dir = sort_dir;

    d3.selectAll("#model_view_list table tbody tr")
        .sort(sorter)
        .order();

    d3.selectAll("#model_view_list th.sort")
        .classed("active", function () {
            return !!this.id.match(sort_choice);
        })
        .each(function () {
            var ref = "#/" + this.id.replace(/_(view_)?/g, "/");
            if (this.id.match(sort_choice)) {
                ref += (sort_dir === "down") ? "/up" : "/down";
            }

            d3.select(this).select("a")
                .attr("href", ref);
        })
        .on("click", function () {
            window.location.hash = d3.select(this).select("a")
                .attr("href").replace(/#/, "");
        });


    return true;
};

model_view_plot = function(m, type) {
    var spec, svg, cloud_size, circle_radius, range_padding,
        coords,
        domain_x, domain_y,
        scale_x, scale_y, scale_size, scale_stroke,
        gs, translation, zoom;

    // TODO need visual indication of stroke ~ alpha mapping

    // TODO really the best way to size this plot?
    spec = {
        w: VIS.model_view.w,
        h: Math.floor(VIS.model_view.w / VIS.model_view.aspect),
        m: {
            left: 0,
            right: 0,
            top: 0,
            bottom: 0
        }
    };

    svg = plot_svg("#model_view_plot", spec);

    // rough attempt to fill total circle area in plot window 
    // 2.25 rather than 2 is pure fudge factor
    circle_radius = Math.floor(spec.w /
            (2.25 * Math.sqrt(VIS.model_view.aspect * m.n())));
    // Allow the cloud to spill outside circle a little
    cloud_size = Math.floor(circle_radius * 2.1);
    range_padding = 1.1 * circle_radius;

    // zoom-target rectangle
    svg.selectAll("rect.bg")
        .data([1])
        .enter().append("rect")
            .attr("width", spec.w)
            .attr("height", spec.h)
            .classed("bg", true);

    if (type === "scaled") {
        coords = m.topic_scaled().map(function (p, j) {
            return {
                x: p[0],
                y: p[1],
                t: j,
                r: circle_radius
            };
        });
    } else {
        // default to grid
        coords = topic_coords_grid(m.n()).map(function (p, j) {
            return {
                x: p.x,
                y: p.y,
                t: j,
                r: circle_radius
            };
        });
    }

    domain_x = d3.extent(coords, function (d) { return d.x; });
    domain_y = d3.extent(coords, function (d) { return d.y; });


    scale_x = d3.scale.linear()
        .domain(domain_x)
        .range([range_padding, spec.w - range_padding]);

    scale_y = d3.scale.linear()
        .domain(domain_y)
        .range([spec.h - range_padding, range_padding]);

    scale_size = d3.scale.sqrt()
        .domain([0, 1])
        .range(VIS.model_view.size_range);

    scale_stroke = d3.scale.linear()
        .domain([0,d3.max(m.dt.col_sum())])
        .range([0,VIS.model_view.stroke_range]);

    gs = svg.selectAll("g")
        .data(coords);

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
                .attr("r", function (p) {
                    return p.r;
                })
                .classed("topic_cloud", true)
                .attr("stroke-width", function (p) {
                    return scale_stroke(m.dt.col_sum(p.t));
                })
                .on("click", function (p) {
                    if (!d3.event.shiftKey) {
                        window.location.hash = topic_hash(t);
                    }
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
                })
                .on("mouseout",function() {
                    gs.sort(function (a, b) {
                            return d3.ascending(a.t, b.t);
                        })
                        .order();
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

model_view_yearly = function (m, type) {
    var spec = VIS.model_view.yearly, svg,
        scale_x, scale_y, axis_x, area,
        scale_color,
        raw,
        to_plot,
        paths, labels, render_labels,
        areas, zoom;

    svg = plot_svg("#model_view_yearly", spec);

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
            tooltip().text(topic_label(m, d.t, 4));
            tooltip().update_pos();
            tooltip().show();
        })
        .on("mousemove", function (d) {
            tooltip().update_pos();
        })
        .on("mouseout", function (d) {
            d3.select(this).style("fill", scale_color(d.t));
            tooltip().hide();
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

topic_coords_grid = function (n) {
    var n_col = Math.floor(Math.sqrt(VIS.model_view.aspect * n)),
        n_row = Math.floor(n / n_col),
        remain = n - n_row * n_col,
        remain_odd = Math.max(remain - Math.floor(n_row / 2), 0),
        cols,
        vskip,
        i, j,
        result = [];

    // for circles of equal size, closest possible packing is hexagonal grid
    // centers are spaced 1 unit apart on horizontal, sqrt(3) / 2 on vertical.
    // Alternate rows are displaced 1/2 unit on horizontal.
    vskip = Math.sqrt(3.0) / 2.0;

    // if n is not exactly n_row * n_col, we'll do our best sticking
    // things on the right-side margin

    for (i = 0; i < n_row; i += 1) {
        cols = n_col;
        if (remain > 0) {
            remain -= 1;
            if (i % 2 === 0) {
                cols = n_col + 1;
            } else {
                if (remain_odd > 0) {
                    remain_odd -= 1;
                    cols = n_col + 1;
                }
            }
        }

        for (j = 0; j < cols; j += 1) {
            result.push({
                x: j + 0.5 + ((i % 2 === 0) ? 0 : 0.5),
                y: (n_row - i) * vskip + 0.5 });
        }
    }

    return result;
};

yearly_stacked_series = function (m, raw) {
    var year_keys, years, all_series,
        stack, ord,
        data_frac, data_raw,
        stack_domain_y;

    if (!VIS.model_view.yearly.data) {
        VIS.model_view.yearly.data = { };

        year_keys = m.years().sort();
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

tooltip = function () {
    var that = VIS.tooltip || { };

    if (that.div) {
        return that;
    }

    that.div = d3.select("body").append("div")
        .attr("id", "tooltip")
        .classed("bar_tooltip", true);
    that.container = d3.select("body").node();

    that.div.append("p");


    that.update_pos = function () {
        var mouse_pos = d3.mouse(this.container);
        this.div.style({
                left: (mouse_pos[0] + this.offset.x) + 'px',
                top: (mouse_pos[1] + this.offset.y) + 'px',
                position: "absolute"
            });
    };
    that.text = function (text) {
        this.div.select("p").text(text);
    };
    that.show = function () {
        this.div.classed("hidden", false);
    };
    that.hide = function () {
        this.div.classed("hidden", true);
    };

    VIS.tooltip = that;
    return that;
};

view_loading = function (flag) {
    // don't say we're loading if we have an error
    d3.select("div#loading").classed("hidden", !flag || !!VIS.error);
};

view_error = function (msg) {
    d3.select("div#error").append("p").text(msg);
    d3.select("div#error").classed("hidden", false);
    view_loading(false);
    VIS.error = true;
};

view_warning = function (msg) {
    d3.select("div#warning").append("p").text(msg);
    d3.select("div#warning").classed("hidden", false);
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
    if (m.info()) {
        VIS = utils.deep_replace(VIS, m.info().VIS);

        // model title
        d3.selectAll(".model_title")
            .html(m.info().title);
    }

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
                if (response && response.status === 200) {
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
        var m = model();

        // We need to know whether we got new VIS parameters before we
        // do the rest of the loading, but if info is missing, it's not
        // really the end of the world

        if (typeof info_s === 'string') {
            m.info(JSON.parse(info_s));
        } else {
            view_warning("Unable to load model info from " + dfb.files.info);
        }

        setup_vis(m);

        // TODO no need to globally expose the model, but handy for debugging
        // __DEV_ONLY__
        VIS.m = m;
        // __END_DEV_ONLY__

        // now launch remaining data loading; ask for a refresh when done
        load_data(dfb.files.meta, function (error, meta_s) {
            if (typeof meta_s === 'string') {
                m.set_meta(meta_s);
                view_refresh(m, window.location.hash);
            } else {
                view_error("Unable to load metadata from " + dfb.files.meta);
            }
        });
        load_data(dfb.files.dt, function (error, dt_s) {
            if (typeof dt_s === 'string') {
                m.set_dt(dt_s);
                view_refresh(m, window.location.hash);
            } else {
                view_error("Unable to load document topics from " +
                    dfb.files.dt);
            }
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

