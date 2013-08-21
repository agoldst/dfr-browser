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



// Principal view-generating functions
// -----------------------------------

var topic_view = function(m,topic) {

    console.log("View for topic " + (topic + 1));

    // get top words and weights
    //
    // get top articles
    //
    // (later: time graph)
    // (later: nearby topics by J-S div or cor on log probs)
};

var word_view = function(m,word) {

    console.log("View for word " + word);
    // get top topics
    //
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

        as.classed("topic_overview",true);

        as.text(function (t) {
            var label, w;
            
            label = d3.format("03d")(t + 1); // user-facing index is 1-based
            w = m.tw[t].keys().sort(function(j,k) {
                return d3.descending(m.tw[t].get(j),m.tw[t].get(k));
            });
            for(i = 0;i < VIS.overview_words;i++) {
                label += " " + w[i];
            }
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
