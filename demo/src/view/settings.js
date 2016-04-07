/*global view, VIS, d3 */
"use strict";

view.settings = function (p) {
    if (VIS.ready.settings) {
        return;
    }

    d3.select("#n_words_list input")
        .property("min", 1)
        .property("max", p.max_words)
        .property("value", VIS.overview_words)
        .on("change", function () {
            VIS.overview_words = this.valueAsNumber;
        });
    d3.select("#n_words_topic input")
        .property("min", 1)
        .property("max", p.max_words)
        .property("value", VIS.topic_view.words)
        .on("change", function () {
            VIS.topic_view.words = this.valueAsNumber;
            view.dirty("topic/words", true);
        });
    d3.select("#n_topic_docs input")
        .property("min", 1)
        .property("max", p.max_docs)
        .property("value", VIS.topic_view.docs)
        .on("change", function () {
            VIS.topic_view.docs = this.valueAsNumber;
            view.dirty("topic/docs", true);
        });

    d3.select("#reveal_hidden")
        .classed("hidden", VIS.hidden_topics.length === 0)
        .select("input")
            .property("checked", VIS.show_hidden_topics === true)
            .on("change", function () {
                VIS.show_hidden_topics = !VIS.show_hidden_topics;
                // mark yearly series for recalculation
                VIS.model_view.yearly.data = undefined;
                VIS.ready.model_yearly = false;
            });

    VIS.ready.settings = true;
};
