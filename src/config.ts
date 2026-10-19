// Loads and validates .collie/collie.toml (SPEC 3.1). All thresholds live in
// that file; this module carries no defaults (CONSTRAINTS 铁律 11).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parse as parseToml, TomlError } from 'smol-toml';
import type { z } from 'zod';
import { CollieConfigSchema, type CollieConfig } from './schema/index.js';

/** Location relative to the repository root (SPEC 10 Q3). */
export const CONFIG_RELATIVE_PATH = join('.collie', 'collie.toml');

export interface ConfigIssue {
  /** Dotted field path, e.g. `limits.stall_secs`; empty for document-level errors. */
  path: string;
  message: string;
}

export class ConfigError extends Error {
  readonly source: string;
  readonly issues: readonly ConfigIssue[];

  constructor(source: string, issues: readonly ConfigIssue[]) {
    const lines = issues.map((i) => `  - ${i.path === '' ? '(root)' : i.path}: ${i.message}`);
    super(`Invalid config ${source}:\n${lines.join('\n')}`);
    this.name = 'ConfigError';
    this.source = source;
    this.issues = issues;
  }
}

function toIssues(error: z.ZodError): ConfigIssue[] {
  return error.issues.flatMap((issue): ConfigIssue[] => {
    const base = issue.path.map(String);
    // Strict objects report unknown keys on the parent; name each offending key.
    if (issue.code === 'unrecognized_keys') {
      return issue.keys.map((key) => ({
        path: [...base, key].join('.'),
        message: 'unknown field',
      }));
    }
    return [{ path: base.join('.'), message: issue.message }];
  });
}

/** Parses TOML text into a validated config. `source` only labels errors. */
export function parseConfig(text: string, source: string): CollieConfig {
  let raw: unknown;
  try {
    raw = parseToml(text);
  } catch (error) {
    if (error instanceof TomlError) {
      const firstLine = error.message.split('\n')[0] ?? error.message;
      throw new ConfigError(source, [
        { path: '', message: `TOML syntax error at line ${String(error.line)}: ${firstLine}` },
      ]);
    }
    throw error;
  }

  const result = CollieConfigSchema.safeParse(raw);
  if (!result.success) {
    throw new ConfigError(source, toIssues(result.error));
  }
  return result.data;
}

/** Reads `<root>/.collie/collie.toml`. */
export function loadConfig(root: string): CollieConfig {
  const path = join(root, CONFIG_RELATIVE_PATH);
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    throw new ConfigError(path, [{ path: '', message: `cannot read file: ${reason}` }]);
  }
  return parseConfig(text, path);
}
