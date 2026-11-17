const fs=require('fs');
const src=['01_core','02_agents','03_engine','04_life','05_decide','06_conv','07_dialogue','08_llm'].map(f=>fs.readFileSync(__dirname+'/../src/'+f+'.js','utf8')).join('\n');
eval(src+`
newGame(42);
const C=S.claims.c_mia_crush; let was=false;
while(S.t<8*60+3*1440){ tick(0.25); if(C.public&&!was){was=true; console.log('public at',dayOf(S.t),fmtTime(S.t)); for(const c of S.convs.concat(S.ended.slice(0,3))) for(const l of c.lines) if(l.claimIds.includes('c_mia_crush')) console.log(c.purpose,nm(l.speaker),l.intent,l.text);} }
console.log('confided', C.confidedTo);
for(const a of S.agents){ const k=a.knowledge.c_mia_crush; if(k) console.log(a.name,'from',k.sourceAgentId,'perm',k.permittedRecipients,'told',k.toldTo.join(','),'ovh',k.overheard); }
`);
