/*global view, VIS, d3 */
"use strict";

view.model.yearly = function (p) {
    var spec = { }, svg,
        scale_x, scale_y, axis_x, g_axis, area,
        scale_color,
        bg, clip,
        raw,
        to_plot,
        paths, labels, render_labels,
        areas, zoom;

    spec.m = VIS.model_view.yearly.m;
    spec.w = d3.select("#model_view_yearly").node().clientWidth
        || VIS.model_view.yearly.w;
    spec.w = Math.max(spec.w, VIS.model_view.yearly.w); // set a min. width
    spec.w -= spec.m.left + spec.m.right; // inset margins
    spec.h = Math.floor(spec.w / VIS.model_view.yearly.aspect);
    spec.h -= spec.m.top + spec.m.bottom;
    svg = view.plot_svg("#model_view_yearly", spec);

    raw = p.type ? (p.type === "raw") : VIS.last.model_yearly;
    VIS.last.model_yearly = raw;

    to_plot = view.model.yearly.stacked_series({
        yearly_totals: p.yearly_totals,
        topics: p.topics,
        raw: raw
    });

    bg = svg.selectAll("rect.bg")
        .data([1])
        .enter().append("rect").classed("bg", true);
    bg.attr("width", spec.w)
        .attr("height", spec.h)
        .classed("bg", true);

    clip = d3.select("#model_yearly_clip");
    if (clip.size() === 0) {
        clip = d3.select("#model_view_yearly svg").append("clipPath")
            .attr("id", "model_yearly_clip");
        clip.append("rect")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", spec.w)
            .attr("height", spec.h);
    }

    d3.select("#model_yearly_clip rect").transition().duration(2000)
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
            to_plot.order.forEach(function (k, r) { seq[k] = r; });
        return function (t, highlight) {
            var c = cat20(seq[t] % 20);
            return highlight ? d3.hsl(c).brighter(0.5).toString() : c;
        };
    }());

    scale_x = d3.time.scale.utc()
        .domain(to_plot.domain_x)
        .range([0, spec.w]);

    scale_y = d3.scale.linear()
        .domain(to_plot.domain_y)
        .range([spec.h, 0])
        .nice();

    // x axis (no y axis: streamgraph makes it meaningless)
    // and preempt any initial transition from the top
    axis_x = d3.svg.axis()
        .scale(scale_x)
        .orient("bottom");

    g_axis = svg.selectAll("g.axis")
        .data([1]);
    g_axis.enter().append("g").classed("axis", true).classed("x", true)
        .attr("transform", "translate(0," + spec.h + ")");

    g_axis.transition()
        .duration(2000)
        .attr("transform", "translate(0," + spec.h + ")")
        .call(axis_x);

    // the actual streams
    paths = svg.selectAll("path.topic_area")
        .data(to_plot.data);

    paths.enter()
        .append("path")
        .classed("topic_area", true)
        .attr("clip-path", "url(#model_yearly_clip)")
        .style("fill", function (d) {
            return scale_color(d.t);
        })
        .on("mouseover", function (d) {
            var label = d.label;
            d3.select(this).style("fill", scale_color(d.t, true));

            if (VIS.model_view.yearly.words > 0) {
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
                view.dfb().set_view(view.topic.hash(d.t));
            }
        });

    paths.exit().remove();

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

    // draw the streams: ensure transition for raw/frac swap
    paths.transition()
        .duration(2000)
        .attr("d", areas);

    // the stream labels
    labels = svg.selectAll("text.layer_label")
        .data(to_plot.data, function (d) { return d.t; });

    labels.enter().append("text")
        .classed("layer_label", true)
        .attr("clip-path", "url(#model_yearly_clip)");

    labels.exit().remove();

    render_labels = function (sel) {
        var i, j, t, xs, cur, show = [ ], max = [ ],
            x0 = scale_x.domain()[0],
            x1 = scale_x.domain()[1],
            y0 = scale_y.domain()[0],
            y1 = scale_y.domain()[1],
            b = scale_y(0); // area heights are b - scale_y(y)
        for (i = 0; i < to_plot.data.length; i += 1) {
            t = to_plot.data[i].t;
            show[t] = false;
            xs = to_plot.data[i].values;
            for (j = 0, cur = 0; j < xs.length; j += 1) {
                if (xs[j].x >= x0 && xs[j].x <= x1
                        && xs[j].y0 + xs[j].y >= y0
                        && xs[j].y0 + xs[j].y <= y1) {
                    if (xs[j].y > cur &&
                            b - scale_y(xs[j].y) >
                            VIS.model_view.yearly.label_threshold) {
                        show[t] = true;
                        max[t] = j;
                        cur = xs[j].y;
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
                var result = d.label;
                if (VIS.model_view.yearly.label_words > 0) {
                    result += ": ";
                    result += d.words.slice(0,
                            VIS.model_view.yearly.label_words)
                        .join(" ");
                }
                return result;
            });
    };

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
            view.dfb().set_view(raw ? "/model/yearly/frac"
                : "/model/yearly/raw");
        });

    d3.selectAll("#yearly_choice li").classed("active", false);
    d3.select(raw ? "#nav_model_yearly_raw" : "#nav_model_yearly_frac")
        .classed("active", true);

    return true;
};


view.model.yearly.stacked_series = function (p) {
    var year_keys, years, all_series,
        stack, ord,
        data_frac, data_raw,
        stack_domain_y;

    if (!VIS.model_view.yearly.data) {
        VIS.model_view.yearly.data = { };

        year_keys = p.yearly_totals.keys().sort();
        years = year_keys.map(function (y) {
            return new Date(Date.UTC(+y, 0, 1));
        });

        // save x range
        VIS.model_view.yearly.domain_years = d3.extent(years);

        all_series = p.topics.map(function (topic) {
            var series = {
                t: topic.t,
                words: topic.words.map(function (w) { return w.word; }),
                label: topic.label
            };
            series.values = year_keys.map(function (yr, j) {
                var result = {
                    yr: yr,
                    x: years[j],
                    y: topic.wts.get(yr) || 0
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
                words: s.words,
                label: s.label,
                values: s.values.map(function (d) {
                    return {
                        x: d.x,
                        y: d.y * p.yearly_totals.get(d.yr)
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
    } // if (!VIS.model_view.yearly.data) -- can get cleared by topic-hiding switch

    return {
        data: VIS.model_view.yearly.data[p.raw ? "raw" : "frac"],
        domain_x: VIS.model_view.yearly.domain_years,
        domain_y: VIS.model_view.yearly[p.raw ? "domain_raw" : "domain_frac"],
        order: VIS.model_view.yearly.order
    };

};
