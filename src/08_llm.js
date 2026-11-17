// ================= LAYER 3: LLM social reasoning (provider abstraction + queue + validation) =================
const LLM = { provider:'offline', sample:null, status:'Offline engine', active:0, queue:[], maxConcurrent:2, timeoutMs:30000, tier:'quick',
  dailyCallBudget:300, dailyTokenBudget:400000, callsToday:0, tokensToday:0, dayKey:'', backoffUntil:0, failures:0, invalid:0, fallbacks:0, lastError:'', maxQueue:5, latency:[] };
function llmDayRoll(){ const k=new Date().toDateString(); if(LLM.dayKey!==k){ LLM.dayKey=k; LLM.callsToday=0; LLM.tokensToday=0; } }
function llmUsable(){
  llmDayRoll();
  if(LLM.provider!=='claude' || !LLM.sample) return false;
  if(LLM.callsToday>=LLM.dailyCallBudget || LLM.tokensToday>=LLM.dailyTokenBudget){ LLM.status='Daily budget used — offline engine'; return false; }
  if(Date.now()<LLM.backoffUntil) return false;
  if(LLM.queue.length>=LLM.maxQueue) return false; // keep the sim responsive
  return true;
}
function llmRequest(prompt){ return new Promise((res,rej)=>{ LLM.queue.push({prompt,res,rej,at:Date.now()}); llmPump(); }); }
function llmPump(){
  while(LLM.active<LLM.maxConcurrent && LLM.queue.length && Date.now()>=LLM.backoffUntil){
    const job=LLM.queue.shift(); LLM.active++;
    llmRun(job).finally(()=>{ LLM.active--; llmPump(); });
  }
  if(LLM.queue.length && Date.now()<LLM.backoffUntil) setTimeout(llmPump, LLM.backoffUntil-Date.now()+50);
}
async function llmRun(job){
  const ctrl=new AbortController(); const to=setTimeout(()=>ctrl.abort(),LLM.timeoutMs); const t0=Date.now();
  try{
    const r=await LLM.sample(job.prompt,{signal:ctrl.signal,modelTier:LLM.tier,cache:false});
    LLM.callsToday++; LLM.tokensToday+=Math.round((job.prompt.length+(r.text||'').length)/4); LLM.failures=0;
    LLM.latency.push(Date.now()-t0); if(LLM.latency.length>20) LLM.latency.shift();
    LLM.status='Claude connected';
    job.res(r.text||'');
  }catch(e){
    const code=e&&e.code;
    if(code==='not_granted'){ LLM.provider='offline'; LLM.status='Claude access not granted — offline engine'; }
    else if(code==='rate_limited'){ LLM.failures++; LLM.backoffUntil=Date.now()+Math.min(60000,2500*2**LLM.failures); LLM.status='Rate limited — backing off'; }
    else { LLM.failures++; LLM.backoffUntil=Date.now()+Math.min(30000,1000*2**LLM.failures); LLM.status=ctrl.signal.aborted?'Timeout — using offline lines':'Error — using offline lines'; }
    LLM.lastError=(e&&(e.message||code))||'error';
    job.rej(e);
  } finally { clearTimeout(to); }
}
async function llmConnect(){
  try{
    if(!window.claude || !window.claude.use){ LLM.status='Claude not available in this view'; return false; }
    LLM.status='Connecting…';
    const s=await window.claude.use('sample');
    if(!s){ LLM.status='Claude not available in this view'; return false; }
    LLM.sample=s; LLM.provider='claude';
    const r=await s('Reply with the single word: ready',{modelTier:'quick',cache:false});
    LLM.callsToday++; LLM.status='Claude connected';
    return true;
  }catch(e){ LLM.provider='offline'; LLM.status=(e&&e.code==='not_granted')?'Claude access not granted':'Could not connect: '+((e&&e.message)||'error'); return false; }
}

