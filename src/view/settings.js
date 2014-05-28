/*global view, VIS */

view.settings = function (p) {
    if (VIS.ready.settings) {
        return;
    }

    //d3.select("#reveal_hidden"); // TODO hide/reveal topics

    d3.select("#n_words_list")
        .property("max", p.max_words)
        .property("value", VIS.overview_words)
        .on("change", function () {
            VIS.overview_words = this.valueAsNumber;
            // TODO model view list needs to be marked for re-render
        });
    d3.select("#n_words_topic")
        .property("max", p.max_words)
        .property("value", VIS.topic_view.words)
        .on("change", function () {
            VIS.topic_view.words = this.valueAsNumber;
        });
    d3.select("#n_topic_docs")
        .property("max", p.max_docs)
        .property("value", VIS.topic_view.docs)
        .on("change", function () {
            VIS.topic_view.docs = this.valueAsNumber;
        });
};
