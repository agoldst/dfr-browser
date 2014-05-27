# Makefile Usage
# make lint -- linting
# make uglify -- compile minified source file
# make tarball -- create dfb.tar.gz file suitable for deployment as a website
#
# DEPRECATED
# make prepare -- invoke R script to transform dfr-analysis outputs
# make out_dir=<dir> select -- attempt to symlink data to <dir>

# Name of minified output file
dfbjs := js/dfb.min.js
minified := js/utils.min.js js/worker.min.js

# Set these to use make prepare or make select
out_dir := 
meta_dirs := 

# tell prepare_data.R to zip data files or not?
no_zip = F

# locations of javascript source files
# manual dependency tracking, because node-style require is for another day
src_before := src/view/view.js
src_after := src/main.js
src_skip := src/utils.js src/worker.js
src := $(wildcard src/*.js src/view/*.js)

src := $(filter-out $(min_js) $(src_skip) $(src_before) $(src_after),$(src))
src := $(src_before) $(src) $(src_after)

css := $(wildcard css/*.css)
lib := $(wildcard lib/*)

dfb_files := index.html $(dfbjs) $(minified) \
    $(css) $(lib) fonts/

# transform meta_dirs into an R parameter
empty := 
space := $(empty) $(empty)
comma :=,

meta_dirs_vector := c("$(subst $(space),"$(comma)",$(meta_dirs))")

prepare:
	R -e 'source("prepare_data.R"); prepare_data($(meta_dirs_vector),"$(out_dir)",no_zip=$(no_zip))'

# make out_dir=<directory> select
select:
	rm -f data
	ln -s $(out_dir) data

lint:
	jslint --regexp --todo --white $(src) $(src_skip)

uglify: $(dfbjs) $(minified)

$(minified): js/%.min.js: src/%.js
	uglifyjs $< --mangle -o $@

$(dfbjs): $(src)
	uglifyjs $(src) --mangle -o $@

dfb.tar.gz: $(dfb_files)
	rm -f $@
	tar -cvzf $@ $(dfb_files) data/*

tarball: dfb.tar.gz

.DEFAULT_GOAL := uglify

.PHONY: lint prepare select test uglify tarball
