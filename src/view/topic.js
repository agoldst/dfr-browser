/*global view, VIS, set_view, topic_hash, utils, d3 */
"use strict";

view.topic = function (p) {
    var div = d3.select("div#topic_view");

    // heading information
    // -------------------

    div.select("h2#topic_header")
        .text(view.topic.label(p.t,
                    utils.shorten(p.words, VIS.overview_words)));

    // (later: nearby topics by J-S div or cor on log probs)
};

view.topic.remark = function (p) {
    d3.select("#topic_view p#topic_remark")
        .text("α = " + VIS.float_format(p.alpha)
                + "; "
                + VIS.percent_format(p.col_sum / p.total_tokens)
                + " of corpus.");
};

view.topic.words = function (words) {
    var trs_w;

    if (view.updating()) {
        return;
    }

    trs_w = d3.select("table#topic_words tbody")
        .selectAll("tr")
        .data(words);

    trs_w.enter().append("tr");
    trs_w.exit().remove();

    trs_w.on("click", function (w) {
        set_view("/word/" + w.word);
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
                set_view(topic_hash(p.t));
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
        .append("td").append("a")
        .attr("href", function (d) {
            return "#/doc/" + d.doc;
        })
        .html(function (d, j) {
            return p.citations[j];
        });

    trs_d.on("click", function (d) {
        set_view("/doc/" + d.doc);
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
};

view.topic.yearly = function (p) {
    if (!view.updating()) {
        view.topic.yearly_barplot({
            t: p.t,
            yearly: p.yearly,
            svg: view.plot_svg("div#topic_plot", VIS.topic_view),
            axes: true,
            clickable: true,
            year: p.year,
            spec: VIS.topic_view
        });
    }
};

view.topic.yearly_barplot = function (param) {
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
                .ticks(d3.time.years.utc, spec.ticks));

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
        return String(d[0].getUTCFullYear()) === param.year;
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
                    set_view(topic_hash(param.t));
                } else {
                    // TODO selection of multiple years
                    // should use a brush http://bl.ocks.org/mbostock/6232537
                    d3.selectAll(".selected_year")
                        .classed("selected_year", false);
                    d3.select(this.parentNode).classed("selected_year", true);
                    view.tooltip().text(tip_text(d));
                    view.updating(true);
                    set_view(topic_hash(param.t) + "/" + d[0].getUTCFullYear());
                }
            });
    }

};

view.topic.label = function (t, words) {
    var i,
        result = String(t + 1); // user-facing index is 1-based
    for (i = 0; i < words.length; i += 1) {
        result += " " + words[i].word;
    }
    return result;
};
