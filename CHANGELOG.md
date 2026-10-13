# Changelog

All notable changes to `@actdim/msgmesh` are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [1.8.3] - 2026-10-13

### Changed
- Bump patch version to 1.8.3, synchronize workspace guidelines and Along protocol v4.4.12 metadata.

## [1.8.2] - 2026-10-11

Commits `a322dd0`, `14b18ca`.

### Fixed
- ESLint configuration repaired: unified flat config in `eslint.config.mjs`, eliminated duplicate and broken merge imports (`debt--eslint-config-repair`).

### Added
- Configurable channel request timeout via `MsgChannelConfig.timeout?: number` for `request()` and `once()` operations.
- Upfront `requestId` generation in message dispatch for robust request-response correlation.

### Changed
- Bump patch version to 1.8.2, reconcile Along protocol v4.4.10 metadata (`task--release-v1-8-2`).

## [1.8.1] - 2026-10-07

Commit `dbc2630`.

### Changed
- Synchronized workspace guidelines and bumped patch version to 1.8.1.

## [1.8.0] - 2026-10-01

Commit `b585374`.

### Fixed
- Outside DEV the `MSGBUS.ERROR` payload keeps the error's own enumerable fields; `name`, `message`, `stack` and `cause` are still set explicitly (`bug--msgbus-error-own-fields`).

### Changed
- Along protocol 4.4.1; AI commit attribution disabled.

## [1.7.2] - 2026-09-27

Commits `f197d4b`, `15b3cdc`.

### Changed
- Docs: channel group semantics (`in`, `out`, `ex`) in contracts, adapters and domain structures (`docs--channel-group-semantics`).

### Fixed
- Documentation CI workflow and lockfile synchronization.

## Earlier versions

See the [Changelog section of README.md](./README.md#changelog).
