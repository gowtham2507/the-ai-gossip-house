'use strict';
// ================= CORE: utils, world, pathfinding =================
const TS = 32, GW = 60, GH = 40;
let RAND = Math.random;
function seedRandom(seed){ let s=(seed>>>0)||88675123; RAND=()=>{ s^=s<<13; s>>>=0; s^=s>>>17; s^=s<<5; s>>>=0; return s/4294967296; }; }
const rnd = () => RAND();
const clamp = (v,a=0,b=100) => v<a?a:v>b?b:v;
const pick = a => a[Math.floor(rnd()*a.length)];
const chance = p => rnd() < p;
const rr = (a,b) => a + rnd()*(b-a);
let _uidc = 0; const uid = p => p + (++_uidc).toString(36) + Math.floor(rnd()*46656).toString(36);
const dist = (a,b) => Math.hypot(a.x-b.x, a.y-b.y);
function weightedPick(opts, temp=10){
  opts = opts.filter(o=>isFinite(o.score));
  if(!opts.length) return null;
  const max = Math.max(...opts.map(o=>o.score));
  const ws = opts.map(o=>Math.exp((o.score-max)/temp));
  const tot = ws.reduce((a,b)=>a+b,0); let r = rnd()*tot;
  for(let i=0;i<opts.length;i++){ r-=ws[i]; if(r<=0) return opts[i]; }
  return opts[opts.length-1];
}

const ROOM_DEFS = [
  {id:'bed1',name:'Bedroom 1',type:'bedroom',x:1,y:1,w:9,h:7},
  {id:'bed2',name:'Bedroom 2',type:'bedroom',x:11,y:1,w:9,h:7},
  {id:'bed3',name:'Bedroom 3',type:'bedroom',x:21,y:1,w:9,h:7},
  {id:'bed4',name:'Bedroom 4',type:'bedroom',x:31,y:1,w:9,h:7},
  {id:'bed5',name:'Bedroom 5',type:'bedroom',x:41,y:1,w:9,h:7},
  {id:'bath1',name:'Bathroom A',type:'bathroom',x:51,y:1,w:3,h:7},
  {id:'bath2',name:'Bathroom B',type:'bathroom',x:55,y:1,w:4,h:7},
  {id:'hall',name:'Hallway',type:'hall',x:1,y:9,w:58,h:2},
  {id:'living',name:'Living Room',type:'living',x:1,y:12,w:18,h:13},
  {id:'party',name:'Party Hall',type:'party',x:20,y:12,w:19,h:13},
  {id:'kitchen',name:'Kitchen',type:'kitchen',x:40,y:12,w:19,h:13},
  {id:'corner',name:'Private Corner',type:'corner',x:1,y:26,w:9,h:7},
  {id:'balcony',name:'Balcony',type:'balcony',x:11,y:26,w:9,h:7},
  {id:'garden',name:'Garden',type:'garden',x:21,y:26,w:38,h:13},
];
const DOOR_DEFS = [
  {id:'d_bed1',tiles:[[5,8]],a:'bed1',b:'hall',closable:true},
  {id:'d_bed2',tiles:[[15,8]],a:'bed2',b:'hall',closable:true},
  {id:'d_bed3',tiles:[[25,8]],a:'bed3',b:'hall',closable:true},
  {id:'d_bed4',tiles:[[35,8]],a:'bed4',b:'hall',closable:true},
  {id:'d_bed5',tiles:[[45,8]],a:'bed5',b:'hall',closable:true},
  {id:'d_bath1',tiles:[[52,8]],a:'bath1',b:'hall',closable:true},
  {id:'d_bath2',tiles:[[56,8]],a:'bath2',b:'hall',closable:true},
  {id:'d_living',tiles:[[8,11],[9,11]],a:'living',b:'hall'},
  {id:'d_party',tiles:[[28,11],[29,11],[30,11]],a:'party',b:'hall'},
  {id:'d_kitchen',tiles:[[56,11],[57,11]],a:'kitchen',b:'hall'},
  {id:'d_lp',tiles:[[19,17],[19,18]],a:'living',b:'party'},
  {id:'d_pk',tiles:[[39,17],[39,18]],a:'kitchen',b:'party'},
  {id:'d_corner',tiles:[[5,25]],a:'corner',b:'living',closable:true},
  {id:'d_balc',tiles:[[15,25]],a:'balcony',b:'living'},
  {id:'d_pg',tiles:[[28,25],[29,25],[30,25]],a:'garden',b:'party'},
  {id:'d_kg',tiles:[[50,25]],a:'garden',b:'kitchen'},
  {id:'d_bg',tiles:[[20,29]],a:'balcony',b:'garden'},
];

