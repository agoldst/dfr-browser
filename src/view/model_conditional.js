/*global view, VIS, d3 */
"use strict";

view.model.conditional = function (p) {
    var streamgraph = p.streamgraph && p.condition_type !== "ordinal",
        data = this.conditional.data;

    // recalculate and cache data if needed
    if (!data || data.signature !== p.signature
            || data.streamgraph !== p.streamgraph) {
        data = view.model.stacked_series({
            keys: p.key.range,
            xs: p.key.range.map(p.key.invert),
            totals: p.conditional_totals,
            topics: p.topics,
            streamgraph: streamgraph
        });
        data.streamgraph = streamgraph;
        data.signature = p.signature;
        this.conditional.data = data;
    }
    view.model.conditional_plot({
        condition_type: p.condition_type,
        condition_name: p.condition_name,
        data: data[p.raw ? "raw" : "frac"],
        domain_x: data.domain_x,
        domain_y: data[p.raw ? "domain_raw" : "domain_frac"],
        order: data.order,
        spec: VIS.model_view.conditional,
        raw: p.raw,
        selector: "#model_view_conditional"
    });

    d3.selectAll("#conditional_choice li").classed("active", false);
    d3.select(p.raw ? "#nav_model_conditional_raw"
            : "#nav_model_conditional_frac")
        .classed("active", true);
};

