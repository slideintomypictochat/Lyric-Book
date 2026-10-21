# Replaces the first <script> (the rhyme data) in index.html with the contents of rhyme.js.
# Usage: python3 splice_rhyme_data.py [rhyme.js] [index.html]
import sys
js = open(sys.argv[1] if len(sys.argv) > 1 else 'rhyme.js').read()
path = sys.argv[2] if len(sys.argv) > 2 else 'index.html'
html = open(path, encoding='utf-8').read()
start = html.index('<script>const RHYME_DATA=')
end = html.index('</script>', start)
open(path, 'w', encoding='utf-8').write(html[:start] + '<script>' + js + html[end:])
