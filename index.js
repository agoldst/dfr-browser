/*global d3, queue */

/* declaration of global object (initialized in setup_vis) */
var VIS;

// model specification
// -------------------
var Model = function () {
    return {
        tw: [],     // array of d3.map()s
        dt: [],     // docs in rows, topic counts in columns
        alpha: [],  // alpha value for topics
        meta: [],   // document citations
        n: 0,
        n_top_words: 0
    };
};


// utility functions
// -----------------

// -- stringifiers
//    ------------

var topic_label = function (m,t,n) {
    var label;

    label = d3.format("03d")(t + 1); // user-facing index is 1-based
    label += " ";
    label += top_words(m,t,VIS.overview_words).join(" ");
    return label;
};

var cite_doc = function (m,d) {
    var doc,result;

    doc = m.meta[d];
    result = doc.authors.length > 0
        ? doc.authors.join(" and ")
        : "[Anon]";

    result += ", ";
    result += '"' + doc.title + ',"';
    result += " <em>" + doc.journaltitle + "</em> ";
    result += doc.volume + ", no. " + doc.issue;

    // Could do "proper" date formatting via d3.time.format() instead
    result += " (" + VIS.cite_date_format(doc.date) + "): ";
    result += doc.pagerange;

    result = result.replace(/_/g,",");
    result = result.replace(/\t/g,"");

    return result;
};

var doc_uri = function (m,d) {
    return "http://dx.doi.org"
        + VIS.uri_proxy
        + "/"
        + m.meta[d].doi;
};

// -- rankers
//    -------

var top_words = function (m,t,n) {
    var w;
    w = m.tw[t].keys().sort(function (j,k) {
        return d3.descending(m.tw[t].get(j),m.tw[t].get(k));
    });

    return w.slice(0,n);
};

var word_topics = function (m,word) {
    var result,score,t,row,rank,word_wt;

    result = [];
    for (t = 0;t < m.n;t += 1) {
        row = m.tw[t];
        if (row.has(word)) {
            rank = 0;
            word_wt = row.get(word);

            row.forEach(function (w,wt) {
                if (wt > word_wt) {
                    rank += 1;
                }
            });

            // zero-based rank = (# of words strictly greater than word)
            result.push([t,rank]);
        }
    }
    return result;
};

var top_docs = function (m,t,n) {
    var docs,wts,wt,insert,i,
        weight;

    // naive document ranking: just by the proportion of words assigned to t 
    // which does *not* necessarily give the docs where t is most salient

    weight = function (d) {
        return m.dt[d][t] / m.doc_len[d];
    };
    // initial guess
    docs = d3.range(n);
    wts = docs.map(weight);
    docs.sort(function (a,b) {
        return d3.ascending(wts[a],wts[b]);
    });
    wts = docs.map(function (d) { return wts[d]; });

    for (i = n;i < m.dt.length;i += 1) {
        wt = weight(i);
        insert = d3.bisectLeft(wts,wt);
        if(insert > 0) {
            docs.splice(insert,0,i);
            docs.shift();
            wts.splice(insert,0,wt);
            wts.shift();
        }
    }

    return docs.reverse(); // biggest first
};

// TODO user faster "top N" algorithm as in top_docs ?
var doc_topics = function (m,d,n) {
    return d3.range(m.n)
        .sort(function (a,b) {
            return d3.descending(m.dt[d][a],m.dt[d][b]);
        })
        .slice(0,n);
};

var bib_sort = function (m) {
    var result = {
        headings: [],
        docs: []
    },
        docs = d3.range(m.meta.length),
        dec,i,last,
        cur_dec = undefined,
        partition = [];

    // TODO other sorting / sectioning than date / decade

    docs = docs.sort(function (a,b) {
        return d3.ascending(+m.meta[a].date,+m.meta[b].date);
    });

    for (i = 0;i < docs.length;i += 1) {
        dec = Math.floor(m.meta[docs[i]].date.getFullYear() / 10);
        if(dec !== cur_dec) {
            partition.push(i);
            result.headings.push(dec.toString() + "0s");
            cur_dec = dec;
        }
    }
    partition.shift(); // correct for "0" always getting added at the start
    partition.push(docs.length); // make sure we get the tail 

    for (i = 0,last = 0;i < partition.length;i += 1) {
        result.docs.push(docs.slice(last,partition[i]));
        last = partition[i];
    }

    return result;
};


// Principal view-generating functions
// -----------------------------------

