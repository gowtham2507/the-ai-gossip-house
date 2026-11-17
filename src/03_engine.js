// ================= ENGINE: state, emotions, relationships, memory, knowledge =================
const EMO_KEYS=['happiness','sadness','anger','fear','jealousy','excitement','embarrassment','loneliness','trust','affection','stress'];
const NEED_KEYS=['energy','hunger','social','fun','privacy','rest'];
const S = {};
const hourOf = t => (t%1440)/60;
const dayOf = t => Math.floor(t/1440)+1;
const fmtTime = t => { const h=Math.floor((t%1440)/60), m=Math.floor(t%60); return String(h).padStart(2,'0')+':'+String(m).padStart(2,'0'); };
const A = id => S.byId[id];
const nm = id => (S.byId[id] ? S.byId[id].name : 'someone');
const others = a => S.agents.filter(b=>b.id!==a.id);

function newGame(seed){
  seedRandom(seed || (Date.now()%1e9));
  buildWorld();
  for(const k of Object.keys(S)) delete S[k];
  Object.assign(S,{ t:8*60+rr(0,20), agents:[], byId:{}, claims:{}, convs:[], ended:[], events:[], relLog:[], party:null, lastPartyEnd:-500,
    trash:[], snackStock:0, storm:0, outage:0, pizza:0, couples:[], lastHourly:0, seed, nextEventId:1, version:1 });
  for(const d of AGENT_DEFS){ const a=makeAgent(d); S.agents.push(a); S.byId[a.id]=a; }
  for(const a of S.agents) for(const b of S.agents) if(a!==b) a.rel[b.id]={trust:45,friendship:40,attraction:8,respect:50,resentment:5,familiarity:45,sharedHistory:[]};
  for(const [f,t,o] of REL_SEEDS) Object.assign(S.byId[f].rel[t],o);
  for(const a of S.agents) a.rel && Object.values(a.rel); // noop
  for(const b of S.agents) if(b.id!=='mia') b.rel.mia.trust=Math.min(b.rel.mia.trust,36);
  for(const c of CLAIM_DEFS){
    const claim={id:c.id,about:c.about,target:c.target||null,kind:c.kind,content:c.content,first:c.first||null,secret:c.secret,owner:c.owner,juicy:c.juicy,origin:c.owner,confidedTo:[...(c.confidedTo||[])],public:false,createdAt:S.t,truth:true};
    S.claims[c.id]=claim;
    if(c.owner) S.byId[c.owner].knowledge[c.id]=mkKnow(c.id,c.owner,1,{own:true});
    for(const cid of (c.confidedTo||[])) S.byId[cid].knowledge[c.id]=mkKnow(c.id,c.owner,1,{permitted:[cid]});
    for(const kid of (c.knownBy||[])) S.byId[kid].knowledge[c.id]=mkKnow(c.id,null,0.9,{});
  }
  S.byId.noah.memories.push({id:uid('m'),t:S.t-600,text:'Luna told me in confidence that she likes Alex. I promised not to tell anyone.',imp:8,ids:['luna','alex'],type:'secret'});
  S.byId.mia.memories.push({id:uid('m'),t:S.t-700,text:'Saw Alex and Zara flirting at last night\'s party. Interesting...',imp:6,ids:['alex','zara'],type:'saw'});
  S.byId.luna.memories.push({id:uid('m'),t:S.t-600,text:'I told Noah I like Alex. He promised to keep it secret.',imp:7,ids:['noah','alex'],type:'secret'});
  placeInitial();
  logEvent('system','Day 1 begins. Ten housemates, no script. Everything that happens next is up to them.',[],3);
}
function mkKnow(claimId, sourceAgentId, confidence, o={}){
  return {claimId, sourceAgentId, learnedAt:S.t, confidence, isSecret:!!(S.claims[claimId]&&S.claims[claimId].secret), permittedRecipients:o.permitted||null, own:!!o.own, overheard:!!o.overheard, toldTo:[]};
}
function makeAgent(d){
  const em={happiness:55+rr(-8,8),sadness:12,anger:6,fear:10,jealousy:8,excitement:40,embarrassment:5,loneliness:25,trust:55,affection:45,stress:22};
  if(d.id==='luna'){ em.loneliness=55; em.sadness=22; }
  if(d.id==='zara'){ em.excitement=65; }
  if(d.id==='ethan'){ em.stress=35; }
  const base={...em, sadness:12, anger:6, stress:22, loneliness:d.id==='luna'?40:22, excitement:30+d.p.extraversion*0.3};
  return { id:d.id, name:d.name, archetype:d.archetype, look:d.look, p:d.p, style:d.style, hobby:d.hobby, music:d.music,
    bedroom:BEDROOM_OF[d.id], bedT:d.bed, wakeT:d.wake, open:d.open, close:d.close, fear:d.fear||null, pos:{x:0,y:0}, path:[], face:'down', spot:null, seated:false,
    act:{type:'idle',label:'Hanging around',until:0}, task:null,
    emotions:em, base, needs:{energy:85,hunger:55+rr(0,20),social:55+rr(0,20),fun:60+rr(0,15),privacy:75,rest:75}, bladder:rr(0,50),
    rel:{}, memories:[], knowledge:{}, intentions:[], goals:[...d.goals], goal:d.goals[0],
    convId:null, crying:false, cryCause:'', laughUntil:0, shockUntil:0, flirtUntil:0, bubble:null, reason:'Settling into the day.',
    guilt:{}, avoid:{}, cd:{}, helpCount:0, lastHelpReset:0, partner:null, anim:Math.random()*10, interrupt:false, lastDecideAt:0 };
}
function placeInitial(){
  const h=hourOf(S.t);
  for(const a of S.agents){
    const d=AGENT_DEFS.find(x=>x.id===a.id);
    if(isBedtimeH(d,h)){
      const s=World.spots.find(s=>s.kind==='bed'&&s.owner===a.id);
      a.pos={x:s.ax+0.5,y:s.ay+0.5}; claimSpot(a,s); a.seated=true;
      a.act={type:'sleep',label:'Sleeping',until:S.t+((d.wake*60-(S.t%1440))+1440)%1440};
    } else {
      const rooms=['kitchen','living','kitchen','party','garden','hall'];
      const p=randomFloorIn(a.id==='ryan'?'garden':pick(rooms));
      a.pos={x:p.x+0.5,y:p.y+0.5};
    }
  }
}

