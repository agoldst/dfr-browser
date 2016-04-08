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

- browser info (`data/info.json`): a text file giving a JSON object with `title`, `meta_info`, and optionally `VIS` and `topic_labels` members. `dfrtopics::export_browser_data` will create a stub `info.json` file for you to edit. `meta_info` is displayed as part of the "About" page. `VIS` controls many visualization parameters, and `topic_labels` gives hand labels for topics; see below.

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

In the model-info file `data/info.json`, you can also override some aspects of the visualization by adding a `VIS` object with properties whose names correspond to those of the `VIS` object in the program. See [VIS.js](src/VIS.js) for the fields of the `VIS` object and their default values. Many properties are nested. Some possibilities of note:

`VIS.overview_words`: how many words to use as the "titles" for topics in the List view, and the topics menu.

`VIS.model_view`: a collection of properties. Specify the overview's number of words in the Little Circles and type-size range in points:

```json
"model_view": {
  "words": 6,
  "size_range": [8, 10]
}
```

`model_view` also has an `aspect` property which will, in this case, be left at its default value (4/3).

If certain topics are distractingly uninterpretable, they can be hidden from the display by specifying a `hidden_topics` array as a property of `VIS`. The topics identified by numbers (indexed from 1) in this array will, by default, not be shown in any view, including aggregate views. Hidden topics can be revealed using the Settings dialog box. Hiding topics can be misleading and should be done cautiously.

### Adding topic labels

In order to aid interpreting the model, it is often useful to manually label topics. The browser looks for labels in `data/info.json`, in a top-level `topic_labels` property (not a property of `VIS`) with the following slightly eccentric form:

```json
"topic_labels": {
    "1": "label for topic 1",
    "4": "a very good topic"
}
```

One-based topic numbers *as strings* are the keys. This allows for easier editing by hand. Topics for which no label is supplied are automatically labeled by their number.

## Launch the browser

The necessary files are `index.html`, the data files (looked for in `data/` by default), and the `css`, `js`, `lib`, and `fonts` folders. Put all of these files in the path of a web server and go.

To preview locally, you will need a local web server, so that the javascript can ask for the data files from your file system. A widely available option is Python's `SimpleHTTPServer` module, which I have wrapped in a one-line script, so that you can simply type:

````
cd dfr-browser
bin/server
````

## Adapting this project to other kinds of documents (or models)

The data-prep is tuned to MALLET and my [dfrtopics](agoldst/dfrtopics) package, but again altering the setup for other implementations of LDA would not be too challenging. Adapting to other kinds of latent topic models would require more changes.

Modifying the display to allow users to emphasize metadata other than publication dates is a larger project that I may undertake eventually.

Since I first released this model-browser, numerous (more than three!) people have been interested in using it to explore LDA models of other kinds of documents. This is more straightforward, since the specialization to JSTOR articles is limited to the expectations about the metadata format, the bibliography sort, and the way documents are cited and externally linked. Though some modifications to the program are necessary in such cases, they should normally be limited to the `metadata` and `bib` objects. Let me first 
explain a little more about the design of the program.

### The design

The whole browser is a single webpage, whose source is [index.html](index.html). This defines components of the layout---the various "views" on the model. It also loads includes the necessary JavaScript, including the d3 library and the dfr-browser scripts.

The browser follows (scrappily) the model-view-controller paradigm. The main controller is created by `dfb()`, which has the job of loading all the data and responding to user interaction. The data is stored in a `model()`, which encapsulates the details of storing the model and of aggregating its information in various ways. The details of parsing metadata are handled by separate `metadata` and `bib` objects. The controller then passes the necessary data from the model to the various `view` objects that configure the different views of the model. These view objects do all their work by accessing parts of `index.html` using CSS selectors and transforming them with d3. (This means that the JavaScript makes many assumptions about the elements that are present in [index.html](index.html).)

