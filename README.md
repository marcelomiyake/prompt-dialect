# prompt-dialect: grammar checker and prompt improver for Claude Code

[![Quality Gate Status](https://sonarcloud.io/api/project_badges/measure?project=marcelomiyake_prompt-dialect&metric=alert_status)](https://sonarcloud.io/summary/new_code?id=marcelomiyake_prompt-dialect)
[![Coverage](https://sonarcloud.io/api/project_badges/measure?project=marcelomiyake_prompt-dialect&metric=coverage)](https://sonarcloud.io/summary/new_code?id=marcelomiyake_prompt-dialect)

Spelling and grammar checking as you type, and prompt rewrites that follow Anthropic's prompt engineering guidance for the model you use. For the prompts you write to AI coding tools, starting with a [Claude Code](https://code.claude.com) plugin (a mod, in Claude Code's terms: a plugin with a hooks module).

![prompt-dialect, a Claude Code plugin, at work: a prompt with three spelling and grammar mistakes typed into Claude Code is underlined, corrected with one fix and then Fix all, and rewritten with prompt engineering guidance for Claude Opus 5.5.](docs/demo.gif)

## Features

- **Spell check and grammar fixes as you type.** Pause for a moment and a fast, cheap model (Claude Haiku 5.5 by default) checks the draft for spelling, grammar, punctuation, agreement, wrong words, and phrasing awkward enough to blur the request. Mistakes are underlined in the prompt box, and the band above the prompt lists them. Hover a word to see its fix in context, then click it, or press **Fix all**.
- **A rewrite for your model.** Press **✨ Improve for Opus 5.5** (or whichever model the session uses) and the draft is rewritten to follow Anthropic's prompting guidance for that model: the [Claude prompting best practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) for all models, plus the guide for [Opus 5.5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5-5), [Opus 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5), [Opus 4.8](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-4-8), [Sonnet 5.5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5-5), [Sonnet 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-sonnet-5), [Haiku 5.5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-haiku-5-5), [Fable 5.1](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5-1), or [Fable 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-fable-5). Claude Mythos models get the Fable guides, and an older model without its own guide gets the oldest guide of its line. **Use it** puts the rewrite in the prompt box, and **Copy** copies it.
- **Rewrites that ask instead of guessing.** Where a missing detail would change the work, the rewrite leaves a short placeholder such as `[which test command?]` rather than inventing one. Up to three notes under it say what changed and why.
- **Leaves your code alone.** The model is told to keep code, identifiers, file paths, URLs, shell commands, `@mentions`, `/commands`, paste placeholders such as `[Pasted text #1]`, and Markdown exactly as written, so it does not trip over the things a general-purpose spellchecker flags in a coding prompt.
- **Keeps your language.** Write in Portuguese, Spanish, German, French, or any other language: the check and the rewrite stay in it and never translate. Languages written without spaces, such as Japanese, have a [known limitation](#known-limitations).
- **No API key to set up.** It calls the model through Claude Code's own API client, and the bundle has no runtime dependencies.

## Install in Claude Code

Requires Claude Code 2.1.301 or later; `claude --version` shows yours. The mods API is in early access and can change between releases. An older build refuses the whole mod when it loads, because it lacks an event the mod hooks (2.1.299 has no `prompt.change`), and it says so only in the debug log.

At the prompt of a Claude Code terminal session:

```
/plugin install prompt-dialect --marketplace marcelomiyake/prompt-dialect
```

Answer `y` to add the marketplace, then choose a scope. From a shell instead:

```
claude plugin install prompt-dialect --marketplace marcelomiyake/prompt-dialect
```

In the desktop app, where `/plugin` does not run: click **+** next to the prompt box, then **Plugins**, **Add marketplace** with `marcelomiyake/prompt-dialect`, then **Add plugin**.

The desktop app runs its own bundled build of Claude Code, not the `claude` on your `PATH`, and updates it on its own schedule. Until that bundled build is 2.1.301 or later, the mod installs but does not run in the desktop app: no band and no `/dialect`, while a terminal session with a newer `claude` runs it. The app keeps that build in a folder named after its version, such as `2.1.299`, under its `claude-code` data folder.

## Usage and keyboard shortcuts

| To                              | Do                                                                                                 |
| ------------------------------- | -------------------------------------------------------------------------------------------------- |
| Check a prompt                  | Type it and pause. Drafts under three words, `/commands` and `!shell` lines are skipped.           |
| Check a long paste              | Paste it again to expand its `[Pasted text #1]` placeholder, then pause.                           |
| See a fix                       | Hover the underlined word's chip in the band (fullscreen terminal or desktop).                     |
| Apply a fix                     | Click the chip. From the keyboard, press `ctrl+x` `tab` to focus the band, then the chip's number. |
| Apply every fix                 | **Fix all** (`a` while the band has focus).                                                        |
| Rewrite for the session's model | **✨ Improve for …** (`i`), then **Use it** (`u`) or **Copy** (`c`).                               |
| Hide the band for this draft    | **Hide**. It comes back when you edit the draft.                                                   |
| Turn checking off or on         | `/dialect off`, `/dialect on`. `/dialect` alone shows the status.                                  |

The checks call the model through Claude Code's own API client, so they count toward your usage like any other request: one short call per pause, and one call for each rewrite you ask for. A draft you have already checked is answered from a cache.

### Configuration and settings

Set them in `/config`, or under `pluginConfigs` in your settings:

| Option             | Default            | What it does                                                                            |
| ------------------ | ------------------ | --------------------------------------------------------------------------------------- |
| `checkAsYouType`   | `true`             | Check the prompt whenever you pause. `/dialect on\|off` overrides it and is remembered. |
| `grammarModel`     | `claude-haiku-5-5` | The model that checks the prompt. An alias such as `haiku` works too.                   |
| `improvementModel` | `claude-haiku-5-5` | The model that writes the rewrite.                                                      |
| `debounceMs`       | `900`              | How long you pause, in milliseconds (250 to 10000), before the check runs.              |

### Known limitations

- Underlines appear as soon as the check returns when the cursor is at the end of a short draft. Otherwise they appear on your next keystroke or cursor move, because repainting the box would move the cursor or fold a long draft into a paste placeholder.
- Claude Code folds a long paste into a placeholder such as `[Pasted text #1 +10 lines]` and does not give mods the text behind it, so the check and the rewrite cannot read it. The band says which pastes it could not read, and offers no rewrite while one is folded, because the rewrite would leave the paste out. Paste the same text again to expand the placeholder, and the next check reads it. The words you type around a folded paste are still checked.
- Hover needs a pointer: the fullscreen terminal or the desktop app. Everywhere else, use the keyboard path above.
- Clicking a fix replaces the whole draft with the fixed one, so the cursor moves to the end.
- Languages written without spaces between words, such as Japanese and Chinese, are read in runs of characters between punctuation marks rather than in words: a short draft can be skipped as too short, and a fix underlines the whole run.

## What it reads, sends, and stores

- **Reads** the text in the prompt box and the name of the session's model.
- **Sends** the prompt box text, with the mod's instructions, to the configured Claude model through Claude Code's own API client: one call each time you pause typing, and one each time you press Improve. The mod makes no other network requests and reads no environment variables or credentials.
- **Stores** only your `/dialect on|off` choice, in Claude Code's plugin store. The current draft's suggestions are kept in the session's plugin state so they survive a reload, and drafts already checked are cached in memory.
- **Writes** to the prompt box only when you apply a fix or press **Use it**, and to the clipboard only when you press **Copy**.
- **Hooks** `session.start` to register `/dialect`; `command.run` for `/dialect` only, so every other command passes by untouched; `prompt.edit` and `prompt.change` to follow the draft as it changes; and `ui.render` for the band above the prompt.
- **Code.** [`hooks/register.js`](hooks/register.js) is generated by esbuild from the TypeScript in [`src/`](src) and is not minified.

## Examples

Type each prompt below into Claude Code with the mod on, and pause. The fixes and rewrites come from a model, so the exact wording changes from run to run; what stays the same is listed under each one.

### 1. Fix spelling and grammar in a coding request

```
can you refactor the auth module so it dont break when the token expire and add test for it
```

The band lists three fixes: `dont` → `doesn't`, `expire` → `expires`, and `test` → `tests`. Click one chip to apply that fix, or press **Fix all** (`a`) for the three at once. The result:

```
can you refactor the auth module so it doesn't break when the token expires and add tests for it
```

### 2. Leave code, paths and commands alone

```
@src/api/client.ts retrys the request forever when fetchUser() returns 503, make it stop after 3 try and run npm run test:unit
```

Only the prose is flagged: `retrys` → `retries` and `try` → `tries`, and usually a comma or `and` where the two clauses meet. The `@mention`, the path, `fetchUser()`, `503` and `npm run test:unit` are never underlined and come through a fix unchanged.

### 3. Check a prompt in another language

```
adicione um teste para a função parseDate que verifica as datas invalidas e corrija os erro que encontrar
```

The check stays in Portuguese: `invalidas` → `inválidas` and `os erro` → `os erros`. `parseDate` is left as written, and nothing is translated.

### 4. Rewrite a vague prompt for the session's model

```
fix the flaky test in the payments service
```

This draft has no mistakes, so the band shows only **✨ Improve for …**. Press it (`i`). The rewrite states the goal, asks Claude to find the cause of the flakiness rather than add retries or skip the test, and says how to confirm the fix. Where it cannot know a detail, it leaves a placeholder such as `[which test?]` or `[which test command?]` for you to fill in, instead of inventing one. Up to three notes under it say what changed. Press **Use it** (`u`) to put it in the prompt box, then replace the placeholders before you send it.

## Testing notes for reviewers

- **Version.** The mod needs Claude Code **2.1.301 or later**. Check with `claude --version`. On an older build it installs but never runs: no band appears, `/dialect` does not exist, and the reason (a missing `prompt.change` event) shows only in the debug log. The desktop app runs its own bundled Claude Code, so test in a terminal session unless that bundled build is also 2.1.301 or later.
- **Install.** `claude plugin install prompt-dialect --marketplace marcelomiyake/prompt-dialect`, or from a checkout, `claude --plugin-dir .`.
- **No setup.** There is no API key or account to configure. The checks go through Claude Code's own API client and count toward the signed-in account's usage.
- **Check it is on.** `/dialect` shows the status. Then try the [examples](#examples) above, in order.
- **Keyboard path.** Hover needs the fullscreen terminal or the desktop app. In any other terminal, press `ctrl+x` `tab` to focus the band, then a chip's number, `a`, `i`, `u` or `c`.
- **Turning it off.** `/dialect off` hides the band and stops all checks until `/dialect on`.

## Architecture and how it works

The business logic does not know about Claude Code. It follows Domain-Driven Design and Clean Architecture so that other tools (Codex, Antigravity, OpenCode, VS Code, a CLI) can be added as adapters without touching it.

```
src/
├── core/                      the product, free of any tool's API
│   ├── domain/                TextSpan, TextChange, Suggestion, GrammarReview,
│   │                          TargetModel, PromptingGuide catalog, PromptImprovement
│   └── application/           CheckGrammar and ImprovePrompt use cases,
│       └── ports/             the LanguageModel port the adapters implement
└── adapters/
    └── claude-code/           the mod: hooks, band view, prompt decorations
.claude-plugin/                plugin.json, and marketplace.json pointing at the root
hooks/register.js              the mod's hooks module, bundled from src/ by npm run build
types/index.d.ts               the mod's $.state contract, copied from src/ by the build
```

The repository root is the plugin, and it is also the marketplace that lists it.

- **Grammar checking** asks the model for a corrected copy of the draft, not for positions. The domain diffs the two word by word, so every suggestion points at text that is really there, and a reply that rewrites rather than corrects is discarded.
- **Edits keep the review.** As you type, each suggestion moves with its words. Suggestions that an edit touches are dropped until the next check.
- **Prompting guides are data.** Each model's guidance is an entry in [`src/core/domain/prompting-guides.ts`](src/core/domain/prompting-guides.ts) with its source URL. The catalog picks the guide for the session's model, falling back to the newest guide of that family, so a new model needs one new entry.

[AGENTS.md](AGENTS.md) has the commands, the rules that keep the layers apart, the SonarQube quality gate, and the commit conventions.

## Development and testing

```bash
npm ci
npm run test:coverage          # vitest, with coverage
npm run types:sync             # copy the Claude Code API types (see AGENTS.md)
npm run typecheck
npm run build                  # bundle src/ into hooks/register.js
npm run validate:plugin        # claude plugin validate
npm run test:plugin            # claude plugin test, inside Claude Code's engine
claude --plugin-dir .          # try it
vhs docs/demo.tape             # re-record docs/demo.gif (calls the model)
```

## Support

- **Questions and bugs:** [open an issue](https://github.com/marcelomiyake/prompt-dialect/issues). Include your Claude Code version and the plugin version.
- **Security problems:** report them privately, as [SECURITY.md](SECURITY.md) describes. Do not open a public issue.
- **Anything else:** email [marcelo.m.miyake@gmail.com](mailto:marcelo.m.miyake@gmail.com).

## Privacy

prompt-dialect sends the text in your prompt box only to the Claude model you configured, through Claude Code's own API client, and collects nothing for itself. The [privacy policy](PRIVACY.md) covers what it reads, sends, and stores, and for how long.

## License

[MIT](LICENSE)
