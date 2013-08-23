# A simple model browser

These files use [d3](http://d3js.org) to provide a rudimentary way to browse some of the topic model in a web browser. To set up, you will need the "weighted keys" `keys.csv` file and the `doc_topics.csv` document-topic file written out by `topics_rmallet.R`.

1. Source `prepare_data.R`. Then call:

```
prepare_data(dfr_dirs,"data",path_to_doc_topics)
```

This looks for metadata under each of the elements of `dfr_dirs` and outputs the necessary files into the folder `data`, where the browser looks for them.

2. Download a copy of [d3.v3.min.js](http://d3js.org/d3.v3.min.js) into `lib`.

3. Launch a web server in the `browser/` directory; `bin/server` uses the python 3 `http.server` module serving at `localhost:8888`.

4. Navigate to the home page.

## What it does

Currently, this provides very minimal views of topics, documents, and word types as specified in the model. There are no visualizations, just list of "top" words and documents in topics, "top" topics in documents, and "top" topics for words. These ranking calculations are done on the fly, but nothing else is, and it holds the document-topic matrix in memory.

## What it should do

Needed: more interactive adjustment of parameters.

Eventually I will add fuller visualizations, especially of topic frequencies over time. Some pre-generation in R is necessary for that.

## The polished options

This is just something I hacked together. Here are more serious model-browsing projects.

[The Networked Corpus](http://www.networkedcorpus.com/) is a beautiful way to visualize a topic model of a full-text corpus. 

[Jonathan Goodwin](http://www.jgoodwin.net/)'s journal topic-model browsers are very elegant: see e.g. [this one, of literary theory journals](http://jgoodwin.net/theory-browser/).

[Allison Chaney's Topic Model Visualization Engine](http://code.google.com/p/tmve/) is a robust static-site generator.
