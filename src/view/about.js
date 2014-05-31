/*global VIS, view, d3 */
"use strict";

view.about = function (section) {
    var sec = section || "intro",
        elem = d3.select("#about_view #about_" + sec);

    // check section is valid
    if (elem.empty()) {
        elem = d3.select("#about_intro");
        sec = "intro";
    }

    d3.selectAll("#discussion_text > div")
        .classed("hidden", true);
    elem.classed("hidden", false);
    elem.node().scrollIntoView();

    d3.selectAll("#about_contents li")
        .classed("selected", false);
    d3.select("#about_contents_" + sec)
        .classed("selected", true);
    return true;
};
