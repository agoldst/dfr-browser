/*global view, VIS, set_view, d3, $, window */
"use strict";

view.bib = function (p) {
    var ordering = p.ordering.map(function (o) {
            var result = o;
            // Used in the data bind
            o.key = o.heading + "_" + p.minor + "_" + p.dir;
            return result;
        }),
        lis;

    // set up sort order menus
    d3.selectAll("select#select_bib_sort option")
        .each(function () {
            this.selected = (this.value === p.major + "_" + p.minor);
        });
    d3.selectAll("select#select_bib_dir option")
        .each(function () {
            this.selected = (this.value === p.dir);
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
    d3.select("select#select_bib_dir")
        .on("change", function () {
            var dir;
            d3.selectAll("#select_bib_dir option").each(function () {
                if (this.selected) {
                    dir = this.value;
                }
            });
            set_view("/bib/" + p.major + "/" + p.minor + "/" + dir);
        });

    d3.select("a#bib_sort_dir")
        .attr("href", "#/bib/" + p.major + "/" + p.minor + "/"
                + ((p.dir === "up") ? "down" : "up"));

    d3.select("#bib_headings a.top_link")
        .on("click", function () {
            d3.event.preventDefault();
            window.scrollTo(0, 0);
        });


    lis = d3.select("#bib_view #bib_headings ul")
        .selectAll("li")
        .data(ordering, function (o) { return o.key; });

    lis.enter().append("li")
        .append("a");
    lis.exit().remove();

    VIS.bib.keys.major.forEach(function (k) {
        lis.classed(k, p.major === k);
    });

    lis.selectAll("a")
        .attr("href", function (o) {
            return "#" + view.bib.id(o.heading);
        })
        .on("click", function (o) {
            d3.event.preventDefault();
            d3.select("#" + view.bib.id(o.heading)).node().scrollIntoView();
        })
        .text(function (o) {
            return (p.major === "issue") ?
                view.bib.decode_issue(o.heading, false)
                : o.heading;
        });

    view.bib.render(ordering, p.citations, p.major);
    // TODO smooth sliding-in / -out appearance of navbar would be nicer

    return true;
};

view.bib.render = function (ordering, citations, major) {
    var sections, as;

    view.loading(true);
    sections = d3.select("#bib_main")
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
                return (major === "issue") ?
                    view.bib.decode_issue(o.heading, true)
                    : o.heading;
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
};

view.bib.id = function (heading) {
    // Ensure element id doesn't have non-word characters
    return "bib_" + String(heading).replace(/\W/g,"_");
};

view.bib.decode_issue = function (code, chicago) {
    var vol, no, splits, result;

    splits = code.split("_");
    result = splits[0];
    vol = +splits[1];
    no = +splits[2];

    if (chicago) {
        result += " " + vol;
        if (no !== 0) {
            result += ", no. " + no;
        }
    } else {
        result += " " + vol;
        if (no !== 0) {
            result += "." + no;
        }
    }
    return result;
};
