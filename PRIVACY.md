# Privacy policy

Effective date: October 19, 2026

This policy covers prompt-dialect, the Claude Code plugin published from <https://github.com/marcelomiyake/prompt-dialect> by Marcelo Masahiko Miyake ("I" below). It explains what data the plugin collects, how it is used, and how long it is kept.

## Summary

prompt-dialect has no server, no account, no analytics, and no telemetry. I never receive your prompts or anything else about you. The plugin sends the text in your prompt box to the Claude model you configured, through Claude Code's own API client, so it can check the text and rewrite it. Everything else stays on your computer.

## What the plugin reads

- The text in the Claude Code prompt box, as you type.
- The id of the model the session uses, such as `claude-opus-5-5`, to choose which prompting guidance to apply.
- Its own settings (`checkAsYouType`, `grammarModel`, `improvementModel`, `debounceMs`) and your `/dialect on|off` choice.

It does not read your files, your conversation history, environment variables, credentials, or API keys.

## What it sends, and to whom

The plugin sends data in two cases only:

- **Grammar check.** When you pause typing with checking turned on, it sends the prompt box text and the plugin's instructions to the grammar model (Claude Haiku 5.5 by default).
- **Improve.** When you press **✨ Improve**, it sends the prompt box text, the session's model id, and the prompting guidance for that model to the rewrite model.

In both cases, drafts under three words, `/commands` and `!shell` lines are not sent.

Both requests go through Claude Code's own API client, to the same provider and account Claude Code uses for your session: Anthropic's API, or another provider you configured Claude Code to use, such as Amazon Bedrock or Google Cloud Vertex AI. The provider handles these requests like any other Claude Code request, under its own terms and privacy policy, for example [Anthropic's privacy policy](https://www.anthropic.com/legal/privacy). The requests count toward your usage.

The plugin makes no other network requests. It does not send data to me or to any other third party.

## What it stores, and for how long

| Data                                                     | Where                                        | How long                                                                    |
| -------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------------------------- |
| Your `/dialect on\|off` choice                           | Claude Code's plugin store, on your computer | Until you change it or remove the plugin                                    |
| The current draft, its suggestions, and the last rewrite | Claude Code's session state for the plugin   | For the session, so the band survives a reload of the plugin                |
| Up to 64 recently checked drafts and their suggestions   | Memory                                       | Until Claude Code exits or the plugin reloads; the oldest are dropped first |
| The rewrite, when you press **Copy**                     | Your clipboard                               | Until you copy something else                                               |

The plugin writes to the prompt box only when you apply a fix or press **Use it**.

## How the data is used

Only to check your prompt for mistakes, show the fixes, and rewrite the prompt when you ask. It is not used for advertising, profiling, or training models, and it is not sold or shared.

## Your choices

- Turn checking off with `/dialect off`, or set `checkAsYouType` to `false` in `/config`. With checking off, the plugin sends nothing unless you press **✨ Improve**.
- Uninstall the plugin, with `/plugin` or `claude plugin uninstall prompt-dialect`, to stop it reading anything.
- For data held by your model provider, use that provider's controls and policy.

## Children

prompt-dialect is a developer tool and is not directed at children.

## Changes

Changes to this policy are made in this file, and its history is public in the repository. The effective date above changes with each update.

## Contact

Open an issue at <https://github.com/marcelomiyake/prompt-dialect/issues>.
