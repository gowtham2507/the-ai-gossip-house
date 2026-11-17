// ================= LIFE: needs, movement, activities, decisions, party =================
function isBedtimeH(o,h){ const b=o.bed!=null?o.bed:o.bedT, w=o.wake!=null?o.wake:o.wakeT; return b<w ? (h>=b&&h<w) : (h>=b||h<w); }
const ACT = {
  idle:{label:'Hanging around'}, walk:{label:'Walking'},
  sleep:{label:'Sleeping',pose:'lie'}, eat:{label:'Eating',pose:'sit',dur:[18,30]},
  tv:{label:'Watching TV',pose:'sit',dur:[30,75],intr:true}, hobby:{pose:'auto',dur:[40,90],intr:true},
  stroll:{label:'Strolling in the garden',dur:[8,18],intr:true}, solitude:{label:'Taking some alone time',pose:'sit',dur:[25,60],intr:true},
  cry:{label:'Crying alone',pose:'sit',dur:[15,35]}, pace:{label:'Pacing, frustrated',pose:'pace',dur:[6,14],intr:true},
  bathroom:{label:'In the bathroom',dur:[5,10]}, partyhang:{label:'Hanging out at the party',pose:'sit',dur:[15,35],intr:true},
  dance:{label:'Dancing',pose:'dance',dur:[15,35],intr:true}, dj:{label:'DJing',dur:[15,30],intr:true},
  snack:{label:'Grabbing snacks',dur:[4,8]}, cook:{label:'Preparing snacks',dur:[15,25],intr:true},
  cleanup:{label:'Cleaning up the mess',dur:[2,4]}, plan_party:{label:'Setting up a party',dur:[3,5]},
  approach:{label:'Looking for someone'}, talk:{label:'In a conversation'}, avoid:{label:'Walking away',dur:[3,6]},
};
function setIdle(a,keepSpot=false){ if(!keepSpot) releaseSpot(a); a.act={type:'idle',label:'Hanging around',until:0}; a.task=null; a.seated=false; a.path=[]; }
function goDo(a,actType,spot,o={}){
  if(spot) claimSpot(a,spot); else releaseSpot(a);
  const tx=spot?spot.ax:o.tx, ty=spot?spot.ay:o.ty;
  a.path=findPath(a.pos.x,a.pos.y,tx,ty)||[];
  a.task={act:actType,label:o.label||null,data:o.data||null,dur:o.dur||null};
  a.seated=false;
  const room=World.roomAt[ty]&&World.roomAt[ty][tx];
  a.act={type:'walk',label:o.walkLabel||`Heading to the ${roomName(room)}`,until:S.t+90,goal:actType};
}
function startAct(a,type,task){
  const def=ACT[type]||{}; const dur=task&&task.dur?task.dur:(def.dur?rr(def.dur[0],def.dur[1]):20);
  a.act={type,label:(task&&task.label)||def.label||type,until:S.t+dur,data:task?task.data:null,startedAt:S.t};
  a.task=null;
  const s=a.spot?spotById(a.spot):null;
  a.seated = !!s && (def.pose==='sit'||def.pose==='lie'||def.pose==='auto'||type==='sleep'||type==='cry'||type==='solitude');
  if(s && ['dance','dj','stove','fridge','snack','mirror','gym','easel','toilet','rail'].includes(s.kind)) a.seated = s.kind==='easel'?false:false;
  if(s && ['sofa','dine','partyseat','cornerseat','campseat','bench','lounger','bed','pool','desk'].includes(s.kind)) a.seated=true;
  if(s) a.face=s.face;
  if(type==='sleep'){ const h=hourOf(S.t); const wake=a.wakeT; let mins=((wake-h)*60+1440)%1440; if(mins>720||!isBedtimeH(a,h)) mins=Math.min(90,Math.max(30,(100-a.needs.energy)*2)); a.act.until=S.t+mins; a.act.label=mins<100&&!isBedtimeH(a,h)?'Taking a nap':'Sleeping'; }
  if(type==='plan_party') {}
  if(type==='cleanup'){ const tr=S.trash.find(x=>x.id===a.act.data); if(tr){ S.trash=S.trash.filter(x=>x!==tr); } }
  if(type==='snack' && S.snackStock>0) S.snackStock-=0.5;
}
function finishAct(a){
  const t=a.act.type;
  if(t==='plan_party') startParty(a);
  if(t==='cook'){ S.snackStock+=6; logEvent('party',`${a.name} prepared snacks${S.party&&S.party.active?' for the party':''}.`,[a.id],1); }
  if(t==='eat' && chance(0.35)) spawnTrash(a.pos);
  if(t==='dance' || t==='partyhang'){ if(chance(0.4)) spawnTrash(a.pos); }
  if(t==='sleep'){ addMemory(a,a.act.label==='Taking a nap'?'Took a nap.':'Woke up.',1,[],'routine'); }
  if(t==='cleanup' && S.trash.length){ setIdle(a); const tr=nearestTrash(a); if(tr && a.needs.energy>25){ goDo(a,'cleanup',null,{tx:Math.floor(tr.x),ty:Math.floor(tr.y),data:tr.id,label:'Cleaning up the mess'}); return; } }
  setIdle(a);
}
function spawnTrash(p){ if(S.trash.length>30) return; S.trash.push({id:uid('t'),x:p.x+rr(-0.6,0.6),y:p.y+rr(-0.4,0.6),k:Math.floor(rr(0,3))}); }
function nearestTrash(a){ let b=null,bd=1e9; for(const t of S.trash){ const d=dist(a.pos,t); if(d<bd){bd=d;b=t;} } return b; }

