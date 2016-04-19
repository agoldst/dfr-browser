/*global d3, $, JSZip, utils, model, view, bib, metadata, VIS, window */
"use strict";

var dfb = function (spec) {
    var my = spec || { },
        that = { },
        topic_view, // view generation
        word_view,
        words_view,
        doc_view,
        bib_view,
        about_view,
        settings_modal,
        model_view,
        model_view_list,
        model_view_plot,
        model_view_yearly,
        refresh,
        set_view,
        hide_topics,
        setup_listeners, // initialization
        load_data,
        load;

    // Constructor: call constructors for model, metadata, bib
    my.m = model();

    // default to DfR subclasses if no other specified
    if (spec.metadata === undefined) {
        my.metadata = metadata.dfr();
    } else {
        my.metadata = spec.metadata();
    }

    // we can adjust parameters using VIS.bib only after we have loaded
    // info.json, so we'll do that in load()
    if (typeof spec.bib !== "function") {
        my.bib = bib.dfr();
    } else {
        my.bib = spec.bib();
    }

    // and tell view who we are
    if (view.dfb() === undefined) {
        view.dfb(that);
    } else {
        view.error(
            "view.dfb already defined: browser() called more than once?"
        );
    }

// Principal view-generating functions
// -----------------------------------

topic_view = function (t_user, y) {
    var words, year,
        t = +t_user - 1; // t_user is 1-based topic index, t is 0-based

    if (!my.m.meta() || !my.m.has_dt() || !my.m.tw()) {
        // not ready yet; show loading message
        view.loading(true);
        return true;
    }

    // if the topic is missing or unspecified, show the help
    if (!isFinite(t) || t < 0 || t >= my.m.n()) {
        d3.select("#topic_view_help").classed("hidden", false);
        d3.select("#topic_view_main").classed("hidden", true);
        view.loading(false);
        return true;
    }

    // validate the year
    year = my.m.valid_year(y) ? y : undefined;

    words = utils.shorten(my.m.topic_words(t), VIS.topic_view.words);

    view.topic({
        t: t,
        words: words,
        label: my.m.topic_label(t)
    });

    // reveal the view div
    d3.select("#topic_view_help").classed("hidden", true);
    d3.select("#topic_view_main").classed("hidden", false);

    my.m.total_tokens(function (total) {
        my.m.topic_total(t, function (topic_total) {
            view.topic.remark({
                alpha: my.m.alpha(t),
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
    my.m.topic_yearly(t, function (yearly) {
        view.topic.yearly({
            t: t,
            year: year,
            yearly: yearly
        });
        d3.select("#topic_plot").classed("invisible", false);
    });

    // topic top documents subview
    view.calculating("#topic_docs", true);
    my.m.topic_docs(t, VIS.topic_view.docs, year, function (docs) {
        view.calculating("#topic_docs", false);
        view.topic.docs({
            t: t,
            docs: docs,
            citations: docs.map(function (d) {
                return my.bib.citation(my.m.meta(d.doc));
            }),
            year: year
        });
    });

    view.loading(false);
    return true;
    // (later: nearby topics by J-S div or cor on log probs)
};
that.topic_view = topic_view;

word_view = function (w) {
    var div = d3.select("div#word_view"),
        word = w,
        topics, n = 0;

    if (!my.m.tw()) {
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

    topics = my.m.word_topics(word).filter(function (t) {
        return !VIS.topic_hidden[t.topic] || VIS.show_hidden_topics;
    });

    if (topics.length > 0) {
        n = 1 + d3.max(topics, function (t) {
            return t.rank; // 0-based, so we rank + 1
        });
        // now figure out how many words per row, taking account of possible ties
        n = d3.max(topics, function (t) {
            return my.m.topic_words(t.topic, n).length;
        });
    }
    // but not too few words. Also take care of topics.length = 0 case
    n = Math.max(VIS.word_view.n_min, n);

    view.word({
        word: word,
        topics: topics,
        words: topics.map(function (t) {
            return my.m.topic_words(t.topic, n).slice(0, n);
        }),
        n: n,
        n_topics: my.m.n(),
        labels: topics.map(function (t) {
            return my.m.topic_label(t.topic);
        })
    });
    return true;
};
that.word_view = word_view;

words_view = function () {
    var ts;
    if (!my.m.tw()) {
        view.loading(true);
        return true;
    }
    view.loading(false);

    if (!VIS.show_hidden_topics) {
        ts = d3.range(my.m.n())
            .filter(function (t) { return !VIS.topic_hidden[t]; });
    }
    // if we are revealing hidden topics, ts can be undefined
    // and m.vocab(ts) will return the full vocab.

    return view.words(my.m.vocab(ts));
};
that.words_view = words_view;

doc_view = function (d) {
    var div = d3.select("div#doc_view"),
        doc = +d;

    if (!my.m.meta() || !my.m.has_dt() || !my.m.tw()) {
        view.loading(true);
        return true;
    }

    view.loading(false);

    if (!isFinite(doc) || doc < 0 || doc >= my.m.n_docs()) {
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
    my.m.doc_topics(doc, my.m.n(), function (ts) {
        var topics = ts.filter(function (t) {
            return !VIS.topic_hidden[t.topic] || VIS.show_hidden_topics;
        });

        view.calculating("#doc_view", false);

        view.doc({
            topics: topics,
            citation: my.bib.citation(my.m.meta(doc)),
            url: my.bib.url(my.m.meta(doc)),
            total_tokens: d3.sum(topics, function (t) { return t.weight; }),
            words: topics.map(function (t) {
                return my.m.topic_words(t.topic, VIS.overview_words);
            }),
            labels: topics.map(function (t) {
                return my.m.topic_label(t.topic);
            })
        });

        hide_topics();
    });

    return true;

    // TODO nearby documents list
};
that.doc_view = doc_view;

bib_view = function (maj, min, dir) {
    var sorting = {
            major: maj,
            minor: min,
            dir: dir
    },
        ordering;

    if (!my.m.meta()) {
        view.loading(true);
        return true;
    }

    sorting = my.bib.sort.validate(sorting);
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

    sorting.docs = my.m.meta();
    ordering = my.bib.sort({
        major: sorting.major,
        minor: sorting.minor,
        dir: my.bib.sort.dir(sorting),
        docs: my.m.meta()
    });

    if (!VIS.ready.bib) {
        // Cache the list of citations
        // TODO better to do this on the model (in a thread?)
        VIS.bib_citations = my.m.meta().map(my.bib.citation);
        view.bib.dropdown(my.bib.sorting());
        VIS.ready.bib = true;
    }

    view.bib({
        ordering: ordering,
        major: sorting.major,
        minor: sorting.minor,
        dir: sorting.dir,
        citations: VIS.bib_citations
    });

    view.loading(false);

    // TODO smooth sliding-in / -out appearance of navbar would be nicer

    VIS.ready.bib = true;

    return true;
};
that.bib_view = bib_view;

about_view = function () {
    view.about(my.m.info());
    view.loading(false);
    d3.select("#about_view").classed("hidden", false);
    return true;
};
that.about_view = about_view;

settings_modal = function () {
    var p = {
        max_words: my.m.n_top_words(),
        max_docs: my.m.n_docs()
    };
    if (p.max_words === undefined || p.max_docs === undefined) {
        return false;
    }

    view.settings(p);

    $("#settings_modal").modal();
    return true;
};
that.settings_modal = settings_modal;

model_view = function (type, p1, p2) {
    var type_chosen = type || VIS.last.model || "grid";

    // if loading scaled coordinates failed,
    // we expect m.topic_scaled() to be defined but empty, so we'll pass this,
    // but fall through to choosing the grid below
    if (!my.m.tw() || !my.m.topic_scaled()) {
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
        if (!my.m.meta() || !my.m.has_dt()) {
            view.loading(true);
            return true;
        }

        model_view_list(p1, p2);
        d3.select("#model_view_list").classed("hidden", false);
    } else if (type_chosen === "yearly") {
        if (!my.m.meta() || !my.m.has_dt()) {
            view.loading(true);
            return true;
        }

        model_view_yearly(p1);
        d3.select("#model_view_yearly").classed("hidden", false);
    } else { // grid or scaled
        // if loading scaled coordinates failed,
        // we expect m.topic_scaled() to be defined but empty
        if (!my.m.topic_scaled() || !my.m.has_dt()) {
            view.loading(true);
            return true;
        }

        if (type_chosen !== "scaled"
                || my.m.topic_scaled().length !== my.m.n()) {
            // default to grid if there are no scaled coords to be found
            // or if type is misspecified
            type_chosen = "grid";
        }
        model_view_plot(type_chosen);
        d3.select("#model_view_plot").classed("hidden", false);
    }
    VIS.last.model = type_chosen;
    // reveal interface elements
    d3.selectAll(".model_view_" + type_chosen).classed("hidden", false);

    view.loading(false);
    return true;
};
that.model_view = model_view;

model_view_list = function (sort, dir) {
    view.calculating("#model_view_list", true);

    my.m.topic_total(undefined, function (sums) {
        my.m.topic_yearly(undefined, function (yearly) {
            view.calculating("#model_view_list", false);
            view.model.list({
                yearly: yearly,
                sums: sums,
                words: my.m.topic_words(undefined, VIS.overview_words),
                sort: sort,
                dir: dir,
                labels: d3.range(my.m.n()).map(my.m.topic_label),
                topic_hidden: VIS.topic_hidden
            });

            hide_topics();
        });
    });

    return true;
};
that.model_view_list = model_view_list;

model_view_plot = function (type) {
    my.m.topic_total(undefined, function (totals) {
        var topics = d3.range(my.m.n());
        if (!VIS.show_hidden_topics) {
            topics = topics.filter(function (t) { return !VIS.topic_hidden[t]; });
        }

        view.model.plot({
            type: type,
            topics: topics.map(function (t) {
                return {
                    t: t,
                    words: my.m.topic_words(t, VIS.model_view.words),
                    scaled: my.m.topic_scaled(t),
                    total: totals[t],
                    label: my.m.topic_label(t)
                };
            })
        });
    });

    return true;
};
that.model_view_plot = model_view_plot;

model_view_yearly = function (type) {
    var p = {
        type: type
    };


    if (VIS.ready.model_yearly) {
        view.model.yearly(p);
        return true;
    }

    // otherwise:
    view.calculating("#model_view_yearly", true);
    my.m.yearly_total(undefined, function (totals) {
        my.m.topic_yearly(undefined, function (yearly) {
            p.yearly_totals = totals;
            p.topics = yearly.map(function (wts, t) {
                return {
                    t: t,
                    wts: wts,
                    words: my.m.topic_words(t, VIS.model_view.yearly.words),
                    label: my.m.topic_label(t)
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
that.model_view_yearly = model_view_yearly;

refresh = function () {
    var view_parsed, v_chosen, param, success, j;

    view_parsed = window.location.hash.split("/");

    if (VIS.cur_view !== undefined && !view.updating()) {
        VIS.cur_view.classed("hidden", true);
    }

    // well-formed view must begin #/
    if (view_parsed[0] !== "#") {
        view_parsed = VIS.default_view.split("/");
    }

    v_chosen = view_parsed[1];

    param = view_parsed.slice(2, view_parsed.length);
    switch (v_chosen) {
        case "model":
            success = model_view.apply(undefined, param);
            break;
        case "about":
            success = about_view.apply(undefined, param);
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
            settings_modal();
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
            model_view();
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
that.refresh = refresh;

// External objects can request a change in the view with this function,
// which triggers the hashchange handler and thus a call to refresh()

set_view = function (hash) {
    window.location.hash = hash;
};
that.set_view = set_view;

hide_topics = function (flg) {
    var flag = (flg === undefined) ? !VIS.show_hidden_topics : flg;
    d3.selectAll(".hidden_topic")
        .classed("hidden", function () {
            return flag;
        });
};
that.hide_topics = hide_topics;

// initialization
// --------------

// global visualization setup
setup_listeners = function () {

    // hashchange handler
    window.onhashchange = function () {
        refresh();
    };

    // resizing handler
    $(window).resize(function () {
        if (VIS.resize_timer) {
            window.clearTimeout(VIS.resize_timer);
        }
        VIS.resize_timer = window.setTimeout(function () {
            view.updating(true);
            view.dirty("topic/yearly", true);
            refresh();
            VIS.resize_timer = undefined; // ha ha
        }, VIS.resize_refresh_delay);
    });


    // attach the settings modal to the navbar link
    d3.select("#nav_settings a").on("click", function () {
        d3.event.preventDefault();
        settings_modal();
    });

    $("#settings_modal").on("hide.bs.modal", function () {
        view.updating(true);
        refresh();
    });

};
that.setup_listeners = setup_listeners;

// data loading
// ------------

// general file-loading utility
load_data = function (target, callback) {
    var target_base, dom_data;

    if (target === undefined) {
        return callback("target undefined", undefined);
    }

    target_base = target.replace(/^.*\//, "");
    dom_data = d3.select("#m__DATA__" + target_base.replace(/\..*$/, ""));

    // preprocessed data available in DOM?
    if (!dom_data.empty()) {
        // we expect the data to be found as the text content of an
        // element with ID as selected above. Note that we are NOT parsing
        // the data into objects here, only into an unescaped string;
        // this string will then be parsed again, either as JSON or as CSV,
        // in the callback
        return callback(undefined, JSON.parse(dom_data.html()));
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
that.load_data = load_data;

// main data-loader
load = function () {
    load_data(VIS.files.info,function (error, info_s) {

        // We need to know whether we got new VIS parameters before we
        // do the rest of the loading, but if info is missing, it's not
        // really the end of the world

        if (typeof info_s === 'string') {
            my.m.info(JSON.parse(info_s));

            // finish initializing VIS by loading any preferences
            // stashed in model info

            VIS.update(my.m.info().VIS);

            // now we store any specified options for bib
            my.bib.options(VIS.bib);

            // now we can load the model title
            d3.selectAll(".model_title")
                .html(my.m.info().title);
        } else {
            view.warning("Unable to load model info from " + VIS.files.info);
        }

        // either way, now we can install the main event listeners
        // TODO can we do this even earlier?
        setup_listeners();

        // no need to globally expose the model, but handy for debugging
        // __DEV_ONLY__
        // VIS.m = m;
        // __END_DEV_ONLY__

        // now launch remaining data loading; ask for a refresh when done
        load_data(VIS.files.meta, function (error, meta_s) {
            if (typeof meta_s === 'string') {
                my.metadata.from_string(meta_s);
                my.m.set_meta(my.metadata);
                refresh();
            } else {
                view.error("Unable to load metadata from " + VIS.files.meta);
            }
        });
        load_data(VIS.files.dt, function (error, dt_s) {
            my.m.set_dt(dt_s, function (result) {
                if (result) {
                    refresh();
                } else {
                    view.error("Unable to load document topics from "
                        + VIS.files.dt);
                }
            });
        });
        load_data(VIS.files.tw, function (error, tw_s) {
            if (typeof tw_s === 'string') {
                my.m.set_tw(tw_s);

                // set up list of visible topics
                VIS.topic_hidden = d3.range(my.m.n()).map(function (t) {
                    return VIS.hidden_topics.indexOf(t + 1) !== -1;
                });

                view.topic.dropdown(d3.range(my.m.n()).map(function (t) {
                    return {
                        topic: t,
                        words: my.m.topic_words(t, VIS.model_view.words),
                        label: my.m.topic_label(t),
                        hidden: VIS.topic_hidden[t]
                    };
                }));

                refresh();
            } else {
                view.error("Unable to load topic words from " + VIS.files.tw);
            }
        });
        load_data(VIS.files.topic_scaled, function (error, s) {
            if (typeof s === 'string') {
                my.m.set_topic_scaled(s);
            } else {
                // if missing, just gray out the button for the view
                my.m.set_topic_scaled("");
                d3.select("#nav_model_scaled")
                    .classed("disabled", true)
                    .select("a")
                        .attr("href", "#/model/scaled");
            }

            refresh();
        });

        refresh();
    });
};
that.load = load;

    return that;
}; // dfb()

// execution is up to index.html:
// dfb({ ... })
//     .load();

