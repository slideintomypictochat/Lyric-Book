# Rebuilds the rhyme data embedded in index.html.
# Inputs: cmu.dict (https://raw.githubusercontent.com/cmusphinx/cmudict/master/cmudict.dict)
#         freq.txt (https://raw.githubusercontent.com/hermitdave/FrequencyWords/master/content/2018/en/en_50k.txt)
#         en_US.dic (https://raw.githubusercontent.com/LibreOffice/dictionaries/master/en/en_US.dic), used to spot names
# Usage:  python3 build_rhyme_data.py [cmu.dict] [freq.txt] [en_US.dic]  -> writes rhyme.js, then run splice_rhyme_data.py
# Output: rhyme.js -> const RHYME_DATA="..."; const RANKED="...";
# Format: RHYME_DATA = "tail=common,words!rare,words;tail=..."
#   tail   = phonemes from the main stressed vowel, vowels keep stress digits (e.g. "OW1.P.AH0.M.IY2.N")
#   word~AH0.EH2 = word with the vowels before the main stress (for syllables and multi-syllable matching)
#   A word can appear in several tails (alternate pronunciations); *word marks a less usual one.
#   common words sorted by frequency (names count as rare, so they aren't suggested); RANKED = all common words in frequency order
import re, sys, collections
cmu_path = sys.argv[1] if len(sys.argv) > 1 else 'cmu.dict'
freq_path = sys.argv[2] if len(sys.argv) > 2 else 'freq.txt'
spell_path = sys.argv[3] if len(sys.argv) > 3 else 'en_US.dic'
V = set("AA AE AH AO AW AY EH ER EY IH IY OW OY UH UW".split())
# Pronunciations the CMU dictionary gets wrong (or misses) for how people actually say them.
# These replace the dictionary's entries for the word.
OVERRIDES = {
    'dopamine': ['D OW1 P AH0 M IY2 N'],
    'serotonin': ['S EH2 R AH0 T OW1 N AH0 N'],
    'melatonin': ['M EH2 L AH0 T OW1 N AH0 N'],
}
# Names: words the spell-check list only has capitalised (Josephine, Nadine), unless an inflection of a normal word.
low, cap = set(), set()
for l in open(spell_path, encoding='utf-8', errors='ignore'):
    w = l.split('/')[0].strip()
    if w: (cap if w[0].isupper() else low).add(w.lower())
SUFFIXES = [("'s", ''), ('s', ''), ('es', ''), ('ies', 'y'), ('ed', ''), ('ed', 'e'), ('d', ''), ('ing', ''), ('ing', 'e'), ('er', ''), ('ers', '')]
def is_name(w):
    w = w.rstrip("'s") if w.endswith("'s") else w
    return w in cap and w not in low and not any(w.endswith(a) and w[:-len(a)] + b in low for a, b in SUFFIXES)
rank = {}
for i, l in enumerate(open(freq_path)):
    w = l.split()[0]
    known = w in low or w in cap or any(w.endswith(x) and w[:-len(x)] + y in low for x, y in SUFFIXES)
    if not is_name(w) and (known or i < 8000): rank.setdefault(w, i)  # skip names and obscure unknown words
prons = collections.defaultdict(list)
for line in open(cmu_path, encoding='utf-8'):
    line = line.split('#')[0].strip()
    if not line: continue
    w, *ph = line.split()
    w = re.sub(r'\(\d+\)$', '', w)
    if not re.fullmatch(r"[a-z']+", w) or w in OVERRIDES: continue
    prons[w].append(ph)
for w, ps in OVERRIDES.items():
    prons[w] = [p.split() for p in ps]
g = collections.defaultdict(list)
for w, ps in prons.items():
    for n, ph in enumerate(ps):
        vs = [i for i, p in enumerate(ph) if p[:-1] in V and p[-1].isdigit()]
        if not vs: continue
        st = ([i for i in vs if ph[i][-1] == '1'] or [i for i in vs if ph[i][-1] == '2'] or [vs[-1]])
        s = st[-1]
        tail = '.'.join(ph[s:])
        pre = '.'.join(ph[i] for i in vs if i < s)
        x = ('*' if n else '') + w + ('~' + pre if pre else '')
        if x not in g[tail]: g[tail].append(x)
base = lambda x: x.split('~')[0].lstrip('*')
out, words = [], set()
for t, ws in g.items():
    words.update(base(x) for x in ws)
    com = sorted([x for x in ws if base(x) in rank], key=lambda x: rank[base(x)])
    rare = [x for x in ws if base(x) not in rank]
    out.append(t + '=' + ','.join(com) + '!' + ','.join(rare))
ranked, seen = [], set()
for l in open(freq_path):
    w = l.split()[0]
    if w in words and w not in seen: ranked.append(w); seen.add(w)
open('rhyme.js', 'w').write('const RHYME_DATA="' + ';'.join(out) + '";const RANKED="' + ','.join(ranked) + '";')
