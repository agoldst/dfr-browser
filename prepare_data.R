# requires metadata.R
source("~/Developer/dfr-analysis/metadata.R")

prepare_data <- function(dfr_dirs,
                         out_dir="data",
                         doc_topics="data/doc_topics.csv") {
                         
    keyfile <- file.path(out_dir,"keys.csv")
    if(file.exists(keyfile)) {
        message(keyfile," ok");
    }
    else {
        warning(keyfile," is missing.")
    }

    dt_out <- file.path(out_dir,"dt.csv")
    if(file.exists(doc_topics)) {
        dtframe <- read.csv(doc_topics,as.is=T)

        ids <- dtframe$id
        write.table(subset(dtframe,select=-id),
                    dt_out,
                    sep=",",
                    col.names=F,
                    row.names=F)

        message("Saved ",dt_out)
    }
    else {
        warning(doc_topics," is missing.");
    }

    metadata <- read_metadata(file.path(dfr_dirs,"citations.CSV"))
    cites <- cite_articles(metadata,ids=ids)

    cites <- sub('," *','," <em>',cites,fixed=T)
    cites <- sub('* ','</em> ',cites,fixed=T)

    cites_out <- file.path(out_dir,"cites.txt")
    writeLines(cites,cites_out)
    message("Saved ",cites_out)

    uris <- dfr_id_url(ids,jstor_direct=F,
                       proxy=".proxy.libraries.rutgers.edu")
    uris_out <- file.path(out_dir,"uris.txt")
    writeLines(uris,uris_out)

    message("saved ",uris_out)
}

# sample call to prepare_data():
# prepare_data(dfr_dirs="../test_data/pmla_sample/",doc_topics="~/Documents/research/20c/hls/tmhls/models/test/doc_topics.csv")

