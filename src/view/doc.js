/*global view, VIS, set_view, bib, topic_link, topic_hash, utils, d3 */
"use strict";

view.doc = function (p) {
    var div = d3.select("div#doc_view"),
        total_tokens = p.total_tokens,
        topics = p.topics,
        trs;

    d3.select("#doc_view_main").classed("hidden", false);

    div.select("h2#doc_header")
        .html(bib.citation(p.meta));

    div.select("#doc_remark")
        .html(p.total_tokens + " tokens. "
                + '<a class ="external" href="'
                + view.doc.uri(p.meta)
                + '">View '
                + p.meta.doi
                + " on JSTOR</a>");

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

view.doc.uri = function (meta) {
    return "http://www.jstor.org"
        + VIS.uri_proxy
        + "/stable/"
        + meta.doi;
};
