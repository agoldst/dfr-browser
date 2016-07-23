<!DOCTYPE html>
<html lang="en">

<head>
  <meta charset="utf-8">
  <title>Topic Model Browser</title>
  <script type="text/javascript" src="lib/d3.min.js"></script>

  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="css/bootstrap.min.css" media="screen">

  <link rel="stylesheet" href="css/index.css" type="text/css"> 
</head>

<body>
<div class="navbar navbar-inverse navbar-default">
  <div class="container">
    <div class="navbar-header">
      <button type="button" class="navbar-toggle" data-toggle="collapse" data-target=".navbar-collapse">
        <span class="icon-bar"></span>
        <span class="icon-bar"></span>
        <span class="icon-bar"></span>
      </button>
      <a class="navbar-brand model_title" href="#"></a>
    </div>
    <div id="nav_toplevel" class="collapse navbar-collapse">
      <ul id="nav_main" class="nav navbar-nav">
        <li id="nav_model"><a href="#/model">Overview</a></li>
        <li id="nav_topic" class="dropdown">
          <a href="#/topic" class="dropdown-toggle" data-toggle="dropdown" data-target="#" id="topic_dropdown_toggle">
            Topic<b class="caret"></b>
          </a>
          <ul id="topic_dropdown" class="dropdown-menu scroll-menu" role="menu" aria-labelledby="topic_dropdown_toggle">
            <li class="disabled loading_message"><a href="#/topic">Loading topics...</a></li>
          </ul>
        </li>
        <li id="nav_doc"><a href="#/doc">Document</a></li>
        <li id="nav_word"><a href="#/word">Word</a></li>
        <li id="nav_bib"><a href="#/bib">Bibliography</a></li>
        <li id="nav_words"><a href="#/words">Word index</a></li>
        <li><a><img id="working_icon" alt="Working..."
          class="img-responsive"
          src="img/loading.gif" /></a></li>
      </ul>
      <ul class="nav navbar-nav navbar-right">
        <li id="nav_data" class="hidden dropdown">
          <a class="dropdown-toggle" data-toggle="dropdown" data-target="#" id="data_dropdown_toggle">
            Data: <span id="data_name"></span><b class="caret"></b>
          </a>
          <ul id="data_dropdown" class="dropdown-menu scroll-menu" role="menu" aria-labelledby="data_dropdown_toggle">
          </ul>
        </li>
        <li id="nav_settings"><a href="#/settings">Settings</a></li>
        <li id="nav_about"><a href="#/about">About</a></li>
      </ul>
    </div><!--/.navbar-collapse -->
  </div>
</div>

<div class="modal fade" id="settings_modal" tabindex="-1"
    role="dialog" aria-labelledby="settings_title" aria-hidden="true">
  <div class="modal-dialog">
    <div class="modal-content">
      <div class="modal-header">
        <button type="button" class="close" data-dismiss="modal"><span aria-hidden="true">&times;</span><span class="sr-only">Close</span></button>
        <h4 class="modal-title" id="settings_title">Settings</h4>
      </div>
      <div class="modal-body">
        <p class="help">Use these controls to adjust how much information is displayed on some of the browser pages.</p>
        <form role="form">
          <div id="reveal_hidden">
            <input type="checkbox">
            <label>Show hidden topics</label>
          </div>
          <div id="n_words_list">
            <input type="number">
            <label>topic top words in lists</label>
          </div>
          <div id="n_words_topic">
            <input type="number">
            <label>topic top words on the topic page</label>
          </div>
          <div id="n_topic_docs">
            <input type="number">
            <label>top articles on the topic page</label>
          </div>
          <div id="conditional_streamgraph">
            <input type="checkbox">
            <label>Display stacked overview as a streamgraph</label>
          </div>
        </form>
      </div>
      <div class="modal-footer">
        <button type="button" class="btn btn-default pull-right"
            data-dismiss="modal">
          Close
        </button>
      </div>
    </div>
  </div>
</div>

