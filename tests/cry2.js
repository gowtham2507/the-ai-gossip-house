const fs=require('fs');
const src=['01_core','02_agents','03_engine','04_life','05_decide','06_conv','07_dialogue','08_llm'].map(f=>fs.readFileSync(__dirname+'/../src/'+f+'.js','utf8')).join('\n');
eval(src+`
newGame(9);
while(S.t<14*60 || A('luna').act.type==='sleep'){ tick(0.25); }
const l=A('luna'); feel(l,{sadness:50},'test: bad news');
console.log('luna crying',l.crying, roomAtPos(l.pos), 'witnesses w/ comfort intent:', S.agents.filter(a=>a.intentions.some(x=>x.type==='comfort')).map(a=>a.name));
for(let i=0;i<400;i++){ tick(0.25); }
for(const e of S.events.filter(e=>e.ids.includes('luna')).slice(0,12).reverse()) console.log(fmtTime(e.t),e.type,e.text);
`);