// ---------- needs ----------
function updateNeeds(a,dtm){
  const n=a.needs, t=a.act.type, E=a.p.extraversion;
  const crowd=S.agents.filter(b=>b!==a && dist(b.pos,a.pos)<4.5 && roomAtPos(b.pos)===roomAtPos(a.pos)).length;
  n.hunger-=0.11*dtm; n.fun-=0.09*dtm; n.social-=(0.03+0.1*E/100)*dtm; a.bladder+=0.11*dtm;
  if(t==='sleep'){ n.energy+=0.24*dtm; n.rest+=0.5*dtm; n.hunger+=0.07*dtm; n.privacy+=0.3*dtm; n.social+=0.02*dtm; }
  else { n.energy-=(t==='dance'?0.16:0.065)*dtm; n.rest-= (a.seated?-0.45:0.07)*dtm; }
  if(crowd>0) n.privacy-=0.03*Math.sqrt(crowd)*(1+(100-E)/80)*dtm; else n.privacy+=0.35*dtm;
  switch(t){
    case 'eat': n.hunger+=3.4*dtm; feel(a,{happiness:0.05*dtm}); break;
    case 'snack': n.hunger+=2.5*dtm; break;
    case 'tv': n.fun+=0.7*dtm; break;
    case 'hobby': n.fun+=0.9*dtm; a.emotions.stress=clamp(a.emotions.stress-0.15*dtm); a.emotions.happiness=clamp(a.emotions.happiness+0.05*dtm); break;
    case 'stroll': n.fun+=0.5*dtm; a.emotions.stress=clamp(a.emotions.stress-0.25*dtm); break;
    case 'solitude': n.privacy+=1.2*dtm; a.emotions.stress=clamp(a.emotions.stress-0.35*dtm); a.emotions.anger=clamp(a.emotions.anger-0.2*dtm); break;
    case 'cry': n.privacy+=0.5*dtm; a.emotions.sadness=clamp(a.emotions.sadness-0.25*dtm); break;
    case 'pace': a.emotions.anger=clamp(a.emotions.anger-0.6*dtm); break;
    case 'dance': n.fun+=1.4*dtm; n.social+=0.3*dtm; a.emotions.excitement=clamp(a.emotions.excitement+0.4*dtm); a.emotions.happiness=clamp(a.emotions.happiness+0.12*dtm); break;
    case 'partyhang': case 'dj': n.fun+=0.9*dtm; n.social+=0.25*dtm; a.emotions.excitement=clamp(a.emotions.excitement+0.2*dtm); break;
    case 'talk': n.social+=0.7*dtm; n.fun+=0.25*dtm; break;
    case 'bathroom': a.bladder=0; n.privacy+=1*dtm; break;
  }
  for(const k of NEED_KEYS) n[k]=clamp(n[k]);
}

