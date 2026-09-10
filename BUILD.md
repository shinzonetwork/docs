# Build from source

## Prerequisites

- [Zola](https://www.getzola.org/) 0.22.1 or later. `config.toml` uses the `[markdown.highlighting]` configuration introduced in Zola 0.22.0; older versions ignore it and build the site without syntax highlighting. If you skip installing Zola, `./scripts/build.sh` downloads it automatically using the `ZOLA_VERSION` pinned in `wrangler.toml`.

## Steps

1. Clone the repo and move inside:

    ```shell
    git clone git@github.com:shinzonetwork/docs.git
    cd docs
    ```

1. Build for production:

    ```shell
    ./scripts/build.sh
    ```

The build goes into `./public`.

`./scripts/build.sh` runs `zola build` and then any post-build generators (for example `llms.txt`).

To validate the site without writing output, run:

```shell
./scripts/build.sh check
```

This runs `zola check` with internal links treated as errors. CI runs this, then a full build, then `./scripts/check-links.sh` and `./scripts/qa-tooltips.py`.

See [scripts/README.md](./scripts/README.md) for details on each script.

## Useful commands

| Command | What it does |
| --- | --- |
| `zola build` | Deletes the output directory if there is one and builds the site. |
| `zola serve` | Serve the site. Rebuild and reload on change automatically. |
| `zola check` | Try to build the project without rendering it. Checks links. |
| `zola completion` | Generate shell completion. |
| `zola help` | Print this message or the help of the given subcommand(s). |
