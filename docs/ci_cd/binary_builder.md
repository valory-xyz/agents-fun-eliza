# Binary Builder Workflow

This document provides detailed information about the Binary Builder workflow, which is responsible for building binary executables for multiple platforms and architectures.

## Table of Contents

- [Overview](#overview)
- [Trigger Conditions](#trigger-conditions)
- [Environment Variables](#environment-variables)
- [Permissions](#permissions)
- [Jobs and Steps](#jobs-and-steps)
- [Matrix Strategy](#matrix-strategy)
- [Artifacts](#artifacts)
- [Common Issues and Troubleshooting](#common-issues-and-troubleshooting)

## Overview

The Binary Builder workflow (`binary_builder.yaml`) is responsible for building binary executables for our application across multiple platforms (Linux, macOS, Windows) and architectures (x64, arm64). It uses a combination of Bun for JavaScript compilation and Rust for creating the final executable wrapper.

### Purpose and Goals

- Build cross-platform binaries from a single codebase
- Support multiple operating systems and CPU architectures
- Optimize build performance through caching and parallel execution
- Produce standalone executables that don't require Node.js or other dependencies
- Create artifacts that can be used by subsequent workflows

## Trigger Conditions

The workflow is triggered under the following conditions:

```yaml
on:
  push:
    branches:
      - main
      - development
    paths-ignore:
      - '**.md'
      - 'docs/**'
  workflow_dispatch:  # Allow manual triggering
```

- **Push to Main or Development**: Automatically triggered when code is pushed to the main or development branches
- **Path Exclusions**: Ignores changes to markdown files and documentation to avoid unnecessary builds
- **Manual Trigger**: Can be manually triggered through the GitHub Actions interface

## Environment Variables

The workflow defines several global environment variables:

| Variable | Value | Description |
|----------|-------|-------------|
| `BINARY_NAME` | agent_runner | The name of the output binary |
| `BUN_VERSION` | 1.2.4 | The version of Bun to use for compilation |
| `NODE_VERSION` | 23.3.0 | The version of Node.js to use |
| `PNPM_VERSION` | 9 | The version of pnpm to use |

These variables are used throughout the workflow to ensure consistent versioning and naming.

## Permissions

The workflow follows the principle of least privilege by explicitly defining permissions:

```yaml
permissions:
  contents: read
  packages: read
  actions: read
```

This ensures that the workflow only has the minimum permissions required to perform its tasks.

## Jobs and Steps

The workflow consists of a single job called `build` that runs on a matrix of operating systems and architectures.

### Build Job

The build job performs the following steps:

1. **Checkout Repository**: Clones the repository with a shallow depth for faster checkout
2. **Extract Version**: Gets the version from package.json and sets up artifact naming
3. **Install pnpm**: Sets up pnpm with caching
4. **Setup Node.js**: Sets up Node.js with caching
5. **Install Dependencies**: Installs project dependencies using pnpm
6. **Setup Bun**: Sets up Bun for binary compilation
7. **Prepare Directories**: Creates necessary directories for the build process
8. **Build Binary with Bun**: Compiles the JavaScript code into a binary using Bun
9. **Copy Binary**: Copies the binary to the binary_builder directory
10. **Install External Dependencies**: Installs external dependencies for the binary wrapper
11. **Setup Rust**: Sets up the Rust toolchain for building the wrapper
12. **Cache Rust Dependencies**: Caches Rust dependencies for faster builds
13. **Build Rust Wrapper**: Builds the Rust wrapper around the binary
14. **Rename Binary**: Renames the binary with OS, architecture, and version information
15. **Upload Artifact**: Uploads the binary as a GitHub Actions artifact

## Matrix Strategy

The workflow uses a matrix strategy to build binaries for multiple platforms and architectures in parallel:

```yaml
strategy:
  fail-fast: false  # Continue with other builds if one fails
  matrix:
    include:
      - os: ubuntu-latest
        os_name: linux
        arch: x64
      - os: ubuntu-latest
        os_name: linux
        arch: arm64
      - os: macos-latest
        os_name: macos
        arch: x64
      - os: macos-latest
        os_name: macos
        arch: arm64
      - os: windows-latest
        os_name: windows
        arch: x64
```

This allows the workflow to build binaries for:
- Linux (x64, arm64)
- macOS (x64, arm64)
- Windows (x64)

## Artifacts

The workflow produces the following artifacts:

| Artifact Name | Description | Retention Period |
|---------------|-------------|-----------------|
| `${BINARY_NAME}_${os_name}_${arch}_${VERSION}` | Binary executable for a specific platform and architecture | 90 days |

These artifacts are used by:
- The Binary Testing workflow to test the binaries
- The Release Creator workflow to create GitHub releases

## Common Issues and Troubleshooting

### External Dependencies

The binary compilation process excludes certain native modules that cannot be properly bundled:

```yaml
bun build --compile ./src/index.ts \
  --outfile=pkg_${{ matrix.os_name }}_${{ matrix.arch }}/${{ env.BINARY_NAME }} \
  --external sharp \
  --external onnxruntime-node \
  --external @roamhq \
  --external sqlite-vec
```

If you encounter issues with these dependencies:
- Ensure they are correctly marked as external
- Verify they are installed separately in the binary package
- Check for platform-specific compatibility issues

### Cross-Platform Compilation

When building for multiple platforms, be aware of:
- Path separators (/ vs \) for different operating systems
- Binary extensions (.exe for Windows)
- Architecture-specific optimizations

### Cache Invalidation

If you need to force a clean build:
1. Clear the GitHub Actions cache
2. Update the cache key in the workflow file
3. Manually trigger the workflow

### Build Failures

If a build fails:
1. Check the specific error message in the GitHub Actions logs
2. Verify that all dependencies are available and compatible
3. Ensure that the Rust toolchain is properly set up
4. Check for platform-specific issues in the matrix build that failed