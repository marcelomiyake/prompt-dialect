# Security policy

## Supported versions

prompt-dialect is maintained on its latest release only. Security fixes land on `main` and ship in the next release of the Claude Code plugin.

| Version        | Supported |
| -------------- | --------- |
| Latest release | Yes       |
| Older          | No        |

## Reporting a vulnerability

Please do not open a public issue for a security problem.

Report it privately in one of these ways:

- [Open a private security advisory](https://github.com/marcelomiyake/prompt-dialect/security/advisories/new) on GitHub.
- Email [marcelo.m.miyake@gmail.com](mailto:marcelo.m.miyake@gmail.com) with "prompt-dialect security" in the subject.

Include what you found, the steps to reproduce it, the plugin and Claude Code versions, and the impact you expect. You will get a reply within 5 business days. Once the problem is confirmed, a fix is released as soon as possible and the advisory is published with credit to you, unless you ask to stay anonymous.

## Scope

In scope: the code in this repository, including the bundled plugin in `hooks/register.js`. The plugin sends the text of your prompt to the model you configure, through Claude Code's own API client, and stores no prompts or keys of its own. A way to make it send prompt text anywhere else, run code, or read files is a vulnerability.

Out of scope: Claude Code itself and the Anthropic API. Report those to Anthropic through its [responsible disclosure program](https://www.anthropic.com/responsible-disclosure-policy).
