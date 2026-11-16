import { mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { describe, expect, it } from 'vitest';
import { notify, type NotifyFetch, type NotifyResult } from '../src/notify.js';

/** Create a temp dir with an optional webhook file. */
function setup(webhookContent?: string): { root: string; webhookPath: string } {
  const root = mkdtempSync(join(tmpdir(), 'notify-test-'));
  const webhookPath = join(root, 'webhook.txt');
  if (webhookContent !== undefined) {
    writeFileSync(webhookPath, webhookContent);
  }
  return { root, webhookPath };
}

/** A fake fetch that always succeeds with 200. */
const okFetch: NotifyFetch = () => Promise.resolve({ ok: true, status: 200 });

/** A fake fetch that returns a non-2xx status. */
const failFetch: NotifyFetch = () => Promise.resolve({ ok: false, status: 500 });

/** A fake fetch that throws (simulating network error). */
const throwFetch: NotifyFetch = (_url: string) =>
  Promise.reject(new Error(`connect ECONNREFUSED ${_url}`));

describe('notify (SPEC 14.3)', () => {
  it('skips when no notify section is configured', async () => {
    const { root } = setup();
    const result = await notify('hello', {}, root, okFetch);
    expect(result).toBe('skipped');
  });

  it('skips when webhook_file is configured but file does not exist', async () => {
    const { root } = setup(); // no webhook file written
    const result = await notify(
      'hello',
      { notify: { webhook_file: 'webhook.txt' } },
      root,
      okFetch,
    );
    expect(result).toBe('skipped');
  });

  it('returns sent on HTTP 2xx', async () => {
    const url = 'https://hooks.example.com/bot/secret-token-123';
    const { root } = setup(url);
    let capturedBody = '';
    const captureFetch: NotifyFetch = (_url, init) => {
      capturedBody = init.body;
      return Promise.resolve({ ok: true, status: 200 });
    };
    const result = await notify(
      'test message',
      { notify: { webhook_file: 'webhook.txt' } },
      root,
      captureFetch,
    );
    expect(result).toBe('sent');
    // Verify the POST body format (SPEC 14.3).
    const parsed: unknown = JSON.parse(capturedBody);
    expect(parsed).toEqual({ msgtype: 'text', text: { content: 'test message' } });
  });

  it('returns failed with status on non-2xx', async () => {
    const { root } = setup('https://hooks.example.com/bot/token');
    const result = await notify(
      'test',
      { notify: { webhook_file: 'webhook.txt' } },
      root,
      failFetch,
    );
    expect(result).toBe('failed: HTTP 500');
  });

  it('returns failed with sanitized error when fetch throws', async () => {
    const url = 'https://hooks.example.com/bot/secret';
    const { root } = setup(url);
    const result = await notify(
      'test',
      { notify: { webhook_file: 'webhook.txt' } },
      root,
      throwFetch,
    );
    expect(result).toMatch(/^failed: /);
    // Address must NOT appear in the error (SPEC 14.3).
    expect(result).not.toContain(url);
  });

  it('never leaks the webhook address in any result', async () => {
    const url = 'https://hooks.example.com/bot/super-secret';
    const { root } = setup(url);

    // Collect results for all code paths.
    const results: NotifyResult[] = [];

    // Sent path
    results.push(await notify('msg', { notify: { webhook_file: 'webhook.txt' } }, root, okFetch));
    // Failed path (non-2xx)
    results.push(await notify('msg', { notify: { webhook_file: 'webhook.txt' } }, root, failFetch));
    // Throw path (error containing URL)
    results.push(
      await notify('msg', { notify: { webhook_file: 'webhook.txt' } }, root, throwFetch),
    );

    for (const r of results) {
      expect(r).not.toContain(url);
    }
  });

  it('skips when webhook file is empty', async () => {
    const { root } = setup('   \n  ');
    const result = await notify(
      'hello',
      { notify: { webhook_file: 'webhook.txt' } },
      root,
      okFetch,
    );
    expect(result).toBe('skipped');
  });
});
