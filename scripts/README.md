# Scripts

Build and deployment helper scripts live here. You don't really need to run them, but they _can_ be run locally if you want to see what `llms.txt` or `llms-full.txt` look like.

## Cloudflare Pages

Cloudflare Pages runs:

```shell
./scripts/build.sh
```

The build output directory is `public/` (gets set through the `pages_build_output_dir` var in `wrangler.toml`).

## Scripts

### build.sh

Runs a production build:

1. Ensures `zola` is available.
1. Runs `zola build` to generate `./public`.
1. Runs post-build steps (currently `generate-llms.sh`).

Zola installation behavior:

- If `zola` is already on `PATH`, it is used.
- Otherwise the script downloads the Zola release matching `ZOLA_VERSION`.
- `ZOLA_VERSION` is read from the environment first, then from `wrangler.toml`.

#### Subcommands

- `./scripts/build.sh` (or `./scripts/build.sh build`): production build. This is
  what Cloudflare Pages runs.
- `./scripts/build.sh check`: runs `zola check` (validates `@/` internal links
  as errors per `[link_checker]` in `config.toml`, and external links as
  warnings). Used by CI; does not write output.

### check-links.py

Checks internal links in the built site output (`public/`). Unlike
`zola check`, which only validates `@/`-prefixed links, this script checks
**all** internal links regardless of syntax — absolute (`/path/`), relative
(`../path/`), and `@/`-prefixed — by inspecting the built HTML.

Run it after `zola build`:

```shell
python3 scripts/check-links.py public
```

It verifies that every internal `<a href>` resolves to an existing file and
that fragment anchors (`#section`) match an `id` in the target page. Exits
non-zero if any broken links are found. Used by CI.

### generate-llms.sh

Generates `llms.txt` and `llms-full.txt` into the build output directory (defaults to `./public`).

Useful environment variables:

- `OUTPUT_DIR`: where to write `llms.txt` and `llms-full.txt` (default: `./public`).
- `BASE_URL`: base URL for generated links (default: `https://docs.shinzo.network`).
