import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { createServer } from 'vite';

async function assertVisibleFocus(target) {
  const focus = await target.evaluate((el) => {
    const style = getComputedStyle(el);
    const rect = el.getBoundingClientRect();
    const outset =
      parseFloat(style.outlineOffset) + parseFloat(style.outlineWidth);
    return {
      visible: el.matches(':focus-visible'),
      focused: el === document.activeElement,
      style: style.outlineStyle,
      width: parseFloat(style.outlineWidth),
      color: style.outlineColor,
      insideViewport:
        rect.left - outset >= 0 &&
        rect.top - outset >= 0 &&
        rect.right + outset <= innerWidth &&
        rect.bottom + outset <= innerHeight,
    };
  });
  assert.equal(focus.focused, true, 'The control must be reachable with Tab');
  assert.equal(focus.visible, true, 'Tab must activate :focus-visible');
  assert.ok(
    !['none', 'hidden'].includes(focus.style),
    'Focus outline must be drawn',
  );
  assert.ok(focus.width >= 2, 'Focus outline must be at least 2px wide');
  assert.ok(!['transparent', 'rgba(0, 0, 0, 0)'].includes(focus.color));
  assert.ok(
    focus.insideViewport,
    'Focus outline must not be clipped by the viewport',
  );
}

const server = await createServer({ server: { host: '127.0.0.1', port: 0 } });
let browser;
try {
  await server.listen();
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH,
  });
  for (const viewport of [
    { width: 1440, height: 900 },
    { width: 390, height: 844 },
  ]) {
    for (const reducedMotion of ['no-preference', 'reduce']) {
      const page = await browser.newPage({ viewport, reducedMotion });
      // Exercise the real stylesheet and clipping layout without running WebGL.
      await page.setContent(`
        <link rel="stylesheet" href="${server.resolvedUrls.local[0]}app/globals.css?direct">
        <div class="site dark">
          <button class="menu-toggle">Menus</button>
          <header class="header"></header>
          <main class="main">
            <div class="stage"><canvas tabindex="0" aria-label="Watch"></canvas></div>
            <aside class="panel"><div class="panel-controls">
              <div class="winding-pad" role="button" tabindex="0">Wind</div>
            </div></aside>
          </main>
          <footer class="footer"></footer>
        </div>
      `);
      for (const selector of ['.stage canvas', '.winding-pad']) {
        const target = page.locator(selector);
        await target.click({ position: { x: 15, y: 15 } });
        assert.equal(
          await target.evaluate((el) => el.matches(':focus-visible')),
          false,
          `${selector}: a pointer click must not force a keyboard focus ring`,
        );
        await page.keyboard.press('Shift+Tab');
        await page.keyboard.press('Tab');
        await assertVisibleFocus(target);
      }
      await page.locator('.menu-toggle').click();
      await page.locator('.site').evaluate((el) => {
        el.classList.add('menus-hidden');
        el.querySelector('.panel').inert = true;
      });
      await page
        .locator('.stage')
        .evaluate((el) =>
          Promise.all(
            el.getAnimations().map((animation) => animation.finished),
          ),
        );
      await page.keyboard.press('Tab');
      await assertVisibleFocus(page.locator('.stage canvas'));
      await page.close();
      console.log(
        `PASS keyboard focus, pointer focus and immersive viewport (${viewport.width}px, ${reducedMotion})`,
      );
    }
  }
} finally {
  await browser?.close();
  await server.close();
}
