# QV security dependency patches

These packages retain the legacy APIs needed by the QV Serverless 3 fork.
The upstream sources and SHA-512 integrity are pinned in packages.json.
Run `node scripts/build-security-dependencies.js <empty-directory>` to reproduce them.
Run the regression tests with `SECURITY_DEPENDENCIES_BUILD=<directory> node --test test/security/legacy-dependencies.test.js`.

- braces 3.0.3: reject nesting beyond 128 AST levels before recursive expansion.
- sprintf-js 1.1.3: reject width or precision over 10000 before allocating formatted output.
- aws-sdk 2.1693.0: validate effective region before endpoint generation; update uuid. The internal build omits precompiled browser bundles and is intended for the Node 24 toolchain. This does not restore upstream AWS SDK v2 support.
- @serverless/utils 6.15.0: use maintained archive extraction and the file-type 22 API, preserving the download stream/promise interface.
- simple-git 4.0.2: retain the upstream security guards and expose a callable CommonJS entry for legacy consumers.

Packages are published to QV CodeArtifact using the `security` tag. The consumer root must retain the versioned overrides for transitive legacy dependencies; npm does not apply a dependency package's overrides to its parent project. No audit ignore lists are used.
