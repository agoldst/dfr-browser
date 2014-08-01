/*global view, VIS, set_view, topic_link, topic_hash, utils, d3 */
"use strict";

view.doc = function (p) {
    var div = d3.select("div#doc_view"),
        total_tokens = p.total_tokens,
        topics = p.topics,
        trs;

    d3.select("#doc_view_main").classed("hidden", false);

    div.select("h2#doc_header")
        .html(p.citation);

    if (p.special) {
        div.select("#doc_remark .special_issue a")
            .attr("href", p.special.url)
            .text(p.special.title);
    }
    div.select("#doc_remark .special_issue")
        .classed("hidden", !p.special);

    div.select("#doc_remark .token_count")
        .text(p.total_tokens);

    div.select("#doc_remark a.jstor")
        .attr("href", view.doc.uri(p.doi));

    trs = div.select("table#doc_topics tbody")
        .selectAll("tr")
        .data(topics);

    trs.enter().append("tr");
    trs.exit().remove();

    // clear rows
    trs.selectAll("td").remove();

    trs.append("td")
        .append("a")
            .attr("href", function (t) {
                return topic_link(t.topic);
            })
            .text(function (t, j) {
                return view.topic.label(t.topic, p.words[j]);
            });

    trs.on("click", function (t) {
        set_view(topic_hash(t.topic));
    });

    view.append_weight_tds(trs, function (t) {
        return t.weight / total_tokens;
    });

    trs.append("td")
        .classed("td-right", true)
        .text(function (t) {
            return VIS.percent_format(t.weight / total_tokens);
        });
    trs.append("td")
        .classed("td-right", true)
        .text(function (t) {
            return t.weight;
        });
};

view.doc.uri = function (doi) {
    return "http://www.jstor.org"
        + "/stable/"
        + doi;
};
