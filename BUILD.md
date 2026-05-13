# Build from source

## Prerequisites

- [Node.js](https://nodejs.org/) >= 20
- [pnpm](https://pnpm.io/)

## Steps

```shell
git clone git@github.com:shinzonetwork/docs.git
cd docs
pnpm install
pnpm build
```

The build goes into `./build`, funnily enough.

## Useful commands

| Command | What it does |
| --- | --- |
| `pnpm start` | Start a local dev server with hot reload. |
| `pnpm build` | Generate a production build into `./build`. |
| `pnpm serve` | Serve the production build locally. |
| `pnpm typecheck` | Run TypeScript type checking. |
| `pnpm clear` | Clear the Docusaurus cache. |
| `sudo shutdown now` | Turns off your machine so you can go outside. |
