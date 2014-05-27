
# Set these to use make prepare or make select
out_dir := 
meta_dirs := 

# tell prepare_data.R to zip data files or not?
no_zip = F

# locations of source files
src := $(filter-out dfb_nozip.js, $(wildcard js/*.js js/view/*.js))
css := $(wildcard css/*.css)
lib := $(wildcard lib/*)

# transform meta_dirs into an R parameter
empty := 
space := $(empty) $(empty)
comma :=,

meta_dirs_vector := c("$(subst $(space),"$(comma)",$(meta_dirs))")

prepare:
	R -e 'source("prepare_data.R"); prepare_data($(meta_dirs_vector),"$(out_dir)",no_zip=$(no_zip))'

# the all-in-one model.html file. first, run
# make no_zip=T prepare 

# we won't use jszip or zipped files in the totally static page
src_nozip := $(patsubst dfb.js,dfb_nozip.js, $(src))
lib_nozip = $(filter-out lib/jszip.min.js, $(lib))

model.html: insert_model.py
	python insert_model.py \
	    --info data/info.json \
	    --tw data/tw.json \
	    --meta data/meta.csv \
	    --dt data/dt.json \
	    --doc_len data/doc_len.json \
	    --topic_scaled data/topic_scaled.csv \
	    index.html \
	    | sed 's/js\/dfb.js/js\/dfb_nozip.js/' \
	    | sed 's/<script.*jszip.*script>//' \
	    > $@


model.zip: model.html
	rm -f $@
	zip $@ model.html $(src_nozip) $(css) $(lib_nozip)

# make out_dir=<directory> select
select:
	rm -f data
	ln -s $(out_dir) data

lint:
	jslint --regexp --todo --white $(src)

.PHONY: lint prepare select test
