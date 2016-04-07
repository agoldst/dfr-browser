/*global view, d3 */
"use strict";

view.words = function (vocab) {
    var lis = d3.select("ul#vocab_list").selectAll("li")
        .data(vocab);

    lis.exit().remove();
    lis.enter().append("li").append("a");

    lis.select("a")
        .text(function (w) { return w; })
        .attr("href", function (w) {
            return "#/word/" + w;
        });

    return true;
};
