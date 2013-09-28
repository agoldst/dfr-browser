# usage
#
# python insert_model.py --info info.json --dt dt.json --tw tw.json \
#        --meta meta.csv index.html > model.html
#
# model.html can now be loaded from the hard drive without a web server
# (it will still look for local copies of d3, queue, bootstrap, jquery)

import re
import getopt

def main(argv):
    needed = {
            "info": "application/json",
            "dt": "application/json",
            "tw": "application/json",
            "meta": "text/csv"
            }
    opts, args = getopt.getopt(argv,None,[s + "=" for s in needed.keys()])
    with open(args[0]) as f_src:
        for line in f_src:
            print line,
            if re.search('__DATA__',line): 
                for key, filename in opts:
                    what = key[2:]
                    print '<script type="{}" id="m__DATA__{}">'.format(
                            needed[what],what)
                    with open(filename) as f_data:
                        print f_data.read(),
                    print '</script>'

if __name__=='__main__':
    import sys
    main(sys.argv[1:])

