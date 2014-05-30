/*global view, VIS, d3 */
"use strict";

view.settings = function (p) {
    if (VIS.ready.settings) {
        return;
    }

    //d3.select("#reveal_hidden"); // TODO hide/reveal selected topics

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
};
