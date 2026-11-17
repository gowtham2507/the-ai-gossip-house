const fs=require('fs');
const src=['01_core','02_agents','03_engine','04_life','05_decide','06_conv','07_dialogue','08_llm'].map(f=>fs.readFileSync(__dirname+'/../src/'+f+'.js','utf8')).join('\n');
const days=+process.argv[2]||2, seed=+process.argv[3]||42;
const code=src+`
newGame(${seed});
const counts={};
let lastPrint=0;
const t0=Date.now();
while(S.t<8*60+${days}*1440){ tick(0.25); }
for(const e of S.events){ counts[e.type]=(counts[e.type]||0)+1; }
console.log('sim ms',Date.now()-t0);
console.log(JSON.stringify(counts));
const imp=S.events.filter(e=>e.imp>=3).reverse();
for(const e of imp.slice(0,400)) console.log('D'+dayOf(e.t)+' '+fmtTime(e.t)+' ['+e.type+'] '+e.text);
const ih={}; for(const c of S.ended) for(const l of c.lines) ih[l.intent]=(ih[l.intent]||0)+1; console.log('intents(last60 convs)',JSON.stringify(ih)); console.log('claims',Object.keys(S.claims).length,'secrets known:',Object.values(S.claims).filter(c=>c.secret).map(c=>c.id+':'+S.agents.filter(a=>a.knowledge[c.id]).map(a=>a.id).join('/')).join('  '));
console.log('--- sample conversations');
for(const c of S.ended.slice(0,6)){ console.log('== '+c.topic+' '+c.participants.join(',')+' tone '+c.tone); for(const l of c.lines) console.log('  '+nm(l.speaker)+(l.to?' → '+nm(l.to):'')+' ['+l.intent+']: '+l.text); }
console.log('--- agent states');
for(const a of S.agents) console.log(a.name, a.act.type, roomAtPos(a.pos), 'E',Object.entries(a.emotions).map(([k,v])=>k[0]+k[1]+':'+(v|0)).join(' '), 'N', Object.entries(a.needs).map(([k,v])=>k[0]+':'+(v|0)).join(' '), 'know', Object.keys(a.knowledge).length);
`;
try{ eval(code); }catch(e){ console.error(e.stack); }
