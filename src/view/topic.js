/*global view, VIS, utils, d3 */
"use strict";

view.topic = function (p) {
    var div = d3.select("div#topic_view");

    // heading information
    // -------------------

    div.select("#topic_header").text(p.label);

    // (later: nearby topics by J-S div or cor on log probs)
};

view.topic.words = function (words) {
    var trs, trs_enter;

    trs = d3.select("table#topic_words tbody")
        .selectAll("tr")
        .data(words);

    trs_enter = trs.enter().append("tr");
    trs.exit().remove();

    trs.on("click", function (w) {
        view.dfb().set_view({
            type: "word",
            param: w.word
        });
    });

    trs_enter.append("td").classed("topic_word", true)
        .append("a");

    trs.select("td.topic_word a")
        .attr("href", function (w) {
            return view.dfb().view_link({ type:"word", param: +w.word });
        })
        .text(function (w) { return w.word; });

    view.weight_tds({
        sel: trs,
        enter: trs_enter,
        w: function (w) { return w.weight / words[0].weight; }
    });
};

view.topic.docs = function (p) {
    var header_text, trs, trs_enter,
        docs = p.docs;

    if (p.condition !== undefined) {
        header_text = ": ";
        if (p.type !== "time") {
            header_text += p.condition_name + " ";
        }
        header_text += p.key.display(p.condition);

        // the clear-selected-condition button
        d3.select("#topic_condition_clear")
            .classed("disabled", false)
            .on("click", function () {
                d3.select(".selected_condition")
                    .classed("selected_condition", false);
                view.dfb().set_view({
                    type: "topic",
                    param: p.t
                });
            })
            .classed("hidden", false);

    } else {
        header_text = "";
        d3.select("#topic_condition_clear")
            .classed("disabled", true);
    }


    d3.selectAll("#topic_docs span.topic_condition")
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

    trs = d3.select("#topic_docs tbody")
        .selectAll("tr")
        .data(docs);

    trs_enter = trs.enter().append("tr");
    trs.exit().remove();

    trs_enter.append("td")
        .append("a").classed("citation", true);
    trs.select("a.citation")
        .html(function (d, j) {
            return p.citations[j];
        });

    trs.on("click", function (d, j) {
        view.dfb().set_view({ type: "doc", param: p.doc_ids[j] });
    });

    view.weight_tds({
        sel: trs,
        enter: trs_enter,
        w: function (d) { return d.frac; },
        frac: function (d) {
            return d3.format(VIS.percent_format)(d.frac);
        },
        raw: p.proper ? undefined : function (d) { return d.weight; }
    });
};

view.topic.conditional = function (p) {
    var spec = utils.clone(VIS.topic_view);
    spec.w = d3.select("#topic_conditional").node().clientWidth || spec.w;
    spec.w = Math.max(spec.w, VIS.topic_view.w); // set a min. width
    spec.w -= spec.m.left + spec.m.right;
    spec.h = Math.floor(spec.w / VIS.topic_view.aspect)
        - spec.m.top - spec.m.bottom;

    // copy over conditional variable information to bar-step spec
    spec.time.step = VIS.condition.spec;
    p.svg = d3.select("div#topic_plot").selectAll("svg")
        .data([1]);
    p.svg.enter().call(view.append_plot);
    p.svg = view.setup_plot(p.svg, spec);
    p.axes = true;
    p.clickable = true;
    p.spec = spec;
    view.topic.conditional_barplot(p);
};

