/*global view, VIS, set_view, topic_hash, d3 */
"use strict";

view.model.yearly = function (p) {
    var spec = VIS.model_view.yearly, svg,
        scale_x, scale_y, axis_x, area,
        scale_color,
        raw,
        to_plot,
        paths, labels, render_labels,
        areas, zoom,
        n = p.words.length;

    svg = view.plot_svg("#model_view_yearly", spec);

    raw = p.type ? (p.type === "raw") : VIS.last.model_yearly;
    VIS.last.model_yearly = raw;

    to_plot = view.model.yearly.stacked_series({
        yearly: p.yearly,
        yearly_totals: p.yearly_totals,
        raw: raw
    });

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

    scale_x = d3.time.scale.utc()
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
            view.tooltip().text(view.topic.label(d.t, p.words[d.t]));
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
                set_view(topic_hash(d.t));
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
        for (t = 0; t < n; t += 1) {
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
                var words = p.words[d.t].slice(0,
                    VIS.model_view.yearly.label_words);
                return view.topic.label(d.t, words);
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
            set_view(raw ? "/model/yearly/frac"
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

        all_series = p.yearly.map(function (wts, t) {
            var series = { t: t };
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
    } // if (!VIS.model_view.yearly.data)

    return {
        data: VIS.model_view.yearly.data[p.raw ? "raw" : "frac"],
        domain_x: VIS.model_view.yearly.domain_years,
        domain_y: VIS.model_view.yearly[p.raw ? "domain_raw" : "domain_frac"],
        order: VIS.model_view.yearly.order
    };

};
