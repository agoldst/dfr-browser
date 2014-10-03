/*global VIS, d3 */
"use strict";
var bib = { };

bib.doc_author = function (doc) {
    var lead,
        lead_trail,
        result;

    if (doc.authors.length > 0) {
        lead = doc.authors[0].replace(/,/g, "").split(" ");
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
        if (doc.authors.length > 1) {
            // "et al" is better for real bibliography, but it's
            // actually worth being able to search all the multiple authors
            /*if (doc.authors.length > 3) {
                result += ", " + doc.authors.slice(1, 3).join(", ");
                result += "et al.";
            } else {*/
            if (doc.authors.length > 2) {
                result += ", ";
                result += doc.authors
                    .slice(1, doc.authors.length - 1)
                    .join(", ");
            }
            result += ", and " + doc.authors[doc.authors.length - 1];
        }
    } else {
        result = "[Anon]";
    }

    return result;
};

// bibliography sorting
bib.sort = function (m, major, minor, asc_maj, asc_min) {
    var result = [],
        docs,
        major_key,
        minor_key,
        cmp_maj,
        cmp_min,
        cur_major,
        i,
        last,
        get_id = function (d) { return d.id; },
        partition = [];

    if (major === "decade") {
        major_key = function (i) {
            return Math.floor(m.meta(i).date.getUTCFullYear() / 10).toString() +
                "0s";
        };
    } else if (major === "year") {
        major_key = function (i) {
            return m.meta(i).date.getUTCFullYear();
        };
    } else if (major === "journal") {
        major_key = function (i) {
            return m.meta(i).journaltitle;
        };
    } else if (major === "issue") {
        major_key = function (i) {
            var doc = m.meta(i),
                k;
            k = doc.journaltitle;
            k += "_" + d3.format("05d")(doc.volume);
            k += "_" + d3.format("05d")((doc.issue === "") ? 0
                    : doc.issue.replace(/\/.*$/, ""));
            return k;
        };
    } else { // expected: major === "alpha"
        // default to alphabetical by author
        major_key = function (i) {
            return bib.doc_author(m.meta(i)).replace(/^\W*/, "")[0]
                .toUpperCase();
        };
    }

    if (minor === "date") {
        minor_key = function (i) {
            return +m.meta(i).date;
        };
    } else if (minor === "journal") {
        minor_key = function (i) {
            var doc = m.meta(i),
                result_m = doc.journaltitle;

            result_m += d3.format("05d")(doc.volume);
            result_m += d3.format("05d")((doc.issue === "") ? 0
                    : doc.issue.replace(/\/.*$/, ""));
            if (doc.pagerange.search(/^\d/) !== -1) {
                result_m += d3.format("05d")(doc.pagerange.match(/^(\d+)/)[1]);
            } else {
                result_m += doc.pagerange;
            }
            return result_m;
        };
    } else { // expected: minor === "alpha"
        // default to alphabetical by author then title
        minor_key = function (i) {
            return bib.doc_author(m.meta(i)) + m.meta(i).title;
        };
    }

    cmp_maj = asc_maj ? d3.ascending : d3.descending;
    cmp_min = asc_min ? d3.ascending : d3.descending;

    docs = d3.range(m.n_docs())
        .map(function (d) {
            return {
                id: d,
                major: major_key(d),
                minor: minor_key(d)
            };
        })
        .sort(function (a, b) {
            return cmp_maj(a.major, b.major) ||
                cmp_min(a.minor, b.minor) ||
                d3.ascending(a.id, b.id); // stabilize sort
        });

    for (i = 0, cur_major = ""; i < docs.length; i += 1) {
        if (docs[i].major !== cur_major) {
            partition.push(i);
            result.push({
                heading: docs[i].major
            });
            cur_major = docs[i].major;
        }
    }
    partition.shift(); // correct for "0" always getting added at the start
    partition.push(docs.length); // make sure we get the tail 

    for (i = 0, last = 0; i < partition.length; i += 1) {
        result[i].docs = docs.slice(last, partition[i]).map(get_id);
        last = partition[i];
    }


    return result;
};

// validate major/minor sort terms. The output is the same as the input,
// except an invalid term is replaced with undefined.
bib.sort.validate = function (p) {
    var result = p;
    if (VIS.bib.keys.major.indexOf(p.major) === -1) {
        result.major = undefined;
    }
    if (VIS.bib.keys.minor.indexOf(p.minor) === -1) {
        result.minor = undefined;
    }

    if (p.dir !== "up" && p.dir !== "down") {
        result.dir = undefined;
    }

    return result;
};

// Semantics of ascending/descending
// minor dir == major dir iff minor & major are semantically similar
// with ascending as the default otherwise
bib.sort.dir = function (p) {
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

bib.citation = function (doc) {
    var result = bib.doc_author(doc);

    // don't duplicate trailing period on middle initial etc.
    result = result.replace(/\.?$/, ". ");
    result += '"' + doc.title + '."';
    result += " <em>" + doc.journaltitle + "</em> ";
    result += doc.volume;
    if (doc.issue) {
        result += ", no. " + doc.issue;
    }

    result += " (" + VIS.cite_date_format(doc.date) + "): ";
    result += doc.pagerange + ".";

    result = result.replace(/\.\./g, ".");
    result = result.replace(/_/g, ",");
    result = result.replace(/\t/g, "");

    return result;
};

bib.parse = function (d) {

    // no header, but this is the column order:
    // 0  1     2      3            4      5     6       7      
    // id,title,author,journaltitle,volume,issue,pubdate,pagerange
    var a_str = d[2].trim(), // author
        date = new Date(d[6].trim()); // pubdate (UTC)

    return {
        doi: d[0].trim(), // id
        title: d[1].trim(),
        authors: a_str === "" ? [] : a_str.split(VIS.bib.author_delimiter),
        journaltitle: d[3].trim(),
        volume: d[4].trim(),
        issue: d[5].trim(),
        date: date, // pubdate
        pagerange: d[7].trim()
            .replace(/^p?p\. /, "")
            .replace(/-/g, "–")
    };
};
