# A simple model browser

These files use [d3](http://d3js.org) to provide a rudimentary way to browse some of a topic model in a web browser. It assumes output files in the formats saved by my topic-modeling scripts in [dfr-analysis](http://github.com/agoldst/dfr-analysis). To set up, you will need files with "weighted keys" (i.e. most frequent words in topics) and the document-topic matrix. 

## Generating the datafiles

[dfr-analysis](http://github.com/agoldst/dfr-analysis) supplies functions (in `topics_rmallet.R`) to create data frames which you can save as `keys.csv` and `doc_topics.csv`.

`info.json` must be written by hand. You need only:

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

For the remaining files, I provide an R script to transform the model outputs into the formats needed by the javascript code.

```r
source("prepare_data.R")
dfr_dirs <- ...# directories containing citations.CSV files
doc_topics <- ...# doc topics filename
keys <- ...# weighted keys frame filename
prepare_data(dfr_dirs,"data",doc_topics,keys)
```

## Using the browser

1. Once the files are in place in a `data/` subdirectory, launch a web server in the `dfr-browser/` directory; `bin/server` uses the python 3 `http.server` module serving at `localhost:8888`. The point of the server is simply to allow the javascript to ask for the data files from your file system (via `d3.text`).

2. Navigate to the home page, `http://localhost:8888`, in your favorite web browser. You can also go directly to one of the other views of the model using URLs:

- `/#/topic/<k>` where *<k>* is the 1-based topic number
- `/#/word/<word>` where *<word>* is a topic key word
- `/#/doc/<k>` where *<k>* is the internal document id (not so handy)
- `/#/bib` for the bibliography view

### (More detail on those files)

The browser looks for the following files in `data/`:

- `dt.json`: the document-topic matrix, but in sparse compressed-column format (from R's [`CsparseMatrix` class](http://stat.ethz.ch/R-manual/R-devel/library/Matrix/html/CsparseMatrix-class.html). The object properties are three arrays : `i`, `p`, and `x`.
- `tw.json`: a JSON object with `alpha`, a vector of alpha values for each topic, and `tw`, a vector of `{ words, weights }` objects (each of those fields is a vector, in order, of the most prominent words in each topic and their weights).
- `meta.csv`: headerless CSV of document metadata, with rows in the same order as `dt.csv`, and with fields identical to those in DfR `citations.CSV` files, *excluding* the following: `doi, publisher, reviewed-work`.
- `info.json`: a JSON object with `title`, `meta_info`, and optionally `VIS` members.



# What it does

Currently, this provides very minimal views of topics, documents, and word types as specified in the model. It provides lists of "top" words and documents in topics, "top" topics in documents, and "top" topics for words, and, for each topic, a visualization of the yearly topic proportions. There is also a "bibliography" view of all your documents, ordered by year of publication.

The ranking and sorting calculations are done on the fly, but nothing else is, and the page holds the document-topic matrix in memory. I haven't done much to optimize it. It's serviceable if you run it locally, but it's not ready to go up on a web server with a big model.

## What it should do

Needed: more interactive adjustment of parameters. More speed and asychronous loading jazz. And eventually I will add fuller visualizations....

## The downloadable version

If a local web server is not available, you can generate a version of this browser with the data embedded in the home page, so that it can be run completely off the filesystem. This is done with the `insert_model.py` script. The provided `Makefile` shows the usage, so you can just do `make model.html` to embed the necessary parts of `data/` into `index.html`.

To produce an all-in-one archive for sharing, use `make model.zip`.


## The polished options

This is just something I hacked together, and it is really tuned to my own interests and my work on JSTOR's Data for Research data. Here are some more polished general-use model-browsing projects:

[LDAviz](http://glimmer.rstudio.com/cpsievert/LDAviz/), by Carson Sievert, uses the Shiny R server to support visualizations of both individual topics and the interrelations among topics.

[The Networked Corpus](http://www.networkedcorpus.com/) is a beautiful way to visualize a topic model of a full-text corpus. 

David Mimno's [jsLDA](https://github.com/mimno/jsLDA) computes the topic model in the browser as well as visualizing it in interesting ways.

[Jonathan Goodwin](http://www.jgoodwin.net/)'s journal topic-model browsers are very elegant: see e.g. [this one, of literary theory journals](http://jgoodwin.net/theory-browser/).

[Allison Chaney's Topic Model Visualization Engine](http://code.google.com/p/tmve/) is a robust static-site generator.
