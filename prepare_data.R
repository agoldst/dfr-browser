library(plyr)
library(stringr)
library(Matrix)

# copied from github/agoldst/dfr-analysis/metadata.R

read_metadata <- function(filenames,...) {

    read_citations <- function(filename=NA,...) { 
        f <- filename
        if(is.na(filename)) { 
            cat("Select citations.CSV file from jstor dfr...\n")
            ignore <- readline("(press return to open file dialog) ")
            f <- file.choose()
            print(f)
        }

        # the nefarious trailing comma:
        cols <- scan(f,nlines=1,what=character(),sep=",",quiet=T)
        cols <- c(cols,"unused")

        subset(read.csv(f,skip=1,header=F,col.names=cols,quote="",as.is=T,...),
               select=-unused)
    }
    all_rows <- do.call(rbind,lapply(filenames,read_citations,...))
    # deduplicate
    result <- unique(all_rows)

    if(any(duplicated(result$id))) {
        warning("Some rows have the same id")
    }

    result
}

write_zip <- function(writer,file_base,file_ext=".json",no_zip=F) {
    if(no_zip) {
        f_out <- str_c(file_base,file_ext)
        writer(f_out)
    }
    else {
        f_temp <- file.path(tempdir(),str_c(basename(file_base),file_ext))
        writer(f_temp)
        f_out <- str_c(file_base,file_ext,".zip")
        if(file.exists(f_out)) {
            message("Removing existing ",f_out)
            unlink(f_out)
        }
        zip(f_out,f_temp,flags="-9Xj")
        unlink(f_temp)
    }
    message("Saved ",f_out)
}

prepare_data <- function(dfr_dirs,
                         out_dir="data",
                         doc_topics_file=file.path(out_dir,"doc_topics.csv"),
                         keys_file=file.path(out_dir,"keys.csv"),
                         no_zip=T) {
                         
    if(!file.exists(out_dir)) {
        dir.create(out_dir)
    }
    if(file.exists(keys_file)) {

        wkf <- read.csv(keys_file,as.is=T)
        tw <- ddply(wkf,.(topic),
                    summarize,
                    words=str_c(word[order(weight,decreasing=T)],
                                collapse='","'),
                    weights=str_c(sort(weight,decreasing=T),collapse=","),
                    alpha=unique(alpha))
        tw$words <- str_c('"',tw$words,'"')
        tw <- tw[order(tw$topic),]
        json <- str_c('{"alpha":[',
                            str_c(tw$alpha,collapse=","),
                            '],"tw":[')

        json <- str_c(json,
                      str_c('{"words":[',
                            tw$words,
                            '],"weights":[',
                            tw$weights,
                            ']}',
                            collapse=","),
                      ']}')

        tw_file <- file.path(out_dir,"tw.json")
        writeLines(json,tw_file)
        message("Wrote ",tw_file)
    }
    else {
        warning(keys_file," is missing.")
    }

    message("Preparing doc-topic sparse matrix file")

    dt_out <- file.path(out_dir,"dt.json")
    if(file.exists(doc_topics_file)) {
        dtframe <- read.csv(doc_topics_file,as.is=T)

        ids <- dtframe$id
        dtm <- Matrix(as.matrix(subset(dtframe,select=-id)),sparse=T)

        # could compress much more aggressively considering that weights are 
        # integers, so could be stored as binary data rather than ASCII

        json <- str_c('{"i":[',
                      str_c(dtm@i,collapse=","),
                      '],"p":[',
                      str_c(dtm@p,collapse=","),
                      '],"x":[',
                      str_c(dtm@x,collapse=","),
                      ']}')
        write_zip(function (f) { writeLines(json,f) },
                  file.path(out_dir,"dt"),".json",no_zip=no_zip)

    }
    else {
        warning(doc_topics_file," is missing.");
    }

    message("Preparing metadata file")

    metadata <- read_metadata(file.path(dfr_dirs,"citations.CSV"))

    if(length(metadata) > 0 && nrow(metadata) > 0 && exists("ids")) {
        i_md <- match(ids,metadata$id)
        metadata <- metadata[i_md,]

        # throw out unneeded columns [doi === id]
        drops <- match(c("publisher","reviewed.work","doi"),names(metadata))
        metadata <- metadata[,-drops]

        write_zip(function (f) {
            write.table(metadata,f,
                        quote=T,sep=",",
                        col.names=F,row.names=F,
                        # d3.csv.* expects RFC 4180 compliance
                        qmethod="double")},
                    file.path(out_dir,"meta"),
                    ".csv",no_zip=no_zip)
    }
    else {
        warning("Unable to read metadata.")
    }

    message("Checking for topic_scaled.csv")
    message(ifelse(file.exists(file.path(out_dir,"topic_scaled.csv")),
                   "ok",
                   "missing. Scaled topic coordinates must be precalculated."))

    message("Checking for info JSON file...")
    info_file <- file.path(out_dir,"info.json")
    if(file.exists(info_file)) {
        message(info_file," ok")
    }
    else {
        message(info_file," is missing. Create it by hand (see the README)")
    }

}

# no file-writing code executed until you invoke prepare_data()