// ---------- movement ----------
function moveAgent(a,dtm){
  if(!a.path || !a.path.length) return false;
  let step=3.1*dtm*(a.crying?0.7:1)*(a.act.type==='avoid'?1.2:1);
  while(step>0 && a.path.length){
    const p=a.path[0]; const dx=p.x-a.pos.x, dy=p.y-a.pos.y; const d=Math.hypot(dx,dy);
    if(Math.abs(dx)>Math.abs(dy)) a.face=dx>0?'right':'left'; else if(d>0.01) a.face=dy>0?'down':'up';
    if(d<=step){ a.pos.x=p.x; a.pos.y=p.y; a.path.shift(); step-=d; } else { a.pos.x+=dx/d*step; a.pos.y+=dy/d*step; step=0; }
  }
  a.moving=true;
  return true;
}

// ---------- per-tick activity driver ----------
function updateAgent(a,dtm){
  a.moving=false;
  if(a.convId){ const c=S.convs.find(c=>c.id===a.convId); if(!c||!c.active) { a.convId=null; setIdle(a); } else { if(a.path&&a.path.length) moveAgent(a,dtm); return; } }
  const t=a.act.type;
  if(t==='walk'){
    moveAgent(a,dtm);
    if(!a.path.length){ if(a.task) startAct(a,a.task.act,a.task); else setIdle(a); }
    else if(S.t>a.act.until) setIdle(a);
    return;
  }
  if(t==='approach'){ approachTick(a,dtm); return; }
  if(t==='pace'){ if(!a.path.length){ const r=roomAtPos(a.pos)||'hall'; const p=randomFloorIn(r); a.path=(findPath(a.pos.x,a.pos.y,p.x,p.y)||[]).slice(0,6); } moveAgent(a,dtm); }
  if(t==='stroll'){ if(!a.path.length && chance(0.02)){ const p=randomFloorIn('garden'); a.path=(findPath(a.pos.x,a.pos.y,p.x,p.y)||[]).slice(0,8); } moveAgent(a,dtm); }
  if(t==='avoid'){ moveAgent(a,dtm); }
  if(t==='dance'){ a.face=['down','left','down','right'][Math.floor(S.t/2)%4]; }
  if(t==='sleep'){
    if(a.needs.energy>=99 && !isBedtimeH(a,hourOf(S.t))){ finishAct(a); return; }
    if(S.t>=a.act.until && (a.needs.energy>60 || !isBedtimeH(a,hourOf(S.t)))){ finishAct(a); return; }
    return;
  }
  // interrupt low-priority activities if something urgent came up
  if(a.interrupt && (t==='idle' || (ACT[t]&&ACT[t].intr) || t==='cry')){ a.interrupt=false; if(t!=='idle'){ setIdle(a); } decide(a); return; }
  if(t!=='idle' && S.t>=a.act.until){ finishAct(a); }
  if(a.act.type==='idle' && S.t-a.lastDecideAt>0.5) decide(a);
}