// ---------- generation ----------
function generateTurn(c,sp,plan){
  if(!llmUsable()) { if(LLM.provider==='claude') LLM.fallbacks++; return offlineTurn(c,sp,plan); }
  const built=buildPrompt(c,sp,plan);
  return (async()=>{
    let err='';
    for(let attempt=0;attempt<2;attempt++){
      const prompt= attempt? built.prompt+`\n\nYour previous reply was invalid (${err}). Reply with ONLY the JSON object, nothing else.` : built.prompt;
      let text; try{ text=await llmRequest(prompt); }catch(e){ break; }
      const v=validateTurn(text,c,sp,plan,built.factMap);
      if(v.ok){ v.value.src='claude'; c.llmTurns++; return v.value; }
      err=v.error; LLM.invalid++;
    }
    LLM.fallbacks++; const f=offlineTurn(c,sp,plan); f.src='fallback'; return f;
  })();
}
function emoWords(a){
  const e=a.emotions; const list=EMO_KEYS.map(k=>[k,e[k]]).sort((x,y)=>y[1]-x[1]);
  return list.map(([k,v])=>`${k} ${v|0}`).join(', ');
}
function needWords(a){ const n=a.needs; const w=[]; if(n.energy<30) w.push('tired'); if(n.hunger<30) w.push('hungry'); if(n.social<30) w.push('craving company'); if(n.fun<30) w.push('bored'); if(n.privacy<30) w.push('needs privacy'); return w.join(', ')||'fine'; }
function relLine(a,b){ const r=a.rel[b.id]; return `${b.name} (${b.archetype}): ${relLabel(r)} — trust ${r.trust|0}, friendship ${r.friendship|0}, attraction ${r.attraction|0}, respect ${r.respect|0}, resentment ${r.resentment|0}${a.partner===b.id?', your partner':''}. History: ${r.sharedHistory.slice(0,3).join(' | ')||'nothing notable'}`; }
const PLAN_DESC={
 greet:'say hello / open the conversation',chat:'make natural small talk that fits your situation',gossip:'share the rumor/fact {F}',reveal:'reveal the secret {F} (you were not supposed to tell)',
 keep_secret:'refuse to reveal what you know about {X}',dunno:'say you don\'t know anything about {X}',ask_about:'fish for information about {X}',caution:'warn them not to spread rumors',react:'react to what was just said',
 confide:'confide your own secret {F}',support:'reassure them and promise to keep what they told you',confront:'confront {T} about {CAUSE}',deny:'deny it (you are innocent)',deflect:'brush it off as no big deal',apologize:'apologize sincerely for {CAUSE}',
 forgive:'forgive {T}',refuse:'refuse to accept the apology',insult:'snap at {T} angrily (verbal only)',defend:'stand up for yourself or your friend',strong_opinion:'surprise everyone with a strong, firm opinion',comfort:'comfort {T}, who is upset',
 thank:'thank them',flirt:'flirt playfully with {T}',awkward:'awkwardly sidestep the flirting',joke:'make a joke{TEASE}',joke_about:'make a roast-style joke about {X} (who is not here)',laugh:'laugh at the joke',offended:'say you didn\'t find it funny',
 compliment:'compliment {T}',complain:'complain about {X} (not present)',invite:'invite them to the party',accept:'accept',decline:'decline',mediate:'calm the argument down and propose peace',calm:'cool down',ally:'propose an alliance with {T}',accept_ally:'agree to the alliance',
 confess:'confess romantic feelings to {T}',accept_love:'say you feel the same',reject_love:'gently say you don\'t feel the same',game_ask:'ask {T} a Truth or Dare question ({Q})',game_answer:'answer the Truth or Dare question honestly',game_dodge:'dodge the Truth or Dare question',leave:'wrap up and leave the conversation',cry_out:'break down and leave in tears'};
