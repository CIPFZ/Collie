# MAP — v046-b37 scenario ↔ test mapping

| Scenario | Kind | Test(s) in file | Notes |
|----------|------|-----------------|-------|
| S1 | new | `new.test.ts` → "S1: output_tail first line is stdout content, second line is --- stderr ---" | Sandbox run with 1 stdout + 30 stderr lines |
| S2 | new | `new.test.ts` → "S2: output_tail has 41 lines; line 1 is o6, line 21 is separator, line 22 is e6" | Sandbox run with 25 stdout + 25 stderr lines |
| S3 | new | `new.test.ts` → "S3: output_tail is exactly 4 lines; line 1 is separator, line 2 is e1" | Sandbox run with stderr only |
| S4 | new | `new.test.ts` → "S4: output_tail with triple backticks renders with 4-backtick fences" | Unit test for renderFixSection |
| K1 | keep | `keep.test.ts` → "K1: output_tail is exactly 20 lines from out 11 to out 30, no --- stderr ---" | Sandbox run with 30 stdout lines only |
| K2 | keep | `keep.test.ts` → "K2: output_tail has progress 30 but not progress 10; cmd, exit_code, expect all present" | Same setup as S1; checks event fields and truncation |
| K3 | keep | `keep.test.ts` → "K3: output_tail contains token=*** and not the actual secret" | GITHUB_TOKEN redaction |
| K4 | keep | `keep.test.ts` → "K4: code block opens and closes with exactly three backticks, containing line A and line B" | Unit test for renderFixSection with simple content |
| K5 | keep | `keep.test.ts` → "K5: acceptance.failed for sh split.sh does not have output_tail key" | Empty output produces no output_tail |