var topic_view = function (m,t) {
    var view, as, docs;

    console.log("View for topic " + (t + 1));

    hide_views();

    view = d3.select("div#topic_view");

    // get top words and weights
    // -------------------------

    view.select("h2")
        .text(topic_label(m,t,VIS.overview_words));

    view.select("p#topic_remark")
        .text("α = " + VIS.float_format(m.alpha[t]));


    as = view.select("div#topic_words")
        .selectAll("a")
        .data(top_words(m,t,m.n_top_words));

    as.enter()
        .append("a");

    as.exit().remove();

    as
        .attr("href","#")
        .text(function (w) {
                return m.tw[t].get(w) + " " + w;
        }) 
        .on("click",function (w) {
            word_view(m,w);
        });


    // get top articles
    // ----------------

    docs = top_docs(m,t,VIS.topic_view_docs);

    as = view.select("div#topic_docs")
        .selectAll("a")
        .data(docs);

    as.enter()
        .append("a");

    as.exit().remove();

    as
        .attr({ href: "#" })
        .html(function (d) {
            var weight,frac;

            weight = m.dt[d][t]; 
            frac = weight / m.doc_len[d];
            return weight.toString() + " ("
                + VIS.float_format(frac) + ") "
                + cite_doc(m,d);
        })
        .on("click",function (d) {
            doc_view(m,d);
        })


    // ready
    view.classed("hidden",false);

    // TODO visualize word and doc weights as lengths
    // (later: time graph)
    // (later: nearby topics by J-S div or cor on log probs)
};

var word_view = function (m,word) {
    var view, as, topics;

    console.log("View for word " + word);

    hide_views();

    view = d3.select("div#word_view");

    view.select("h2")
        .text(word);

    topics = word_topics(m,word);
    topics = topics.sort(function (a,b) {
        return d3.ascending(a[1],b[1]);
    });
    as = view.selectAll("a")
        .data(topics);

    as.enter().append("a");
    as.exit().remove();

    as
        .text(function (d) {
            return "Ranked " + (d[1] + 1) // user-facing rank is 1-based
                + " in " + topic_label(m,d[0],VIS.overview_words);
        })
        .attr({ href: "#" })
        .on("click",function (d) {
            topic_view(m,d[0]);
        });

        
    // ready
    view.classed("hidden",false);

    // (later: time graph)
};

var doc_view = function (m,doc) {
    var view, as;

    console.log("View for doc " + doc);

    hide_views();

    view = d3.select("div#doc_view");

    view.select("#doc_view h2")
        .html(cite_doc(m,doc));

    view.select("p#doc_remark")
        .html(m.doc_len[doc] + " tokens. "
                + "<a href="
                + doc_uri(m,doc)
                + ">View "
                + m.meta[doc].doi
                + " on JSTOR</a>");

    as = view.select("div#doc_topics")
        .selectAll("a")
        .data(doc_topics(m,doc,VIS.doc_view_topics));

    as.enter().append("a");
    as.exit().remove();
    as
        .attr({ href: "#"})
        .text(function (t) {
            var label, score;
            score = m.dt[doc][t];
            label = score.toString();
            label += " (" + VIS.float_format(score / m.doc_len[doc]) + ") ";
            label += topic_label(m,t,VIS.overview_words);
            return label;
        })
        .on("click",function (t) {
            topic_view(m,t);
        });

    // TODO visualize topic proportions as rectangles at the very least

    // ready 
    view.classed("hidden",false);

    // (later: nearby documents)
};

var bib_view = function (m) {
    var ordering,view,nav_as,headings,as;

    hide_views();

    console.log("Bibliography view");

    view = d3.select("div#bib_view");

    if(!VIS.bib_ready) {
        ordering = bib_sort(m);

        nav_as = view.select("nav")
            .selectAll("a")
            .data(ordering.headings);

        nav_as.enter().append("a");
        nav_as.exit().remove();

        nav_as
            .attr("href",function (h) { return "#" + h; })
            .text(function (h) { return h; });

        sections = view.select("div#bib_main")
            .selectAll("section")
            .data(ordering.headings);

        sections.enter()
            .append("section")
            .append("h2");

        sections.exit().remove();

        headings = sections.selectAll("h2");

        headings
            .attr("id",function (h) {
                return h;
            })
            .text(function (h) { return h; });

        as = sections
            .selectAll("a")
            .data(function (h,i) {
                return ordering.docs[i];
            });
            
        as.enter().append("a");
        as.exit().remove();

        // TODO list topic as well as coloring bib entry

        as
            .attr("href","#")
            .style("background-color",function (d) {
                return VIS.topic_scale(doc_topics(m,d,1));
            })
            .html(function (d) {
                return cite_doc(m,d);
            })
            .on("click",function (d) {
                doc_view(m,d);
            });

        VIS.bib_ready = true;
    }

    // ready
    view.classed("hidden",false);
};



