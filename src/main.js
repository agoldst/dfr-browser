/*global d3, $, JSZip, model, utils, view, window, bib, document */
"use strict";

/* declaration of global object (initialized in setup_vis) */
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
            aspect: 2,
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
        w: 1000,
        m: {
            left: 100,
            right: 40,
            top: 20,
            bottom: 0
        }
    },
    bib: {
        keys: {
            major: [
                "decade",
                "year",
                "journal",
                "issue",
                "alpha"
            ],
            minor: [
                "date",
                "journal",
                "alpha"
            ]
        },
        author_delimiter: "\t"  // 2014 JSTOR metadata format uses ", " instead
    },
    bib_view: {
        window_lines: 100,
        major: "year",
        minor: "alpha",
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
    cite_date_format: d3.time.format.utc("%B %Y"), // JSTOR supplies UTC dates
    uri_proxy: "",
    resize_refresh_delay: 200, // ms
    hidden_topics: [],      // list of 1-based topic numbers to suppress
    show_hidden_topics: false,
    annotes: []             // list of CSS classes annotating the current view
};

/* declaration of functions */

var topic_link, // stringifiers
    topic_hash,
    topic_view, // view generation
    word_view,
    words_view,
    doc_view,
    bib_view,
    about_view,
    settings_view,
    model_view,
    model_view_list,
    model_view_plot,
    model_view_yearly,
    set_view,
    view_refresh,
    hide_topics,
    view_loading,
    setup_vis,          // initialization
    load_data,
    main;               // main program


// utility functions
// -----------------


// -- stringifiers
//    ------------

topic_link = function (t) {
    return "#" + topic_hash(t);
};

topic_hash = function (t) {
    return "/topic/" + String(t + 1);
};

// Principal view-generating functions
// -----------------------------------

topic_view = function (m, t_user, y) {
    var words, year,
        t = +t_user - 1; // t_user is 1-based topic index, t is 0-based

    if (!m.meta() || !m.has_dt() || !m.tw()) {
        // not ready yet; show loading message
        view.loading(true);
        return true;
    }

    // if the topic is missing or unspecified, show the help
    if (!isFinite(t) || t < 0 || t >= m.n()) {
        d3.select("#topic_view_help").classed("hidden", false);
        d3.select("#topic_view_main").classed("hidden", true);
        view.loading(false);
        return true;
    }

    // validate the year
    year = m.valid_year(y) ? y : undefined;

    words = utils.shorten(m.topic_words(t), VIS.topic_view.words);

    view.topic({
        t: t,
        words: words,
        name: m.topic_name(t)
    });

    // reveal the view div
    d3.select("#topic_view_help").classed("hidden", true);
    d3.select("#topic_view_main").classed("hidden", false);

    m.total_tokens(function (total) {
        m.topic_total(t, function (topic_total) {
            view.topic.remark({
                alpha: m.alpha(t),
                col_sum: topic_total,
                total_tokens: total
            });
        });
    });

    // topic word subview
    view.topic.words(words);

    // topic yearly barplot subview

    // if the last view was also a topic view, we'll decree this a qualified
    // redraw and allow a nice transition to happen
    if (VIS.cur_view && VIS.cur_view.attr("id") === "topic_view") {
        view.dirty("topic/yearly", true);
    }

    if (!view.updating() && !view.dirty("topic/yearly")) {
        d3.select("#topic_plot").classed("invisible", true);
    }
    m.topic_yearly(t, function (yearly) {
        view.topic.yearly({
            t: t,
            year: year,
            yearly: yearly
        });
        d3.select("#topic_plot").classed("invisible", false);
    });

    // topic top documents subview
    view.calculating("#topic_docs", true); 
    m.topic_docs(t, VIS.topic_view.docs, year, function (docs) {
        var ds = docs.map(function (d) { return d.doc; });
        view.calculating("#topic_docs", false);
        view.topic.docs({
            t: t,
            docs: docs,
            specials: m.special_issue(ds),
            citations: docs.map(function (d) {
                return bib.citation(m.meta(d.doc));
            }),
            year: year
        });
    });

    view.loading(false);
    return true;
    // (later: nearby topics by J-S div or cor on log probs)
};

