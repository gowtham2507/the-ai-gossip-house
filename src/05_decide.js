// ================= LAYER 2: utility-based decisions (each agent decides independently) =================
function available(b,forWhat){ if(!b) return false; const t=b.act.type; if(t==='sleep'||t==='bathroom') return false; if(forWhat!=='join' && b.convId){ const c=S.convs.find(c=>c.id===b.convId); if(c&&c.privacy==='private') return false; } return true; }
function travelPenalty(a,b){ return Math.min(25, dist(a.pos,b.pos)*0.45); }
function decide(a){
  a.lastDecideAt=S.t;
  const opts=[]; const h=hourOf(S.t); const p=a.p, n=a.needs, e=a.emotions;
  const night=isBedtimeH(a,h); const party=S.party&&S.party.active;
  // party invite evaluation (independent per agent)
  if(party && a.cd.inviteAt && S.t>=a.cd.inviteAt){
    const ps=partyAttendScore(a); a.cd.inviteAt=null;
    if(ps.score<35){ a.reason=`Got the party invite, but declined: ${n.energy<35?'too tired':e.stress>55?'too stressed':e.sadness>50?'not in the mood':'would rather do something else'}.`; addMemory(a,`Skipped the party ${S.party.host?`${nm(S.party.host)} threw`:''}.`,2,[],'party'); if(S.party.host && a.rel[S.party.host].friendship>60) logEvent('party',`${a.name} decided to skip the party.`,[a.id],1); }
  }
  // SLEEP
  opts.push({type:'sleep',score:(100-n.energy)*0.8+(night?60:0)-(party?p.extraversion*0.3:0)+(n.energy<12?50:0)-12,reason:night?`It's late (${fmtTime(S.t)}) and energy is ${n.energy|0}.`:`Exhausted (energy ${n.energy|0}).`});
  const meal=(h>=7&&h<9.5)||(h>=12&&h<14)||(h>=18&&h<20.5);
  opts.push({type:'eat',score:(100-n.hunger)*1.05+(meal?18:0)+(S.pizza>0?25:0)-22,reason:S.pizza>0?'Pizza arrived!':`Hungry (hunger ${n.hunger|0}).`});
  opts.push({type:'tv',score:(100-n.fun)*0.5+(100-n.rest)*0.3+(e.sadness>45?6:0)+4,reason:'Wants to unwind in front of the TV.'});
  opts.push({type:'hobby',score:(100-n.fun)*0.45+p.openness*0.12+14,reason:`Feels like ${a.hobby.label}.`});
  if(!(S.storm>0)) opts.push({type:'stroll',score:(100-n.fun)*0.25+p.openness*0.1+e.stress*0.18+(h>21||h<6?-10:0),reason:'Needs some fresh air.'});
  const intro=100-p.extraversion;
  opts.push({type:'solitude',score:(100-n.privacy)*0.65*(0.5+intro/100)+e.stress*0.45+(e.sadness>50?14:0)+(e.embarrassment>50?12:0)-14,reason:e.stress>55?`Stressed (${e.stress|0}) and needs space.`:e.embarrassment>50?'Embarrassed — wants to disappear for a bit.':'Wants some alone time.'});
  if(a.crying) opts.push({type:'cry',score:72+e.sadness*0.2-(p.extraversion>70?15:0),reason:`Hurt: ${a.cryCause}.`});
  if(e.anger>60) opts.push({type:'pace',score:e.anger*0.62,reason:`Fuming (anger ${e.anger|0}).`});
  if(a.bladder>70) opts.push({type:'bathroom',score:40+(a.bladder-70)*2,reason:'Bathroom break.'});
  if(party){ const ps=partyAttendScore(a); opts.push({type:'party',score:ps.score,reason:ps.reason}); }
  if(canPlanParty(a,h)) opts.push({type:'plan_party',score:(100-n.fun)*0.4+e.excitement*0.35+p.extraversion*0.2+(a.id==='alex'?p.ambition*0.15:0)-(100-n.energy)*0.5-15,reason:a.id==='alex'?'Wants to throw the best party of the week.':'Bored — time for a party!'});
  if(!party && S.trash.length>3) opts.push({type:'cleanup',score:p.conscientiousness*0.55+S.trash.length*1.5-(100-n.energy)*0.4-15+(a.id==='ethan'?8:0),reason:`The mess (${S.trash.length} items) is bothering them.`});
  if(party && ['zara','max','ivy','mia'].includes(a.id) && roomAtPos(a.pos)==='party' && !a.cd.gameAt && S.agents.filter(b=>roomAtPos(b.pos)==='party'&&!b.convId).length>=4) opts.push({type:'game',score:e.excitement*0.5+p.impulsivity*0.3-5,reason:'The party needs a game — Truth or Dare!'});
  if(party && S.snackStock<2) opts.push({type:'cook',score:p.conscientiousness*0.4+p.agreeableness*0.2-10,reason:'The party is out of snacks.'});
  for(const o of socialOptions(a)) opts.push(o);
  // inertia: don't repeat the exact same thing endlessly
  for(const o of opts){ if(a.lastChoice===o.type && o.type!=='sleep' && o.type!=='talk') o.score-=8; }
  const temp=6+p.impulsivity*0.08+(p.contrarian>70?5:0);
  const choice=weightedPick(opts,temp);
  if(!choice) return;
  a.reason=choice.reason; a.lastChoice=choice.type; a.lastDecision={type:choice.type,score:choice.score|0,t:S.t,alts:opts.sort((x,y)=>y.score-x.score).slice(0,4).map(o=>`${o.type}${o.target?'→'+nm(o.target):''} ${o.score|0}`)};
  execute(a,choice);
}
function socialOptions(a){
  const out=[]; const p=a.p, n=a.needs, e=a.emotions;
  const socialDrive=(100-n.social)*0.55*(0.4+p.extraversion/100);
  // intentions first (concrete social goals)
  for(const it of a.intentions){
    const b=A(it.target);
    if(it.type==='game'){ out.push({type:'game',score:it.urg,reason:'Wants to start a game with everyone.',it}); continue; }
    if(!b || !available(b, it.type==='mediate'?'join':'')) continue;
    let s=it.urg - travelPenalty(a,b);
    let reason='';
    switch(it.type){
      case 'confront': s+= e.anger*0.25 - (p.agreeableness>75?18:0); reason=`Wants to confront ${b.name} about ${it.cause}.`; break;
      case 'apologize': s+= (60-e.anger)*0.3 + p.agreeableness*0.2 - (S.t-it.createdAt<45?30:0); reason=`Feels bad about ${it.cause} — wants to apologize to ${b.name}.`; break;
      case 'comfort': if(!b.crying && b.emotions.sadness<50){ dropIntention(a,'comfort',b.id); continue; } s+= p.empathy*0.2 - (a.id==='ethan'? a.helpCount*6:0); reason=`${b.name} is upset; wants to comfort them.`; break;
      case 'mediate': { const c=S.convs.find(c=>c.id===it.convId&&c.active); if(!c){ dropIntention(a,'mediate'); continue; } s+= p.agreeableness*0.2 - (a.id==='ethan'?a.helpCount*5:0); reason=`Heard an argument and wants to calm things down.`; break; }
      case 'defend': { const c=S.convs.find(c=>c.id===it.convId&&c.active); if(!c){ dropIntention(a,'defend'); continue; } reason=`Won't stand by while ${nm(it.friend)} gets attacked.`; break; }
      case 'tell': reason=`Can't wait to tell ${b.name} something.`; break;
      case 'confess': reason=`Wants to finally tell ${b.name} how they feel.`; break;
      default: reason=`Wants to talk to ${b.name}.`;
    }
    out.push({type:'social',purpose:it.type,target:b.id,score:s,reason,it});
  }
  // general socializing with someone nearby or liked
  const cands=[];
  for(const b of others(a)){
    if(!available(b)) continue;
    const r=a.rel[b.id];
    if(a.avoid[b.id] && a.avoid[b.id]>S.t) continue;
    let s=socialDrive + r.friendship*0.22 + r.attraction*0.2 + r.familiarity*0.05 - r.resentment*0.5 - travelPenalty(a,b) + (b.crying?-5:0) - 6;
    if(roomAtPos(b.pos)===roomAtPos(a.pos)) s+=8;
    cands.push({b,s});
  }
  cands.sort((x,y)=>y.s-x.s);
  for(const {b,s} of cands.slice(0,3)){
    const r=a.rel[b.id];
    let purpose='chat', bonus=0, reason=`Wants company (social ${n.social|0}) — likes ${b.name}.`;
    const g=pickGossipFor(a,[b]);
    const seesCrying = b.crying && (roomAtPos(b.pos)===roomAtPos(a.pos) || dist(a.pos,b.pos)<8 || Object.values(a.knowledge).some(k=>{ const c=S.claims[k.claimId]; return c&&c.kind==='crying'&&c.about===b.id&&S.t-k.learnedAt<90; }) || (r.friendship>68&&chance(0.3)));
    if(seesCrying && p.empathy>40){ purpose='comfort'; bonus=p.empathy*0.45+r.friendship*0.2-(a.id==='ethan'?a.helpCount*5:0); reason=`${b.name} is crying — ${a.id==='ethan'&&a.helpCount>=3?'again. Sigh. Going to help anyway.':'wants to be there for them.'}`; }
    else if(g && g.score>40 && p.gossip>40){ purpose='gossip'; bonus=g.score*0.25; reason=`Has juicy news to share with ${b.name}.`; }
    else if(r.attraction>58 && p.flirt>35 && e.happiness>40){ purpose='flirt'; bonus=r.attraction*0.15; reason=`Has a thing for ${b.name}.`; }
    else if(r.trust>58 && ownUnsharedSecret(a,b.id) && (e.loneliness>42||e.sadness>40||chance((100-p.discretion)/220))){ purpose='confide'; bonus=12+e.loneliness*0.15; reason=`Lonely and trusts ${b.name} — wants to open up.`; }
    else if(p.gossip>70 && chance(0.4)){ const subj=curiousSubject(a,b); if(subj){ purpose='ask_about'; bonus=10; reason=`Curious what ${b.name} knows about ${nm(subj)}.`; out.push({type:'social',purpose,target:b.id,score:s+bonus,reason,data:{subject:subj}}); continue; } }
    else if(a.id==='sophia' && S.influence && S.influence[b.id]>45 && r.trust>40 && !a.cd['ally_'+b.id]){ purpose='ally'; bonus=10; reason=`${b.name} is influential — a useful ally.`; }
    else if(p.humor>80 && chance(0.5)){ purpose='joke'; bonus=6; reason=`Has a new bit to try on ${b.name}.`; }
    out.push({type:'social',purpose,target:b.id,score:s+bonus,reason,data:g&&purpose==='gossip'?{claimId:g.claimId}:{}});
  }
  // join a nearby non-private conversation
  for(const c of S.convs){
    if(!c.active || c.privacy==='private' || c.participants.length>=5 || c.participants.includes(a.id)) continue;
    const ps=c.participants.map(A); const d=Math.min(...ps.map(x=>dist(x.pos,a.pos)));
    if(d>9) continue;
    const like=ps.reduce((s,x)=>s+a.rel[x.id].friendship-a.rel[x.id].resentment,0)/ps.length;
    out.push({type:'join',conv:c.id,target:ps[0].id,score:socialDrive*0.8+like*0.3-d*1.5+(c.purpose==='game'?20:0)-8,reason:`Drifting over to join ${ps.map(x=>x.name).join(' & ')}.`});
  }
  return out;
}
function ownUnsharedSecret(a,toId){
  return Object.values(a.knowledge).map(k=>S.claims[k.claimId]).find(c=>c&&c.owner===a.id&&c.secret&&!c.public&&!c.confidedTo.includes(toId));
}
function curiousSubject(a,b){
  // someone a has partial / rumor knowledge about, or simply someone interesting b is close to
  const cands=others(a).filter(x=>x.id!==b.id).map(x=>({x,s:b.rel[x.id]?b.rel[x.id].friendship+rnd()*30:0}));
  cands.sort((p,q)=>q.s-p.s); return cands[0]?cands[0].x.id:null;
}
// What gossip would `a` share with listeners? returns {claimId, score}
function pickGossipFor(a,listeners){
  let best=null;
  const lids=listeners.map(l=>l.id);
  for(const k of Object.values(a.knowledge)){
    const c=S.claims[k.claimId]; if(!c) continue;
    if(c.owner===a.id) continue;
    if(lids.includes(c.about) || (c.target && lids.includes(c.target) && c.kind!=='crush')) continue;
    if(lids.every(id=>k.toldTo.includes(id) || k.sourceAgentId===id)) continue;
    if(c.origin===a.id) continue;
    if(a.cd['dist_'+c.id]) continue;
    let s=c.juicy*6*k.confidence*(0.25+a.p.gossip/100) - (a.rel[c.about]?a.rel[c.about].friendship*0.2:0) + (a.rel[c.about]?a.rel[c.about].resentment*0.35:0);
    if(c.secret && !c.public){
      s-= a.p.discretion*0.45;
      if(k.permittedRecipients) s-= a.p.discretion*0.6 + (a.rel[c.owner]?a.rel[c.owner].trust*0.3:0);
    }
    if(S.t-k.learnedAt>600) s-=10; // old news
    if(a.id==='sophia' && c.about==='alex') s+=12; // strategic
    for(const l of listeners){ s+= (a.rel[l.id].trust-45)*0.2; }
    s+= rnd()*12-6;
    if(!best||s>best.score) best={claimId:c.id,score:s};
  }
  return best;
}
// ---------- execute a chosen option ----------
function execute(a,o){
  const p=a.p;
  switch(o.type){
    case 'sleep': { const s=World.spots.find(s=>s.kind==='bed'&&s.owner===a.id); goDo(a,'sleep',s,{walkLabel:'Heading to bed'}); break; }
    case 'eat': {
      if(S.party&&S.party.active && S.snackStock>0 && chance(0.5)){ const s=findSpot(a,'snack'); if(s){ goDo(a,'snack',s); break; } }
      const s=findSpot(a,'dine',{noise:6}); goDo(a,'eat',s,{label:S.pizza>0?'Eating pizza':pick(['Eating','Having a snack','Grabbing a bite'])}); break; }
    case 'tv': { const s=findSpot(a,'sofa',{noise:4}); if(s) goDo(a,'tv',s); else setIdle(a); break; }
    case 'hobby': {
      let s=findSpot(a,a.hobby.kind,{noise:3});
      if(!s){ s=findSpot(a,['books','sofa','bench']); }
      goDo(a,'hobby',s,{label:a.hobby.label[0].toUpperCase()+a.hobby.label.slice(1)}); break; }
    case 'stroll': { const q=randomFloorIn('garden'); goDo(a,'stroll',null,{tx:q.x,ty:q.y}); break; }
    case 'solitude': {
      let s=null; const roll=rnd();
      if(roll<0.5) s=World.spots.find(s=>s.kind==='bed'&&s.owner===a.id);
      if(!s) s=findSpot(a,['cornerseat','rail','lounger','bench'],{noise:8});
      goDo(a,'solitude',s,{label:pick(['Sitting alone','Taking some alone time','Thinking quietly'])}); break; }
    case 'cry': { let s=World.spots.find(s=>s.kind==='bed'&&s.owner===a.id); if(chance(0.4)) s=findSpot(a,['cornerseat','rail','bench'])||s; goDo(a,'cry',s,{label:'Crying alone'}); break; }
    case 'pace': { releaseSpot(a); a.act={type:'pace',label:'Pacing, frustrated',until:S.t+rr(6,12)}; a.path=[]; break; }
    case 'bathroom': { const s=findSpot(a,'toilet'); if(s) goDo(a,'bathroom',s); else setIdle(a); break; }
    case 'party': {
      const r=rnd(); let s=null, act='dance';
      if(S.party.dj===null && p.extraversion>70 && r<0.15){ s=findSpot(a,'dj'); act='dj'; }
      else if(r < 0.25+p.extraversion/250 && a.needs.energy>35){ s=findSpot(a,'dance',{noise:5}); act='dance'; }
      else { s=findSpot(a,'partyseat',{noise:4}); act='partyhang'; }
      if(!s){ s=findSpot(a,'partyseat',{noise:4}); act='partyhang'; }
      if(act==='dj'){ S.party.dj=a.id; S.party.music=a.music; logEvent('party',`${a.name} took over the DJ booth — switching to ${a.music}.`,[a.id],2); }
      goDo(a,act,s); break; }
    case 'plan_party': { const s=findSpot(a,'dj')||findSpot(a,'dance'); goDo(a,'plan_party',s,{label:'Setting up a party'}); break; }
    case 'cleanup': { const tr=nearestTrash(a); if(tr) goDo(a,'cleanup',null,{tx:Math.floor(tr.x),ty:Math.floor(tr.y),data:tr.id}); else setIdle(a); break; }
    case 'cook': { const s=findSpot(a,'stove'); goDo(a,'cook',s,{label:'Preparing party snacks'}); break; }
    case 'game': { dropIntention(a,'game'); a.cd.gameAt=S.t; startGame(a); break; }
    case 'join': { const c=S.convs.find(c=>c.id===o.conv); const b=A(o.target); if(c&&b) approach(a,b,'join',{convId:c.id}); else setIdle(a); break; }
    case 'social': {
      const b=A(o.target);
      if(o.it) { if(['confront','apologize','comfort','tell','confess'].includes(o.it.type)) {} }
      approach(a,b,o.purpose,Object.assign({},o.data||{},o.it?{claimId:o.it.claimId,cause:o.it.cause,convId:o.it.convId,friend:o.it.friend,leak:o.it.leak}:{}));
      if(o.purpose==='mediate' || o.purpose==='defend'){ a.act.purpose=o.purpose; }
      break; }
    default: setIdle(a);
  }
}
function startGame(a){
  const pool=S.agents.filter(b=>b!==a && available(b) && !b.convId && b.act.type!=='sleep' && dist(b.pos,a.pos)<14);
  const joiners=pool.filter(b=>{ const r=b.rel[a.id]; const s=b.p.extraversion*0.5+r.friendship*0.3-r.resentment*0.5+b.emotions.excitement*0.2-(100-b.needs.energy)*0.3; return s>35+rnd()*20; }).slice(0,4);
  if(joiners.length<2){ a.reason='Wanted to start Truth or Dare, but not enough people were up for it.'; feel(a,{happiness:-4}); setIdle(a); return; }
  const c=createConversation(a,joiners,'game',{});
  c.privacy='normal';
  logEvent('game',`🎲 ${a.name} got ${joiners.map(j=>j.name).join(', ')} to play Truth or Dare.`,c.participants,4,{convId:c.id});
}
