# Changelog

All notable changes to `@actdim/msgmesh` are documented here. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

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

See the git history (`git log --oneline`).
