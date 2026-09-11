# Build from source

## Prerequisites

- [Zola](https://www.getzola.org/) 0.22.1 or later.

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

1. To validate the site without writing output, run:

    ```shell
    ./scripts/build.sh check
    ```

    This runs `zola check` with internal links treated as errors. CI runs this, then a full build, then `./scripts/check-links.sh` and `./scripts/qa-tooltips.py`. See [scripts/README.md](./scripts/README.md) for details on each script.
 
## Useful commands

| Command | What it does |
| --- | --- |
| `zola build` | Deletes the output directory if there is one and builds the site. |
| `zola serve` | Serve the site. Rebuild and reload on change automatically. |
| `zola check` | Try to build the project without rendering it. Checks links. |
| `zola completion` | Generate shell completion. |
| `zola help` | Print this message or the help of the given subcommand(s). |
