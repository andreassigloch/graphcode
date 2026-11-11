import json,collections,re,sys
g=json.load(open(sys.argv[1]))
E={e['id']:e for e in g['elements']}; T=g['traces']
def out(s,ty=None,tt=None): return [t['target'] for t in T if t['source']==s and (ty is None or t['type']==ty) and (tt is None or E.get(t['target'],{}).get('type')==tt)]
def inn(s,ty=None,st=None): return [t['source'] for t in T if t['target']==s and (ty is None or t['type']==ty) and (st is None or E.get(t['source'],{}).get('type')==st)]
REQ=[e for e in g['elements'] if e['type']=='REQ']
kinds=lambda r: r.get('kinds') if isinstance(r.get('kinds'),list) else [r.get('kinds')]
F=[r for r in REQ if 'functional' in kinds(r)]; N=[r for r in REQ if 'non-functional' in kinds(r)]
d=lambda e:e.get('description') or ''
res={}
def rep(k,hits,base,ex=3):
    res[k]=(len(hits),base); print(f'{k}: {len(hits)}/{base}'); [print('   ',h) for h in hits[:ex]]
print('REQ',len(REQ),'functional',len(F),'non-functional',len(N))
# K1 Satzmuster textlich: Ausloeser im Text
trig=re.compile(r'\b(wenn|sobald|bei|nach|falls|when|if|on|after|upon|whenever|jede[rsm]?|every|each)\b',re.I)
cond=re.compile(r'\b(nur wenn|solange|sofern|ausser|außer|only if|unless|while)\b',re.I)
rep('K1a funktional ohne Ausloeser-Wort',[r['id'] for r in F if not trig.search(d(r))],len(F))
rep('K1b mit Bedingung (nur wenn/solange)',[r['id'] for r in REQ if cond.search(d(r))],len(REQ))
# K1 strukturell: Ausloeser und Ergebnis als Fluss an der erfuellenden FUNC
bad=[]
for r in F:
    fs=inn(r['id'],'satisfy','FUNC')
    if not fs: bad.append(r['id']+' (keine FUNC)'); continue
    if not any(inn(f,'io','FLOW') and out(f,'io','FLOW') for f in fs): bad.append(r['id'])
rep('K1c funktional: keine erfuellende FUNC mit Ein- UND Ausgang',bad,len(F))
# BQ-02 nach Art getrennt
mp=re.compile(r"(\d+\s*(ms|s|sec|seconds?|min|minutes?|h|hours?|days?|%|percent|bytes?|KB|MB|GB|TB|times|x|sessions?|requests?|Sekunden?|Minuten?|Stunden?|Tagen?|Prozent|mal|Anfragen)\b|\d+\s*%|\b(exactly|at least|at most|no more than|within|before|after|at the latest|between|greater|less|equal|minimum|maximum|genau|mindestens|hoechstens|höchstens|spaetestens|spätestens|nicht mehr als|innerhalb|zwischen|groesser|größer|kleiner|gleich|minimal|maximal)\b)",re.I)
rep('BQ-02 nur non-functional (Guete ohne Zahl)',[r['id'] for r in N if not mp.search(d(r))],len(N))
rep('BQ-02 nur functional',[r['id'] for r in F if not mp.search(d(r))],len(F))
# BQ-06 Modalverb
mod=re.compile(r'\b(shall|must|must not|soll|muss|darf nicht|müssen|muessen|sollen)\b',re.I)
rep('BQ-06 kein Modalverb',[r['id'] for r in REQ if not mod.search(d(r))],len(REQ))
# K2 Was/Wie: Innenleben im Text
mods=[E[m]['id'].replace('MOD-','') for m in E if E[m]['type']=='MOD']
wie=re.compile(r'(\b[\w/.-]+\.(ts|mjs|js|json|sh|md)\b|\bsrc/|`[^`]+`|\b[a-z]+[A-Z]\w+\(|\b(Kuzu|SQLite|Zod|vitest|WeakMap|Map|Set)\b)')
h=[]
for r in REQ:
    m=wie.search(d(r)) or wie.search(r['name'])
    if m: h.append(f"{r['id']}: {m.group(0)}")
