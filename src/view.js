/*global VIS, d3, window */
"use strict";
var view = (function () {

    var that = { },
        my = { },
        dfb,
        loading,
        calculating,
        error,
        warning,
        tooltip,
        frame,
        update_annotations,
        weight_tds,
        setup_plot,
        append_plot,
        scroll_top,
        scroll_origin;

    dfb = function (controller) {
        if (controller !== undefined) {
            my.dfb = controller;
        }
        return my.dfb;
    };
    that.dfb = dfb;

    loading = function (flag) {
        d3.select("#working_icon").classed("invisible", !flag);
    };
    that.loading = loading;

    calculating = function (sel, flag) {
        d3.select("#working_icon").classed("invisible", !flag);
        d3.selectAll(sel + " .calc").classed("hidden", !flag);
        d3.selectAll(sel + " .calc-done").classed("hidden", flag);
    };
    that.calculating = calculating;

    error = function (msg) {
        d3.select("div#error")
            .classed("hidden", false)
            .append("p").text(msg);

        this.loading(false);
    };
    that.error = error;

    warning = function (msg) {
        d3.select("div#warning")
            .classed("hidden", false)
            .append("p").text(msg);
    };
    that.warning = warning;

    // singleton tooltip
    tooltip = function () {
        var tt = my.tooltip;

        // does it already exist?
        if (tt) {
            return tt;
        }

        // otherwise, initialize
        tt = {
            offset: VIS.tooltip.offset
        };

        tt.div = d3.select("body").append("div")
            .attr("id", "tooltip")
            .classed("bar_tooltip", true);
        tt.container = d3.select("body").node();

        tt.div.append("p");

        tt.update_pos = function () {
            var mouse_pos = d3.mouse(this.container);
            this.div.style({
                    left: (mouse_pos[0] + this.offset.x) + 'px',
                    top: (mouse_pos[1] + this.offset.y) + 'px',
                    position: "absolute"
                });
        };
        tt.text = function (text) {
            this.div.select("p").text(text);
        };
        tt.show = function () {
            this.div.classed("hidden", false);
        };
        tt.hide = function () {
            this.div.classed("hidden", true);
        };

        my.tooltip = tt;
        return tt;
    };
    that.tooltip = tooltip;

    // render global framing elements of the view
    frame = function (p) {
        var m0 = p.models.find(function (m) {
                return m.id === p.id;
            });

        if (p.title) {
            d3.selectAll(".model_title")
                .html(p.title);
        }

        // multiple models: data dropdown menu
        if (p.models && p.models.length > 1) {
            d3.select("ul#data_dropdown").selectAll("li")
                .data(p.models)
                .enter().append("li").append("a")
                    .attr("href", "#")
                    .text(function (m) {
                        return m.name || m.id;
                    })
                    .on("click", function (m) {
                        d3.event.preventDefault();
                        d3.select("#data_name")
                            .text(m.name || m.id);
                        my.dfb.switch_model(m.id);
                    });
            d3.select("#data_name").text(m0.name || m0.id);
            d3.select("li#nav_data").classed("hidden", false);
        }
    };
    that.frame = frame;

    update_annotations = function (v, param) {
        var j, cs = ["." + v];
        d3.selectAll(".annote").classed("hidden", true);
        for (j = 0; j < param.length; j += 1) {
            // we have to sanitize param to use in selectors:
            cs.push(cs[j] + "_" + String(param[j]).replace(/\W/g, "_"));
        }
        cs.forEach(function (c) {
            d3.selectAll(".annote" + c).classed("hidden", false);
        });
    };
    that.update_annotations = update_annotations;

    // add columns to a table corresponding to weights
    // p.sel: table row selection with data bound
    // p.enter: entering table rows
    // Three columns may be added if the appropriate function is supplied in
    // the parameters:
    // p.w: function giving proportional size of horizontal bar
    // p.frac: function giving string for display of proportion
    // p.raw: function giving string for display of raw weight
    weight_tds = function (p) {
        if (p.w) {
            p.enter.append("td").classed("weight", true)
                .append("div")
                    .classed("proportion", true)
                    .append("span")
                        .classed("proportion", true)
                        .html("&nbsp;");

            p.sel.select("td.weight div.proportion")
                .style("margin-left", function (d) {
                    return d3.format(".1%")(1 - p.w(d));
                });
        }

        if (p.frac) {
            p.enter.append("td")
                .classed("td-right", true)
                .classed("weight-percent", true);
            p.sel.select("td.weight-percent")
                .text(p.frac);
        }

        if (p.raw) {
            p.enter.append("td")
                .classed("td-right", true)
                .classed("weight-raw", true);
            p.sel.select("td.weight-raw")
                .text(p.raw);
        }
    };
    that.weight_tds = weight_tds;

    setup_plot = function (sel, spec) {
        // mbostock margin convention
        // http://bl.ocks.org/mbostock/3019563
        sel.attr("width", spec.w + spec.m.left + spec.m.right)
            .attr("height", spec.h + spec.m.top + spec.m.bottom);
        // g element passes on xform to all contained elements
        return sel.select("g")
            .attr("transform",
                    "translate(" + spec.m.left + "," + spec.m.top + ")");
    };
    that.setup_plot = setup_plot;

    append_plot = function (sel) {
        return sel.append("svg").append("g");
    };
    that.append_plot = append_plot;

    scroll_top = function () {
        window.scrollTo(window.scrollX, 0);
    };
    that.scroll_top = scroll_top;

    scroll_origin = function () {
        window.scrollTo(0, 0);
    };
    that.scroll_origin = scroll_origin;

    return that;
}());


