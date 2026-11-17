// Multi-seed statistics: node tests/stats.js [days] [seeds]
const fs=require('fs');
const src=['01_core','02_agents','03_engine','04_life','05_decide','06_conv','07_dialogue','08_llm'].map(f=>fs.readFileSync(__dirname+'/../src/'+f+'.js','utf8')).join('\n');
const days=+process.argv[2]||4, seeds=+process.argv[3]||10;
const fn=new Function('days','seed',src+`
newGame(seed); const t0=Date.now();
while(S.t<8*60+days*1440) tick(0.25);
const c={}; for(const e of S.events) c[e.type]=(c[e.type]||0)+1;
return {ms:Date.now()-t0, counts:c, couples:S.couples.length, claims:Object.keys(S.claims).length};`);
const agg={}; let ms=0, couples=0, claims=0;
for(let s=1;s<=seeds;s++){ const r=fn(days,s*97); ms+=r.ms; couples+=r.couples; claims+=r.claims; for(const k in r.counts){ (agg[k]=agg[k]||[]).push(r.counts[k]); } }
console.log(`${seeds} seeds x ${days} days | avg runtime ${(ms/seeds).toFixed(0)} ms | avg couples ${(couples/seeds).toFixed(2)} | avg claims ${(claims/seeds).toFixed(0)}`);
console.log('| Event type | Avg per run | Runs where it occurred |\n|---|---|---|');
for(const [k,v] of Object.entries(agg).sort((a,b)=>b[1].reduce((x,y)=>x+y)-a[1].reduce((x,y)=>x+y))) console.log(`| ${k} | ${(v.reduce((x,y)=>x+y)/seeds).toFixed(1)} | ${v.length}/${seeds} |`);