// ---------- approach / start conversations ----------
function approach(a,target,purpose,data={}){
  releaseSpot(a);
  a.act={type:'approach',label:`Going to talk to ${target.name}`,until:S.t+28,target:target.id,purpose,data,repath:0};
  a.path=[]; a.seated=false;
}
function approachTick(a,dtm){
  const act=a.act, tgt=A(act.target);
  if(!tgt || tgt.act.type==='sleep' || tgt.act.type==='bathroom' || S.t>act.until){ a.reason=`Couldn't catch ${tgt?tgt.name:'them'}.`; setIdle(a); return; }
  const d=dist(a.pos,tgt.pos);
  if(d<=1.75){
    a.path=[]; requestConversation(a,tgt,act.purpose,act.data); return;
  }
  if(S.t>=act.repath || !a.path.length){
    act.repath=S.t+1.2;
    const tx=Math.floor(tgt.pos.x), ty=Math.floor(tgt.pos.y);
    let best=null,bd=1e9;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]]){ if(walkable(tx+dx,ty+dy)){ const dd=Math.hypot(tx+dx+0.5-a.pos.x,ty+dy+0.5-a.pos.y); if(dd<bd){bd=dd;best={x:tx+dx,y:ty+dy};} } }
    if(best) a.path=findPath(a.pos.x,a.pos.y,best.x,best.y)||[];
  }
  moveAgent(a,dtm);
}
function busyScore(b){ const t=b.act.type; return t==='sleep'?999: t==='bathroom'?999: t==='cry'?-5: t==='hobby'?12: t==='eat'?5: t==='dance'?10: 0; }
function requestConversation(a,b,purpose,data){
  // joining an existing conversation
  if(b.convId){
    const c=S.convs.find(c=>c.id===b.convId);
    if(c && c.active && c.participants.length<5 && (c.privacy!=='private' || purpose==='mediate' || purpose==='interrupt' || purpose==='defend')){
      joinConversation(c,a,purpose); return;
    }
    a.reason=`${b.name} was busy in a private conversation.`; setIdle(a); return;
  }
  const r=b.rel[a.id];
  let acc=45 + (100-b.needs.social)*0.3 + r.friendship*0.35 + r.attraction*0.2 - r.resentment*0.55 - b.emotions.stress*0.15 - busyScore(b) + (b.p.extraversion-50)*0.3;
  if(purpose==='comfort') acc+= b.crying? 35 : 10;
  if(purpose==='confront') acc+= 25; // you can't easily dodge a confrontation
  if(purpose==='apologize') acc+= 15;
  if(b.avoid[a.id] && b.avoid[a.id]>S.t) acc-=45;
  if(acc < 30 + rnd()*25){
    a.reason=`${b.name} didn't want to talk.`;
    feel(a,{embarrassment:6,loneliness:4,sadness:a.id==='alex'?6:2},`${b.name} brushed them off`);
    relChange(a,b.id,{friendship:-2},`${b.name} brushed them off`,false);
    if(a.id==='alex') addMemory(a,`${b.name} ignored me. I hate that feeling.`,5,[b.id],'ignored');
    logEvent('social',`${b.name} brushed off ${a.name}.`,[b.id,a.id],1);
    b.bubble={text:pick(['Not now.','Maybe later.','...','I\'m kind of busy.']),until:S.t+2,volume:'normal'};
    setIdle(a); return;
  }
  createConversation(a,[b],purpose,data);
}
function privacyFor(purpose){ return ['gossip','confide','reveal','ask_about','ally','apologize','comfort','flirt','confess'].includes(purpose)?'private': purpose==='confront'?'loud':'normal'; }
function createConversation(init,targets,purpose,data={}){
  const parts=[init,...targets];
  const c={id:uid('cv'),participants:parts.map(x=>x.id),initiator:init.id,purpose,data,room:roomAtPos(init.pos),privacy:privacyFor(purpose),
    topic:topicFor(purpose,data),lines:[],startedAt:S.t,lastActivity:S.t,active:true,busy:false,nextAt:S.t+0.3,turns:0,
    maxTurns:Math.round(rr(4,7)+(init.p.extraversion/25)+(purpose==='game'?6:0)+(purpose==='confront'?2:0)),tone:0,lastSpeaker:null,flags:{},llmTurns:0};
  S.convs.push(c);
  for(const p of parts){ enterConv(p,c); }
  faceGroup(c);
  if(c.privacy==='private') closeDoorFor(c.room);
  logEvent('talk',`${init.name} started ${c.privacy==='private'?'a private chat':'talking'} with ${targets.map(t=>t.name).join(', ')} (${c.topic}).`,c.participants,purpose==='chat'?1:2,{convId:c.id});
  return c;
}
function enterConv(p,c){
  p.convId=c.id; p.path=[]; p.act={type:'talk',label:`Talking (${c.topic})`,until:0};
  if(!p.spot || !p.seated) { releaseSpot(p); p.seated=false; }
  dropIntention(p,'join',null);
}
function joinConversation(c,a,purpose){
  if(c.participants.includes(a.id)) return;
  c.participants.push(a.id); enterConv(a,c); faceGroup(c);
  c.maxTurns+=3; c.flags.joined=(c.flags.joined||[]).concat(a.id);
  if(purpose==='mediate') c.flags.mediator=a.id;
  if(purpose==='interrupt' || purpose==='defend') c.flags.interrupter=a.id;
  logEvent('talk',`${a.name} ${purpose==='mediate'?'stepped in to calm things down between':purpose==='interrupt'||purpose==='defend'?'interrupted':'joined'} ${c.participants.filter(x=>x!==a.id).map(nm).join(' & ')}.`,c.participants,purpose==='mediate'?3:1,{convId:c.id});
}
function faceGroup(c){
  const ps=c.participants.map(A); const cx=ps.reduce((s,p)=>s+p.pos.x,0)/ps.length, cy=ps.reduce((s,p)=>s+p.pos.y,0)/ps.length;
  for(const p of ps){ if(p.seated && p.spot) continue; const dx=cx-p.pos.x, dy=cy-p.pos.y; if(Math.abs(dx)<0.05&&Math.abs(dy)<0.05) continue; p.face=Math.abs(dx)>Math.abs(dy)?(dx>0?'right':'left'):(dy>0?'down':'up'); }
}
function leaveConversation(c,a,why){
  c.participants=c.participants.filter(x=>x!==a.id); a.convId=null; setIdle(a);
  if(c.participants.length<2) endConversation(c,why||'');
}
function topicFor(p,d){
  return ({chat:'small talk',gossip:'gossip',confide:'a personal secret',confront:'a confrontation',apologize:'an apology',comfort:'comforting',flirt:'flirting',
    ask_about:`asking about ${nm(d.subject)}`,invite:'party invite',mediate:'making peace',game:'Truth or Dare',ally:'an alliance',joke:'jokes',confess:'confessing feelings',interrupt:'interruption',defend:'defending a friend'})[p]||'chatting';
}
function closeDoorFor(room){ /* door state is recomputed every tick from occupancy */ }
function updateDoors(){
  for(const d of World.doors){
    if(!d.closable){ d.open=true; continue; }
    const inner=d.a; const occ=S.agents.filter(b=>roomAtPos(b.pos)===inner);
    const priv = occ.some(b=>['sleep','solitude','cry','bathroom'].includes(b.act.type)) || S.convs.some(c=>c.active&&c.room===inner&&c.privacy==='private');
    const passing = S.agents.some(b=>d.tiles.some(([x,y])=>Math.abs(b.pos.x-(x+0.5))<1.2&&Math.abs(b.pos.y-(y+0.5))<1.2));
    d.open = !priv || passing;
  }
}

