/*global d3, utils */
"use strict";

// declaration of global object (modified by dfb().load())
var VIS = {
    files: { // what data files to request
        info: "data/info.json",
        meta: "data/meta.csv.zip",  // remove .zip to use uncompressed data
        dt: "data/dt.json.zip",     // (name the actual file accordingly)
        tw: "data/tw.json",
        topic_scaled: "data/topic_scaled.csv"
    },
    aliases: {                  // simple aliasing in URLs:
        yearly: "conditional"   // #/model/yearly/... -> #/model/conditional/...
    },
    default_view: "/model", // specify the part after the #
    metadata: {
        type: "dfr",        // use "base" if meta.csv has a header
        spec: {
            extra_fields: [ ],// (dfr type only) names for extra columns
            date_field: "date"// field(s) to convert to Date type
        }
    },
    condition: {            // metadata variable to condition topics on
        type: "time",       // alternatives: "category" and "continuous"
        spec: {
            field: "date",  // name of metadata field
            unit: "year",   // unit of time bins
            n: 1            // width of time bins
            // format: "%Y-%m" // optional display format (strftime)
        }
    },
    // proper: false        // are doc-topic weights normalized?
                            // (set only if dfr-browser guesses wrong)
    overview_words: 15,     // may need adjustment
    model_view: {
        plot: {
            w: 500,            // px: the minimum svg width
            aspect: 1.3333,     // for calculating height
            words: 6,           // maximum: may need adjustment
            size_range: [7, 18], // points. may need adjustment
            name_size: 18,      // points
            stroke_range: 6     // max. perimeter thickness
            // cols: 8          // can explicitly specify # of grid columns
            // rows: [4, 5, 4]  // OR just list how many circles in each row
            //                  // (must sum to # of topics)
            // indents: [ 0.5, 0, 0.5 ] // AND/OR: x origin of each row
        },
        conditional: {
            w: 500,         // px: the minimum svg width
            aspect: 1.333,
            m: {
                left: 20,
                right: 20,
                top: 20,
                bottom: 30
            },
            label_threshold: 40, // px
            words: 4,
            label_words: 2, // should be <= words
            streamgraph: true,   // streamgraph or stack areas from x-axis?
            ordinal: {          // ordinal variable: stacked bars, not areas
                bar: 0.4        // bar width as proportion
            }
        },
        list: {
            spark: { // same form as topic_view plot parameters below
                w: 70,
                h: 20,
                m: {
                    left: 2,
                    right: 2,
                    top: 2,
                    bottom: 2
                },
                time: {
                    bar: {
                        unit: "day",
                        w: 300
                    }
                },
                ordinal: {
                    bar: {
                        w: 0.25
                    }
                },
                continuous: {
                    bar: {
                        w: 0.25
                    }
                }
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
            bottom: 30
        },
        time: { // conditional plot x-axis settings: time variable
            bar: { // width of bars
                unit: "day", // unit is used as d3.time[unit].utc
                w: 90
            },
            ticks: 10   // number of x-axis ticks
            // ticks: { // alternatively, can specify interval b/w ticks
            //    unit: "year",
            //    n: 10
            //}
        },
        continuous: { // continuous variable: step is calculated automatically
            bar: {
                w: 0.25, // proportion: how much x-axis bar takes up
            },
            ticks: 10
        },
        ordinal: { // categorical variable: step is calculated automatically
            bar: {
                w: 0.25 // proportion
            },
            ticks: 10
        },
        ticks_y: 10, // y axis ticks
        tx_duration: 1000 // animated transition time in ms (where applicable)
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
        type: "dfr", // use "base" for bare-bones src/bib.js
        spec: {
            // default if no author delimiter supplied, but note that
            // 2014 JSTOR metadata format uses ", " instead
            author_delimiter: "\t",
            // "et al" is better for real bibliography, but it's
            // actually worth being able to search all the multiple authors
            et_al: Infinity,
            anon: "[Anon]",
        }
    },
    bib_view: {
        window_lines: 100,
        major: "year",          // for bib.type "base", use "all"
        minor: "authortitle",   // for bib.type "base", use "raw"
        dir: "up"
    },
    tooltip: {              // tooltip div parameters
        offset: {
            x: 10,          // px
            y: 0
        }
    },
    percent_format: ".1%",  // d3.format for percentages
    resize_refresh_delay: 100, // ms
    hidden_topics: [],      // list of 1-based topic numbers to suppress
    show_hidden_topics: false
};