view.model.conditional_plot = function (p) {
    var spec = p.spec, svg,
        scale_x, scale_y, axis_x, ax_label, g_axis, area,
        scale_color,
        bg, clip,
        initial = false,
        mark, marks, other_marks, render_marks, rects,
        labels, render_labels,
        zoom;

    spec.w = d3.select(p.selector).node().clientWidth
        || spec.w;
    spec.w -= spec.m.left + spec.m.right; // inset margins
    spec.h = Math.floor(spec.w / spec.aspect);
    spec.h -= spec.m.top + spec.m.bottom;

    svg = d3.select(p.selector).selectAll("svg")
        .data([1]);
    svg.enter().call(view.append_plot);
    svg = view.setup_plot(svg, spec);

    bg = svg.selectAll("rect.bg")
        .data([1])
        .enter().append("rect").classed("bg", true);
    bg.attr("width", spec.w)
        .attr("height", spec.h)
        .classed("bg", true);

    clip = d3.select("#model_conditional_clip");
    if (clip.size() === 0) {
        clip = d3.select("#model_view_conditional svg").append("clipPath")
            .attr("id", "model_conditional_clip");
        clip.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", spec.w)
            .attr("height", spec.h);
    }

    d3.select("#model_conditional_clip rect").transition().duration(1000)
        .attr("width", spec.w)
        .attr("height", spec.h);

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
            p.order.forEach(function (k, r) { seq[k] = r; });
        return function (t, highlight) {
            var c = cat20(seq[t] % 20);
            return highlight ? d3.hsl(c).brighter(0.5).toString() : c;
        };
    }());

    if (p.condition_type === "ordinal") {
        // default: ordinal
        scale_x = d3.scale.ordinal()
            .domain(p.domain_x)
            .rangeRoundBands([0, spec.w], spec.ordinal.bar);
        mark = "g"; // groups of rects
    } else {
        // default is continuous scale, areas as marks
        scale_x = (p.condition_type === "time") ?
            d3.time.scale.utc() : d3.scale.linear();
        scale_x.domain(p.domain_x)
            .range([0, spec.w]);
        mark = "path"; // areas
    }

    scale_y = d3.scale.linear()
        .domain(p.domain_y)
        .range([spec.h, 0])
        .nice();

    // x axis (no y axis: streamgraph makes it meaningless)
    axis_x = d3.svg.axis()
        .scale(scale_x)
        .orient("bottom");

    g_axis = svg.selectAll("g.axis")
        .data([1]);
    g_axis.enter().append("g").classed("axis", true).classed("x", true)
        .attr("transform", "translate(0," + spec.h + ")");

    // TODO transition here gives javascript errors under some conditions
    // namely, switching between ordinal and time/continuous variables
    // on already-loaded models. Can't trace what I suspect is a race condition
    //
    //g_axis.transition("model-conditional-axis")
        //.duration(1000)
    g_axis.attr("transform", "translate(0," + spec.h + ")")
        .call(axis_x);

    ax_label = svg.selectAll("text.axis_label")
        .data([1]);
    ax_label.enter().append("text");
    ax_label.classed("axis_label", true)
        .attr("x", spec.w / 2)
        .attr("y", spec.h + spec.m.bottom)
        .attr("text-anchor", "middle")
        .text(p.condition_name);

    // marks group (we want to ensure that the labels are always drawn after
    // the marks, even if we add new marks later)
    svg.selectAll("g.marks_group")
        .data([0])
        .enter().append("g").classed("marks_group", true);

    // if drawing rects, clear continuous-type paths from other datasets if any
    // and vice versa
    // TODO better removal would be to flatten down to x axis

    other_marks = svg.selectAll((mark === "path") ? "g.topic_area"
            : "path.topic_area");
    other_marks.transition()
        .duration(1000)
        .style("opacity", 0)
        .remove();

    // the actual streams
    marks = svg.select("g.marks_group").selectAll(mark + ".topic_area")
        .data(p.data, function (d) {
            return d.id;
        });

    initial = other_marks.size() === 0 && marks.size() === 0;

    marks.enter()
        .append(mark)
        .classed("topic_area", true)
        .attr("clip-path", "url(#model_conditional_clip)")
        .style("fill", function (d) {
            return scale_color(d.t);
        })
        .style("opacity", initial ? 1 : 0)
        .on("mouseover", function (d) {
            var label = d.label;
            d3.select(this).style("fill", scale_color(d.t, true));

            if (p.spec.words > 0) {
                label += ": ";
                label += d.words.join(" ");
            }
            view.tooltip().text(label);

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
                view.dfb().set_view({
                    type: "topic",
                    param: d.id
                });
            }
        });

    // TODO better removal would be to flatten down to x axis
    marks.exit().remove();

    if (mark === "path") {
        area = d3.svg.area()
            .x(function (d) { return scale_x(d.x); })
            .y0(function (d) { return scale_y(d.y0); })
            .y1(function (d) { return scale_y(d.y0 + d.y); });

        // purely geometric smoothing is possible with
        // area.interpolate("basis");
        // or
        // area.interpolate("monotone");
        // These are quite slow.

        render_marks = function (sel) {
            sel.attr("d", function (d) { return area(d.values); })
                .transition().duration(1000)
                .style("opacity", 1);
        };
    } else {
        rects = marks.selectAll("rect")
            .data(function (d) { return d.values; });
        rects.enter()
            .append("rect");
        rects.exit().remove();

        render_marks = function (sel) {
            sel.selectAll("rect")
                .attr("x", function (d) { return scale_x(d.x); })
                .attr("y", function (d) {
                    return scale_y(d.y0 + d.y);
                })
                .attr("width", scale_x.rangeBand())
                .attr("height", function (d) {
                    return scale_y(d.y0) - scale_y(d.y0 + d.y);
                });
            sel.transition().duration(1000)
                .style("opacity", 1);
        };
    }

    // labels group
    svg.selectAll("g.labels_group")
        .data([0])
        .enter().append("g").classed("labels_group", true);

    // the stream labels
    labels = svg.select("g.labels_group").selectAll("text.layer_label")
        .data(p.data, function (d) { return d.id; });

    labels.enter().append("text")
        .classed("layer_label", true)
        .style("opacity", initial ? 1 : 0)
        .attr("clip-path", "url(#model_conditional_clip)");

    labels.exit().remove();

    render_labels = function (sel) {
        var i, j, t, xs, cur, show = [ ], max = [ ],
            x0 = scale_x.domain()[0],
            x1 = scale_x.domain()[1],
            y0 = scale_y.domain()[0],
            y1 = scale_y.domain()[1],
            b = scale_y(0); // area heights are b - scale_y(y)
        for (i = 0; i < p.data.length; i += 1) {
            t = p.data[i].t;
            show[t] = false;
            xs = p.data[i].values;
            for (j = 0, cur = 0; j < xs.length; j += 1) {
                if (xs[j].x >= x0 && xs[j].x <= x1
                        && xs[j].y0 + xs[j].y >= y0
                        && xs[j].y0 + xs[j].y <= y1) {
                    if (xs[j].y > cur &&
                            b - scale_y(xs[j].y) > spec.label_threshold) {
                        show[t] = true;
                        max[t] = j;
                        cur = xs[j].y;
                    }
                }
            }
        }

        sel.transition().duration(1000)
            .style("opacity", function (d) {
                return show[d.t] ? 1 : 0;
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
                var result = d.label;
                if (spec.label_words > 0) {
                    result += ": ";
                    result += d.words.slice(0, spec.label_words).join(" ");
                }
                return result;
            });
    };

    // actually draw the streams and labels
    if (initial) {
        marks.call(render_marks);
        labels.call(render_labels);
    } else {
        marks.transition().duration(1000).call(render_marks);
        labels.transition().duration(1000).call(render_labels);
    }

    // set up zoom
    zoom = d3.behavior.zoom();
    if (p.condition_type !== "ordinal") {
        zoom.x(scale_x);
    }
    zoom.y(scale_y)
        .scaleExtent([1, 5])
        .on("zoom", function () {
            if (view.model.conditional.zoom_transition) {
                marks.transition().duration(1000)
                    .call(render_marks);
                labels.transition().duration(1000)
                    .call(render_labels);
                svg.select("g.x.axis").transition().duration(1000)
                    .call(axis_x);

                view.model.conditional.zoom_transition = false;
            } else {
                marks.call(render_marks);
                labels.call(render_labels);
                svg.select("g.x.axis").call(axis_x);
            }
        });

    // zoom reset button
    d3.select("button#reset_zoom")
        .on("click", function () {
            view.model.conditional.zoom_transition = true;
            zoom.translate([0, 0])
                .scale(1)
                .event(svg);
        });

    zoom(svg);
    return true;
};


