/*global d3, $, JSZip, model, utils, view, window, document */
"use strict";

/* declaration of global object (initialized in setup_vis) */
var VIS = {
    ready: { }, // which viz already generated?
    last: { }, // which subviews last shown?
    view_updating: false, // do we need to redraw the whole view?
    files: { // what data files to request
        info: "data/info.json",
        meta: "data/meta.csv.zip",  // remove .zip to use uncompressed data
        dt: "data/dt.json.zip",     // (name the actual file accordingly)
        tw: "data/tw.json",
        topic_scaled: "data/topic_scaled.csv"
    },
    bib_sort: {
        major: "year",
        minor: "alpha"
    },
    overview_words: 15,     // may need adjustment
    model_view: {
        w: 1140,            // px: the bootstrap container width
        aspect: 1.3333,     // for calculating height
        words: 4,           // may need adjustment
        size_range: [7, 18], // points. may need adjustment
        stroke_range: 6,    // max. perimeter thickness
        yearly: {
            w: 1090,
            h: 800,
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
        w: 800, // fixed dimensions; this will need tweaking
        h: 300, // NB the topic_plot div has a fixed height in index.css
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
        topic_label_size: 14, // pt
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
    cite_date_format: d3.time.format("%B %Y"),
    uri_proxy: ""
};

/* declaration of functions */

var bib_sort,   // bibliography sorting
    topic_link, // stringifiers
    topic_hash,
    doc_author_string,
    cite_doc,
    cite_docs,
    citation,
    topic_view, // view generation
    topic_view_words,
    topic_view_docs,
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
    view_loading,
    setup_vis,          // initialization
    load_data,
    main;               // main program


// utility functions
// -----------------

// bibliography sorting
bib_sort = function (m, major, minor) {
    var result = {
            headings: [],
            docs: []
        },
        docs,
        major_key,
        minor_key,
        cur_major,
        i,
        last,
        get_id = function (d) { return d.id; },
        partition = [];

    if (major === "decade") {
        major_key = function (i) {
            return Math.floor(m.meta(i).date.getFullYear() / 10).toString() +
                "0s";
        };
    } else if (major === "year") {
        major_key = function (i) {
            return m.meta(i).date.getFullYear();
        };
    } else if (major === "journal") {
        major_key = function (i) {
            return m.meta(i).journaltitle;
        };
    } else {
        // default to alphabetical by author
        major_key = function (i) {
            return doc_author_string(m.meta(i)).replace(/^\W*/, "")[0]
                .toUpperCase();
        };
    }

    if (minor === "date") {
        minor_key = function (i) {
            return +m.meta(i).date;
        };
    } else if (minor === "journal") {
        minor_key = function (i) {
            var doc = m.meta(i),
                result_m = doc.journaltitle;

            result_m += d3.format("05d")(doc.volume);
            result_m += d3.format("05d")(doc.issue ? 0
                    : doc.issue.replace(/\/.*$/, ""));
            if (doc.pagerange.search(/^\d/) !== -1) {
                result_m += d3.format("05d")(doc.pagerange.match(/^(\d+)/)[1]);
            } else {
                result_m += doc.pagerange;
            }
            return result_m;
        };
    } else {
        // default to alphabetical by author then title
        minor_key = function (i) {
            return doc_author_string(m.meta(i)) + m.meta(i).title;
        };
    }

    docs = d3.range(m.n_docs())
        .map(function (d) {
            return {
                id: d,
                major: major_key(d),
                minor: minor_key(d)
            };
        })
        .sort(function (a, b) {
            return d3.ascending(a.major, b.major) ||
                d3.ascending(a.minor, b.minor) ||
                d3.ascending(a.id, b.id); // stabilize sort
        });

    for (i = 0, cur_major = ""; i < docs.length; i += 1) {
        if (docs[i].major !== cur_major) {
            partition.push(i);
            result.headings.push(docs[i].major);
            cur_major = docs[i].major;
        }
    }
    partition.shift(); // correct for "0" always getting added at the start
    partition.push(docs.length); // make sure we get the tail 

    for (i = 0, last = 0; i < partition.length; i += 1) {
        result.docs.push(docs.slice(last, partition[i]).map(get_id));
        last = partition[i];
    }

    return result;
};



// -- stringifiers
//    ------------

topic_link = function (t) {
    return "#" + topic_hash(t);
};

topic_hash = function (t) {
    return "/topic/" + String(t + 1);
};

doc_author_string = function (doc) {
    var lead,
        lead_trail,
        result;

    if (doc.authors.length > 0) {
        lead = doc.authors[0].replace(/,/g, "").split(" ");
        // check for Jr., Sr., 2nd, etc.
        // Can mess up if last name is actually the letter I, X, or V.
        lead_trail = lead.pop();
        if (lead.length >= 2
                && (lead_trail.search(/^(\d|Jr|Sr|[IXV]+$)/) !== -1)) {
            result = lead.pop().replace(/_$/, "");
            lead_trail = ", " + lead_trail.replace(/\W*$/, "");
        } else {
            result = lead_trail;
            lead_trail = "";
        }
        result += ", " + lead.join(" ") + lead_trail;
        if (doc.authors.length > 1) {
            // "et al" is better for real bibliography, but it's
            // actually worth being able to search all the multiple authors
            /*if (doc.authors.length > 3) {
                result += ", " + doc.authors.slice(1, 3).join(", ");
                result += "et al.";
            } else {*/
            if (doc.authors.length > 2) {
                result += ", ";
                result += doc.authors
                    .slice(1, doc.authors.length - 1)
                    .join(", ");
            }
            result += ", and " + doc.authors[doc.authors.length - 1];
        }
    } else {
        result = "[Anon]";
    }

    return result;
};

cite_doc = function (m, d) {
    return citation(m.meta(d));
};

cite_docs = function (m, ds) {
    return m.meta(ds).map(citation);
};

citation = function (doc) {
    var result = doc_author_string(doc);

    // don't duplicate trailing period on middle initial etc.
    result = result.replace(/\.?$/, ". ");
    result += '"' + doc.title + '."';
    result += " <em>" + doc.journaltitle + "</em> ";
    result += doc.volume;
    if (doc.issue) {
        result += ", no. " + doc.issue;
    }

    result += " (" + VIS.cite_date_format(doc.date) + "): ";
    result += doc.pagerange + ".";

    result = result.replace(/\.\./g, ".");
    result = result.replace(/_/g, ",");
    result = result.replace(/\t/g, "");

    return result;
};

// Principal view-generating functions
// -----------------------------------

topic_view = function (m, t, year) {
    var words;

    if (!m.meta() || !m.has_dt() || !m.tw()) {
        // not ready yet; show loading message
        view.loading(true);
        return true;
    }

    // TODO don't need anything but tw to show topic words h2 and div; so can 
    // have div-specific loading messages instead

    // if the topic is missing or unspecified, show the help
    if (!isFinite(t) || t < 0 || t >= m.n()) {
        d3.select("#topic_view_help").classed("hidden", false);
        d3.select("#topic_view_main").classed("hidden", true);
        view.loading(false);
        return true;
    }

    words = utils.shorten(m.topic_words(t), VIS.topic_view.words);

    view.topic({
        t: t,
        words: words
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
    if (!view.updating()) {
        d3.select("#topic_plot").classed("hidden", true);
    }
    m.topic_yearly(t, function (yearly) {
        view.topic.yearly({
            t: t,
            year: year,
            yearly: yearly
        });
        d3.select("#topic_plot").classed("hidden", false);
    });

    // topic top documents subview
    view.calculating("#topic_docs", true); 
    m.topic_docs(t, VIS.topic_view.docs, year, function (docs) {
        view.calculating("#topic_docs", false);
        view.topic.docs({
            t: t,
            docs: docs,
            citations: cite_docs(m, docs.map(function (d) { return d.doc; })),
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
        topics, n;

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
            return true;
        }
    }
    div.select("#word_view_main").classed("hidden", false);

    VIS.last.word = word;


    topics = m.word_topics(word);
    n = 1 + d3.max(topics, function (t) {
        return t.rank; // 0-based, so we rank + 1 
    });
    // now figure out how many words per row, taking account of possible ties
    n = d3.max(topics, function (t) {
        return m.topic_words(t.topic, n).length;
    });
    // but not too few words
    n = Math.max(VIS.word_view.n_min, n);

    view.word({
        word: word,
        topics: topics,
        words: topics.map(function (t) {
            return m.topic_words(t.topic, n).slice(0, n);
        }),
        n: n,
        n_topics: m.n(),
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
        doc = d;

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
    m.doc_topics(doc, m.n(), function (topics) {
        view.calculating("#doc_view", false);
        view.doc({
            topics: topics,
            meta: m.meta(doc),
            total_tokens: d3.sum(topics, function (t) { return t.weight; }),
            words: topics.map(function (t) {
                return m.topic_words(t.topic, VIS.overview_words);
            })
        });
    });

    return true;

    // TODO nearby documents list
};

bib_view = function (m, maj, min) {
    var major = maj,
        minor = min,
        ordering;

    if (major === undefined) {
        major = VIS.bib_sort.major;
    }
    if (minor === undefined) {
        minor = VIS.bib_sort.minor;
    }

    if (VIS.last.bib) {
        if (VIS.last.bib.major === major && VIS.last.bib.minor === minor) {
            return true;
        }
    }

    if (!m.meta()) {
        view.loading(true);
        return true;
    }

    VIS.last.bib = {
        major: major,
        minor: minor
    };

    ordering = bib_sort(m, major, minor);

    if (!VIS.ready.bib) {
        // Cache the list of citations
        // TODO better to do this on the model (in a thread?)
        VIS.bib_citations = m.meta().map(citation);
        VIS.ready.bib = true;
    }

    view.bib({
        ordering: ordering,
        major: major,
        minor: minor,
        citations: VIS.bib_citations
    });

    view.loading(false);

    // TODO smooth sliding-in / -out appearance of navbar would be nicer

    return true;

};

about_view = function (m) {
    view.about(m.info().meta_info);
    view.loading(false);
    d3.select("#about_view").classed("hidden", false);
    return true;
};

settings_view = function (m) {
    var p = {
        max_words: m.n_top_words(),
        max_docs: m.n_docs()
    }
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
    d3.selectAll("#nav_model li.active").classed("active",false);
    d3.select("#nav_model_" + type_chosen).classed("active",true);

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
                dir: dir
            });
        });
    });

    return true;
};

model_view_plot = function (m, type) {
    m.topic_total(undefined, function (totals) {
        view.model.plot({
            type: type,
            words: m.topic_words(undefined, VIS.model_view.words),
            scaled: m.topic_scaled(),
            topic_totals: totals
        });
    });

    return true;
};

model_view_yearly = function (m, type) {
    var p = {
        type: type,
        words: m.topic_words(undefined, VIS.model_view.yearly.words)
    };


    if (VIS.ready.model_yearly) {
        view.model.yearly(p);
        return true;
    }

    // otherwise:
    view.calculating("#model_view_yearly", true);
    m.yearly_total(undefined, function (totals) {
        m.topic_yearly(undefined, function (yearly) {
            view.calculating("#model_view_yearly", false);
            p.yearly_totals = totals;
            p.yearly = yearly;

            view.model.yearly(p);
        });
    });

    return true;
};

set_view = function (hash) {
    window.location.hash = hash;
};

view_refresh = function (m, v) {
    var view_parsed, param, success;

    view_parsed = v.split("/");
    param = view_parsed[2];

    if (VIS.cur_view !== undefined && !view.updating()) {
        VIS.cur_view.classed("hidden", true);
    }

    switch (view_parsed[1]) {
        case undefined:
            view_parsed[1] = "model";
            success = model_view(m);
            break;
        case "model":
            success = model_view(m, param, view_parsed[3], view_parsed[4]);
            break;
        case "about":
            success = about_view(m);
            break;
        case "settings":
            success = settings_view(m);
            break;
        case "bib":
            success = bib_view(m, param, view_parsed[3]);
            break;
        case "topic":
            param = +param - 1;
            success = topic_view(m, param, view_parsed[3]);
            break;
        case "word":
            success = word_view(m, param);
            break;
        case "doc":
            param = +param;
            success = doc_view(m, param);
            break;
        case "words":
            success = words_view(m);
            break;
        default:
            success = false;
            break;
    }

    if (success) {
        VIS.cur_view = d3.select("div#" + view_parsed[1] + "_view");
    } else {
        if (VIS.cur_view === undefined) {
            // fall back on model_view
            VIS.cur_view = d3.select("div#model_view");
            model_view(m);
        } 
    }

    view.updating(false);

    VIS.cur_view.classed("hidden", false);

    // ensure highlighting of nav link
    d3.selectAll("#nav_main li.active").classed("active",false);
    d3.select("li#nav_" + view_parsed[1]).classed("active",true);
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

    // TODO settings controls
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

                // Set up topic menu: remove loading message
                d3.select("ul#topic_dropdown").selectAll("li").remove();
                // Add menu items
                d3.select("ul#topic_dropdown").selectAll("li")
                    .data(d3.range(m.n()))
                    .enter().append("li").append("a")
                    .text(function (t) {
                        return view.topic.label(t,
                            m.topic_words(t, VIS.model_view.words));
                    })
                    .attr("href", topic_link);

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
