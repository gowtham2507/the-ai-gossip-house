// ================= RENDERER: house, furniture, characters, bubbles =================
const R = { cv:null, ctx:null, dpr:1, W:0, H:0, cam:{x:GW*TS/2,y:GH*TS/2,z:0.6}, target:null, follow:null, selected:null, hover:null, staticLayer:null, SS:1.5, time:0, flash:0, rain:[] };
function hash2(x,y){ let h=x*374761393+y*668265263; h=(h^(h>>13))*1274126177; return ((h^(h>>16))>>>0)/4294967296; }
function shade(hex,amt){ let c=hex.replace('#',''); if(c.length===3) c=c.split('').map(x=>x+x).join(''); let r=parseInt(c.slice(0,2),16),g=parseInt(c.slice(2,4),16),b=parseInt(c.slice(4,6),16); const f=amt<0?0:255, p=Math.abs(amt); r=Math.round((f-r)*p+r); g=Math.round((f-g)*p+g); b=Math.round((f-b)*p+b); return `rgb(${r},${g},${b})`; }
function rrect(ctx,x,y,w,h,r){ r=Math.min(r,w/2,h/2); ctx.beginPath(); ctx.moveTo(x+r,y); ctx.arcTo(x+w,y,x+w,y+h,r); ctx.arcTo(x+w,y+h,x,y+h,r); ctx.arcTo(x,y+h,x,y,r); ctx.arcTo(x,y,x+w,y,r); ctx.closePath(); }
const FLOOR={bedroom:['#c99a6b','#bf8f60'],bathroom:['#d8ecf2','#c6e1ea'],hall:['#d4b48a','#caa87c'],living:['#a8754d','#9c6b44'],party:['#2b2250','#251d47'],kitchen:['#efe6d2','#cfe0cf'],corner:['#4b7a64','#456f5b'],balcony:['#9aa3ab','#8e979f'],garden:['#7cbf5a','#73b553']};
function buildStatic(){
  const SS=R.SS, c=document.createElement('canvas'); c.width=GW*TS*SS; c.height=GH*TS*SS; const g=c.getContext('2d'); g.scale(SS,SS);
  // outside
  g.fillStyle='#4f7d3c'; g.fillRect(0,0,GW*TS,GH*TS);
  for(let y=0;y<GH;y++) for(let x=0;x<GW;x++){
    const v=World.grid[y][x], rid=World.roomAt[y][x], px=x*TS, py=y*TS;
    if(v===3){ g.fillStyle=hash2(x,y)>0.5?'#4a7a39':'#457235'; g.fillRect(px,py,TS,TS); if(hash2(x+9,y)>0.55){ g.fillStyle='#3b6630'; g.beginPath(); g.arc(px+16,py+16,12+hash2(x,y+3)*6,0,7); g.fill(); g.fillStyle='#4f8a3e'; g.beginPath(); g.arc(px+12,py+12,7,0,7); g.fill(); } continue; }
    if(v===1){ continue; }
    const room=rid?World.rooms[rid]:null; const type=room?room.type:'hall'; const pal=FLOOR[type]||FLOOR.hall;
    if(type==='kitchen'){ g.fillStyle=(x+y)%2?pal[0]:pal[1]; g.fillRect(px,py,TS,TS); }
    else if(type==='bathroom'){ g.fillStyle=pal[0]; g.fillRect(px,py,TS,TS); g.strokeStyle=pal[1]; g.lineWidth=1.2; g.strokeRect(px+0.5,py+0.5,TS/2,TS/2); g.strokeRect(px+TS/2+0.5,py+TS/2+0.5,TS/2-1,TS/2-1); }
    else if(type==='garden'){ g.fillStyle=hash2(x,y)>0.5?pal[0]:pal[1]; g.fillRect(px,py,TS,TS); g.strokeStyle='rgba(40,90,30,0.35)'; g.lineWidth=1.2; for(let k=0;k<3;k++){ const ox=px+hash2(x*3+k,y)*TS, oy=py+hash2(x,y*3+k)*TS; g.beginPath(); g.moveTo(ox,oy); g.lineTo(ox-2,oy-5); g.moveTo(ox,oy); g.lineTo(ox+2,oy-5); g.stroke(); } }
    else if(type==='party'){ g.fillStyle=pal[(x+y)%2]; g.fillRect(px,py,TS,TS); }
    else if(type==='corner'){ g.fillStyle=pal[0]; g.fillRect(px,py,TS,TS); g.fillStyle='rgba(0,0,0,0.05)'; if((x+y)%2) g.fillRect(px,py,TS,TS); }
    else { // wood planks
      g.fillStyle=pal[0]; g.fillRect(px,py,TS,TS);
      g.fillStyle=pal[1]; const off=(x%2)*16; g.fillRect(px,py+((off)%32),TS,1.2); g.fillRect(px,py+((off+16)%32),TS,1.2);
      g.fillStyle='rgba(0,0,0,0.06)'; g.fillRect(px+((y*7)%32),py,1,TS);
      if(type==='balcony'){ g.fillStyle='rgba(0,0,0,0.12)'; g.fillRect(px,py+15,TS,2); }
    }
  }
  // hallway runner
  g.fillStyle='#8b3a3a'; g.fillRect(2*TS,9*TS+10,56*TS,TS*2-20); g.strokeStyle='#d9b15f'; g.lineWidth=2; g.strokeRect(2*TS+4,9*TS+14,56*TS-8,TS*2-28);
  // walls with depth
  for(let y=0;y<GH;y++) for(let x=0;x<GW;x++){
    if(World.grid[y][x]!==1) continue; const px=x*TS, py=y*TS;
    g.fillStyle='#3a3350'; g.fillRect(px,py,TS,TS);
    g.fillStyle='#57507a'; g.fillRect(px,py,TS,TS*0.55);
    g.fillStyle='rgba(255,255,255,0.06)'; g.fillRect(px,py,TS,3);
    if(y+1<GH && World.grid[y+1][x]!==1){ g.fillStyle='rgba(0,0,0,0.22)'; g.fillRect(px,py+TS,TS,6); }
  }
  for(const f of World.furniture) drawFurniture(g,f);
  // room labels
  g.font='600 13px "Nunito", system-ui, sans-serif'; g.textBaseline='middle';
  for(const r of Object.values(World.rooms)){
    if(r.id==='hall') continue;
    const label=r.name.toUpperCase(); const w=g.measureText(label).width+14; const lx=r.x*TS+6, ly=(r.type==='garden'?r.y+4.6:r.y+r.h-0.6)*TS;
    g.fillStyle='rgba(20,16,40,0.55)'; rrect(g,lx,ly-10,w,20,10); g.fill(); g.fillStyle='rgba(255,255,255,0.92)'; g.fillText(label,lx+7,ly+1);
  }
  R.staticLayer=c;
}
function drawFurniture(g,f){
  const x=f.x*TS, y=f.y*TS, w=f.w*TS, h=f.h*TS;
  const sh=()=>{ g.fillStyle='rgba(0,0,0,0.18)'; rrect(g,x+3,y+5,w-2,h-2,6); g.fill(); };
  switch(f.kind){
    case 'rug': g.fillStyle=f.color; rrect(g,x+4,y+4,w-8,h-8,8); g.fill(); g.strokeStyle='rgba(255,255,255,0.35)'; g.lineWidth=2; g.setLineDash([6,4]); rrect(g,x+10,y+10,w-20,h-20,6); g.stroke(); g.setLineDash([]); break;
    case 'bed': { sh(); g.fillStyle='#7a5234'; rrect(g,x+2,y+2,w-4,h-4,6); g.fill(); g.fillStyle='#f6f1e7'; rrect(g,x+5,y+5,w-10,h-10,5); g.fill();
      const owner=AGENT_DEFS.find(d=>d.id===f.owner); g.fillStyle=owner?owner.look.top:'#88a'; rrect(g,x+5,y+30,w-10,h-36,5); g.fill(); g.fillStyle='rgba(255,255,255,0.18)'; g.fillRect(x+5,y+34,w-10,4);
      g.fillStyle='#ffffff'; rrect(g,x+10,y+8,w-20,16,6); g.fill(); g.strokeStyle='#ddd'; g.lineWidth=1; g.stroke(); break; }
    case 'desk': sh(); g.fillStyle='#8d6440'; rrect(g,x+2,y+4,w-4,h-6,4); g.fill(); g.fillStyle='#2d3142'; rrect(g,x+w/2-12,y+8,24,14,2); g.fill(); g.fillStyle='#7fd1ff'; g.fillRect(x+w/2-10,y+10,20,9); g.fillStyle='#e0c080'; g.beginPath(); g.arc(x+12,y+16,4,0,7); g.fill(); break;
    case 'wardrobe': sh(); g.fillStyle='#6d4a2f'; rrect(g,x+2,y+1,w-4,h-2,3); g.fill(); g.strokeStyle='#4f341f'; g.beginPath(); g.moveTo(x+w/2,y+3); g.lineTo(x+w/2,y+h-3); g.stroke(); break;
    case 'plant': g.fillStyle='#b5651d'; rrect(g,x+9,y+17,14,12,3); g.fill(); g.fillStyle='#2e8b57'; for(const [a,b,r] of [[16,12,8],[10,14,6],[22,14,6],[16,6,6]]){ g.beginPath(); g.arc(x+a,y+b,r,0,7); g.fill(); } g.fillStyle='rgba(255,255,255,0.15)'; g.beginPath(); g.arc(x+13,y+9,3,0,7); g.fill(); break;
    case 'tub': sh(); g.fillStyle='#ffffff'; rrect(g,x+2,y+2,w-4,h-4,14); g.fill(); g.fillStyle='#8fd0ea'; rrect(g,x+7,y+7,w-14,h-14,10); g.fill(); break;
    case 'toilet': g.fillStyle='#fff'; rrect(g,x+8,y+2,16,9,3); g.fill(); g.beginPath(); g.ellipse(x+16,y+19,9,11,0,0,7); g.fill(); g.strokeStyle='#cfd8dc'; g.lineWidth=1.5; g.stroke(); break;
    case 'sink': g.fillStyle='#e8eef0'; rrect(g,x+3,y+6,26,20,6); g.fill(); g.fillStyle='#9fd3e6'; g.beginPath(); g.ellipse(x+16,y+16,8,6,0,0,7); g.fill(); break;
    case 'tv': g.fillStyle='#111'; rrect(g,x+4,y+2,w-8,h-10,3); g.fill(); g.fillStyle='#444'; g.fillRect(x+w/2-12,y+h-8,24,4); break;
    case 'ctable': sh(); g.fillStyle='#7b4f2c'; rrect(g,x+2,y+6,w-4,h-12,6); g.fill(); g.fillStyle='#fff'; g.beginPath(); g.arc(x+20,y+16,4,0,7); g.fill(); g.fillStyle='#e94f37'; g.fillRect(x+36,y+12,10,7); break;
    case 'sofa': case 'bench': case 'sofaV': case 'gbench': { sh(); const col=f.color||'#5b6d8f'; g.fillStyle=shade(col,-0.25);
      if(f.kind==='sofaV'){ rrect(g,x,y,w,h,8); g.fill(); g.fillStyle=col; rrect(g,x+8,y+4,w-10,h-8,6); g.fill(); }
      else if(f.kind==='gbench'){ g.fillStyle='#8b5e3c'; rrect(g,x+2,y+8,w-4,h-14,3); g.fill(); g.fillStyle='#6d4428'; g.fillRect(x+2,y+12,w-4,2); }
      else { rrect(g,x,y,w,h,8); g.fill(); g.fillStyle=col; rrect(g,x+4,y+(f.face==='up'?2:10),w-8,h-12,6); g.fill(); g.strokeStyle='rgba(0,0,0,0.15)'; for(let i=1;i<f.w;i++){ g.beginPath(); g.moveTo(x+i*TS,y+6); g.lineTo(x+i*TS,y+h-6); g.stroke(); } }
      break; }
    case 'armchair': sh(); g.fillStyle=shade(f.color,-0.25); rrect(g,x+1,y+1,w-2,h-2,8); g.fill(); g.fillStyle=f.color; rrect(g,x+6,y+6,w-12,h-12,6); g.fill(); break;
    case 'shelf': { sh(); g.fillStyle='#5b3b24'; rrect(g,x+1,y+1,w-2,h-2,3); g.fill(); const cols=['#e63946','#f1c453','#2a9d8f','#457b9d','#9b5de5','#f4a261']; for(let i=0;i<f.h*4;i++){ g.fillStyle=cols[i%cols.length]; g.fillRect(x+5+((i*7)%3)*2,y+4+i*7.6,w-12,5); } break; }
    case 'lamp': { const gr=g.createRadialGradient(x+16,y+16,2,x+16,y+16,22); gr.addColorStop(0,'rgba(255,230,150,0.55)'); gr.addColorStop(1,'rgba(255,230,150,0)'); g.fillStyle=gr; g.fillRect(x-10,y-10,52,52); g.fillStyle='#f3d17a'; g.beginPath(); g.arc(x+16,y+16,8,0,7); g.fill(); g.strokeStyle='#8a6d2b'; g.lineWidth=2; g.stroke(); break; }
    case 'dancefloor': for(let i=0;i<f.w;i++) for(let j=0;j<f.h;j++){ g.fillStyle=(i+j)%2?'#3a2f6e':'#2e2560'; g.fillRect(x+i*TS+1,y+j*TS+1,TS-2,TS-2); } g.strokeStyle='rgba(255,255,255,0.15)'; g.lineWidth=2; g.strokeRect(x,y,w,h); break;
    case 'dj': sh(); g.fillStyle='#1c1c28'; rrect(g,x+2,y+2,w-4,h-6,6); g.fill(); g.fillStyle='#333'; for(const ox of [22,w-22]){ g.beginPath(); g.arc(x+ox,y+24,13,0,7); g.fill(); g.fillStyle='#111'; g.beginPath(); g.arc(x+ox,y+24,4,0,7); g.fill(); g.fillStyle='#333'; } g.fillStyle='#ff4fd8'; g.fillRect(x+w/2-18,y+18,36,6); g.fillStyle='#4ff0ff'; g.fillRect(x+w/2-18,y+30,36,4); break;
    case 'speaker': g.fillStyle='#15151d'; rrect(g,x+4,y+3,24,26,4); g.fill(); g.fillStyle='#2b2b3a'; g.beginPath(); g.arc(x+16,y+19,7,0,7); g.fill(); g.beginPath(); g.arc(x+16,y+8,3,0,7); g.fill(); break;
    case 'snacktable': sh(); g.fillStyle='#f4f1ea'; rrect(g,x+2,y+2,w-4,h-4,6); g.fill(); g.strokeStyle='#e0d8c8'; g.stroke(); break;
    case 'counter': sh(); g.fillStyle='#8a8f98'; g.fillRect(x,y+2,w,h-4); g.fillStyle='#b8bec7'; g.fillRect(x,y+2,w,8);
      for(const bx of [43,47]){ const cx=(bx-f.x)*TS+x+16; g.fillStyle='#2b2b2b'; g.beginPath(); g.arc(cx-6,y+18,5,0,7); g.arc(cx+6,y+18,5,0,7); g.fill(); }
      g.fillStyle='#cfe8f3'; rrect(g,x+(45-f.x)*TS+4,y+10,24,14,4); g.fill(); break;
    case 'fridge': sh(); g.fillStyle='#eef2f5'; rrect(g,x+2,y+1,w-4,h-3,5); g.fill(); g.strokeStyle='#c5ccd3'; g.lineWidth=1.5; g.beginPath(); g.moveTo(x+4,y+24); g.lineTo(x+w-4,y+24); g.stroke(); g.fillStyle='#9aa'; g.fillRect(x+w-12,y+8,3,10); g.fillStyle='#ff7eb6'; g.fillRect(x+12,y+34,6,6); g.fillStyle='#ffd166'; g.fillRect(x+22,y+38,6,6); break;
    case 'island': sh(); g.fillStyle='#e9e4dc'; rrect(g,x+1,y+3,w-2,h-6,5); g.fill(); g.strokeStyle='#cbbfae'; g.stroke(); g.fillStyle='#c94f4f'; g.beginPath(); g.arc(x+w/2,y+16,7,0,7); g.fill(); g.fillStyle='#f4c430'; g.beginPath(); g.arc(x+w/2+4,y+13,3,0,7); g.fill(); break;
    case 'table': sh(); g.fillStyle='#9b6a3f'; rrect(g,x+2,y+2,w-4,h-4,8); g.fill(); g.fillStyle='rgba(255,255,255,0.12)'; g.fillRect(x+6,y+h/2-1,w-12,2); for(let i=0;i<f.w;i++){ g.fillStyle='rgba(255,255,255,0.75)'; g.beginPath(); g.arc(x+i*TS+16,y+10,5,0,7); g.fill(); g.beginPath(); g.arc(x+i*TS+16,y+h-10,5,0,7); g.fill(); } break;
    case 'easel': g.strokeStyle='#7a5234'; g.lineWidth=3; g.beginPath(); g.moveTo(x+8,y+30); g.lineTo(x+16,y+2); g.lineTo(x+24,y+30); g.stroke(); g.fillStyle='#fffaf0'; g.fillRect(x+5,y+4,22,16); g.fillStyle='#7b6be0'; g.fillRect(x+7,y+6,8,6); g.fillStyle='#ff9f9f'; g.fillRect(x+15,y+11,9,6); g.fillStyle='#8fd3c9'; g.fillRect(x+9,y+13,6,5); break;
    case 'lounger': g.fillStyle=f.color||'#eee'; rrect(g,x+3,y+3,w-6,h-6,5); g.fill(); g.strokeStyle='rgba(0,0,0,0.12)'; for(let i=8;i<w-4;i+=6){ g.beginPath(); g.moveTo(x+i,y+5); g.lineTo(x+i,y+h-5); g.stroke(); } break;
    case 'path': for(let i=0;i<f.w;i++) for(let j=0;j<f.h;j++){ if(hash2(f.x+i,f.y+j)<0.25) continue; g.fillStyle=hash2(i,j+5)>0.5?'#cfc6b4':'#bdb4a2'; rrect(g,x+i*TS+4+hash2(i,j)*4,y+j*TS+4+hash2(j,i)*4,20,18,6); g.fill(); } break;
    case 'firepit': g.fillStyle='#6b6b6b'; g.beginPath(); g.arc(x+w/2,y+h/2,w/2-2,0,7); g.fill(); g.fillStyle='#3a2a1a'; g.beginPath(); g.arc(x+w/2,y+h/2,w/2-9,0,7); g.fill(); for(let k=0;k<10;k++){ const a=k/10*6.28; g.fillStyle='#8a8a8a'; g.beginPath(); g.arc(x+w/2+Math.cos(a)*(w/2-5),y+h/2+Math.sin(a)*(w/2-5),4,0,7); g.fill(); } break;
    case 'pool': { g.fillStyle='#d9d2c0'; rrect(g,x-4,y-4,w+8,h+8,14); g.fill(); const gr=g.createLinearGradient(x,y,x,y+h); gr.addColorStop(0,'#4cc9f0'); gr.addColorStop(1,'#3a86ff'); g.fillStyle=gr; rrect(g,x+2,y+2,w-4,h-4,10); g.fill(); break; }
    case 'gymbar': g.strokeStyle='#888'; g.lineWidth=4; g.beginPath(); g.moveTo(x+4,y+28); g.lineTo(x+4,y+6); g.lineTo(x+w-4,y+6); g.lineTo(x+w-4,y+28); g.stroke(); g.fillStyle='#333'; rrect(g,x+16,y+18,32,8,3); g.fill(); break;
    case 'tree': g.fillStyle='rgba(0,0,0,0.2)'; g.beginPath(); g.ellipse(x+18,y+26,22,10,0,0,7); g.fill(); g.fillStyle='#6b4423'; g.fillRect(x+12,y+12,8,16); g.fillStyle='#2f7d32'; g.beginPath(); g.arc(x+16,y+4,22,0,7); g.fill(); g.fillStyle='#3f9a43'; g.beginPath(); g.arc(x+10,y-2,12,0,7); g.arc(x+24,y+2,11,0,7); g.fill(); g.fillStyle='rgba(255,255,255,0.12)'; g.beginPath(); g.arc(x+8,y-6,5,0,7); g.fill(); break;
    case 'flowers': for(let i=0;i<f.w*5;i++){ const fx=x+hash2(i,f.x)*w, fy=y+4+hash2(f.y,i)*(h-8); g.fillStyle=['#ff6b9a','#ffd166','#ffffff','#c77dff'][i%4]; g.beginPath(); g.arc(fx,fy,3,0,7); g.fill(); } break;
  }
}
// ---------- camera ----------
function resizeCanvas(){ const r=R.cv.parentElement.getBoundingClientRect(); R.dpr=Math.min(2,window.devicePixelRatio||1); R.W=r.width; R.H=r.height; R.cv.width=r.width*R.dpr; R.cv.height=r.height*R.dpr; R.cv.style.width=r.width+'px'; R.cv.style.height=r.height+'px'; }
function fitCamera(){ const z=Math.min(R.W/(GW*TS),R.H/(GH*TS))*0.98; R.target={x:GW*TS/2,y:GH*TS/2,z}; }
function worldToScreen(x,y){ return {x:(x-R.cam.x)*R.cam.z+R.W/2,y:(y-R.cam.y)*R.cam.z+R.H/2}; }
function screenToWorld(x,y){ return {x:(x-R.W/2)/R.cam.z+R.cam.x,y:(y-R.H/2)/R.cam.z+R.cam.y}; }
function zoomToRoom(id){ const r=World.rooms[id]; if(!r) return; const z=Math.min(R.W/((r.w+3)*TS),R.H/((r.h+3)*TS),2.6); R.target={x:(r.x+r.w/2)*TS,y:(r.y+r.h/2)*TS,z}; R.follow=null; }
// ---------- per-frame ----------
function agentDrawPos(a){
  const s=a.spot?spotById(a.spot):null;
  let tx=a.pos.x, ty=a.pos.y;
  if(s && a.seated && !a.convId && !a.moving) { tx=s.dx; ty=s.dy; }
  else if(s && a.seated && a.convId) { tx=s.dx; ty=s.dy; }
  if(a.rx==null){ a.rx=tx; a.ry=ty; }
  const k=0.35; a.rx+=(tx-a.rx)*k; a.ry+=(ty-a.ry)*k;
  if(Math.abs(tx-a.rx)>3||Math.abs(ty-a.ry)>3){ a.rx=tx; a.ry=ty; }
  return {x:a.rx,y:a.ry};
}
function darkness(){ const h=hourOf(S.t); let d=0; if(h>=19&&h<22) d=(h-19)/3; else if(h>=22||h<5) d=1; else if(h>=5&&h<7.5) d=1-(h-5)/2.5; return d*0.58; }
function render(dt){
  R.time+=dt;
  const ctx=R.ctx; const cam=R.cam;
  if(R.follow){ const a=A(R.follow); if(a){ const p=agentDrawPos(a); R.target={x:p.x*TS,y:p.y*TS,z:Math.max(cam.z,1.4)}; } }
  if(R.target){ const k=1-Math.pow(0.0015,dt); cam.x+=(R.target.x-cam.x)*k; cam.y+=(R.target.y-cam.y)*k; cam.z+=(R.target.z-cam.z)*k; if(!R.follow && Math.abs(R.target.z-cam.z)<0.002 && Math.abs(R.target.x-cam.x)<0.5) R.target=null; }
  ctx.setTransform(R.dpr,0,0,R.dpr,0,0);
  ctx.fillStyle='#1b1630'; ctx.fillRect(0,0,R.W,R.H);
  ctx.save(); ctx.translate(R.W/2,R.H/2); ctx.scale(cam.z,cam.z); ctx.translate(-cam.x,-cam.y);
  ctx.imageSmoothingEnabled=true;
  ctx.drawImage(R.staticLayer,0,0,GW*TS,GH*TS);
  drawDynamic(ctx);
  const list=S.agents.map(a=>({a,p:agentDrawPos(a)})).sort((u,v)=>u.p.y-v.p.y);
  for(const {a,p} of list) drawCharacter(ctx,a,p.x*TS,p.y*TS,R.time);
  drawNight(ctx);
  ctx.restore();
  drawOverlays(ctx,list);
}
function drawDynamic(ctx){
  const t=R.time, party=S.party&&S.party.active&&S.outage<=0;
  // doors
  for(const d of World.doors){ if(!d.closable) continue; for(const [x,y] of d.tiles){ const px=x*TS, py=y*TS; if(d.open){ ctx.fillStyle='rgba(120,80,40,0.35)'; ctx.fillRect(px+2,py+TS/2-2,TS-4,4); } else { ctx.fillStyle='#8a5a32'; rrect(ctx,px+1,py+4,TS-2,TS-8,3); ctx.fill(); ctx.fillStyle='#e0b050'; ctx.beginPath(); ctx.arc(px+TS-8,py+TS/2,2.5,0,7); ctx.fill(); } } }
  // dance floor & lights
  if(party){
    for(let i=0;i<11;i++) for(let j=0;j<6;j++){ const ph=Math.sin(t*3+i*0.9+j*1.7)+Math.sin(t*2.1-i*0.5); if(ph>0.6){ const hue=((i*30+j*50+t*80)%360)|0; ctx.fillStyle=`hsla(${hue},90%,60%,${Math.min(0.75,(ph-0.6)*0.6)})`; ctx.fillRect((24+i)*TS+2,(16+j)*TS+2,TS-4,TS-4); } }
    ctx.save(); ctx.globalCompositeOperation='lighter';
    for(let k=0;k<3;k++){ const ang=Math.sin(t*0.8+k*2)*0.7+Math.PI/2; const sx=(24+k*5)*TS, sy=12*TS; const gr=ctx.createRadialGradient(sx,sy,10,sx,sy,330); const hue=(t*60+k*120)%360; gr.addColorStop(0,`hsla(${hue},100%,60%,0.22)`); gr.addColorStop(1,'hsla(0,0%,0%,0)'); ctx.fillStyle=gr; ctx.beginPath(); ctx.moveTo(sx,sy); ctx.arc(sx,sy,330,ang-0.22,ang+0.22); ctx.closePath(); ctx.fill(); }
    ctx.restore();
    // music notes
    ctx.font='16px serif'; ctx.fillStyle='rgba(255,255,255,0.8)'; for(let k=0;k<4;k++){ const ph=(t*0.6+k*0.25)%1; ctx.globalAlpha=1-ph; ctx.fillText(k%2?'♪':'♫',(20.5+(k%2)*17.8)*TS,12.8*TS-ph*40); } ctx.globalAlpha=1;
  }
  // snacks
  const snacks=Math.min(6,Math.ceil(S.snackStock));
  for(let i=0;i<snacks;i++){ const sx=36*TS+10+(i%2)*28, sy=15*TS+12+Math.floor(i/2)*28; ctx.fillStyle='#f4a261'; ctx.beginPath(); ctx.arc(sx,sy,8,0,7); ctx.fill(); ctx.fillStyle=['#e76f51','#ffd166','#8ac926'][i%3]; ctx.beginPath(); ctx.arc(sx,sy-1,5,0,7); ctx.fill(); }
  if(S.pizza>0){ for(let i=0;i<3;i++){ const px=(48+i*2)*TS, py=19*TS+14; ctx.fillStyle='#d9a066'; ctx.fillRect(px,py,30,30); ctx.fillStyle='#e85d04'; ctx.beginPath(); ctx.arc(px+15,py+15,11,0,7); ctx.fill(); ctx.fillStyle='#ffd166'; ctx.beginPath(); ctx.arc(px+11,py+12,3,0,7); ctx.arc(px+19,py+18,3,0,7); ctx.fill(); } }
  // TV
  const tvOn=S.agents.some(a=>a.act.type==='tv') && S.outage<=0;
  if(tvOn){ const hue=(t*40)%360; ctx.fillStyle=`hsl(${hue},60%,${55+Math.sin(t*7)*8}%)`; ctx.fillRect(11*TS+6,12*TS+4,4*TS-12,TS-14); ctx.save(); ctx.globalCompositeOperation='lighter'; const gr=ctx.createRadialGradient(13*TS,13*TS,10,13*TS,15*TS,170); gr.addColorStop(0,'rgba(140,180,255,0.18)'); gr.addColorStop(1,'rgba(0,0,0,0)'); ctx.fillStyle=gr; ctx.fillRect(8*TS,12*TS,10*TS,7*TS); ctx.restore(); }
  // pool shimmer
  ctx.strokeStyle='rgba(255,255,255,0.35)'; ctx.lineWidth=1.5; for(let k=0;k<6;k++){ const px=42*TS+20+k*50, py=31*TS+20+((k*37)%90); ctx.beginPath(); ctx.moveTo(px,py+Math.sin(t*2+k)*3); ctx.quadraticCurveTo(px+10,py-4+Math.sin(t*2+k)*3,px+20,py+Math.sin(t*2+k)*3); ctx.stroke(); }
  // fire pit
  const fireOn=darkness()>0.2 || S.agents.some(a=>a.spot&&spotById(a.spot).kind==='campseat');
  if(fireOn && S.storm<=0){ const cx=30*TS, cy=33*TS; ctx.save(); ctx.globalCompositeOperation='lighter'; const gr=ctx.createRadialGradient(cx,cy,4,cx,cy,120); gr.addColorStop(0,'rgba(255,170,60,0.45)'); gr.addColorStop(1,'rgba(255,120,0,0)'); ctx.fillStyle=gr; ctx.fillRect(cx-120,cy-120,240,240); ctx.restore(); for(let k=0;k<5;k++){ ctx.fillStyle=k%2?'#ffb703':'#fb5607'; const fl=10+Math.sin(t*9+k*2)*4; ctx.beginPath(); ctx.ellipse(cx-10+k*5,cy-fl/2,4,fl,0,0,7); ctx.fill(); } }
  // trash
  for(const tr of S.trash){ const x=tr.x*TS, y=tr.y*TS; if(tr.k===0){ ctx.fillStyle='#e63946'; ctx.fillRect(x-4,y-6,8,11); ctx.fillStyle='#fff'; ctx.fillRect(x-4,y-2,8,2); } else if(tr.k===1){ ctx.fillStyle='#ddd'; ctx.beginPath(); ctx.ellipse(x,y,7,4,0.4,0,7); ctx.fill(); ctx.fillStyle='#e9c46a'; ctx.beginPath(); ctx.arc(x+2,y,2,0,7); ctx.fill(); } else { ctx.fillStyle='#bde0fe'; ctx.fillRect(x-3,y-7,6,12); ctx.fillStyle='#457b9d'; ctx.fillRect(x-3,y-7,6,3); } }
}
function drawNight(ctx){
  let d=darkness(); const out=S.outage>0;
  if(out) d=Math.max(d,0.62);
  if(d<=0.01 && S.storm<=0) return;
  for(const r of Object.values(World.rooms)){
    const occupied=S.agents.some(a=>roomAtPos(a.pos)===r.id && a.act.type!=='sleep');
    let lit = !out && (occupied || r.id==='hall' || (r.id==='party'&&S.party&&S.party.active));
    let alpha = d*(lit?0.22:1);
    if(r.type==='garden'||r.type==='balcony') alpha=d*(out?0.95:0.8);
    ctx.fillStyle=`rgba(10,12,40,${alpha})`; ctx.fillRect((r.x-0.5)*TS,(r.y-0.5)*TS,(r.w+1)*TS,(r.h+1)*TS);
  }
  ctx.fillStyle=`rgba(10,12,40,${d*0.9})`; ctx.fillRect(0,33*TS,20*TS,7*TS);
  if(out){ // candles where people are
    ctx.save(); ctx.globalCompositeOperation='lighter';
    for(const a of S.agents){ if(a.act.type==='sleep') continue; const p=agentDrawPos(a); const gr=ctx.createRadialGradient(p.x*TS,p.y*TS,2,p.x*TS,p.y*TS,70); gr.addColorStop(0,'rgba(255,200,120,0.28)'); gr.addColorStop(1,'rgba(0,0,0,0)'); ctx.fillStyle=gr; ctx.fillRect(p.x*TS-70,p.y*TS-70,140,140); }
    ctx.restore();
  }
  if(!out && d>0.25){ // garden fairy lights + pool glow
    ctx.save(); ctx.globalCompositeOperation='lighter';
    for(let i=0;i<36;i++){ const x=(21.5+i*1.05)*TS, y=26.3*TS+Math.sin(i*0.9)*6; ctx.fillStyle=`hsla(${(i*40)%360},90%,70%,${0.55+0.35*Math.sin(R.time*2+i)})`; ctx.beginPath(); ctx.arc(x,y,2.6,0,7); ctx.fill(); }
    const gr=ctx.createRadialGradient(47*TS,33*TS,10,47*TS,33*TS,200); gr.addColorStop(0,'rgba(80,200,255,0.25)'); gr.addColorStop(1,'rgba(0,0,0,0)'); ctx.fillStyle=gr; ctx.fillRect(40*TS,27*TS,14*TS,12*TS);
    ctx.restore();
  }
  if(S.storm>0){
    if(R.rain.length<220) for(let i=0;i<220;i++) R.rain.push({x:rnd(),y:rnd(),v:0.6+rnd()*0.6});
    ctx.strokeStyle='rgba(190,210,255,0.45)'; ctx.lineWidth=1.2; ctx.beginPath();
    for(const r of R.rain){ r.y+=0.012*r.v; if(r.y>1){ r.y=0; r.x=rnd(); } const zone=r.x<0.22?{x:11,w:9,y:26,h:7}:{x:21,w:38,y:26,h:13}; const x=(zone.x+((r.x<0.22?r.x/0.22:(r.x-0.22)/0.78))*zone.w)*TS, y=(zone.y+r.y*zone.h)*TS; ctx.moveTo(x,y); ctx.lineTo(x-3,y+9); }
    ctx.stroke();
    if(rnd()<0.003) R.flash=1; if(R.flash>0){ ctx.fillStyle=`rgba(255,255,255,${R.flash*0.35})`; ctx.fillRect(0,0,GW*TS,GH*TS); R.flash-=0.06; }
  }
}
// ---------- characters ----------
function expressionOf(a){
  if(a.act.type==='sleep') return 'sleep';
  if(a.crying) return 'cry';
  if(a.laughUntil>S.t) return 'laugh';
  if(a.shockUntil>S.t) return 'shock';
  if(a.emotions.anger>55) return 'angry';
  if(a.flirtUntil>S.t) return 'flirty';
  if(a.emotions.embarrassment>50||a.emotions.fear>55) return 'nervous';
  if(a.emotions.sadness>45||a.emotions.loneliness>70) return 'sad';
  if(a.emotions.happiness>66||a.emotions.excitement>72) return 'happy';
  return 'neutral';
}
function drawCharacter(ctx,a,x,y,t,opt={}){
  const L=a.look; const face=opt.face||a.face; const ex=opt.expr||expressionOf(a);
  const act=opt.act||a.act.type; const seated=opt.seated!=null?opt.seated:a.seated;
  const moving=opt.moving!=null?opt.moving:a.moving;
  const ph=t*9+a.anim;
  if(act==='sleep' && a.spot && spotById(a.spot) && spotById(a.spot).kind==='bed' && !opt.thumb){
    const s=spotById(a.spot); const hx=s.dx*TS, hy=(s.dy-0.75)*TS;
    ctx.fillStyle=L.skin; ctx.beginPath(); ctx.arc(hx,hy,9,0,7); ctx.fill(); drawHair(ctx,L,hx,hy,'down',true);
    ctx.strokeStyle='#5a3d2b'; ctx.lineWidth=1.5; ctx.beginPath(); ctx.moveTo(hx-5,hy+1); ctx.lineTo(hx-1,hy+1); ctx.moveTo(hx+1,hy+1); ctx.lineTo(hx+5,hy+1); ctx.stroke();
    ctx.fillStyle=L.top; rrect(ctx,hx-21,hy+8,42,34,8); ctx.fill(); ctx.fillStyle='rgba(255,255,255,0.2)'; ctx.fillRect(hx-21,hy+12,42,3);
    const zp=(t*0.7+a.anim)%1; ctx.fillStyle=`rgba(255,255,255,${1-zp})`; ctx.font=`bold ${10+zp*6}px sans-serif`; ctx.fillText('z',hx+10+zp*10,hy-10-zp*16); ctx.fillText('z',hx+4+((zp+0.5)%1)*10,hy-6-((zp+0.5)%1)*16);
    return;
  }
  let bob=0, lift=0;
  if(moving||act==='pace'){ bob=Math.abs(Math.sin(ph))*2; }
  else if(act==='dance'){ bob=Math.abs(Math.sin(t*6+a.anim))*5; }
  else bob=Math.sin(t*2+a.anim)*0.6;
  if(a.crying && !moving) bob=Math.sin(t*14)*0.8;
  const sitDrop=seated?5:0;
  const bx=x, by=y-bob+sitDrop;
  // shadow
  ctx.fillStyle='rgba(0,0,0,0.22)'; ctx.beginPath(); ctx.ellipse(x,y+11,10,4,0,0,7); ctx.fill();
  // legs
  ctx.fillStyle=L.bottom;
  if(seated){ ctx.fillRect(bx-7,by+2,6,5); ctx.fillRect(bx+1,by+2,6,5); ctx.fillStyle='#2b2b2b'; ctx.fillRect(bx-7,by+6,6,3); ctx.fillRect(bx+1,by+6,6,3); }
  else { const sw=(moving||act==='pace')?Math.sin(ph)*3:act==='dance'?Math.sin(t*6+a.anim)*2:0;
    ctx.fillRect(bx-6,by+2,5,8+sw*0.5); ctx.fillRect(bx+1,by+2,5,8-sw*0.5); ctx.fillStyle='#2b2b2b'; ctx.fillRect(bx-6,by+9+sw*0.5,5,3); ctx.fillRect(bx+1,by+9-sw*0.5,5,3); }
  // arms
  const armCol=L.detail==='tank'?L.skin:L.top;
  let la=0, ra=0, up=false;
  if(moving) { la=Math.sin(ph)*3; ra=-la; }
  if(act==='dance'){ up=Math.sin(t*3+a.anim)>0; }
  ctx.fillStyle=armCol;
  const comforting = a.convId && opt.thumb!==true && (()=>{ const c=S.convs.find(c=>c.id===a.convId); const l=c&&c.lines[c.lines.length-1]; return l&&l.speaker===a.id&&(l.intent==='comfort'||l.intent==='forgive'||l.intent==='accept_love'); })();
  if(up){ rrect(ctx,bx-11,by-21,4,12,2); ctx.fill(); rrect(ctx,bx+7,by-21,4,12,2); ctx.fill(); ctx.fillStyle=L.skin; ctx.beginPath(); ctx.arc(bx-9,by-22,2.5,0,7); ctx.arc(bx+9,by-22,2.5,0,7); ctx.fill(); }
  else if(ex==='cry' && !moving){ rrect(ctx,bx-10,by-12,4,9,2); ctx.fill(); rrect(ctx,bx+6,by-12,4,9,2); ctx.fill(); }
  else if(comforting){ const dir=face==='left'?-1:1; rrect(ctx,bx-10,by-9+la,4,11,2); ctx.fill(); ctx.save(); ctx.translate(bx+dir*6,by-8); ctx.rotate(-dir*1.1); rrect(ctx,-2,0,4,13,2); ctx.fill(); ctx.restore(); }
  else { rrect(ctx,bx-10,by-9+la,4,11,2); ctx.fill(); rrect(ctx,bx+6,by-9+ra,4,11,2); ctx.fill(); ctx.fillStyle=L.skin; ctx.beginPath(); ctx.arc(bx-8,by+2+la,2.3,0,7); ctx.arc(bx+8,by+2+ra,2.3,0,7); ctx.fill(); }
  // torso
  ctx.fillStyle=L.top; rrect(ctx,bx-7,by-11,14,14,4); ctx.fill();
  drawOutfitDetail(ctx,L,bx,by,face);
  // head
  const hx=bx, hy=by-19;
  ctx.fillStyle=L.skin; ctx.beginPath(); ctx.arc(hx,hy,9,0,7); ctx.fill();
  if(face!=='up') drawFace(ctx,L,hx,hy,face,ex,t,a);
  drawHair(ctx,L,hx,hy,face,false);
  if(L.detail==='glasses' && face!=='up'){ ctx.strokeStyle='#222'; ctx.lineWidth=1.2; const o=face==='left'?-2:face==='right'?2:0; ctx.strokeRect(hx-7+o,hy-1,5,4); ctx.strokeRect(hx+2+o,hy-1,5,4); }
  if(L.detail==='hoodie'){ ctx.strokeStyle='#222'; ctx.lineWidth=2.2; ctx.beginPath(); ctx.arc(hx,hy-2,10.5,Math.PI*1.05,Math.PI*1.95); ctx.stroke(); ctx.fillStyle='#222'; ctx.fillRect(hx-11,hy-3,3,6); ctx.fillRect(hx+8,hy-3,3,6); }
  if(L.detail==='heart' && face!=='up'){ ctx.fillStyle='#ffd166'; ctx.beginPath(); ctx.arc(hx-9,hy+3,1.8,0,7); ctx.arc(hx+9,hy+3,1.8,0,7); ctx.fill(); }
  // emotion fx
  if(ex==='cry'){ const k=(t*1.6+a.anim)%1; ctx.fillStyle='rgba(120,190,255,0.9)'; ctx.beginPath(); ctx.ellipse(hx-4,hy+3+k*10,1.6,2.6,0,0,7); ctx.ellipse(hx+4,hy+3+((k+0.5)%1)*10,1.6,2.6,0,0,7); ctx.fill(); }
  if(ex==='angry'){ const k=(t*1.2+a.anim)%1; ctx.fillStyle=`rgba(255,255,255,${0.7*(1-k)})`; ctx.beginPath(); ctx.arc(hx+11+k*4,hy-12-k*10,3+k*3,0,7); ctx.arc(hx-11-k*4,hy-12-k*10,3+k*3,0,7); ctx.fill(); ctx.fillStyle='#e63946'; ctx.font='bold 11px sans-serif'; ctx.fillText('💢',hx+6,hy-10); }
  if(ex==='nervous'){ ctx.fillStyle='rgba(140,200,255,0.95)'; ctx.beginPath(); ctx.ellipse(hx+9,hy-6+Math.sin(t*4)*1,2,3,0,0,7); ctx.fill(); }
  if(ex==='flirty'){ const k=(t*0.9+a.anim)%1; ctx.globalAlpha=1-k; ctx.fillStyle='#ff4d8d'; ctx.font='11px sans-serif'; ctx.fillText('♥',hx+8,hy-12-k*12); ctx.globalAlpha=1; }
  if(ex==='laugh'){ ctx.fillStyle='#fff'; ctx.font='bold 9px sans-serif'; ctx.fillText('ha!',hx+9,hy-11-Math.abs(Math.sin(t*8))*3); }
  if(ex==='shock'){ ctx.fillStyle='#ffd166'; ctx.font='bold 12px sans-serif'; ctx.fillText('!',hx-2,hy-14); }
  if(act==='dance' && !opt.thumb){ const k=(t*0.8+a.anim)%1; ctx.globalAlpha=1-k; ctx.fillStyle='#fff'; ctx.font='10px serif'; ctx.fillText('♪',hx-14,hy-6-k*14); ctx.globalAlpha=1; }
}
function drawOutfitDetail(ctx,L,bx,by,face){
  switch(L.detail){
    case 'blazer': ctx.fillStyle=shade(L.top,-0.3); ctx.fillRect(bx-1,by-11,2,14); ctx.fillStyle=L.accent; ctx.beginPath(); ctx.arc(bx+3,by-5,1.3,0,7); ctx.arc(bx+3,by-1,1.3,0,7); ctx.fill(); ctx.fillStyle='#fff'; ctx.beginPath(); ctx.moveTo(bx-3,by-11); ctx.lineTo(bx,by-7); ctx.lineTo(bx+3,by-11); ctx.fill(); break;
    case 'heart': ctx.fillStyle='#fff'; ctx.font='8px sans-serif'; ctx.fillText('♥',bx-3,by-1); break;
    case 'tank': ctx.fillStyle=L.skin; ctx.fillRect(bx-7,by-11,3,4); ctx.fillRect(bx+4,by-11,3,4); ctx.fillStyle='#fff'; ctx.fillRect(bx-4,by-6,8,2); break;
    case 'paint': ctx.fillStyle='#ff9f9f'; ctx.beginPath(); ctx.arc(bx-3,by-6,1.6,0,7); ctx.fill(); ctx.fillStyle='#7b6be0'; ctx.beginPath(); ctx.arc(bx+3,by-2,1.6,0,7); ctx.fill(); ctx.fillStyle='#ffd166'; ctx.beginPath(); ctx.arc(bx+1,by-8,1.2,0,7); ctx.fill(); break;
    case 'hawaiian': ctx.fillStyle='#e63946'; for(const [dx,dy] of [[-4,-7],[3,-5],[-2,-1],[4,0]]){ ctx.beginPath(); ctx.arc(bx+dx,by+dy,1.5,0,7); ctx.fill(); } ctx.fillStyle='#2a9d8f'; ctx.beginPath(); ctx.arc(bx,by-9,1.3,0,7); ctx.fill(); break;
    case 'glasses': ctx.fillStyle=shade(L.top,0.15); ctx.fillRect(bx-5,by-11,10,3); break;
    case 'hoodie': ctx.fillStyle=shade(L.top,-0.2); ctx.fillRect(bx-4,by-3,8,4); ctx.strokeStyle='#eee'; ctx.lineWidth=0.8; ctx.beginPath(); ctx.moveTo(bx-2,by-11); ctx.lineTo(bx-2,by-6); ctx.moveTo(bx+2,by-11); ctx.lineTo(bx+2,by-6); ctx.stroke(); break;
    case 'sparkle': ctx.fillStyle=L.accent; for(const [dx,dy] of [[-4,-8],[3,-4],[-1,0],[5,-9]]){ ctx.fillRect(bx+dx,by+dy,1.6,1.6); } break;
    case 'cardigan': ctx.fillStyle='#fff'; ctx.fillRect(bx-2,by-11,4,14); ctx.fillStyle=L.accent; ctx.beginPath(); ctx.arc(bx-3,by-5,1,0,7); ctx.arc(bx-3,by-1,1,0,7); ctx.fill(); break;
    case 'jacket': ctx.fillStyle='#999'; ctx.fillRect(bx-0.5,by-11,1,14); ctx.fillStyle='#444'; ctx.fillRect(bx-7,by-11,3,3); ctx.fillRect(bx+4,by-11,3,3); break;
  }
}
function drawFace(ctx,L,hx,hy,face,ex,t,a){
  const o=face==='left'?-3:face==='right'?3:0; const side=face==='left'||face==='right';
  const ey=hy+1; const blink=(Math.sin(t*0.9+a.anim*3)>0.985);
  ctx.fillStyle='#2b1d16'; ctx.strokeStyle='#2b1d16'; ctx.lineWidth=1.4;
  const eyes=side?[hx+o]: [hx-3.5+o,hx+3.5+o];
  for(const exx of eyes){
    if(ex==='laugh'||ex==='happy'&&!side&&Math.sin(t*0.5+a.anim)>0.7){ ctx.beginPath(); ctx.arc(exx,ey+1,2,Math.PI*1.1,Math.PI*1.9); ctx.stroke(); }
    else if(blink||ex==='cry'){ ctx.beginPath(); ctx.moveTo(exx-2,ey); ctx.lineTo(exx+2,ey); ctx.stroke(); }
    else { ctx.beginPath(); ctx.arc(exx,ey,1.6,0,7); ctx.fill(); }
  }
  // brows
  ctx.lineWidth=1.3;
  for(const exx of eyes){ ctx.beginPath();
    if(ex==='angry'){ ctx.moveTo(exx-2.5,ey-4.5+(exx<hx?-1:1)); ctx.lineTo(exx+2.5,ey-3.5+(exx<hx?1:-1)); }
    else if(ex==='sad'||ex==='cry'||ex==='nervous'){ ctx.moveTo(exx-2.5,ey-3.5+(exx<hx?1:-1)); ctx.lineTo(exx+2.5,ey-4.5+(exx<hx?-1:1)); }
    else { ctx.moveTo(exx-2.2,ey-4); ctx.lineTo(exx+2.2,ey-4.2); }
    ctx.stroke(); }
  // mouth
  const mx=hx+o*0.8, my=hy+5.5; ctx.lineWidth=1.4;
  ctx.beginPath();
  switch(ex){
    case 'happy': case 'flirty': ctx.arc(mx,my-1.5,2.8,0.2,Math.PI-0.2); ctx.stroke(); break;
    case 'laugh': ctx.fillStyle='#7a2e2e'; ctx.arc(mx,my-1,3.2,0,Math.PI); ctx.fill(); break;
    case 'sad': case 'cry': ctx.arc(mx,my+1.8,2.6,Math.PI+0.3,-0.3); ctx.stroke(); break;
    case 'angry': ctx.moveTo(mx-3,my); ctx.lineTo(mx+3,my); ctx.stroke(); break;
    case 'nervous': ctx.moveTo(mx-3,my); ctx.quadraticCurveTo(mx-1.5,my-1.5,mx,my); ctx.quadraticCurveTo(mx+1.5,my+1.5,mx+3,my); ctx.stroke(); break;
    case 'shock': ctx.fillStyle='#7a2e2e'; ctx.ellipse(mx,my,1.8,2.4,0,0,7); ctx.fill(); break;
    default: ctx.moveTo(mx-2,my); ctx.lineTo(mx+2,my); ctx.stroke();
  }
  if(ex==='flirty'||ex==='nervous'||(ex==='happy'&&a.flirtUntil>S.t)){ ctx.fillStyle='rgba(255,100,130,0.45)'; ctx.beginPath(); ctx.arc(hx-6+o,hy+3,2.2,0,7); ctx.arc(hx+6+o,hy+3,2.2,0,7); ctx.fill(); }
}
function drawHair(ctx,L,hx,hy,face,lying){
  ctx.fillStyle=L.hair; const back=face==='up';
  switch(L.hairStyle){
    case 'sidepart': ctx.beginPath(); ctx.arc(hx,hy-2,9.5,Math.PI,0); ctx.fill(); ctx.beginPath(); ctx.moveTo(hx-9.5,hy-2); ctx.quadraticCurveTo(hx-2,hy-8,hx+9.5,hy-1); ctx.lineTo(hx+9.5,hy-4); ctx.fill(); if(back){ ctx.beginPath(); ctx.arc(hx,hy,9.5,0,7); ctx.fill(); } break;
    case 'long': ctx.beginPath(); ctx.arc(hx,hy-2,10,Math.PI,0); ctx.fill(); ctx.fillRect(hx-10,hy-2,4,back?16:15); ctx.fillRect(hx+6,hy-2,4,back?16:15); if(back){ rrect(ctx,hx-10,hy-4,20,18,6); ctx.fill(); } break;
    case 'buzz': ctx.globalAlpha=0.9; ctx.beginPath(); ctx.arc(hx,hy-1,9.3,Math.PI*1.05,Math.PI*1.95); ctx.lineTo(hx+8,hy-3); ctx.quadraticCurveTo(hx,hy-6,hx-8,hy-3); ctx.fill(); if(back){ ctx.beginPath(); ctx.arc(hx,hy,9.3,0,7); ctx.fill(); } ctx.globalAlpha=1; break;
    case 'wavy': ctx.beginPath(); ctx.arc(hx,hy-2,10.5,Math.PI,0); ctx.fill(); for(let i=0;i<4;i++){ ctx.beginPath(); ctx.arc(hx-9+(i%2)*0,hy+i*4,3.5,0,7); ctx.fill(); ctx.beginPath(); ctx.arc(hx+9,hy+i*4,3.5,0,7); ctx.fill(); } if(back){ rrect(ctx,hx-10,hy-4,20,20,8); ctx.fill(); } break;
    case 'curly': for(const [dx,dy] of [[-7,-5],[-3,-9],[2,-9],[7,-5],[-9,0],[9,0],[0,-6]]){ ctx.beginPath(); ctx.arc(hx+dx,hy+dy,4.6,0,7); ctx.fill(); } if(back){ ctx.beginPath(); ctx.arc(hx,hy,10,0,7); ctx.fill(); } break;
    case 'bun': ctx.beginPath(); ctx.arc(hx,hy-2,9.6,Math.PI,0); ctx.fill(); ctx.beginPath(); ctx.arc(hx,hy-12,5,0,7); ctx.fill(); if(back){ ctx.beginPath(); ctx.arc(hx,hy,9.6,0,7); ctx.fill(); } break;
    case 'fringe': ctx.beginPath(); ctx.arc(hx,hy-2,10,Math.PI,0); ctx.fill(); if(!back){ ctx.beginPath(); ctx.moveTo(hx-10,hy-2); ctx.lineTo(hx-6,hy+1); ctx.lineTo(hx-3,hy-3); ctx.lineTo(hx,hy+1); ctx.lineTo(hx+3,hy-3); ctx.lineTo(hx+6,hy+1); ctx.lineTo(hx+10,hy-2); ctx.fill(); } else { ctx.beginPath(); ctx.arc(hx,hy,10,0,7); ctx.fill(); } break;
    case 'afro': ctx.beginPath(); ctx.arc(hx,hy-5,13,Math.PI*0.9,Math.PI*2.1); ctx.fill(); ctx.fillStyle='#ffd60a'; ctx.fillRect(hx-10,hy-5,20,2); ctx.fillStyle=L.hair; if(back){ ctx.beginPath(); ctx.arc(hx,hy-2,13,0,7); ctx.fill(); } break;
    case 'short': ctx.beginPath(); ctx.arc(hx,hy-2,9.6,Math.PI,0); ctx.fill(); ctx.beginPath(); ctx.moveTo(hx-9.6,hy-2); ctx.quadraticCurveTo(hx,hy-6,hx+9.6,hy-2); ctx.fill(); if(back){ ctx.beginPath(); ctx.arc(hx,hy,9.6,0,7); ctx.fill(); } break;
    case 'undercut': ctx.fillStyle='#3a3a3a'; ctx.beginPath(); ctx.arc(hx,hy-1,9.4,Math.PI,0); ctx.fill(); ctx.fillStyle=L.hair; ctx.beginPath(); ctx.moveTo(hx-8,hy-6); ctx.quadraticCurveTo(hx+2,hy-14,hx+11,hy-3); ctx.lineTo(hx+10,hy+6); ctx.quadraticCurveTo(hx+4,hy-4,hx-8,hy-4); ctx.fill(); if(back){ ctx.beginPath(); ctx.arc(hx,hy,9.4,0,7); ctx.fill(); } break;
  }
}
// ---------- screen-space overlays (bubbles, names) ----------
function wrapText(ctx,text,maxW){ const words=text.split(' '); const lines=[]; let cur=''; for(const w of words){ const t=cur?cur+' '+w:w; if(ctx.measureText(t).width>maxW && cur){ lines.push(cur); cur=w; } else cur=t; } if(cur) lines.push(cur); return lines.slice(0,5); }
function drawOverlays(ctx,list){
  const z=R.cam.z; const placed=[];
  for(const {a,p} of list){
    const sp=worldToScreen(p.x*TS,p.y*TS);
    const sel=R.selected===a.id, fol=R.follow===a.id, hov=R.hover===a.id;
    if(sel||fol){ ctx.strokeStyle=fol?'#ffd166':'#ffffff'; ctx.lineWidth=2; ctx.setLineDash([4,3]); ctx.beginPath(); ctx.ellipse(sp.x,sp.y+11*z,15*z,6*z,0,0,7); ctx.stroke(); ctx.setLineDash([]); }
    if(z>0.85 || sel || hov || fol){
      ctx.font=`700 ${Math.max(10,Math.min(13,10*z))}px Nunito, system-ui, sans-serif`; const label=a.name; const w=ctx.measureText(label).width+10; const nx=sp.x-w/2, ny=sp.y+15*z;
      ctx.fillStyle=sel?'rgba(255,255,255,0.95)':'rgba(18,14,36,0.7)'; rrect(ctx,nx,ny,w,15,7.5); ctx.fill(); ctx.fillStyle=sel?'#1b1630':'#fff'; ctx.textBaseline='middle'; ctx.fillText(label,nx+5,ny+8);
    }
  }
  for(const {a,p} of list){
    if(!a.bubble || S.t>a.bubble.until) continue;
    const sp=worldToScreen(p.x*TS,(p.y)*TS-34);
    const b=a.bubble; const whisper=b.volume==='whisper', loud=b.volume==='loud';
    ctx.font=`${whisper?'italic ':loud?'800 ':'600 '}${loud?13:12}px Nunito, system-ui, sans-serif`;
    const lines=wrapText(ctx,b.text,190); const lh=15; const w=Math.max(...lines.map(l=>ctx.measureText(l).width))+18; const h=lines.length*lh+12;
    let bx=sp.x-w/2, by=sp.y-h-10*Math.min(1,z);
    for(const r of placed){ if(bx<r.x+r.w && bx+w>r.x && by<r.y+r.h && by+h>r.y) by=r.y-h-4; }
    placed.push({x:bx,y:by,w,h});
    const fade=Math.min(1,(b.until-S.t)*2);
    ctx.globalAlpha=Math.max(0,fade);
    ctx.fillStyle=whisper?'rgba(235,240,255,0.92)':'#ffffff'; ctx.strokeStyle=loud?'#e63946':whisper?'#8a94b8':'rgba(0,0,0,0.25)'; ctx.lineWidth=loud?2.5:1.2;
    if(whisper) ctx.setLineDash([4,3]);
    rrect(ctx,bx,by,w,h,10); ctx.fill(); ctx.stroke(); ctx.setLineDash([]);
    ctx.beginPath(); ctx.moveTo(sp.x-6,by+h-0.5); ctx.lineTo(sp.x,by+h+8); ctx.lineTo(sp.x+6,by+h-0.5); ctx.closePath(); ctx.fill();
    ctx.fillStyle=whisper?'#4a5578':'#1b1630'; ctx.textBaseline='top';
    lines.forEach((l,i)=>ctx.fillText(l,bx+9,by+7+i*lh));
    ctx.fillStyle=a.look.top; ctx.beginPath(); ctx.arc(bx+2,by+2,5,0,7); ctx.fill();
    ctx.globalAlpha=1;
  }
}
