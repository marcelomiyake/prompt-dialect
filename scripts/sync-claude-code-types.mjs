// Copies the Claude Code mod API declarations into types/claude-code/ so the
// adapter type-checks. Claude Code writes them into plugin/.claude-plugin/types/
// when a session loads the mod from a folder it hot-reloads
// (`claude --plugin-dir plugin`); they are generated per build, so they are
// not committed.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const source = join(root, 'plugin/.claude-plugin/types/claude-code/index.d.ts')
const target = join(root, 'types/claude-code/index.d.ts')

if (!existsSync(source)) {
  console.error(
    'No Claude Code type declarations found. Load the mod once with\n' +
      '  claude --plugin-dir plugin\n' +
      'or copy a claude-code.d.ts written by the plugin-authoring skill to\n' +
      `  ${target}`,
  )
  process.exit(1)
}
mkdirSync(dirname(target), { recursive: true })
copyFileSync(source, target)
console.log(`Copied ${source} -> ${target}`)
