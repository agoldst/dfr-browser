/*global view, VIS, d3 */
"use strict";

view.settings = function (p) {
    var stg;

    stg = d3.select("#settings_modal");

    stg.select("#n_words_list input")
        .property("min", 1)
        .property("max", p.max_words)
        .property("value", VIS.overview_words)
        .on("change", function () {
            VIS.overview_words = this.valueAsNumber;
        });
    stg.select("#n_words_topic input")
        .property("min", 1)
        .property("max", p.max_words)
        .property("value", VIS.topic_view.words)
        .on("change", function () {
            VIS.topic_view.words = this.valueAsNumber;
        });
    stg.select("#n_topic_docs input")
        .property("min", 1)
        .property("max", p.max_docs)
        .property("value", VIS.topic_view.docs)
        .on("change", function () {
            VIS.topic_view.docs = this.valueAsNumber;
        });

    stg.select("#reveal_hidden")
        .classed("hidden", VIS.hidden_topics.length === 0)
        .select("input")
            .property("checked", VIS.show_hidden_topics === true)
            .on("change", function () {
                VIS.show_hidden_topics = !VIS.show_hidden_topics;
            });

    stg.select("#conditional_streamgraph")
        .classed("hidden", VIS.condition.type === "ordinal")
        .select("input")
            .property("checked", !!VIS.model_view.conditional.streamgraph)
            .on("change", function () {
                VIS.model_view.conditional.streamgraph =
                    !VIS.model_view.conditional.streamgraph;
            });
};
