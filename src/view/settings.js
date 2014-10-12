/*global view, VIS, d3 */
"use strict";

view.settings = function (p) {
    if (VIS.ready.settings) {
        return;
    }

    d3.select("#n_words_list")
        .property("min", 1)
        .property("max", p.max_words)
        .property("value", VIS.overview_words)
        .on("change", function () {
            VIS.overview_words = this.valueAsNumber;
        });
    d3.select("#n_words_topic")
        .property("min", 1)
        .property("max", p.max_words)
        .property("value", VIS.topic_view.words)
        .on("change", function () {
            VIS.topic_view.words = this.valueAsNumber;
        });
    d3.select("#n_topic_docs")
        .property("min", 1)
        .property("max", p.max_docs)
        .property("value", VIS.topic_view.docs)
        .on("change", function () {
            VIS.topic_view.docs = this.valueAsNumber;
        });

    d3.select("#highlight_special")
        .property("checked", VIS.special_issue_class === "special_issue")
        .on("change", function () {
            var flag = VIS.special_issue_class === "special_issue";
            if (flag) {
                VIS.special_issue_class  = "special_issue_nohighlight";
                d3.selectAll(".special_issue").classed({
                    special_issue: false,
                    special_issue_nohighlight: true
                });
            } else {
                VIS.special_issue_class  = "special_issue";
                d3.selectAll(".special_issue_nohighlight").classed({
                    special_issue: true,
                    special_issue_nohighlight: false
                });
            }
        });

    d3.select("#reveal_hidden")
        .property("checked", VIS.show_hidden_topics === true)
        .on("change", function () {
            VIS.show_hidden_topics = !VIS.show_hidden_topics;
            // mark yearly series for recalculation
            VIS.model_view.yearly.data = undefined;
            VIS.ready.model_yearly = false;
        });

    VIS.ready.settings = true;
};
