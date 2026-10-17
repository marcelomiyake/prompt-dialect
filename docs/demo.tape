# The README demo: a draft with mistakes, one fix, Fix all, then the rewrite
# for the session's model. It calls the model for real, so each run differs.
#
#   vhs docs/demo.tape        (from the repository root, after npm run build)

Output docs/demo.gif

Require claude

Set Shell bash
Set FontSize 16
Set Width 1200
Set Height 640
Set Padding 24
Set TypingSpeed 45ms

# Start Claude Code with only this mod: no MCP servers, no user settings.
Hide
Type "clear && claude --plugin-dir plugins/claude-code --strict-mcp-config --setting-sources project,local --permission-mode default --model opus"
Enter
Wait+Screen@60s /for shortcuts/
Sleep 1s
Show
Sleep 1s

Type "can you refactor the auth module so it dont break when the token expire and add test for it"
Wait+Screen@30s /fixes:/
Sleep 3s

# Apply the first fix: ctrl+x tab focuses the band, then its number.
Ctrl+X
Tab
Sleep 800ms
Type "1"
Wait+Screen@10s /2 fixes:/
Sleep 2s

# Fix the rest.
Ctrl+X
Tab
Sleep 800ms
Type "a"
Sleep 2.5s

# Rewrite the draft for the session's model, then put it in the prompt box.
Ctrl+X
Tab
Sleep 800ms
Type "i"
Wait+Screen@90s /Suggested prompt/
Sleep 6s
Ctrl+X
Tab
Sleep 800ms
Type "u"
Sleep 4s

Hide
Ctrl+C
Ctrl+C