// ---------- event log ----------
function logEvent(type,text,ids=[],imp=2,extra={}){
  const ev={id:S.nextEventId++,t:S.t,type,text,ids,imp,...extra};
  S.events.unshift(ev); if(S.events.length>400) S.events.length=400;
  if(typeof onEventLogged==='function') onEventLogged(ev);
  return ev;
}
function addMemory(a,text,imp=3,ids=[],type='misc'){
  a.memories.unshift({id:uid('m'),t:S.t,text,imp,ids,type});
  if(a.memories.length>70){ // keep important ones longer
    const keep=a.memories.slice(0,40); const old=a.memories.slice(40).filter(m=>m.imp>=7).slice(0,25);
    a.memories=keep.concat(old);
  }
}
// ---------- emotions ----------
function feel(a,deltas,cause){
  const p=a.p; const neg=0.55+p.neuroticism/110, pos=0.75+p.extraversion/300;
  for(const k in deltas){
    let d=deltas[k];
    const negKey=['sadness','anger','fear','jealousy','embarrassment','loneliness','stress'].includes(k);
    if(negKey && d>0) d*=neg; else if(!negKey && d>0) d*=pos;
    if(k==='anger' && d>0) d*=0.5+p.temper/100;
    a.emotions[k]=clamp(a.emotions[k]+d);
  }
  if(cause) a.lastFeelCause=cause;
  // crying is caused by meaningful hurt, never timers
  const thr=cryThr(a);
  if(!a.crying && (deltas.sadness||0)>=8 && a.emotions.sadness>=thr && a.act.type!=='sleep') startCrying(a,cause||'feeling overwhelmed');
}
function cryThr(a){ return 68-a.p.neuroticism*0.35; }
function startCrying(a,cause){
  a.crying=true; a.cryCause=cause;
  logEvent('cry',`${a.name} started crying (${cause}).`,[a.id],3);
  addMemory(a,`I broke down crying: ${cause}.`,7,[],'cry');
  const r=roomAtPos(a.pos);
  for(const b of S.agents) if(b!==a && b.act.type!=='sleep' && roomAtPos(b.pos)===r && dist(a.pos,b.pos)<9){
    learnClaim(b, makeClaim({about:a.id,kind:'crying',content:`${a.name} was crying in the ${roomName(r)}`,origin:null,juicy:5}), null, 1, {witnessed:true});
    if(b.p.empathy>55) addIntention(b,{type:'comfort',target:a.id,cause,urg:b.p.empathy*0.9+(b.rel[a.id].friendship-40)});
  }
  if(!a.convId) a.interrupt=true;
}
function decayEmotions(a,dtm){
  const k=(0.0018+(100-a.p.neuroticism)/100*0.0042)*dtm;
  for(const e of EMO_KEYS){ const b=a.base[e]; a.emotions[e]+= (b-a.emotions[e])*k; }
  // needs feed emotions gently
  if(a.needs.social<30) a.emotions.loneliness=clamp(a.emotions.loneliness+0.05*dtm);
  if(a.needs.energy<25 || a.needs.hunger<25) a.emotions.stress=clamp(a.emotions.stress+0.04*dtm);
  if(a.crying && a.emotions.sadness<cryThr(a)-14){ a.crying=false; logEvent('mood',`${a.name} stopped crying.`,[a.id],1); }
}
// ---------- relationships ----------
function relChange(a,bId,ch,cause,log=true){
  const r=a.rel[bId]; if(!r) return;
  const mult = a.id==='ivy'?1.4:1;
  let total=0; const parts=[];
  for(const k in ch){ const before=r[k]; r[k]=clamp(r[k]+ch[k]*mult); const d=r[k]-before; total+=Math.abs(d); if(Math.abs(d)>=0.5) parts.push(`${k} ${d>0?'+':''}${d.toFixed(0)}`); }
  if(!parts.length) return;
  r.familiarity=clamp(r.familiarity+0.5);
  const entry={t:S.t,from:a.id,to:bId,cause,changes:parts.join(', ')};
  r.sharedHistory.unshift(`${fmtTime(S.t)} ${cause} (${parts.join(', ')})`); if(r.sharedHistory.length>14) r.sharedHistory.length=14;
  S.relLog.unshift(entry); if(S.relLog.length>500) S.relLog.length=500;
  if(log && total>=12) logEvent('relationship',`${a.name}'s view of ${nm(bId)} changed: ${parts.join(', ')} — ${cause}.`,[a.id,bId],1);
}
function relLabel(r){
  if(r.partner) return 'Partner';
  if(r.resentment>65) return 'Enemy';
  if(r.attraction>58) return 'Crush';
  if(r.resentment>42 && r.respect>45) return 'Rival';
  if(r.trust<25) return 'Distrusts';
  if(r.friendship>70 && r.trust>68) return 'Close friend';
  if(r.friendship>58) return 'Friend';
  if(r.resentment>35) return 'Annoyed';
  return 'Housemate';
}
// ---------- knowledge / gossip with provenance ----------
function makeClaim(o){
  const c={id:uid('c'),about:o.about,target:o.target||null,kind:o.kind||'said',content:o.content,first:o.first||null,secret:!!o.secret,owner:o.owner||null,juicy:o.juicy||4,origin:o.origin||null,confidedTo:[],public:false,createdAt:S.t,truth:o.truth!==false,parent:o.parent||null};
  S.claims[c.id]=c; return c.id;
}
function knows(a,claimId){ return !!a.knowledge[claimId]; }
// a hears claim from source. returns true if new
function learnClaim(a,claimId,sourceId,clarity=1,o={}){
  const c=S.claims[claimId]; if(!c) return false;
  const src=sourceId?A(sourceId):null;
  const cred = src ? (0.35+a.rel[sourceId].trust/160) : 0.95;
  const conf = clamp(cred*clarity,0.05,1);
  const k=a.knowledge[claimId];
  if(src && a.knowledge[claimId]){ k.confidence=clamp(k.confidence+conf*0.3,0,1); }
  const isNew=!k;
  if(isNew){
    a.knowledge[claimId]=mkKnow(claimId,sourceId,conf,{overheard:o.overheard,permitted:o.permitted});
    const how = o.witnessed?'saw':o.overheard?'overheard':'heard';
    addMemory(a, o.witnessed?`Saw it myself: ${c.content}.`:`${how==='overheard'?'Overheard':'Heard from'} ${nm(sourceId)}${how==='overheard'?' say':''}: "${c.content}"${o.permitted?' (in confidence)':''}.`, Math.min(9,2+Math.round(c.juicy*0.6)), [sourceId,c.about].filter(Boolean), 'fact');
  }
  if(src && src.knowledge[claimId] && !src.knowledge[claimId].toldTo.includes(a.id)) src.knowledge[claimId].toldTo.push(a.id);
  reactToClaim(a,c,sourceId,o,isNew);
  // gossip-prone agents feel the urge to pass juicy news on (independent decision later)
  if(isNew && c.juicy>=6 && a.p.gossip>45 && c.about!==a.id && c.owner!==a.id){
    const fr=others(a).filter(b=>b.id!==c.about&&b.id!==sourceId&&b.id!==c.target&&!(b.knowledge[c.id])).sort((x,y)=>a.rel[y.id].trust+a.rel[y.id].friendship-a.rel[x.id].trust-a.rel[x.id].friendship)[0];
    const k=a.knowledge[c.id];
    const restraint = (k&&k.permittedRecipients? a.p.discretion*0.9:0) + (c.secret?a.p.discretion*0.3:0);
    if(fr) addIntention(a,{type:'tell',target:fr.id,claimId:c.id,cause:c.content,urg:a.p.gossip*0.55+c.juicy*3-restraint});
  }
  return isNew;
}
function reactToClaim(a,c,sourceId,o,isNew){
  // 1) my secret is out
  if(c.secret && !c.public && c.owner===a.id && sourceId && sourceId!==a.id){
    discoverLeak(a,c,sourceId,o);
    return;
  }
  if(!isNew) return;
  // 2) someone said something about me behind my back
  if(c.about===a.id && ['mocked','complaint','said','rumor'].includes(c.kind) && c.origin && c.origin!==a.id){
    const misread = (a.p.misread||30)/100;
    const sting = (c.kind==='mocked'? 12:16) * (0.6+misread) * (c.truth===false?1.2:1);
    feel(a,{anger:sting*(a.p.temper/70),embarrassment:sting*0.6,sadness:sting*(a.p.neuroticism/120),trust:-5},`hearing that ${nm(c.origin)} talked about them behind their back`);
    relChange(a,c.origin,{resentment:sting,trust:-sting*0.6,friendship:-sting*0.4},`heard ${nm(c.origin)} talked about them behind their back`);
    addMemory(a,`${nm(c.origin)} talked about me behind my back: "${c.content}". I'm not okay with that.`,8,[c.origin],'hurt');
    if(a.emotions.anger>35 || a.p.temper>60) addIntention(a,{type:'confront',target:c.origin,claimId:c.id,cause:`saying "${c.content}" behind my back`,urg:40+a.emotions.anger*0.6+a.p.temper*0.3});
    logEvent('rumor',`${a.name} found out what ${nm(c.origin)} said about them.`,[a.id,c.origin],3);
  }
  // 3) jealousy: someone I'm into is involved with someone else
  const involved=[c.about,c.target].filter(Boolean);
  if(['crush','flirt','couple'].includes(c.kind) && involved.length===2 && !involved.includes(a.id)){
    for(const x of involved){
      const other=involved.find(y=>y!==x);
      if(a.rel[x] && a.rel[x].attraction>50){
        feel(a,{jealousy:18,sadness:8,anger:4},`learning that ${c.content}`);
        relChange(a,other,{resentment:9,trust:-4},`jealous: ${c.content}`);
        addMemory(a,`It hurt to hear that ${c.content}.`,7,[x,other],'jealous');
        logEvent('jealousy',`${a.name} is jealous after hearing that ${c.content}.`,[a.id,x,other],3);
        break;
      }
    }
  }
  // 4) someone likes me
  if(c.kind==='crush' && c.target===a.id && c.about!==a.id){
    const r=a.rel[c.about];
    feel(a,{excitement:10,embarrassment:8,happiness:r.attraction>40?10:0},`learning ${nm(c.about)} likes them`);
    relChange(a,c.about,{attraction:r.attraction>35?10:3,familiarity:4},`found out ${nm(c.about)} has feelings for them`);
    addMemory(a,`Apparently ${c.content}... I didn't know that.`,8,[c.about],'crush');
    logEvent('crush',`${a.name} found out that ${c.content}.`,[a.id,c.about],4);
  }
}
function discoverLeak(owner,c,knowerId,o){
  const key='leak_'+c.id+'_'+knowerId; if(owner.cd[key]) return; owner.cd[key]=S.t;
  const root=c.parent&&S.claims[c.parent]?S.claims[c.parent]:c; const confidants=root.confidedTo.filter(x=>x!==owner.id);
  // who does the owner blame? if the knower IS a confidant spreading it, it's certain. Else suspect a confidant.
  let blamed=null, certain=false;
  const knowerK=A(knowerId).knowledge[c.id];
  if(confidants.includes(knowerId)) { blamed=knowerId; certain=true; }
  else if(knowerK && knowerK.sourceAgentId && confidants.includes(knowerK.sourceAgentId) && (o.citedSource || A(knowerId).p.discretion<40)) { blamed=knowerK.sourceAgentId; certain=true; }
  else if(confidants.length){ blamed=confidants.slice().sort((x,y)=>owner.rel[x].trust-owner.rel[y].trust)[0]; certain=false; }
  feel(owner,{embarrassment:22,sadness:blamed?30:12,anger:blamed?14:6,fear:10,trust:-10,stress:15},`finding out ${nm(knowerId)} knows their secret`);
  addMemory(owner,`${nm(knowerId)} knows my secret ("${c.content}"). ${blamed?`${certain?'':'I think '}${nm(blamed)} told people. I trusted them.`:'How did it get out?'}`,9,[knowerId,blamed].filter(Boolean),'betrayal');
  if(blamed){
    relChange(owner,blamed,{trust:certain?-38:-24,resentment:certain?32:20,friendship:-15},`${certain?'betrayed':'suspects betrayal'}: secret "${c.content}" leaked`);
    addIntention(owner,{type:'confront',target:blamed,claimId:c.id,cause:`telling people my secret`,urg:55+owner.emotions.anger*0.4,leak:true});
    logEvent('betrayal',`${owner.name} discovered their secret is out and ${certain?'knows':'suspects'} ${nm(blamed)} leaked it.`,[owner.id,blamed,knowerId],5);
  } else {
    logEvent('secret',`${owner.name} realized ${nm(knowerId)} knows their secret.`,[owner.id,knowerId],4);
  }
  relChange(owner,knowerId,{trust:-8,resentment:6},`spreading my secret`,false);
}
// ---------- intentions ----------
function addIntention(a,it){
  const ex=a.intentions.find(x=>x.type===it.type&&x.target===it.target);
  if(ex){ ex.urg=Math.max(ex.urg,it.urg); Object.assign(ex,{...it,urg:ex.urg}); return; }
  it.createdAt=S.t; a.intentions.push(it);
  if(a.intentions.length>8){ a.intentions.sort((x,y)=>y.urg-x.urg); a.intentions.length=8; }
  if(it.urg>70) a.interrupt=true;
}
function dropIntention(a,type,target){ a.intentions=a.intentions.filter(x=>!(x.type===type&&(!target||x.target===target))); }

