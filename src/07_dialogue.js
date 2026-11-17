// ================= DIALOGUE PLANNING (what does this agent want to do with their turn?) =================
function planTurn(sp,c){
  const os=c.participants.filter(x=>x!==sp.id).map(A);
  const last=c.lines[c.lines.length-1];
  const one=os.length===1?os[0]:null;
  if(c.turns===0 && sp.id===c.initiator) return openPlan(sp,c,os);
  if(c.purpose==='game') return gamePlan(sp,c,os,last);
  if(c.flags.mediator===sp.id && !c.flags.didMediate){ c.flags.didMediate=1; return {intent:'mediate',to:null}; }
  if(c.flags.interrupter===sp.id && !c.flags.didInterrupt){ c.flags.didInterrupt=1; const it=sp.intentions.find(i=>i.type==='defend'); dropIntention(sp,'defend'); return {intent:sp.id==='noah'?'strong_opinion':'defend',to:it&&c.participants.includes(it.target)?it.target:c.lastSpeaker}; }
  if(last && last.speaker!==sp.id && (last.to===sp.id || (one && last.speaker===one.id) || !last.to)){ const r=reactPlan(sp,c,last,os); if(r) return r; }
  return freePlan(sp,c,os);
}
function openPlan(sp,c,os){
  const d=c.data||{}, to=os[0];
  switch(c.purpose){
    case 'gossip': case 'tell': { const g=(d.claimId&&knows(sp,d.claimId))?{claimId:d.claimId}:pickGossipFor(sp,os); return g?gossipPlan(sp,g.claimId,to):{intent:'greet',to:to.id}; }
    case 'confide': { const cl=ownUnsharedSecret(sp,to.id); return cl?{intent:'confide',to:to.id,claimId:cl.id}:{intent:'greet',to:to.id}; }
    case 'confront': return {intent:'confront',to:to.id,claimId:d.claimId,cause:d.cause||'what happened',leak:d.leak};
    case 'apologize': return {intent:'apologize',to:to.id,cause:d.cause||sp.guilt[to.id]||'what happened'};
    case 'comfort': return {intent:'comfort',to:to.id};
    case 'flirt': return {intent:'flirt',to:to.id};
    case 'confess': return {intent:'confess',to:to.id};
    case 'ask_about': return {intent:'ask_about',to:to.id,aboutId:d.subject||curiousSubject(sp,to)};
    case 'invite': return {intent:'invite',to:to.id};
    case 'ally': return {intent:'ally',to:to.id};
    case 'joke': return jokePlan(sp,c,os);
    default: return {intent:'greet',to:to.id};
  }
}
function gossipPlan(sp,claimId,to){
  let c=S.claims[claimId];
  if(sp.p.exaggerate && !c.parent && !sp.cd['dist_'+c.id] && chance(sp.p.exaggerate/100*0.45)){ const v=distortClaim(c); sp.cd['dist_'+c.id]=v; const pk=sp.knowledge[claimId]; if(pk) pk.toldTo.push(...(to?[to.id]:[])); sp.knowledge[v]=mkKnow(v,sp.knowledge[claimId]?sp.knowledge[claimId].sourceAgentId:null,1,{}); claimId=v; c=S.claims[v]; }
  const k=sp.knowledge[claimId];
  return {intent:c.secret&&!c.public?'reveal':'gossip',to:to?to.id:null,claimId,citeSource:!!(k&&k.sourceAgentId&&chance((100-sp.p.discretion)/130)),sourceId:k?k.sourceAgentId:null};
}
function distortClaim(c){
  const X=nm(c.about), Y=c.target?nm(c.target):'';
  const map={crush:`${X} is completely obsessed with ${Y}`,flirt:`${X} and ${Y} were all over each other`,feeling:`${X} is totally falling apart`,fight:`${X} and ${Y} basically screamed at each other`,crying:`${X} was sobbing for, like, an hour`,couple:`${X} and ${Y} are basically moving in together`};
  const content=map[c.kind]||`${c.content}, and honestly it's way worse than it sounds`;
  const id=makeClaim({about:c.about,target:c.target,kind:c.kind,content,secret:c.secret,owner:c.owner,juicy:Math.min(10,c.juicy+2),truth:false,parent:c.id});
  S.claims[id].origin=c.origin;
  return id;
}
function jokePlan(sp,c,os){
  const absent=S.agents.filter(x=>x!==sp && !c.participants.includes(x.id));
  if(absent.length && chance(0.5)){ const tgt=pick(absent); return {intent:'joke_about',to:os[0]?os[0].id:null,aboutId:tgt.id,newClaim:{about:tgt.id,kind:'mocked',content:`${sp.name} joked that ${tgt.name} ${ROASTS[tgt.id]}`,juicy:6}}; }
  if(os.length && chance(0.5)){ const t=pick(os); return {intent:'joke',to:t.id,tease:true}; }
  return {intent:'joke',to:os[0]?os[0].id:null};
}
function ownClaim(sp,kinds){ return Object.values(sp.knowledge).map(k=>S.claims[k.claimId]).filter(c=>c&&c.owner===sp.id&&!c.public&&(!kinds||kinds.includes(c.kind))); }
function gamePlan(sp,c,os,last){
  if(last && last.intent==='game_ask' && last.to===sp.id){
    const q=last.q||'secret';
    const brave=sp.p.impulsivity*0.4+sp.p.extraversion*0.2+sp.emotions.excitement*0.3-sp.p.discretion*0.3+rr(0,35);
    if(q==='crush'||q==='secret'){
      const cl=ownClaim(sp,q==='crush'?['crush']:null);
      if(cl.length && brave>52) return {intent:'game_answer',to:last.speaker,claimId:pick(cl).id,q};
      if(!cl.length && brave>25) return {intent:'game_answer',to:last.speaker,q,none:true};
      return {intent:'game_dodge',to:last.speaker,q};
    }
    if(q==='annoy'){
      const cands=others(sp).sort((x,y)=>sp.rel[y.id].resentment-sp.rel[x.id].resentment);
      const t=cands[0];
      if(t && sp.rel[t.id].resentment>18 && brave>25) return {intent:'game_answer',to:last.speaker,q,aboutId:t.id,newClaim:{about:t.id,kind:'complaint',content:`${sp.name} said ${t.name} annoys them the most`,juicy:6}};
      return {intent:'game_dodge',to:last.speaker,q};
    }
    return {intent:'game_answer',to:last.speaker,q:'dare'};
  }
  const cand=os.filter(o=>!last||o.id!==last.speaker);
  const t=pick(cand.length?cand:os);
  const q=pick(['crush','secret','annoy','dare','dare']);
  return {intent:'game_ask',to:t.id,q};
}
function reactPlan(sp,c,last,os){
  const from=A(last.speaker); if(!from) return null;
  const claim=last.claimIds&&last.claimIds.length?S.claims[last.claimIds[0]]:null;
  const r=sp.rel[from.id], e=sp.emotions, p=sp.p;
  const W=(o)=>weightedPick(o.filter(x=>x.score>0),12);
  switch(last.intent){
    case 'ask_about': {
      const subj=last.aboutId; const ks=Object.values(sp.knowledge).map(k=>S.claims[k.claimId]).filter(cl=>cl&&cl.about===subj&&cl.owner!==sp.id).sort((a,b)=>b.juicy-a.juicy);
      if(!ks.length) return {intent:'dunno',to:from.id,aboutId:subj};
      const cl=ks[0]; const k=sp.knowledge[cl.id];
      if(!cl.secret || cl.public) return gossipPlan(sp,cl.id,from);
      const owner=cl.owner; let s=(100-p.discretion)*0.55+r.trust*0.3+p.gossip*0.3-(sp.rel[owner]?sp.rel[owner].friendship*0.45:0)-(k.permittedRecipients?p.discretion*0.5:0)+rr(0,30)-20;
      if(owner===from.id) s=-99;
      return s>25? gossipPlan(sp,cl.id,from) : {intent:'keep_secret',to:from.id,ownerId:owner,aboutId:subj};
    }
    case 'gossip': case 'reveal': {
      if(!claim) return {intent:'react',to:from.id};
      if(claim.owner===sp.id) return {intent:'confront',to:from.id,claimId:claim.id,cause:'spreading my secret',leak:true};
      if(claim.about===sp.id) return {intent:p.temper>60?'insult':'offended',to:from.id};
      if(claim.target===sp.id && claim.kind==='crush') return {intent:'react',to:from.id,shock:true};
      if(p.discretion>75 || (p.agreeableness>85&&claim.secret)) return {intent:'caution',to:from.id};
      const g=pickGossipFor(sp,[from]); if(g && g.score>48 && p.gossip>50 && chance(0.6)) return gossipPlan(sp,g.claimId,from);
      return {intent:'react',to:from.id};
    }
    case 'confide': return {intent:'support',to:from.id};
    case 'confront': {
      const cl=last.claimId?S.claims[last.claimId]:null;
      const guilty = !!sp.guilt[from.id] || (cl && (cl.origin===sp.id || (cl.secret && sp.knowledge[cl.id] && sp.knowledge[cl.id].toldTo.length>0)));
      if(!guilty) return W([{intent:'deny',to:from.id,score:70},{intent:'insult',to:from.id,score:p.temper*0.3+e.anger*0.4-25}]);
      return W([{intent:'apologize',to:from.id,cause:last.cause||'that',score:p.agreeableness*0.6+(sp.guilt[from.id]?20:0)+(100-e.anger)*0.2},
                {intent:'deflect',to:from.id,score:p.humor*0.45+(100-p.agreeableness)*0.2},
                {intent:'insult',to:from.id,score:p.temper*0.4+e.anger*0.5-30}]);
    }
    case 'deny': return W([{intent:'calm',to:from.id,believe:true,score:r.trust*0.8+p.agreeableness*0.2+rr(-10,10)-10},{intent:'insult',to:from.id,score:e.anger*0.5+p.temper*0.2-20},{intent:'leave',to:from.id,score:30}]);
    case 'deflect': return W([{intent:'insult',to:from.id,score:e.anger*0.6+p.temper*0.3-25},{intent:'leave',to:from.id,score:35},{intent:'calm',to:from.id,score:p.agreeableness*0.4}]);
    case 'apologize': { const s=p.agreeableness*0.5+r.friendship*0.3-r.resentment*0.6+rr(0,30)+(S.t-(last.t||S.t))*0; return s>22?{intent:'forgive',to:from.id}:{intent:'refuse',to:from.id}; }
    case 'forgive': return {intent:'thank',to:from.id};
    case 'refuse': return e.sadness>55?{intent:'cry_out',to:from.id}:{intent:'leave',to:from.id};
    case 'insult': case 'offended': case 'defend': case 'strong_opinion':
      return W([{intent:'insult',to:from.id,score:p.temper*0.5+e.anger*0.4-20},{intent:'cry_out',to:from.id,score:p.neuroticism*0.5+e.sadness*0.5-30},
                {intent:'defend',to:from.id,score:35},{intent:'leave',to:from.id,score:e.stress*0.4+10},
                {intent:'apologize',to:from.id,score:(sp.guilt[from.id]?p.agreeableness*0.5:0)-e.anger*0.3}]);
    case 'mediate': return e.anger>70&&p.temper>60?{intent:'insult',to:c.participants.find(x=>x!==sp.id&&x!==from.id)||from.id}:{intent:'calm',to:from.id};
    case 'comfort': { const cl=ownUnsharedSecret(sp,from.id); if(cl && r.trust>55 && chance(0.5)) return {intent:'confide',to:from.id,claimId:cl.id}; return {intent:'thank',to:from.id}; }
    case 'flirt': { const flirts=c.lines.filter(l=>l.intent==='flirt').length;
      if(r.attraction>72 && r.trust>45 && flirts>=2 && !sp.partner) return {intent:'confess',to:from.id};
      return r.attraction>45?{intent:'flirt',to:from.id}:{intent:'awkward',to:from.id}; }
    case 'confess': return (r.attraction>55&&!sp.partner)?{intent:'accept_love',to:from.id}:{intent:'reject_love',to:from.id};
    case 'invite': { const ok=S.party&&S.party.active? partyAttendScore(sp).score+15>40 : sp.needs.energy>40; return {intent:ok?'accept':'decline',to:from.id}; }
    case 'ally': return (r.trust>40&&p.ambition>40)||chance(0.4)?{intent:'accept_ally',to:from.id}:{intent:'decline',to:from.id};
    case 'joke': if(last.offended&&last.offended.includes(sp.id)) return {intent:'offended',to:from.id}; return chance(0.3+p.humor/200)?{intent:'laugh',to:from.id}:(p.humor>70?jokePlan(sp,c,os):null);
    case 'joke_about': if(sp.rel[last.aboutId]&&sp.rel[last.aboutId].friendship>62&&p.empathy>55) return {intent:'caution',to:from.id}; return {intent:'laugh',to:from.id};
    case 'complain': if(sp.rel[last.aboutId]&&sp.rel[last.aboutId].friendship>62) return {intent:'defend',to:from.id}; return null;
  }
  return null;
}
function freePlan(sp,c,os){
  const one=os.length===1?os[0]:null, p=sp.p, e=sp.emotions;
  const opts=[{intent:'chat',to:one?one.id:null,score:30}];
  const gc=c.lines.filter(l=>l.speaker===sp.id&&(l.intent==='gossip'||l.intent==='reveal')).length;
  const g=gc<2?pickGossipFor(sp,os):null; if(g && g.score>35) opts.push({...gossipPlan(sp,g.claimId,one||os[0]),score:g.score*0.5*p.gossip/60});
  if(p.humor>55) opts.push({...jokePlan(sp,c,os),score:p.humor*0.32});
  opts.push({intent:'compliment',to:(one||pick(os)).id,score:p.agreeableness*0.12+(one?sp.rel[one.id].friendship*0.1:0)});
  if(one && sp.rel[one.id].attraction>55 && !(sp.partner&&sp.partner!==one.id)) opts.push({intent:'flirt',to:one.id,score:sp.rel[one.id].attraction*0.45*p.flirt/60});
  if(one && sp.rel[one.id].attraction>72 && sp.rel[one.id].trust>50 && !sp.partner && c.lines.some(l=>l.intent==='flirt')) opts.push({intent:'confess',to:one.id,score:40});
  if(one && sp.rel[one.id].trust>66 && (e.loneliness>45||e.sadness>40||(sp.id==='ethan'&&sp.helpCount>=3))){ const cl=ownUnsharedSecret(sp,one.id); if(cl) opts.push({intent:'confide',to:one.id,claimId:cl.id,score:35+(sp.id==='ethan'?sp.helpCount*6:0)}); }
  const absentRes=S.agents.filter(x=>x!==sp&&!c.participants.includes(x.id)).sort((x,y)=>sp.rel[y.id].resentment-sp.rel[x.id].resentment)[0];
  if(absentRes && sp.rel[absentRes.id].resentment>38 && !c.lines.some(l=>l.speaker===sp.id&&l.intent==='complain')){ const adj=pick(COMPLAINTS); opts.push({intent:'complain',to:one?one.id:null,aboutId:absentRes.id,adj,newClaim:{about:absentRes.id,kind:'complaint',content:`${sp.name} said ${absentRes.name} has been ${adj} lately`,juicy:6},score:sp.rel[absentRes.id].resentment*0.4*(1-p.discretion/200)}); }
  if(p.gossip>70 && one){ const subj=curiousSubject(sp,one); if(subj) opts.push({intent:'ask_about',to:one.id,aboutId:subj,score:22}); }
  if(S.party&&S.party.active && roomAtPos(sp.pos)!=='party' && p.extraversion>70 && one) opts.push({intent:'invite',to:one.id,score:22});
  opts.push({intent:'leave',to:null,score:(c.turns/Math.max(1,c.maxTurns))*55+e.stress*0.2+(100-p.extraversion)*0.15-12});
  if(c.tone<=-2){
    const tgt=os.slice().sort((x,y)=>sp.rel[y.id].resentment-sp.rel[x.id].resentment)[0];
    opts.push({intent:'insult',to:tgt.id,score:e.anger*0.55-10});
    opts.push({intent:'calm',to:tgt.id,score:p.agreeableness*0.35});
    opts.push({intent:'leave',to:null,score:40});
    if(sp.guilt[tgt.id] && e.anger<45) opts.push({intent:'apologize',to:tgt.id,cause:sp.guilt[tgt.id],score:p.agreeableness*0.5});
  }
  const ch=weightedPick(opts,12)||opts[0];
  return ch;
}

