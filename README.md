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
# create data files and copy over dfr-browser sources
export_browser_data(m, out_dir="browser", supporting_files=TRUE)
```

This will create a 40-topic model of all words in all the documents in `dfr-data`, and then create a `browser` folder holding all files necessary to browse the topic model (with `supporting_files=TRUE` all the other requisite dfr-browser HTML, JavaScript, and CSS files are copied over as well). See `help(export_browser_data)` in R for details on other parameters to `export_browser_data`.

If you have created a topic model with command-line mallet, then dfrtopics can still load and export the necessary files:

```r
library("dfrtopics")
m <- load_from_mallet_state(
    mallet_state_file="mallet_state.gz",
    instances_file="docs.mallet",
    metadata_file="dfr-data/citations.tsv")
export_browser_data(m, out_dir="browser", supporting_files=TRUE)
```

In either case, when the export is done, change to the `browser` directory, run `bin/server` in the shell, then visit `localhost://8888` in the web browser.

### Browser data file specifications

In case you wish to edit the exported files or create them another way, here are the data files expected by this browser:

- browser info (`data/info.json`): a text file giving a JSON object with `title`, `meta_info`, and optionally `VIS` and `topic_labels` members. `dfrtopics::export_browser_data` will create a stub `info.json` file for you to edit. `meta_info` is displayed as part of the "About" page. `VIS` controls many visualization parameters, and `topic_labels` gives hand labels for topics; see below.

- word weights for the *n* most probable words in each topic (`data/tw.json`): a text file giving a JSON object with `alpha`, an array of estimated values for the hyperparameter alpha for each topic, and `tw`, an array of `{ words, weights }` objects, one for each topic. `words` and `weights` are in turn arrays, in order, of the most prominent words in the topic and their weights respectively. The value of *n* is up to you.

