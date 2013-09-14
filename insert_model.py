# usage
#
# python insert_model.py index.html m.json > model.html
#
# model.html can now be loaded from the hard drive without a web server
# (it will still look for local copies of d3, queue, bootstrap, jquery)
#
# m.json can be created by visiting #/stringify_model on the server version
# and copying the textbox contents.

import re

def main(script,source,data):
    with open(source) as f_src:
        for line in f_src:
            print line,
            if re.search('__DATA__',line): 
                print '''
<script type="application/json" id="m__DATA__">
'''
                with open(data) as f_data:
                    print f_data.read()
                print '''
</script>
'''


if __name__=='__main__':
    import sys
    main(*sys.argv)

