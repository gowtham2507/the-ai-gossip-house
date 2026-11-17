import asyncio, sys
from playwright.async_api import async_playwright
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(args=['--no-sandbox'])
        pg = await b.new_page(viewport={'width':1440,'height':900})
        errs=[]
        pg.on('console', lambda m: errs.append(m.type+': '+m.text) if m.type in ('error','warning') else None)
        pg.on('pageerror', lambda e: errs.append('PAGEERR: '+str(e)))
        await pg.goto('file://'+__import__("os").path.abspath("dist/index.html")+'')
        await pg.wait_for_timeout(1500)
        await pg.screenshot(path='docs/screenshots/s0_intro.png')
        await pg.click('#mOffline')
        await pg.click('[data-sp="5"]')
        await pg.wait_for_timeout(9000)
        await pg.screenshot(path='docs/screenshots/s1_house.png')
        # select an agent via card
        await pg.evaluate("selectAgent('luna')")
        await pg.wait_for_timeout(800)
        await pg.evaluate("R.follow='luna'")
        await pg.wait_for_timeout(2500)
        await pg.screenshot(path='docs/screenshots/s2_follow.png')
        await pg.evaluate("setTab('talks')"); await pg.wait_for_timeout(600)
        await pg.screenshot(path='docs/screenshots/s3_talks.png')
        await pg.evaluate("setTab('feed')"); await pg.wait_for_timeout(600)
        await pg.screenshot(path='docs/screenshots/s4_feed.png')
        await pg.evaluate("triggerHouseEvent('party'); S.t=Math.floor(S.t/1440)*1440+21.5*60; R.follow=null; zoomToRoom('party')")
        await pg.wait_for_timeout(9000)
        await pg.screenshot(path='docs/screenshots/s5_party.png')
        await pg.evaluate("setTab('house')"); await pg.wait_for_timeout(500)
        await pg.screenshot(path='docs/screenshots/s6_house.png')
        print('\n'.join(errs[:30]) or 'no errors')
        await b.close()
asyncio.run(main())