// ---------- hearing (spatial) ----------
function roomNoise(room){
  let n=0; if(S.party&&S.party.active){ if(room==='party') n=0.55; else if(['living','kitchen','garden','hall'].includes(room)) n=0.25; }
  if(S.storm>0 && ['garden','balcony'].includes(room)) n=Math.max(n,0.4);
  return n;
}
function hearClarity(listener,speaker,volume){
  if(listener.act.type==='sleep') return volume==='loud' && dist(listener.pos,speaker.pos)<4 ? 0.3 : 0;
  const base=volume==='whisper'?2.4:volume==='loud'?12:6;
  const lr=roomAtPos(listener.pos), sr=roomAtPos(speaker.pos);
  const range=base*(1-roomNoise(sr)*0.6);
  const d=dist(listener.pos,speaker.pos);
  if(lr===sr) return d<=range? clamp(1-(d/range)*0.55,0,1):0;
  if(volume==='whisper') return 0;
  const door=doorBetween(lr,sr); if(!door||!door.open) return 0;
  const dp={x:door.tiles[0][0]+0.5,y:door.tiles[0][1]+0.5};
  const dd=dist(listener.pos,dp)+dist(dp,speaker.pos); const r2=range*0.55;
  return dd<=r2? 0.15+0.45*(1-dd/r2) : 0;
}

