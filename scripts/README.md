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

### generate-llms.sh

Generates `llms.txt` and `llms-full.txt` into the build output directory (defaults to `./public`).

Useful environment variables:

- `OUTPUT_DIR`: where to write `llms.txt` and `llms-full.txt` (default: `./public`).
- `BASE_URL`: base URL for generated links (default: `https://docs.shinzo.network`).
