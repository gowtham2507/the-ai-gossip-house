// Behaviour study: node tests/behavior.js [seed] [days] > out.json
const fs=require('fs');
const src=['01_core','02_agents','03_engine','04_life','05_decide','06_conv','07_dialogue','08_llm'].map(f=>fs.readFileSync(__dirname+'/../src/'+f+'.js','utf8')).join('\n');
const seed=+process.argv[2]||3, days=+process.argv[3]||5;
const out=new Function('seed','days',src+`
var ALL=[]; function onEventLogged(e){ ALL.push(e); }
newGame(seed);
const st={}; for(const a of S.agents) st[a.id]={lines:0,intents:{},acts:{},convs:0,cryMin:0,maxSad:0,maxAnger:0};
const allConvs=[]; const seen=new Set();
let last=S.t;
while(S.t<8*60+days*1440){ tick(0.25);
  for(const a of S.agents){ const s=st[a.id]; s.acts[a.act.type]=(s.acts[a.act.type]||0)+0.25; if(a.crying) s.cryMin+=0.25; s.maxSad=Math.max(s.maxSad,a.emotions.sadness); s.maxAnger=Math.max(s.maxAnger,a.emotions.anger); }
  for(const c of S.ended){ if(!seen.has(c.id)){ seen.add(c.id); allConvs.push(c); } }
}
for(const c of allConvs){ for(const id of c.participants) st[id].convs++; for(const l of c.lines){ const s=st[l.speaker]; s.lines++; s.intents[l.intent]=(s.intents[l.intent]||0)+1; } }
const rel={}; for(const a of S.agents){ rel[a.id]={}; for(const b of S.agents) if(a!==b) rel[a.id][b.id]={...a.rel[b.id],sharedHistory:undefined,label:relLabel(a.rel[b.id])}; }
const secrets=Object.values(S.claims).filter(c=>c.secret&&!c.parent).map(c=>({id:c.id,content:c.content,owner:c.owner,public:c.public,confidedTo:c.confidedTo,knownBy:S.agents.filter(a=>a.knowledge[c.id]).map(a=>a.id)}));
const notable=allConvs.filter(c=>c.lines.some(l=>['confront','insult','forgive','confide','reveal','game_answer','accept_love','comfort','mediate','strong_opinion','cry_out'].includes(l.intent))).slice(0,400)
  .map(c=>({t:c.startedAt,topic:c.topic,room:c.room,tone:c.tone,participants:c.participants,lines:c.lines.map(l=>({s:l.speaker,to:l.to,i:l.intent,text:l.text,v:l.volume}))}));
return {seed,days,stats:st,rel,secrets,influence:S.influence,couples:S.couples,alliances:S.alliances||[],events:ALL.map(e=>({t:e.t,type:e.type,text:e.text,ids:e.ids,imp:e.imp})),notable,convCount:allConvs.length,mem:Object.fromEntries(S.agents.map(a=>[a.id,a.memories.filter(m=>m.imp>=7).slice(0,8).map(m=>m.text)]))};`)(seed,days);
console.log(JSON.stringify(out));
