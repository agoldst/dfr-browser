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
            view.scroll_top();
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

    if (p.major === "issue") {
        lis.classed(VIS.special_issue_class, function (o) {
            return !!p.specials[o.docs[0]];
        });
    }

    view.bib.render({
        ordering: ordering,
        citations: p.citations,
        specials: p.specials,
        major: p.major
    });
    // TODO smooth sliding-in / -out appearance of navbar would be nicer

    return true;
};

view.bib.render = function (p) {
    var sections, sec_enter, items;

    view.loading(true);
    sections = d3.select("#bib_main")
        .selectAll("div.section")
        .data(p.ordering, function (o) {
            // Ensure that we'll update even if only the minor key has changed
            // (in which case headings stay the same)
            return o.key;
        });

    sec_enter = sections.enter().append("div")
        .classed("section", true)
        .attr("id", function (o) {
            return view.bib.id(o.heading);
        });

    if (p.major === "issue") {
        sec_enter.append("h2")
            .classed(VIS.special_issue_class, function (o) {
                return !!p.specials[o.docs[0]];
            })
            .html(function (o) {
                var s = view.bib.decode_issue(o.heading, true),
                    d = o.docs[0];
                if (p.specials[d]) {
                    s += '. <a href="' + p.specials[d].url + '">';
                    s += p.specials[d].title;
                    s += '</a>';
                }
                return s;
            });
    } else {
        sec_enter.append("h2")
            .html(function (o) {
                return o.heading;
            });
    }
    sec_enter.append("ul");

    sections.exit().remove();

    // Cheating here. We are not going to update the headings in the
    // update selection, since we know that if something is in update
    // but not enter, its heading isn't changing (because the data is
    // keyed by headings).

    items = sections.select("ul").selectAll("li")
        .data(function (o) {
            return o.docs;
        });

    items.enter().append("li");
    items.exit().remove();

    // Not elegant, but avoids some messy fiddling to make sure we don't
    // double-append the inner <a> elements
    items.html(function (d) {
            var s = '<a href="#/doc/' + d + '">';
            s += p.citations[d];
            s += '</a>';

            return s;
        })
        .classed(VIS.special_issue_class, function (d) {
            return !!p.specials[d];
        });

    view.loading("false");
};

view.bib.id = function (heading) {
    // Ensure element id doesn't have non-word characters
    return "bib_" + String(heading).replace(/\W/g,"_");
};

view.bib.decode_issue = function (code, chicago) {
    var vol, no, splits,
        result;

    splits = code.split("_");
    vol = +splits[1];
    if (+splits[2] % 10 === 0) {
        no = +splits[2] / 10;
    } else {
        no = (+splits[2] - 5) / 10;
        no = String(no) + "S";
    }

    if (chicago) {
        result = "<em>Signs</em> " + vol;
        result += ", no. " + no;
    } else {
        result = String(vol);
        result += "." + no;
    }
    return result;
};
