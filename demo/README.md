# A simple topic-model browser

These files use [d3](http://d3js.org) to provide a way to browse some of a topic model of JSTOR journal articles in a web browser, relying entirely on static html and javascript files. For more information, see the main project page at [agoldst.github.io/dfr-browser](http://agoldst.github.io/dfr-browser) and the [working demo](http://agoldst.github.io/dfr-browser/demo), a browser for a 64-topic model of the journal *PMLA*.

This software is free to use, copy, modify, and distribute under the MIT license (which is to say, please credit me if you do use it). This project skews to my needs as a literary scholar and to my amateurishness as a programmer. No aspect of this code has been systematically tested. Sorry.

The rest of this file explains how to set up the browser to use with your own topic models.

## Generating the model

### Gather source data: the model and metadata

You will need the following source data:

1. A document-topic matrix, in CSV format, with an additional column of document id's that can be matched against JSTOR doc id's. Should also have a header row. 
2. A file of the *n* top-weighted words in each topic, in CSV format, with a header row, with rows in the following format: *topic*,*alpha*,*word*,*weight*. (Yes, redundantly repeat the topic alpha for each row for a given topic.)
3. Document metadata (in the format of the files called `citations.CSV` in DfR results).
4. *Optional*: to display the "scaled" overview of topics, you will also need a CSV file, without a header, with two columns giving x and y coordinates for the topics, in topic order. 
5. Information about the model itself, in JSON format, which you must write by hand. Here is a minimal example file:

```json
{
  "title": "Model title",
  "meta_info": "<p>About the model...<p>"
}
```

One way to generate the doc-topic, weighted keys, and scaled topic coordinates files is to use the `output_model()` model function in the [topics_rmallet.R](https://github.com/agoldst/dfr-analysis/blob/master/topics_rmallet.R) file in my [dfrtopics](http://github.com/agoldst/dfrtopics) experimental R package. That package also provides a direct `export_browser_data()` function (see `help(export_browser_data,dfrtopics)` in R.)

### Create the dfr-browser datafiles

If you do not wish to install dfrtopics, you can convert these source data files into the formats dfr-browser needs with the provided [prepare_data.R](https://github.com/agoldst/dfr-browser/blob/master/prepare_data.R) script. You can invoke the script within R as follows:

```r
source("prepare_data.R")
dfr_dirs <- c("journal1data","journal2data") # directories containing citations.CSV files
doc_topics <- "my_model/doc_topics.csv" # doc topics filename
keys <- "my_model/keys.csv" # weighted keys frame filename
prepare_data(dfr_dirs,"data",doc_topics,keys)
```

This will generate the remaining needed files in their default locations, under the directory `data`. Note in particular that it looks for a `citations.CSV` file in each of the `dfr_dirs` and produces a single merged metadata file for the browser (`meta.csv.zip`; see "More detail" immediately below). This is for cases in which you have downloaded your DfR data in several chunks.

Alternatively, you can invoke the R script through the provided [Makefile](https://github.com/agoldst/dfr-browser/blob/master/Makefile) using `make prepare`. Adjust the file paths passed to the script using the Makefile variables `out_dir` and `meta_dirs`. 

#### More detail on the expected files and their formats

The browser asks for data files using the names stored in the properties of the `dfb.files` object. Modify [dfb.js](https://github.com/agoldst/dfr-browser/blob/master/js/dfb.js) if you wish to target filenames other than the default. If a given filename ends in `.zip`, the browser uses [JSZip](http://stuk.github.io/jszip/) to unzip the file. 

- `dfb.files.info`: (*default*: `data/info.json`): a JSON object with `title`, `meta_info`, and optionally `VIS` members. `meta_info` is used to fill in the "About" page.
- `dfb.files.dt` (*default*: `data/dt.json.zip`): the document-topic matrix, but in sparse compressed-column format (from R's [`CsparseMatrix` class](http://stat.ethz.ch/R-manual/R-devel/library/Matrix/html/CsparseMatrix-class.html). The object properties are three arrays : `i`, `p`, and `x`.
- `dfb.files.tw` (*default*: `data/tw.json`): a JSON object with `alpha`, a vector of alpha values for each topic, and `tw`, a vector of `{ words, weights }` objects (each of those fields is a vector, in order, of the most prominent words in each topic and their weights).
- `dfb.files.meta` (*default*: `meta.csv.zip`): headerless CSV of document metadata, with rows in the same order as the document-topic matrix, and with fields identical to those in DfR `citations.CSV` files, *excluding* the following: `doi, publisher, reviewed-work`.
- `dfb.files.topic_scaled` (*default*: `data/topic_scaled.csv`): x and y coordinates for the topics in some space. This is optional; if it is available, the browser can draw the "scaled" overview plot.

#### Sample datafiles

The data files used in the [demo](http://agoldst.github.io/dfr-browser/demo) (*PMLA*, 64 topics) reside in a directory on the [gh-pages branch of this repository](https://github.com/agoldst/dfr-browser/tree/gh-pages/demo/data). They are generated, via the process explained above, from the [demonstration model for my dfr-analysis scripts](https://github.com/agoldst/dfr-analysis/tree/master/demo). 

### Tune the visualization parameters

In the model-info file (`data/info.json` by default), you can also override some aspects of the visualization by adding a `VIS` object with properties whose names correspond to those of the `VIS` object in the program. See [the start of index.js](https://github.com/agoldst/dfr-browser/blob/master/js/index.js) for the fields of the `VIS` object and their default values. Some properties are nested. Some possibilities of note:

`VIS.overview_words`: how many words to use as the "titles" for topics in the List view, and the topics menu

`VIS.model_view`: a collection of properties. Specify the overview's number of words in the Little Circles and type-size range in points:

```json
"model_view": {
  "words": 6,
  "size_range": [8, 10]
}
```

`model_view` also has an `aspect` property which will, in this case, be left at its default value (4/3).

### Launch the browser

The necessary files are `index.html`, the data files (looked for in `data/` by default), and the `css`, `js`, `lib`, and `fonts` folders. Put all of these files in the path of a web server and go.

To preview locally, you will need a local web server, so that the javascript can ask for the data files from your file system. I use the python3 `http.server` module, which I have wrapped in a one-line script, so that you can simply type:

````
cd dfr-browser
bin/server
````

This makes the browser available at `http://localhost:8888`. If you don't have python 3, you could use python 2:

````
python -m SimpleHTTPServer 8888
````

## A downloadable version

If a local web server is not available, you can generate a version of this browser with the data embedded in the home page, so that it can be run completely off the filesystem. This is done with the `insert_model.py` script. The provided [Makefile](https://github.com/agoldst/dfr-browser/blob/master/Makefile) shows the usage, so you can just do `make model.html` to embed the necessary parts of `data/` into `index.html`. This uses non-zipped individual data files, which you can generate using `prepare_data(...,no_zip=T)`. (To wrap up zipped data would require using data URLs, which I didn't bother to set up.)

To produce an all-in-one archive that could be downloaded by others and run on *their* systems without web servers, use `make model.zip`.

Note that these standalone files may not work if you have altered the default filenames in [js/dfb_nozip.js](https://github.com/agoldst/dfr-browser/blob/master/js/dfb_nozip.js).

## Adapting to other kinds of documents

The specialization to JSTOR articles is limited to the bibliography sort, the external document links, and the expectations about the metadata format.  Adapting this code to other kinds of documents would require altering only these aspects of the browser. Most of this behavior is fairly-well encapsulated in the corresponding view functions and in the model object.

The data-prep is tuned to MALLET and my MALLET scripts, but again altering the setup for other modeling tools or other kinds of latent topic models should not be arduous.

## Performance

The ranking and sorting calculations are done on the fly, but nothing else is, and the page holds all the data in memory. I haven't done much to optimize it. It's serviceable but not as fast as it could be. Other optimizations would be possible, for example using ArrayBuffers for the big matrices rather than ordinary arrays.

For serving from a web server, a big model means a lot of data has to be sent to the client; keeping the doc-topic matrix sparse saves some room, as does zipping up the datafiles, but there are limits to this. Past a certain limit, it would be necessary to hold the model in a proper database. I haven't implemented this, but because access to the model is abstracted by the methods of the model object (see [js/model.js](https://github.com/agoldst/dfr-browser/blob/master/js/model.js)), adding it should not be difficult. 

## Libraries

This browser uses the code of the following open-source projects by others, under the `fonts`, `css`, and `lib` directories: [d3](http://d3js.org) by Mike Bostock; [bootstrap](http://getbootstrap.com/) by Twitter, Inc.; [JQuery](http://jquery.com) by the JQuery Foundation; and [JSZip](http://stuk.github.io/jszip/) by Stuart Knightley.

