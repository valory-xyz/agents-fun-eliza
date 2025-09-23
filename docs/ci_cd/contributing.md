# Contributing to GitHub Actions Workflows

This document provides guidelines for modifying existing workflows, adding new workflows, and following best practices for GitHub Actions workflow development.

## Table of Contents

- [Overview](#overview)
- [Modifying Existing Workflows](#modifying-existing-workflows)
- [Adding New Workflows](#adding-new-workflows)
- [Best Practices](#best-practices)
- [Testing and Validation](#testing-and-validation)
- [Common Patterns](#common-patterns)
- [Security Considerations](#security-considerations)

## Overview

Our CI/CD pipeline consists of several GitHub Actions workflows that work together to build, test, and release our software. When contributing to these workflows, it's important to follow our established patterns and best practices to ensure security, efficiency, and maintainability.

## Modifying Existing Workflows

When modifying existing workflows, follow these steps:

1. **Create a Branch**: Always create a new branch for your changes
2. **Understand the Workflow**: Before making changes, understand the purpose and structure of the workflow
3. **Make Minimal Changes**: Only change what is necessary to achieve your goal
4. **Follow Existing Patterns**: Maintain consistency with the existing workflow structure
5. **Update Documentation**: Update the corresponding documentation in `docs/ci_cd/`
6. **Create a Pull Request**: Submit your changes as a pull request for review

### Example: Adding a New Step to an Existing Job

```yaml
# Original job
jobs:
  build:
    name: Build ${{ matrix.os_name }}-${{ matrix.arch }}
    runs-on: ${{ matrix.os }}
    steps:
      - name: Checkout repository
        uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
        with:
          fetch-depth: 1

# Modified job with new step
jobs:
  build:
    name: Build ${{ matrix.os_name }}-${{ matrix.arch }}
    runs-on: ${{ matrix.os }}
    steps:
      - name: Checkout repository
        uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
        with:
          fetch-depth: 1
          
      # New step
      - name: Set up environment
        run: |
          echo "Setting up environment..."
          echo "NEW_VARIABLE=value" >> $GITHUB_ENV
```

## Adding New Workflows

When adding new workflows, follow these steps:

1. **Create a Branch**: Always create a new branch for your changes
2. **Plan the Workflow**: Define the purpose, triggers, jobs, and steps of the workflow
3. **Follow Best Practices**: Implement the workflow following our best practices
4. **Create Documentation**: Create documentation for the workflow in `docs/ci_cd/`
5. **Update the Central Documentation**: Update `docs/ci_cd/README.md` to include the new workflow
6. **Create a Pull Request**: Submit your changes as a pull request for review

### Workflow Template

Use this template as a starting point for new workflows:

```yaml
name: Workflow Name

on:
  # Define triggers
  push:
    branches:
      - main
  workflow_dispatch:  # Allow manual triggering

# Define specific permissions (principle of least privilege)
permissions:
  contents: read
  # Add other permissions as needed

# Cancel in-progress runs on the same branch
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  job-name:
    name: Job Name
    runs-on: ubuntu-latest
    timeout-minutes: 10  # Prevent runaway workflows
    
    steps:
      - name: Checkout repository
        # Pin action with SHA for security
        uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
        with:
          fetch-depth: 1  # Shallow clone for faster checkout
      
      # Add more steps as needed
```

## Best Practices

Follow these best practices when developing workflows:

### Security

1. **Define Explicit Permissions**: Always define explicit permissions using the principle of least privilege
   ```yaml
   permissions:
     contents: read
     packages: read
   ```

2. **Pin Action Versions with SHA Hashes**: Always pin external actions to specific SHA hashes
   ```yaml
   # Instead of this (insecure):
   uses: actions/checkout@v4
   
   # Use this (secure):
   uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
   ```

3. **Set Timeout Limits**: Always set timeout limits for jobs to prevent runaway workflows
   ```yaml
   jobs:
     build:
       timeout-minutes: 60  # Prevent runaway workflows
   ```

4. **Use `github.token` with Minimal Permissions**: Use the built-in `github.token` with minimal permissions
   ```yaml
   with:
     github-token: ${{ github.token }}
   ```

### Efficiency

1. **Implement Concurrency Controls**: Prevent redundant workflow runs
   ```yaml
   concurrency:
     group: ${{ github.workflow }}-${{ github.ref }}
     cancel-in-progress: true
   ```

2. **Use Path Filtering**: Avoid unnecessary workflow runs
   ```yaml
   on:
     push:
       paths-ignore:
         - '**.md'
         - 'docs/**'
   ```

3. **Optimize Checkout**: Use shallow clones for faster checkout
   ```yaml
   - name: Checkout repository
     uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
     with:
       fetch-depth: 1  # Shallow clone for faster checkout
   ```

4. **Implement Effective Caching**: Cache dependencies to speed up workflows
   ```yaml
   - name: Cache dependencies
     uses: actions/cache@0c45773b623bea8c8e75f6c82b208c3cf94ea4f9 # v4.0.2
     with:
       path: ~/.npm
       key: ${{ runner.os }}-node-${{ hashFiles('**/package-lock.json') }}
       restore-keys: |
         ${{ runner.os }}-node-
   ```

### Maintainability

1. **Add Comprehensive Comments**: Explain complex steps
   ```yaml
   # Extract version from package.json early to use throughout the workflow
   - name: Extract version
     id: extract_version
     run: |
       VERSION=$(jq -r '.version' package.json)
       echo "VERSION=${VERSION}" >> $GITHUB_ENV
   ```

2. **Use Consistent Naming Conventions**:
   - Job names: Use kebab-case (`create-release`)
   - Step names: Use sentence case with clear descriptions (`Extract version`)
   - Environment variables: Use UPPER_SNAKE_CASE (`BINARY_NAME`)

3. **Structure Workflows to Promote Reusability**:
   - Define environment variables at the top level
   - Use matrix builds for multiple platforms/configurations
   - Structure common steps consistently across workflows

## Testing and Validation

Before submitting workflow changes, test and validate them:

1. **Local Validation**: Use tools like [act](https://github.com/nektos/act) to test workflows locally
2. **Syntax Validation**: Use [actionlint](https://github.com/rhysd/actionlint) to validate workflow syntax
3. **Security Validation**: Ensure all actions are pinned and permissions are properly defined
4. **Manual Testing**: Manually trigger the workflow to verify it works as expected
5. **Workflow Validation**: Ensure your changes pass the Workflow Validation workflow

### Using Actionlint Locally

```bash
# Install actionlint
brew install actionlint  # macOS
# or
go install github.com/rhysd/actionlint/cmd/actionlint@latest  # Go

# Run actionlint
actionlint .github/workflows/your-workflow.yaml
```

## Common Patterns

Here are some common patterns used in our workflows:

### Matrix Builds

```yaml
jobs:
  build:
    strategy:
      fail-fast: false  # Continue with other builds if one fails
      matrix:
        include:
          - os: ubuntu-latest
            os_name: linux
            arch: x64
          - os: macos-latest
            os_name: macos
            arch: x64
    
    runs-on: ${{ matrix.os }}
```

### Conditional Steps

```yaml
- name: Step that runs only on success
  if: success()
  run: echo "Previous step succeeded"

- name: Step that runs only on failure
  if: failure()
  run: echo "Previous step failed"
```

### Reusable Workflows

```yaml
# Caller workflow
jobs:
  call-reusable-workflow:
    uses: ./.github/workflows/reusable-workflow.yaml
    with:
      parameter: value
    secrets:
      token: ${{ secrets.TOKEN }}
```

## Security Considerations

When developing workflows, consider these security aspects:

1. **Secrets Management**: Never hardcode secrets in workflows
   ```yaml
   # Instead of this (insecure):
   run: curl -H "Authorization: token hardcoded-token" https://api.example.com
   
   # Use this (secure):
   run: curl -H "Authorization: token ${{ secrets.API_TOKEN }}" https://api.example.com
   ```

2. **Third-Party Actions**: Be cautious when using third-party actions
   - Prefer official actions when available
   - Review the source code of third-party actions
   - Pin actions to specific SHA hashes

3. **Script Injection**: Be careful with user inputs
   ```yaml
   # Instead of this (vulnerable):
   run: echo "${{ github.event.issue.title }}" > file.txt
   
   # Use this (secure):
   run: |
     SAFE_TITLE=$(echo "${{ github.event.issue.title }}" | sed 's/[&|;<>]//g')
     echo "$SAFE_TITLE" > file.txt
   ```

4. **Artifact Security**: Be mindful of what you upload as artifacts
   - Don't upload sensitive information
   - Set appropriate retention periods
   ```yaml
   - name: Upload artifact
     uses: actions/upload-artifact@65462800fd760344b1a7b4382951275a0abb4808 # v4.3.1
     with:
       name: my-artifact
       path: ./path/to/artifact
       retention-days: 7  # Set appropriate retention period
   ```

By following these guidelines, you'll help maintain the security, efficiency, and maintainability of our GitHub Actions workflows.