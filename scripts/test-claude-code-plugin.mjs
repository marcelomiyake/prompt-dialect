// Runs the engine tests in tests/engine/ against the built plugin, inside
// Claude Code's own engine: npm run test:plugin.
//
// `claude plugin test` runs the *.test.ts files under the plugin folder, but
// plugin/ holds only what a user installs, so the tests are not kept there.
// This lays the plugin and the tests side by side in a temporary folder and
// runs them there.
import { spawnSync } from 'node:child_process'
import { cpSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const plugin = join(root, 'plugin')
const generatedTypes = join(plugin, '.claude-plugin/types')

const workspace = mkdtempSync(join(tmpdir(), 'prompt-dialect-engine-'))
try {
  cpSync(plugin, workspace, { recursive: true, filter: source => !source.startsWith(generatedTypes) })
  cpSync(join(root, 'tests/engine'), join(workspace, 'tests/engine'), { recursive: true })
  const run = spawnSync('claude', ['plugin', 'test', workspace], { stdio: 'inherit' })
  if (run.error) throw run.error
  process.exitCode = run.status ?? 1
} finally {
  rmSync(workspace, { recursive: true, force: true })
}
