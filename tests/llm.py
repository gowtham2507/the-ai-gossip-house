import asyncio
import os; os.makedirs('tests/output',exist_ok=True)
from playwright.async_api import async_playwright
FAKE = """
window.__calls=0;
const fake=async (input,opts)=>{ window.__calls++; await new Promise(r=>setTimeout(r,250));
  if(typeof input==='string' && input.startsWith('Reply with the single word')) return {text:'ready'};
  const m=input.match(/YOUR IMPULSE: ([^.]+)/); const n=input.match(/You write ONE line of dialogue for (\\w+)/);
  const f=input.match(/\\[(F\\d+)\\]/);
  if(window.__calls%7===0) return {text:'not json at all'};
  return {text: JSON.stringify({speech:`(${n[1]}) ${m?m[1]:'hi'}`, intent: /reveal|gossip/.test(m&&m[1]||'')?'gossip':'chat', to:null, factIds: f&&/gossip|reveal/.test(m[1])?[f[1]]:[], newClaim:null, volume:'normal', emotion:'happy', endConversation:false, thought:'testing'})};
};
fake.limits=async()=>({images:false});
window.claude={use:async n=>n==='sample'?fake:null};
"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1280,'height':800})
        errs=[]
        pg.on('pageerror', lambda e: errs.append('PAGEERR: '+str(e)))
        pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type=='error' else None)
        await pg.add_init_script(FAKE)
        await pg.goto('file://'+__import__("os").path.abspath("dist/index.html")+'')
        await pg.wait_for_timeout(800)
        await pg.click('#mClaude')
        await pg.click('[data-sp="2"]')
        await pg.wait_for_timeout(15000)
        r = await pg.evaluate("""(()=>{ const ls=S.convs.concat(S.ended).flatMap(c=>c.lines); return {calls:window.__calls, claude:ls.filter(l=>l.src==='claude').length, fallback:ls.filter(l=>l.src==='fallback').length, offline:ls.filter(l=>l.src==='offline').length, invalid:LLM.invalid, status:LLM.status, sample:ls.filter(l=>l.src==='claude').slice(0,3).map(l=>l.text)}; })()""")
        print(r)
        await pg.evaluate("setTab('talks')"); await pg.wait_for_timeout(500)
        await pg.screenshot(path='tests/output/s7_llm.png')
        print(errs or 'no errors')
        await b.close()
asyncio.run(main())