rep('K2a Wie: Datei, Code-Bezeichner oder Technik im Text',h,len(REQ),6)
h=[f"{r['id']}: {mm}" for r in REQ for mm in mods if re.search(r'\b'+re.escape(mm)+r'\b',d(r)+' '+r['name'],re.I) and E.get('MOD-'+mm) and not any(x=='MOD-'+mm for x in inn(r['id'],'satisfy'))]
rep('K2b Wie: nennt ein Modul, das sie nicht erfuellt',sorted(set(h)),len(REQ),6)
# K11 Begruendung/Historie im Anforderungstext
hist=re.compile(r'(CR-[A-Z]+-\d+|\b20\d\d-\d\d-\d\d\b|[Gg]emessen|[Ff]rueher|[Ff]rüher|vorher)')
rep('K11 Historie/CR/Messdatum im Anforderungstext',[r['id'] for r in REQ if hist.search(d(r))],len(REQ))
L=sorted(len(d(r)) for r in REQ); print('    Laenge Median',L[len(L)//2],'Max',L[-1],'>600 Zeichen:',sum(x>600 for x in L))
# K10 Singular: mehrere Modalverben / Saetze mit Modalverb
rep('K10 mehr als ein Modalverb (nicht singulaer)',[r['id'] for r in REQ if len(mod.findall(d(r)))>1],len(REQ))
# K3 Akteur ist Rolle: Akteur gleichnamig mit internem Modul
h=[]
for a in [e for e in g['elements'] if e['type']=='ACTOR']:
    key=a['id'].replace('ACTOR-','')
    for m in E:
        if E[m]['type']=='MOD' and key in m: h.append(f"{a['id']} ~ {m}")
rep('K3 Akteur heisst wie ein internes Modul',h,sum(e['type']=='ACTOR' for e in g['elements']))
# K7 FLOW genau ein SCHEMA
c=collections.Counter(len(out(f['id'],'relation','SCHEMA')) for f in g['elements'] if f['type']=='FLOW'); print('K7 SCHEMA je FLOW',dict(c))
car=re.compile(r'\b(HTTP|SSE|stdio|JSON-RPC|WebSocket|TCP|Socket|Bluetooth|CAN|ueber|über|via)\b',re.I)
rep('K7b Format nennt einen Traeger',[f"{s['id']}: {car.search(d(s)).group(0)}" for s in g['elements'] if s['type']=='SCHEMA' and car.search(d(s))],sum(e['type']=='SCHEMA' for e in g['elements']),6)
# K9 TEST: Eingabe, Bedingung, Erwartung
exp=re.compile(r'(erwart|expect|liefert|ergibt|returns?|→|->|meldet|lehnt|blockt|gleich|equals?|identisch|faellt|fällt|bleibt|rot|gruen|grün)',re.I)
TS=[e for e in g['elements'] if e['type']=='TEST']
rep('K9 TEST ohne erwartetes Ergebnis im Text',[t['id'] for t in TS if not exp.search(d(t))],len(TS))
# K4 UC: Nutzen mit Akteur — UC ohne Akteur an den Ketten
h=[]
for u in [e for e in g['elements'] if e['type']=='UC']:
    acts=set()
    for fc in out(u['id'],'compose','FCHAIN'):
        for f in out(fc,'compose','FUNC'):
            for fl in inn(f,'io','FLOW')+out(f,'io','FLOW'):
                acts|=set(inn(fl,'io','ACTOR'))|set(out(fl,'io','ACTOR'))
    if not acts: h.append(u['id'])
rep('K4 UC ohne Akteur an seinen Ketten',h,9)
# K8 Guete an FUNC
rep('K8 FUNC erfuellt non-functional',[t['source']+'->'+t['target'] for t in T if t['type']=='satisfy' and E.get(t['source'],{}).get('type')=='FUNC' and 'non-functional' in kinds(E[t['target']])],0)
json.dump(res,open(sys.argv[2],'w'))
