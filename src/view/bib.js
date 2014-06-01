/*global view, VIS, set_view, d3, $ */
"use strict";

view.bib = function (p) {
    var div = d3.select("div#bib_view"),
        major = p.major,
        minor = p.minor,
        ordering = p.ordering,
        sections,
        panels,
        as;

    // set up sort order menu
    d3.select("select#select_bib_sort option")
        .each(function () {
            this.selected = (this.value === major + "_" + minor);
        });
    d3.select("select#select_bib_sort")
        .on("change", function () {
            var sorting;
            d3.selectAll("#select_bib_sort option").each(function () {
                if (this.selected) {
                    sorting = this.value;
                }
            });
            set_view("/bib/" + sorting.replace(/_/, "/"));
        });

    // set up rest of toolbar
    d3.select("button#bib_collapse_all")
        .on("click", function () {
            $(".panel-collapse").collapse("hide");
        });
    d3.select("button#bib_expand_all")
        .on("click", function () {
            $(".panel-collapse").collapse("show");
        });
    d3.select("button#bib_sort_dir")
        .on("click", (function () {
            var descend = true;
            return function () {
                var sel = d3.selectAll("div#bib_main div.panel-default");
                if (descend) {
                    sel.sort(function (a, b) {
                        return d3.descending(a.heading, b.heading);
                    }).order();
                } else {
                    sel.sort(function (a, b) {
                        return d3.ascending(a.heading, b.heading);
                    }).order();
                }
                // better be stable since headings are distinct by construction
                descend = !descend;
            };
        }())); // up/down state is preserved in the closure

    sections = div.select("div#bib_main")
        .selectAll("div")
        .data(ordering, function (o) {
            return o.heading;
        });

    panels = sections.enter().append("div")
        .classed("panel", true)
        .classed("panel-default", true);

    sections.exit().remove();

    panels.append("div")
        .classed("panel-heading", true)
        .on("click", function (o) {
            $("#" + o.heading).collapse("toggle");
        })
        .on("mouseover", function () {
            d3.select(this).classed("panel_heading_hover", true);
        })
        .on("mouseout", function () {
            d3.select(this).classed("panel_heading_hover", false);
        })
        .append("h2")
            .classed("panel-title", true)
            .html(function (o) {
                var a = '<a class="accordion-toggle"';
                a += ' data-toggle="collapse"';
                a += ' href="#' + o.heading + '">';
                a += o.heading;
                a += '</a>';
                return a;
            });

    as = panels.append("div")
        .classed("panel-collapse", true)
        .classed("collapse", true)
        .classed("in", true)
        .attr("id", function (o) { return o.heading; })
        .append("div")
            .classed("panel-body", true)
            .classed("bib_section", true)
            .selectAll("a")
                .data(function (o) {
                    return o.docs;
                });

    as.enter().append("a");
    as.exit().remove();

    as.attr("href", function (d) {
            return "#/doc/" + d;
        })
        .html(function (d) {
            return p.citations[d];
        });


    // TODO smooth sliding-in / -out appearance of navbar would be nicer

    return true;

};
