# Contributing

The full contributor guide lives at https://docs.shinzo.network/understand/contributing/. This file is a short summary for someone browsing the repo on GitHub.

## Before you start

Open an issue to discuss your proposed change before submitting a PR. This avoids wasted effort if the change isn't a good fit or is already in progress. PRs without an attached issue will be closed.

## Run the site locally

This site is built with [Zola](https://www.getzola.org/) 0.19 or later. There's no Node tooling.

```shell
zola serve
```

The dev server runs at `http://127.0.0.1:1111` with live reload.

## Add a page

1. Create a folder under `content/` with an `index.md` file (for example, `content/understand/my-topic/index.md`).
1. Add TOML frontmatter delimited by `+++` with at least a `title`.
1. Register the path in the relevant `[[extra.sidebar]]` block in `config.toml`. Pages are not auto-discovered.
1. Run `zola check` to validate links before opening your PR.

See the [contributing guide](https://docs.shinzo.network/understand/contributing/) for page conventions, aliases, and style notes.