view.topic.conditional_barplot = function (param) {
    var series,
        step, w, w_click,
        bar_offset, bar_offset_click,
        scale_x,
        scale_y,
        bars, bars_enter,
        bars_click,
        axes, ax_label, tick_padding,
        tip_text,
        tx_duration = param.transition ? param.spec.tx_duration: 0,
        svg = param.svg,
        spec = param.spec;

    series = param.data.keys().sort().map(function (y) {
        return {
            key: y,
            x: param.key.invert(y),
            y: param.data.get(y)
        };
    });

    // roll-your-own rangeBands for time and continuous variables
    if (param.type === "continuous") {
        // find minimum-width step in domain series
        series[0].w = Infinity;
        step = series.reduce(function (acc, d) {
            return {
                x: d.x,
                w: Math.min(d.x - acc.x, acc.w)
            };
        }).w;
        delete series[0].w;

        scale_x = d3.scale.linear()
            .domain([series[0].x,
                series[series.length - 1].x + step * spec.continuous.bar.w])
            .range([0, spec.w]);
        // .nice();

        w = scale_x(series[0].x + step * spec.continuous.bar.w)
            - scale_x(series[0].x);
        bar_offset = -w / 2;
        w_click = scale_x(series[0].x + step) - scale_x(series[0].x);
        bar_offset_click = -w_click / 2;
        tick_padding = w_click / 2;
    } else if (param.type === "time") {
        scale_x = d3.time.scale.utc()
            .domain([series[0].x,
                d3.time[spec.time.bar.unit].utc.offset(
                    series[series.length - 1].x, spec.time.bar.w)
            ])
            .range([0, spec.w]);
        //.nice();

        w = scale_x(d3.time[spec.time.bar.unit].utc.offset(
                    series[0].x, spec.time.bar.w))
            - scale_x(series[0].x);
        bar_offset = -w / 2;
        w_click = scale_x(
                d3.time[spec.time.step.unit].utc.offset(
                    series[0].x, spec.time.step.n))
            - scale_x(series[0].x);
        bar_offset_click = -w_click / 2;
        tick_padding = w_click / 2;
    } else {
        // assume ordinal
        scale_x = d3.scale.ordinal()
            .domain(series.map(function (d) { return d.x; }))
            .rangeRoundBands([0, spec.w], spec.ordinal.bar.w,
                    spec.ordinal.bar.w);
        w = scale_x.rangeBand();
        bar_offset = 0;
        w_click = scale_x(series[1].x) - scale_x(series[0].x);
        bar_offset_click = (w - w_click) / 2;
        tick_padding = 3; // the d3 default
    }

    scale_y = d3.scale.linear()
        .domain([0, d3.max(series, function (d) {
            return d.y;
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

                if (v === "x") { // x axis
                    if (param.type === "time") {
                        if (spec.time.ticks.unit) {
                            ax.ticks(d3.time[spec.time.ticks.unit].utc,
                                    spec.time.ticks.n);
                        } else if (typeof spec.time.ticks === "number") {
                            ax.ticks(spec.time.ticks);
                        }
                    } else {
                        ax.ticks(spec[param.type].ticks);
                    }
                } else { // y axis
                    ax.tickSize(-spec.w)
                        .outerTickSize(0)
                        .tickFormat(d3.format(VIS.percent_format))
                        .tickPadding(tick_padding)
                        .ticks(spec.ticks_y);
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
        ax_label = svg.selectAll("text.axis_label")
            .data([1]);
        ax_label.enter().append("text");
        ax_label.classed("axis_label", true)
            .attr("x", spec.w / 2)
            .attr("y", spec.h + spec.m.bottom)
            .attr("text-anchor", "middle")
            .text(param.condition_name);
    }

    // bars
    // ----

    bars = svg.selectAll("g.topic_proportion")
        .data(series, function (s) { return s.key; }); // keyed for txns

    // for each x value, we will have two rects in a g: one showing the topic
    // proportion and an invisible one for mouse interaction,
    // following the example of http://bl.ocks.org/milroc/9842512
    bars_enter = bars.enter().append("g")
        .classed("topic_proportion", true)
        .attr("transform", function (d) {
            // new bars shouldn't transition out from the left,
            // so preempt that
            return "translate(" + scale_x(d.x) + ",0)";
        });

    bars.exit().remove(); // also removes child display and interact rects

    if (param.clickable) {
        // add the clickable bars, which are as high as the plot
        // and a full step wide
        bars_enter.append("rect").classed("interact", true);

        bars_click = bars.select("rect.interact");

        bars_click.transition()
            .duration(tx_duration)
            .attr("x", bar_offset_click)
            .attr("y", 0)
            .attr("width", w_click)
            .attr("height", spec.h);
    }

    // set a selected bar if any
    bars.classed("selected_condition", function (d) {
        return d.key === param.condition;
    });

    // add the visible bars
    bars_enter.append("rect").classed("display", true)
        .style("fill", param.color)
        .style("stroke", param.color);

    // the g sets the x position of each pair of bars
    bars.transition()
        .duration(tx_duration)
        .attr("transform", function (d) {
            return "translate(" + scale_x(d.x) + ",0)";
        })
        .select("rect.display")
        .attr("x", bar_offset)
        .attr("y", function (d) {
            return scale_y(d.y);
        })
        .attr("width", w)
        .attr("height", function (d) {
            return spec.h - scale_y(d.y);
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
        tip_text = function (d) { return param.key.display(d.key); };

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
                if(d3.select(this.parentNode).classed("selected_condition")) {
                    d3.select(this.parentNode)
                        .classed("selected_condition", false);
                    view.tooltip().text(tip_text(d));
                    view.dfb().set_view({
                        type: "topic",
                        param: param.t
                    });
                } else {
                    // TODO selection of multiple conditions
                    // should use a brush http://bl.ocks.org/mbostock/6232537
                    d3.selectAll(".selected_condition")
                        .classed("selected_condition", false);
                    d3.select(this.parentNode)
                        .classed("selected_condition", true);
                    view.tooltip().text(tip_text(d));
                    view.dfb().set_view({
                        type: "topic",
                        param: [param.t, d.key]
                    });
                }
            });
    }

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

view.topic.dropdown = function (p) {
    var lis;
    // Set up topic menu: remove loading message
    d3.select("ul#topic_dropdown").selectAll("li.loading_message").remove();

    // Add menu items
    lis = d3.select("ul#topic_dropdown")
        .selectAll("li")
        .data(p.topics, function (t) {
            return t.topic;
        });

    lis.enter().append("li").append("a");
    lis.exit().remove();
    lis.select("a")
        .text(function (t) {
            var words = t.words
                .slice(0, p.overview_words)
                .map(function (w) { return w.word; })
                .join(" ");
            return t.label + ": " + words;
        })
        .attr("href", function (t) {
            return view.dfb().view_link({
                type: "topic",
                param: t.id
            });
        });
    lis.sort(function (a, b) {
        return d3.ascending(view.topic.sort_name(a.label),
            view.topic.sort_name(b.label));
    });

    lis.classed("hidden_topic", function (t) {
        return t.hidden;
    });
};
