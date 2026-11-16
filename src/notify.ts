// SPEC 14.3: webhook notification module.
// The webhook address MUST NOT appear in any return value, error, log, or output.
// `fetch` is injected by the caller so tests never touch the network.
import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { isAbsolute, join } from 'node:path';

export type NotifyResult = 'sent' | 'skipped' | `failed: ${string}`;

/** Fetch signature needed by notify; callers inject the real or test double. */
export type NotifyFetch = (
  url: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
  },
) => Promise<{ ok: boolean; status: number }>;

/**
 * Expand `~` to home dir, resolve relative paths against root.
 * Same tilde expansion rule as the CI token path (SPEC 14.3).
 */
function expandPath(raw: string, root: string): string {
  if (raw.startsWith('~')) return join(homedir(), raw.slice(1));
  return isAbsolute(raw) ? raw : join(root, raw);
}

/**
 * SPEC 14.3: send a text notification via webhook.
 *
 * - No config / no webhook_file / file does not exist / file is empty -> `skipped`
 * - POST succeeds with 2xx -> `sent`
 * - POST returns non-2xx -> `failed: HTTP <status>`
 * - fetch throws -> `failed: <sanitized reason>` (address scrubbed)
 *
 * Never throws; the address never appears in the return value.
 */
export async function notify(
  text: string,
  config: { notify?: { webhook_file?: string } },
  root: string,
  fetchFn: NotifyFetch,
): Promise<NotifyResult> {
  const webhookFile = config.notify?.webhook_file;
  if (webhookFile === undefined) return 'skipped';

  const filePath = expandPath(webhookFile, root);
  if (!existsSync(filePath)) return 'skipped';

  let url: string;
  try {
    url = readFileSync(filePath, 'utf8').trim();
  } catch {
    return 'failed: cannot read webhook file';
  }

  if (url === '') return 'skipped';

  try {
    const body = JSON.stringify({ msgtype: 'text', text: { content: text } });
    const response = await fetchFn(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    if (response.ok) return 'sent';
    return `failed: HTTP ${String(response.status)}`;
  } catch (error: unknown) {
    const raw = error instanceof Error ? error.message : String(error);
    // Scrub the URL from the error message to prevent address leakage (SPEC 14.3).
    const sanitized = raw.replaceAll(url, '<redacted>');
    return `failed: ${sanitized}`;
  }
}
