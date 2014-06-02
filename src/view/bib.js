/*global view, VIS, set_view, d3, $ */
"use strict";

view.bib = function (p) {
    var ordering = p.ordering.map(function (o) {
            var result = o;
            o.key = o.heading + "_" + p.minor; // Used in the data bind
            return result;
        }),
        panels, divs, as;

    // set up sort order menu
    d3.selectAll("select#select_bib_sort option")
        .each(function () {
            this.selected = (this.value === p.major + "_" + p.minor);
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

    panels = d3.select("div#bib_main")
        .selectAll("div.panel")
        .data(ordering, function (o) {
            // Ensure that we'll update even if only the minor key has changed
            // (in which case headings stay the same)
            return o.key;
        });

    // The structure is:
    // <div class="panel">
    //   <div class="panel-heading">...</div>
    //   <div class="panel-collapse">
    //     <div class="panel-body bib_section">...</div>
    //   </div>
    // </div>

    divs = panels.enter().append("div")
        .classed("panel", true)
        .classed("panel-default", true);

    divs.append("div")
        .classed("panel-heading", true)
        .on("click", function (o) {
            $("#panel_" + o.heading).collapse("toggle");
        })
        .on("mouseover", function () {
            d3.select(this).classed("panel_heading_hover", true);
        })
        .on("mouseout", function () {
            d3.select(this).classed("panel_heading_hover", false);
        })
        .append("h2")
            .classed("panel-title", true)
            .append("a")
                .classed("accordion-toggle", true)
                .attr("data-toggle", "collapse")
                .attr("href", function (o) {
                    return "#panel_" + o.heading;
                })
                .text(function (o) {
                    return o.heading;
                });

    divs.append("div")
        .classed("panel-collapse", true)
        .classed("collapse", true)
        .classed("in", true)
        .attr("id", function (o) { return "panel_" + o.heading; })
        .append("div")
            .classed("panel-body", true)
            .classed("bib_section", true);

    panels.exit().remove();

    // Cheating here. We are not going to update the headings in the
    // update selection, since we know that if something is in update
    // but not enter, its heading isn't changing (because the data is
    // keyed by headings).

    as = panels.selectAll(".bib_section")
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
