
# use this variable to include plots in zip archive
# included_plots := $(wildcard topic_plot/*)
included_plots := 

#out_dir := test_small
#meta_dirs := test_small

#out_dir := test_big
#meta_dirs := $(addprefix test_big/,elh_ci_all mlr1905-1970 mlr1971-2013 modphil_all nlh_all pmla_all res1925-1980 res1981-2012)

out_dir := demo
meta_dirs := demo

# transform meta_dirs into an R parameter
empty := 
space := $(empty) $(empty)
comma :=,

meta_dirs_vector := c("$(subst $(space),"$(comma)",$(meta_dirs))")

# tell prepare_data.R to zip data files or not?
no_zip = F

# the all-in-one model.html file. first, run
# make no_zip=T prepare 

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

model_js = $(filter-out dfb.js,$(wildcard js/*))
model_lib = $(filter-out $(wildcard lib/*jszip*),$(wildcard lib/*))

model.zip: model.html
	rm -f $@
	zip $@ model.html $(model_js) css/* $(model_lib) $(included_plots)

lint:
	jslint --regexp --todo --white js/*

prepare:
	R -e 'source("prepare_data.R"); prepare_data($(meta_dirs_vector),"$(out_dir)",no_zip=$(no_zip))'

# make out_dir=<directory> select
select:
	rm -f data
	ln -s $(out_dir) data

.PHONY: lint prepare select test
