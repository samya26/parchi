"""Build compact, sharded medicine lookup files for Parchi.
Source: junioralive/Indian-Medicine-Dataset (MIT). Prices as recorded in the dataset."""
import pandas as pd, re, json, os, sys, collections
src, out = sys.argv[1], sys.argv[2]
d = pd.read_csv(src)
d = d.rename(columns={'price(₹)': 'price'})
d = d[d['type'].fillna('allopathy') == 'allopathy']
d = d.dropna(subset=['name', 'price', 'short_composition1'])

def norm_part(p):
    if not isinstance(p, str) or not p.strip(): return None
    p = re.sub(r'\s+', ' ', p.strip())
    m = re.match(r'^(.*?)\s*\((.*?)\)\s*$', p)
    salt, strength = (m.group(1), m.group(2)) if m else (p, '')
    salt = salt.lower().replace('amoxycillin', 'amoxicillin').strip()
    strength = strength.lower().replace(' ', '')
    return salt, strength, p

FORMS = ['tablet', 'capsule', 'syrup', 'suspension', 'injection', 'cream', 'gel', 'ointment', 'drop', 'inhaler', 'spray', 'solution', 'powder', 'sachet', 'lotion', 'respules', 'soap', 'shampoo', 'granules', 'infusion', 'patch', 'mouthwash']
REL = re.compile(r'\b(sr|er|xr|pr|cr|mr|xl|od|cd|ds|dt|forte|plus)\b')
def form_of(name, pack):
    s = f'{pack} {name}'.lower()
    base = 'other'
    for f in FORMS:
        if f in s: base = f if f != 'drop' else 'drops'; break
    # release type / variant changes how a medicine works - never mix them
    rel = sorted(set(REL.findall(str(name).lower())))
    # where it's used matters too: eye drops are never an alternative for nasal drops
    route = next((r for r, w in (('eye', r'\b(eye|ophthalmic)\b'), ('ear', r'\b(ear|otic)\b'), ('nasal', r'\b(nasal|nose)\b')) if re.search(w, s)), None)
    return base + ('-' + '-'.join(rel) if rel else '') + ('@' + route if route else '')

def units(pack):
    pack = str(pack).lower()
    m = re.search(r'(\d+)\s*(tablets?|capsules?|sachets?|respules?|patch)', pack)
    if m: return int(m.group(1)), 'unit'
    m = re.search(r'(\d+(?:\.\d+)?)\s*ml', pack)
    if m: return float(m.group(1)), 'ml'
    m = re.search(r'(\d+(?:\.\d+)?)\s*gm?\b', pack)
    if m: return float(m.group(1)), 'g'
    return None, None

groups = {}; names = collections.defaultdict(list); gcount = 0
gitems = collections.defaultdict(list)
for r in d.itertuples(index=False):
    parts = [x for x in (norm_part(r.short_composition1), norm_part(r.short_composition2)) if x]
    if not parts: continue
    parts.sort()
    form = form_of(r.name, r.pack_size_label)
    key = ' + '.join(f'{s}|{st}' for s, st, _ in parts) + '#' + form
    if key not in groups:
        groups[key] = gcount; gcount += 1
    gid = groups[key]
    comp = ' + '.join(p for _, _, p in parts)
    n, ut = units(r.pack_size_label)
    up = round(float(r.price) / n, 3) if n else None
    disc = bool(r.Is_discontinued)
    item = [str(r.name), round(float(r.price), 2), str(r.manufacturer_name), str(r.pack_size_label), up, ut, int(disc)]
    gitems[gid].append(item)
    nn = re.sub(r'[^a-z0-9]', '', str(r.name).lower())
    k = nn[0] if nn and nn[0].isalpha() else '0'
    names[k].append([str(r.name), gid, len(gitems[gid]) - 1])

comp_of = {}
for key, gid in groups.items():
    comp_of[gid] = key
os.makedirs(f'{out}/names', exist_ok=True); os.makedirs(f'{out}/groups', exist_ok=True)
for k, v in names.items():
    json.dump(v, open(f'{out}/names/{k}.json', 'w'), separators=(',', ':'))
NG = 64
shards = collections.defaultdict(dict)
for gid, items in gitems.items():
    key = comp_of[gid]
    comp_str, form = key.split('#')
    # human composition from first item of group is not stored; rebuild nicely
    pretty = ' + '.join(f"{s.title()} ({st})" if st else s.title() for s, st in (p.split('|') for p in comp_str.split(' + ')))
    shards[gid % NG][gid] = {'c': pretty, 'f': form, 'i': items}
for s, v in shards.items():
    json.dump(v, open(f'{out}/groups/{s}.json', 'w'), separators=(',', ':'))
mf = d['manufacturer_name'].value_counts().head(40).index.tolist()
json.dump({'groups': NG, 'bigMakers': mf, 'count': int(len(d)), 'source': 'Indian-Medicine-Dataset (MIT, junioralive)'}, open(f'{out}/meta.json', 'w'))
print('medicines', len(d), 'groups', gcount)
