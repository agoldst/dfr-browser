/*global view, VIS, d3, utils */
"use strict";

view.model.list = function (p) {
    var trs, divs, token_max,
        total = d3.sum(p.sums),
        keys, sorter, sort_choice, sort_dir,
        spec;

    trs = d3.select("#model_view_list table tbody")
        .selectAll("tr");

    if (!VIS.ready.model_list) {
        // set up spark spec
        spec = utils.clone(VIS.model_view.list.spark);
        spec.time.step = VIS.condition.spec;

        // label sparkplots column
        d3.select("th#model_view_list_condition a")
            .text((p.type === "time") ? "over time"
                    : "by " + p.condition_name);

        trs = trs.data(d3.range(p.data.length))
            .enter().append("tr");

        trs.on("click", function (t) {
            view.dfb().set_view(view.topic.hash(t));
        });

        trs.classed("hidden_topic", function (t) {
            return p.topic_hidden[t];
        });

        trs.append("td").append("a").classed("topic_name", true)
            .attr("href", view.topic.link)
            .text(function (t) {
                return p.labels[t];
            });

        divs = trs.append("td").append("div").classed("spark", true);
        view.append_svg(divs, spec)
            .each(function (t) {
                view.topic.conditional_barplot({ 
                    t: t,
                    data: p.data[t],
                    key: p.key,
                    type: p.type,
                    axes: false,
                    clickable: false,
                    svg: d3.select(this),
                    spec: spec
                });
            });

        trs.append("td").append("a").classed("topic_words", true)
            .attr("href", view.topic.link);

        token_max = d3.max(p.sums);
        view.append_weight_tds(trs, function (t) {
            return p.sums[t] / token_max;
        });
        trs.append("td")
            .text(function (t) {
                return VIS.percent_format(p.sums[t] / total);
            });

        VIS.ready.model_list = true;
    } // if (!VIS.ready.model_list)

    // since the number of topic words can be changed, we need to
    // rewrite the topic words column
    trs.selectAll("td a.topic_words")
        .text(function (t) {
            return p.words[t].reduce(function (acc, x) {
                return acc + " " + x.word;
            }, "");
        });

    // sorting

    if (!VIS.last.model_list) {
        VIS.last.model_list = { };
    }

    sort_choice = p.sort || VIS.last.model_list.sort || "topic";
    sort_dir = p.dir || ((sort_choice === VIS.last.model_list.sort) ?
        VIS.last.model_list.dir : "up") || "up";

    if (sort_choice === "words") {
        keys = p.words.map(function (ws) {
            return ws.reduce(function (acc, w) {
                return acc + " " + w.word;
            }, "");
        });
    } else if (sort_choice === "frac") {
        // default ordering should be largest frac to least,
        // so the sort keys are negative proportions
        keys = p.sums.map(function (x) { return -x / total; });
    } else if (sort_choice === "condition") {
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

    if (sort_dir === "down") {
        sorter = function (a, b) {
            return d3.descending(keys[a], keys[b]) ||
                d3.descending(a, b); // stabilize sort
        };
    } else {
        // default: up
        sorter = function (a, b) {
            return d3.ascending(keys[a], keys[b]) ||
                d3.ascending(a, b); // stabilize sort
        };
    }

    // remember for the next time we visit #/model/list
    VIS.last.model_list.sort = sort_choice;
    VIS.last.model_list.dir = sort_dir;

    trs.sort(sorter).order();

    d3.selectAll("#model_view_list th.sort")
        .classed("active", function () {
            return !!this.id.match(sort_choice);
        })
        .each(function () {
            var ref = "#/" + this.id.replace(/_(view_)?/g, "/");
            if (this.id.match(sort_choice)) {
                ref += (sort_dir === "down") ? "/up" : "/down";
            }

            d3.select(this).select("a")
                .attr("href", ref);
        })
        .on("click", function () {
            view.dfb().set_view(d3.select(this).select("a")
                .attr("href").replace(/#/, ""));
        });


    return true;
};