const World = { grid:null, roomAt:null, rooms:{}, doors:[], furniture:[], spots:[], spotMap:{} };
function buildWorld(){
  const g=[], ra=[];
  for(let y=0;y<GH;y++){ g.push(new Array(GW).fill(1)); ra.push(new Array(GW).fill(null)); }
  World.rooms={};
  for(const r of ROOM_DEFS){ World.rooms[r.id]={...r}; for(let y=r.y;y<r.y+r.h;y++) for(let x=r.x;x<r.x+r.w;x++){ g[y][x]=0; ra[y][x]=r.id; } }
  for(let y=33;y<=38;y++) for(let x=0;x<=19;x++) g[y][x]=3; // outside lawn
  World.doors = DOOR_DEFS.map(d=>({...d, open:true}));
  for(const d of World.doors) for(const [x,y] of d.tiles){ g[y][x]=0; ra[y][x]=d.a; }
  World.grid=g; World.roomAt=ra; World.furniture=[]; World.spots=[]; World.spotMap={};
  const F=(kind,x,y,w,h,o={})=>{ const f={kind,x,y,w,h,...o,room:ra[y][x]}; World.furniture.push(f); if(!o.walk) for(let yy=y;yy<y+h;yy++) for(let xx=x;xx<x+w;xx++) g[yy][xx]=2; return f; };
  const S_=(kind,ax,ay,dx,dy,face,o={})=>{ const s={id:'s'+World.spots.length,kind,ax,ay,dx,dy,face,occ:null,room:ra[ay][ax],...o}; World.spots.push(s); World.spotMap[s.id]=s; return s; };
  // Bedrooms
  const bedOwners=[['alex','ryan'],['mia','zara'],['luna','ivy'],['max','ethan'],['sophia','noah']];
  for(let k=0;k<5;k++){
    const x0=1+10*k;
    F('rug',x0+2,4,5,3,{walk:true,color:['#d98f6f','#a77bd1','#6fb7a8','#e0b354','#7c93c9'][k]});
    F('bed',x0,1,2,3,{owner:bedOwners[k][0],side:'L'});
    F('bed',x0+7,1,2,3,{owner:bedOwners[k][1],side:'R'});
    F('desk',x0+3,1,3,1);
    F('wardrobe',x0,6,1,2);
    F('plant',x0+8,7,1,1);
    S_('bed',x0+2,2,x0+1,2.2,'down',{owner:bedOwners[k][0]});
    S_('bed',x0+6,2,x0+8,2.2,'down',{owner:bedOwners[k][1]});
    S_('desk',x0+4,2,x0+4.5,2.35,'up');
  }
  // Bathrooms
  F('tub',52,1,2,2); F('toilet',51,1,1,1); F('sink',51,6,1,1);
  S_('toilet',51,2,51.5,1.75,'down'); S_('mirror',52,6,52.5,6.4,'left');
  F('tub',57,1,2,2); F('toilet',55,1,1,1); F('sink',58,6,1,1);
  S_('toilet',55,2,55.5,1.75,'down'); S_('mirror',57,6,57.5,6.4,'right');
  // Living room
  F('rug',6,13,11,7,{walk:true,color:'#c56b5a'});
  F('tv',11,12,4,1); F('ctable',12,14,2,1);
  F('sofa',10,16,6,1,{face:'up',color:'#4f6d8f'});
  for(let x=10;x<=15;x++) S_('sofa',x,17,x+0.5,16.55,'up');
  F('armchair',7,14,1,1,{color:'#8f5a7a'}); S_('sofa',8,14,7.55,14.5,'right');
  F('armchair',17,14,1,1,{color:'#8f5a7a'}); S_('sofa',16,14,17.45,14.5,'left');
  F('sofa',12,22,5,1,{face:'up',color:'#6b8f5a'});
  for(let x=12;x<=16;x++) S_('sofa',x,21,x+0.5,22.45,'down');
  F('shelf',1,19,1,4); S_('books',2,20,2.5,20.5,'left'); S_('books',2,22,2.5,22.5,'left');
  F('plant',1,12,1,1); F('plant',18,12,1,1); F('lamp',2,24,1,1); F('plant',18,24,1,1);
  // Party hall
  F('dancefloor',24,16,11,6,{walk:true});
  F('dj',32,12,5,2); S_('dj',34,14,34.5,14.2,'up');
  F('speaker',20,12,1,1); F('speaker',38,12,1,1); F('speaker',20,24,1,1); F('speaker',38,24,1,1);
  F('snacktable',36,15,2,3);
  for(let y=15;y<=17;y++) S_('snack',35,y,35.5,y+0.5,'right');
  for(let y=16;y<=20;y+=2) for(let x=24;x<=34;x+=2) S_('dance',x,y,x+0.5,y+0.5,'down');
  F('bench',21,23,5,1,{color:'#7a4fb0'}); for(let x=21;x<=25;x++) S_('partyseat',x,22,x+0.5,23.35,'up');
  F('sofaV',21,14,1,4,{color:'#b04f8f'}); for(let y=14;y<=17;y++) S_('partyseat',22,y,21.6,y+0.5,'right');
  // Kitchen
  F('counter',40,12,10,1); F('fridge',52,12,2,2); F('counter',54,12,1,1);
  S_('stove',43,13,43.5,13.3,'up'); S_('stove',47,13,47.5,13.3,'up'); S_('fridge',52,14,52.5,14.2,'up');
  F('island',43,15,5,1); for(let x=43;x<=47;x++) S_('dine',x,16,x+0.5,15.75,'up');
  F('table',46,19,8,2);
  for(let x=46;x<=53;x++){ S_('dine',x,18,x+0.5,18.6,'down'); S_('dine',x,21,x+0.5,21.4,'up'); }
  F('plant',58,24,1,1); F('plant',40,24,1,1);
  // Private corner
  F('rug',2,27,7,5,{walk:true,color:'#3f6e5a'});
  F('armchair',2,28,1,1,{color:'#a0634a'}); S_('cornerseat',3,28,2.55,28.5,'right');
  F('armchair',7,28,1,1,{color:'#a0634a'}); S_('cornerseat',6,28,7.45,28.5,'left');
  F('lamp',5,31,1,1); F('plant',1,32,1,1); F('plant',9,32,1,1); F('shelf',9,26,1,2);
  S_('books',8,27,8.5,27.5,'right');
  // Balcony
  F('easel',12,27,1,1); S_('easel',12,28,12.5,28.3,'up');
  S_('rail',19,27,19.5,27.5,'right'); S_('rail',19,28,19.5,28.5,'right'); S_('rail',19,31,19.5,31.5,'right');
  F('lounger',14,32,2,1,{color:'#e0e0e0'}); S_('lounger',14,31,14.5,32.3,'up'); S_('lounger',15,31,15.5,32.3,'up');
  F('plant',11,32,1,1); F('plant',18,26,1,1);
  // Garden
  F('path',21,28,38,2,{walk:true});
  F('firepit',29,32,2,2);
  [[28,32,'right'],[28,33,'right'],[31,32,'left'],[31,33,'left'],[29,31,'down'],[30,31,'down'],[29,34,'up'],[30,34,'up']]
    .forEach(([x,y,f])=>S_('campseat',x,y,x+0.5,y+0.5,f));
  F('pool',42,31,10,4);
  for(let x=43;x<=50;x+=2) S_('pool',x,35,x+0.5,34.7,'up');
  F('lounger',44,37,1,1,{color:'#ffd6a5'}); F('lounger',47,37,1,1,{color:'#ffd6a5'}); F('lounger',50,37,1,1,{color:'#ffd6a5'});
  S_('lounger',44,36,44.5,37.3,'up'); S_('lounger',47,36,47.5,37.3,'up'); S_('lounger',50,36,50.5,37.3,'up');
  F('gymbar',55,32,2,1); S_('gym',55,33,55.5,33.2,'up'); S_('gym',56,33,56.5,33.2,'up');
  F('gbench',36,32,2,1,{color:'#8b5e3c'}); S_('bench',36,33,36.5,32.6,'up'); S_('bench',37,33,37.5,32.6,'up');
  [[23,27],[25,37],[34,37],[39,27],[54,27],[57,37],[22,34]].forEach(([x,y])=>F('tree',x,y,1,1));
  F('flowers',24,31,3,1,{walk:true}); F('flowers',38,36,3,1,{walk:true}); F('flowers',52,37,3,1,{walk:true});
}
function walkable(x,y){ return x>=0&&y>=0&&x<GW&&y<GH&&World.grid[y][x]===0; }
function nearestWalkable(x,y){ for(let r=1;r<7;r++) for(let dy=-r;dy<=r;dy++) for(let dx=-r;dx<=r;dx++){ if(walkable(x+dx,y+dy)) return {x:x+dx,y:y+dy}; } return null; }
function findPath(sx,sy,tx,ty){
  sx=Math.floor(sx); sy=Math.floor(sy); tx=Math.floor(tx); ty=Math.floor(ty);
  if(!walkable(tx,ty)){ const n=nearestWalkable(tx,ty); if(!n) return null; tx=n.x; ty=n.y; }
  if(!walkable(sx,sy)){ const n=nearestWalkable(sx,sy); if(n){ sx=n.x; sy=n.y; } }
  const N=GW*GH, key=(x,y)=>y*GW+x;
  const gS=new Float32Array(N).fill(Infinity), came=new Int32Array(N).fill(-1), closed=new Uint8Array(N);
  const heap=[];
  const push=(f,i)=>{ heap.push([f,i]); let c=heap.length-1; while(c>0){ const p=(c-1)>>1; if(heap[p][0]<=heap[c][0]) break; [heap[p],heap[c]]=[heap[c],heap[p]]; c=p; } };
  const pop=()=>{ const top=heap[0], last=heap.pop(); if(heap.length){ heap[0]=last; let c=0; for(;;){ const l=2*c+1, r=l+1; let m=c; if(l<heap.length&&heap[l][0]<heap[m][0]) m=l; if(r<heap.length&&heap[r][0]<heap[m][0]) m=r; if(m===c) break; [heap[m],heap[c]]=[heap[c],heap[m]]; c=m; } } return top; };
  const h=(x,y)=>{ const dx=Math.abs(x-tx), dy=Math.abs(y-ty); return Math.max(dx,dy)+0.414*Math.min(dx,dy); };
  const s=key(sx,sy), t=key(tx,ty); gS[s]=0; push(h(sx,sy),s);
  const dirs=[[1,0,1],[-1,0,1],[0,1,1],[0,-1,1],[1,1,1.414],[1,-1,1.414],[-1,1,1.414],[-1,-1,1.414]];
  while(heap.length){
    const [,cur]=pop(); if(closed[cur]) continue; closed[cur]=1; if(cur===t) break;
    const cx=cur%GW, cy=(cur/GW)|0;
    for(const [dx,dy,c] of dirs){
      const nx=cx+dx, ny=cy+dy; if(!walkable(nx,ny)) continue;
      if(dx&&dy&&(!walkable(cx+dx,cy)||!walkable(cx,cy+dy))) continue;
      const ni=key(nx,ny); if(closed[ni]) continue; const ng=gS[cur]+c;
      if(ng<gS[ni]){ gS[ni]=ng; came[ni]=cur; push(ng+h(nx,ny),ni); }
    }
  }
  if(s===t) return [];
  if(came[t]===-1) return null;
  const path=[]; let c=t; while(c!==s&&c!==-1){ path.push({x:c%GW+0.5,y:((c/GW)|0)+0.5}); c=came[c]; }
  return path.reverse();
}
function roomAtPos(p){ const x=Math.floor(p.x), y=Math.floor(p.y); return (World.roomAt[y]&&World.roomAt[y][x])||null; }
function roomName(id){ return (World.rooms[id]&&World.rooms[id].name)||'the house'; }
function randomFloorIn(roomId, avoidSpots=true){
  const r=World.rooms[roomId];
  for(let i=0;i<80;i++){ const x=r.x+Math.floor(rnd()*r.w), y=r.y+Math.floor(rnd()*r.h); if(walkable(x,y)&&(!avoidSpots||!World.spots.some(s=>s.ax===x&&s.ay===y))) return {x,y}; }
  return nearestWalkable(r.x,r.y)||{x:r.x,y:r.y};
}
function doorBetween(r1,r2){ return World.doors.find(d=>(d.a===r1&&d.b===r2)||(d.a===r2&&d.b===r1)); }
