// Exports simulation time-series to JSON for the charts in docs/images: node tests/export.js [days] [seed] > out.json
const fs=require('fs');
const src=['01_core','02_agents','03_engine','04_life','05_decide','06_conv','07_dialogue','08_llm'].map(f=>fs.readFileSync(__dirname+'/../src/'+f+'.js','utf8')).join('\n');
const days=+process.argv[2]||4, seed=+process.argv[3]||3;
const out=new Function('days','seed',src+`
newGame(seed);
const ts=[], secrets=Object.keys(S.claims).filter(k=>S.claims[k].secret);
while(S.t<8*60+days*1440){ tick(0.25);
  if(Math.abs(S.t%15)<0.25){ ts.push({t:S.t, emo:Object.fromEntries(S.agents.map(a=>[a.id,{...a.emotions}])), needs:Object.fromEntries(S.agents.map(a=>[a.id,{...a.needs}])),
    know:Object.fromEntries(secrets.map(k=>[k,S.agents.filter(a=>a.knowledge[k]).length])), party:!!(S.party&&S.party.active)}); } }
const ids=S.agents.map(a=>a.id);
const rel={}; for(const f of ['trust','friendship','attraction','resentment']) rel[f]=ids.map(a=>ids.map(b=>a===b?null:S.byId[a].rel[b][f]));
const ih={}; for(const c of S.ended) for(const l of c.lines) ih[l.intent]=(ih[l.intent]||0)+1;
const ev=S.events.filter(e=>e.imp>=3).map(e=>({t:e.t,type:e.type,text:e.text})).reverse();
return {ids,names:S.agents.map(a=>a.name),colors:S.agents.map(a=>a.look.top),traits:AGENT_DEFS.map(d=>d.p),ts,rel,intents:ih,events:ev,secrets:secrets.map(k=>({id:k,content:S.claims[k].content}))};`)(days,seed);
process.stdout.write(JSON.stringify(out));
