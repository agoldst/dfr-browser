/*global d3, bib */
"use strict";

// Bibliography processing specialized for DfR.
bib.dfr = function (spec) {
    var my = spec || { },
        that = bib(my),
        doc_author;

    // Construction: override inherited sorting()
    that.sorting([
        ["year_authortitle", "by year, then by author"],
        ["issue_journalcontents", "by journal issue"],
        ["year_journalcontents", "by year, then by journal contents"],
        ["decade_date", "chronologically by decades"],
        ["decade_authortitle", "by decades, then by author"],
        ["author_authortitle", "alphabetically by author"]
    ]);

    // sort keys
    // major: author first letter
    that.keys.author = function (doc) { 
        return doc_author(doc.authors).replace(/^\W*/, "")[0].toUpperCase();
    };

    // minor: author and title
    that.keys.authortitle = function (doc) { 
        var s = doc_author(doc.authors) + doc.title;
        return s.toLowerCase();
    };

    // major: decade
    that.keys.decade = function (doc) {
        return Math.floor(doc.date.getUTCFullYear() / 10).toString() +
            "0s";
    };

    // major: year (use date for minor)
    that.keys.year = function (doc) {
        return doc.date.getUTCFullYear();
    };

    // major: journal title
    that.keys.journal = function (doc) {
        return doc.journal;
    };

    // major: journal issue (use journalcontents for minor)
    that.keys.issue = function (doc) {
        var k = doc.journal;
        k += "_" + d3.format("05d")(doc.volume);
        if (doc.issue) {
            k += "_" + doc.issue;
        }
        return k;
    };
    // decode this key into a readable heading
    that.keys.issue.display_heading = function (code) {
        var splits, result;

        splits = code.split("_");
        result = splits[0] + " " + String(+splits[1]);
        if (splits.length > 2) {
            result += "." + splits[2];
        }
        return result;
    }; 

    // minor: use full-resolution pub. date information
    that.keys.date = function (doc) {
        return +doc.date;
    };

    // minor: journal + volume + issue + page order
    that.keys.journalcontents = function (doc) {
        var result = doc.journal;

        result += d3.format("05d")(doc.volume);
        result += d3.format("05d")((doc.issue === "") ? 0
                : doc.issue.replace(/\/.*$/, ""));
        if (doc.pagerange.search(/^\d/) !== -1) {
            result += d3.format("05d")(doc.pagerange.match(/^(\d+)/)[1]);
        } else {
            result += doc.pagerange;
        }
        return result;
    };

    // Override inherited ascending/descending semantics
    // minor dir == major dir iff minor & major are semantically similar
    // with ascending as the default otherwise

    that.sort.dir = function (p) {
        var result = {
            major: true,
            minor: true
        };

        if (p.dir === "up") {
            return result;
        }

        if (p.dir === "down") {
            result.major = false;
            if (p.major === "decade" || p.major === "year"
                    || p.major === "issue") {
                result.minor = p.minor !== "date" && p.minor !== "journal";
            } else if (p.major === "alpha" || p.major === "journal") {
                // journal title descending --> journal contents ascending
                // Right, I think, but not wholly obvious
                result.minor = p.minor !== "alpha";
            } else {
                // shouldn't ever get here, but...
                result.minor = true;
            }
        }
        return result;
    };

    // utility function: extract a string giving the citation form of a
    // document's authors.

    doc_author = function (auths) {
        var lead,
            lead_trail,
            result,
            authors = auths.split(my.author_delimiter)
                // ensure an empty or white-space author is not counted
                .filter(function (a) { return (/\S/).test(a); }),
            n_auth = authors.length;

        if (n_auth === 0) {
            return my.anon;
        }

        lead = authors[0].replace(/,/g, "").split(" ");
        // check for Jr., Sr., 2nd, etc.
        // Can mess up if last name is actually the letter I, X, or V.
        lead_trail = lead.pop();
        if (lead.length >= 2
                && (lead_trail.search(/^(\d|Jr|Sr|[IXV]+$)/) !== -1)) {
            result = lead.pop().replace(/_$/, "");
            lead_trail = ", " + lead_trail.replace(/\W*$/, "");
        } else {
            result = lead_trail;
            lead_trail = "";
        }
        result += ", " + lead.join(" ") + lead_trail;
        if (n_auth > 1) {
            if (n_auth >= my.et_al) {
                result += ", ";
                result += authors.slice(1, my.et_al).join(", ");
                result += "et al.";
            } else {
                if (n_auth > 2) {
                    result += ", ";
                }
                result += authors.slice(1, n_auth - 1)
                    .join(", ");
                result += ", and " + authors[n_auth - 1];
            }
        }

        return result;
    };
    that.doc_author = doc_author;

    // override inherited citation
    that.citation = function (doc) {
        var s = doc_author(doc.authors),
            title;

        // don't duplicate trailing period on middle initial etc.
        s = s.replace(/\.?$/, ". ");
        // double quotation marks in title to single
        // based on https://gist.github.com/drdrang/705071
        title = doc.title.replace(/“/g,'‘')
            .replace(/”/g,'’')
            .replace(/(^|[-\u2014/(\[{\u2018\s])"/g, "$1‘") // opening "
            .replace(/"/g,'’') // which leaves closing "
            .replace(/'/g,'’')
            .replace(/ <br><\/br>/g,'. ');
        s += '“' + title + '.”';
        s = s.replace(/’\./g,".’"); // fix up ’.” situations

        s += " <em>" + doc.journal + "</em> ";
        s += doc.volume;
        if (doc.issue) {
            s += ", no. " + doc.issue;
        }

        // JSTOR supplies UTC dates
        s += " (" + d3.time.format.utc("%B %Y")(doc.date) + "): ";

        s += doc.pagerange + ".";

        s = s.replace(/\.\./g, ".");
        s = s.replace(/_/g, ",");
        s = s.replace(/\t/g, "");

        return s;
    };

    // provide url method
    that.url = function (doc) {
        return "http://www.jstor.org"
            + "/stable/"
            + doc.doi;
    };

    return that;
}; // bib_dfr()
