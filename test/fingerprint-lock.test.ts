// Tests that computeFingerprint never rewrites .git/index or creates
// .git/index.lock (SPEC 16.14, v046-b13). The liveness monitor calls this
// function every 500 ms while the worker is running; if it takes the index
// lock, it can collide with the worker's own git operations.
import { type FSWatcher, statSync, utimesSync, watch } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { git } from '../src/git.js';
import { computeFingerprint } from '../src/ladder.js';
import { Sandbox } from './support/sandbox.js';

let box: Sandbox;

beforeEach(async () => {
  box = await Sandbox.create();
});

afterEach(() => {
  box.dispose();
});

describe('fingerprint: never rewrites the git index', () => {
  it('calling 5 times with stale timestamps leaves .git/index unchanged', async () => {
    // Commit a tracked file.
    box.write('hello.txt', 'hello\n');
    await git(box.root, ['add', 'hello.txt']);
    await git(box.root, ['commit', '-q', '-m', 'add hello']);

    // Change mtime without changing content — creates a stat cache mismatch
    // in the index (the trigger for git diff's automatic index refresh).
    const past = new Date(2020, 0, 1);
    utimesSync(join(box.root, 'hello.txt'), past, past);

    // Record .git/index inode and mtime before the calls.
    const indexPath = join(box.root, '.git', 'index');
    const before = statSync(indexPath);

    // Watch for index.lock creation inside .git/.
    let lockSeen = false;
    const watcher: FSWatcher = watch(join(box.root, '.git'), (_event, filename) => {
      if (filename === 'index.lock') lockSeen = true;
    });

    try {
      for (let i = 0; i < 5; i++) {
        await computeFingerprint(box.root);
      }

      // Yield the event loop so any pending inotify events are delivered.
      await new Promise<void>((resolve) => {
        setImmediate(resolve);
      });

      // .git/index must not have been rewritten (inode and mtime unchanged).
      const after = statSync(indexPath);
      expect(after.ino).toBe(before.ino);
      expect(after.mtimeMs).toBe(before.mtimeMs);

      // .git/index.lock must never have appeared.
      expect(lockSeen).toBe(false);
    } finally {
      watcher.close();
    }
  });

  it('tracked file content change produces different fingerprints', async () => {
    box.write('file.txt', 'content-a\n');
    await git(box.root, ['add', 'file.txt']);
    await git(box.root, ['commit', '-q', '-m', 'initial']);

    box.write('file.txt', 'content-b\n');
    const fp1 = await computeFingerprint(box.root);

    box.write('file.txt', 'content-c\n');
    const fp2 = await computeFingerprint(box.root);

    expect(fp1).not.toBe(fp2);
  });

  it('HEAD change produces different fingerprints', async () => {
    box.write('file.txt', 'v1\n');
    await git(box.root, ['add', 'file.txt']);
    await git(box.root, ['commit', '-q', '-m', 'first']);
    const fp1 = await computeFingerprint(box.root);

    box.write('another.txt', 'v2\n');
    await git(box.root, ['add', 'another.txt']);
    await git(box.root, ['commit', '-q', '-m', 'second']);
    const fp2 = await computeFingerprint(box.root);

    expect(fp1).not.toBe(fp2);
  });

  it('untracked file added or changed produces different fingerprints', async () => {
    box.write('tracked.txt', 'base\n');
    await git(box.root, ['add', 'tracked.txt']);
    await git(box.root, ['commit', '-q', '-m', 'base']);

    const fpClean = await computeFingerprint(box.root);

    // Add an untracked file.
    box.write('untracked.txt', 'new file\n');
    const fpAdded = await computeFingerprint(box.root);
    expect(fpAdded).not.toBe(fpClean);

    // Change the untracked file (different size to avoid mtime races).
    box.write('untracked.txt', 'changed content here\n');
    const fpChanged = await computeFingerprint(box.root);
    expect(fpChanged).not.toBe(fpAdded);
  });
});
