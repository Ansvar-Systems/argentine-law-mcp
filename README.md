# Argentine Law MCP

[![npm](https://img.shields.io/npm/v/@ansvar/argentine-law-mcp)](https://www.npmjs.com/package/@ansvar/argentine-law-mcp)
[![License](https://img.shields.io/badge/license-Apache--2.0-blue.svg)](LICENSE)
[![CI](https://github.com/Ansvar-Systems/argentine-law-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/argentine-law-mcp/actions/workflows/ci.yml)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-green)](https://registry.modelcontextprotocol.io/)
[![OpenSSF Scorecard](https://img.shields.io/ossf-scorecard/github.com/Ansvar-Systems/argentine-law-mcp)](https://securityscorecards.dev/viewer/?uri=github.com/Ansvar-Systems/argentine-law-mcp)

A Model Context Protocol (MCP) server providing comprehensive access to Argentine federal legislation, including data protection (Ley 25.326), cybercrime, digital signature, companies, and consumer protection law with Spanish full-text search.

## Deployment Tier

**SMALL** -- Single tier, bundled SQLite database shipped with the npm package.

**Estimated database size:** ~80-150 MB (full corpus of Argentine federal legislation)

## Key Legislation Covered

| Law | Year | Significance |
|-----|------|-------------|
| **Ley 25.326 (Personal Data Protection)** | 2000 | One of the oldest data protection laws in Latin America; basis for Argentina's EU adequacy decision |
| **Ley 26.388 (Cybercrime)** | 2008 | Amendments to the Penal Code incorporating computer crime offences |
| **Ley 25.506 (Digital Signature)** | 2001 | Legal framework for digital and electronic signatures; early adopter in Latin America |
| **Ley 19.550 (Ley General de Sociedades)** | Various | General companies law governing all types of commercial companies |
| **Ley 24.240 (Consumer Protection)** | 1993 | Consumer defense law administered by the Secretaria de Comercio |
| **Ley 27.078 (Argentina Digital)** | 2014 | Telecommunications and digital development framework |
| **Constitution of Argentina** | 1994 (reform) | Article 43 establishes habeas data as a constitutional right |

## Regulatory Context

- **Data Protection Regulator:** AAIP (Agencia de Acceso a la Informacion Publica), successor to the former Direccion Nacional de Proteccion de Datos Personales
- **Argentina holds an EU adequacy decision** (Decision 2003/490/EC), making it one of the few non-EU countries recognized as providing adequate data protection
- **Ley 25.326 dates from 2000**; a comprehensive reform bill to align with GDPR has been pending for several years but has not been enacted
- The **Argentine Constitution (1994)** includes habeas data in Article 43, providing constitutional-level personal data protection
- Argentina is a **civil law jurisdiction**; the Boletin Oficial (B.O.) is the official gazette
- Argentina is a member of **Mercosur** and participates in the **Ibero-American Data Protection Network (RIPD)**

## Data Sources

| Source | Authority | Method | Update Frequency | License | Coverage |
|--------|-----------|--------|-----------------|---------|----------|
| [InfoLEG](https://www.infoleg.gob.ar) | Ministerio de Justicia y Derechos Humanos | HTML Scrape | On change | Government Public Data | All federal laws with consolidated texts, decrees, resolutions |
| [SAIJ](https://www.saij.gob.ar) | Ministerio de Justicia y Derechos Humanos | HTML Scrape | On change | Government Public Data | Federal/provincial legislation, case law, legal doctrine |
| [AAIP](https://www.argentina.gob.ar/aaip) | Agencia de Acceso a la Informacion Publica | HTML Scrape | On change | Government Public Data | Ley 25.326 implementing regulations, dispositions, guidance |

> Full provenance metadata: [`sources.yml`](./sources.yml)

## Installation

```bash
npm install -g @ansvar/argentine-law-mcp
```

## Usage

### As stdio MCP server

```bash
argentine-law-mcp
```

### In Claude Desktop / MCP client configuration

```json
{
  "mcpServers": {
    "argentine-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/argentine-law-mcp"]
    }
  }
}
```

## Available Tools

| Tool | Description |
|------|-------------|
| `get_provision` | Retrieve a specific article from an Argentine federal law |
| `search_legislation` | Full-text search across all Argentine legislation (Spanish) |
| `get_provision_eu_basis` | Cross-reference lookup for international framework relationships (GDPR, EU DPD, etc.) |

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Run contract tests
npm run test:contract

# Run all validation
npm run validate

# Build database from sources
npm run build:db

# Start server
npm start
```

## Contract Tests

This MCP includes 12 golden contract tests covering:
- 4 article retrieval tests (Ley 25.326, Ley 26.388, Ley 25.506, Ley 19.550)
- 3 search tests (datos personales, delito informatico, firma digital)
- 2 citation roundtrip tests (infoleg.gob.ar URLs, B.O. references)
- 1 cross-reference test (Ley 25.326 to EU DPD/GDPR -- has adequacy decision)
- 2 negative tests (non-existent law, malformed article)

Run with: `npm run test:contract`

## Security

See [SECURITY.md](.github/SECURITY.md) for vulnerability disclosure policy.

Report data errors: [Open an issue](https://github.com/Ansvar-Systems/argentine-law-mcp/issues/new?template=data-error.md)

## Related Documents

- [MCP Quality Standard](../../mcp-quality-standard.md) -- quality requirements for all Ansvar MCPs
- [MCP Infrastructure Blueprint](../../mcp-infrastructure-blueprint.md) -- infrastructure implementation templates
- [MCP Deployment Tiers](../../mcp-deployment-tiers.md) -- free vs. professional tier strategy
- [MCP Server Registry](../../mcp-server-registry.md) -- operational registry of all MCPs
- [MCP Remote Access](../../mcp-remote-access.md) -- public Vercel endpoint URLs

## License

Apache-2.0 -- see [LICENSE](./LICENSE)

---

Built by [Ansvar Systems](https://ansvar.eu) -- Cybersecurity compliance through AI-powered analysis.
