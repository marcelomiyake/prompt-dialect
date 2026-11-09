// Copies the Claude Code mod API declarations into types/claude-code/ so the
// adapter type-checks. Claude Code writes them beside a mod it loads from a
// folder it hot-reloads; they are generated per build, so they are not
// committed. Source, first found: $CLAUDE_CODE_TYPES, then the copy the engine
// laid in plugin/.claude-plugin/types/.
import { copyFileSync, existsSync, mkdirSync, statSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const candidates = [
  process.env.CLAUDE_CODE_TYPES,
  join(root, 'plugin/.claude-plugin/types/claude-code/index.d.ts'),
].filter(Boolean)

/** Only a type declaration file is copied, whatever path the variable names. */
const isDeclarationFile = path => path.endsWith('.d.ts') && existsSync(path) && statSync(path).isFile()

const source = candidates.map(path => resolve(path)).find(isDeclarationFile)
if (source === undefined) {
  console.error(
    'No Claude Code type declarations found. Load the mod once with\n' +
      '  claude --plugin-dir plugin\n' +
      'or set CLAUDE_CODE_TYPES to a claude-code.d.ts written by the plugin-authoring skill.',
  )
  process.exit(1)
}
const target = join(root, 'types/claude-code/index.d.ts')
mkdirSync(dirname(target), { recursive: true })
copyFileSync(source, target)
console.log(`Copied ${source} -> ${target}`)
