#!/bin/bash

tar -cvf browser.tar index.js model.html css lib topic_plot
gzip browser.tar

