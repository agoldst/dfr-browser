/*global view, VIS, utils, d3 */
"use strict";

view.topic = function (p) {
    var div = d3.select("div#topic_view");

    // heading information
    // -------------------

    div.select("#topic_header").text(p.label);

    // (later: nearby topics by J-S div or cor on log probs)
};

view.topic.remark = function (p) {
    d3.select("#topic_view #topic_remark")
        .text(VIS.percent_format(p.col_sum / p.total_tokens)
                + " of corpus");
};

view.topic.words = function (words) {
    var trs_w;

    if (view.updating() && !view.dirty("topic/words")) {
        return;
    }

    trs_w = d3.select("table#topic_words tbody")
        .selectAll("tr")
        .data(words);

    trs_w.enter().append("tr");
    trs_w.exit().remove();

    trs_w.on("click", function (w) {
        view.dfb().set_view("/word/" + w.word);
    });

    // clear rows
    trs_w.selectAll("td").remove();

    trs_w.append("td").append("a")
        .attr("href", function (w) {
            return "#/word/" + w.word;
        })
        .text(function (w) { return w.word; });

    view.append_weight_tds(trs_w, function (w) {
        return w.weight / words[0].weight;
    });

    view.dirty("topic/words", false);
};

view.topic.docs = function (p) {
    var header_text, trs_d,
        docs = p.docs;

    if (p.year !== undefined) {
        header_text = " in " + p.year;

        // the clear-selected-year button
        d3.select("#topic_year_clear")
            .classed("disabled", false)
            .on("click", function () {
                d3.select(".selected_year").classed("selected_year", false);
                view.updating(true);
                view.dfb().set_view(view.topic.hash(p.t));
            })
            .classed("hidden", false);

    } else {
        header_text = "";
        d3.select("#topic_year_clear")
            .classed("disabled", true);
    }


    d3.selectAll("#topic_docs span.topic_year")
        .text(header_text);

    if (docs === undefined || docs.length === 0) {
        d3.selectAll("#topic_docs .none")
            .classed("hidden", false);
        d3.select("#topic_docs table")
            .classed("hidden", true);
        return true;
    }
    d3.selectAll("#topic_docs .none")
        .classed("hidden", true);
    d3.select("#topic_docs table")
        .classed("hidden", false);

    trs_d = d3.select("#topic_docs tbody")
        .selectAll("tr")
        .data(docs);

    trs_d.enter().append("tr");
    trs_d.exit().remove();

    // clear rows
    trs_d.selectAll("td").remove();

    trs_d
        .append("td")
        .append("a")
        .html(function (d, j) {
            return p.citations[j];
        });

    trs_d.on("click", function (d) {
        view.dfb().set_view("/doc/" + d.doc);
    });

    view.append_weight_tds(trs_d, function (d) { return d.frac; });

    trs_d.append("td")
        .classed("td-right", true)
        .text(function (d) {
            return VIS.percent_format(d.frac);
        });

    trs_d.append("td")
        .classed("td-right", true)
        .text(function (d) {
            return d.weight;
        });

    view.dirty("topic/docs", false);
};

view.topic.yearly = function (p) {
    var spec = VIS.topic_view;
    spec.w = d3.select("#topic_yearly").node().clientWidth || spec.w;
    spec.w = Math.max(spec.w, VIS.topic_view.w); // set a min. width
    spec.w -= spec.m.left + spec.m.right;
    spec.h = Math.floor(spec.w / VIS.topic_view.aspect)
        - spec.m.top - spec.m.bottom;

    view.topic.yearly_barplot({
        t: p.t,
        yearly: p.yearly,
        svg: view.plot_svg("div#topic_plot", spec),
        axes: true,
        clickable: true,
        year: p.year,
        spec: spec
    });
};

