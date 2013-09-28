
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

lint:
	jsl -conf jsl.conf

.PHONY: lint
