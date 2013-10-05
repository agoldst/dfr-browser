
# use this variable to include plots in zip archive
# included_plots := $(wildcard topic_plot/*)
included_plots := 

data_files := $(addprefix data/,info.json tw.json meta.csv dt.json doc_len.json)

no_zip = F

model_test_small.html: insert_model.py
	python insert_model.py \
	    --info test_small/info.json \
	    --tw test_small/tw.json \
	    --meta test_small/meta.csv \
	    --dt test_small/dt.json \
	    index.html > $@

model_test_big.html: insert_model.py
	python insert_model.py \
	    --info test_big/info.json \
	    --tw test_big/tw.json \
	    --meta test_big/meta.csv \
	    --dt test_big/dt.json \
	    index.html > $@

model.html: insert_model.py
	python insert_model.py \
	    --info data/info.json \
	    --tw data/tw.json \
	    --meta data/meta.csv \
	    --dt data/dt.json \
	    index.html > $@

# TODO new files
model.zip: model.html
	zip $@ model.js index.js model.html css/* lib/* $(included_plots)

# TODO new files
live.zip: index.html
	zip $@ model.js index.js index.html css/* lib/* \
	    $(data_files) \
	    $(included_plots)

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

.PHONY: lint prepare_small prepare_big
