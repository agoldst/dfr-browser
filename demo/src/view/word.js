/*global view, VIS, set_view, topic_hash, d3 */
"use strict";

view.word = function (p) {
    var div = d3.select("div#word_view"),
        word = p.word,
        n = p.n,
        words,
        spec, row_height,
        svg, scale_x, scale_y, scale_bar,
        gs_t, gs_t_enter, gs_w, gs_w_enter,
        tx_w;

    // word form setup
    d3.select("form#word_view_form")
        .on("submit", function () {
            d3.event.preventDefault();
            var input_word = d3.select("input#word_input")
                .property("value")
                .toLowerCase();
            set_view("/word/" + input_word);
        });

    // setting word to undefined means: do setup only
    if (p.word === undefined) {
        return;
    }

    div.selectAll("#word_view span.word") // sets header and help
        .text(word);

    div.selectAll("#word_view .none").classed("hidden", p.topics.length !== 0);
    div.select("table#word_topics").classed("hidden", p.topics.length === 0);
    div.select("#word_view_explainer").classed("hidden", p.topics.length === 0);

    words = p.topics.map(function (t, j) {
        var max_weight, ws = p.words[j];
        return ws.map(function (tw, i) {
            if (i === 0) {
                max_weight = tw.weight;
            }
            // normalize weights relative to the weight of the word ranked 1
            return {
                word: tw.word,
                weight: tw.weight / max_weight
            };
        });
    });

    spec = {
        w: VIS.word_view.w,
        h: VIS.word_view.row_height * (p.n_topics + 1),
        m: VIS.word_view.m
    };

    row_height = VIS.word_view.row_height;
    svg = view.plot_svg("#word_view_main", spec);
    // adjust svg height so that scroll bar isn't too long
    // and svg isn't so short it clips things weirdly
    d3.select("#word_view_main svg")
        .attr("height", VIS.word_view.row_height
            * (Math.max(p.topics.length, VIS.word_view.svg_rows) + 1)
            + spec.m.top + spec.m.bottom);

    scale_x = d3.scale.linear()
        .domain([0, n])
        .range([0, spec.w]);
    scale_y = d3.scale.linear()
        .domain([0, Math.max(1, p.topics.length - 1)])
        .range([row_height, row_height * (Math.max(p.topics.length, 1) + 1)]);
    scale_bar = d3.scale.linear()
        .domain([0, 1])
        .range([0, row_height / 2]);

    gs_t = svg.selectAll("g.topic")
        .data(p.topics, function (t) { return t.topic; } );

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
            set_view(topic_hash(t.topic));
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
            set_view("/word/" + d.word);
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
