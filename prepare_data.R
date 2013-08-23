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

    if(nrow(metadata) > 0) {
        i_md <- match(ids,metadata$id)
        metadata <- metadata[i_md,]

        meta_out <- file.path(out_dir,"meta.csv")
        write.csv(metadata,meta_out,row.names=F,quote=F)
        message("Saved ",meta_out)
    }
    else {
        warning("Unable to read metadata.")
    }
}

# no file-writing code executed until you invoke prepare_data()
