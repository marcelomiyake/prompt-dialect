// Copies the Claude Code mod API declarations into types/claude-code/ so the
// adapter type-checks. Claude Code writes them beside a mod it loads from a
// folder it hot-reloads; they are generated per build, so they are not
// committed. Source, first found: $CLAUDE_CODE_TYPES, then the copy the engine
// laid in .claude-plugin/types/.
import { copyFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const candidates = [process.env.CLAUDE_CODE_TYPES, join(root, '.claude-plugin/types/claude-code/index.d.ts')].filter(
  Boolean,
)

const source = candidates.find(path => existsSync(path))
if (source === undefined) {
  console.error(
    'No Claude Code type declarations found. Load the mod once with\n' +
      '  claude --plugin-dir .\n' +
      'or set CLAUDE_CODE_TYPES to a claude-code.d.ts written by the plugin-authoring skill.',
  )
  process.exit(1)
}
const target = join(root, 'types/claude-code/index.d.ts')
mkdirSync(dirname(target), { recursive: true })
copyFileSync(source, target)
console.log(`Copied ${source} -> ${target}`)
