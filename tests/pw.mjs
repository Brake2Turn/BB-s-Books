// Finds Playwright: a local install if there is one, otherwise the copy preinstalled in
// Claude Code cloud sessions.
let mod;
try {
  mod = await import('playwright');
} catch {
  mod = await import('/opt/node22/lib/node_modules/playwright/index.mjs');
}
export const { chromium } = mod;