// ---------- spots ----------
function spotById(id){ return World.spotMap[id]; }
function findSpot(a,kinds,o={}){
  kinds=[].concat(kinds); let best=null, bd=1e9;
  for(const s of World.spots){
    if(!kinds.includes(s.kind)) continue;
    if(s.occ && s.occ!==a.id) continue;
    if(s.owner && s.owner!==a.id) continue;
    if(o.room && s.room!==o.room) continue;
    if(S.storm>0 && (s.room==='garden'||s.room==='balcony')) continue;
    if(o.avoid && o.avoid.some(id=>{ const b=A(id); return b && dist(b.pos,{x:s.ax+0.5,y:s.ay+0.5})<5; })) continue;
    let d=Math.hypot(s.ax+0.5-a.pos.x,s.ay+0.5-a.pos.y)+(o.noise?rnd()*o.noise:0);
    if(o.near){ const b=A(o.near); if(b) d=Math.hypot(s.ax+0.5-b.pos.x,s.ay+0.5-b.pos.y); }
    if(d<bd){ bd=d; best=s; }
  }
  return best;
}
function claimSpot(a,s){ releaseSpot(a); if(s){ s.occ=a.id; a.spot=s.id; } }
function releaseSpot(a){ if(a.spot){ const s=spotById(a.spot); if(s&&s.occ===a.id) s.occ=null; } a.spot=null; }
