+++
title = "Install"
description = "Compile and Install the View Creator (Viewkit) as an executable."
weight = 2
+++

View Creator (also referred to as Viewkit) is the developer-facing toolchain for defining, packaging, and deploying Shinzo Views. It provides a workflow for turning raw indexed blockchain data into reusable, versioned data APIs that can be executed and served by Hosts.

## Prerequisites

- Git
- Make
- Go 1.25

## Setup

1. Make sure you've got all the prerequisites installed properly:

    ```shell
    git --version && make --version && go version
    ```

    ```output
    git version 2.43.0
    GNU Make 4.3
    [...]
    go version go1.25.12 linux/arm64
    ```

1. Clone the repository:

    ```shell
    git clone https://github.com/shinzonetwork/shinzo-view-creator.git
    cd shinzo-view-creator
    ```

1. Build the viewkit binary:

    ```shell
    make build
    ```

    You should see a `build` directory:

1. Run Viewkit:

    ```shell
    ./build/viewkit --help
    ```

    ```output
    Viewkit helps you initialize, manage, and publish Shinzo views through a simple CLI interface.

    Usage:
      viewkit [command]

    [...]
    ```

1. Move the `viewkit` executable somewhere resonable and (optional):

    ```shell
    sudo mv ./build/viewkit /usr/local/bin
    ```

    Now you can run `viewkit` from anywhere.

## Wasmer runtime

Viewkit can execute WebAssembly lenses locally to validate and preview them.

Under the hood, it uses `wasmer-go`, which depends on a native dynamic library (`libwasmer.dylib`). If your local system cannot find that library, any command that touches lenses will fail with an error like:

> image not found
> library not loaded: libwasmer.dylib

1. Move back into the shinzo-view-creator repo if you moved out of it:

    ```shell
    cd shinzo-view-creator
    ```

1. Install the Wasmer Go module

    ```shell
    go get github.com/wasmerio/wasmer-go@v1.0.4
    ```

    ```output
    go: downloading github.com/wasmerio/wasmer-go v1.0.4
    go: added github.com/wasmerio/wasmer-go v1.0.4
    ```

    This ensures `wasmer-go` and its packaged native libraries are present in your `GOPATH`.

### Environment variables

We need to set three new environment variables:

- `WASMER_ROOT`: points to the directory where `libwasmer.dylib` lives.
- `WASMER_LIB_PATH`: used by `wasmer-go` to find the dynamic library.
- `DYLD_LIBRARY_PATH`: MacOS-specific dynamic loader search path. We prepend `WASMER_ROOT` so the loader can find `libwasmer.dylib` when `viewkit` starts.

1. Append these lines to your shell's RC file. 

    MacOS:

    ```shell
    echo 'export WASMER_ROOT="$(go env GOPATH)/pkg/mod/github.com/wasmerio/wasmer-go@v1.0.4/wasmer/packaged/lib/darwin-aarch64"' >> ~/.zshrc
    echo 'export WASMER_LIB_PATH="$WASMER_ROOT"' >> ~/.zshrc
    echo 'export DYLD_LIBRARY_PATH="$WASMER_ROOT:$DYLD_LIBRARY_PATH"' >> ~/.zshrc
    ```

    Linux:

    ```shell
    echo 'export WASMER_ROOT="$(go env GOPATH)/pkg/mod/github.com/wasmerio/wasmer-go@v1.0.4/wasmer/packaged/lib/linux-amd64"' >> ~/.zshrc
    echo 'export WASMER_LIB_PATH="$WASMER_ROOT"' >> ~/.zshrc
    echo 'export LD_LIBRARY_PATH="$WASMER_ROOT:$LD_LIBRARY_PATH"' >> ~/.zshrc
    ```

1. Reload your shell configuration:

    ```shell
    source ~/.zshrc
    ```

1. Verify that the variables are set:

    ```shell
    echo "$WASMER_ROOT"
    ls "$WASMER_ROOT"
    ```

    ```output
    /home/user/go/pkg/mod/github.com/wasmerio/wasmer-go@v1.0.4/wasmer/packaged/lib/linux-amd64
    dummy.go  libwasmer.so
    ```

> [!WARNING]
> If `libwasmer.dylib` is missing, re-run the `go get` step and ensure `go env GOPATH` returns a valid path.

