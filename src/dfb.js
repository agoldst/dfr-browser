/*global d3, $, JSZip, utils, model, view, bib, metadata, VIS, window, document */
"use strict";

var dfb = function (spec) {
    var my = spec || { },
        that = { },
        settings_modal,
        update_settings,
        model_view_list, // helper functions for model subviews
        model_view_plot,
        model_view_conditional,
        refresh,
        set_view,       // public methods:  for changing views
        view_hash,      //                  for getting a link to a view
        view_link,
        switch_model,   //                  for switching models
        parse_hash,
        hide_topics,
        topic_hidden,
        data_signature,
        setup_listeners, // initialization
        setup_views,
        load_data,      // data-loading utilities
        load_model,
        load_info, load_dt, load_tw, load_meta, load_topic_scaled,
        load;           // public method for starting the whole thing

    // set up model storage
    my.ms = d3.map();
    // and settings storage
    my.model_vis = d3.map();

    // and tell view who we are
    if (view.dfb() === undefined) {
        view.dfb(that);
    } else {
        view.error(
            "view.dfb already defined: dfb() called more than once?"
        );
    }

    // set up view routing table
    my.views = d3.map();
    // record of previous state
    my.last = {
        // view: undefined // until we actually succeed in rendering a view
        bib: { },
        model_list: { }
    };
    // set up data cache. Components:
    // topic_hidden array
    // citations array
    my.cache = { };
    // settings which the user change: a subset of VIS which should not change
    // when we switch models
    // TODO make less ugly?
    my.settings = {
        overview_words: 0,
        show_hidden_topics: false,
        topic_view: { words: 0, docs: 0 },
        model_view: { conditional: { streamgraph: true } }
    };
    // maps of file names to arrays of model ids that have common data
    my.shared = {
        models: d3.map(),
        meta: d3.map(),
        model_key: function (fs) {
            return fs.dt + ">>>" + fs.tw + ">>>" + fs.topic_scaled;
        }
    };

// Principal view-generating functions
// -----------------------------------

my.views.set("topic", function (t_id, y) {
    var words, t,
        view_top_docs;

    if (!my.m.ready("meta") || !my.m.ready("dt") || !my.m.ready("tw")) {
        // not ready yet; show loading message
        view.loading(true);
        return true;
    }

    t = my.m.topic_index(t_id);

    // if the topic is missing or unspecified, show the help
    if (!isFinite(t) || t < 0 || t >= my.m.n()) {
        d3.select("#topic_view_help").classed("hidden", false);
        d3.select("#topic_view_main").classed("hidden", true);
        view.loading(false);
        return true;
    }

    words = utils.shorten(my.m.topic_words(t), my.settings.topic_view.words);

    view.topic({
        t: t,
        words: words,
        label: my.m.topic_label(t)
    });

    // reveal the view div
    d3.select("#topic_view_help").classed("hidden", true);
    d3.select("#topic_view_main").classed("hidden", false);

    // topic word subview
    view.topic.words(words);

    view.calculating("#topic_docs", true);
    if (!my.condition || !my.m.ready("meta_" + my.condition.field)) {
        view.loading(true);
        return true;
    }

    // topic conditional barplot subview
    my.m.topic_conditional(t, my.condition.field, function (data) {
        view.topic.conditional({
            t: t_id,
            condition: data.has(y) ? y : undefined, // validate condition y
            type: my.condition.type,
            condition_name: my.condition.name,
            data: data,
            key: my.m.meta_condition(my.condition.field),
            // if the last view was also a topic view,
            // we allow an animated transition
            transition: my.updating
        });
    });

    // create callback for showing top docs; used in if/else following
    view_top_docs = function (docs) {
        var doc_ids = docs.map(function (d) {
            return my.m.meta().doc_id(d.doc);
        });
        view.calculating("#topic_docs", false);
        view.topic.docs({
            t: my.m.topic_id(t),
            docs: docs,
            doc_ids: doc_ids,
            citations: my.m.meta().doc(doc_ids).map(function (d) {
                return my.m.bib().citation(d);
            }),
            condition: y,
            type: my.condition.type,
            condition_name: my.condition.name,
            key: my.m.meta_condition(my.condition.field),
            proper: my.proper
        });

    };

    // if no condition given, show unconditional top docs
    if (y === undefined) {
        my.m.topic_docs(t, my.settings.topic_view.docs, view_top_docs);
    } else {
        // otherwise, ask for list conditional on y
        // N.B. an invalid condition will yield no docs
        // (and a message will show to that effect)
        my.m.topic_docs_conditional(t, my.condition.field, y,
                my.settings.topic_view.docs, view_top_docs);
    }

    view.loading(false);
    return (y === undefined) ? [t_id] : [t_id, y];
});

my.views.set("word", function (w) {
    var div = d3.select("div#word_view"),
        h,
        word = w,
        topics, n = 0;

    if (!my.m.ready("tw")) {
        view.loading(true);
        return true;
    }
    view.loading(false);

    if (word) {
        div.select("#word_view_help").classed("hidden", true);
    } else {
        div.select("#word_view_help").classed("hidden", false);
        if (my.last.word) {
            word = my.last.word; // fall back to last word if available
            h = view_link({ type: "word", param: word });
            div.select("a#last_word")
                .attr("href", h)
                .text(document.URL.replace(/#.*$/, "") + h);
            div.select("#last_word_help").classed("hidden", false);
        } else {
            div.select("#word_view_main").classed("hidden", true);
            view.word({ word: undefined });
            return true;
        }
    }
    div.select("#word_view_main").classed("hidden", false);

    my.updating = word === my.last.word;
    my.last.word = word;

    topics = my.m.word_topics(word).filter(function (t) {
        return !topic_hidden(t.topic);
    });

    if (topics.length > 0) {
        n = 1 + d3.max(topics, function (t) {
            return t.rank; // 0-based, so we rank + 1
        });
        // count words per row, taking account of possible ties
        n = d3.max(topics, function (t) {
            return my.m.topic_words(t.topic, n).length;
        });
    }
    // but not too few words. Also take care of topics.length = 0 case
    n = Math.max(VIS.word_view.n_min, n);

    view.word({
        word: word,
        topics: topics.map(function (t) {
            return {
                t: t.topic,
                id: my.m.topic_id(t.topic),
                label: my.m.topic_label(t.topic),
                rank: t.rank,
                words: my.m.topic_words(t.topic, n).slice(0, n)
            };
        }),
        n: n,
        n_topics: my.m.n(),
        updating: my.updating
    });

    return word ? [word] : [];
});

my.views.set("words", function () {
    var ts;
    if (!my.m.ready("tw")) {
        view.loading(true);
        return true;
    }
    view.loading(false);

    if (!my.settings.show_hidden_topics) {
        ts = d3.range(my.m.n())
            .filter(function (t) { return !topic_hidden(t); });
    }
    // if we are revealing hidden topics, ts can be undefined
    // and m.vocab(ts) will return the full vocab.

    return view.words(my.m.vocab(ts));
});

my.views.set("doc", function (doc) {
    var div = d3.select("div#doc_view"),
        d, h, meta;

    if (!my.m.ready("meta") || !my.m.ready("dt") || !my.m.ready("tw")) {
        view.loading(true);
        return true;
    }

    d = my.m.meta().doc_index(doc);
    view.loading(false);

    if (d === undefined) {
        d3.select("#doc_view_help").classed("hidden", false);

        // if doc is un- or misspecified and there is no last doc, bail
        if (my.last.doc === undefined) {
            d3.select("#doc_view_main").classed("hidden", true);
            return [];
        }

        // otherwise, fall back to last doc if none entered
        d = my.m.meta().doc_index(my.last.doc);

        // last.doc might be no good if we've changed models
        if (d === undefined) {
            d3.select("#doc_view_main").classed("hidden", true);
            return [];
        }

        meta = my.m.meta().doc(my.last.doc);
        h = view_link({ type: "doc", param: my.last.doc });
        div.select("a#last_doc")
            .attr("href", h)
            .text(document.URL.replace(/#.*$/, "") + h);
        div.select("#last_doc_help").classed("hidden", false);
    } else {
        d3.select("#doc_view_help").classed("hidden", true);
        my.last.doc = doc;
        meta = my.m.meta().doc(doc);
    }
    d3.select("#doc_view_main").classed("hidden", false);

    view.calculating("#doc_view", true);
    my.m.doc_topics(d, my.m.n(), function (ts) {
        var topics = ts.filter(function (t) {
            return !topic_hidden(t.topic);
        });

        view.calculating("#doc_view", false);

        view.doc({
            topics: topics,
            citation: my.m.bib().citation(meta),
            url: my.m.bib().url(meta),
            total_tokens: d3.sum(topics, function (t) { return t.weight; }),
            words: topics.map(function (t) {
                return my.m.topic_words(t.topic, my.settings.overview_words);
            }),
            labels: topics.map(function (t) {
                return my.m.topic_label(t.topic);
            }),
            ids: topics.map(function (t) {
                return my.m.topic_id(t.topic);
            }),
            proper: my.proper
        });

        hide_topics();
    });

    return [doc];

    // TODO nearby documents list
});

my.views.set("bib", function (maj, min, dir) {
    var sorting = {
            major: maj,
            minor: min,
            dir: dir
    },
        ordering;

    if (!my.m.ready("meta")) {
        view.loading(true);
        return true;
    }

    sorting = my.m.bib().sort.validate(sorting);
    // it's not really clear how to respond to a URL like #/bib/year,
    // but we'll use the default minor sort in that case
    if (sorting.minor === undefined) {
        if (sorting.major === undefined) {
            sorting.minor = my.last.bib.minor || VIS.bib_view.minor;
        } else  {
            sorting.minor = VIS.bib_view.minor;
        }
    }
    if (sorting.major === undefined) {
        sorting.major = my.last.bib.major || VIS.bib_view.major;
    }
    if (sorting.dir === undefined) {
        sorting.dir = my.last.bib.dir || VIS.bib_view.dir;
    }

    my.last.bib = sorting;

    ordering = my.m.bib().sort({
        major: sorting.major,
        minor: sorting.minor,
        dir: my.m.bib().sort.dir(sorting),
        docs: my.m.meta().doc(),
        doc_ids: my.m.meta().doc_id()
    });

    if (!my.cache.citations) {
        // Cache the list of citations
        my.cache.citations = d3.map();
        my.m.meta().doc().forEach(function (d, j) {
            my.cache.citations.set(my.m.meta().doc_id(j),
                    my.m.bib().citation(d));
        });
    }

    view.bib.dropdown(my.m.bib().sorting());

    view.bib({
        ordering: ordering,
        major: sorting.major,
        minor: sorting.minor,
        dir: sorting.dir,
        citations: my.cache.citations
    });

    view.loading(false);
    return [sorting.major, sorting.minor, sorting.dir];
});

my.views.set("about", function () {
    view.about({
        meta_info: my.meta_info
    });
    view.loading(false);
    return true;
});

settings_modal = function () {
    var p = {
        max_words: my.m.n_top_words(),
        max_docs: my.m.n_docs(),
        condition_type: my.condition.type
    };
    if (p.max_words === undefined || p.max_docs === undefined) {
        return false;
    }
    // validate current settings again maxima (in case a new model is on the
    // scene with fewer words/docs than current setting)
    my.settings.overview_words = Math.min(p.max_words,
            my.settings.overview_words);
    my.settings.topic_view.words = Math.min(p.max_words,
            my.settings.topic_view.words);
    my.settings.topic_view.docs = Math.min(p.max_docs,
            my.settings.topic_view.docs);

    p = utils.deep_replace(p, my.settings);
    view.settings(p);

    $("#settings_modal").modal();
    return true;
};
that.settings_modal = settings_modal;

update_settings = function (s) {
    my.settings = utils.deep_replace(my.settings, s, true);
};
that.update_settings = update_settings;

my.views.set("model", function (type, p1, p2) {
    var type_chosen = type || my.last.model || "grid";

    // validate type, default to grid
    if (["grid", "scaled", "list", "conditional"].indexOf(type_chosen)
            === -1) {
        type_chosen = "grid";
    }

    // if loading scaled coordinates failed,
    // we expect m.topic_scaled() to be defined but empty, so we'll pass this,
    // but fall through to choosing the grid below
    if (!my.m.ready("tw") || !my.m.ready("topic_scaled")) {
        view.loading(true);
        return true;
    }

    // ensure pill highlighting
    d3.selectAll("#nav_model li.active").classed("active", false);
    d3.select("#nav_model_" + type_chosen).classed("active", true);

    // we don't want the view to flicker if this is a data switch only
    my.updating = my.updating && type_chosen === my.last.model;

    if (!my.updating) {
        // hide all subviews and controls; we'll reveal the chosen one
        d3.select("#model_view_plot").classed("hidden", true);
        d3.select("#model_view_list").classed("hidden", true);
        d3.select("#model_view_conditional").classed("hidden", true);

        d3.selectAll(".model_view_grid").classed("hidden", true);
        d3.selectAll(".model_view_scaled").classed("hidden", true);
        d3.selectAll(".model_view_list").classed("hidden", true);
        d3.selectAll(".model_view_conditional").classed("hidden", true);
    }

    // reveal navbar
    d3.select("#model_view nav").classed("hidden", false);

    if (type_chosen === "list") {
        if (!my.m.ready("meta") || !my.m.ready("dt") || !my.condition
                || !my.m.ready("meta_" + my.condition.field)) {
            view.loading(true);
            return true;
        }

        model_view_list(p1, p2);
        d3.select("#model_view_list").classed("hidden", false);
    } else if (type_chosen === "conditional") {
        if (!my.m.ready("meta") || !my.m.ready("dt") || !my.condition
                || !my.m.ready("meta_" + my.condition.field)) {
            view.loading(true);
            return true;
        }

        model_view_conditional(p1);
        d3.select("#model_view_conditional").classed("hidden", false);
    } else { // grid or scaled
        // if loading scaled coordinates failed,
        // we expect m.topic_scaled() to be defined but empty
        if (!my.m.ready("topic_scaled") || !my.m.ready("dt")) {
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
    my.last.model = type_chosen;
    // reveal interface elements
    d3.selectAll(".model_view_" + type_chosen).classed("hidden", false);

    view.loading(false);
    // TODO should in principle also return chosen subview parameters,
    // but it's hard to imagine annotating #/model/list/frac/down...
    return [type_chosen];
});

model_view_list = function (sort, dir) {
    var sort_choice, sort_dir;

    // TODO fix hide-show flicker when re-sorting or model-switching
    view.calculating("#model_view_list", true);

    sort_choice = sort || my.last.model_list.sort || "topic";
    sort_dir = dir || ((sort_choice === my.last.model_list.sort) ?
        my.last.model_list.dir : "up") || "up";
    // remember for the next time we visit #/model/list
    my.last.model_list.sort = sort_choice;
    my.last.model_list.dir = sort_dir;

    my.m.topic_total(undefined, function (sums) {
        my.m.topic_conditional(undefined, my.condition.field,
            function (data) {
                view.calculating("#model_view_list", false);
                view.model.list({
                    data: data,
                    condition_name: my.condition.name,
                    type: my.condition.type,
                    key: my.m.meta_condition(my.condition.field),
                    sums: sums,
                    words: my.m.topic_words(undefined,
                            my.settings.overview_words),
                    sort: sort_choice,
                    dir: sort_dir,
                    labels: d3.range(my.m.n()).map(my.m.topic_label),
                    ids: d3.range(my.m.n()).map(my.m.topic_id),
                    topic_hidden: data.map(function (d) {
                        return topic_hidden(d.t);
                    })
                });

                hide_topics();
            });
    });

    return true;
};

model_view_plot = function (type) {
    my.m.topic_total(undefined, function (totals) {
        var topics = d3.range(my.m.n())
            .filter(function (t) { return !topic_hidden(t); });

        view.model.plot({
            type: type,
            topics: topics.map(function (t) {
                return {
                    t: t,
                    words: my.m.topic_words(t, VIS.model_view.plot.words),
                    scaled: my.m.topic_scaled(t),
                    total: totals[t],
                    label: my.m.topic_label(t),
                    id: my.m.topic_id(t)
                };
            })
        });
    });

    return true;
};

model_view_conditional = function (type) {
    var p = {
        key: my.m.meta_condition(my.condition.field),
        condition_type: my.condition.type,
        condition_name: my.condition.name,
        streamgraph: my.settings.model_view.conditional.streamgraph,
        signature: data_signature()
    };

    // choose raw / fractional type of view and remember for next time
    p.raw = type ? (type === "raw") : my.last.model_conditional;
    my.last.model_conditional = p.raw;

    view.calculating("#model_view_conditional", true);
    my.m.conditional_total(my.condition.field, undefined, function (totals) {
        my.m.topic_conditional(undefined, my.condition.field,
            function (data) {
                p.conditional_totals = totals;
                p.topics = data.map(function (wts, t) {
                    return {
                        t: t,
                        wts: wts,
                        words: my.m.topic_words(t,
                                VIS.model_view.conditional.words
                            ).map(function (w) {
                                return w.word;
                        }),
                        label: my.m.topic_label(t),
                        id: my.m.topic_id(t)
                    };
                })
                    .filter(function (topic) {
                        return !topic_hidden(topic.t);
                    });

                view.model.conditional(p);
                view.calculating("#model_view_conditional", false);
            });
        });

    return true;
};

refresh = function () {
    var hash = window.location.hash,
        v, type, param,
        success = false;

    if (my.aliases) {
        my.aliases.forEach(function (pat, repl) {
            hash = hash.split(pat).join(repl);
        });
    }

    v = parse_hash(hash);

    // if view not well-formed, fall back to default
    if (!v) {
        // fall back to default
        // hashchange -> queue refresh (NOT an interrupt)
        set_view(my.default_view);
        return;
    }

    // are we updating a view or changing to a different one?
    my.updating = false;

    // if we have multiple models, check if we need to change models
    if (my.models.length > 1 && v.model) {
        if (my.id && my.id !== v.model) {
            load_model(v.model);
        }
    }

    type = v.type;
    if (my.last.view) {
        my.updating = type === my.last.view.type;
        if (!my.updating) {
            d3.select("#" + my.last.view.type + "_view")
                .classed("hidden", true);
        }
    }

    if (my.views.has(type)) {
        success = my.views.get(type).apply(that, v.param);
    }

    if (success) {
        param = Array.isArray(success) ? success : [];
    } else if (my.last.view) {
        // if we have a last view, render it again
        // TODO don't lose last view params
        type = my.last.view.type;
        param = my.last.view.param;
        my.views.get(type).apply(that, param);
    } else {
        // otherwise fall back on default view
        // hashchange -> queue refresh (NOT an interrupt)
        set_view(my.default_view);
        return;
    }

    view.update_annotations(type, param);

    if (!my.updating) {
        view.scroll_top();
    }
    // ensure hidden topics are shown/hidden (actually, with
    // asynchronous rendering this isn't perfect)
    hide_topics();

    d3.select("#" + type + "_view").classed("hidden", false);

    // ensure highlighting of nav link
    d3.selectAll("#nav_main > li.active").classed("active", false);
    d3.select("li#nav_" + type).classed("active", true);

    // hide subnavs
    d3.selectAll("#nav_main li:not(.active) > .nav")
        .classed("hidden", true);
    d3.selectAll("#nav_main li.active > .nav")
        .classed("hidden", false);

    // remember chosen view
    my.last.view = { type: type, param: param };
};
that.refresh = refresh;

// External objects can request a change in the view with this function,
// which triggers the hashchange handler and thus a call to refresh()

set_view = function (v) {
    window.location.hash = view_hash(v);
};
that.set_view = set_view;

switch_model = function (id) {
    var v = utils.clone(my.last.view);
    v.model = id;
    set_view(v);
};
that.switch_model = switch_model;

view_link = function (v) {
    return "#" + view_hash(v);
};
that.view_link = view_link;

view_hash = function (v) {
    var result = "";

    if (my.models.length > 1) {
        v.model = v.model || my.id;
        result += "/" + v.model;
    }

    if (!v.type) {
        return result;
    }

    result += "/" + v.type;

    if (v.param !== undefined) {
        // convenience: wrap scalar as single-element array
        if (!Array.isArray(v.param)) {
            v.param = [v.param];
        }

        if (v.param.length === 0) {
            return result;
        }

        result += "/" + v.param.join("/");
    }
    return result;
};

parse_hash = function (h) {
    var result = { }, hh;
    if (typeof h !== "string") {
        return undefined;
    }

    hh = h.split("/");
    if (hh.shift() !== "#") {
        return undefined;
    }
    if (my.models.length > 1) {
        result.model = hh.shift();
        // liberal parsing: even with multiple models, accept URLs of the
        // form #/view. N.B. thus model IDs can't be view names
        if (my.views.has(result.model)) {
            hh.unshift(result.model);
            result.model = undefined;
        }
    }
    result.type = hh.shift();
    result.param = hh;
    // special case: fix doc ids with slashes in them (like, say, DOIs)
    if (result.type === "doc" && result.param.length > 1) {
        result.param = [result.param.join("/")];
    }
    return result;
};

hide_topics = function (flg) {
    var flag = (flg === undefined) ? !my.settings.show_hidden_topics : flg;
    d3.selectAll(".hidden_topic")
        .classed("hidden", function () {
            return flag;
        });
};

topic_hidden = function (t) {
    if (my.settings.show_hidden_topics) {
        return false;
    }
    if (!my.cache.topic_hidden) {
        // set up list of visible topics when needed, provided we can
        if (!isFinite(my.m.n())) {
            return false;
        }
        my.cache.topic_hidden = d3.range(my.m.n()).map(function (t) {
            return VIS.hidden_topics.indexOf(my.m.topic_id(t)) !== -1;
        });
    }
    return my.cache.topic_hidden[t];
};

// Method giving an identifier with a current state of the full data set.  The
// only promise is that the data_signature will change if the data have changed
// in a big way.  Right now the only use for this is for the model/conditional
// view, which caches the result of the "stacking" calculation and needs to
// know if we've hidden topics.
data_signature = function () {
    return my.id + (my.settings.show_hidden_topics ? "_show" : "_hide");
};

// initialization
// --------------

// global visualization setup
setup_listeners = function (delay) {
    var resize_timer;

    // hashchange handler
    window.onhashchange = function () {
        refresh();
    };

    // resizing handler
    $(window).resize(function () {
        if (resize_timer) {
            window.clearTimeout(resize_timer);
        }
        resize_timer = window.setTimeout(function () {
            refresh();
            resize_timer = undefined; // ha ha
        }, delay);
    });


    // attach the settings modal to the navbar link
    d3.select("#nav_settings a").on("click", function () {
        d3.event.preventDefault();
        settings_modal();
    });

    $("#settings_modal").on("hide.bs.modal", function () {
        refresh();
    });

};

setup_views = function (default_view) {
    var cur, result;
    // validate the default view
    my.default_view = parse_hash("#" + default_view);
    if (my.models.length > 1 && !my.ms.has(my.default_view.model)) {
        my.default_view.model = undefined;
    }

    // hard-coded fallback
    if (!my.views.has(my.default_view.type)) {
        view.warning("Invalid VIS.default_view setting.");
        my.default_view.type = "model";
    }

    // inspect initial hash and validate model id
    cur = parse_hash(window.location.hash);
    if (cur && cur.model && my.ms.has(cur.model)) {
        result = cur.model;
    } else {
        result = my.default_view.model || my.models[0].id;
    }

    // set up frame (top navbar)
    view.frame({
        title: my.title,
        models: my.models,
        // TODO would be better not to duplicate this logic from load()
        id: result
    });

    return result;
};

// data loading
// ------------

// general file-loading utility
load_data = function (target, callback) {
    var target_base, dom_data;

    if (target === undefined) {
        return callback("target undefined", undefined);
    }

    target_base = target.replace(/^.*\//, "");
    dom_data = d3.select("#m__DATA__"
            + target_base.replace(/\//g, "_").replace(/\..*$/, ""));

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
                if (response && response.status === 200
                        && response.response.byteLength) {
                    zip = new JSZip(response.response);
                    text = zip.file(target_base.replace(/\.zip$/, ""))
                        .asText();
                }
                return callback(error, text);
            });
    }

    // Otherwise, no unzipping
    return d3.text(target, function (error, s) {
        return callback(error, s);
    });
};

// main data-loader
load = function () {
    load_data(VIS.files.info, function (error, info_s) {
        var info, id, k;

        // We need to know whether we got new VIS parameters before we
        // do the rest of the loading, but if info is missing, it's not
        // really the end of the world

        if (typeof info_s === 'string') {
            info = JSON.parse(info_s);
        } else {
            view.warning("Unable to load model info from " + VIS.files.info);
        }

        // retrieve overall browser information
        my.title = info.title;
        my.meta_info = info.meta_info;
        // if no models field, assume single model
        my.models = info.models || [ { id: "__SINGLE__" } ];
        // initialize model collection so we know what id's to recognize,
        // and fill in default file names
        my.models.forEach(function (m) {
            var basename;

            // validate model ID: can't conflict with URL pattern
            if (my.views.has(m.id) || !!m.id.match(/[\/#]/)) {
                view.warning("The model ID " + m.id +
" is not compatible with dfr-browser. Please choose another."
                );
            }

            if (typeof m.id !== "string") {
                view.error(
"The ID is mising from a model specification in info.json is missing."
                );
            }

            basename = "data/";
            if (m.id !== "__SINGLE__") {
                basename += m.id + "/";
            }

            m.files = utils.deep_replace(
                {
                    info: basename + "info.json",
                    meta: basename + "meta.csv.zip",
                    dt: basename + "dt.json.zip",
                    tw: basename + "tw.json",
                    topic_scaled: basename + "topic_scaled.csv"
                },
                m.files
            );

            k = my.shared.model_key(m.files);
            if (my.shared.models.get(k)) {
                my.shared.models.get(k).push(m.id);
            } else {
                my.shared.models.set(k, [m.id]);
            }

            k = m.files.meta;
            if (my.shared.meta.get(k)) {
                my.shared.meta.get(k).push(m.id);
            } else {
                my.shared.meta.set(k, [m.id]);
            }

            // initialize my.ms for stored models
            my.ms.set(m.id, undefined);
        });


        // initialize global visualization settings
        my.vis_template = utils.clone(VIS); // hard-coded defaults: src/VIS.js
        // add browser-global defaults
        my.vis_template = utils.deep_replace(my.vis_template, info.VIS);

        // now we can install the main event listeners
        // TODO clean up the relation between these settings
        // and model-specific VIS so it's clear which VIS settings are only
        // used on initial load and which change on each load_model
        setup_listeners(my.vis_template.resize_refresh_delay);

        // setup_views tells us which model is initially chosen
        id = setup_views(my.vis_template.default_view);

        // setup mutable browser-level settings that we don't
        // want to get squashed by model changes
        update_settings(my.vis_template);

        // set up view aliases: first defaults, then any new ones
        my.aliases = d3.map(my.vis_template.aliases);

        if (my.models.length > 1) {
            // multiple models
            load_model(id);
        } else {
            // single model
            load_model(id, my.vis_template);
        }

        refresh();
    });
};
that.load = load;

load_model = function (id, vis) {
    var files, shared_m;
    if (!my.ms.has(id)) {
        view.warning("Unknown model " + id);
        return false;
    }

    if (my.m && my.id === id) {
        // loading the current model: no op
        return true;
    }

    if (vis) {
        files = vis.files;
    } else {
        // search by id for relevant file data
        files = my.models.find(function (m) {
            return m.id === id;
        }).files;
    }

    if (my.ms.get(id) === undefined) {
        // no data loaded for this id; is it loaded under another id?

        shared_m = my.shared.models.get(my.shared.model_key(files))
            .find(function (m_id) {
                return my.ms.get(m_id) !== undefined;
            });

        // if shared data found, set; otherwise, construct new object
        my.ms.set(id, shared_m ? my.ms.get(shared_m) : model());
    }

    my.m = my.ms.get(id);
    my.id = id;

    // invalidate cache
    // TODO silly to regenerate citations in most cases
    my.cache = { };
    // this will get set in load_meta
    my.condition = undefined;

    // now launch remaining data loading; these will not re-request data if
    // we've already loaded this model
    load_info(files.info, vis, function () {
        load_meta(files.meta);
        load_dt(files.dt);
        load_tw(files.tw);
        load_topic_scaled(files.topic_scaled);
    });
    return true;
};

// unlike the other data-loaders, load_info takes a callback
// (so that we can ensure data is loaded AFTER info)
load_info = function (f, previs, callback) {
    var cb = function (vis) {
    // load any preferences stashed in particular model info
    // TODO segregate browser-general from model-specific settings
    // TODO better to pass VIS to views rather than have the global, duh
        if (vis) {
            VIS = utils.deep_replace(utils.clone(my.vis_template), vis);
            my.m.set_topic_labels(VIS.topic_labels);
            my.m.set_topic_ids(VIS.topic_ids);
        } else {
            view.warning("Unable to load model info from " + f);
        }
        // cache for later reloads
        my.model_vis.set(my.id, vis);
        callback();
    };

    // info is provided, no load
    if (previs) {
        cb(previs);
        return;
    }

    // or if we've already loaded info, we don't need the file
    if (my.model_vis.has(my.id)) {
        cb(my.model_vis.get(my.id));
        return;
    }

    load_data(f, function (error, s) {
        if (typeof s === 'string') {
            cb(JSON.parse(s));
        } else {
            cb();
        }
    });
};

load_meta = function (f) {
    var meta, callback;

    // final action after metadata is retrieved / constructed:
    // store conditionining-variable information
    callback = function (md) {
        my.condition = {
            field: VIS.condition.spec.field,
            name: VIS.condition.name || VIS.condition.spec.field,
            type: VIS.condition.type
        };
        // update conditional data
        my.m.meta_condition(
            my.condition.field,
            metadata.key[my.condition.type],
            VIS.condition.spec,
            refresh
        );
    };

    if (my.m.ready("meta")) {
        callback();
        return;
    }

    // TODO determine whether we can use an already-loaded metadata object

    meta = my.shared.meta.get(f).find(function (mid) {
        var m_share = my.ms.get(mid);
        return m_share && m_share.ready("meta");
    });
    if (meta) {
        my.m.meta(my.ms.get(meta).meta());
        callback();
        return;
    }

    // Otherwise: set up metadata and bib objects. We won't overwrite
    // any custom metadata or bib objects passed in at dfb() invocation;
    // this does mean, however, that such custom objects can only look in
    // at VIS parameters by directly accessing the global

    if (typeof my.metadata === "function") {
        meta = my.metadata(VIS.metadata.spec);
    } else if (VIS.metadata.type === "base") {
        meta = metadata(VIS.metadata.spec);
    } else if (VIS.metadata.type === "dfr") {
        meta = metadata.dfr(VIS.metadata.spec);
    } else {
        // default to DfR subclass if no other specified
        meta = metadata.dfr();
        view.warning("Unknown metadata.type; defaulting to dfr.");
    }

    if (typeof my.bib === "function") {
        // custom bib constructor passed in at dfb() invocation
        meta.bib(my.bib(VIS.bib.spec));
    } else if (VIS.bib.type === "base") {
        meta.bib(bib(VIS.bib.spec));
    } else if (VIS.bib.type === "dfr") {
        meta.bib(bib.dfr(VIS.bib.spec));
    } else {
        meta.bib(bib.dfr(VIS.bib.spec));
        view.warning("Unknown bib.type; defaulting to dfr.");
    }

    load_data(f, function (error, meta_s) {
        if (typeof meta_s === 'string') {
            // and get the metadata object ready
            meta.from_string(meta_s);
            my.m.meta(meta);
            callback();
            refresh();
        } else {
            view.error("Unable to load metadata from " + f);
        }
    });
};

load_dt = function (f) {
    var callback = function () {
        my.proper = VIS.proper;
        if (my.proper === undefined) {
            my.proper = my.m.proper();
        }
        d3.selectAll(".proper")
            .classed("hidden", !my.proper);
        d3.selectAll(".not-proper")
            .classed("hidden", my.proper);
    };

    if (my.m.ready("dt")) {
        callback();
        return;
    }

    load_data(f, function (error, dt_s) {
        my.m.set_dt(dt_s, function (result) {
            if (result.success) {
                callback();
                refresh();
            } else {
                view.error("Unable to load document topics from " + f);
            }
        });
    });
};

load_tw = function (f) {
    var callback = function () {
        view.topic.dropdown({
            topics: d3.range(my.m.n()).map(function (t) {
                return {
                    topic: t,
                    id: my.m.topic_id(t),
                    words: my.m.topic_words(t, VIS.model_view.words),
                    label: my.m.topic_label(t),
                    hidden: topic_hidden(t) // refreshes cache.topic_hidden
                };
            }),
            overview_words: my.settings.overview_words
        });

        // because the hidden-topic setting can change, we have to issue a
        // refresh here whether or not we've loaded new data
        refresh();
    };

    if (my.m.ready("tw")) {
        callback();
        return;
    }

    load_data(f, function (error, tw_s) {
        if (typeof tw_s === 'string') {
            my.m.set_tw(tw_s);
            callback();
        } else {
            view.error("Unable to load topic words from " + f);
        }
    });
};

load_topic_scaled = function (f) {
    var callback = function () {
        // if scaled missing, gray out the button for the view
        d3.select("#nav_model_scaled")
            .classed("disabled", !my.m.topic_scaled())
            .select("a").attr("href", view_link({
                type: "model",
                param: "scaled"
            }));
    };

    if (my.m.ready("topic_scaled")) {
        callback();
        return;
    }

    load_data(f, function (error, s) {
        if (typeof s === 'string') {
            my.m.set_topic_scaled(s);
        } else {
            // if missing, just gray out the button for the view
            my.m.set_topic_scaled("");
        }
        callback();
        refresh();
    });
};

    return that;
}; // dfb()

// execution is up to index.html:
// dfb({ ... })
//     .load();

