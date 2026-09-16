// Shared Playwright e2e helpers: dismiss the "Add to Home Screen" panel that
// greets every fresh WebKit context, spawn/kill a second `vite preview`
// server for the tests that must prove the app still works once the ONLY
// server able to answer fresh requests has been stopped, and wait for the
// service worker to finish precaching before treating a page as safe to
// take offline.
// tests/e2e/shell.spec.ts's "offline reload still renders" test uses port
// 4174; tests/e2e/highway-code.spec.ts's offline test uses port 4175 —
// playwright.config.ts sets neither `workers` nor `fullyParallel`, so
// Playwright runs spec FILES in parallel worker processes by default, and
// two `--strictPort` servers bound to the same port would race each other
// (amendment E8, handoffs/phase-1-highway-code/plan.md).
// Depends on: @playwright/test, node:child_process.
// Depended on by: tests/e2e/shell.spec.ts, tests/e2e/highway-code.spec.ts,
// tests/e2e/signs.spec.ts, tests/e2e/games.spec.ts,
// tests/e2e/signs-offline.spec.ts.
import { expect, type Page } from '@playwright/test';
import { spawn, execSync, type ChildProcess } from 'node:child_process';

/**
 * Navigates to `path` and dismisses the "Add to Home Screen" panel if it is
 * showing (the iPhone/WebKit device profile is never "standalone", so the
 * panel shows on every fresh browser context, regardless of which path is
 * loaded first — src/app/App.tsx renders it in place of the whole shell).
 * Waits for the initial render to settle on one of its two possible root
 * states before deciding whether "Not now" needs clicking; checking
 * isVisible() immediately after goto() can race the app's first render.
 */
export async function openAppAt(page: Page, path = '/clutch/'): Promise<void> {
  await page.goto(path);
  const heading = page.getByRole('heading', { name: 'Add to Home Screen' });
  const nav = page.locator('nav[aria-label="Main"]');
  await heading.or(nav).first().waitFor({ state: 'visible' });
  if (await heading.isVisible()) {
    await page.getByRole('button', { name: 'Not now' }).click();
  }
}

/** Navigates to the app root and dismisses "Add to Home Screen" if shown. */
export function openApp(page: Page): Promise<void> {
  return openAppAt(page, '/clutch/');
}

/**
 * Spawns a second `vite preview` server bound to `port`, for tests that need
 * a server they can later stop while a page keeps running against it.
 * Spawned directly with node.exe against vite's bin script (not
 * `npx`/`npx.cmd`, which Node 24 rejects with `spawn EINVAL`) and without
 * `shell: true` (which would make the resulting PID unkillable on Windows).
 * Resolves once the server actually answers.
 */
export async function startPreview(port: number): Promise<ChildProcess> {
  const proc = spawn(
    process.execPath,
    ['node_modules/vite/bin/vite.js', 'preview', '--port', String(port), '--strictPort'],
    { stdio: 'ignore' },
  );
  const origin = `http://localhost:${port}`;
  await expect(async () => {
    await fetch(`${origin}/clutch/`);
  }).toPass({ timeout: 30_000 });
  return proc;
}

/**
 * Kills the server started by startPreview and waits until it genuinely
 * stops answering before returning. Offline is proven by really stopping
 * the server (amendment A2), not by context.setOffline(true), which under
 * WebKit is a hard network kill the service worker cannot answer through:
 * without polling until a fetch to the origin actually throws, a test can
 * pass against a still-running server (a false PASS seen during Phase 0's
 * attempt 1 probe). `taskkill /T` also kills any children; on POSIX
 * platforms `vite preview` has no children of its own, so a plain SIGKILL
 * suffices.
 */
export async function stopPreview(proc: ChildProcess | undefined, port: number): Promise<void> {
  const pid = proc?.pid;
  if (pid) {
    try {
      if (process.platform === 'win32') {
        execSync(`taskkill /PID ${pid} /T /F`);
      } else {
        process.kill(pid, 'SIGKILL');
      }
    } catch {
      // Already exited; nothing to clean up.
    }
  }
  const origin = `http://localhost:${port}`;
  await expect(async () => {
    let threw = false;
    try {
      await fetch(`${origin}/clutch/`);
    } catch {
      threw = true;
    }
    expect(threw).toBe(true);
  }).toPass({ timeout: 15_000 });
}

/**
 * Waits until the page is controlled by an 'activated' service worker
 * (`navigator.serviceWorker.controller !== null &&
 * navigator.serviceWorker.controller.state === 'activated'`). Workbox
 * finishes precaching every globPatterns entry during install (before
 * activation), so a controlling worker in state 'activated' proves every
 * precache entry — including all Highway Code section chunks and the
 * self-hosted fonts — is already in Cache Storage AND that this page is the
 * one it controls, i.e. safe to have its server pulled out from under it.
 *
 * The predicate MUST be synchronous. Attempt 2 of this helper
 * (handoffs/phase-1-highway-code/step-18.md) used an `async` predicate that
 * awaited `navigator.serviceWorker.getRegistration()`, and it never actually
 * waited: per `node_modules/playwright-core/lib/coreBundle.js`,
 * `page.waitForFunction` polls with `const success = predicate(); if
 * (success) { fulfill(success); … }` — it does not `await` the predicate's
 * return value, so an `async` function's Promise (always truthy) satisfies
 * `success` on the very first poll, before the awaited work inside it has
 * resolved. That is why the diagnostic in
 * tests/e2e/highway-code.spec.ts logged `SW ready:
 * {"controllerScriptURL":null,"scope":"...","activeState":null}`
 * immediately after this "wait" returned (handoffs/phase-1-highway-code/
 * plan.md, "Step 18, attempt 3"), and why the offline test's first
 * navigation could still race a service worker that was not yet in control.
 * A synchronous predicate has no such gap: Playwright's polling loop only
 * calls it, checks its return value directly, and keeps polling until it is
 * truthy — exactly like Phase 0's `offline reload still renders` test,
 * which uses a synchronous predicate and has never been flaky.
 */
export async function waitForServiceWorkerActivated(page: Page): Promise<void> {
  await page.waitForFunction(
    () =>
      navigator.serviceWorker.controller !== null &&
      navigator.serviceWorker.controller.state === 'activated',
    null,
    { timeout: 90_000 },
  );
}