As an example of a simple modification, suppose you wanted to eliminate one of the views, say the word index. You could simply delete the `<div id="words_view">` [element](index.html#L357). The view could, however, still be accessed directly by entering the URL `#/words` in the web browser. The main dispatch to views is the `refresh` method of `dfb()`. The lines

```js
case "words":
    success = words_view.apply(undefined, param);
    break;
```

are the whole story of this dispatch. Delete them and the browser will no longer respond to `#/words`. You could now remove the file defining [view.words](src/view/words.js).

In any case: to run the program, initialize a `dfb()` object and call its `load()` method. This will trigger a series of requests for data files and set up the event listeners for user interaction (the main one is the `hashchange` handler). In short, the following lines must be executed after all the libraries and scripts have been loaded in `index.html`:

```js
dfb({
    metadata: metadata.dfr,
    bib: bib.dfr
})
    .load();
```

The parameters in `{ ... }` are optional, since the values here are the defaults, but this design is meant to facilitate modifying the browser by giving you a hint about what to change.

Assumptions about the document metadata are restricted to two places: the `metadata` object and the `bib` object. A new `dfb` constructs the `metadata` (passing it the incoming data from the metadata file) and then hands it off to the `model` for storage. When document metadata must be displayed or sorted, the `dfb` passes that data to `bib` for formatting or sorting.

First, and most simply, suppose the metadata format is not quite the same as the DfR format assumed here. Metadata parsing is governed by the `from_string` [method of metadata.dfr](src/metadata.js#L63). Modify this method to modify parsing. Suppose that in your data, the author column comes before the title column. Then the lines

```js
title: d[1].trim(),
authors: d[2].trim(),
```

should switch to

```js
title: d[2].trim(),
authors: d[1].trim(),
```

Or, of course, you may wish to store additional metadata and use it elsewhere. Let's imagine that the publisher is found in the ninth column. Then one might simply have

```js
issue: d[5].trim(),
publisher: d[8].trim(),
```

Now the publisher will be stored for each dcoument, but to display it, one must also change the methods of `bib`. The printing of document citations is governed by the `citation` [method of bib.dfr](src/bib_dfr.js#L168). Imagine simply adding, before the `return` at the end of the function:

```js
s += "Published by " + doc.publisher + "."
```

Similarly, the external document links are created by the `url` [method](src/bib_dfr.js#L215).

Comments in these source files should indicate where other modifications could be made. Note that the main logic of bibliographic sorting is implemented in [bib.js](src/bib.js), with the derived object in [bib_dfr.js](src/bib_dfr.js) only adding additional sorting options. If you want to be elaborate about it, you can derive further objects from `bib.dfr` or `bib`. I haven't been as consistent as I should have been about my programming idioms, but in general I follow the "functional object" pattern described by Douglas Crockford's *Javascript: The Good Parts*.


### The "build" process

If you are modifying the code, note that the `js/*.js` files for the server are minified versions. The source code is found in the [src](src) directory. To make the minified scripts, run `make uglify`. This requires [uglifyjs](https://github.com/mishoo/UglifyJS2/). On a Mac, install [homebrew](http://brew.sh), then:

```sh
brew install npm
npm install uglify-js -g
```

## Performance

The ranking and sorting calculations are done on the fly, but nothing else is, and the page holds all the data in memory. I haven't done much to optimize it. It's serviceable but not as fast as it could be. The most demanding calculations are done in a separate thread using an HTML5 [Web Worker](http://dev.w3.org/html5/workers/). Other optimizations would be possible, for example using ArrayBuffers for the big matrices rather than ordinary arrays.

For serving from a web server, a big model means a lot of data has to be sent to the client; keeping the doc-topic matrix sparse saves some room, as does zipping up the datafiles, but there are limits to this. Past a certain limit, it would be necessary to hold the model on the server, presumably in a real database. I haven't implemented this, but because access to the model is abstracted by the methods of the model object (see [src/model.js](src/model.js)), doing so would not be intractable.

## Libraries

This browser uses the code of the following open-source projects by others, under the `fonts`, `css`, and `lib` directories: [d3](http://d3js.org) by Mike Bostock; [bootstrap](http://getbootstrap.com/) by Twitter, Inc.; [JQuery](http://jquery.com) by the JQuery Foundation; and [JSZip](http://stuk.github.io/jszip/) by Stuart Knightley.

This browser also makes use of code from Andrew Goldstone, Susana Galán, C. Laura Lovin, Andrew Mazzaschi, and Lindsey Whitmore, "An Interactive Topic Model of Signs," in [Signs at 40](http://signsat40.signsjournal.org/topic-model) (source at <http://github.com/signs40th/topic-model>).
