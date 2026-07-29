# Grammars

Custom TextMate grammars registered with Zola via `extra_grammars` in `config.toml`. They don't do real syntax highlighting. They only exist so Zola keeps the `data-lang` attribute on fenced code blocks, which we can target with CSS.

## Grammars

### output.json

Registers a dummy `output` language so fenced ```output``` blocks keep `data-lang="output"` instead of being folded to `plain`. We target that attribute in `sass/style.scss` to style terminal-style output blocks (darker background, "output" label). The grammar matches everything as plain text, so there's no highlighting.