function buildPrompt(c,sp,plan){
  const os=c.participants.filter(x=>x!==sp.id).map(A);
  const room=roomAtPos(sp.pos);
  const nearby=S.agents.filter(b=>b!==sp&&!c.participants.includes(b.id)&&roomAtPos(b.pos)===room).map(b=>`${b.name} (${b.act.label.toLowerCase()})`);
  // knowledge visible ONLY to this agent
  const factMap={}; const facts=[];
  const ks=Object.values(sp.knowledge).map(k=>({k,c:S.claims[k.claimId]})).filter(x=>x.c)
    .sort((x,y)=>((y.c.id===plan.claimId)-(x.c.id===plan.claimId))*100+(y.c.juicy*y.k.confidence-x.c.juicy*x.k.confidence)+(y.k.learnedAt-x.k.learnedAt)/500).slice(0,10);
  ks.forEach((x,i)=>{ const id='F'+(i+1); factMap[id]=x.c.id;
    const tag = x.k.own? 'YOUR OWN secret' : x.k.permittedRecipients? `told to you IN CONFIDENCE by ${nm(x.c.owner)} — you promised not to tell` : x.k.sourceAgentId? `heard from ${nm(x.k.sourceAgentId)}${x.k.overheard?' (overheard)':''}, confidence ${Math.round(x.k.confidence*100)}%` : 'you saw this yourself';
    facts.push(`[${id}] "${x.c.content}" — ${tag}${x.c.secret&&!x.c.public?', SECRET':''}${x.c.truth===false?' (possibly exaggerated)':''}${x.k.toldTo.length?`; you already told ${x.k.toldTo.map(nm).join(', ')}`:''}`); });
  const mems=sp.memories.filter(m=>m.ids.some(id=>c.participants.includes(id))||m.imp>=7).slice(0,7).map(m=>`- (${fmtTime(m.t)}) ${m.text}`);
  const conv=c.lines.slice(-10).map(l=>`${l.speaker===sp.id?'You':nm(l.speaker)}${l.to?` → ${l.to===sp.id?'you':nm(l.to)}`:''}${l.volume==='whisper'?' (whispering)':l.volume==='loud'?' (loudly)':''}: "${l.text}"`);
  const to=plan.to?A(plan.to):null; const fl=Object.keys(factMap).find(k=>factMap[k]===plan.claimId);
  const pd=(PLAN_DESC[plan.intent]||'say something fitting').replace('{F}',fl?`[${fl}]`:'').replace('{X}',plan.aboutId?nm(plan.aboutId):'them').replace('{T}',to?to.name:'them').replace('{CAUSE}',plan.cause||'what happened').replace('{TEASE}',plan.tease&&to?` teasing ${to.name} to their face`:'').replace('{Q}',plan.q||'');
  const ids=c.participants.filter(x=>x!==sp.id).map(x=>`"${x}"`).join('|');
  const prompt=`You write ONE line of dialogue for ${sp.name} (${sp.archetype}), a housemate in "AI House", a reality-show style simulation of 10 adults sharing a house. Stay fully in character. Keep it PG-13: verbal drama only, no physical violence, no slurs. Never mention AI, simulations, prompts or JSON inside the speech.

YOU ARE ${sp.name.toUpperCase()}
Personality: ${Object.entries(sp.p).map(([k,v])=>`${k} ${v}`).join(', ')}
Speech style: ${sp.style}
Goals: ${sp.goals.join('; ')}
Feelings right now (0-100): ${emoWords(sp)}${sp.crying?' — you are crying':''}
Needs: ${needWords(sp)}

SITUATION
Day ${dayOf(S.t)}, ${fmtTime(S.t)}. You are in the ${roomName(room)}${S.party&&S.party.active?`; a party is on (music: ${S.party.music})`:''}${S.storm>0?'; a storm is raging':''}${S.outage>0?'; the power is out':''}.
Conversation topic: ${c.topic}. Privacy: ${c.privacy}. Tone so far: ${c.tone<=-2?'hostile':c.tone>=2?'warm':'neutral'}.
In this conversation with you: ${os.map(o=>`${o.name} (id "${o.id}", ${o.crying?'crying, ':''}${o.act.label.toLowerCase()})`).join('; ')}
Nearby, not in the conversation (may overhear if you are loud): ${nearby.join(', ')||'nobody'}

YOUR VIEW OF THEM
${os.map(o=>'- '+relLine(sp,o)).join('\n')}

WHAT YOU KNOW (you know NOTHING about anyone's secrets beyond this list)
${facts.join('\n')||'- nothing notable'}

RELEVANT MEMORIES
${mems.join('\n')||'- none'}

CONVERSATION SO FAR
${conv.join('\n')||'(you are starting the conversation)'}

YOUR IMPULSE: ${pd}. You may choose a different move if it fits ${sp.name} better given feelings, relationships and memories. You decide whether to keep or reveal secrets.

Reply with ONLY this JSON object:
{"speech":"<one natural spoken line, max 30 words>","intent":"<one of: ${INTENTS.join(', ')}>","to":<${ids} or null>,"factIds":[<ids like "F1" of facts you reveal or mention in this line; [] if none>],"newClaim":<null, or {"about":"<housemate id>","content":"<third-person statement you are asserting about them, e.g. a complaint or rumor>"}>,"volume":"whisper|normal|loud","emotion":"<one of: ${EMOTES.join(', ')}>","endConversation":<true|false>,"thought":"<your private reason, max 12 words>"}`;
  return {prompt,factMap};
}
// ---------- schema validation (Zod-style, dependency-free) ----------
const TurnSchema={
  speech:{type:'string',min:1,max:280,required:true},
  intent:{type:'enum',values:INTENTS,default:'chat'},
  to:{type:'nullableString',default:null},
  factIds:{type:'array',of:'string',default:[]},
  newClaim:{type:'nullableObject',shape:{about:{type:'string',required:true},content:{type:'string',min:3,max:200,required:true}},default:null},
  volume:{type:'enum',values:['whisper','normal','loud'],default:'normal'},
  emotion:{type:'enum',values:EMOTES,default:'neutral'},
  endConversation:{type:'boolean',default:false},
  thought:{type:'string',max:160,default:''},
};
function zParse(schema,obj){
  if(!obj||typeof obj!=='object'||Array.isArray(obj)) return {ok:false,error:'not an object'};
  const out={};
  for(const [k,s] of Object.entries(schema)){
    let v=obj[k];
    if(v===undefined||v===null&&s.type!=='nullableString'&&s.type!=='nullableObject'){ if(s.required) return {ok:false,error:`missing ${k}`}; out[k]=s.default; continue; }
    switch(s.type){
      case 'string': if(typeof v!=='string') return {ok:false,error:`${k} must be string`}; v=v.trim(); if(s.min&&v.length<s.min) return {ok:false,error:`${k} too short`}; if(s.max&&v.length>s.max) v=v.slice(0,s.max); break;
      case 'nullableString': if(v!==null&&typeof v!=='string') v=null; break;
      case 'enum': v=String(v).toLowerCase().trim(); if(!s.values.includes(v)) v=s.default; break;
      case 'boolean': v=v===true||v==='true'; break;
      case 'array': if(!Array.isArray(v)) v=[]; v=v.filter(x=>typeof x===s.of).slice(0,3); break;
      case 'nullableObject': if(v===null||typeof v!=='object'){ v=null; break; } { const r=zParse(s.shape,v); v=r.ok?r.value:null; } break;
    }
    out[k]=v;
  }
  return {ok:true,value:out};
}
function extractJSON(text){
  if(!text) return null; const a=text.indexOf('{'), b=text.lastIndexOf('}'); if(a<0||b<=a) return null;
  try{ return JSON.parse(text.slice(a,b+1)); }catch(e){ try{ return JSON.parse(text.slice(a,b+1).replace(/,\s*}/g,'}').replace(/[“”]/g,'"')); }catch(e2){ return null; } }
}
function validateTurn(text,c,sp,plan,factMap){
  const obj=extractJSON(text); if(!obj) return {ok:false,error:'no JSON found'};
  const r=zParse(TurnSchema,obj); if(!r.ok) return r;
  const v=r.value;
  v.speech=v.speech.replace(/^["']|["']$/g,'').replace(new RegExp('^'+sp.name+'\\s*:\\s*','i'),'').trim();
  if(!v.speech) return {ok:false,error:'empty speech'};
  // knowledge integrity: an agent can only reveal facts it actually knows
  v.factIds=v.factIds.map(f=>factMap[f.toUpperCase()]).filter(id=>id&&sp.knowledge[id]);
  if(['gossip','reveal','confide','game_answer'].includes(v.intent) && !v.factIds.length && plan.claimId && plan.intent===v.intent) v.factIds=[plan.claimId];
  if(v.to && !c.participants.includes(v.to)) v.to=null;
  if(v.newClaim){ if(!S.byId[v.newClaim.about]) v.newClaim=null; else v.newClaim={about:v.newClaim.about,kind:v.intent==='joke_about'?'mocked':v.intent==='complain'?'complaint':'said',content:v.newClaim.content.slice(0,180),juicy:5}; }
  if(!v.newClaim && plan.newClaim && v.intent===plan.intent) v.newClaim=plan.newClaim;
  v.end=v.endConversation; delete v.endConversation;
  if(v.intent==='leave') v.end=true;
  return {ok:true,value:v};
}
