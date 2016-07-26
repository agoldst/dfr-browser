/*global view, VIS, d3 */
"use strict";

view.model.plot = function (param) {
    var svg, cloud_size, circle_radius, range_padding,
        zoom_rect,
        domain_x, domain_y,
        scale_x, scale_y, scale_size, scale_stroke,
        gs, gs_enter,
        exit_duration,
        words, names,
        translation, zoom,
        topics = param.topics,
        n = param.topics.length,
        spec = { };

    spec.w = d3.select("#model_view").node().clientWidth
        || VIS.model_view.plot.w;
    spec.w = Math.max(spec.w, VIS.model_view.plot.w); // set a min. width
    spec.h = Math.floor(spec.w / VIS.model_view.plot.aspect);
    spec.m = {
        left: 0,
        right: 0,
        top: 0,
        bottom: 0
    };

    svg = d3.select("#model_view_plot").selectAll("svg")
        .data([1]);
    svg.enter().call(view.append_plot);
    svg = view.setup_plot(svg, spec);

    circle_radius = Math.floor(
        spec.w /
        (2.1 * Math.sqrt(VIS.model_view.plot.aspect * n))
    );
    cloud_size = circle_radius * 1.8; // a little less than the full diameter
    range_padding = 1.1 * circle_radius;

    // zoom-target rectangle
    zoom_rect = svg.selectAll("rect.bg")
        .data([1]);
    zoom_rect.enter().append("rect").classed("bg", true);
    zoom_rect.attr("width", spec.w);
    zoom_rect.attr("height", spec.h);

    if (param.type === "scaled") {
        topics.forEach(function (p) {
            p.x = p.scaled[0];
            p.y = p.scaled[1];
        });
    } else {
        // default to grid
        // arrange alphabetically by name
        topics.forEach(function (p, j) {
            topics[j].sort_key = view.topic.sort_name(p.label);
        });
        topics = topics.sort(function (a, b) {
            return d3.ascending(a.sort_key, b.sort_key);
        });
        view.model.grid_coords({
            n: n,
            cols: VIS.model_view.plot.cols
                || Math.floor(Math.sqrt(VIS.model_view.plot.aspect * n)),
            rows: VIS.model_view.plot.rows,
            indents: VIS.model_view.plot.indents
        })
            .forEach(function (p, j) {
                topics[j].x = p.x;
                topics[j].y = p.y;
            });
    }

    domain_x = d3.extent(topics, function (d) { return d.x; });
    domain_y = d3.extent(topics, function (d) { return d.y; });

    scale_x = d3.scale.linear()
        .domain(domain_x)
        .range([range_padding, spec.w - range_padding]);

    scale_y = d3.scale.linear()
        .domain(domain_y)
        .range([spec.h - range_padding, range_padding]);

    scale_size = d3.scale.sqrt()
        .domain([0, 1])
        .range(VIS.model_view.plot.size_range);

    scale_stroke = d3.scale.linear()
        .domain([0,d3.max(topics, function (p) { return p.total; })])
        .range([0,VIS.model_view.plot.stroke_range]);

    gs = svg.selectAll("g.topic")
        .data(topics, function (p) { return p.id; });

    // add circles. If this isn't an initial render, the update selection
    // is non-empty and we want entering circles to fade in.
    gs_enter = gs.enter().append("g")
        .classed("topic", true)
        .style("opacity", gs.enter().size() === gs.size() ? 1 : 0);

    // TODO refine animation choreography here: not quite right
    exit_duration = gs.exit().empty() ? 0 : 1000;
    gs.exit().transition().duration(exit_duration)
        .style("opacity", 0)
        .remove();

    gs_enter.append("clipPath").attr("id", function (p) {
        return "clip_circ" + p.t; // we'll clip the topic words to the circles
    }).append("circle")
        .attr({
            cx: 0,
            cy: 0
        }); // radius gets set below in transitions with all the other circles

    gs_enter.append("circle")
            .attr("cx", 0)
            .attr("cy", 0)
            .classed("topic_cloud", true)
            .attr("stroke-width", function (p) {
                return scale_stroke(p.total);
            })
            .on("click", function (p) {
                if (!d3.event.shiftKey) {
                    view.dfb().set_view({
                        type: "topic",
                        param: p.id
                    });
                }
            })
            .on("mouseover", function (p) {
                gs.sort(function (a, b) {
                    // to bring the hovered circle to front, draw it last
                    // by reordering all the gs
                    if (a.t === b.t) {
                        return 0;
                    }

                    if (a.t === p.t) {
                        return 1;
                    }

                    if (b.t === p.t) {
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

    words = gs.selectAll("text.topic_word")
        .data(function (p) {
            var max_wt = p.words[0].weight,
                wds = p.words.map(function (w) {
                    return {
                        text: w.word,
                        size: Math.floor(scale_size(w.weight / max_wt)),
                        t: p.t
                    };
                }),
                up = 0, down = 0, toggle = false, i;

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
            return wds.slice(0, i);
        }, function (w) { return w.text; });

    words.enter().append("text").classed("topic_word", true)
        .attr("clip-path", function (w) {
            return "url(#" + "clip_circ" + w.t;
        })
        .style("font-size", "1px"); // additional words start tiny then grow

    words.exit().transition()
        .duration(1000)
        .style("opacity", 0)
        .remove();

    words.text(function (wd) {
            return wd.text;
        })
        .attr("x", 0)
        .attr("y", function (wd) {
            return wd.y;
        });

    names = gs.selectAll("text.topic_name")
        .data(function (p) {
            var ws = p.label.split(" ");
            // TODO 1 label word on each "line": problem for "of," "the" etc.
            return ws.map(function (w, j) {
                return {
                    w: w,
                    y: VIS.model_view.plot.name_size
                        * (j - (ws.length - 1) / 2)
                };
            });
        });
    names.enter().append("text").classed("topic_name", true);
    names.exit().remove();

    names.attr("x", 0)
        .attr("y", function (w) { return w.y; })
        .text(function (w) { return w.w; })
        .style("font-size", VIS.model_view.plot.name_size + "px")
        .classed("merged_topic_sep", function (w) {
            return w.w === "or";
        });

    translation = function (p) {
        var result = "translate(" + scale_x(p.x);
        result += "," + scale_y(p.y) + ")";
        return result;
    };

    // new nodes: translate (they're still opacity 0)
    gs_enter.attr("transform", translation)
        .selectAll("circle")
            .attr("r", circle_radius);

    // words on new nodes just appear at the right size
    gs_enter.selectAll("text.topic_word")
        .style("font-size", function (wd) {
            return wd.size + "px";
        });

    gs.transition()
        .delay(exit_duration)
        .duration(1000)
        .attr("transform", translation) // move updating nodes
        .each(function () {
            d3.select(this).selectAll("circle").transition()
                .attr("r", circle_radius);
        })
        .transition() // then fade in any new nodes
        .duration(1000)
        .style("opacity", 1);

    words.transition()
        .delay(1000)
        .duration(1000)
        .style("font-size", function (wd) {
            return wd.size + "px";
        });

    words.exit().transition()
        .duration(1000)
        .style("font-size", "1px")
        .remove();

    // TODO zoom circle sizes and add words in, but this makes some
    // complications for the scaled view where the main use of zoom is to
    // see overlapping circles.
    // TODO and then, re-enable zoom in the grid view.

    if (param.type === "scaled") {
        zoom = d3.behavior.zoom()
            .x(scale_x)
            .y(scale_y)
            .scaleExtent([1, 10])
            .on("zoom", function () {
                if (view.model.plot.zoom_transition) {
                    gs.transition()
                        .duration(1000)
                        .attr("transform", translation);
                    view.model.plot.zoom_transition = false;
                } else {
                    gs.attr("transform", translation);
                }
            });

        // zoom reset button
        d3.select("button#reset_zoom")
            .on("click", function () {
                view.model.plot.zoom_transition = true;
                zoom.translate([0, 0])
                    .scale(1)
                    .event(svg);
            });

        zoom(svg);
    } else {
        svg.on(".zoom", null);
    }
};

view.model.grid_coords = function (p) {
    var n_col = p.cols || Math.floor(Math.sqrt(p.n)),
        n_row = Math.round(p.n / n_col),
        remain = p.n - n_row * n_col,
        sgn = d3.ascending(remain, 0),
        rows, indents,
        vskip,
        i, j,
        result = [];

    // for circles of equal size, closest possible packing is hexagonal grid
    // centers are spaced 1 unit apart on horizontal, sqrt(3) / 2 on vertical.
    // Alternate rows are displaced 1/2 unit on horizontal.
    vskip = Math.sqrt(3.0) / 2.0;

    if (p.rows && d3.sum(p.rows) === p.n) {
        rows = p.rows; // manually specified grid rows
        n_row = p.rows.length;
        // If the spec was invalid, we'll fall through to manual. Can happen
        // without user error if topics are hidden/shown
    }

    if (rows === undefined) {
        rows = [ ];

        // if n is not exactly n_row * n_col, we'll do our best sticking
        // things on the right-side margin. Since we indent odd rows, we
        // stick extra entries on even rows first before going to odd rows,
        // but we stick extra holes on odd rows first.

        for (i = (sgn === 1) ? 0 : 1; i < n_row; i += 2) {
            rows[i] = n_col;
            if (Math.abs(remain) > 0) {
                rows[i] += sgn;
                remain -= sgn;
            }
        }
        for (i = (sgn === 1) ? 1 : 0; i < n_row; i += 2) {
            rows[i] = n_col;
            if (Math.abs(remain) > 0) {
                rows[i] += sgn;
                remain -= sgn;
            }
        }

        // if we've doing holes, we want the longer rows on top, not on bottom
        if (sgn === -1) {
            rows.reverse();
        }
    }

    // manual indents if specified; same validation behavior as for rows
    if (p.indents && p.indents.length === n_row) {
        indents = p.indents;
    }

    if (indents === undefined) {
        indents = d3.range(n_row).map(function (i) {
            return (i % 2 === 0) ? 0 : 0.5;
        });
    }

    // generate coordinates
    for (i = 0; i < n_row; i += 1) {
        for (j = 0; j < rows[i]; j += 1) {
            result.push({
                x: j + 0.5 + indents[i],
                y: (n_row - i) * vskip + 0.5 });
        }
    }
    return result;
};
