/*global view, VIS, set_view, topic_hash, d3 */
"use strict";

view.model.plot = function (param) {
    var svg, cloud_size, circle_radius, range_padding,
        zoom_rect,
        domain_x, domain_y,
        scale_x, scale_y, scale_size, scale_stroke,
        gs, gs_enter,
        words,
        translation, zoom,
        topics = param.topics,
        n = param.topics.length,
        spec = { };

    spec.w = d3.select("#model_view").node().clientWidth || VIS.model_view.w;
    spec.w = Math.max(spec.w, VIS.model_view.w); // set a min. width
    spec.h = Math.floor(spec.w / VIS.model_view.aspect);
    spec.m = {
        left: 0,
        right: 0,
        top: 0,
        bottom: 0
    };

    svg = view.plot_svg("#model_view_plot", spec);

    // N.B. ignoring VIS.model_view.radius and calculating instead
    circle_radius = Math.floor(
        spec.w /
        (2.1 * Math.sqrt(VIS.model_view.aspect * n))
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
        topics.forEach(function (p, j) {
            topics[j].x = p.scaled[0];
            topics[j].y = p.scaled[1];
        });
    } else {
        // default to grid
        // arrange alphabetically by name, or top words if name missing
        topics.forEach(function (p, j) {
            topics[j].sort_key = p.name ? view.topic.sort_name(p.name)
                : p.words.join(" ");
        });
        topics = topics.sort(function (a, b) {
            return d3.ascending(a.sort_key, b.sort_key);
        });
        view.model.grid_coords(n, VIS.model_view.cols
                || Math.floor(Math.sqrt(VIS.model_view.aspect * n)))
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
        .range(VIS.model_view.size_range);

    scale_stroke = d3.scale.linear()
        .domain([0,d3.max(topics, function (p) { return p.total; })])
        .range([0,VIS.model_view.stroke_range]);

    gs = svg.selectAll("g")
        .data(topics, function (p) { return p.t; });

    gs_enter = gs.enter().append("g");
    gs.exit().remove();

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
                    set_view(topic_hash(p.t));
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
        });

    words.enter().append("text").classed("topic_word", true)
        .attr("clip-path", function (w) {
            return "url(#" + "clip_circ" + w.t;
        })
        .style("font-size", "1px"); // additional words start tiny then grow

    words.text(function (wd) {
            return wd.text;
        })
        .attr("x", 0)
        .attr("y", function (wd) {
            return wd.y;
        });

    gs_enter.selectAll("text.topic_name")
        .data(function (p) {
            var ws = view.topic.label.words(p);
            // TODO 1 label word on each "line" is a problem for "of" and "the" etc.
            return ws.map(function (w, j) {
                return {
                    w: w,
                    y: VIS.model_view.name_size * (j - (ws.length - 1) / 2)
                };
            });
        })
        .enter().append("text").classed("topic_name", true)
        .attr("x", 0)
        .attr("y", function (w) { return w.y; })
        .text(function (w) { return w.w; })
        .style("font-size", VIS.model_view.name_size + "px")
        .classed("merged_topic_sep", function (w) {
            return w.w === "or";
        });

    translation = function (p) {
        var result = "translate(" + scale_x(p.x);
        result += "," + scale_y(p.y) + ")";
        return result;
    };

    gs.transition()
        .duration(1000)
        .attr("transform", translation)
        .selectAll("circle")
        .attr("r", circle_radius);

    // new nodes just appear, no gratuitous translation: interrupt the other
    gs_enter.transition()
        .duration(0)
        .attr("transform", translation)
        .selectAll("circle")
        .attr("r", circle_radius);

    words.transition()
        .duration(1000)
        .style("font-size", function (wd) {
            return wd.size + "px";
        });

    // words on new nodes also just appear
    gs_enter.selectAll("text.topic_word")
        .transition()
        .duration(0)
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
    } else {
        svg.on(".zoom", null);
    }
};

view.model.grid_coords = function (n, cols) {
    var n_col = cols || Math.floor(Math.sqrt(n)),
        n_row = Math.round(n / n_col),
        remain = n - n_row * n_col,
        sgn = d3.ascending(remain, 0),
        rows = [],
        vskip,
        i, j,
        result = [];

    // for circles of equal size, closest possible packing is hexagonal grid
    // centers are spaced 1 unit apart on horizontal, sqrt(3) / 2 on vertical.
    // Alternate rows are displaced 1/2 unit on horizontal.
    vskip = Math.sqrt(3.0) / 2.0;

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

    // "validation"
    if (d3.sum(rows) !== n) {
        view.error("The topic grid has gone wrong. This is a bug.");
    }

    // generate coordinates
    for (i = 0; i < n_row; i += 1) {
        for (j = 0; j < rows[i]; j += 1) {
            result.push({
                x: j + 0.5 + ((i % 2 === 0) ? 0 : 0.5),
                y: (n_row - i) * vskip + 0.5 });
        }
    }
    return result;
};
