/*global view, VIS, set_view, d3, $ */
"use strict";

view.bib = function (p) {
    var ordering = p.ordering.map(function (o) {
            var result = o;
            o.key = o.heading + "_" + p.minor; // Used in the data bind
            return result;
        }),
        lis;

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

    // set up spy
    view.bib.spy = $("div#bib_main");
    view.bib.spy.scrollspy({ target: "#bib_view #bib_headings" });
    // TODO BUG doesn't work
    view.bib.spy.on("activate.bs.scrollspy", function () {
        console.log("Scrollspied");
    });

    // TODO reverse support, use URL
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

    lis = d3.select("#bib_view ul#bib_headings")
        .selectAll("li")
        .data(ordering, function (o) { return o.key; });

    lis.enter().append("li")
        .append("a");
    lis.exit().remove();
    lis.selectAll("a")
        .attr("href", function (o) {
            return "#" + view.bib.id(o.heading);
        })
        .on("click", function (o) {
            d3.event.preventDefault();
            d3.select("#" + view.bib.id(o.heading)).node().scrollIntoView();
        })
        .text(function (o) {
            return o.heading;
        });

    view.bib.render(ordering, p.citations);
    // TODO smooth sliding-in / -out appearance of navbar would be nicer

    return true;
};

view.bib.render = function (ordering, citations) {
    var sections, as;

    view.loading(true);
    sections = d3.select(view.bib.spy.selector)
        .selectAll("div.section")
        .data(ordering, function (o) {
            // Ensure that we'll update even if only the minor key has changed
            // (in which case headings stay the same)
            return o.key;
        });

    sections.enter().append("div")
        .classed("section", true)
        .attr("id", function (o) {
            return view.bib.id(o.heading);
        })
        .append("h2")
            .text(function (o) {
                return o.heading;
            });
    sections.exit().remove();

    // Cheating here. We are not going to update the headings in the
    // update selection, since we know that if something is in update
    // but not enter, its heading isn't changing (because the data is
    // keyed by headings).

    as = sections.selectAll("a")
        .data(function (o) {
            return o.docs;
        });

    as.enter().append("a");
    as.exit().remove();

    as.attr("href", function (d) {
            return "#/doc/" + d;
        })
        .html(function (d) {
            return citations[d];
        });

    view.loading("false");
    view.bib.spy.scrollspy("refresh");
};

view.bib.id = function (heading) {
    return "bib_" + heading;
};
