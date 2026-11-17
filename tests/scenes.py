"""Render story scenes from a deterministic seeded run (seed 11) into docs/images/."""
import asyncio, os
from playwright.async_api import async_playwright
APP='file://'+os.path.abspath('dist/index.html')
OUT='docs/images/'
def T(day,h,m): return (day-1)*1440+h*60+m
SCENES=[ # name, time, agents to frame, zoom, select
 ('01_day_overview',  T(1,12,30), None, None, None),
 ('02_party_night',   T(1,22,40), 'room:party', None, None),
 ('03_truth_or_dare_confession', T(2,0,5.6), ['mia','max','alex','zara'], 2.1, None),
 ('04_night_overview', T(3,23,40), None, None, None),
 ('05_noah_confides_in_luna', T(4,14,0.9), ['noah','luna'], 2.6, None),
 ('06_mia_spreads_the_secret', T(4,14,6.4), ['mia','sophia','noah'], 2.0, None),
 ('07_noah_cries', T(4,14,35.2), ['noah'], 2.6, None),
 ('08_luna_comforts_noah', T(4,15,0.6), ['luna','noah'], 2.6, None),
 ('09_noah_confronts_luna', T(4,15,26.6), ['noah','luna'], 2.6, None),
 ('10_inspector_noah', T(4,15,40), ['noah'], 1.8, 'noah'),
]
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(args=['--no-sandbox'])
        pg=await b.new_page(viewport={'width':1440,'height':900}, device_scale_factor=1.5)
        errs=[]; pg.on('pageerror',lambda e: errs.append(str(e)))
        await pg.goto(APP); await pg.wait_for_timeout(800)
        await pg.click('#mOffline')
        await pg.evaluate("SIM.paused=true; newGame(11); R.selected=null; document.getElementById('toasts').style.display='none'")
        for name,t,who,z,sel in SCENES:
            await pg.evaluate(f"""(()=>{{ const T={t}; while(S.t<T) tick(0.25); if('{name}'==='07_noah_cries'){{ const n=A('noah'); let k=0; while(!(n.crying&&!n.convId&&(!n.path||!n.path.length)&&n.act.type!=='walk')&&k++<400) tick(0.25); n.face='down'; }} SIM.paused=true; for(const a of S.agents) a.rx=null; }})()""")
            if who is None: await pg.evaluate("R.follow=null; fitCamera(); R.cam={...R.target};")
            elif isinstance(who,str): await pg.evaluate(f"R.follow=null; zoomToRoom('{who[5:]}'); R.cam={{...R.target}};")
            else: await pg.evaluate(f"""(()=>{{ const ids={who}; const ps=ids.map(id=>agentDrawPos(A(id))); const x=ps.reduce((s,p)=>s+p.x,0)/ps.length, y=ps.reduce((s,p)=>s+p.y,0)/ps.length; R.follow=null; R.cam={{x:x*TS,y:y*TS-20,z:{z}}}; R.target=null; }})()""")
            if sel: await pg.evaluate(f"selectAgent('{sel}')")
            else: await pg.evaluate("R.selected=null")
            await pg.wait_for_timeout(700)
            if sel: await pg.screenshot(path=OUT+name+'.png')
            else: await pg.locator('#stageWrap').screenshot(path=OUT+name+'.png')
            print(name, await pg.evaluate("`D${dayOf(S.t)} ${fmtTime(S.t)} `+S.agents.filter(a=>a.bubble&&S.t<a.bubble.until).map(a=>a.name+': '+a.bubble.text).join(' | ')"))
        # cast sheet
        await pg.evaluate("""(()=>{ const c=document.createElement('canvas'); c.id='cast'; c.width=1500; c.height=330; document.body.appendChild(c); c.style.cssText='position:fixed;left:0;top:0;z-index:99;background:#1b1630';
          const g=c.getContext('2d'); g.fillStyle='#1b1630'; g.fillRect(0,0,1500,330);
          S.agents.forEach((a,i)=>{ g.save(); g.translate(75+i*150,150); g.scale(3.2,3.2); drawCharacter(g,a,0,0,1,{face:'down',seated:false,moving:false,act:'idle',expr:['happy','neutral','angry','sad','laugh','neutral','neutral','flirty','happy','neutral'][i],thumb:true}); g.restore();
            g.fillStyle='#fff'; g.font='800 22px Nunito,sans-serif'; g.textAlign='center'; g.fillText(a.name,75+i*150,250); g.fillStyle='#a9a2cc'; g.font='600 14px Nunito,sans-serif'; g.fillText(a.archetype.replace('The ',''),75+i*150,274); }); })()""")
        await pg.locator('#cast').screenshot(path=OUT+'00_cast.png')
        print('errors:',errs or 'none')
        await b.close()
asyncio.run(main())
