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
// Depended on by: tests/e2e/shell.spec.ts, tests/e2e/highway-code.spec.ts.
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
 * Waits until the page's active service worker reaches the 'activated'
 * state AND has taken control of the page
 * (`navigator.serviceWorker.controller !== null`). Workbox finishes
 * precaching every globPatterns entry during install (before activation),
 * so 'activated' proves every precache entry — including all Highway Code
 * section chunks and the self-hosted fonts — is already in Cache Storage.
 * 'activated' alone was not enough on CI's Linux WebKit, though: the
 * offline Highway Code test's first navigation after stopping the server
 * reached the network instead of being intercepted by the worker
 * (`page.goto: Could not connect to localhost: Connection refused`, CI run
 * 34786910791 — see handoffs/phase-1-highway-code/step-21.md). A worker
 * can report 'activated' slightly before clientsClaim() actually puts it
 * in control of an already-open page, so waiting for the controller too —
 * as Phase 0's still-passing `offline reload still renders` test already
 * did — proves the page is truly ready to have its server pulled out from
 * under it.
 */
export async function waitForServiceWorkerActivated(page: Page): Promise<void> {
  await page.waitForFunction(
    async () => {
      const registration = await navigator.serviceWorker.getRegistration();
      return (
        !!registration &&
        !!registration.active &&
        registration.active.state === 'activated' &&
        navigator.serviceWorker.controller !== null
      );
    },
    null,
    { timeout: 90_000 },
  );
}
