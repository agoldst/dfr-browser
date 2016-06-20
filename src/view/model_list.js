/*global view, VIS, d3, utils */
"use strict";

view.model.list = function (p) {
    var trs, trs_enter, token_max,
        total = d3.sum(p.sums),
        keys, sorter,
        sort_view, // utility function defined below for setting sorting links
        spec;

    // set up spark spec
    spec = utils.clone(VIS.model_view.list.spark);
    spec.time.step = VIS.condition.spec;

    // label sparkplots column
    d3.select("th#model_view_list_condition a")
        .text((p.type === "time") ? "over time"
                : "by " + p.condition_name);

    // create rows
    trs = d3.select("#model_view_list table tbody")
        .selectAll("tr")
        .data(p.data.map(function (x, t) {
            return {
                t: t,
                data: x,
                label: p.labels[t]
            };
        }), function (x) { return x.t; });

    trs_enter = trs.enter().append("tr");
    trs.exit().remove();

    trs.on("click", function (t) {
        view.dfb().set_view({ type: "topic", param: t.t });
    });

    trs.classed("hidden_topic", function (t) {
        return !!p.topic_hidden[t.t];
    });

    // create topic label column
    trs_enter.append("td").append("a").classed("topic_name", true);
    trs.select("a.topic_name")
        .attr("href", function (t) { return view.dfb().view_link({
                type: "topic",
                param: t.t
            });
        })
        .text(function (t) { return t.label; });

    // create conditional plot column
    trs_enter.append("td").append("div").classed("spark", true)
        .call(view.append_plot);
    trs.select("td div.spark svg")
        .call(view.setup_plot, spec);
    trs.select("td div.spark svg > g")
        .each(function (t) {
            view.topic.conditional_barplot({ 
                t: t.t,
                data: t.data,
                key: p.key,
                type: p.type,
                axes: false,
                clickable: false,
                transition: false,
                svg: d3.select(this),
                spec: spec
            });
        });

    // create topic words column
    trs_enter.append("td").append("a").classed("topic_words", true);
    trs.select("a.topic_words")
        .attr("href", function (t) { return view.dfb().view_link({
                type: "topic",
                param: t.t
            });
        });

    // since the number of topic words can be changed, we always need to
    // rewrite the topic words column
    trs.selectAll("td a.topic_words")
        .text(function (t) {
            return p.words[t.t].reduce(function (acc, x) {
                return acc + " " + x.word;
            }, "");
        });

    // create topic weight bars and %ages
    token_max = d3.max(p.sums);
    view.weight_tds({
        sel: trs,
        enter: trs_enter,
        w: function (t) { return p.sums[t.t] / token_max; },
        frac: function (t) {
            return d3.format(VIS.percent_format)(p.sums[t.t] / total);
        }
    });
    
    // sorting

    if (p.sort === "words") {
        keys = p.words.map(function (ws) {
            return ws.reduce(function (acc, w) {
                return acc + " " + w.word;
            }, "");
        });
    } else if (p.sort === "frac") {
        // default ordering should be largest frac to least,
        // so the sort keys are negative proportions
        keys = p.sums.map(function (x) { return -x / total; });
    } else if (p.sort === "condition") {
        keys = p.data.map(function (series) {
            var result, max_weight = 0;
            series.forEach(function (cond, weight) {
                if (weight > max_weight) {
                    result = cond;
                    max_weight = weight;
                }
            });
            return result;
        });
    } else {
        // default sort: by label sort name,
        // with names promoted over numbers
        keys = p.labels.map(view.topic.sort_name);
    }

    if (p.dir === "down") {
        sorter = function (a, b) {
            return d3.descending(keys[a.t], keys[b.t]) ||
                d3.descending(a.t, b.t); // stabilize sort
        };
    } else {
        // default: up
        sorter = function (a, b) {
            return d3.ascending(keys[a.t], keys[b.t]) ||
                d3.ascending(a.t, b.t); // stabilize sort
        };
    }

    trs.sort(sorter);

    sort_view = function (id) {
        var v = {
            type: "model",
            param: id.split("_").slice(2) // model_view_list_condition etc.
        };
        if (id.match(p.sort)) {
            v.param.push((p.dir === "down") ? "up" : "down");
        }
        return v;
    };

    d3.selectAll("#model_view_list th.sort")
        .classed("active", function () {
            return !!this.id.match(p.sort);
        })
        .on("click", function () {
            view.dfb().set_view(
                sort_view(this.id)
            );
        })
        .select("a").attr("href", function () { 
            return view.dfb().view_link(
                sort_view(this.parentElement.id)
            );
        });

    return true;
};
