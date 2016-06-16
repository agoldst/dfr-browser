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
        weight_tds,
        plot_svg,
        append_svg,
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
        VIS.error = true;
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
        if (p.title) {
            d3.selectAll(".model_title")
                .html(p.title);
        }
    };
    that.frame = frame;

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

    plot_svg = function (selector, spec) {
        var g;

        if (!VIS.svg) {
            VIS.svg = d3.map();
        }
        if (VIS.svg.has(selector)) {
            g = VIS.svg.get(selector);
            d3.select(selector + " svg")
                .attr("width", spec.w + spec.m.left + spec.m.right)
                .attr("height", spec.h + spec.m.top + spec.m.bottom);

            g.attr("transform",
                    "translate(" + spec.m.left + "," + spec.m.top + ")");
        } else {
            g = append_svg(d3.select(selector), spec);
            VIS.svg.set(selector, g);
        }
        return g;
    };
    that.plot_svg = plot_svg;

    append_svg = function (selection, spec) {
        // mbostock margin convention
        // http://bl.ocks.org/mbostock/3019563
        return selection.append("svg")
                .attr("width", spec.w + spec.m.left + spec.m.right)
                .attr("height", spec.h + spec.m.top + spec.m.bottom)
            // g element passes on xform to all contained elements
            .append("g")
                .attr("transform",
                      "translate(" + spec.m.left + "," + spec.m.top + ")");
    };
    that.append_svg = append_svg;

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