var overview = function (m) {
    var ps;

    hide_views();

    console.log("Overview");

    if(!VIS.overview_ready) {

        as = d3.select("div#overview")
            .selectAll("a")
            .data(d3.range(m.n));

        as.enter().append("a");

        as.exit().remove();

        as.text(function (t) {
            var label;
            
            label = topic_label(m,t,VIS.overview_words);
            label += " (α = " + VIS.float_format(m.alpha[t]) + ")";
            return label;
        });

        as.attr("href","#");

        as.on("click",function (t) {
            topic_view(m,t);
        });

        VIS.overview_ready = true;
    }

    d3.select("div#overview")
        .classed("hidden",false);

    // TODO visualize alphas
    // (later: word clouds)
    // (later: grid of time graphs)
    // (later: multi-dimensional scaling projection showing topic clusters)
};


var hide_views = function () {
    var views,selector;
    views = [
        "overview",
        "topic_view",
        "doc_view",
        "word_view",
        "bib_view" 
    ];

    for (i = 0;i < views.length;i += 1) {
        selector = "div#" + views[i];
        d3.select(selector)
            .classed("hidden",true);
    }
};


// initialization
// --------------

var setup_vis = function (m) {
    // set visualization parameters on the global object VIS
    VIS = {
        overview_ready: false,
        bib_ready: false,
        overview_words: 15,     // TODO set these parameters interactively
        topic_view_words: 50,
        topic_view_docs: 20,
        doc_view_topics: 10,
        overview_ready: false,
        float_format: function (x) {
            return d3.round(x,3);
        },
        cite_date_format: d3.time.format("%B %Y"),
        uri_proxy: ".proxy.libraries.rutgers.edu",
        topic_scale: undefined // color scale
    };

    // Make overview link clickable

    d3.select("a#overview_link")
        .on("click",function () {
            overview(m);
        });

    d3.select("a#bib_link")
        .on("click",function () {
            bib_view(m);
        });

    // TODO navigation history

    // load model information and stick it in page header elements

    d3.select("header h1")
        .text(m.model_meta.title);
    d3.select("div#meta_info")
        .html(m.model_meta.meta_info);

    // scales

    VIS.topic_scale = d3.scale.ordinal()
        .domain(d3.range(m.n))
        .range(d3.range(m.n).map(function (t) {
            return d3.hsl(360 * t / m.n,0.5,0.8).toString();
        }));

};

var read_files = function (ready) {
    var m,process_keys,access_meta,process_files;

    // initialize model object
    m = Model();

    // This "accessor" eats up the rows of keys.csv and returns nothing.
    // It loads the topic-words (but only N most probable) as d3.maps()s
    process_keys = function (d) {
        var t;
        
        t = +d.topic - 1;   // topics indexed from 1 in keys.csv

        if(!m.tw[t]) {
            m.tw[t] = d3.map();
        }
        m.tw[t].set(d.word,+d.weight);
        // TODO should precalculate ranks here...? or save memory?

        // read topic alpha value

        if(m.alpha[t]===undefined) {
            m.alpha[t] = parseFloat(d.alpha);
        }
    };

    access_meta = function (d) {
        //id,doi,title,author,journaltitle,volume,issue,
        //pubdate,pagerange,publisher,type,reviewed-work
        var a_str = d.author.trim();
        var date = new Date(d.pubdate.trim());

        return {
            authors: a_str==="" ? [] : a_str.split("\t"),
            title: d.title.trim(),
            journaltitle: d.journaltitle.trim(),
            volume: d.volume.trim(),
            issue: d.issue.trim(),
            date: date,
            pagerange: d.pagerange.trim()
                .replace(/^p?p\. /,"")
                .replace(/-/g,"–"),
            doi: d.doi.trim()
        };
    };

    // this callback handles the loaded file data
    process_files = function (error,     // file error d3.csv/d3.text
                              m_meta,    // model_meta.json data
                              keys_dummy,// dummy: eaten up by process_keys
                              dt_text,   // dt.csv as a string
                              meta) {    // meta.csv processed into a list

        // explanatory info about the model 
        m.model_meta = m_meta;

        // set topic count
        m.n = m.tw.length;

        // set count of number of top words given
        m.n_top_words = m.tw[0].keys().length;

        console.log("Read keys.csv: " + m.n + " topics");

        m.dt = d3.csv.parseRows(dt_text,function (row,j) {
            return row.map(function (x) { return +x; });
        });

        console.log("Read dt.csv: " + m.dt.length + " docs");

        // precalculate doc lengths
        m.doc_len = m.dt.map(function (d) { return d3.sum(d); });

        m.meta = meta;

        console.log("Read meta.csv: " + meta.length
            + " citations");

        ready(m); // where the program actually starts
    };

    // actually load the files and call the callback
    queue()
        .defer(d3.json,"data/model_meta.json")
        .defer(d3.csv,"data/keys.csv",process_keys)
        .defer(d3.text,"data/dt.csv")
        .defer(d3.csv,"data/meta.csv",access_meta)
        .await(process_files); // process_files calls ready(m) when done
};
        
// main
// ----

var main = function () {
    read_files(function (model) { // callback, invoked when model is loaded in 
        setup_vis(model);
        overview(model);
    });
};

// execution

main();
