/*global view, VIS, set_view, topic_link, topic_hash, d3 */
"use strict";

view.model.list = function (p) {
    var trs, divs, token_max,
        total = d3.sum(p.sums),
        keys, sorter, sort_choice, sort_dir,
        years = p.yearly[0].keys();

    if (!VIS.ready.model_list) {
        d3.select("th#model_view_list_year a")
            .text(d3.min(years) + "—" + d3.max(years));

        trs = d3.select("#model_view_list table tbody")
            .selectAll("tr")
            .data(d3.range(p.yearly.length))
            .enter().append("tr");

        trs.on("click", function (t) {
            set_view(topic_hash(t));
        });

        trs.append("td").append("a")
            .text(function (t) { return t + 1; }) // sigh
            .attr("href", topic_link);

        divs = trs.append("td").append("div").classed("spark", true);
        view.append_svg(divs, VIS.model_view.list.spark)
            .each(function (t) {
                view.topic.yearly_barplot({
                    svg: d3.select(this),
                    t: t,
                    yearly: p.yearly[t],
                    axes: false,
                    clickable: false,
                    spec: VIS.model_view.list.spark
                });
            });

        trs.append("td").append("a")
            .text(function (t) {
                return p.words[t].map(function (w) { return w.word; })
                    .join(" ");
            })
            .attr("href", topic_link);

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

    // sorting

    if (!VIS.last.model_list) {
        VIS.last.model_list = { };
    }

    sort_choice = p.sort || VIS.last.model_list.sort;
    sort_dir = (sort_choice === VIS.last.model_list.sort) ?
        (p.dir || VIS.last.model_list.dir) : "up";

    keys = d3.range(p.yearly.length);
    if (sort_choice === "words") {
        keys = keys.map(function (t) {
            return p.words[t].reduce(function (acc, w) {
                return acc + " " + w.word;
            }, "");
        });
    } else if (sort_choice === "frac") {
        // default ordering should be largest frac to least,
        // so the sort keys are negative proportions
        keys = keys.map(function (t) {
            return -p.sums[t] / total;
        });
    } else if (sort_choice === "year") {
        keys = p.yearly.map(function (series) {
            var result, max_weight = 0;
            series.forEach(function (year, weight) {
                if (weight > max_weight) {
                    result = year;
                    max_weight = weight;
                }
            });
            return result;
        });
    } else {
        // otherwise, enforce the default: by topic number
        sort_choice = "topic";
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

    d3.selectAll("#model_view_list table tbody tr")
        .sort(sorter)
        .order();

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
            set_view(d3.select(this).select("a")
                .attr("href").replace(/#/, ""));
        });


    return true;
};
