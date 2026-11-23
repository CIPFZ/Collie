# MAP — v046-b34

| 情形 | 类别 | 用例 | 文件 |
|------|------|------|------|
| S1 | 新 | `S1: error message contains "only .github, paths under .github/, eslint.config.js, vitest.config.ts"`, `S1: error message does not contain ".github/*"` | new.test.ts |
| K1 | 保持 | `K1: parseBacklog throws BacklogError whose message contains the traversal path` | keep.test.ts |
| K2 | 保持 | `K2: parseBacklog throws BacklogError for deep traversal path` | keep.test.ts |
| K3 | 保持 | `K3: parseBacklog throws BacklogError for %s and message contains the path` (×4: `/etc/x`, `../x`, `.github/*`, `.github/workflows/?.yml`) | keep.test.ts |
| K4 | 保持 | `K4: .github, .github/workflows/ci.yml, eslint.config.js, vitest.config.ts → allowed_protected in same order` | keep.test.ts |
| K5 | 保持 | `K5: batch has no allowed_protected key when section is absent` | keep.test.ts |

所有情形均已覆盖，无无法测试的情形。
