/*global d3, utils */
"use strict";

// declaration of global object (modified by browser().load())
var VIS = {
    ready: { }, // which viz already generated?
    last: { // which subviews last shown?
        bib: { }
    },
    files: { // what data files to request
        info: "data/info.json",
        meta: "data/meta.csv.zip",  // remove .zip to use uncompressed data
        dt: "data/dt.json.zip",     // (name the actual file accordingly)
        tw: "data/tw.json",
        topic_scaled: "data/topic_scaled.csv"
    },
    default_view: "/model", // specify the part after the #
    overview_words: 15,     // may need adjustment
    model_view: {
        w: 500,            // px: the minimum svg width
        aspect: 1.3333,     // for calculating height
        words: 4,           // maximum: may need adjustment
        size_range: [7, 18], // points. may need adjustment
        name_size: 18,      // points
        stroke_range: 6,    // max. perimeter thickness
        yearly: {
            w: 500,         // px: the minimum svg width
            aspect: 1.333,
            m: {
                left: 20,
                right: 20,
                top: 20,
                bottom: 20
            },
            label_threshold: 40, // px
            words: 4,
            label_words: 2 // should be <= words
        },
        list: {
            spark: {
                w: 70,
                h: 20,
                m: {
                    left: 2,
                    right: 2,
                    top: 2,
                    bottom: 2
                },
                bar_width: 300
            }
        }
    },
    topic_view: {
        words: 50,
        docs: 20,
        w: 400, // minimum in px
        aspect: 3,
        m: {
            left: 40,
            right: 20,
            top: 20,
            bottom: 20
        },
        bar_width: 90, // in days!
        ticks: 10 // applied to both x and y axes
    },
    word_view: {
        n_min: 10, // words per topic
        topic_label_padding: 8, // pt
        topic_label_leading: 14, // pt
        row_height: 80, // pt
        svg_rows: 10, // * row_height gives min. height for svg element
        w: 700, // px: minimum width
        m: {
            left: 100,
            right: 40,
            top: 20,
            bottom: 0
        }
    },
    bib: {
        // default if no author delimiter supplied, but note that
        // 2014 JSTOR metadata format uses ", " instead
        author_delimiter: "\t",
        // "et al" is better for real bibliography, but it's
        // actually worth being able to search all the multiple authors
        et_al: Infinity,
        anon: "[Anon]",
    },
    bib_view: {
        window_lines: 100,
        major: "year",
        minor: "authortitle",
        dir: "up"
    },
    float_format: function (x) {
        return d3.round(x, 3);
    },
    tooltip: {              // tooltip div parameters
        offset: {
            x: 10,          // px
            y: 0
        }
    },
    percent_format: d3.format(".1%"),
    resize_refresh_delay: 100, // ms
    hidden_topics: [],      // list of 1-based topic numbers to suppress
    show_hidden_topics: false,
    annotes: [],            // list of CSS classes annotating the current view
    update: function (x) {
        return utils.deep_replace(this, x);
    }
};

