
# use this variable to include plots in zip archive
# included_plots := $(wildcard topic_plot/*)
included_plots := 

test_small.html: insert_model.py
	python insert_model.py \
	    --info test_small/info.json \
	    --tw test_small/tw.json \
	    --meta test_small/meta.csv \
	    --dt test_small/dt.json \
	    index.html > $@

test_big.html: insert_model.py
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

model.zip: model.html
	zip $@ index.js model.html css/* lib/* $(included_plots)

lint:
	jsl -conf jsl.conf

.PHONY: lint
