+++
title = "Write and test a custom lens"
description = "How to author a WebAssembly lens with the Rust SDK, test it locally, and attach it to a View."
+++

Most Views never need a custom lens. The prebuilt lenses in the wasm-bucket cover log decoding and function-call decoding, and the [lens reference](/reference/components/lens/) lists them with their arguments. Write your own only when the transform you need does not exist.

A lens is a WebAssembly module that sits between a View's query and its output. Every Host client runs the same lens over the same documents through LensVM, so the output has to be identical everywhere. For each input document, the lens returns a transformed document, or drops the document entirely.

## Scaffold the lens

The wasm-bucket lenses are written in Rust against the `lens_sdk` crate, and that SDK is the path documented here. Create a new library crate:

```toml
[package]
name = "drop_old_logs"
version = "0.1.0"
edition = "2018"

[lib]
crate-type = ["cdylib"]

[dependencies]
serde_json = "1.0"
lens_sdk = "^0.7.0"
```

The lens below drops every log emitted before a fixed block height and passes everything else through unchanged. It shows the three things every lens has: an `alloc` export so the host runtime can hand over memory, a `transform` export that does the work, and the tagged-buffer convention (`JSON_TYPE_ID`, `EOS_TYPE_ID`, `ERROR_TYPE_ID`) that tells the runtime what came back.

```rust
use std::collections::HashMap;
use std::error;

use lens_sdk::option::StreamOption::{EndOfStream, None, Some};
use lens_sdk::StreamOption;
use serde_json::Value;

#[link(wasm_import_module = "lens")]
extern "C" {
    fn next() -> *mut u8;
}

const MIN_BLOCK: i64 = 19_000_000;

#[no_mangle]
pub extern "C" fn alloc(size: usize) -> *mut u8 {
    lens_sdk::alloc(size)
}

#[no_mangle]
pub extern "C" fn transform() -> *mut u8 {
    match try_transform() {
        Ok(Some(json)) => tagged_mem(lens_sdk::JSON_TYPE_ID, &json),
        Ok(None) => lens_sdk::nil_ptr(),
        Ok(EndOfStream) => tagged_mem(lens_sdk::EOS_TYPE_ID, &[]),
        Err(e) => tagged_mem(lens_sdk::ERROR_TYPE_ID, e.to_string().as_bytes()),
    }
}

fn try_transform() -> Result<StreamOption<Vec<u8>>, Box<dyn error::Error>> {
    let ptr = unsafe { next() };
    let doc = match lens_sdk::try_from_mem::<HashMap<String, Value>>(ptr)? {
        Some(v) => v,
        None => return Ok(None),
        EndOfStream => return Ok(EndOfStream),
    };

    if below_min_block(&doc) {
        return Ok(None); // a nil return drops the document
    }

    Ok(Some(serde_json::to_vec(&doc)?))
}

fn below_min_block(doc: &HashMap<String, Value>) -> bool {
    let block_number = doc.get("blockNumber").and_then(|v| v.as_i64()).unwrap_or(0);
    block_number < MIN_BLOCK
}

// The same tagged-buffer layout the wasm-bucket lenses use.
fn tagged_mem(type_id: i8, data: &[u8]) -> *mut u8 {
    let total = 1 + 4 + data.len();
    let ptr = lens_sdk::alloc(total);
    unsafe {
        *ptr = type_id as u8;
        let len_bytes = (data.len() as u32).to_le_bytes();
        std::ptr::copy_nonoverlapping(len_bytes.as_ptr(), ptr.add(1), 4);
        if !data.is_empty() {
            std::ptr::copy_nonoverlapping(data.as_ptr(), ptr.add(5), data.len());
        }
    }
    ptr
}
```

Two things to notice. The `next()` function is imported from the `lens` module: the runtime calls `transform`, and `transform` pulls the next input document by calling `next()`. And dropping a document is just returning a nil pointer, which is how filters are expressed as lenses.

Lenses that need arguments, like the `abi` parameter of `decode_log`, add a `set_param` export that deserializes a parameters struct once at load time. The [decode_log source](https://github.com/shinzonetwork/wasm-bucket/tree/main/bucket/decode_log) is the best real-world reference for that pattern.

## Keep the logic testable

The FFI shell around a lens is tedious to test, so keep it thin. Everything in `try_transform` after the deserialization is ordinary Rust: put the decision in a pure function like `below_min_block` and cover it with `cargo test`.

```rust
#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn drops_old_logs() {
        let mut doc = HashMap::new();
        doc.insert("blockNumber".to_string(), Value::from(18_000_000));
        assert!(below_min_block(&doc));
    }

    #[test]
    fn keeps_new_logs() {
        let mut doc = HashMap::new();
        doc.insert("blockNumber".to_string(), Value::from(20_000_000));
        assert!(!below_min_block(&doc));
    }
}
```

## Build the module

Compile to WebAssembly with the `wasm32-unknown-unknown` target:

```shell
rustup target add wasm32-unknown-unknown
cargo build --target wasm32-unknown-unknown --release
```

The module lands at `target/wasm32-unknown-unknown/release/drop_old_logs.wasm`.

{% admonition(type="note") %}
Hosts run lenses through LensVM, and the runtime depends on where the lens executes: production Host clients use wazero, while Viewkit's local testing uses wasmer. Both enforce the same rules, so a lens that is deterministic in one is deterministic in the other.
{% end %}

## Attach it to a View and test the whole thing

A local build attaches to a View with `--path` instead of `--url`:

```shell
viewkit view add lens \
  --label "drop-old-logs" \
  --path ./target/wasm32-unknown-unknown/release/drop_old_logs.wasm \
  --args '{}' \
  --name my-view
```

Then run the full-View check, which spins up a local node, applies the lens, and validates the output:

```shell
viewkit view test my-view
viewkit view deploy my-view --target local
```

If the View compiles and the playground shows the filtered rows, the lens is doing its job. From here the usual cycle applies: edit, rebuild, `viewkit view test`, redeploy.

## Respect the determinism rules

Every Host client runs your lens over the same documents, and the results are compared. If two Hosts disagree, something is wrong, so a lens must produce exactly the same output on every run. That rules out:

- Reading the system clock or generating random numbers.
- Making network calls.
- Depending on file system state.
- Using floating-point arithmetic, which can vary across WASM runtimes.

The hardcoded `MIN_BLOCK` in the example is deliberate: a block height read from the document is deterministic, while "logs older than 24 hours" is not, because it depends on the clock.

## The AssemblyScript alternative

Rust is the preferred path for production lenses: it has the best tooling and optimization, with output around 200 to 300 KB. If you would rather write something closer to TypeScript, the AssemblyScript SDK produces noticeably smaller modules, around 73 KB, which means less overhead when Host clients download the View bundle. Both SDKs live in the [sourcenetwork/lens](https://github.com/sourcenetwork/lens) repo, and the [lens reference](/reference/components/lens/) has the details.

## Need help

{{ need_help(client="Viewkit", repo_name="shinzo-view-creator", repo="https://github.com/shinzonetwork/shinzo-view-creator/issues") }}
