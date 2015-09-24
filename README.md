# A simple topic-model browser

These files use [d3](http://d3js.org) to provide a way to browse some of a topic model of texts in a web browser, relying entirely on static html and javascript files. It is specialized for models of texts from JSTOR's [Data for Research](http://dfr.jstor.org) service, though it can be (and has been) adapted for models of other corpora. For more information, see the main project page at [agoldst.github.io/dfr-browser](http://agoldst.github.io/dfr-browser) and the [working demo](http://agoldst.github.io/dfr-browser/demo), a browser for a 64-topic model of the journal *PMLA*.

This software is free to use, copy, modify, and distribute under the MIT license (which is to say, please credit me if you do use it). This project skews to my needs as a literary scholar and to my amateurishness as a programmer. No aspect of this code has been systematically tested. Sorry.

The rest of this file explains how to set up the browser to use with your own topic models.

## Generate the model

### Creating and saving topic models from R using MALLET

The browser looks for the model data in a series of files. The most convenient way to generate these is via my companion R package, [dfrtopics](http://github.com/agoldst/dfrtopics), which supplies an `export_browser_data` function. You can use the package to create topic models and then export them directly---for details, see the [introduction to dfrtopics](http://agoldst.github.io/dfrtopics/introduction.html). The dfrtopics package provides many functions for adjusting the model inputs and parameters, but, very briefly, here is how one might go from a DfR download unzipped in the folder `dfr-data` to a topic model browser:

```r
library("dfrtopics")
m <- model_dfr_documents(
    citations_files="dfr-data/citations.tsv",
    wordcounts_dirs="dfr-data/wordcounts",
    n_topics=40
)
# optional but recommended: save model outputs
write_mallet_model(m, output_dir="model")
# save data files and download dfr-browser source
export_browser_data(m, out_dir="browser", download_dfb=TRUE)
```

This will create a 40-topic model of all words in all the documents in `dfr-data`, and then create a `browser` folder holding all files necessary to browse the topic model (with `download_dfb=TRUE` a copy of the dfr-browser source is downloaded as well). 

If you have created a topic model with command-line mallet, then dfrtopics can still load and export the necessary files:

```r
library("dfrtopics")
m <- load_from_mallet_state(
    mallet_state_file="mallet_state.gz",
    instances_file="docs.mallet",
    metadata_file="dfr-data/citations.tsv")
export_browser_data(m, out_dir="browser", download_dfb=TRUE)
```

In either case, when the export is done, change to the `browser` directory, run `bin/server` in the shell, then visit `localhost://8888` in the web browser. 

### Browser data file specifications

In case you wish to edit the exported files or create them another way, here are the data files expected by this browser:

- browser info (`data/info.json`): a text file giving a JSON object with `title`, `meta_info`, and optionally `VIS` members. (The last is used to change various settings of the visualization.) `dfrtopics::export_browser_data` will create a stub `info.json` file for you to edit.

- word weights for the *n* most probable words in each topic (`data/tw.json`): a text file giving a JSON object with `alpha`, an array of estimated values for the hyperparameter alpha for each topic, and `tw`, an array of `{ words, weights }` objects, one for each topic. `words` and `weights` are in turn arrays, in order, of the most prominent words in the topic and their weights respectively. The value of *n* is up to you.

- document metadata (`data/meta.csv.zip`): a headerless zipped CSV of document metadata, with the following columns, quoted where required by [RFC 4180](http://tools.ietf.org/html/rfc4180): DOI, title, author(s), journal title, journal issue, publication date ([ISO 8601](https://en.wikipedia.org/wiki/ISO_8601)), page range. Additional columns after these are ignored.

- the topic weights for each document (`data/dt.json.zip`): a zipped text file giving a JSON object specifying the document-topic matrix in [sparse compressed-column format](https://en.wikipedia.org/wiki/Sparse_matrix#Compressed_sparse_column_.28CSC_or_CCS.29) in terms of three arrays `i`, `p`, and `x`. specified as follows. The documents `d` with non-zero weights for topic `t` are given by `i[p[t]], i[p[t] + 1], ... i[p[t + 1] - 1]`, and the corresponding unnormalized topic weights for those documents are given by `x[p[t]], x[p[t] + 1], ..., x[p[t + 1] - 1]`.

- two-dimensional coordinates for each topic (`data/topic_scaled.csv`): a headerless two-column CSV. Row *t* gives the position of topic *t* in some space. dfrtopics generates this with its `topic_scaled_2d` function (q.v.). This file is optional; if it is available, the browser can draw the "scaled" overview plot, but if not, the rest of the browser will still work.

Except for `data/info.json`, which is hard-coded, all of the filenames are configurable. They are properties of the `VIS.files` object and can be modified by adding a `files` property to `VIS` in [info.json](data/info.json). The property names for the last four listed above are `dt`, `tw`, `meta`, and `topic_scaled`. If a given filename ends in `.zip`, the browser uses [JSZip](http://stuk.github.io/jszip/) to unzip the file. It is normally not worth compressing `tw.json` or `topic_scaled.csv`.

### Preparing data files entirely on the command line

If you prefer not to use dfrtopics, the supplied [prepare-data](bin/prepare-data) python script can produce the necessary files from model data in multiple formats---except for the scaled topic coordinates. The script can also check your browser data folder to verify that you have what you need: `bin/prepare-data check`. Use `bin/prepare-data` without arguments for usage information.

Here is an example:

```Bash
mallet train-topics ... \   # ...: input parameters
    --output-state mallet_state.gz --output doc-topics dt.csv
# generate tw.json and dt.json.zip
bin/prepare-data convert-state mallet_state.gz \
    --tw data/tw.json --dt data/dt.json.zip
# generate meta.csv.zip from dfr-data/citations.tsv
# dt.csv is needed only for doc id's
cut -f 2 dt.csv > ids.txt
bin/prepare-data convert-citations dfr-data/citations.tsv --ids ids.txt \
    -o data/meta.csv.zip
# generate info.json
bin/prepare-data info-stub -o data/info.json
# edit info.json by hand if needed
vi data/info.json
```

### Sample datafiles

The data files used in the [demo](http://agoldst.github.io/dfr-browser/demo) (*PMLA*, 64 topics) reside in a directory on the [gh-pages branch of this repository](https://github.com/agoldst/dfr-browser/tree/gh-pages/demo/data).

## Tune the visualization parameters

In the model-info file `data/info.json`, you can also override some aspects of the visualization by adding a `VIS` object with properties whose names correspond to those of the `VIS` object in the program. See [src/main.js](https://github.com/agoldst/dfr-browser/blob/master/src/main.js) for the fields of the `VIS` object and their default values. Many properties are nested. Some possibilities of note:

`VIS.overview_words`: how many words to use as the "titles" for topics in the List view, and the topics menu.

`VIS.model_view`: a collection of properties. Specify the overview's number of words in the Little Circles and type-size range in points:

```json
"model_view": {
  "words": 6,
  "size_range": [8, 10]
}
```

`model_view` also has an `aspect` property which will, in this case, be left at its default value (4/3).

## Launch the browser

The necessary files are `index.html`, the data files (looked for in `data/` by default), and the `css`, `js`, `lib`, and `fonts` folders. Put all of these files in the path of a web server and go.

To preview locally, you will need a local web server, so that the javascript can ask for the data files from your file system. A widely available option is Python's `SimpleHTTPServer` module, which I have wrapped in a one-line script, so that you can simply type:

````
cd dfr-browser
bin/server
````

## Adapting this project to other kinds of documents

The specialization to JSTOR articles is limited to the bibliography sort, the external document links, and the expectations about the metadata format.  Adapting this code to other kinds of documents would require altering only these aspects of the browser. Most of this behavior is fairly-well encapsulated in the view object `view` and (especially) the model object returned by `model()`.

The data-prep is tuned to MALLET and my MALLET scripts, but again altering the setup for other modeling tools or other kinds of latent topic models would be feasible.

## The "build" process

If you are modifying the code, note that the `js/*.js` files for the server are minified versions. The source code is found in the [src](src) directory. To make the minified scripts, run `make uglify`. This requires [uglifyjs](https://github.com/mishoo/UglifyJS2/). 

## Performance

The ranking and sorting calculations are done on the fly, but nothing else is, and the page holds all the data in memory. I haven't done much to optimize it. It's serviceable but not as fast as it could be. The most demanding calculations are done in a separate thread using an HTML5 [Web Worker](http://dev.w3.org/html5/workers/). Other optimizations would be possible, for example using ArrayBuffers for the big matrices rather than ordinary arrays.

For serving from a web server, a big model means a lot of data has to be sent to the client; keeping the doc-topic matrix sparse saves some room, as does zipping up the datafiles, but there are limits to this. Past a certain limit, it would be necessary to hold the model on the server, presumably in a real database. I haven't implemented this, but because access to the model is abstracted by the methods of the model object (see [src/model.js](src/model.js)), doing so would not be intractable.

## Libraries

This browser uses the code of the following open-source projects by others, under the `fonts`, `css`, and `lib` directories: [d3](http://d3js.org) by Mike Bostock; [bootstrap](http://getbootstrap.com/) by Twitter, Inc.; [JQuery](http://jquery.com) by the JQuery Foundation; and [JSZip](http://stuk.github.io/jszip/) by Stuart Knightley.

