# Makefile Usage
# make lint -- linting
# make uglify -- compile minified source file
# make tarball -- create dfb.tar.gz file suitable for deployment as a website

# Name of minified output file
dfbjs := js/dfb.min.js
minified := js/utils.min.js js/worker.min.js

# locations of javascript source files
# manual dependency tracking, because node-style require is for another day
src_before := src/view/view.js
src_after := src/dfb.js
src_skip := src/utils.js src/worker.js
src := $(wildcard src/*.js src/*/*.js)

src := $(filter-out $(min_js) $(src_skip) $(src_before) $(src_after),$(src))
src := $(src_before) $(src) $(src_after)

css := $(wildcard css/*.css)
lib := $(wildcard lib/*)

dfb_files := index.html $(dfbjs) $(minified) \
    $(css) $(lib) fonts/

lint:
	jslint --regexp --todo --white --browser --bitwise $(src) $(src_skip)

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

.PHONY: lint uglify tarball
