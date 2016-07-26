/*global view, VIS, d3 */
"use strict";

view.settings = function (p) {
    var stg;

    stg = d3.select("#settings_modal");

    stg.select("#n_words_list input")
        .property("min", 1)
        .property("max", p.max_words)
        .property("value", p.overview_words)
        .on("change", function () {
            view.dfb().update_settings({
                overview_words: this.valueAsNumber
            });
        });
    stg.select("#n_words_topic input")
        .property("min", 1)
        .property("max", p.max_words)
        .property("value", p.topic_view.words)
        .on("change", function () {
            view.dfb().update_settings({
                topic_view: { words: this.valueAsNumber }
            });
        });
    stg.select("#n_topic_docs input")
        .property("min", 1)
        .property("max", p.max_docs)
        .property("value", p.topic_view.docs)
        .on("change", function () {
            view.dfb().update_settings({
                topic_view: { docs: this.valueAsNumber }
            });
        });

    stg.select("#reveal_hidden")
        .classed("hidden", VIS.hidden_topics.length === 0)
        .select("input")
            .property("checked", p.show_hidden_topics === true)
            .on("change", function () {
                view.dfb().update_settings({
                    show_hidden_topics: this.checked
                });
            });

    stg.select("#conditional_streamgraph")
        .classed("hidden", p.condition_type === "ordinal")
        .select("input")
            .property("checked", !!p.model_view.conditional.streamgraph)
            .on("change", function () {
                view.dfb().update_settings({
                    model_view: { conditional: {
                        streamgraph: this.checked
                    } }
                });
            });
};
