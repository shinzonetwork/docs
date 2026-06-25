# Build from source

## Prerequisites

- [Zola](https://www.getzola.org/)

## Steps

1. Clone the repo and move inside:

    ```shell
    git clone git@github.com:shinzonetwork/docs.git
    cd docs
    ```

1. Start the local server:

    ```shell
    zola build
    ```

The build goes into `./public`.

## Useful commands

| Command | What it does |
| --- | --- |
| `zola build` | Deletes the output directory if there is one and builds the site. |
| `zola serve` | Serve the site. Rebuild and reload on change automatically. |
| `zola check` | Try to build the project without rendering it. Checks links. |
| `zola completion` | Generate shell completion. |
| `zola help` | Print this message or the help of the given subcommand(s). |
