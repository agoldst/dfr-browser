/*global VIS, view, d3 */
"use strict";

view.about = function (info) {
    if (!VIS.ready.about) {
        if (info.meta_info) {
            d3.select("div#meta_info")
                .html(info.meta_info);
        }
        VIS.ready.about = true;
    }
    return true;
};
