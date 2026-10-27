# Project names and package publishing

[Documentation](README.md) · [GitHub presentation](github-presentation.md)

## Current state

Checked on **27 October 2026**. These are observations, not reservations or promises that a service will accept a name.

| Name or service | Result |
| --- | --- |
| GitHub `talweg-app` | Organization exists, with `talweg` and `.github` repositories. |
| npm `talweg`, `talweg-app` | Registry returned 404: no public package metadata found. |
| npm `talweg-core`, `talweg-router` | Registry returned 404: no public package metadata found. |
| npm `@talweg/core`, `@talweg-app/core` | Registry returned 404: no public package metadata found. Scope ownership is not established by this result. |
| npm `@talweg` / `@talweg-app` organization | Availability unconfirmed; npm’s website rejected the unauthenticated check. |
| npm publication | Not performed. Namespace ownership and maintainer authentication must be established first. |
| JSR, PyPI, crates.io and other registries | No names registered or claimed. |

GitHub and npm are separate services. Owning `talweg-app` on GitHub does not grant the matching npm scope or unscoped package name.

## The useful npm path

The suggested public namespace is **`@talweg-app`**, matching the GitHub organization, if npm accepts it. A first useful release would be **`@talweg-app/core`**: the actual camera transforms, resize geometry, groups and scene types already used by the app. It has a real API and no runtime dependencies.

This does not claim the unscoped name `talweg`. A future `talweg` package should have its own useful purpose, such as a supported command-line interface. Publishing an empty package simply to block the name is not an appropriate release.

The current workspace names (`@talweg/core`, `@talweg/router`, `@talweg/storage`) are internal identifiers. They remain private until ownership and release names are confirmed. Do not bulk-publish the workspace or turn off every package’s `private` flag.

## What the owner needs to do

1. [Create a personal npm account](https://www.npmjs.com/signup), complete email verification and set up the authentication required by npm. Keep credentials and recovery codes private.
2. Create the project organization under that account, using `talweg-app` if available. npm offers a free plan for public packages. Choose a consistent alternative if the name is unavailable; check it before changing package manifests.
3. Log in locally with `npm login` and verify the expected account with `npm whoami`.
4. Review the actual package contents and run its tests and an isolated consumer check.
5. Publish the real beta package using `--access public --tag beta`, completing npm’s authentication challenge yourself when required.
6. Verify the owner, version, README and beta dist-tag on npm, then add the package link and installation instructions to the public docs.

No `npm install @talweg-app/core` recommendation is shown as a working registry install before the package exists. A local tarball can be tested first with `npm install /absolute/path/to/package.tgz` in an empty project.

## Other registries

JSR can make sense if we maintain a TypeScript library for consumers outside the application. It has separate scopes and a no-squatting policy; it needs a supported package and its own publishing checks. PyPI and crates.io should wait for actual Python or Rust components rather than unrelated placeholder uploads.

A project domain or matching community handle can help keep the public identity consistent. Their availability has not been checked here, and no domain purchase or account creation was performed. Pick accounts you intend to maintain; each service manages its own names.

## Sources

- [npm account setup](https://docs.npmjs.com/creating-a-new-npm-user-account/)
- [npm organizations and the public-package plan](https://docs.npmjs.com/creating-an-organization/)
- [How npm scopes work](https://docs.npmjs.com/about-scopes/)
- [npm name policy](https://docs.npmjs.com/policies/disputes/)
- [Publishing scoped public packages](https://docs.npmjs.com/creating-and-publishing-scoped-public-packages/)
- [JSR scope and package policy](https://jsr.io/docs/usage-policy)
