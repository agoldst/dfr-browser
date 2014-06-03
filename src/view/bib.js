/*global view, VIS, set_view, d3, $ */
"use strict";

view.bib = function (p) {
    var ordering = p.ordering.map(function (o) {
            var result = o;
            o.key = o.heading + "_" + p.minor; // Used in the data bind
            return result;
        }),
        cmp = p.descend ? d3.descending : d3.ascending,
        pagination, pp = 1,
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
    view.bib.spy.scrollspy({ target: "#bib_view .nav.headings" });

    // TODO reverse support, use cmp
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

    // pagination
    pagination = view.bib.paginate(ordering, VIS.bib_view.window_lines);

    lis = d3.select("#bib_view ul.nav.headings")
        .selectAll("li")
        .data(ordering.map(function (o) { return o.heading; }));

    lis.enter().append("li")
        .append("a");
    lis.exit().remove();
    lis.selectAll("a")
        .attr("href", function (o) {
            return "#" + view.bib.id(o);
        })
        .on("click", function (o) {
            if (cmp(o, pagination.pp[pp - 1].heading === 1)) {
                view.bib.render(pagination.pp.slice(0, pagination.head.get(o)));
            }
        })
        .text(function (o) {
            return o;
        });

    pp = pagination.pp.length;
    view.bib.render(pagination.pp.slice(0, pp), p.citations);
    view.bib.spy.waypoint(function () {
        pp += 1;
        console.log("waypoint trigger: pp: " + pp);
        if (pp >= pagination.pp.length) {
            view.bib.spy.waypoint("destroy");
        }
        view.bib.render(pagination.pp.slice(0, pp), p.citations);
    },
    {
        offset: "bottom-in-view"
    });


    // TODO smooth sliding-in / -out appearance of navbar would be nicer

    return true;
};

view.bib.paginate = function (ordering, ll_max) {
    var i, page, pages, ll, d, remain, head = d3.map();

    for (i = 0, ll = 0, page = [], pages = []; i < ordering.length; i += 1) {
        head.set(ordering[i].heading, pages.length);
        if (ll + ordering[i].docs.length <= ll_max) {
            page.push(ordering[i]);
            ll += ordering[i].docs.length;
        } else {
            // current heading overflows page line limit. Fill the page:
            d = ll_max - ll;
            page.push({
                heading: ordering[i].heading,
                key: ordering[i].key,
                docs: ordering[i].docs.slice(0, d)
            });
            pages.push(page);
            // And allocate as many pages as needed to this heading
            for (remain = ordering[i].docs.length - d; remain > 0;
                    remain -= ll_max, d += ll_max) {
                page = [{
                    heading: ordering[i].heading,
                    key: ordering[i].key,
                    docs: ordering[i].docs.slice(d, Math.min(remain, ll_max)),
                    cont: true
                }];
                if (remain > ll_max) {
                    pages.push(page);
                } else {
                    ll = remain;
                    // and loop will terminate, with page to be filled out by
                    // next heading
                }
            }
        }
    }
    return {
        pp: pages,
        head: head
    };
};

view.bib.render = function (pages, citations) {
    var ordering = pages.reduce(function (acc, x) {
            return acc.concat(x);
        }).reduce(function (acc, x) {
            var result = acc.length ? acc : [acc];
            if (result[result.length - 1].heading === x.heading) {
                result[result.length - 1].docs.push(x.docs);
            } else {
                result.push(x);
            }
            return result;
        }),
        sections, as;

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
