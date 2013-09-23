# A simple model browser

These files use [d3](http://d3js.org) to provide a rudimentary way to browse some of a topic model in a web browser. It assumes output files in the formats saved by my topic-modeling scripts in [dfr-analysis](http://github.com/agoldst/dfr-analysis). To set up, you will need files with "weighted keys" (i.e. most frequent words in topics) and the document-topic matrix. My functions that produce these are in `dfr-analysis/topics_rmallet.R`.

The browser looks for the following files in `data/`:

- `dt.csv`: headerless matrix in CSV format, with the i,j cell giving the number of words in document i allocated to topic j. 
- `keys.csv`: CSV file, with header, with columns `topic,alpha,word,weight`.
- `meta.csv`: rows of document metadata, assumed to be in the same order as `dt.csv`, with fields identical to those in DfR `citations.CSV` files.
- `model_meta.json`: unlike the others, write this by hand. This holds information about the model, for display in the browser. You need only: 

```json
{
  "title": "Model title",
  "meta_info": "<p>About the model...<p>"
}
```

You can also override some aspects of the visualization by adding a `VIS` object here with properties whose names correspond to those of the `VIS` object in the program (in `index.js:setup_vis()`). For example, to generate plots of topics over time on the fly instead of looking for pregenerated files, try:

```json
{
  "title": "Model title",
  "meta_info": "<p>About the model...<p>",
  "VIS": {
    "prefab_plots": false
  }
}
```

## Using the browser

1. Once the files are in place in a `data/` subdirectory, launch a web server in the `dfr-browser/` directory; `bin/server` uses the python 3 `http.server` module serving at `localhost:8888`. The point of the server is simply to allow the javascript to ask for the data files from your file system (via `d3.text` and kindred functions).

3. Navigate to the home page, `http://localhost:8888`, in your favorite web browser.

## Generating the datafiles

[dfr-analysis](http://github.com/agoldst/dfr-analysis) supplies functions (in `topics_rmallet.R`) to create data frames which you can save as `keys.csv` and `doc_topics.csv`.

Create `dfr-browser/data` and copy `keys.csv` into it. Create `model_meta.json` as described above. Then, in R:

```R
source("prepare_data.R")
dfr_dirs <- ...# directories containing citations.CSV files
doc_topics <- ...# doc_topics filename
prepare_data(dfr_dirs,"data",doc_topics)
```


## What it does

Currently, this provides very minimal views of topics, documents, and word types as specified in the model. There are no visualizations, just lists of "top" words and documents in topics, "top" topics in documents, and "top" topics for words. There is also a "bibliography" view of all your documents.

The ranking calculations are done on the fly, but nothing else is, and the page holds the document-topic matrix in memory. I haven't done much to optimize it. It's serviceable if you run it locally, but I'm not sure I'd throw it up on a web server.

## What it should do

Needed: more interactive adjustment of parameters. More speed and asychronous loading jazz. And eventually I will add fuller visualizations....

## The downloadable version

If a local web server is not available, you can generate a version of this browser with the data embedded in the home page, so that it can be run completely off a user's filesystem. Follow the instructions in the comments in `insert_model.py`, then use `./make_standalone.sh`.

## The polished options

This is just something I hacked together. Here are more serious model-browsing projects.

[The Networked Corpus](http://www.networkedcorpus.com/) is a beautiful way to visualize a topic model of a full-text corpus. 

David Mimno's [jsLDA](https://github.com/mimno/jsLDA) computes the topic model in the browser as well as visualizing it in interesting ways.

[Jonathan Goodwin](http://www.jgoodwin.net/)'s journal topic-model browsers are very elegant: see e.g. [this one, of literary theory journals](http://jgoodwin.net/theory-browser/).

[Allison Chaney's Topic Model Visualization Engine](http://code.google.com/p/tmve/) is a robust static-site generator.
