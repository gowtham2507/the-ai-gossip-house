// ================= MULTI-AGENT CONVERSATION MANAGER =================
const INTENTS=['chat','greet','gossip','reveal','keep_secret','dunno','ask_about','caution','react','confide','support','confront','deny','deflect','apologize','forgive','refuse','insult','defend','comfort','thank','flirt','awkward','joke','joke_about','laugh','offended','compliment','complain','invite','accept','decline','mediate','calm','ally','accept_ally','confess','accept_love','reject_love','game_ask','game_answer','game_dodge','leave','cry_out','strong_opinion'];
const HOSTILE=new Set(['confront','insult','offended','refuse','defend','deflect','cry_out','strong_opinion']);
const EMOTES=['neutral','happy','sad','angry','nervous','laughing','flirty','crying','shocked','excited'];

function chooseSpeaker(c){
  const ps=c.participants.map(A);
  const last=c.lines[c.lines.length-1];
  if(c.turns===0) return A(c.initiator);
  if(last && last.to && last.to!==last.speaker && c.participants.includes(last.to) && chance(0.85)) return A(last.to);
  if(c.flags.mediator && !c.flags.mediated){ c.flags.mediated=true; return A(c.flags.mediator); }
  if(c.flags.interrupter && !c.flags.interrupted){ c.flags.interrupted=true; return A(c.flags.interrupter); }
  const cand=ps.filter(p=>p.id!==c.lastSpeaker);
  return weightedPick(cand.map(p=>({p,score:p.p.extraversion*0.5+p.emotions.anger*0.3+p.emotions.excitement*0.2})),18).p;
}
function convTick(c){
  // integrity: participants must still be valid
  for(const id of [...c.participants]){ const p=A(id); if(p.convId!==c.id || p.act.type==='sleep'){ c.participants=c.participants.filter(x=>x!==id); } }
  if(c.participants.length<2){ endConversation(c,'ran out of people'); return; }
  if(S.t-c.lastActivity>25 && !c.busy){ endConversation(c,'fizzled out'); return; }
  if(c.busy || S.t<c.nextAt) return;
  const sp=chooseSpeaker(c);
  const plan=planTurn(sp,c);
  c.busy=true; c.pendingSpeaker=sp.id;
  const out=generateTurn(c,sp,plan);
  const finish=(res)=>{ if(!c.active){ return; } c.busy=false; c.pendingSpeaker=null; applyTurn(c,sp,plan,res); };
  if(out && typeof out.then==='function') out.then(finish).catch(err=>{ finish(offlineTurn(c,sp,plan)); });
  else finish(out);
}
function applyTurn(c,sp,plan,res){
  if(!c.participants.includes(sp.id)) return;
  res.to = res.to && c.participants.includes(res.to) && res.to!==sp.id ? res.to : (plan.to && c.participants.includes(plan.to)?plan.to: (c.participants.length===2? c.participants.find(x=>x!==sp.id):null));
  const line={t:S.t,speaker:sp.id,text:res.speech,intent:res.intent,to:res.to,volume:res.volume,emotion:res.emotion,claimIds:res.factIds||[],src:res.src||'offline',thought:res.thought||'',aboutId:plan.aboutId||null,claimId:plan.claimId||null,cause:plan.cause||null,q:plan.q||null};
  c.lines.push(line); c.turns++; c.lastSpeaker=sp.id; c.lastActivity=S.t;
  if(c.lines.length>60) c.lines.splice(0,c.lines.length-60);
  sp.bubble={text:res.speech,until:S.t+1.6+res.speech.length/28,volume:res.volume,intent:res.intent};
  if(res.thought) sp.reason=`💭 ${res.thought}`;
  setEmote(sp,res.emotion);
  if(res.to){ const t=A(res.to); if(!(sp.seated&&sp.spot)){ const dx=t.pos.x-sp.pos.x, dy=t.pos.y-sp.pos.y; if(Math.abs(dx)+Math.abs(dy)>0.1) sp.face=Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up'); } }
  // who hears this line?
  const hearers=[];
  for(const b of S.agents){ if(b===sp) continue;
    if(c.participants.includes(b.id)) hearers.push({b,clarity:1,direct:true});
    else { const cl=hearClarity(b,sp,res.volume); if(cl>0.12) hearers.push({b,clarity:cl,direct:false}); } }
  line.overheardBy=hearers.filter(h=>!h.direct).map(h=>h.b.id);
  // engine-created claims (talking behind backs etc.)
  if(res.newClaim){ const nc=res.newClaim; const id=makeClaim({about:nc.about,kind:nc.kind||'said',content:nc.content,origin:sp.id,juicy:nc.juicy||5,truth:nc.truth!==false,secret:false});
    sp.knowledge[id]=mkKnow(id,null,1,{}); res.factIds=(res.factIds||[]).concat(id); line.claimIds=res.factIds; }
  // information transfer with provenance
  for(const cid of (res.factIds||[])){
    const claim=S.claims[cid]; if(!claim) continue;
    const confiding = res.intent==='confide' || (res.intent==='game_answer' && claim.owner===sp.id);
    if(res.intent==='game_answer' && claim.owner===sp.id){ claim.public=true; logEvent('confession',`🎲 ${sp.name} confessed during Truth or Dare: "${claim.content}".`,[sp.id,...c.participants],5,{convId:c.id}); }
    else if(res.intent==='confide'){ for(const h of hearers) if(h.direct && !claim.confidedTo.includes(h.b.id)) claim.confidedTo.push(h.b.id); logEvent('secret',`${sp.name} confided a secret to ${hearers.filter(h=>h.direct).map(h=>h.b.name).join(', ')}.`,[sp.id,...hearers.filter(h=>h.direct).map(h=>h.b.id)],3,{convId:c.id}); }
    else if(claim.secret && !claim.public && claim.owner!==sp.id){
      const k=sp.knowledge[cid];
      const betrayal = k && k.permittedRecipients && k.permittedRecipients.includes(sp.id);
      logEvent('leak',`${sp.name} ${betrayal?'broke a promise and revealed':'spread'} ${nm(claim.owner)}'s secret to ${hearers.filter(h=>h.direct).map(h=>h.b.name).join(', ')||'no one'}.`,[sp.id,claim.owner,...hearers.filter(h=>h.direct).map(h=>h.b.id)],betrayal?5:4,{convId:c.id});
      if(betrayal){ sp.guilt[claim.owner]=`telling people ${claim.owner===claim.about?'their':'a'} secret`; addMemory(sp,`I told ${hearers.filter(h=>h.direct).map(h=>h.b.name).join(', ')} what ${nm(claim.owner)} trusted me with. I shouldn't have.`,8,[claim.owner],'guilt'); feel(sp,{stress:8,embarrassment:4}); }
    } else if(res.intent==='gossip'||res.intent==='reveal'){
      logEvent('gossip',`${sp.name} shared ${claim.kind==='mocked'?'a joke':'a rumor'} with ${hearers.filter(h=>h.direct).map(h=>h.b.name).join(', ')}: "${claim.content}".`,[sp.id,claim.about,...hearers.filter(h=>h.direct).map(h=>h.b.id)],2,{convId:c.id});
    }
    for(const h of hearers){
      learnClaim(h.b,cid,sp.id,h.clarity,{overheard:!h.direct,permitted:confiding&&res.intent==='confide'&&h.direct?[h.b.id]:null,citedSource:plan.citeSource});
      if(!h.direct && claim.secret && !claim.public && h.clarity>0.3) { logEvent('overheard',`${h.b.name} overheard ${sp.name} ${res.intent==='confide'?'confiding':'talking'}: "${claim.content}".`,[h.b.id,sp.id],3); }
    }
  }
  applyEffects(c,sp,res,hearers,plan);
  // turn pacing (simulation clock) & ending
  c.nextAt=S.t+0.7+res.speech.length/42;
  if(res.intent==='leave' || res.intent==='cry_out'){ leaveConv(c,sp,res); return; }
  if(res.end || c.turns>=c.maxTurns){ c.nextAt=S.t+1.2+res.speech.length/40; c.endingAt=c.nextAt; endConversationSoon(c); }
}
function endConversationSoon(c){ c.flags.ending=true; setTimeoutSim(c.nextAt,()=>{ if(c.active) endConversation(c,'ended naturally'); }); }
const SIM_TIMERS=[];
function setTimeoutSim(at,fn){ SIM_TIMERS.push({at,fn}); }
function runSimTimers(){ for(let i=SIM_TIMERS.length-1;i>=0;i--){ if(S.t>=SIM_TIMERS[i].at){ const f=SIM_TIMERS[i].fn; SIM_TIMERS.splice(i,1); f(); } } }
function leaveConv(c,sp,res){
  const hostile=c.tone<=-2;
  leaveConversation(c,sp,hostile?'stormed off':'left');
  if(hostile){
    for(const id of c.participants) sp.avoid[id]=S.t+rr(40,120);
    logEvent('conflict',`${sp.name} ${res.intent==='cry_out'?'ran off in tears':'stormed off'} from ${c.participants.map(nm).join(' & ')||'the argument'}.`,[sp.id,...c.participants],4,{convId:c.id});
    const dest=['bed','cornerseat','rail','bench']; const s=res.intent==='cry_out'?World.spots.find(s=>s.kind==='bed'&&s.owner===sp.id):findSpot(sp,dest,{noise:10});
    goDo(sp,res.intent==='cry_out'?'cry':'solitude',s,{label:res.intent==='cry_out'?'Crying alone':'Cooling off alone',walkLabel:'Storming off'});
    sp.face=pick(['left','right']);
  }
}
function setEmote(a,em){
  if(em==='laughing') a.laughUntil=S.t+2.5;
  if(em==='shocked') a.shockUntil=S.t+2;
  if(em==='flirty') a.flirtUntil=S.t+3;
  if(em==='crying' && !a.crying && a.emotions.sadness>45) startCrying(a,a.lastFeelCause||'it all got to be too much');
}
function endConversation(c,why){
  if(!c.active) return; c.active=false; c.endedAt=S.t; c.endReason=why;
  const intents=new Set(c.lines.map(l=>l.intent));
  const big=['confront','insult','confide','forgive','reveal','confess','accept_love','reject_love','game_answer','ally','apologize','comfort'].filter(x=>intents.has(x));
  const imp=big.length?7:3;
  for(const id of c.participants){
    const p=A(id); if(!p) continue;
    const with_=c.participants.filter(x=>x!==id).map(nm).join(' & ')||'someone';
    addMemory(p,`${c.tone<=-3?'Had a tense conversation':'Talked'} with ${with_} in the ${roomName(c.room)} (${c.topic}${big.length?': '+big.join(', '):''}).`,imp,c.participants.filter(x=>x!==id),'conversation');
    p.needs.social=clamp(p.needs.social+c.turns*2.5);
    if(p.convId===c.id){ p.convId=null; setIdle(p); }
  }
  S.ended.unshift(c); if(S.ended.length>60) S.ended.length=60;
}

// ---------- social consequences of a line (deterministic, explainable) ----------
function applyEffects(c,sp,res,hearers,plan){
  const to=res.to?A(res.to):null;
  const direct=hearers.filter(h=>h.direct).map(h=>h.b);
  const audience=hearers.filter(h=>h.clarity>0.3).map(h=>h.b);
  const isPublic=direct.length>1 || hearers.some(h=>!h.direct&&h.clarity>0.3);
  const i=res.intent;
  if(HOSTILE.has(i)) c.tone-= (i==='insult'?2:1);
  if(['forgive','thank','support','comfort','laugh','compliment','accept','accept_ally','accept_love','calm','mediate'].includes(i)) c.tone+=1;
  switch(i){
    case 'chat': case 'greet': case 'react': case 'dunno':
      for(const b of direct){ relChange(b,sp.id,{familiarity:1.5,friendship:0.7},'friendly chat',false); relChange(sp,b.id,{familiarity:1.5,friendship:0.7},'friendly chat',false); }
      feel(sp,{loneliness:-3,happiness:1}); break;
    case 'compliment': if(to){ feel(to,{happiness:9,affection:5,loneliness:-3},`${sp.name}'s compliment`); relChange(to,sp.id,{friendship:4,respect:2},'got a compliment'); } break;
    case 'joke': {
      res.offended=[];
      for(const b of direct){
        const teased = to===b && plan.tease;
        const offendP = teased ? ((b.p.misread||25)/100*0.65 + (100-b.p.humor)/260 + b.emotions.anger/220) : 0.03;
        if(chance(offendP)){ res.offended.push(b.id); feel(b,{anger:12,embarrassment:isPublic?10:4},`${sp.name}'s joke at their expense`); relChange(b,sp.id,{resentment:8,friendship:-3},`didn't like ${sp.name}'s joke`); sp.guilt[b.id]='that joke'; }
        else if(chance(0.25+b.p.humor/180)){ b.laughUntil=S.t+2.5; feel(b,{happiness:6,stress:-3}); relChange(b,sp.id,{friendship:2.5},'made them laugh',false); }
      }
      c.lines[c.lines.length-1].offended=res.offended; break; }
    case 'joke_about': for(const b of direct){ if(b.rel[plan.aboutId||'']&&b.rel[plan.aboutId].friendship>65){ relChange(b,sp.id,{respect:-3},`joked about ${nm(plan.aboutId)}`,false); } else { b.laughUntil=S.t+2.5; feel(b,{happiness:4}); } } break;
    case 'laugh': sp.laughUntil=S.t+2.5; feel(sp,{happiness:5,stress:-3}); if(to) relChange(sp,to.id,{friendship:1.5},'laughed together',false); break;
    case 'offended': if(to){ feel(to,{embarrassment:6,stress:4},`${sp.name} got offended`); relChange(sp,to.id,{resentment:4},'offended',false); } break;
    case 'caution': if(to){ relChange(to,sp.id,{respect:2},'gave a sensible warning',false); } break;
    case 'keep_secret': {
      const ownerId=plan.ownerId; if(to){ feel(to,{stress:2}); relChange(to,sp.id,{respect:2},'kept a secret',false); }
      if(ownerId){ addMemory(sp,`${to?to.name:'Someone'} asked me about ${nm(ownerId)}. I kept their secret.`,5,[ownerId],'loyal'); const owner=A(ownerId); if(owner && hearers.some(h=>h.b===owner)){ relChange(owner,sp.id,{trust:10,friendship:5},'kept their secret'); } }
      break; }
    case 'confide': for(const b of direct){ relChange(b,sp.id,{trust:5,friendship:4,familiarity:4},'confided in them'); relChange(sp,b.id,{trust:4,friendship:3},'opened up to them',false); } feel(sp,{loneliness:-12,stress:-6,happiness:4}); break;
    case 'support': if(to){ feel(to,{sadness:-8,loneliness:-8,affection:6},`${sp.name}'s support`); relChange(to,sp.id,{trust:5,friendship:5},'was supportive'); } break;
    case 'confront': if(to){ feel(to,{anger:8,fear:6,embarrassment:isPublic?10:4,stress:8},`${sp.name} confronted them`); relChange(to,sp.id,{resentment:5},'was confronted',false); dropIntention(sp,'confront',to.id); if(!c.flags.confrontLogged){ c.flags.confrontLogged=1; logEvent('conflict',`${sp.name} confronted ${to.name}${plan.cause?` about ${plan.cause}`:''}.`,[sp.id,to.id],4,{convId:c.id}); } } break;
    case 'deny': if(to){ c.flags.denied=true; } break;
    case 'deflect': if(to){ feel(to,{anger:5},`${sp.name} brushed it off`); } break;
    case 'apologize': if(to){ c.flags.apologized=sp.id; delete sp.guilt[to.id]; dropIntention(sp,'apologize',to.id); feel(sp,{stress:-6}); relChange(to,sp.id,{resentment:-5},'apologized',false); } break;
    case 'forgive': if(to){ relChange(sp,to.id,{resentment:-26,trust:10,friendship:6},`forgave ${to.name}`); relChange(to,sp.id,{friendship:6,trust:4},'was forgiven'); feel(to,{happiness:12,stress:-10,sadness:-6},'being forgiven'); feel(sp,{anger:-15,stress:-8,happiness:6}); dropIntention(sp,'confront',to.id); logEvent('reconcile',`🤝 ${sp.name} forgave ${to.name}.`,[sp.id,to.id],4,{convId:c.id}); } break;
    case 'refuse': if(to){ feel(to,{sadness:14,embarrassment:6},`${sp.name} refused their apology`); relChange(to,sp.id,{friendship:-3},'apology refused',false); logEvent('conflict',`${sp.name} refused to accept ${to.name}'s apology.`,[sp.id,to.id],3,{convId:c.id}); } break;
    case 'insult': if(to){ feel(to,{anger:14,embarrassment:isPublic?12:5,sadness:16,stress:8},`${sp.name} insulted them${isPublic?' in front of everyone':''}`); relChange(to,sp.id,{resentment:14,friendship:-8,trust:-6},`${sp.name} insulted them`); sp.guilt[to.id]='what I said to them'; addIntention(sp,{type:'apologize',target:to.id,cause:'what I said in our argument',urg:22+sp.p.agreeableness*0.45}); for(const b of audience) if(b!==to) relChange(b,sp.id,{respect:-4},`insulted ${to.name}`,false); reactWitnesses(c,sp,to,hearers); } break;
    case 'defend': case 'strong_opinion': if(to){ feel(to,{embarrassment:6},`${sp.name} stood up to them`); for(const b of audience) relChange(b,sp.id,{respect:4},'took a stand',false); if(i==='strong_opinion') logEvent('surprise',`${sp.name} surprised everyone with a strong opinion.`,[sp.id,to.id],3,{convId:c.id}); } break;
    case 'comfort': if(to){ feel(to,{sadness:-18,loneliness:-10,stress:-8,affection:6},`${sp.name} comforted them`); relChange(to,sp.id,{trust:6,friendship:7},'comforted them'); relChange(sp,to.id,{friendship:3},'comforted them',false); sp.helpCount++; dropIntention(sp,'comfort',to.id);
      if(to.crying && to.emotions.sadness<cryThr(to)+6){ to.crying=false; logEvent('mood',`${to.name} stopped crying.`,[to.id],1); } logEvent('comfort',`${sp.name} comforted ${to.name}.`,[sp.id,to.id],3,{convId:c.id});
      if(sp.id==='ethan'||sp.p.empathy>85){ feel(sp,{stress:3+sp.helpCount*1.5}); if(sp.helpCount>=3){ relChange(sp,to.id,{resentment:2},'another person to fix',false); addMemory(sp,`Comforted ${to.name}. That's the ${sp.helpCount}th time today I've been everyone's fixer.`,5,[to.id],'tired'); } } } break;
    case 'thank': if(to){ relChange(sp,to.id,{friendship:3},'grateful',false); feel(to,{happiness:4}); } break;
    case 'flirt': if(to){ const r=to.rel[sp.id]; sp.flirtUntil=S.t+3;
      if(r.attraction>42){ feel(to,{happiness:7,excitement:8,embarrassment:3},`${sp.name} flirted with them`); relChange(to,sp.id,{attraction:5,friendship:2},'flirted with them'); to.flirtUntil=S.t+3; }
      else { feel(to,{embarrassment:7},`${sp.name}'s awkward flirting`); relChange(to,sp.id,{attraction:1},'flirted with them',false); }
      relChange(sp,to.id,{attraction:2},'flirted with them',false);
      flirtWitnesses(c,sp,to,hearers); } break;
    case 'awkward': if(to){ feel(to,{embarrassment:10,sadness:5},`${sp.name} didn't flirt back`); relChange(to,sp.id,{attraction:-3},'flirt not returned',false); } break;
    case 'complain': break;
    case 'invite': for(const b of direct){ b.cd.partyBoost=S.t; } break;
    case 'accept': if(to) relChange(sp,to.id,{friendship:2},'said yes',false); if(S.party&&S.party.active){ sp.cd.partyBoost=S.t; sp.cd.inviteAt=S.t; } break;
    case 'decline': if(to){ feel(to,{sadness:3,embarrassment:2}); if(to.id==='alex') feel(to,{sadness:4},`${sp.name} declined`); } break;
    case 'mediate': for(const b of direct){ feel(b,{anger:-12,stress:-6},`${sp.name} tried to calm things down`); relChange(b,sp.id,{respect:4,friendship:2},'tried to make peace',false); } sp.helpCount++; feel(sp,{stress:4+sp.helpCount}); dropIntention(sp,'mediate'); if(c.tone<0) c.tone=Math.min(0,c.tone+2); break;
    case 'calm': feel(sp,{anger:-14,stress:-6}); if(plan.believe&&to){ relChange(sp,to.id,{trust:12,resentment:-12},'believed their denial'); dropIntention(sp,'confront',to.id); } break;
    case 'ally': if(to) sp.cd['ally_'+to.id]=S.t; break;
    case 'accept_ally': if(to){ relChange(sp,to.id,{trust:10,friendship:6},'formed an alliance'); relChange(to,sp.id,{trust:10,friendship:6},'formed an alliance'); S.alliances=(S.alliances||[]).concat([[to.id,sp.id,S.t]]); logEvent('alliance',`🤝 ${to.name} and ${sp.name} formed an alliance.`,[to.id,sp.id],4,{convId:c.id}); if(to.id==='sophia'||sp.id==='sophia') feel(A('sophia'),{happiness:8}); } break;
    case 'confess': if(to){ feel(sp,{fear:8,excitement:10}); } break;
    case 'accept_love': if(to){ sp.rel[to.id].partner=true; to.rel[sp.id].partner=true; sp.partner=to.id; to.partner=sp.id; relChange(sp,to.id,{attraction:10,trust:8},'became a couple'); relChange(to,sp.id,{attraction:10,trust:8},'became a couple'); feel(sp,{happiness:20,excitement:15}); feel(to,{happiness:22,excitement:15,loneliness:-20}); S.couples.push([sp.id,to.id,S.t]);
      const cid=makeClaim({about:sp.id,target:to.id,kind:'couple',content:`${sp.name} and ${to.name} are a couple now`,juicy:9}); for(const h of hearers) learnClaim(h.b,cid,null,1,{witnessed:true});
      logEvent('romance',`💕 ${to.name} and ${sp.name} are now a couple!`,[sp.id,to.id],5,{convId:c.id}); } break;
    case 'reject_love': if(to){ feel(to,{sadness:30,embarrassment:18,happiness:-10},`${sp.name} didn't feel the same way`); relChange(to,sp.id,{attraction:-8},'rejected their feelings'); logEvent('romance',`💔 ${sp.name} turned down ${to.name}'s confession.`,[sp.id,to.id],4,{convId:c.id}); } break;
    case 'game_ask': break;
    case 'game_answer': feel(sp,{embarrassment:8,excitement:6}); break;
    case 'game_dodge': feel(sp,{embarrassment:5}); for(const b of direct) relChange(b,sp.id,{respect:-1},'dodged the question',false); break;
    case 'leave': case 'cry_out': break;
  }
  // complaints & mocking about a PRESENT person land directly
  if(res.newClaim && res.newClaim.about && c.participants.includes(res.newClaim.about) && res.newClaim.about!==sp.id){
    const v=A(res.newClaim.about); feel(v,{embarrassment:8,anger:8,sadness:8},`${sp.name} called them out in front of everyone`); relChange(v,sp.id,{resentment:10,friendship:-5},`called out in front of everyone (${res.newClaim.content})`);
  }
  // hostile scene: bystanders react independently
  if(c.tone<=-2 && !c.flags.fightClaim){
    c.flags.fightClaim=1; const ps=c.participants.slice(0,2);
    const cid=makeClaim({about:ps[0],target:ps[1],kind:'fight',content:`${nm(ps[0])} and ${nm(ps[1])} had a heated argument`,juicy:6});
    for(const h of hearers) learnClaim(h.b,cid,null,h.clarity,{witnessed:true});
  }
  if(c.tone<=-2) reactBystanders(c,sp,hearers);
}
function reactWitnesses(c,sp,victim,hearers){
  for(const h of hearers){
    const b=h.b; if(b===victim||b===sp) continue;
    const fr=b.rel[victim.id].friendship;
    if(fr>60 && (b.p.temper>60 || (b.id==='noah'&&chance(0.5))) && !c.participants.includes(b.id)) addIntention(b,{type:'defend',target:sp.id,friend:victim.id,convId:c.id,urg:55+fr*0.3});
  }
}
function flirtWitnesses(c,sp,to,hearers){
  let witnessed=false;
  for(const h of hearers){
    const b=h.b; if(b===sp||b===to||h.clarity<0.25) continue; witnessed=true;
    for(const [x,y] of [[sp,to],[to,sp]]){
      if(b.rel[x.id].attraction>50 || b.partner===x.id){
        feel(b,{jealousy:16+(b.partner===x.id?20:0),sadness:6,anger:b.partner===x.id?12:3},`watching ${sp.name} flirt with ${to.name}`);
        relChange(b,y.id,{resentment:8,trust:-3},`flirting with ${x.name}`);
        if(!b.cd['jeal_'+x.id]||S.t-b.cd['jeal_'+x.id]>90){ b.cd['jeal_'+x.id]=S.t; logEvent('jealousy',`${b.name} saw ${sp.name} flirting with ${to.name} and got jealous.`,[b.id,sp.id,to.id],3); }
        break;
      }
    }
  }
  if(witnessed && !c.flags.flirtClaim){ c.flags.flirtClaim=1; const cid=makeClaim({about:sp.id,target:to.id,kind:'flirt',content:`${sp.name} was flirting with ${to.name}`,juicy:7}); for(const h of hearers) learnClaim(h.b,cid,null,h.clarity,{witnessed:true}); }
}
function reactBystanders(c,sp,hearers){
  for(const h of hearers){
    const b=h.b; if(h.direct||b.convId) continue;
    if(b.cd['arg_'+c.id]) continue; b.cd['arg_'+c.id]=S.t;
    if(b.p.agreeableness>75 && b.p.neuroticism>70 && b.p.empathy<95){ // conflict-avoidant: leave the room
      feel(b,{stress:10,fear:5},'overhearing an argument');
      const away=['balcony','corner','bed3','garden'].find(r=>r!==roomAtPos(b.pos)&&!(S.storm>0&&(r==='garden'||r==='balcony')));
      const q=randomFloorIn(away); releaseSpot(b); b.act={type:'avoid',label:'Leaving — the arguing is too much',until:S.t+8}; b.path=findPath(b.pos.x,b.pos.y,q.x,q.y)||[];
      logEvent('mood',`${b.name} left the ${roomName(roomAtPos(b.pos))}, uncomfortable with the arguing.`,[b.id],2); continue;
    }
    if(b.p.agreeableness>85 && b.p.empathy>80){ addIntention(b,{type:'mediate',target:c.participants[0],convId:c.id,urg:62+b.p.empathy*0.2-b.helpCount*7}); continue; }
    if(b.p.gossip>80){ addMemory(b,`Overheard ${c.participants.map(nm).join(' and ')} arguing. Wow.`,5,c.participants,'saw'); }
  }
}
