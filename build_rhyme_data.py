# Rebuilds the rhyme data embedded in index.html.
# Inputs: cmu.dict (https://raw.githubusercontent.com/cmusphinx/cmudict/master/cmudict.dict)
#         freq.txt (https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/en/en_50k.txt)
# Output: rhyme.js -> const RHYME_DATA="..."; const RANKED="...";
# Format: RHYME_DATA = "vowelKey:tail=common,words!rare,words|tail=...;vowelKey:..."
#   vowelKey = vowels from last stressed vowel (e.g. "AY.AH")   -> near rhymes / highlighting
#   tail     = all phonemes from last stressed vowel (e.g. "AY.M.AH.N.D.Z") -> perfect rhymes
#   word~IH.EH = word with its pre-stress vowels (for syllable counts + multi-word rhymes)
#   common words sorted by frequency; RANKED = all common words in frequency order
import re, collections
V = set("AA AE AH AO AW AY EH ER EY IH IY OW OY UH UW".split())
rank = {}
for i, l in enumerate(open('freq.txt')):
    rank.setdefault(l.split()[0], i)
g = collections.defaultdict(lambda: collections.defaultdict(list))
for line in open('cmu.dict', encoding='utf-8'):
    line = line.split('#')[0].strip()
    if not line: continue
    w, *ph = line.split()
    if '(' in w or not re.fullmatch(r"[a-z']+", w): continue
    vs = [(i, p) for i, p in enumerate(ph) if p[:-1] in V and p[-1].isdigit()]
    if not vs: continue
    st = ([i for i, (_, p) in enumerate(vs) if p[-1] == '1']
          or [i for i, (_, p) in enumerate(vs) if p[-1] == '2'] or [len(vs) - 1])
    s = st[-1]
    k = '.'.join(p[:-1] for _, p in vs[s:])
    tail = '.'.join(re.sub(r'\d', '', p) for p in ph[vs[s][0]:])
    pre = '.'.join(p[:-1] for _, p in vs[:s])
    g[k][tail].append(w + ('~' + pre if pre else ''))
base = lambda x: x.split('~')[0]
out, words = [], set()
for k, tails in g.items():
    parts = []
    for t, ws in tails.items():
        words.update(base(x) for x in ws)
        com = sorted([x for x in ws if base(x) in rank], key=lambda x: rank[base(x)])
        rare = [x for x in ws if base(x) not in rank]
        parts.append(t + '=' + ','.join(com) + '!' + ','.join(rare))
    out.append(k + ':' + '|'.join(parts))
ranked, seen = [], set()
for l in open('freq.txt'):
    w = l.split()[0]
    if w in words and w not in seen: ranked.append(w); seen.add(w)
open('rhyme.js', 'w').write('const RHYME_DATA="' + ';'.join(out) + '";const RANKED="' + ','.join(ranked) + '";')