view.topic.yearly_barplot = function (param) {
    var series = [],
        scale_x,
        scale_y,
        w,
        w_click,
        bars, bars_enter,
        bars_click,
        axes,
        tip_text,
        tx_duration = view.dirty("topic/yearly") ? 1000 : 0,
        svg = param.svg,
        spec = param.spec;

    series = param.yearly.keys().sort().map(function (y) {
        return [new Date(Date.UTC(+y, 0, 1)), param.yearly.get(y)];
    });

    scale_x = d3.time.scale.utc()
        .domain([series[0][0],
                d3.time.day.utc.offset(series[series.length - 1][0],
                    spec.bar_width)])
        .range([0, spec.w]);
        //.nice();

    w = scale_x(d3.time.day.utc.offset(series[0][0], spec.bar_width)) -
        scale_x(series[0][0]);

    w_click = scale_x(d3.time.year.utc.offset(series[0][0], 1)) -
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
        axes = svg.selectAll("g.axis")
            .data(["x", "y"]);

        axes.enter().append("g").classed("axis", true)
            .classed("x", function (v) {
                return v === "x";
            })
            .classed("y", function (v) {
                return v === "y";
            })
            .attr("transform", function (v) {
                return v === "x" ? "translate(0," + spec.h + ")"
                    : "translate(-5, 0)";
            });

        axes.transition()
            .duration(tx_duration)
            .attr("transform", function (v) {
                return v === "x" ? "translate(0," + spec.h + ")"
                    : undefined;
            })
            .each(function (v) {
                var sel = d3.select(this),
                    ax = d3.svg.axis()
                        .scale(v === "x" ? scale_x : scale_y)
                        .orient(v === "x" ? "bottom" : "left");

                if (v === "x") {
                    ax = ax.ticks(d3.time.years.utc, spec.ticks);
                } else {
                    ax = ax.tickSize(-spec.w)
                        .outerTickSize(0)
                        .tickFormat(VIS.percent_format)
                        .tickPadding(w_click / 2)
                        .ticks(spec.ticks);
                }
                // redraw axis
                sel.call(ax);

                // set all y gridlines to minor except baseline
                if (v === "y") {
                    sel.selectAll("g")
                        .filter(function (d) { return d > 0; })
                        .classed("minor", true);
                }
            });
    }

    // bars
    // ----

    bars = svg.selectAll("g.topic_proportion")
        .data(series, function (s) {
            return String(s[0].getUTCFullYear());
        }); // key by year

    // for each year, we will have two rects in a g: one showing the yearly
    // proportion and an invisible one for mouse interaction,
    // following the example of http://bl.ocks.org/milroc/9842512
    bars_enter = bars.enter().append("g")
        .classed("topic_proportion", true)
        .attr("transform", function (d) {
            // new bars shouldn't transition out from the left, so preempt that
            return "translate(" + scale_x(d[0]) + ",0)";
        });

    bars.exit().remove(); // should also remove child display and interact rects

    if (param.clickable) {
        // add the clickable bars, which are as high as the plot
        // and a year wide
        bars_enter.append("rect").classed("interact", true);

        bars_click = bars.select("rect.interact");

        bars_click.transition()
            .duration(tx_duration)
            .attr("x", -w_click / 2.0)
            .attr("y", 0)
            .attr("width", w_click)
            .attr("height", function (d) {
                return spec.h;
            });
    }

    // set a selected year if any
    bars.classed("selected_year", function (d) {
        return String(d[0].getUTCFullYear()) === param.year;
    });

    // add the visible bars
    bars_enter.append("rect").classed("display", true)
        .style("fill", param.color)
        .style("stroke", param.color);

    // the g sets the x position of each pair of bars
    bars.transition()
        .duration(tx_duration)
        .attr("transform", function (d) {
            return "translate(" + scale_x(d[0]) + ",0)";
        })
        .select("rect.display")
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

        // tooltip text
        tip_text = function (d) { return d[0].getUTCFullYear(); };

        // now set mouse event handlers

        bars_click.on("mouseover", function (d) {
                var g = d3.select(this.parentNode);
                g.select(".display").classed("hover", true); // display bar
                view.tooltip().text(tip_text(d));
                view.tooltip().update_pos();
                view.tooltip().show();
            })
            .on("mousemove", function (d) {
                view.tooltip().update_pos();
            })
            .on("mouseout", function (d) {
                d3.select(this.parentNode).select(".display") // display bar
                    .classed("hover", false);
                view.tooltip().hide();
            })
            .on("click", function (d) {
                if(d3.select(this.parentNode).classed("selected_year")) {
                    d3.select(this.parentNode).classed("selected_year", false);
                    view.tooltip().text(tip_text(d));
                    view.updating(true);
                    view.dfb().set_view(view.topic.hash(param.t));
                } else {
                    // TODO selection of multiple years
                    // should use a brush http://bl.ocks.org/mbostock/6232537
                    d3.selectAll(".selected_year")
                        .classed("selected_year", false);
                    d3.select(this.parentNode).classed("selected_year", true);
                    view.tooltip().text(tip_text(d));
                    view.updating(true);
                    view.dfb().set_view(
                        view.topic.hash(param.t) + "/"
                        + d[0].getUTCFullYear()
                    );
                }
            });
    }

    view.dirty("topic/yearly", false);
};

// Topic sorting rule: explicit labels over default "Topic NNN"
// achieved by ugly kludge
view.topic.sort_name = function (label) {
    var nn = label.match(/^Topic\s(\d+)$/);
    if (nn) {
        return "zzz" + d3.format("05d")(+(nn[1]));
    }
    
    return label.replace(/^(the|a|an) /i, "").toLowerCase();
};

view.topic.dropdown = function (topics) {
    var lis;
    // Set up topic menu: remove loading message
    d3.select("ul#topic_dropdown").selectAll("li.loading_message").remove();

    // Add menu items 
    lis = d3.select("ul#topic_dropdown")
        .selectAll("li")
        .data(topics, function (t) {
            return t.topic;
        });

    lis.enter().append("li").append("a")
        .text(function (t) {
            var words = t.words
                .slice(0, VIS.overview_words)
                .map(function (w) { return w.word; })
                .join(" ");
            return t.label + ": " + words;
        })
        .attr("href", function (t) {
            return view.topic.link(t.topic);
        });
    lis.sort(function (a, b) {
        return d3.ascending(view.topic.sort_name(a.label),
            view.topic.sort_name(b.label));
    });

    lis.classed("hidden_topic", function (t) {
        return t.hidden;
    });
};

// Here we encode the fact that user-facing topic-view links use the 1-based
// topic index. dfb().topic_view() also expects the 1-based index.
view.topic.link = function (t) {
    return "#" + view.topic.hash(t);
};

view.topic.hash = function (t) {
    return "/topic/" + String(t + 1);
};