- document metadata (`data/meta.csv.zip`): a headerless zipped CSV of document metadata, with the following columns, quoted where required by [RFC 4180](http://tools.ietf.org/html/rfc4180):

    1. DOI
    1. title
    1. author(s) (separated by `VIS.bib.author_delimiter`, by default a tab)
    1. journal title
    1. volume
    1. issue
    1. publication date ([ISO 8601](https://en.wikipedia.org/wiki/ISO_8601))
    1. page range

    Additional columns after these are loaded with the default names `X1`, `X2`, and so on, and ignored by the display. (The names can be changed with the `VIS.metadata.spec.extra_fields` array  in `info.json`.) If your documents are not journal articles, this format may not quite fit, and some modification of the metadata parsing or document-display code may be necessary. See "Adapting this project" below.

- the topic weights for each document (`data/dt.json.zip`): a zipped text file giving a JSON object specifying the document-topic matrix in [sparse compressed-column format](https://en.wikipedia.org/wiki/Sparse_matrix#Compressed_sparse_column_.28CSC_or_CCS.29) in terms of three arrays `i`, `p`, and `x`. specified as follows. The documents `d` with non-zero weights for topic `t` are given by `i[p[t]], i[p[t] + 1], ... i[p[t + 1] - 1]`, and the corresponding topic weights for those documents are given by `x[p[t]], x[p[t] + 1], ..., x[p[t + 1] - 1]`. Where possible, I suggest using unnormalized, unsmoothed topic weights (from a final Gibbs sampling state). "Words in document `d` assigned to topic `t`" is a bit more intuitive, if slightly less proper, than "posterior probability of topic `t` in `d`." Normalized (fractional) weights will also work; dfr-browser checks to see if the rows of the document-topic matrix all sum to one, and adjusts some of its display labels accordingly.

- two-dimensional coordinates for each topic (`data/topic_scaled.csv`): a headerless two-column CSV. Row *t* gives the position of topic *t* in some space. dfrtopics generates this with its `topic_scaled_2d` function (q.v.). This file is optional; if it is available, the browser can draw the "scaled" overview plot, but if not, the rest of the browser will still work.

Except for `data/info.json`, which is hard-coded, all of the filenames are configurable. They are properties of the `VIS.files` object and can be modified by adding a `files` property to `VIS` in [info.json](data/info.json). The configurable file names can be either local paths or URLs (they are passed straight on to [d3.xhr](https://github.com/d3/d3/wiki/Requests#d3_xhr)). The property names for the last four listed above are `dt`, `tw`, `meta`, and `topic_scaled`. If a given filename ends in `.zip`, the browser uses [JSZip](http://stuk.github.io/jszip/) to unzip the file. It is normally not worth compressing `tw.json` or `topic_scaled.csv`.

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

### Multiple models in a single browser

As of v0.8.1-alpha, you can use dfr-browser to explore multiple related models. Each model needs to have the five files described above. `data/info.json` serves as the overall configuration file, and should include a `models` array:

```json
"models": [
    {
        "id": "model1",
        "name": "First Model"
    },
    {
        "id": "model2",
        "name": "Second Model"
    }
]
```

By default the data files will then be retrieved from `data/model1/info.json`, `data/model1/tw.json`, etc. These locations can be modified by adding a `files` property to the model specification with members `info`, `tw`, `dt`, `meta`, `topic_scaled` specifying any non-default paths.

The order of the array gives the order of the menu of model `name`s that appears next to "Settings" in the top navigation bar. The first model in the array will be loaded first by default (this can be changed). See "Settings for multiple models" below for more on the configuration possibilities.

In addition to displaying different topic models, you might also choose to present multiple configurations of the same model, e.g., changing only the metadata variable for the conditional display ("Conditioning on metadata" below). Where model data or metadata are shared, the same file paths can be given for different models' data files. In this case dfr-browser tries not to load the duplicate data more than once. At present this functionality is subject to the following restriction: if the metadata file is shared, you cannot condition on the same variable with two different sets of parameters (e.g. conditioning on `date` by both years and decades); also, giving divergent values to the `metadata.spec` parameters (`extra_fields`, `id`,  `date_field`) will give unpredictable results. These settings must be specified identically for each dataset that shares the same metadata (it may be most convenient to do this by adding, e.g., a `VIS.metadata.spec.id` property to the top-level `info.json` file, which then propagates to each of the other models; see "Settings for multiple models" below). You can also work around these limitations by duplicating the metadata file itself.

The dfrtopics R package can export the appropriate files for this case; see the R help for `dfr_browser`. That package also has some support for "aligning" multiple models, that is, trying to guess which topic in model A is most similar to model B; see the R help for `align_topics`. The results of this process can also be used with the `dfr_browser` R function. It is often easier to compare models when similar topics are aligned, though it is important not to assume that superficially similar models are equally reliable for answering any particular question of interest.

## Tune the visualization parameters

In the model-info file `data/info.json`, you can also override some aspects of the visualization by adding a `VIS` object with properties whose names correspond to those of the `VIS` object in the program. See [VIS.js](src/VIS.js) for the fields of the `VIS` object and their default values. Specifying `VIS` properties in `info.json` changes these defaults.

Many properties are nested. There are parameter settings for most of the model views as well as for metadata categories and bibliographic display. For example, to change the font size and number of words shown in the little circles representing topics in the Grid and Scaled overviews, modify some fields of `VIS.model_view.plot`:

```json
"VIS": {
    "model_view": {
        "plot": {
            "words": 5,
            "size_range": [6, 14]
        }
    }
}
```

Five words will be shown in each circle, at font sizes between 6 and 14 points. The default values of other `model_view.plot` parameters, like `aspect`, will be conserved. (The layout of the Grid view can be changed by specifying `rows` and `indents` arrays in `model_view.plot`.)

### Conditioning on metadata

So far dfr-browser has always had a display of topic proportions per year. But this is just a special case of something more general, a topic distribution conditional on a metadata variable, that is, the probability of a topic within a given metadata category. In addition to topics over time, dfr-browser can display other relations of this kind. 

The `VIS.condition` parameter governs this display. It specifies what kind of variable the covariate is, and how to categorize documents into discrete categories using it. This is simplest to explain by example.

For publication date, the setting might be

```json
"condition": {
    "type": "time",
    "spec": {
      "field": "date",
      "unit": "month",
      "n": 2
    }
}
```

This indicates that the display of topics over time should use the `date` field of the document metadata (loaded by default) and should group documents into intervals of two months.

For a categorical variable, the setting might be

```json
"condition": {
    "type": "ordinal",
    "name": "journal",
    "spec": {
        "field": "journal"
    }
}
```

The topic displays will now show the total proportion of each journal's words assigned to that topic. ("Ordinal" is the d3 name for such variables, a reminder that an ordering is imposed on the category by alphabetization.) The optional `name` field gives a name to be used on axis labels. The `field` is used if it is missing, so it's superfluous in this case.

Finally, a continuous variable can be specified as follows. Let's imagine the data include a variable `pagelen` giving document page lengths. Topic distributions conditional on page length are probably uninteresting, though possibly of some diagnostic use, so this example is purely to illustrate the software mechanism:

```json
"condition": {
    "type": "continuous",
    "name": "page length",
    "spec": {
        "field": "pagelen",
        "step": 10
    }
}
```


Which says that the `pagelen` field should be divided into bins of width 10 and topic proportions should be marginalized over those bins. This is a little more complex, because the `field` named here must exist in the metadata. In order to ensure that the ninth metadata column in the `meta.csv[.zip]` file has the name `pagelen` rather than `X1`, we also need this setting:

```json
"metadata": {
    "spec": {
        "extra_fields": [ "pagelen" ]
    }
}
```

And of course the metadata column has to actually exist. Page length is not supplied in JSTOR metadata, but it is not difficult to calculate from the `pagerange` field.

It may also be necessary to adjust some of the graphical parameters specified in the `topic_view` property (see [VIS.js](src/VIS.js#102) for documentation), the corresponding parameters in `model_view.list.spark`, and related parameters in `model_view.conditional`. In particular, the width of the bars in bar charts, as well as the margin left for y-axis labels (`topic_view.m.left`), often requires manual tuning. Tuning parameters are keyed to variable types, so that, for example, the topic bar chart for a time covariate has settings in `VIS.topic_view.time` whereas the settings for a categorical covariate are `VIS.topic_view.ordinal`.

(What is displayed is only a naive estimate of the conditional probabilities, formed by marginalizing the topic distribution over levels or bins of the metadata covariate. Or, if you prefer, the display constitutes a visual [posterior predictive check](http://www.cs.princeton.edu/~blei/papers/MimnoBlei2011.pdf) of the topic model: ordinary LDA assumes that documents are exchangeable and hence that metadata categories ought not to matter to topic probabilities.)

### Hiding topics

If certain topics are distractingly uninterpretable, they can be hidden from the display by specifying a `hidden_topics` array as a property of `VIS`. The topics identified by numbers (indexed from 1) in this array will, by default, not be shown in any view, including aggregate views. Hidden topics can be revealed using the Settings dialog box. Hiding topics can be misleading and should be done cautiously.

### Adding topic labels

In order to aid interpreting the model, it is often useful to manually label topics. The browser looks for labels in `data/info.json`, in a `topic_labels` property of `VIS` with the following slightly eccentric form:

```json
"topic_labels": {
    "1": "label for topic 1",
    "4": "a very good topic"
}
```

One-based topic numbers *as strings* are the keys. This allows for easier editing by hand. Topics for which no label is supplied are automatically labeled by their number. In a multiple-model browser, there is no requirement that topics with corresponding IDs (either numeric or arbitrary, via `topic_ids`) have corresponding labels.

Note that in versions of dfr-browser prior to 0.8.1-alpha, `topic_labels` was a top-level property in `info.json` rather than a subproperty of `VIS`.

### Adding view annotations

If you wish to add additional HTML to specific views, simply modify [index.html](index.html). Give the annotating elements two CSS classes: `annote` and a class corresponding to the stable URL for the view, but with slashes replaced by underscores. Thus, 

```html
<p class="annote topic_5">Topic 5 is particularly fascinating.</p>
```

will only appear in the display of topic 5 (URL ending in `#/topic/5`). This mechanism is governed by the `update_annotations` function in [view](src/view.js), which is called every time the view changes.

### Settings for multiple models

For multiple models in a single browser, the configuration is spread across multiple `info.json` files. Settings that are meant for all models should go in a `VIS` property of the top-level `data/info.json` file. Additional per-model configuration should go in subsidiary `info.json` files as properties of a single top-level object. For example, `data/info.json` might specify

```json
"VIS": {
    "model_view": {
        "plot": {
            "words": 4
            "size_range": [8, 12]
          }
    }
}
```

but `data/model2/info.json` might have

```
"model_view": {
    "plot": {
        "words": 7
    }
}
```

(no `VIS`). Then the `words` setting for `model2` display will be taken from this last, the `size_range` setting from `data/info.json`, and all further settings will be the defaults specified in [VIS.js](src/VIS.js).

A few properties are only read from `data/info.json` and not the subsidiary `info.json` files, because they correspond to settings for the whole browser rather than for individual models. These are: `title`, `meta_info` (for the "about" page, which does not vary for different models), `VIS.default_view`, `VIS.aliases`, and `VIS.resize_refresh_delay`.

### Document and topic identifiers

`metadata.spec` can also include an `id` field naming a column of metadata to use as a document identifier. In this case, the URL for the document view will have the form `#/[M/]doc/id`, where `id` will be the contents of the ID field for the document rather than the default, which is the sequential document number. In a multiple-model browser with metadata `id` set, changing from `#/M1/doc/D` to `#/M2/doc/D` will then display the estimated topics for the *same* document `D` in the two models even if internally `M1` and `M2` store documents in different orders or (more likely) have non-overlapping documents.

In a single-model browser this setting will also work (to little end). Note that the default metadata loading, via `metadata.dfr().from_string`, creates a `doi` field that can be used as a document ID.

Similarly, each `info.json` file can include an array of `topic_ids`, one for each topic in the corresponding model. If this array is defined, URLs for the topic view will have the form `#/[M/]topic/id`, where `id` is an element of `topic_ids`, instead of being a sequential topic number. The aim is to make it possible to specify correspondences between topics in any number of models, as well as to specify non-correspondence. `id` can be any alphanumeric sequence (avoid using `/` and `.`), though non-sequential numbers may often do well enough.

My [dfrtopics](https://github.com/agoldst/dfrtopics) provides basic functions for aligning a set of topic models and outputting suitable data files to browse them together.

A `topic_ids` setting will also work in a single-model browser. This might be useful: suppose you share a visualization of a model, then later regenerate the model with slightly adjusted parameters, reshuffling the topic numbers. Say old topic 4 is very similar to new topic 20. Then you can give new topic 20 an id of 4 (and so on for other topics: this process can be automated using dfrtopics), ensuring that `#/topic/4` points to a visualization of the topic you want, regardless of the arbitrary ordering of topics in the new model.

## Launch the browser

The necessary files are `index.html`, the data files (looked for in `data/` by default), and the `css`, `js`, `lib`, and `fonts` folders. Put all of these files in the path of a web server and go.

To preview locally, you will need a local web server, so that the javascript can ask for the data files from your file system. A widely available option is Python's `SimpleHTTPServer` module, which I have wrapped in a one-line script, so that you can simply type:

````
cd dfr-browser
bin/server
````

## Adapting this project to other kinds of documents (or models)

The data-prep is tuned to MALLET and my [dfrtopics](agoldst/dfrtopics) package, but again altering the setup for other implementations of LDA would not be too challenging. dfrtopics has some "glue" for two other R implementations. Adapting to other kinds of latent topic models would require more changes. 

Since I first released this model-browser, numerous (more than three!) people have been interested in using it to explore MALLET's LDA models of other kinds of documents. This is more straightforward, since the specialization to JSTOR articles is limited to the expectations about the metadata format, the bibliography sort, and the way documents are cited and externally linked. For a quick-and-dirty display of documents with arbitrary metadata, the following settings can be specified in `info.json`:

```json
VIS: {
    metadata: {
        type: "base"
    },
    bib: {
        type: "base"
    },
    bib_view: {
        major: "all",
        minor: "raw"
    },
    condition: {
        ...
    }
}
```

**N.B.** in this case, `meta.csv.zip` should NOT be in the format given above but can be any zip'd RFC 4180-compatible CSV file **with column headers**. These headers give the names of metadata variables that can be used to specifiy a conditioning variable in the manner explained above. The bibliographic citing and sorting will be ugly.

To produce more polished output, some modifications to the program are necessary, though they should normally be limited to the `metadata` and `bib` objects. Let me first explain a little more about the design of the program.

### The design

The whole browser is a single webpage, whose source is [index.html](index.html). This defines components of the layout---the various "views" on the model. It also loads includes the necessary JavaScript, including the d3 library and the dfr-browser scripts.

The browser follows (scrappily) the model-view-controller paradigm. The main controller is created by `dfb()`, which has the job of loading all the data and responding to user interaction. The data is stored in a `model()`, which encapsulates the details of storing the model and of aggregating its information in various ways. The details of parsing metadata are handled by separate `metadata` and `bib` objects. The controller then passes the necessary data from the model to the various `view` objects that configure the different views of the model. These view objects do all their work by accessing parts of `index.html` using CSS selectors and transforming them with d3. (This means that the JavaScript makes many assumptions about the elements that are present in [index.html](index.html).)

As an example of a simple modification, suppose you wanted to eliminate one of the views, say the word index. You could simply delete the `<div id="words_view">` [element](index.html#L357). The view could, however, still be accessed directly by entering the URL `#/words` in the web browser. The controller's method for dispatching to this view are set up by the lines reading

```js
my.views.set("words", function (...) {
...
});
```

Remove the statement and the browser will no longer respond to `#/words`. You could now remove the file defining [view.words](src/view/words.js).
The other views are set up analogously (`my.views.set("topic", ...)`, etc.). These anonymous functions are subsequently invoked in the `refresh` method of `dfb()`. To create a new view, you would add another statement within the definition of `dfb()`:

```js
my.views.set("newview", function (...) {
});
```

URLs of the form `#/newview/x/y/z` would cause the function to be invoked with parameters `x`, `y`, and `z`. The model data is available within the function as `my.m` (`my` is a local variable to the enclosing function `dfb()` which stores the controller's private member data.) This function should extract the model data needed for the view and then call an external function to actually render it.

In any case: to run the program, initialize a `dfb()` object and call its `load()` method. This will trigger a series of requests for data files and set up the event listeners for user interaction (the main one is the `hashchange` handler). In short, the following line must be executed after all the libraries and scripts have been loaded in `index.html`:

```js
dfb().load();
```

Assumptions about the document metadata are restricted to two places: the `metadata` object and the `bib` object. A new `dfb` passes the `metadata` object the incoming data from the metadata file and then hands it off to the `model` for storage. When document metadata must be displayed or sorted, the `dfb` passes that data to the `bib` object for formatting or sorting.

There are various ways to customize these.

First, and most simply, suppose the metadata format is not quite the same as the DfR format assumed here.  Metadata parsing is governed by the `from_string` [method of metadata.dfr](src/metadata/dfr.js#L17). Modify this method to modify parsing. Suppose that in your data, the author column comes before the title column. Then the lines

```js
title: d[1].trim(),
authors: d[2].trim(),
```

should switch to

```js
title: d[2].trim(),
authors: d[1].trim(),
```

Let's imagine that the publisher is found in the ninth metadata column, and `VIS.metadata.spec.extra_fields = [ "publisher" ]`. Documents will now have a `publisher` field, but to display this information, one must also change the methods of `bib`. The printing of document citations is governed by the `citation` [method of bib.dfr](src/bib_dfr.js#L168). Imagine simply adding, before the `return` at the end of the function:

```js
s += "Published by " + doc.publisher + "."
```

Similarly, the external document links are created by the `url` [method](src/bib_dfr.js#L215), so if the URL should not lead to JSTOR, change that method.

If you specify `VIS.metadata.type: "base"` in `info.json`, the base class `metadata()` (defined in [src/metadata.js](src/metadata.js)) will be used instead of `metadata.dfb()`. This class parses the metadata file using `d3.csv.parse` (which assumes, unlike `metadata.dfb`, that it has a header naming the columns).

The functions that determine how documents are grouped for the topic proportions over time (or other conditional distribution) are the `metadata.key` properties, also defined in [metadata.js](src/metadata.js#L90).

To modify the bibliographic sorting, see [bib.js](src/bib.js) (the derived `bib.dfr` object in [bib/dfr.js](src/bib/dfr.js) only adds additional sorting options). If you want to be elaborate about it, you can also derive further objects from `bib.dfr` or `bib` or `metadata` and supply those to the constructor `dfb()` as follows:

```js
dfb({
    metadata: my_meta(),
    bib: my_bib()
}).load();
```

I haven't been as consistent as I should have been about my programming idioms, but in general I follow the "functional object" pattern described by Douglas Crockford's *Javascript: The Good Parts*. The source for [metadata.dfr](metadata/dfr.js) illustrates how to write a derived object.

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
