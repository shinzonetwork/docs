# Contributing

## Before you start

Open an issue to discuss your proposed change before submitting a PR. This avoids wasted effort if the change isn't a good fit.

## Making changes

All documentation lives in `content/` as Markdown files.

To add a new page:

1. Create a `.md` file in the appropriate subdirectory under `content/`.
1. Add frontmatter with at least a `title` and `sidebar_position`.
1. Register the page in `sidebars.ts` if it doesn't get picked up automatically.
1. Run `pnpm start` to preview your changes locally.

## Submitting a PR

- Keep PRs focused. One change per PR.
- Describe what you changed and why in the PR description.
- Make sure `pnpm build` and `pnpm typecheck` pass before requesting review.

