# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [2.0.0] - 2026-02-26
### Changed
- Full corpus ingestion: 22,830 laws with 89,793 provisions from InfoLEG
- Census: 22,832 seed files covering Ley 1 through Ley 29453
- Database rebuilt at 99 MB with complete FTS5 search index
- 3,209 legal term definitions extracted
- Upgraded from partial corpus (~200 laws) to full national legislative corpus

## [1.0.0] - 2026-XX-XX
### Added
- Initial release of Argentine Law MCP
- `search_legislation` tool for full-text search across all Argentine federal statutes (Spanish)
- `get_provision` tool for retrieving specific articles/sections
- `get_provision_eu_basis` tool for international framework cross-references
- `validate_citation` tool for legal citation validation
- `check_statute_currency` tool for checking statute amendment status
- `list_laws` tool for browsing available legislation
- Contract tests with 12 golden test cases
- Drift detection with 6 stable provision anchors
- Health and version endpoints
- Vercel deployment (single tier bundled)
- npm package with stdio transport
- MCP Registry publishing

[Unreleased]: https://github.com/Ansvar-Systems/argentine-law-mcp/compare/v2.0.0...HEAD
[2.0.0]: https://github.com/Ansvar-Systems/argentine-law-mcp/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/Ansvar-Systems/argentine-law-mcp/releases/tag/v1.0.0
