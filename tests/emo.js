const fs=require('fs');
const src=['01_core','02_agents','03_engine','04_life','05_decide','06_conv','07_dialogue','08_llm'].map(f=>fs.readFileSync(__dirname+'/../src/'+f+'.js','utf8')).join('\n');
eval(src+`
newGame(+process.argv[2]||3); const mx={};
while(S.t<8*60+4*1440){ tick(0.25); for(const a of S.agents){ const m=mx[a.id]||(mx[a.id]={}); for(const k of ['sadness','anger','embarrassment','jealousy']) m[k]=Math.max(m[k]||0,a.emotions[k]|0);} }
console.log(JSON.stringify(mx));
const ih={}; for(const e of S.events) if(e.type==='conflict') console.log(fmtTime(e.t),e.text);
`);