// ================= OFFLINE DIALOGUE ENGINE (fallback when Claude is off/busy) =================
const BANK={
 greet:['Hey {T}! What\'s up?','Oh hey, {T}.','{T}! There you are.','Hey, got a sec?','Hi {T}, how\'s it going?'],
 chat:['How\'s your day going?','Did you sleep okay?','This house is never quiet, huh?','What are you up to later?','I can\'t believe how fast this week is going.','Honestly I just needed to talk to someone normal today.','Do you ever miss living alone?','What\'s the plan for tonight?'],
 react:['No way.','Wait, seriously?','Huh. Okay.','That\'s wild.','Interesting...','Oh wow.','Shut up. Really?'],
 gossip:['Did you hear? {C}.','Okay, don\'t freak out, but {C}.','So apparently {C}.','You didn\'t hear this from me, but {C}.','Guess what I found out — {C}.'],
 reveal:['Can you keep a secret? {C}.','Promise you won\'t tell anyone... {C}.','Okay, this is big: {C}.','I probably shouldn\'t say this, but {C}.'],
 keep_secret:['That\'s not mine to share.','I really can\'t say.','Ask them yourself.','I don\'t know anything about that.','No comment.'],
 dunno:['No idea, honestly.','Haven\'t heard anything.','Why, what did you hear?','Nothing that I know of.'],
 ask_about:['What\'s the deal with {X} lately?','Have you noticed anything about {X}?','Okay, what do you know about {X}?','Is something going on with {X}?'],
 caution:['Don\'t spread that unless you\'re sure.','Careful. That could really hurt someone.','Maybe keep that to yourself.','Are you sure that\'s even true?'],
 confide:['Can I tell you something? {F}.','I\'ve never said this out loud, but {F}.','Please don\'t tell anyone... {F}.'],
 support:['Thank you for telling me. Your secret\'s safe.','That means a lot that you told me.','I won\'t tell a soul. I promise.','I\'m really glad you said something.'],
 confront:['We need to talk about {CAUSE}.','Did you really think I wouldn\'t find out about {CAUSE}?','Why are you {CAUSE}?','I heard about {CAUSE}. Seriously?'],
 confront_leak:['How could you tell people my secret?','I trusted you, and you told people?','I told you that in confidence!','Who else did you tell?'],
 deny:['I never said anything, I swear.','What? That wasn\'t me.','I didn\'t tell anyone. I promise.','You\'ve got the wrong person.'],
 deflect:['It was a joke! You\'re taking it too seriously.','Relax, it\'s not a big deal.','Come on, everyone knows I\'m kidding.'],
 apologize:['I\'m sorry. I mean it.','I messed up. I\'m really sorry about {CAUSE}.','Look... I shouldn\'t have done that. I\'m sorry.','I\'ve been thinking about it. I owe you an apology.'],
 forgive:['Okay. I forgive you.','Thank you for saying that. We\'re good.','...Fine. Just don\'t do it again.','I appreciate it. Let\'s move on.'],
 refuse:['Sorry doesn\'t fix it.','I\'m not ready to forgive you.','You always say that.','No. Not this time.'],
 insult:['You always do this.','Wow. You\'re unbelievable.','You know what? You\'re so fake.','You only care about yourself.','Grow up.','You always say that when you hurt someone.'],
 defend:['Hey, back off.','That\'s not fair and you know it.','Leave it alone.','Enough. That\'s out of line.'],
 strong_opinion:['Actually, no. That was cruel, and everyone here knows it.','I\'ve been quiet, but this is wrong.','Stop. You don\'t get to treat people like that.'],
 comfort:['Hey... hey. I\'m here.','Do you want to talk about it?','It\'s okay to be upset. Come here.','You don\'t have to go through this alone.'],
 thank:['Thanks. Really.','I needed that.','Thank you... seriously.','That actually helps.'],
 flirt:['You look really good tonight.','Has anyone told you that you have the best laugh in this house?','So... are you saving a dance for me?','I like talking to you. Like, a lot.'],
 awkward:['Oh! Ha... um. Thanks?','...Okay then.','That\'s... sweet.','Haha, anyway—'],
 joke:['Why did the scarecrow get promoted? He was outstanding in his field.','I tried to make a belt out of watches. Total waist of time.','This house has more drama than a reality show. Wait—','I\'m on a seafood diet. I see food and I eat it.','I told the fridge a joke. It\'s still cracking up. Ice.'],
 tease:['No offense, {T}, but everyone knows you\'re the one who {R}.','{T}! My favorite housemate who {R}.','Fun fact: {T} {R}. Love you though.'],
 joke_about:['You know {X} {R}, right?','Okay but {X} {R}.','Not to be mean, but {X} {R}.'],
 laugh:['Hahaha!','Stop, I can\'t—','Okay that\'s actually funny.','LOL. Okay.'],
 offended:['Is that supposed to be funny?','Wow. Okay.','That\'s not funny.','Real nice.'],
 compliment:['You\'re honestly the best part of this house.','I love your energy today.','You always know what to say.','That outfit is amazing.'],
 complain:['Honestly, {X} has been {ADJ} lately.','Is it just me or is {X} being {ADJ}?','I\'m so done with {X}. They\'re {ADJ}.'],
 invite:['There\'s a party in the hall — come!','You coming to the party?','Come dance with us!'],
 accept:['I\'m in!','Yeah, let\'s go.','Sure, why not.'],
 decline:['Maybe later.','I\'ll pass tonight.','Not really in the mood.'],
 mediate:['Okay, let\'s all take a breath.','Hey, hey. Let\'s talk this out calmly.','Nobody\'s winning this. Let\'s slow down.','You both care about this. Can we start over?'],
 calm:['...Okay. Maybe I overreacted.','Fine. I\'m calming down.','Alright. I hear you.'],
 believe:['...Okay. I believe you.','Alright. Sorry for jumping on you.'],
 ally:['You and me should stick together in this house.','I think we\'d make a good team.','People listen to you. I\'d rather be on your side.'],
 accept_ally:['Deal.','I like that idea.','Alright. Team.'],
 confess:['I have to tell you something. I really like you.','I can\'t keep pretending. I have feelings for you.','Okay... I like you. Like, like-like you.'],
 accept_love:['...I like you too.','Honestly? I was hoping you\'d say that.','Yes. Me too.'],
 reject_love:['I... I don\'t feel the same way. I\'m sorry.','You\'re amazing, but I see you as a friend.','I\'m sorry. I don\'t think that\'s what I want.'],
 game_ask_crush:['Truth, {T}: who in this house do you have a crush on?'],
 game_ask_secret:['Truth, {T}: what\'s a secret you\'ve never told anyone here?'],
 game_ask_annoy:['Truth, {T}: who in this house annoys you the most?'],
 game_ask_dare:['{T}, truth or dare? ...Dare it is.'],
 game_answer:['Okay... fine. {F}.','Ugh. Truth? {F}.','You really want to know? {F}.'],
 game_answer_annoy:['Honestly? {X}. Sorry, not sorry.','...{X}. There, I said it.'],
 game_answer_dare:['Dare? Watch this—','Fine. Bring it.','I\'ll do it. Don\'t film this.'],
 game_answer_none:['Honestly? Nobody. Boring, I know.','Nothing interesting, sorry!'],
 game_dodge:['Pass! Next question.','Nope. Not answering that.','I plead the fifth.','Ha, nice try.'],
 leave:['Anyway, I\'m gonna go.','I\'ll catch you later.','I need some air.','Okay, I\'m heading off.'],
 leave_hostile:['I\'m done with this.','Forget it. I\'m out.','I can\'t talk to you right now.'],
 cry_out:['I can\'t do this right now...','Just... leave me alone.','Why does this always happen to me...'],
};
const CHAR_BANK={
 chat:{alex:['We need to do something big this weekend.','Who\'s in for a party later?'],mia:['Okay I have SO much to tell you.','Have you noticed the vibe in this house lately?'],ryan:['Hit a new personal best on pull-ups today.','I\'m starving. Is Ethan cooking?'],luna:['I started a new painting. It\'s... the house, kind of.','Do you ever feel like nobody really sees you?'],max:['I\'ve got a new bit, wanna hear it?','Rate my outfit. Be honest. Actually don\'t.'],sophia:['Have you noticed who\'s been sitting with whom lately?','This house runs on alliances. It\'s fascinating.'],noah:['...Nice night.','Hm. It\'s quiet for once.'],zara:['I\'m SO bored. Let\'s do something crazy.','Pool party? Dance-off? Anything!'],ethan:['I made extra food if you\'re hungry.','How are you holding up, really?'],ivy:['What if we all switched rooms for a day?','Everyone here is pretending. It\'s kind of beautiful.']},
 greet:{noah:['Hey.','...Hi, {T}.'],zara:['{T}!! Hiii!'],mia:['{T}! Babe, come here.']},
 flirt:{zara:['Dance with me? Don\'t make me beg.','You\'re kind of trouble, aren\'t you?'],alex:['You know you\'re the only one here who can keep up with me.'],mia:['You\'re cute when you\'re focused, you know that?']},
 insult:{ryan:['You always say that when you hurt someone.','Don\'t even start with me.'],ivy:['You\'re all so predictable.'],sophia:['You\'re not as clever as you think you are.']},
 comfort:{ethan:['Hey. Breathe with me. You\'re okay.','I\'m not going anywhere. Talk to me.']},
 react:{noah:['Hm.','...Huh.'],zara:['NO WAY!','Stoppp!']},
};
function fill(t,v){ return t.replace(/\{(\w+)\}/g,(_,k)=>v[k]!==undefined?v[k]:''); }
function lowerFirst(s){ if(!s) return s; const w=s.split(/[\s,']/)[0]; if(AGENT_DEFS.some(d=>d.name===w)||w==='I') return s; return s[0].toLowerCase()+s.slice(1); }
function offlineTurn(c,sp,plan){
  const i=plan.intent; const to=plan.to?A(plan.to):null;
  const claim=plan.claimId?S.claims[plan.claimId]:null;
  const v={T:to?to.name:'everyone',X:plan.aboutId?nm(plan.aboutId):'them',C:claim?lowerFirst(claim.content):'',F:claim&&claim.first?claim.first:(claim?lowerFirst(claim.content):''),CAUSE:plan.cause||'what happened',ADJ:plan.adj||'weird',R:to?ROASTS[to.id]:(plan.aboutId?ROASTS[plan.aboutId]:'')};
  let key=i;
  if(i==='confront'&&plan.leak) key='confront_leak';
  if(i==='joke'&&plan.tease) key='tease';
  if(i==='calm'&&plan.believe) key='believe';
  if(i==='leave'&&c.tone<=-2) key='leave_hostile';
  if(i==='game_ask') key='game_ask_'+(plan.q||'secret');
  if(i==='game_answer') key=plan.q==='annoy'?'game_answer_annoy':plan.q==='dare'?'game_answer_dare':plan.none?'game_answer_none':'game_answer';
  if(i==='joke_about') v.R=ROASTS[plan.aboutId];
  let bank=(CHAR_BANK[key]&&CHAR_BANK[key][sp.id]&&chance(0.6))?CHAR_BANK[key][sp.id]:(BANK[key]||BANK.chat);
  if(i==='chat' && CHAR_BANK.chat[sp.id] && chance(0.45)) bank=CHAR_BANK.chat[sp.id];
  let text=fill(pick(bank),v);
  if((i==='gossip'||i==='reveal') && plan.citeSource && plan.sourceId && plan.sourceId!==sp.id) text+=` ${nm(plan.sourceId)} told me.`;
  if(['chat','greet','react','gossip','complain','compliment','ask_about','joke','mediate','ally','invite'].includes(i)){
    if(chance(0.3)) text=pick(sp.open)+' '+lowerFirst(text);
    else if(chance(0.25)) text=text.replace(/[.!?]$/,'')+(text.match(/[?]$/)?'?':'.')+' '+pick(sp.close);
  }
  if(sp.id==='noah' && text.length>70 && !['strong_opinion','confide','game_answer'].includes(i)) text=text.split(/(?<=[.?!])\s/)[0];
  const priv=c.privacy==='private';
  const volume=['insult','confront','offended','strong_opinion','defend'].includes(i)&&sp.emotions.anger>45?'loud': (priv||['reveal','confide','gossip','ask_about','confess'].includes(i)&&c.participants.length<=2)?'whisper':'normal';
  const em={laugh:'laughing',joke:'happy',joke_about:'happy',insult:'angry',confront:'angry',offended:'angry',defend:'angry',strong_opinion:'angry',cry_out:'crying',refuse:'angry',flirt:'flirty',confess:'nervous',awkward:'nervous',game_dodge:'nervous',react:plan.shock?'shocked':'excited',gossip:'excited',reveal:'excited',comfort:'sad',support:'happy',forgive:'happy',accept_love:'happy',reject_love:'sad',apologize:'sad',thank:'happy',compliment:'happy',mediate:'neutral',calm:'neutral',confide:'nervous',accept:'excited',game_answer:'nervous'}[i]||(sp.emotions.happiness>65?'happy':sp.emotions.sadness>55?'sad':'neutral');
  const thought=offlineThought(sp,plan);
  return {speech:text,intent:i,to:plan.to||null,factIds:plan.claimId?[plan.claimId]:[],newClaim:plan.newClaim||null,volume,emotion:em,end:i==='leave',thought,src:'offline'};
}
function offlineThought(sp,plan){
  const to=plan.to?nm(plan.to):'';
  switch(plan.intent){
    case 'reveal': return `I know I shouldn't... but this is too good to keep.`;
    case 'keep_secret': return `Not betraying ${nm(plan.ownerId)}.`;
    case 'gossip': return `${to} needs to hear this.`;
    case 'confront': return `I'm not letting this slide.`;
    case 'apologize': return `I owe ${to} this.`;
    case 'forgive': return `Holding a grudge is exhausting.`;
    case 'refuse': return `Not yet. It still hurts.`;
    case 'insult': return `I'm so angry I can't think straight.`;
    case 'comfort': return `${to} shouldn't be alone right now.`;
    case 'flirt': return `${to} is really cute...`;
    case 'confide': return `I need someone to know.`;
    case 'joke_about': return `This one's going to kill.`;
    case 'mediate': return `Someone has to keep this house together.`;
    case 'ally': return `${to} could be useful.`;
    case 'leave': return `I've had enough of this conversation.`;
    default: return '';
  }
}
