# Builds dictionary.js (definitions, synonyms, opposites) from WordNet, for common words only.
# Inputs: WordNet via nltk (pip install nltk; data from
#         https://raw.githubusercontent.com/nltk/nltk_data/gh-pages/packages/corpora/wordnet.zip, unzipped into $NLTK_DATA/corpora)
#         freq.txt (same frequency list as build_rhyme_data.py)
# Usage:  NLTK_DATA=path python3 build_dictionary.py [freq.txt]  -> writes dictionary.js
# Format: const WORDNET="line\nline...";  one line per word:
#   word|n:definition~v:definition|n:syn,syn~v:syn,syn|opposite,opposite|related,related
#   related = more specific kinds of the word's top meanings (money -> cash, dough, bread)
#   pos letters: n noun, v verb, a adjective, r adverb. Senses in WordNet order (most usual first).
#   word|=base  points a changed form to its dictionary form (ran -> run, dreams -> dream)
import sys, json
from nltk.corpus import wordnet as wn
freq_path = sys.argv[1] if len(sys.argv) > 1 else 'freq.txt'
HEADWORDS = 40000   # how many of the most common words get an entry
MAX_DEFS = 2        # definitions per part of speech
MAX_SYNS = 24       # synonyms per part of speech
MAX_RELATED = 20
rank = {}
for i, l in enumerate(open(freq_path)):
    rank.setdefault(l.split()[0], i)
POS = {'n': 'n', 'v': 'v', 'a': 'a', 's': 'a', 'r': 'r'}
# slurs WordNet lists as ordinary synonyms (e.g. "fag" for toil); never suggested
BLOCK = set('fag fagging faggot fairy nigger nigga negro chink gook spic wetback kike dyke tranny retard cripple'.split())
def common(name):  # keep single common words, and short phrases made of common words
    ws = name.split()
    return len(ws) <= 3 and not BLOCK & set(ws) and all(w in rank for w in ws) and (len(ws) > 1 or rank[ws[0]] < 50000)
def by_freq(names):
    names = list(dict.fromkeys(names))
    # drop British spellings when the American one is also there (fervour/fervor)
    names = [n for n in names if not (n.endswith('our') and n[:-3] + 'or' in names)]
    # common single words first, phrases after
    return sorted(names, key=lambda n: max(rank.get(x, 99999) for x in n.split()) + (len(n.split()) - 1) * 50000)
def lemma_names(synsets, w):
    return [n for g in synsets for n in (l.name().replace('_', ' ').lower() for l in g.lemmas()) if n != w and common(n)]
def clean(t, n=140):
    t = t.replace('|', '/').replace('~', '-').replace('\n', ' ').strip()
    return t if len(t) <= n else t[:n].rsplit(' ', 1)[0] + '…'
lines, aliases = [], []
for w, r in sorted(rank.items(), key=lambda x: x[1]):
    if r >= HEADWORDS or not w.isalpha(): continue
    # only the word's own meanings (wn.synsets also returns those of its dictionary form)
    syns = [s for s in wn.synsets(w) if any(l.name().lower() == w for l in s.lemmas())]
    if not syns:
        base = wn.morphy(w)
        if base and base != w and base.isalpha(): aliases.append(w + '|=' + base)
        continue
    defs, sy, ants = {}, {}, []
    related = by_freq(lemma_names([h for s in syns[:2] if s.pos() in 'nv' for h in s.hyponyms()], w))[:MAX_RELATED]
    for s in syns:
        p = POS[s.pos()]
        if len(defs.setdefault(p, [])) < MAX_DEFS: defs[p].append(clean(s.definition()))
        # true synonyms first, then (for adjectives) similar words
        names = by_freq(lemma_names([s], w)) + by_freq(lemma_names(s.similar_tos() if p == 'a' else [], w))
        for l in s.lemmas():
            if l.name().lower() == w:
                ants += [a.name().replace('_', ' ') for a in l.antonyms() if common(a.name().replace('_', ' '))]
        out = sy.setdefault(p, [])
        for n in names:
            if n not in out and len(out) < MAX_SYNS: out.append(n)
    order = [p for p in 'nvar' if p in defs]
    order.sort(key=lambda p: -len([s for s in syns if POS[s.pos()] == p]))
    lines.append('|'.join([w,
        '~'.join(p + ':' + d for p in order for d in defs[p]),
        '~'.join(p + ':' + ','.join(sy[p]) for p in order if sy.get(p)),
        ','.join(dict.fromkeys(ants)), ','.join(r for r in related if r not in ants)]))
heads = {l.split('|')[0] for l in lines}
lines += [a for a in aliases if a.split('=')[1] in heads]
open('dictionary.js', 'w').write('const WORDNET=' + json.dumps('\n'.join(lines)) + ';')
print(len(lines), 'words')
