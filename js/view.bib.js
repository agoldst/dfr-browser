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
                d3.selectAll("div#bib_main div.panel-default")
                    .sort(descend ? d3.descending : d3.ascending)
                    .order(); // stable because bound data is just indices
                descend = !descend;
            };
        }())); // up/down state is preserved in the closure

    // clear listings
    div.selectAll("div#bib_main > div.panel").remove();

    sections = div.select("div#bib_main")
        .selectAll("div")
        .data(d3.range(ordering.headings.length));

    panels = sections.enter().append("div")
        .classed("panel", true)
        .classed("panel-default", true);

    panels.append("div")
        .classed("panel-heading", true)
        .on("click", function (i) {
            $("#" + ordering.headings[i]).collapse("toggle");
        })
        .on("mouseover", function () {
            d3.select(this).classed("panel_heading_hover", true);
        })
        .on("mouseout", function () {
            d3.select(this).classed("panel_heading_hover", false);
        })
        .append("h2")
            .classed("panel-title", true)
            .html(function (i) {
                var a = '<a class="accordion-toggle"';
                a += ' data-toggle="collapse"';
                a += ' href="#' + ordering.headings[i] + '">';
                a += ordering.headings[i];
                a += '</a>';
                return a;
            });

    as = panels.append("div")
        .classed("panel-collapse", true)
        .classed("collapse", true)
        .classed("in", true)
        .attr("id", function (i) { return ordering.headings[i]; }) 
        .append("div")
            .classed("panel-body", true)
            .classed("bib_section", true)
            .selectAll("a")
                .data(function (i) {
                    return ordering.docs[i];
                });

    as.enter().append("a");
    as.exit().remove();

    as
        .attr("href", function (d) {
            return "#/doc/" + d;
        })
        .html(function (d) {
            return p.citations[d];
        });


    // TODO smooth sliding-in / -out appearance of navbar would be nicer

    return true;

};
