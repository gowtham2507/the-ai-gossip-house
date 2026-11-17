// ================= OBSERVER UI =================
const UI={tab:'agent',feedFilter:'all',openConv:null,lastPanel:0,toastQ:[],relOpen:null};
const EV_ICON={party:'🎉',gossip:'🗣️',talk:'💬',conflict:'💥',reconcile:'🤝',relationship:'📈',social:'🙅',rumor:'👂',jealousy:'💚',leak:'🔓',secret:'🤫',overheard:'👂',cry:'😢',comfort:'🫂',mood:'🌧️',game:'🎲',confession:'🎤',alliance:'♟️',romance:'💕',crush:'💘',betrayal:'🗡️',surprise:'⚡',house:'🏠',system:'📺'};
const EMO_COL={happiness:'#ffd166',sadness:'#7cc4ff',anger:'#ff6b6b',fear:'#b39cff',jealousy:'#5ee6a8',excitement:'#ff9f43',embarrassment:'#ff7eb6',loneliness:'#8fa3c7',trust:'#4fd1c5',affection:'#ff8fa3',stress:'#e07a5f'};
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'})[c]);
function onEventLogged(ev){ if(ev.imp>=4 && typeof document!=='undefined') toast(ev); }
function toast(ev){
  const box=document.getElementById('toasts'); if(!box) return;
  const d=document.createElement('div'); d.className='toast'; d.innerHTML=`${EV_ICON[ev.type]||'•'} ${esc(ev.text)}`;
  d.onclick=()=>focusEvent(ev); box.prepend(d);
  while(box.children.length>4) box.lastChild.remove();
  setTimeout(()=>{ d.style.transition='opacity .6s'; d.style.opacity='0'; setTimeout(()=>d.remove(),700); },7000);
}
function focusEvent(ev){
  const id=(ev.ids||[]).find(x=>S.byId[x]);
  if(id){ selectAgent(id); R.follow=id; }
  if(ev.convId){ UI.openConv=ev.convId; }
  updatePanels(true);
}
function selectAgent(id){ R.selected=id; UI.relOpen=null; setTab('agent'); updatePanels(true); }
function setTab(t){ UI.tab=t; document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('on',b.dataset.tab===t)); document.querySelectorAll('.pane').forEach(p=>p.classList.toggle('on',p.id==='p-'+t)); updatePanels(true); }
function moodWord(a){ return ({sleep:'😴 asleep',cry:'😢 crying',laugh:'😂 laughing',shock:'😲 shocked',angry:'😠 angry',flirty:'😏 flirty',nervous:'😬 nervous',sad:'😔 down',happy:'😄 happy',neutral:'🙂 calm'})[expressionOf(a)]; }
const thumbCache={};
function drawThumb(cv,a){
  const dpr=2; if(cv.width!==cv.clientWidth*dpr){ cv.width=(cv.clientWidth||44)*dpr; cv.height=(cv.clientHeight||52)*dpr; }
  const g=cv.getContext('2d'); g.setTransform(1,0,0,1,0,0); g.clearRect(0,0,cv.width,cv.height);
  const sc=cv.height/52; g.setTransform(sc,0,0,sc,0,0);
  const w=cv.width/sc;
  drawCharacter(g,a,w/2,36,R.time,{face:'down',seated:false,moving:false,act:a.act.type==='sleep'?'idle':'idle',expr:expressionOf(a)==='sleep'?'neutral':expressionOf(a),thumb:true});
}
function bar(v,col){ return `<div class="bar"><i style="width:${clamp(v)}%;background:${col}"></i></div>`; }
function agentPanel(){
  const el=document.getElementById('p-agent');
  const a=R.selected?A(R.selected):null;
  if(!a){
    if(!el.querySelector('.grid10')){
      el.innerHTML=`<h3 style="margin-top:2px">The housemates</h3><div class="grid10">${S.agents.map(x=>`<div class="card" data-id="${x.id}"><canvas></canvas><div><div class="nm">${x.name}</div><div class="sub">${x.archetype}</div><div class="sub" data-f="act"></div></div></div>`).join('')}</div>
      <div class="note">Click a housemate (here or in the house) to inspect their feelings, relationships, memories, secrets and the reason behind their latest decision. Nobody follows a script — every action comes from their own state.</div>`;
      el.querySelectorAll('.card').forEach(c=>c.onclick=()=>selectAgent(c.dataset.id));
    }
    el.querySelectorAll('.card').forEach(c=>{ const x=A(c.dataset.id); drawThumb(c.querySelector('canvas'),x); c.querySelector('[data-f=act]').textContent=`${moodWord(x)} · ${x.act.label}`; });
    return;
  }
  const scroll=el.scrollTop;
  const conv=a.convId?S.convs.find(c=>c.id===a.convId):null;
  const rels=others(a).map(b=>({b,r:a.rel[b.id]})).sort((x,y)=>(y.r.friendship+y.r.attraction+y.r.resentment)-(x.r.friendship+x.r.attraction+x.r.resentment));
  const facts=Object.values(a.knowledge).map(k=>({k,c:S.claims[k.claimId]})).filter(x=>x.c).sort((x,y)=>y.k.learnedAt-x.k.learnedAt);
  const own=facts.filter(x=>x.k.own);
  const known=facts.filter(x=>!x.k.own).slice(0,14);
  const goals=a.goals.map(g=>`<div class="item">🎯 ${esc(g)}</div>`).join('');
  const intents=a.intentions.slice().sort((x,y)=>y.urg-x.urg).slice(0,4).map(i=>`<div class="item">→ ${esc(i.type)} ${i.target?esc(nm(i.target)):''} <span class="t">urge ${i.urg|0}${i.cause?' · '+esc(i.cause):''}</span></div>`).join('');
  el.innerHTML=`
  <div class="row" style="justify-content:space-between;margin-top:0"><button class="btn solid" id="backAll">← All</button><div class="row" style="margin:0"><button class="btn ${R.follow===a.id?'gold':'solid'}" id="bFollow">${R.follow===a.id?'Following':'🎥 Follow'}</button></div></div>
  <div class="ahead"><canvas id="aThumb"></canvas><div><div class="nm">${a.name}</div><div style="color:var(--mute);font-weight:700">${a.archetype}</div>
    <div class="tagrow"><span class="tag">${moodWord(a)}</span><span class="tag">📍 ${esc(roomName(roomAtPos(a.pos)))}</span>${a.partner?`<span class="tag">💕 ${esc(nm(a.partner))}</span>`:''}</div></div></div>
  <div class="kv"><div>Doing</div><div>${esc(a.act.label)}</div><div>Goal</div><div>${esc(a.goals[0])}</div>${conv?`<div>Talking</div><div>with ${esc(conv.participants.filter(x=>x!==a.id).map(nm).join(', '))} · ${esc(conv.topic)}</div>`:''}</div>
  <div class="why"><b>Why:</b> ${esc(a.reason)}${a.lastDecision?`<div style="font-size:11px;color:var(--mute);margin-top:3px">Options weighed: ${esc(a.lastDecision.alts.join(' · '))}</div>`:''}</div>
  ${conv?`<h3>Current conversation</h3><div class="conv">${conv.lines.slice(-5).map(lineHTML).join('')||'<div class="line" style="color:var(--mute)">…starting</div>'}</div>`:''}
  <h3>Feelings</h3><div class="bars">${EMO_KEYS.map(k=>`<div>${k}</div>${bar(a.emotions[k],EMO_COL[k])}<div style="text-align:right;color:var(--mute)">${a.emotions[k]|0}</div>`).join('')}</div>
  <h3>Needs</h3><div class="bars">${NEED_KEYS.map(k=>`<div>${k}</div>${bar(a.needs[k],a.needs[k]<30?'#ff6b6b':'#7cc4ff')}<div style="text-align:right;color:var(--mute)">${a.needs[k]|0}</div>`).join('')}</div>
  <h3>Relationships <span style="font-size:11px;color:var(--mute);font-family:Nunito">trust · friend · attraction · resent</span></h3>
  <div>${rels.map(({b,r})=>`<div class="rel" data-id="${b.id}"><div><b>${b.name}</b></div><div class="mini">${['trust','friendship','attraction','resentment'].map((k,i)=>`<span><i style="width:${r[k]}%;background:${['#4fd1c5','#ffd166','#ff7eb6','#ff6b6b'][i]}"></i></span>`).join('')}</div><span class="rlab">${relLabel(r)}</span></div>${UI.relOpen===b.id?`<div class="item" style="margin:4px 0 6px">${r.sharedHistory.length?r.sharedHistory.map(esc).join('<br>'):'No history yet.'}<br><span class="t">Their view of ${a.name}: ${relLabel(b.rel[a.id])} (trust ${b.rel[a.id].trust|0}, resentment ${b.rel[a.id].resentment|0})</span></div>`:''}`).join('')}</div>
  <h3>Goals & intentions</h3><div class="list">${goals}${intents}</div>
  <h3>Own secrets</h3><div class="list">${own.map(x=>`<div class="item hot"><span class="lock">🔒</span> ${esc(x.c.content)} <span class="t">${x.c.public?'· now public':x.c.confidedTo.length?'· told '+x.c.confidedTo.map(nm).join(', '):'· told no one'}</span></div>`).join('')||'<div class="item">None.</div>'}</div>
  <h3>What ${a.name} knows</h3><div class="list">${known.map(x=>`<div class="item ${x.c.secret&&!x.c.public?'hot':''}">${x.c.secret&&!x.c.public?'<span class="lock">🔒</span> ':''}${esc(x.c.content)}<br><span class="t">${x.k.permittedRecipients?'told in confidence by '+esc(nm(x.c.owner)):x.k.sourceAgentId?(x.k.overheard?'overheard ':'from ')+esc(nm(x.k.sourceAgentId)):'saw it'} · ${Math.round(x.k.confidence*100)}% sure${x.c.truth===false?' · exaggerated':''}${x.k.toldTo.length?' · told '+x.k.toldTo.map(nm).join(', '):''}</span></div>`).join('')||'<div class="item">Nothing juicy yet.</div>'}</div>
  <h3>Recent memories</h3><div class="list">${a.memories.slice(0,12).map(m=>`<div class="item ${m.imp>=7?'hot':''}"><span class="t">D${dayOf(m.t)} ${fmtTime(m.t)}</span>${esc(m.text)}</div>`).join('')}</div>
  <div class="note">Observer view: you can see everything, but nothing you read here is ever passed to the housemates.</div>`;
  el.scrollTop=scroll;
  drawThumb(document.getElementById('aThumb'),a);
  document.getElementById('backAll').onclick=()=>{ R.selected=null; R.follow=null; el.innerHTML=''; updatePanels(true); };
  document.getElementById('bFollow').onclick=()=>{ R.follow=R.follow===a.id?null:a.id; if(!R.follow) R.target={x:R.cam.x,y:R.cam.y,z:R.cam.z}; updatePanels(true); };
  el.querySelectorAll('.rel').forEach(r=>r.onclick=()=>{ UI.relOpen=UI.relOpen===r.dataset.id?null:r.dataset.id; updatePanels(true); });
}
function lineHTML(l){
  const sp=A(l.speaker); const w=l.volume==='whisper';
  return `<div class="line ${w?'w':''}"><span class="s" style="color:${sp?sp.look.top:'#fff'}">${esc(nm(l.speaker))}</span>${l.to?`<span class="meta">→ ${esc(nm(l.to))}</span>`:''}<span class="meta">${w?'whispers':l.volume==='loud'?'shouts':''} · ${esc(l.intent)}${l.src==='claude'?' · ✨':''}</span><br>${esc(l.text)}${l.thought?`<span class="th">💭 ${esc(l.thought)}</span>`:''}${l.overheardBy&&l.overheardBy.length?`<span class="th" style="color:var(--acc2)">👂 overheard by ${esc(l.overheardBy.map(nm).join(', '))}</span>`:''}</div>`;
}
function feedPanel(){
  const el=document.getElementById('p-feed'); const scroll=el.scrollTop;
  const F={all:'All',drama:'Drama',secrets:'Secrets',romance:'Romance',party:'Party',talk:'Talk'};
  const match=e=>{ const f=UI.feedFilter; if(f==='all') return e.imp>=2; if(f==='drama') return ['conflict','reconcile','cry','comfort','betrayal','jealousy','rumor','surprise','mood'].includes(e.type); if(f==='secrets') return ['leak','secret','overheard','betrayal','confession','gossip'].includes(e.type); if(f==='romance') return ['romance','crush','jealousy','confession'].includes(e.type)||/flirt/i.test(e.text); if(f==='party') return ['party','game','house'].includes(e.type); if(f==='talk') return ['talk','gossip','social'].includes(e.type); return true; };
  const evs=S.events.filter(match).slice(0,150);
  el.innerHTML=`<div class="filters">${Object.entries(F).map(([k,v])=>`<button data-f="${k}" class="${UI.feedFilter===k?'on':''}">${v}</button>`).join('')}</div>`+
    evs.map(e=>`<div class="ev" data-id="${e.id}"><span class="ic">${EV_ICON[e.type]||'•'}</span><div><span class="t">Day ${dayOf(e.t)} · ${fmtTime(e.t)}</span>${esc(e.text)}</div></div>`).join('');
  el.scrollTop=scroll;
  el.querySelectorAll('.filters button').forEach(b=>b.onclick=()=>{ UI.feedFilter=b.dataset.f; el.scrollTop=0; updatePanels(true); });
  el.querySelectorAll('.ev').forEach(d=>d.onclick=()=>{ const ev=S.events.find(e=>e.id==d.dataset.id); if(ev) focusEvent(ev); });
}
function talksPanel(){
  const el=document.getElementById('p-talks'); const scroll=el.scrollTop;
  const conv=c=>{ const open=UI.openConv===c.id || c.active; const lines=open?c.lines:c.lines.slice(-1);
    return `<div class="conv" data-id="${c.id}"><div class="hd"><span><b>${esc(c.participants.concat(c.flags&&c.flags.joined?[]:[]).map(nm).join(' · ')||'—')}</b></span><span>${esc(roomName(c.room))} · D${dayOf(c.startedAt)} ${fmtTime(c.startedAt)}</span></div>
    <div class="row" style="margin:4px 0"><span class="badge ${c.privacy==='private'?'private':''}">${c.privacy}</span><span class="badge">${esc(c.topic)}</span>${c.tone<=-2?'<span class="badge hostile">hostile</span>':''}${c.llmTurns?`<span class="badge claude">✨ ${c.llmTurns} Claude lines</span>`:''}${c.active?'<span class="badge" style="background:rgba(255,209,102,.2);color:#ffd166">live</span>':`<span class="badge">${esc(c.endReason||'ended')}</span>`}</div>
    ${lines.map(lineHTML).join('')}${!open&&c.lines.length>1?`<div class="line" style="color:var(--mute);font-size:11.5px">▸ ${c.lines.length} lines — click to expand</div>`:''}</div>`; };
  el.innerHTML=`<h3 style="margin-top:2px">Live now (${S.convs.length})</h3>${S.convs.map(conv).join('')||'<div class="note">Nobody is talking right now.</div>'}<h3>Recent</h3>${S.ended.slice(0,25).map(conv).join('')}<div class="note">Private conversations are only visible to you, the viewer. Housemates learn what was said only by taking part, overhearing within earshot, or hearing it secondhand.</div>`;
  el.scrollTop=scroll;
  el.querySelectorAll('.conv .hd, .conv').forEach(h=>h.onclick=(e)=>{ const c=h.closest('.conv'); if(!c) return; UI.openConv=UI.openConv===c.dataset.id?null:c.dataset.id; const cv=S.convs.concat(S.ended).find(x=>x.id===c.dataset.id); if(cv&&cv.active&&cv.participants[0]){ R.follow=cv.participants[0]; } e.stopPropagation(); updatePanels(true); });
}
function housePanel(force){
  const el=document.getElementById('p-house');
  if(!el.dataset.built || force){
    el.dataset.built='1';
    el.innerHTML=`<h3 style="margin-top:2px">Dialogue engine</h3>
    <div class="note" style="margin-top:0">Housemates speak through <b>Claude</b> once you connect it. It runs on your own Claude account, so there is no API key and nothing extra to pay. Each line is generated from that character's personality, feelings, memories, relationships and private knowledge, then checked against a schema. When Claude is off, busy or out of budget, the built-in offline social engine writes the line instead.</div>
    <div class="row"><button class="btn prim" id="hConnect">✨ Connect Claude</button><button class="btn solid" id="hOffline">Use offline engine</button></div>
    <div class="row"><label class="f">Model tier <select id="hTier"><option value="quick">quick (fast)</option><option value="default">default</option><option value="complex">complex</option></select></label><label class="f">Parallel <input type="number" id="hConc" min="1" max="4" style="width:52px"></label></div>
    <div class="row"><label class="f">Daily call budget <input type="number" id="hBudget" min="10" max="5000" style="width:76px"></label><label class="f">Timeout (s) <input type="number" id="hTimeout" min="5" max="90" style="width:56px"></label></div>
    <div class="stat" id="hStats"></div>
    <div class="note">Other providers (OpenAI-compatible, Groq, Ollama): a hosted page can't call outside servers, and API keys must never live in the browser. That route needs a small server-side relay, which isn't part of this page.</div>
    <h3>Simulation</h3>
    <div class="row"><button class="btn solid" data-ev2="party">🎉 Start a party</button><button class="btn solid" data-ev2="pizza">🍕 Pizza</button><button class="btn solid" data-ev2="game">🎲 Game night</button><button class="btn solid" data-ev2="storm">⛈ Storm</button><button class="btn solid" data-ev2="outage">⚡ Power cut</button></div>
    <div class="note">House events change the environment. They never tell anyone what to do: each housemate decides for themselves how to react.</div>
    <h3>Save & load</h3>
    <div class="row"><button class="btn solid" id="hSave">💾 Save in this browser</button><button class="btn solid" id="hLoad">📂 Load saved</button><button class="btn solid" id="hNew">🏠 New house</button></div>
    <div class="row"><button class="btn solid" id="hCopy">Copy save code</button><button class="btn solid" id="hPaste">Load from code</button></div>
    <textarea id="hCode" placeholder="Paste a save code here, then press “Load from code”."></textarea>
    <div class="note" id="hMsg">The house auto-saves in this browser every couple of minutes.</div>
    <h3>House stats</h3><div class="stat" id="hHouse"></div>`;
    document.getElementById('hConnect').onclick=connectClaude;
    document.getElementById('hOffline').onclick=()=>{ LLM.provider='offline'; LLM.status='Offline engine'; updateHeader(); housePanel(true); };
    const tier=document.getElementById('hTier'); tier.value=LLM.tier; tier.onchange=()=>LLM.tier=tier.value;
    const cc=document.getElementById('hConc'); cc.value=LLM.maxConcurrent; cc.onchange=()=>LLM.maxConcurrent=clamp(+cc.value,1,4);
    const bu=document.getElementById('hBudget'); bu.value=LLM.dailyCallBudget; bu.onchange=()=>LLM.dailyCallBudget=clamp(+bu.value,10,5000);
    const to=document.getElementById('hTimeout'); to.value=LLM.timeoutMs/1000; to.onchange=()=>LLM.timeoutMs=clamp(+to.value,5,90)*1000;
    el.querySelectorAll('[data-ev2]').forEach(b=>b.onclick=()=>triggerHouseEvent(b.dataset.ev2));
    document.getElementById('hSave').onclick=()=>{ msg(saveLocal()?'Saved in this browser.':'Could not save (browser storage unavailable).'); };
    document.getElementById('hLoad').onclick=()=>{ msg(loadLocal()?'Loaded your saved house.':'No saved house found in this browser.'); };
    document.getElementById('hNew').onclick=()=>{ newGame(Date.now()%1e9); afterLoad(); msg('A brand new house.'); };
    document.getElementById('hCopy').onclick=async()=>{ const code=serialize(); try{ await navigator.clipboard.writeText(code); msg(`Save code copied (${Math.round(code.length/1024)} KB).`); }catch(e){ document.getElementById('hCode').value=code; msg('Clipboard blocked — the code is in the box above; copy it manually.'); } };
    document.getElementById('hPaste').onclick=()=>{ const v=document.getElementById('hCode').value.trim(); if(!v) return msg('Paste a save code first.'); try{ deserialize(v); afterLoad(); msg('Loaded from code.'); }catch(e){ msg('That save code is not valid.'); } };
  }
  const lat=LLM.latency.length?Math.round(LLM.latency.reduce((a,b)=>a+b,0)/LLM.latency.length):0;
  document.getElementById('hStats').innerHTML=`<div>Status</div><div>${esc(LLM.status)}</div><div>Calls today</div><div>${LLM.callsToday} / ${LLM.dailyCallBudget}</div><div>Est. tokens today</div><div>${LLM.tokensToday.toLocaleString()}</div><div>Queue · running</div><div>${LLM.queue.length} · ${LLM.active}</div><div>Avg latency</div><div>${lat?lat+' ms':'—'}</div><div>Invalid → retried</div><div>${LLM.invalid}</div><div>Offline fallbacks</div><div>${LLM.fallbacks}</div>`;
  const inf=S.influence||{}; const top=Object.entries(inf).sort((x,y)=>y[1]-x[1]).slice(0,3).map(([k,v])=>`${nm(k)} (${v|0})`).join(', ');
  document.getElementById('hHouse').innerHTML=`<div>Day / time</div><div>${dayOf(S.t)} · ${fmtTime(S.t)}</div><div>Party</div><div>${S.party&&S.party.active?`on — ${S.party.attendees.length} in the hall`:'none'}</div><div>Couples</div><div>${S.couples.map(([a,b])=>nm(a)+' + '+nm(b)).join(', ')||'none'}</div><div>Alliances</div><div>${(S.alliances||[]).map(([a,b])=>nm(a)+' + '+nm(b)).join(', ')||'none'}</div><div>Most influential</div><div>${top||'—'}</div><div>Rumors in circulation</div><div>${Object.keys(S.claims).length}</div><div>Conversations held</div><div>${S.ended.length>=60?'60+':S.ended.length}</div>`;
}
function msg(t){ const m=document.getElementById('hMsg'); if(m) m.textContent=t; }
function updateHeader(){
  document.getElementById('clock').textContent=`Day ${dayOf(S.t)} · ${fmtTime(S.t)}`;
  const pill=document.getElementById('llmPill'); const on=LLM.provider==='claude'&&LLM.sample;
  pill.classList.toggle('claude',!!on); document.getElementById('llmTxt').textContent=on?`Claude · ${LLM.callsToday} lines`:LLM.status;
  const bc=document.getElementById('bConnect'); bc.style.display=on?'none':'';
  document.getElementById('talkN').textContent=S.convs.length;
  document.getElementById('bPause').textContent=SIM.paused?'▶':'⏸';
  document.querySelectorAll('[data-sp]').forEach(b=>b.classList.toggle('on',+b.dataset.sp===SIM.speed));
  const fc=document.getElementById('followChip'); if(R.follow){ fc.style.display='block'; fc.textContent=`🎥 Following ${nm(R.follow)} — click to stop`; } else fc.style.display='none';
}
function updatePanels(force){
  const now=performance.now(); if(!force && now-UI.lastPanel<450) return; UI.lastPanel=now;
  updateHeader();
  if(UI.tab==='agent') agentPanel(); else if(UI.tab==='feed') feedPanel(); else if(UI.tab==='talks') talksPanel(); else housePanel();
}
async function connectClaude(){
  LLM.status='Connecting…'; updateHeader();
  const ok=await llmConnect(); updateHeader(); housePanel(true);
  if(ok) logEvent('system','✨ Claude is now voicing the housemates.',[],4); else logEvent('system',`Claude couldn't connect (${LLM.status}). The offline engine keeps the house running.`,[],3);
}
// ---------- save / load ----------
function serialize(){ const o={}; for(const k in S){ if(k==='byId') continue; o[k]=S[k]; } return JSON.stringify({v:1,S:o,doors:World.doors.map(d=>d.open)}); }
function deserialize(str){
  const d=JSON.parse(str); if(!d||!d.S||!d.S.agents) throw new Error('bad');
  buildWorld(); for(const k of Object.keys(S)) delete S[k]; Object.assign(S,d.S); S.byId={}; for(const a of S.agents){ S.byId[a.id]=a; a.rx=null; }
  for(const a of S.agents){ if(a.spot){ const s=spotById(a.spot); if(s) s.occ=a.id; else a.spot=null; } }
  for(const c of S.convs){ c.busy=false; if(c.flags&&c.flags.ending) c.nextAt=S.t; }
  SIM_TIMERS.length=0; for(const c of S.convs) if(c.flags&&c.flags.ending) setTimeoutSim(S.t+0.5,()=>{ if(c.active) endConversation(c,'ended naturally'); });
}
function saveLocal(){ try{ localStorage.setItem('aihouse_save_v1',serialize()); return true; }catch(e){ return false; } }
function loadLocal(){ try{ const v=localStorage.getItem('aihouse_save_v1'); if(!v) return false; deserialize(v); afterLoad(); return true; }catch(e){ return false; } }
function hasLocal(){ try{ return !!localStorage.getItem('aihouse_save_v1'); }catch(e){ return false; } }
function afterLoad(){ R.selected=null; R.follow=null; document.getElementById('p-agent').innerHTML=''; fitCamera(); updatePanels(true); }
// ---------- main loop & input ----------
const SIM={paused:false,speed:1,last:0,autosave:0};
function frame(now){
  const dt=Math.min(0.1,(now-SIM.last)/1000||0); SIM.last=now;
  if(!SIM.paused){ let sim=dt*SIM.speed*1.0; while(sim>0){ const st=Math.min(0.25,sim); tick(st); sim-=st; } }
  render(dt); updatePanels(false);
  if(now-SIM.autosave>120000){ SIM.autosave=now; saveLocal(); }
  requestAnimationFrame(frame);
}
function hitAgent(sx,sy){
  let best=null,bd=1e9;
  for(const a of S.agents){ const p=agentDrawPos(a); const s=worldToScreen(p.x*TS,(p.y*TS)-10); const d=Math.hypot(s.x-sx,s.y-sy); const r=Math.max(16,24*R.cam.z); if(d<r&&d<bd){ bd=d; best=a; } }
  return best;
}
function initInput(){
  const cv=R.cv; let drag=null, moved=false;
  const pts=new Map(); let pinch=null;
  cv.addEventListener('pointerdown',e=>{ cv.setPointerCapture(e.pointerId); pts.set(e.pointerId,{x:e.offsetX,y:e.offsetY}); if(pts.size===2){ const [p1,p2]=[...pts.values()]; pinch={d:Math.hypot(p1.x-p2.x,p1.y-p2.y),z:R.cam.z}; } drag={x:e.offsetX,y:e.offsetY,cx:R.cam.x,cy:R.cam.y}; moved=false; cv.classList.add('drag'); });
  cv.addEventListener('pointermove',e=>{
    if(pts.has(e.pointerId)) pts.set(e.pointerId,{x:e.offsetX,y:e.offsetY});
    if(pinch && pts.size===2){ const [p1,p2]=[...pts.values()]; const d=Math.hypot(p1.x-p2.x,p1.y-p2.y); R.cam.z=clamp(pinch.z*d/pinch.d,0.25,4); R.target=null; moved=true; return; }
    if(drag){ const dx=e.offsetX-drag.x, dy=e.offsetY-drag.y; if(Math.abs(dx)+Math.abs(dy)>4){ moved=true; R.follow=null; R.target=null; } if(moved){ R.cam.x=drag.cx-dx/R.cam.z; R.cam.y=drag.cy-dy/R.cam.z; } }
    else { const h=hitAgent(e.offsetX,e.offsetY); R.hover=h?h.id:null; cv.style.cursor=h?'pointer':'grab'; }
  });
  const up=e=>{ pts.delete(e.pointerId); if(pts.size<2) pinch=null; if(drag && !moved){ const h=hitAgent(e.offsetX,e.offsetY); if(h) selectAgent(h.id); } drag=null; cv.classList.remove('drag'); };
  cv.addEventListener('pointerup',up); cv.addEventListener('pointercancel',up);
  cv.addEventListener('dblclick',e=>{ const w=screenToWorld(e.offsetX,e.offsetY); const rid=World.roomAt[Math.floor(w.y/TS)]&&World.roomAt[Math.floor(w.y/TS)][Math.floor(w.x/TS)]; if(rid) zoomToRoom(rid); });
  cv.addEventListener('wheel',e=>{ e.preventDefault(); const before=screenToWorld(e.offsetX,e.offsetY); const z=clamp(R.cam.z*Math.exp(-e.deltaY*0.0015),0.25,4); R.cam.z=z; R.target=null; if(!R.follow){ const after=screenToWorld(e.offsetX,e.offsetY); R.cam.x+=before.x-after.x; R.cam.y+=before.y-after.y; } },{passive:false});
  document.getElementById('zIn').onclick=()=>{ R.target={x:R.cam.x,y:R.cam.y,z:clamp(R.cam.z*1.3,0.25,4)}; };
  document.getElementById('zOut').onclick=()=>{ R.target={x:R.cam.x,y:R.cam.y,z:clamp(R.cam.z/1.3,0.25,4)}; };
  document.getElementById('zFit').onclick=()=>{ R.follow=null; fitCamera(); };
  document.getElementById('followChip').onclick=()=>{ R.follow=null; updatePanels(true); };
  document.getElementById('bPause').onclick=()=>{ SIM.paused=!SIM.paused; updateHeader(); };
  document.querySelectorAll('[data-sp]').forEach(b=>b.onclick=()=>{ SIM.speed=+b.dataset.sp; SIM.paused=false; updateHeader(); });
  document.querySelectorAll('[data-ev]').forEach(b=>b.onclick=()=>triggerHouseEvent(b.dataset.ev));
  document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>setTab(b.dataset.tab));
  document.getElementById('bConnect').onclick=connectClaude;
  document.getElementById('llmPill').onclick=()=>setTab('house');
  window.addEventListener('keydown',e=>{ if(e.target.tagName==='TEXTAREA'||e.target.tagName==='INPUT') return; if(e.code==='Space'){ e.preventDefault(); SIM.paused=!SIM.paused; updateHeader(); } if(e.key==='Escape'){ R.follow=null; R.selected=null; document.getElementById('p-agent').innerHTML=''; updatePanels(true); } });
  window.addEventListener('resize',()=>{ resizeCanvas(); });
}
function showIntro(){
  const m=document.getElementById('modal'); m.style.display='flex';
  m.innerHTML=`<div class="box"><h2>Welcome to AI House 🏠</h2>
  <p>Ten housemates share a house. Each has their own personality, feelings, needs, secrets, memories and opinions of everyone else. Nobody runs on a script: they decide what to do, who to talk to, what to reveal and who to forgive.</p>
  <div class="cast" id="introCast"></div>
  <p>You're the viewer. Watch, zoom in, follow someone, or open their head to see why they did what they did. For real AI dialogue, connect Claude — it uses your Claude account, no API key needed.</p>
  <div class="row" style="justify-content:flex-end;margin-top:14px">${hasLocal()?'<button class="btn solid" id="mResume">Resume saved house</button>':''}<button class="btn solid" id="mOffline">Watch with offline engine</button><button class="btn prim" id="mClaude">✨ Start with Claude</button></div></div>`;
  const cast=document.getElementById('introCast'); for(const a of S.agents){ const c=document.createElement('canvas'); cast.appendChild(c); requestAnimationFrame(()=>drawThumb(c,a)); }
  const close=()=>{ m.style.display='none'; SIM.paused=false; };
  SIM.paused=true;
  document.getElementById('mOffline').onclick=close;
  document.getElementById('mClaude').onclick=()=>{ close(); connectClaude(); };
  const r=document.getElementById('mResume'); if(r) r.onclick=()=>{ loadLocal(); close(); };
}
function boot(){
  R.cv=document.getElementById('stage'); R.ctx=R.cv.getContext('2d');
  newGame(Date.now()%1e9);
  buildStatic(); resizeCanvas(); fitCamera(); R.cam={...R.target};
  initInput(); updatePanels(true); showIntro();
  requestAnimationFrame(t=>{ SIM.last=t; frame(t); });
  if(document.fonts&&document.fonts.ready) document.fonts.ready.then(()=>{ buildStatic(); });
}
if(typeof window!=='undefined' && typeof document!=='undefined') window.addEventListener('DOMContentLoaded',boot);
