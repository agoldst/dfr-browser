# requires metadata.R: change path as needed
source("~/Developer/dfr-analysis/metadata.R")

prepare_data <- function(dfr_dirs,
                         out_dir="data",
                         doc_topics="data/doc_topics.csv") {
                         
    message("Checking for the presence of keys.csv")
    keyfile <- file.path(out_dir,"keys.csv")
    if(file.exists(keyfile)) {
        message(keyfile," ok");
    }
    else {
        warning(keyfile," is missing.")
    }

    message("Preparing doc-topic matrix file")

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

    message("Preparing metadata file")

    metadata <- read_metadata(file.path(dfr_dirs,"citations.CSV"))

    if(nrow(metadata) > 0) {
        i_md <- match(ids,metadata$id)
        metadata <- metadata[i_md,]

        meta_out <- file.path(out_dir,"meta.csv")
        write.table(metadata,meta_out,
                    quote=T,sep=",",
                    col.names=T,row.names=F,
                    qmethod="double")   # d3.csv expects RFC 4180 compliance
        message("Saved ",meta_out)
    }
    else {
        warning("Unable to read metadata.")
    }

    message("Checking for model-meta JSON file...")
    mmfile <- file.path(out_dir,"model_meta.json")
    if(file.exists(mmfile)) {
        message(mmfile," ok")
    }
    else {
        message(mmfile," is missing. Create it by hand (see the README)")
    }

}

# no file-writing code executed until you invoke prepare_data()