<div id="main_container" class="container">

  <div id="error" class="alert alert-danger alert-dismissable hidden">
    <button type="button" class="close" data-dismiss="alert" aria-hidden="true">&times;</button>
  </div>

  <div id="warning" class="alert alert-warning alert-dismissable hidden">
    <button type="button" class="close" data-dismiss="alert" aria-hidden="true">&times;</button>
  </div>

  <div id="model_view" class="hidden">
    <nav class="nav navbar-default hidden" role="navigation">
      <div class="collapse navbar-collapse navbar-ex1-collapse">
        <ul id="nav_model" class="nav navbar-nav nav-pills">
          <li id="nav_model_grid" class="active">
            <a href="#/model/grid">Grid</a>
          </li>
          <li id="nav_model_scaled">
            <a href="#/model/scaled">Scaled</a>
          </li>
          <li id="nav_model_list">
            <a href="#/model/list">List</a>
          </li>
          <li id="nav_model_conditional">
            <a href="#/model/conditional">Stacked</a>
          </li>
        </ul>
        <div class="navbar-right">
          <p class="navbar-text help model_view_grid hidden">
            click a circle for more about a topic
          </p>
          <p id="model_view_help"
          class="navbar-text help model_view_scaled model_view_conditional hidden">
          scroll to zoom; shift-drag to pan; click for more about a topic</p>
          <p id="list_view_help"
          class="navbar-text help model_view_list hidden">
          click a column label to sort; click a row for more about a topic</p>
          <p id="conditional_view_help" class="navbar-text help model_view_conditional hidden"> y-axis: </p>
          <ul id="conditional_choice"
            class="nav navbar-nav nav-pills model_view_conditional hidden">
            <li id="nav_model_conditional_frac" class="active">
              <a href="#/model/conditional/frac">
                <span class="not-proper hidden">%</span>
                <span class="proper hidden">conditional</span>
              </a>
            </li>
            <li id="nav_model_conditional_raw">
              <a href="#/model/conditional/raw">
                <span class="not-proper hidden">word counts</span>
                <span class="proper hidden">joint</span>
              </a>
            </li>
          </ul>
          <button id="reset_zoom" type="button"
            class="btn btn-default navbar-btn
              model_view_scaled model_view_conditional hidden">
            Reset zoom
          </button>
        </div>
      </div>
    </nav>
    <div id="model_view_list" class="hidden">
      <table class="table table-condensed">
        <thead>
          <tr>
            <th id="model_view_list_topic" class="sort">
              <a href="#/model/list/topic" title="click to sort">
                topic
              </a><span class="glyphicon glyphicon-sort"></span>
            </th>
            <th id="model_view_list_condition" class="sort">
              <a href="#/model/list/condition"
                  title="click to sort by location of peak">
                variation
              </a><span class="glyphicon glyphicon-sort"></span>
            </th>
            <th id="model_view_list_words" class="sort">
              <a href="#/model/list/words" title="click to sort">
                top words
              </a><span class="glyphicon glyphicon-sort"></span>
            </th>
            <th colspan="2" id="model_view_list_frac" class="sort text-right">
              <a href="#/model/list/frac" title="click to sort">
                <span class="not-proper hidden">proportion of corpus</span>
                <span class="proper hidden">average probability</span>
              </a><span class="glyphicon glyphicon-sort"></span>
            </th>
          </tr>
        </thead>
        <tbody class="calc-done">
        </tbody>
      </table>
    </div>
    <div id="model_view_plot" class="hidden">
    </div>
    <div id="model_view_conditional" class="hidden">
    </div>
  </div>

  <div id="about_view" class="hidden">
    <div id="meta_info"></div>
    <div id="about_browser">
      <p>Model-browser interface by <a class="external" href="http://andrewgoldstone.com">Andrew Goldstone</a>; source available on <a class="external" href="http://agoldst.github.io/dfr-browser/">github</a>. Made using <a class="external" href="http://d3js.org">d3.js</a> and <a class="external" href="http://getbootstrap.com/">Bootstrap</a>. Zip support using <a class="external" href="http://stuk.github.io/jszip/">JSZip</a>.</p>
    </div>
  </div>

  <div id="topic_view" class="hidden">
    <div id="topic_view_help" class="hidden">
      <p class="help">Select a topic from the "Topic" menu above.</p>
    </div>
    <div id="topic_view_main">
      <div class="row">
        <div id="topic_view_header" class="col-md-8">
          <h2 id="topic_header"></h2>
          <h3 id="topic_subheader" class="hidden">
            <span class="topic_subtitle"></span>
          </h3>
        </div>
        <div id="topic_view_annotation" class="col-md-4">
          <!-- insert class="view_topic_nn" specific notes here -->
        </div>
      </div>
      <div class="row">
        <div id="topic_words" class="col-md-3">
          <h3 class="h-small">Top words</h3>
          <table class="table table-condensed" id="topic_words">
            <thead>
              <tr>
                <th>Word</th>
                <th class="th-right">Weight</th>
              </tr>
            </thead>
            <tbody>
            </tbody>
          </table>
        </div>
        <div class="col-md-9">
          <div id="topic_conditional">
            <h3 class="h-small">Conditional probability
              <span class="not-proper hidden">of words in topic</span>
              <span class="proper hidden">of topic</span>
            </h3>
            <p class="pull-left help">
              Click a bar to limit to the documents it represents
            </p>
            <div class="pull-right">
              <button class="btn btn-default disabled" type="button"
                id="topic_condition_clear">clear selected</button>
            </div>
            <div id="topic_plot">
            </div>
          </div>
          <div id="topic_docs">
            <h3 id="topic_docs_header" class="h-small">Top documents<span class="topic_condition"></span></h3>
            <p class="help none">There are no documents containing this topic<span class="topic_condition"></span>.</p>
            <table class="table table-condensed hidden calc-done">
              <thead>
                <tr>
                  <th id="topic_docs_doc">Document</th>
                  <th id="topic_docs_weight"></th>
                  <th id="topic_docs_frac" class="th-right">%</th>
                  <th id="topic_docs_tokens"
                    class="th-right not-proper hidden">Tokens</th>
                </tr>
              </thead>
              <tbody>
              </tbody>
            </table>
          </div> <!-- #topic_docs -->
        </div>
      </div>
    </div> <!-- #topic_view_main -->
  </div>

  <div id="doc_view" class="hidden">
    <div id="doc_view_help">
      <p class="help">Choose a specific document to view from 
      <a class="external" href="#/bib">the bibliography</a> or from
        <a class="external" href="#/topic">a topic page</a>.</p>
      <p class="help hidden" id="last_doc_help">Below: the last-viewed document. Stable link to this view: <a class="external" id="last_doc" href="#/doc"></a></p>
    </div>
    <div id="doc_view_main" class="calc-done">
      <h2 class="h-small" id="doc_header"></h2>
      <p id="doc_remark">
      <span class="not-proper hidden">
        <span class="token_count">...</span>
        tokens.
      </span>
        (<a class="url external">view original document</a>)
      </p>
      <table class="table table-condensed" id="doc_topics">
        <thead>
          <tr>
            <th id="doc_view_topic">Topic</th>
            <th id="doc_view_words">Top words</th>
            <th id="doc_view_weight"></th>
            <th id="doc_view_frac" class="th-right">%</th>
            <th id="doc_view_tokens" class="th-right not-proper hidden">Tokens</th>
          </tr>
        </thead>
        <tbody>
        </tbody>
      </table>
    </div><!-- #doc_view_main -->
  </div>

  <div id="word_view" class="hidden">
    <div class="row">
      <div class="col-md-8">
        <div id="word_view_help">
          <p class="help">Choose a specific word to view from 
          <a class="external" href="#/words">the list of all words</a> or from
            <a class="external" href="#/topic">a topic page</a>.</p>
          <p class="help hidden" id="last_word_help">Below: the last-viewed word. Stable link to this view: <a class="external" id="last_word" href="#/word"></a></p>
        </div>
      </div>
      <div class="col-md-4">
        <form id="word_view_form" class="form-inline pull-right" role="form">
          <div class="form-group">
            <label class="sr-only" for="word_input">Choose a word:</label>
            <input type="text" class="form-control" id="word_input" placeholder="Enter a word">
          </div>
          <button type="submit" class="btn btn-default">List topics</button>
        </form>
      </div>
    </div>
    <div id="word_view_main" class="row">
      <div class="col-md-12">
        <h2 id="word_header">Prominent topics for <span class="word"></span></h2>
        <div id="word_view_explainer">
          <p class="help">Click row labels to go to the corresponding topic page; click a word to show the topic list for that word.</p>
        </div>
        <div class="alert alert-info none hidden">
          <p>There are no topics in which this word is prominent.</p>
        </div>
      </div>
    </div>
  </div>

  <div id="bib_view" class="hidden">
    <nav id="bib_nav" class="nav navbar-default" role="navigation">
      <div class="container">
        <div class="collapse navbar-collapse navbar-ex1-collapse">
          <p class="navbar-text">Sort:</p>
          <form id="bib_sort_form" class="navbar-form navbar-left">
            <div class="form-group">
              <select class="form-control" id="select_bib_sort">
              </select>
            </div>
            <div class="form-group">
              <select class="form-control" id="select_bib_dir">
                <option id="sort_bib_up" value="up">
                  in ascending order
                </option>
                <option id="sort_bib_down" value="down">
                  in descending order
                </option>
              </select>
            </div>
          </form>
        </div>
      </div>
    </nav>
    <div class="row">
      <div class="col-md-3">
        <div id="bib_headings" data-spy="affix">
          <p class="help">jump to:</p>
          <ul class="list-inline">
          </ul>
          <p><a class="top_link" href="#">top</a></p>
        </div>
      </div>
      <div class="col-md-9">
        <div id="bib_main"></div>
      </div>
    </div>
  </div>

  <div id="words_view" class="hidden">
    <h2>All words prominent in any topic</h2>
    <p class="help">Words not prominent in any topic are not listed</p>
    <ul id="vocab_list" class="list-unstyled"></ul>
  </div>

</div> <!-- /container -->

<script type="text/javascript" src="lib/jquery-1.11.0.min.js"></script>
<script type="text/javascript" src="lib/bootstrap.min.js"></script>
<script type="text/javascript" src="lib/jszip.min.js"></script>

<!-- __DATA__ -->

<script type="text/javascript" src="js/utils.min.js"></script>
<script type="text/javascript" src="js/dfb.min.js"></script>

<script type="text/javascript">
dfb().load();
</script>

</body>

</html>

