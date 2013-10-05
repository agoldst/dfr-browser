
# use this variable to include plots in zip archive
# included_plots := $(wildcard topic_plot/*)
included_plots := 

data_dir := data
data_files := $(addprefix $(data_dir)/,info.json tw.json meta.csv dt.json doc_len.json)

no_zip = F

model.html: insert_model.py
	python insert_model.py \
	    --info $(data_dir)/info.json \
	    --tw $(data_dir)/tw.json \
	    --meta $(data_dir)/meta.csv \
	    --dt $(data_dir)/dt.json \
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
	jsl -conf jsl.conf

prepare_small:
	R -e 'source("prepare_data.R"); prepare_data("test_small","test_small",no_zip=$(no_zip))'

prepare_big:
	R -e 'source("prepare_data.R"); prepare_data(Sys.glob("test_big/*/"),"test_big",no_zip=$(no_zip))'

select_small:
	rm -f data
	ln -s test_small data

select_big:
	rm -f data
	ln -s test_big data

.PHONY: lint prepare_small prepare_big select_small select_big
