# Argentine Law MCP Server

**The InfoLEG alternative for the AI age.**

[![npm version](https://badge.fury.io/js/@ansvar%2Fargentine-law-mcp.svg)](https://www.npmjs.com/package/@ansvar/argentine-law-mcp)
[![MCP Registry](https://img.shields.io/badge/MCP-Registry-blue)](https://registry.modelcontextprotocol.io)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](https://opensource.org/licenses/Apache-2.0)
[![GitHub stars](https://img.shields.io/github/stars/Ansvar-Systems/argentine-law-mcp?style=social)](https://github.com/Ansvar-Systems/argentine-law-mcp)
[![CI](https://github.com/Ansvar-Systems/argentine-law-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/Ansvar-Systems/argentine-law-mcp/actions/workflows/ci.yml)
[![Daily Data Check](https://github.com/Ansvar-Systems/argentine-law-mcp/actions/workflows/check-updates.yml/badge.svg)](https://github.com/Ansvar-Systems/argentine-law-mcp/actions/workflows/check-updates.yml)
[![Database](https://img.shields.io/badge/database-pre--built-green)](https://github.com/Ansvar-Systems/argentine-law-mcp)

Query **Argentine federal legislation** — from Ley 25.326 (protección de datos personales) and the Código Penal to the Código Civil y Comercial, leyes de ciberseguridad, defensa del consumidor, and more — directly from Claude, Cursor, or any MCP-compatible client.

If you're building legal tech, compliance tools, or doing Argentine legal research, this is your verified reference database.

Built by [Ansvar Systems](https://ansvar.eu) -- Stockholm, Sweden

---

## Why This Exists

Argentine legal research is scattered across InfoLEG, SAIJ, the Boletín Oficial, and individual ministerial sites. Whether you're:
- A **lawyer** validating citations in a brief or contract
- A **compliance officer** checking obligations under Ley 25.326 or Ley 27.078
- A **legal tech developer** building tools on Argentine law
- A **researcher** tracing the legislative history of a ley nacional

...you shouldn't need a dozen browser tabs and manual PDF cross-referencing. Ask Claude. Get the exact provision. With context.

This MCP server makes Argentine law **searchable, cross-referenceable, and AI-readable**.

> **Initial release:** The Argentine law database is actively being populated from InfoLEG (servicios.infoleg.gob.ar) and SAIJ (saij.gob.ar). Coverage will expand with each release. See the roadmap below.

---

## Quick Start

### Use Remotely (No Install Needed)

> Connect directly to the hosted version — zero dependencies, nothing to install.

**Endpoint:** `https://argentine-law-mcp.vercel.app/mcp`

| Client | How to Connect |
|--------|---------------|
| **Claude.ai** | Settings > Connectors > Add Integration > paste URL |
| **Claude Code** | `claude mcp add argentine-law --transport http https://argentine-law-mcp.vercel.app/mcp` |
| **Claude Desktop** | Add to config (see below) |
| **GitHub Copilot** | Add to VS Code settings (see below) |

**Claude Desktop** — add to `claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "argentine-law": {
      "type": "url",
      "url": "https://argentine-law-mcp.vercel.app/mcp"
    }
  }
}
```

**GitHub Copilot** — add to VS Code `settings.json`:

```json
{
  "github.copilot.chat.mcp.servers": {
    "argentine-law": {
      "type": "http",
      "url": "https://argentine-law-mcp.vercel.app/mcp"
    }
  }
}
```

### Use Locally (npm)

```bash
npx @ansvar/argentine-law-mcp
```

**Claude Desktop** — add to `claude_desktop_config.json`:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

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

**Cursor / VS Code:**

```json
{
  "mcp.servers": {
    "argentine-law": {
      "command": "npx",
      "args": ["-y", "@ansvar/argentine-law-mcp"]
    }
  }
}
```

## Example Queries

Once connected, just ask naturally (queries work in Spanish or English):

- *"¿Qué dice el artículo 5 de la Ley 25.326 sobre el consentimiento para el tratamiento de datos personales?"*
- *"Buscar disposiciones sobre protección de datos personales en la legislación argentina"*
- *"¿Está vigente la Ley de Defensa del Consumidor (Ley 24.240)?"*
- *"¿Cuáles son los artículos del Código Penal sobre delitos informáticos?"*
- *"Buscar 'firma digital' en el Código Civil y Comercial"*
- *"¿Qué ley argentina implementa las obligaciones del GDPR para empresas con adecuación UE?"*
- *"Find provisions about cybercrime in Argentine law"*
- *"Validate the citation 'Ley 25.326, art. 4'"*

---

## What's Included

| Category | Count | Details |
|----------|-------|---------|
| **Leyes Nacionales** | Initial release | Database being populated from InfoLEG/SAIJ |
| **Provisions** | In progress | Full-text searchable with FTS5 |
| **Premium: Case law** | 0 (free tier) | Jurisprudencia expansion planned |
| **Premium: Preparatory works** | 0 (free tier) | Antecedentes parlamentarios planned |
| **Premium: Agency guidance** | 0 (free tier) | AAIP resolutions and guidance planned |
| **Database Size** | Growing | Optimized SQLite, portable |
| **Daily Updates** | Automated | Freshness checks against InfoLEG |

**Verified data only** — every citation is validated against official sources (InfoLEG / SAIJ). Zero LLM-generated content.

---

## Why This Works

**Verbatim Source Text (No LLM Processing):**
- All statute text is ingested from InfoLEG (servicios.infoleg.gob.ar) and SAIJ (saij.gob.ar) official sources
- Provisions are returned **unchanged** from SQLite FTS5 database rows
- Zero LLM summarization or paraphrasing — the database contains regulation text, not AI interpretations

**Smart Context Management:**
- Search returns ranked provisions with BM25 scoring (safe for context)
- Provision retrieval gives exact text by ley number + article
- Cross-references help navigate without loading everything at once

**Technical Architecture:**
```
InfoLEG/SAIJ API → Parse → SQLite → FTS5 snippet() → MCP response
                     ↑                     ↑
              Provision parser       Verbatim database query
```

### Traditional Research vs. This MCP

| Traditional Approach | This MCP Server |
|---------------------|-----------------|
| Search InfoLEG by número de ley | Search by plain Spanish: *"protección datos consentimiento"* |
| Navigate multi-chapter statutes manually | Get the exact provision with context |
| Manual cross-referencing between leyes | `build_legal_stance` aggregates across sources |
| "¿Está vigente esta ley?" → check manually | `check_currency` tool → answer in seconds |
| Find EU adequacy references → dig through EUR-Lex | `get_eu_basis` → linked EU acts instantly |
| No API, no integration | MCP protocol → AI-native |

**Traditional:** Search InfoLEG → Download PDF → Ctrl+F → Cross-reference with SAIJ → Check AAIP guidance → Repeat

**This MCP:** *"¿Qué obligaciones impone la Ley 25.326 a los responsables de bases de datos?"* → Done.

---

## Available Tools (13)

### Core Legal Research Tools (8)

| Tool | Description |
|------|-------------|
| `search_legislation` | FTS5 full-text search across provisions with BM25 ranking. Supports quoted phrases, boolean operators, prefix wildcards |
| `get_provision` | Retrieve specific provision by ley number + article (e.g., "25326" + "art. 5") |
| `check_currency` | Check if a ley is in force, amended, or repealed |
| `validate_citation` | Validate citation against database — zero-hallucination check. Supports "Ley 25.326, art. 4", "CCyCN art. 1709" |
| `build_legal_stance` | Aggregate citations from multiple leyes for a legal topic |
| `format_citation` | Format citations per Argentine conventions (full/short/pinpoint) |
| `list_sources` | List all available statutes with metadata, coverage scope, and data provenance |
| `about` | Server info, capabilities, dataset statistics, and coverage summary |

### EU Law Integration Tools (5)

| Tool | Description |
|------|-------------|
| `get_eu_basis` | Get EU directives/regulations that an Argentine statute aligns with (e.g., Ley 25.326 — GDPR adequacy) |
| `get_argentine_implementations` | Find Argentine laws corresponding to a specific EU act |
| `search_eu_implementations` | Search EU documents with Argentine alignment counts |
| `get_provision_eu_basis` | Get EU law references for a specific provision |
| `validate_eu_compliance` | Check alignment status of Argentine statutes against EU directives |

---

## EU Adequacy Status

Argentina is not an EU member state. However, Argentina holds **EU adequacy status under GDPR Article 45** (Commission Decision 2003/490/EC, reaffirmed under GDPR), meaning personal data can flow from the EU to Argentina without additional safeguards for private-sector data processing.

Key alignment points:
- **Ley 25.326** (Protección de Datos Personales) is the basis for the adequacy decision. It was modeled on EU Directive 95/46/EC and broadly aligns with GDPR principles.
- **AAIP** (Agencia de Acceso a la Información Pública) is the supervisory authority, equivalent to an EU DPA.
- Argentina is updating Ley 25.326 to align further with GDPR as adequacy decisions are reviewed.

The EU bridge tools allow you to explore these alignment relationships — checking which Argentine provisions correspond to EU requirements, and vice versa.

> **Note:** EU cross-references reflect alignment and adequacy relationships, not transposition. Argentina adopts its own legislative approach.

---

## Data Sources & Freshness

All content is sourced from authoritative Argentine legal databases:

- **[InfoLEG](https://servicios.infoleg.gob.ar/)** — Información Legislativa y Documental, Ministerio de Justicia
- **[SAIJ](https://saij.gob.ar/)** — Sistema Argentino de Información Jurídica
- **[Boletín Oficial](https://www.boletinoficial.gob.ar/)** — Official gazette for promulgation dates

### Data Provenance

| Field | Value |
|-------|-------|
| **Authority** | Ministerio de Justicia y Derechos Humanos de la Nación |
| **Retrieval method** | InfoLEG API and SAIJ database |
| **Language** | Spanish |
| **License** | Public domain (obra de dominio público del Estado Nacional) |
| **Coverage** | Leyes nacionales — initial release, expanding |

### Automated Freshness Checks (Daily)

A [daily GitHub Actions workflow](.github/workflows/check-updates.yml) monitors data sources:

| Check | Method |
|-------|--------|
| **Ley amendments** | InfoLEG date comparison |
| **New leyes** | Boletín Oficial publication monitoring |
| **Repealed statutes** | Status change detection |

**Verified data only** — every citation is validated against official sources. Zero LLM-generated content.

---

## Security

This project uses multiple layers of automated security scanning:

| Scanner | What It Does | Schedule |
|---------|-------------|----------|
| **CodeQL** | Static analysis for security vulnerabilities | Weekly + PRs |
| **Semgrep** | SAST scanning (OWASP top 10, secrets, TypeScript) | Every push |
| **Gitleaks** | Secret detection across git history | Every push |
| **Trivy** | CVE scanning on filesystem and npm dependencies | Daily |
| **Socket.dev** | Supply chain attack detection | PRs |
| **Dependabot** | Automated dependency updates | Weekly |

See [SECURITY.md](SECURITY.md) for the full policy and vulnerability reporting.

---

## Important Disclaimers

### Legal Advice

> **THIS TOOL IS NOT LEGAL ADVICE**
>
> Statute text is sourced from InfoLEG and SAIJ official publications. However:
> - This is a **research tool**, not a substitute for professional legal counsel
> - **Initial release — law database is being populated.** Do not rely on this tool as an exhaustive source until coverage is complete
> - **Court case coverage is not included** in the free tier — do not rely solely on this for jurisprudencia research
> - **Verify critical citations** against primary sources (InfoLEG, Boletín Oficial) for court filings
> - **EU cross-references** reflect alignment and adequacy relationships, not transposition

**Before using professionally, read:** [DISCLAIMER.md](DISCLAIMER.md) | [SECURITY.md](SECURITY.md)

### Client Confidentiality

Queries go through the Claude API. For privileged or confidential matters, use on-premise deployment. Consult the **Colegio Público de Abogados de la Capital Federal** or the **Federación Argentina de Colegios de Abogados (FACA)** guidance on technology use in legal practice.

---

## Development

### Setup

```bash
git clone https://github.com/Ansvar-Systems/argentine-law-mcp
cd argentine-law-mcp
npm install
npm run build
npm test
```

### Running Locally

```bash
npm run dev                                       # Start MCP server
npx @anthropic/mcp-inspector node dist/index.js   # Test with MCP Inspector
```

### Data Management

```bash
npm run ingest           # Ingest leyes from InfoLEG/SAIJ
npm run build:db         # Rebuild SQLite database
npm run drift:detect     # Run drift detection against anchors
npm run check-updates    # Check for source updates
npm run census           # Generate coverage census
```

### Performance

- **Search Speed:** <100ms for most FTS5 queries
- **Database Size:** Optimized SQLite (growing)
- **Reliability:** 100% ingestion success rate

---

## Related Projects: Complete Compliance Suite

This server is part of **Ansvar's Compliance Suite** — MCP servers that work together for end-to-end compliance coverage:

### [@ansvar/eu-regulations-mcp](https://github.com/Ansvar-Systems/EU_compliance_MCP)
**Query 49 EU regulations directly from Claude** — GDPR, AI Act, DORA, NIS2, MiFID II, eIDAS, and more. Full regulatory text with article-level search. `npx @ansvar/eu-regulations-mcp`

### @ansvar/argentine-law-mcp (This Project)
**Query Argentine federal legislation directly from Claude** — Ley 25.326, Código Penal, CCyCN, and more. Full provision text with EU adequacy cross-references. `npx @ansvar/argentine-law-mcp`

### [@ansvar/us-regulations-mcp](https://github.com/Ansvar-Systems/US_Compliance_MCP)
**Query US federal and state compliance laws** — HIPAA, CCPA, SOX, GLBA, FERPA, and more. `npx @ansvar/us-regulations-mcp`

### [@ansvar/security-controls-mcp](https://github.com/Ansvar-Systems/security-controls-mcp)
**Query 261 security frameworks** — ISO 27001, NIST CSF, SOC 2, CIS Controls, SCF, and more. `npx @ansvar/security-controls-mcp`

**70+ national law MCPs** covering Australia, Brazil, Canada, Chile, Colombia, Denmark, Finland, France, Germany, Ireland, Italy, Japan, Mexico, Netherlands, Norway, Portugal, Singapore, Spain, Sweden, Switzerland, UAE, UK, and more.

---

## Contributing

Contributions welcome! See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

Priority areas:
- InfoLEG full corpus ingestion (leyes nacionales)
- SAIJ jurisprudencia coverage
- AAIP guidance documents and resolutions
- Reglamentos and decretos
- Historical ley versions and amendment tracking

---

## Roadmap

- [x] Core MCP server architecture with FTS5 search
- [x] EU/international law alignment tools (adequacy-aware)
- [x] Vercel Streamable HTTP deployment
- [x] npm package publication
- [ ] Full InfoLEG corpus ingestion (22,800+ leyes nacionales)
- [ ] SAIJ jurisprudencia coverage
- [ ] AAIP guidance documents
- [ ] Amendment tracking and historical versions
- [ ] Reglamentos and decretos reglamentarios

---

## Citation

If you use this MCP server in academic research:

```bibtex
@software{argentine_law_mcp_2026,
  author = {Ansvar Systems AB},
  title = {Argentine Law MCP Server: AI-Powered Legal Research Tool},
  year = {2026},
  url = {https://github.com/Ansvar-Systems/argentine-law-mcp},
  note = {Argentine federal law database with EU adequacy cross-references}
}
```

---

## License

Apache License 2.0. See [LICENSE](./LICENSE) for details.

### Data Licenses

- **Leyes Nacionales:** Ministerio de Justicia y Derechos Humanos de la Nación (public domain)
- **EU Metadata:** EUR-Lex (EU public domain)

---

## About Ansvar Systems

We build AI-accelerated compliance and legal research tools for the global market. This MCP server is part of our mission to make legal research accessible across jurisdictions — covering the full Americas alongside our European fleet.

So we're open-sourcing it. Navigating Argentina's legislative corpus shouldn't require a law degree.

**[ansvar.eu](https://ansvar.eu)** -- Stockholm, Sweden

---

<p align="center">
  <sub>Built with care in Stockholm, Sweden</sub>
</p>