// ---------- party ----------
function canPlanParty(a,h){
  if(S.party&&S.party.active) return false;
  if(S.t-S.lastPartyEnd<300) return false;
  if(!(h>=18.5||h<0.5)) return false;
  if(S.outage>0) return false;
  return ['alex','zara','max','ivy','mia'].includes(a.id);
}
function startParty(host){
  if(S.party&&S.party.active) return;
  const music= host?host.music:pick(['dance pop','house','hip hop','80s']);
  S.party={active:true,host:host?host.id:null,startedAt:S.t,music,dj:host?host.id:null,attendees:[],emptySince:null,peak:0};
  logEvent('party',host?`${host.name} started a party in the Party Hall! Music: ${music}. Invite sent to the house group chat.`:`A party started in the Party Hall! Music: ${music}.`,host?[host.id]:[],5);
  if(host){ addMemory(host,'I threw a party tonight.',6,[],'party'); feel(host,{excitement:20,happiness:10}); }
  for(const b of S.agents){ if(b===host) continue; b.cd.inviteAt=S.t+rr(0.5,8); b.interrupt = b.interrupt || (b.act.type!=='sleep'); }
}
function partyAttendScore(a){
  const p=S.party; const host=p.host?A(p.host):null; const E=a.p.extraversion;
  let s= E*0.55 + a.emotions.excitement*0.25 + (100-a.needs.fun)*0.25 - (100-a.needs.energy)*0.45 - a.emotions.stress*0.2 - a.emotions.sadness*0.2;
  if(host===a) s+=40; else if(host) s+= (a.rel[host.id].friendship-45)*0.35 - a.rel[host.id].resentment*0.4;
  if(a.cd.partyBoost && S.t-a.cd.partyBoost<60) s+=15;
  const present=S.agents.filter(b=>roomAtPos(b.pos)==='party'&&b!==a);
  for(const b of present){ s+= (a.rel[b.id].attraction>55?8:0) - (a.rel[b.id].resentment>45?10:0); }
  if(a.p.contrarian>70 && present.length>5) s-=15;
  if(isBedtimeH(a,hourOf(S.t))) s-=15;
  const reason = s>45? `Party's on and ${host?`${host.name} invited everyone`:'the music is calling'}` : `Not really feeling the party`;
  return {score:s,reason};
}
function partyTick(){
  const p=S.party; if(!p||!p.active) return;
  const inHall=S.agents.filter(b=>roomAtPos(b.pos)==='party' && b.act.type!=='sleep');
  p.attendees=inHall.map(b=>b.id); p.peak=Math.max(p.peak,inHall.length);
  const h=hourOf(S.t);
  if(inHall.length<2){ if(p.emptySince==null) p.emptySince=S.t; } else p.emptySince=null;
  if((p.emptySince!=null && S.t-p.emptySince>18 && S.t-p.startedAt>20) || (h>=3&&h<8&&S.t-p.startedAt>30) || S.t-p.startedAt>300 || S.outage>0){
    p.active=false; S.lastPartyEnd=S.t;
    logEvent('party',`The party ended. Peak crowd: ${p.peak}. ${S.trash.length>3?'The Party Hall is a mess.':''}`,[],4);
    const host=p.host?A(p.host):null;
    if(host){ if(p.peak<=3){ feel(host,{sadness:14,embarrassment:12,happiness:-8},'hardly anyone came to their party'); addMemory(host,`Barely anyone came to my party. Peak was ${p.peak}.`,7,[],'party'); } else { feel(host,{happiness:15,excitement:8},'the party was a hit'); addMemory(host,`My party was a hit — ${p.peak} people came.`,6,[],'party'); } }
  }
}
// ---------- user-triggered house events ----------
function triggerHouseEvent(kind){
  if(kind==='party'){ if(!(S.party&&S.party.active)) startParty(null); return; }
  if(kind==='pizza'){ S.pizza=45; S.snackStock+=10; logEvent('house','🍕 A pizza delivery arrived in the kitchen!',[],4); for(const a of S.agents) if(a.act.type!=='sleep'){ a.needs.hunger=Math.min(a.needs.hunger,45); a.interrupt=true; } return; }
  if(kind==='outage'){ S.outage=35; logEvent('house','⚡ Power outage! The house goes dark.',[],4); if(S.party) S.party.active=false; for(const a of S.agents){ feel(a,{fear:10+a.p.neuroticism*0.12,stress:8,excitement:5}); } return; }
  if(kind==='storm'){ S.storm=150; logEvent('house','⛈ A storm rolls in. The garden and balcony are off-limits.',[],3); for(const a of S.agents){ if(['garden','balcony'].includes(roomAtPos(a.pos)) && !a.convId){ a.interrupt=true; setIdle(a);} feel(a,{stress:4}); } return; }
  if(kind==='game'){ const z=S.agents.filter(a=>a.act.type!=='sleep'&&!a.convId).sort((x,y)=>y.p.extraversion-x.p.extraversion)[0]; if(z){ addIntention(z,{type:'game',urg:95}); logEvent('house','🎲 Game night was suggested.',[z.id],3);} return; }
}
function worldTick(dtm){
  if(S.pizza>0) S.pizza-=dtm; if(S.storm>0){ S.storm-=dtm; if(S.storm<=0) logEvent('house','The storm passed.',[],2); }
  if(S.outage>0){ S.outage-=dtm; if(S.outage<=0) logEvent('house','💡 Power is back on.',[],3); }
  // hourly social bookkeeping: influence & jealousy
  if(S.t-S.lastHourly>=60){
    S.lastHourly=S.t;
    const inf={}; for(const a of S.agents){ const os=others(a); inf[a.id]=os.reduce((s,b)=>s+(b.rel[a.id].respect+b.rel[a.id].friendship)/2,0)/os.length; }
    S.influence=inf;
    const alex=A('alex'); const top=Object.entries(inf).sort((x,y)=>y[1]-x[1])[0];
    if(top[0]!=='alex' && top[1]>inf.alex+4){ feel(alex,{jealousy:7,stress:4},`${nm(top[0])} is becoming more popular`); relChange(alex,top[0],{resentment:3},`${nm(top[0])} is stealing the spotlight`,false); if(!alex.cd.popNote||S.t-alex.cd.popNote>360){ alex.cd.popNote=S.t; addMemory(alex,`Everyone seems to like ${nm(top[0])} more than me lately.`,6,[top[0]],'jealous'); logEvent('jealousy',`Alex is getting jealous of how popular ${nm(top[0])} has become.`,['alex',top[0]],2);} }
    for(const a of S.agents){ if(S.t-a.lastHelpReset>1440){ a.helpCount=0; a.lastHelpReset=S.t; } }
    // forget stale intentions
    for(const a of S.agents){ a.intentions=a.intentions.filter(i=>S.t-i.createdAt<720); for(const i of a.intentions) i.urg*=0.93; }
  }
}
function tick(dtm){
  S.t+=dtm;
  updateDoors();
  for(const a of S.agents){ updateNeeds(a,dtm); decayEmotions(a,dtm); }
  for(const a of S.agents) updateAgent(a,dtm);
  for(const c of S.convs) if(c.active) convTick(c);
  S.convs=S.convs.filter(c=>c.active);
  partyTick(); worldTick(dtm); runSimTimers();
}
