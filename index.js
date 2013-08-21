// model specification
// -------------------
var Model = function() {
    return {
        tw: [],     // array of d3.map()s
        dt: [],     // docs in rows, topic counts in columns
        alpha: [],  // alpha value for topics
        uris: [],   // document uris
        cites: [],  // document citations
        n: 0,
    };
}


// utility functions
// -----------------

var top_words = function(m,t,n) {
    w = m.tw[t].keys().sort(function(j,k) {
        return d3.descending(m.tw[t].get(j),m.tw[t].get(k));
    });

    return w.slice(0,n);
};

var topic_label = function(m,t,n) {
    var label;
    
    label = d3.format("03d")(t + 1); // user-facing index is 1-based
    label += " ";
    label += top_words(m,t,VIS.overview_words).join(" ");
    return label;
};

var word_topics = function(m,word) {
    var result,rank;

    result = [];
    for(t = 0;t < m.n;t++) {
        if(m.tw[t].has(word)) {
            rank = 0;
            word_wt = m.tw[t].get(word);

            m.tw[t].forEach(function(w,wt) {
                if(wt > word_wt) {
                    rank++; // tied elts are ranked as high (ordinally) as poss.
                }
            });
            result.push([t,rank]);
        }
    }
    return result;
};




// Principal view-generating functions
// -----------------------------------

var topic_view = function(m,t) {
    var view, as;

    console.log("View for topic " + (t + 1));

    hide_views();

    view = d3.select("div#topic_view");

    // get top words and weights
    // -------------------------

    view.select("h2")
        .text(topic_label(m,t,VIS.overview_words));

    view.select("p#topic_remark")
        .text("α = " + d3.round(m.alpha[t],3));


    as = view.select("div#topic_words")
        .selectAll("a")
        .data(top_words(m,t,m.tw[t].keys().length));

    as.enter()
        .append("a");

    as.exit().remove();

    as
        .attr({ href: "#" })
        .text(function (w) {
                return m.tw[t].get(w) + " " + w;
        }) 
        .on("click",function (w) {
            word_view(m,w);
        });


    // get top articles
    // ----------------

        /*
    as = view.select("div#topic_docs")
        .selectAll("a")
        .data(top_articles(m,t,VIS.topic_docs));

    as.enter()
        .append("a");

    as.exit().remove();

    as
        .attr({ href: "#" })
        .text(function (d) {
            var weight,frac;

            weight = m.dt[d][t]; 
            frac = weight / d3.sum(m.dt[d]);
            return weight.toString() + " ("
                + frac.toString() + ") "
                + m.cites[d];
        })
        .on("click",function (d) {
            doc_view(m,d);
        })


        */
    // ready
    view.classed("hidden",false);

    // (later: time graph)
    // (later: nearby topics by J-S div or cor on log probs)
    //
};

var word_view = function(m,word) {
    var view, as, topics;

    console.log("View for word " + word);

    hide_views();

    view = d3.select("div#word_view");

    view.select("h2")
        .text(word);

    topics = word_topics(m,word);
    topics = topics.sort(function(a,b) {
        return d3.ascending(a[1],b[1]);
    });
    as = view.selectAll("a")
        .data(topics);

    as.enter().append("a");
    as.exit().remove();

    as
        .text(function(d) {
            return "Ranked " + (d[1] + 1)
                + " in " + topic_label(m,d[0],VIS.overview_words);
        })
        .attr({ href: "#" })
        .on("click",function(d) {
            topic_view(m,d[0]);
        });

        
    // ready
    view.classed("hidden",false);

    // (later: time graph)
};

var doc_view = function(m,doc) {

    console.log("View for doc " + doc);
    // get top topics
    //
    // (later: nearby documents)
};

var overview = function(m) {
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
            label += " (α = " + d3.round(m.alpha[t],3) + ")";
            return label;
        });

        as.attr({ href: "#" });

        as.on("click",function(t) {
            topic_view(m,t);
        });

        VIS.overview_ready = true;
    }

    d3.select("div#overview")
        .classed("hidden",false);

    // (later: word clouds)
    // (later: grid of time graphs)
    // (later: multi-dimensional scaling projection showing topic clusters)
};

// visualization object and parameters
// -----------------------------------

var VIS = {
    overview_words: 15,
    topic_view_words: 50,
    overview_ready: false
};

var hide_views = function() {
    var views,selector;
    views = [
        "overview",
        "topic_view",
        "doc_view",
        "word_view"
    ];

    for(i = 0;i < views.length;i++) {
        selector = "div#" + views[i];
        d3.select(selector)
            .classed("hidden",true);
    }
};

// initialization
// --------------

var setup_vis = function(m) {
    // Make overview link clickable

    d3.select("a#overview_link")
        .on("click",function() {
            overview(m);
        });

    // load model information and stick it in page header elements

    d3.select("header h1")
        .text(m.model_meta.title);
    d3.select("div#meta_info")
        .html(m.model_meta.meta_info);

};

var read_files = function(ready_callback) {
    var m;

    m = Model();

    // 
    // TODO read doc-topics
    // dt: [],     // docs in rows, topic counts in columns
    //
    // TODO read metadata:
    //      uris: [],   // document uris
    //      cites: [],  // document citations
    d3.json("data/model_meta.json",function (d) {
        m.model_meta = d;

        console.log("Read model_meta.json");

        d3.csv("data/keys.csv",
            function(d) {
                // read topic-words (but only N most probable) as d3.maps()s
                
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
            },
            function(d) {
                console.log("Read keys.csv");
                // set topic count
                m.n = m.tw.length;

                console.log("I count " + m.n + " topics");

                return ready_callback(m);
            });
    });
};


// main
// ----

var main = function() {
    read_files(function(model) {
        setup_vis(model);
        overview(model);
    });
};

// execution

main();
