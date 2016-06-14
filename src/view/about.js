/*global VIS, view, d3 */
"use strict";

view.about = function (info) {
    if (info.meta_info) {
        d3.select("div#meta_info")
            .html(info.meta_info);
    }
    return true;
};