// the parameter object p should contain:
// keys: sequence of values of the conditional variable usable as keys
// xs: sequence of numeric values corresponding to keys
// totals: d3.map sending keys to conditional totals over all topics
// topics: sequence of objects with the following properties:
//     t: topic number
//     words: topic words (for tooltip text)
//     label: label
//     wts: d3.map sending keys to conditional weight of topic t
view.model.stacked_series = function (p) {
    var all_series,
        stack,
        stack_domain_y,
        result = { };

    all_series = p.topics.map(function (t) {
        var series = {
            t: t.t,
            words: t.words,
            label: t.label,
            id: t.id
        };
        series.values = p.keys.map(function (k, j) {
            return {
                key: k,
                x: p.xs[j],
                y: t.wts.get(k) || 0
            };
        });
        return series;
    });

    stack = d3.layout.stack()
        .values(function (d) {
            return d.values;
        });

    if (p.streamgraph) {
        stack.offset("wiggle"); // streamgraph
    }

    stack.order("inside-out"); // pick a "good" layer order

    result.frac = stack(all_series);

    // retrieve layer order (by recalculating it: dumb)
    result.order = stack.order()(all_series.map(function (ds) {
        return ds.values.map(function (d) { return [d.x, d.y]; });
    }));

    // for raw-counts, enforce same order, even if not "good"
    stack.order(function (d) {
        return result.order;
    });

    result.raw = stack(all_series.map(function (s) {
        return {
            t: s.t,
            words: s.words,
            label: s.label,
            values: s.values.map(function (d) {
                return {
                    x: d.x,
                    y: d.y * (p.totals.get(d.key) || 0)
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

    result.domain_x = d3.extent(p.xs);
    result.domain_frac = stack_domain_y(result.frac);
    result.domain_raw = stack_domain_y(result.raw);

    return result;
};