word_view = function (m, w) {
    var div = d3.select("div#word_view"),
        word = w,
        topics, n = 0;

    if (!m.tw()) {
        view.loading(true);
        return true;
    }
    view.loading(false);

    if (word) {
        div.select("#word_view_help").classed("hidden", true);
    } else {
        div.select("#word_view_help").classed("hidden", false);
        if (VIS.last.word) {
            word = VIS.last.word; // fall back to last word if available
            div.select("a#last_word")
                .attr("href", "#/word/" + word)
                .text(document.URL.replace(/#.*$/, "") + "#/word/" + word);
            div.select("#last_word_help").classed("hidden", false);
        } else {
            div.select("#word_view_main").classed("hidden", true);
            view.word({ word: undefined });
            return true;
        }
    }
    div.select("#word_view_main").classed("hidden", false);

    VIS.last.word = word;

    topics = m.word_topics(word).filter(function (t) {
        return !VIS.topic_hidden[t.topic] || VIS.show_hidden_topics;
    });

    if (topics.length > 0) {
        n = 1 + d3.max(topics, function (t) {
            return t.rank; // 0-based, so we rank + 1
        });
        // now figure out how many words per row, taking account of possible ties
        n = d3.max(topics, function (t) {
            return m.topic_words(t.topic, n).length;
        });
    }
    // but not too few words. Also take care of topics.length = 0 case
    n = Math.max(VIS.word_view.n_min, n);

    view.word({
        word: word,
        topics: topics,
        words: topics.map(function (t) {
            return m.topic_words(t.topic, n).slice(0, n);
        }),
        n: n,
        n_topics: m.n(),
        names: topics.map(function (t) {
            return m.topic_name(t.topic);
        })
    });

    return true;
};

words_view = function (m) {
    if (!m.tw()) {
        view.loading(true);
        return true;
    }
    view.loading(false);

    return view.words(m.vocab());
};


doc_view = function (m, d) {
    var div = d3.select("div#doc_view"),
        doc = +d;

    if (!m.meta() || !m.has_dt() || !m.tw()) {
        view.loading(true);
        return true;
    }

    view.loading(false);

    if (!isFinite(doc) || doc < 0 || doc >= m.n_docs()) {
        d3.select("#doc_view_help").classed("hidden", false);

        // if doc is un- or misspecified and there is no last doc, bail
        if (VIS.last.doc === undefined) {
            d3.select("#doc_view_main").classed("hidden", true);
            return true;
        }

        // otherwise, fall back to last doc if none entered
        doc = VIS.last.doc;
        div.select("a#last_doc")
            .attr("href", "#/doc/" + doc)
            .text(document.URL.replace(/#.*$/, "") + "#/doc/" + doc);
        div.select("#last_doc_help").classed("hidden", false);
    } else {
        d3.select("#doc_view_help").classed("hidden", true);
        VIS.last.doc = doc;
    }
    d3.select("#doc_view_main").classed("hidden", false);

    view.calculating("#doc_view", true);
    m.doc_topics(doc, m.n(), function (ts) {
        var topics = ts.filter(function (t) {
            return !VIS.topic_hidden[t.topic] || VIS.show_hidden_topics;
        });

        view.calculating("#doc_view", false);
        
        view.doc({
            topics: topics,
            meta: m.meta(doc),
            special: m.special_issue(doc),
            total_tokens: d3.sum(topics, function (t) { return t.weight; }),
            words: topics.map(function (t) {
                return m.topic_words(t.topic, VIS.overview_words);
            }),
            names: topics.map(function (t) {
                return m.topic_name(t.topic);
            })
        });

        hide_topics();
    });

    return true;

    // TODO nearby documents list
};

bib_view = function (m, maj, min, dir) {
    var sorting = {
            major: maj,
            minor: min,
            dir: dir
    },
        asc,
        ordering;

    if (!m.meta()) {
        view.loading(true);
        return true;
    }

    sorting = bib.sort.validate(sorting);
    // it's not really clear how to respond to a URL like #/bib/year,
    // but we'll use the default minor sort in that case
    if (sorting.minor === undefined) {
        if (sorting.major === undefined) {
            sorting.minor = VIS.last.bib.minor || VIS.bib_view.minor;
        } else  {
            sorting.minor = VIS.bib_view.minor;
        }
    }
    if (sorting.major === undefined) {
        sorting.major = VIS.last.bib.major || VIS.bib_view.major;
    }
    if (sorting.dir === undefined) {
        sorting.dir = VIS.last.bib.dir || VIS.bib_view.dir;
    }

    VIS.last.bib = sorting;

    asc = bib.sort.dir(sorting);
    ordering = bib.sort(m, sorting.major, sorting.minor,
            asc.major, asc.minor);

    if (!VIS.ready.bib) {
        // Cache the list of citations
        // TODO better to do this on the model (in a thread?)
        VIS.bib_citations = m.meta().map(bib.citation);
        VIS.ready.bib = true;
    }

    view.bib({
        ordering: ordering,
        major: sorting.major,
        minor: sorting.minor,
        dir: sorting.dir,
        citations: VIS.bib_citations,
        specials: m.special_issue()
    });

    view.loading(false);

    // TODO smooth sliding-in / -out appearance of navbar would be nicer

    VIS.ready.bib = true;

    return true;
};

about_view = function (m, section) {
    view.about(section);
    view.loading(false);
    d3.select("#about_view").classed("hidden", false);
    return true;
};

settings_view = function (m) {
    var p = {
        max_words: m.n_top_words(),
        max_docs: m.n_docs()
    };
    if (p.max_words === undefined || p.max_docs === undefined) {
        return false;
    }

    view.settings(p);

    view.loading(false);
    d3.select("#settings_view").classed("hidden", false);
    return true;
};

model_view = function (m, type, p1, p2) {
    var type_chosen = type || VIS.last.model || "grid";

    // if loading scaled coordinates failed,
    // we expect m.topic_scaled() to be defined but empty, so we'll pass this,
    // but fall through to choosing the grid below
    if (!m.tw() || !m.topic_scaled()) {
        view.loading(true);
        return true;
    }

    // ensure pill highlighting
    d3.selectAll("#nav_model li.active").classed("active", false);
    d3.select("#nav_model_" + type_chosen).classed("active", true);

    // hide all subviews and controls; we'll reveal the chosen one
    d3.select("#model_view_plot").classed("hidden", true);
    d3.select("#model_view_list").classed("hidden", true);
    d3.select("#model_view_yearly").classed("hidden", true);

    d3.selectAll(".model_view_grid").classed("hidden", true);
    d3.selectAll(".model_view_scaled").classed("hidden", true);
    d3.selectAll(".model_view_list").classed("hidden", true);
    d3.selectAll(".model_view_yearly").classed("hidden", true);

    // reveal navbar
    d3.select("#model_view nav").classed("hidden", false);

    if (type_chosen === "list") {
        if (!m.meta() || !m.has_dt()) {
            view.loading(true);
            return true;
        }

        model_view_list(m, p1, p2);
        d3.select("#model_view_list").classed("hidden", false);
    } else if (type_chosen === "yearly") {
        if (!m.meta() || !m.has_dt()) {
            view.loading(true);
            return true;
        }

        model_view_yearly(m, p1);
        d3.select("#model_view_yearly").classed("hidden", false);
    } else { // grid or scaled
        // if loading scaled coordinates failed,
        // we expect m.topic_scaled() to be defined but empty
        if (!m.topic_scaled() || !m.has_dt()) {
            view.loading(true);
            return true;
        }

        if (type_chosen !== "scaled" || m.topic_scaled().length !== m.n()) {
            // default to grid if there are no scaled coords to be found
            // or if type is misspecified
            type_chosen = "grid";
        }
        model_view_plot(m, type_chosen);
        d3.select("#model_view_plot").classed("hidden", false);
    }
    VIS.last.model = type_chosen;
    // reveal interface elements
    d3.selectAll(".model_view_" + type_chosen).classed("hidden", false);

    view.loading(false);
    return true;
};

model_view_list = function (m, sort, dir) {
    view.calculating("#model_view_list", true);

    m.topic_total(undefined, function (sums) {
        m.topic_yearly(undefined, function (yearly) {
            view.calculating("#model_view_list", false);
            view.model.list({
                yearly: yearly,
                sums: sums,
                words: m.topic_words(undefined, VIS.overview_words),
                sort: sort,
                dir: dir,
                names: d3.range(m.n()).map(m.topic_name),
                topic_hidden: VIS.topic_hidden
            });

            hide_topics();
        });
    });

    return true;
};

model_view_plot = function (m, type) {
    m.topic_total(undefined, function (totals) {
        var topics = d3.range(m.n());
        if (!VIS.show_hidden_topics) {
            topics = topics.filter(function (t) { return !VIS.topic_hidden[t]; });
        }

        view.model.plot({
            type: type,
            topics: topics.map(function (t) {
                return {
                    t: t,
                    words: m.topic_words(t, VIS.model_view.words),
                    scaled: m.topic_scaled(t),
                    total: totals[t],
                    name: m.topic_name(t)
                };
            })
        });
    });

    return true;
};

model_view_yearly = function (m, type) {
    var p = {
        type: type
    };


    if (VIS.ready.model_yearly) {
        view.model.yearly(p);
        return true;
    }

    // otherwise:
    view.calculating("#model_view_yearly", true);
    m.yearly_total(undefined, function (totals) {
        m.topic_yearly(undefined, function (yearly) {
            p.yearly_totals = totals;
            p.topics = yearly.map(function (wts, t) {
                return { 
                    t: t,
                    wts: wts,
                    words: m.topic_words(t, VIS.model_view.yearly.words),
                    name: m.topic_name(t)
                };
            })
                .filter(function (topic) {
                    return VIS.show_hidden_topics || !VIS.topic_hidden[topic.t];
                });

            view.model.yearly(p);
            view.calculating("#model_view_yearly", false);
        });
    });

    return true;
};

set_view = function (hash) {
    window.location.hash = hash;
};

view_refresh = function (m, v) {
    var view_parsed, v_chosen, param, success, j;

    view_parsed = v.split("/");
    if (view_parsed[view_parsed.length - 1] === "no_intro") {
        view_parsed.length -= 1;
    }

    if (VIS.cur_view !== undefined && !view.updating()) {
        VIS.cur_view.classed("hidden", true);
    }

    // well-formed view must begin #/
    if (view_parsed[0] !== "#") {
        view_parsed = VIS.default_view.split("/");
    }

    v_chosen = view_parsed[1];

    param = view_parsed.slice(2, view_parsed.length);
    param.unshift(m);
    switch (v_chosen) {
        case "model":
            success = model_view.apply(undefined, param);
            break;
        case "about":
            success = about_view.apply(undefined, param);
            break;
        case "settings":
            success = settings_view(m);
            break;
        case "bib":
            success = bib_view.apply(undefined, param);
            break;
        case "topic":
            success = topic_view.apply(undefined, param);
            break;
        case "word":
            success = word_view.apply(undefined, param);
            break;
        case "doc":
            success = doc_view.apply(undefined, param);
            break;
        case "words":
            success = words_view.apply(undefined, param);
            break;
        case "settings":
            settings_modal(m);
            success = false;
            break;
        default:
            success = false;
            break;
    }

    if (success) {
        // TODO get all view functions to report on the chosen view with this
        // mechanism, then make less kludgy
        if (typeof success === "string") {
            param = [undefined].concat(success.split("/"));
        }
        VIS.cur_view = d3.select("div#" + v_chosen + "_view");

        VIS.annotes.forEach(function (c) {
            d3.selectAll(c).classed("hidden", true);
        });
        VIS.annotes = [".view_" + v_chosen];
        for (j = 1; j < param.length; j += 1) {
            VIS.annotes[j] = VIS.annotes[j - 1] + "_" + param[j];
        }
        VIS.annotes.forEach(function (c) {
            d3.selectAll(c).classed("hidden", false);
        });
    } else {
        if (VIS.cur_view === undefined) {
            // fall back on model_view
            // TODO make this go to default_view instead
            VIS.cur_view = d3.select("div#model_view");
            model_view(m);
        } 
        // TODO and register the correct annotations
    }

    if (!view.updating()) {
        view.scroll_top();
    }
    view.updating(false);
    // ensure hidden topics are shown/hidden (actually, with
    // asynchronous rendering this isn't perfect)
    hide_topics();


    VIS.cur_view.classed("hidden", false);

    // ensure highlighting of nav link
    d3.selectAll("#nav_main > li.active").classed("active", false);
    d3.select("li#nav_" + v_chosen).classed("active", true);

    // hide subnavs
    d3.selectAll("#nav_main li:not(.active) > .nav")
        .classed("hidden", true);
    d3.selectAll("#nav_main li.active > .nav")
        .classed("hidden", false);
};

hide_topics = function (flg) {
    var flag = (flg === undefined) ? !VIS.show_hidden_topics : flg;
    d3.selectAll(".hidden_topic")
        .classed("hidden", function () {
            return flag;
        });
};


// initialization
// --------------

// global visualization setup
setup_vis = function (m) {
    // load any preferences stashed in model info
    if (m.info()) {
        VIS = utils.deep_replace(VIS, m.info().VIS);

        // model title
        d3.selectAll(".model_title")
            .html(m.info().title);
    }

    // hashchange handler
    window.onhashchange = function () {
        view_refresh(m, window.location.hash, false);
    };

    // resizing handler
    $(window).resize(function () {
        if (VIS.resize_timer) {
            window.clearTimeout(VIS.resize_timer);
        }
        VIS.resize_timer = window.setTimeout(function () {
            view.updating(true);
            view.dirty("topic/yearly", true);
            view_refresh(m, window.location.hash);
            VIS.resize_timer = undefined; // ha ha
        }, VIS.resize_refresh_delay);
    });


    $("#settings_modal").on("hide.bs.modal", function () {
        view.updating(true);
        view_refresh(m, window.location.hash);
    });

};

load_data = function (target, callback) {
    var target_base, target_id;

    if (target === undefined) {
        return callback("target undefined", undefined);
    }
    
    target_base = target.replace(/^.*\//, "");
    target_id = "m__DATA__" + target_base.replace(/\..*$/, "");

    // preprocessed data available in DOM?
    if (document.getElementById(target_id)) {
        return callback(undefined,
                document.getElementById(target_id).innerHTML);
    }
    
    // otherwise, we have to fetch it

    // If the request is for a zip file, we'll unzip.
    // N.B. client-side unzipping only needed if you don't have control
    // over whether the server zips files
    if (target.search(/\.zip$/) > 0) {
        return d3.xhr(target)
            .responseType("arraybuffer")
            .get(function (error, response) {
                var zip, text;
                if (response && response.status === 200) {
                    zip = new JSZip(response.response);
                    text = zip.file(target_base.replace(/\.zip$/, "")).asText();
                }
                return callback(error, text);
            });
    }
    
    // Otherwise, no unzipping
    return d3.text(target, function (error, s) {
        return callback(error, s);
    });
};


// main
// ----

main = function () {
    load_data(VIS.files.info,function (error, info_s) {
        var m = model();

        // We need to know whether we got new VIS parameters before we
        // do the rest of the loading, but if info is missing, it's not
        // really the end of the world

        if (typeof info_s === 'string') {
            m.info(JSON.parse(info_s));
        } else {
            view.warning("Unable to load model info from " + VIS.files.info);
        }

        setup_vis(m);

        // no need to globally expose the model, but handy for debugging
        // __DEV_ONLY__
        // VIS.m = m;
        // __END_DEV_ONLY__

        // now launch remaining data loading; ask for a refresh when done
        load_data(VIS.files.meta, function (error, meta_s) {
            if (typeof meta_s === 'string') {
                m.set_meta(meta_s);
                view_refresh(m, window.location.hash);
            } else {
                view.error("Unable to load metadata from " + VIS.files.meta);
            }
        });
        load_data(VIS.files.dt, function (error, dt_s) {
            m.set_dt(dt_s, function (result) {
                if (result) {
                    view_refresh(m, window.location.hash);
                } else {
                    view.error("Unable to load document topics from "
                        + VIS.files.dt);
                }
            });
        });
        load_data(VIS.files.tw, function (error, tw_s) {
            if (typeof tw_s === 'string') {
                m.set_tw(tw_s);

                // set up list of visible topics
                VIS.topic_hidden = d3.range(m.n()).map(function (t) {
                    return VIS.hidden_topics.indexOf(t + 1) !== -1;
                });

                view.topic.dropdown(d3.range(m.n()).map(function (t) {
                    return {
                        topic: t,
                        words: m.topic_words(t, VIS.model_view.words),
                        name: m.topic_name(t),
                        hidden: VIS.topic_hidden[t]
                    };
                }));

                view_refresh(m, window.location.hash);
            } else {
                view.error("Unable to load topic words from " + VIS.files.tw);
            }
        });
        load_data(VIS.files.topic_scaled, function (error, s) {
            if (typeof s === 'string') {
                m.set_topic_scaled(s);
            } else {
                // if missing, just gray out the button for the view
                m.set_topic_scaled("");
                d3.select("#nav_model_scaled")
                    .classed("disabled", true)
                    .select("a")
                        .attr("href", "#/model/scaled");
            }

            view_refresh(m, window.location.hash);
        });

        view_refresh(m, window.location.hash);
    });
};

// execution is up to you: main()
