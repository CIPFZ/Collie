// Loads the SPEC 3.1 config from templates/collie.toml with placeholder values
// filled in. Tests use this instead of the repository's .collie/collie.toml so
// that changing operational thresholds never breaks the test suite (SPEC 16.9).
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseConfig } from '../../src/config.js';
import type { CollieConfig } from '../../src/schema/index.js';

const TEMPLATE_PATH = join(import.meta.dirname, '..', '..', 'templates', 'collie.toml');

/** Fixed project values used when instantiating the template. */
const TEMPLATE_NAME = 'test-project';
const TEMPLATE_REPO = 'https://github.com/test-org/test-project';

/** Reads `templates/collie.toml`, replaces `{{name}}` and `{{repo}}` with
 *  fixed test values, parses and validates the result. */
export function templateConfig(): CollieConfig {
  const raw = readFileSync(TEMPLATE_PATH, 'utf8');
  const text = raw
    .replace('"{{name}}"', JSON.stringify(TEMPLATE_NAME))
    .replace('"{{repo}}"', JSON.stringify(TEMPLATE_REPO));
  return parseConfig(text, 'templates/collie.toml');
}
