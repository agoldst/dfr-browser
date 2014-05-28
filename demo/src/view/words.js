/*global view, VIS, d3 */
"use strict";

view.words = function (vocab) {
    if (!VIS.ready.words) {
        d3.select("ul#vocab_list").selectAll("li")
            .data(vocab)
            .enter().append("li")
            .append("a")
            .text(function (w) { return w; })
            .attr("href", function (w) {
                return "#/word/" + w;
            });

        VIS.ready.words = true;
    }

    return true;
};
