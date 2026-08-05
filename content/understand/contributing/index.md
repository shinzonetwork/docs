+++
title = "Contributing"
description = "How to propose changes, add pages, and submit PRs to the Shinzo docs."
aliases = ["/introduction/contributing"]
+++

These docs are open source and live in the [docs repo](https://github.com/shinzonetwork/docs). Fixes, new pages, and improvements are welcome.

## Before you start

Open an issue to discuss your proposed change before submitting a PR. This avoids wasted effort if the change isn't a good fit or is already in progress. PRs without an attached issue will be closed.

## How the docs are built

This site is built with [Zola](https://www.getzola.org/), a Rust-based static site generator. There's no Node tooling: no `package.json`, no `pnpm`, no `npm install`.

All content lives under `content/` as Markdown files. The site configuration and sidebar tree live in `config.toml` at the repo root.

## Run the site locally

You'll need Zola 0.19 or later. See the [Zola installation docs](https://www.getzola.org/documentation/getting-started/overview/) if you don't have it.

```shell
zola serve
```

This starts a local dev server at `http://127.0.0.1:1111` with live reload. As you edit Markdown files, the browser refreshes automatically.

## Add a new page

Every page is a folder containing an `index.md` file. The URL is derived from the folder path: `content/understand/my-topic/index.md` becomes `/understand/my-topic/`.

1. Create a new folder under the appropriate section (for example, `content/understand/my-topic/index.md`).
1. Add frontmatter in TOML, delimited by `+++`. At minimum, a `title`:

   ```toml
   +++
   title = "My topic"
   description = "A one-line summary that shows up in search results."
   +++
   ```

1. Write your content in Markdown below the frontmatter. Follow the tone and structure of existing pages in the same section.
1. Register the page in the sidebar. Open `config.toml`, find the `[[extra.sidebar]]` block for the section you're adding to, and add the path (relative to `content/`) to the `pages` array. Pages are not auto-discovered: if you skip this step, the page won't appear in the sidebar.

## Page conventions

- One page is one folder with an `index.md` file. Don't put multiple `.md` files in a single folder.
- Section landing pages use `_index.md` (for example, `content/understand/core-concepts/_index.md`).
- Slugs are kebab-case, lowercase, and hyphenated (for example, `how-it-works`, not `HowItWorks`).
- Frontmatter is TOML wrapped in `+++ ... +++`. Common fields: `title`, `description`, `aliases` (an array of redirect paths), `draft` (set to `true` to hide a page), and an `[extra]` block for things like `mermaid = true`.
- Ordering is manual. The sidebar order is controlled by the order of entries in `config.toml`, not by frontmatter fields.
- Diagrams use the mermaid shortcode. Set `mermaid = true` in the page's `[extra]` block so the mermaid scripts load.

## Aliases and redirects

If you're moving or renaming a page, add the old path to the new page's `aliases` array. Zola generates redirect pages for each alias automatically.

```toml
aliases = ["/introduction/my-old-path"]
```

## Submitting a PR

- Keep PRs focused. One change per PR.
- Describe what you changed and why in the PR description, and link the issue you opened.
- Run `zola check` before requesting review. It validates internal links and catches broken references.
- If you added a new page, make sure it's listed in `config.toml` and shows up in the sidebar.

## Style notes

- Match the voice of existing pages: direct, technical, no marketing language.
- Use mermaid diagrams where a flow is easier to show than to describe.
- Cross-link to related pages rather than duplicating content.
