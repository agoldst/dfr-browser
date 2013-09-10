# A simple model browser

These files use [d3](http://d3js.org) to provide a rudimentary way to browse some of the topic model in a web browser. To set up, you will need the "weighted keys" `keys.csv` file and the `doc_topics.csv` document-topic file written out by `topics_rmallet.R`.

1. Source `prepare_data.R`. Then call:

```
prepare_data(dfr_dirs,"data",path_to_doc_topics)
```

This looks for document metadata under each of the elements of `dfr_dirs` and outputs the necessary files into the folder `data`, where the browser looks for them. The browser needs the following:
    a. `dt.csv`: headerless matrix with the i,j cell giving the number of words in document i allocated to topic j. Generated from `doc_topics.csv`.
    c. `keys.csv`: output of `weighted_keys_frame()`. Copy `keys.csv`.
    d. `meta.csv`: rows of document metadata, assumed to be in the same order as `dt.csv`. Generated from DfR `citations.CSV` files.
    b. `model_meta.json`: unlike the others, not automatically generated. This holds information about the model, for display in the browser. Currently I use only:
```
{
    "title": "Model title",
    "meta_info": "<p>About the model...<p>"
}
```

2. Launch a web server in the `browser/` directory; `bin/server` uses the python 3 `http.server` module serving at `localhost:8888`. The point of the server is simply to allow the javascript to ask for the data files from your file system (via `d3.text` and kindred functions).

3. Navigate to the home page, `http://localhost:8888`, in your favorite browser.

## What it does

Currently, this provides very minimal views of topics, documents, and word types as specified in the model. There are no visualizations, just lists of "top" words and documents in topics, "top" topics in documents, and "top" topics for words. There is also a "bibliography" view of all your documents in chronological order.

The ranking calculations are done on the fly, but nothing else is, and the page holds the document-topic matrix in memory. I haven't done much to optimize it. It's serviceable if you run it locally, but I'm not sure I'd throw it up on a web server.

## What it should do

Needed: more interactive adjustment of parameters.

Eventually I will add fuller visualizations, especially of topic frequencies over time. Some pre-generation in R is necessary for that.

## The polished options

This is just something I hacked together. Here are more serious model-browsing projects.

[The Networked Corpus](http://www.networkedcorpus.com/) is a beautiful way to visualize a topic model of a full-text corpus. 

David Mimno's [jsLDA](https://github.com/mimno/jsLDA) computes the topic model in the browser as well as visualizing it in interesting ways.

[Jonathan Goodwin](http://www.jgoodwin.net/)'s journal topic-model browsers are very elegant: see e.g. [this one, of literary theory journals](http://jgoodwin.net/theory-browser/).

[Allison Chaney's Topic Model Visualization Engine](http://code.google.com/p/tmve/) is a robust static-site generator.
