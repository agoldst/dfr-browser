/*global VIS, view, d3 */
"use strict";

view.about = function (meta_info) {
    if(!VIS.ready.about) {
        d3.select("div#meta_info")
            .html(meta_info);
        VIS.ready.about = true;
    }
    return true;
};
