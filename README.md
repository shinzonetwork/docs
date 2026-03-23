# Shinzo Docs

Source code for the Shinzo developer documentation site at [docs.shinzo.network](https://docs.shinzo.network).

[Shinzo](https://shinzo.network) is a decentralized, trustless, and verifiable indexing network for blockchain data. Instead of relying on centralized indexers or hosted APIs, Shinzo embeds indexing directly into the blockchain's validator layer. Validators run a Shinzo client alongside their node software to index data at the moment of block creation.

This repo contains the Markdown content and Docusaurus configuration that powers the developer portal. If you want to read the docs, head to the site. Keep reading if you want to fix a typo, add a guide, or run the site locally.

## Local development

### Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/)

### Getting started

```shell
git clone git@github.com:shinzonetwork/docs.git
cd docs
pnpm install
pnpm start
```

This starts a local dev server with hot reload. Most edits to Markdown or config files will reflect immediately without a restart.

There's also a few other commands you might find useful:

| Command | What it does |
| --- | --- |
| `pnpm build` | Generate a production build into `./build` |
| `pnpm serve` | Serve the production build locally |
| `pnpm typecheck` | Run TypeScript type checking |
| `pnpm clear` | Clear the Docusaurus cache |

Check out `./package.json` for a full list of scripts/commands to run.

## Deployment

The site is deployed to [Cloudflare Workers](https://workers.cloudflare.com/) via Wrangler. The worker config lives in `wrangler.jsonc`.

To build and deploy in one step:

```shell
pnpm run build-and-deploy
```

> **Note:** There is no automated CI/CD pipeline yet. Deployments are triggered manually. Contributions to add GitHub Actions workflows are welcome.

## Repo structure

```plaintext
content/                 Documentation source (Markdown)
  intro.md               Landing page — "What is Shinzo?"
  glossary.md            Glossary of terms
  indexer/               Indexer guides (overview, quickstart, FAQ)
  hosts/                 Host guides (overview, quickstart, query examples)
  view-creator/          View Creator guides (overview, quickstart)
  guides/                General guides (building apps with Shinzo)
src/                     React components, styles, theme overrides
static/                  Images, logos, favicon
docusaurus.config.ts     Site configuration
sidebars.ts              Sidebar navigation
wrangler.jsonc           Cloudflare Workers deployment config
```

### Contributions

All documentation lives in `content/` as Markdown files. To add a new page:

1. Create a `.md` file in the appropriate subdirectory under `content/`.
1. Add frontmatter with at least a `title` and `sidebar_position`.
1. Register the page in `sidebars.ts` if it doesn't get picked up automatically.
1. Run `pnpm start` to preview your changes locally.

## Community

Come hang out, ask questions, or talk about what you're building:

- [Discord](https://discord.gg/shinzo)
- [X / Twitter](https://x.com/shinzonetwork)
- [Blog](https://medium.com/shinzo)
- [shinzo.network](https://shinzo.network)
