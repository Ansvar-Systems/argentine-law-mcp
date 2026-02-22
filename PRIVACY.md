# Privacy & Client Confidentiality / Privacidad y confidencialidad

**IMPORTANT READING FOR LEGAL PROFESSIONALS**
**LECTURA IMPORTANTE PARA PROFESIONALES DEL DERECHO**

This document addresses privacy and confidentiality considerations when using this Tool, with particular attention to professional obligations under Argentine bar association rules.

---

## Executive Summary

**Key Risks:**
- Queries through Claude API flow via Anthropic cloud infrastructure
- Query content may reveal client matters and privileged information
- CPACF and Federación Argentina de Colegios de Abogados rules require strict confidentiality controls

**Safe Use Options:**
1. **General Legal Research**: Use Tool for non-client-specific queries
2. **Local npm Package**: Install `@ansvar/argentine-law-mcp` locally — database queries stay on your machine
3. **Remote Endpoint**: Vercel Streamable HTTP endpoint — queries transit Vercel infrastructure
4. **On-Premise Deployment**: Self-host with local LLM for privileged matters

---

## Data Flows and Infrastructure

### MCP (Model Context Protocol) Architecture

This Tool uses the **Model Context Protocol (MCP)** to communicate with AI clients:

```
User Query -> MCP Client (Claude Desktop/Cursor/API) -> Anthropic Cloud -> MCP Server -> Database
```

### Deployment Options

#### 1. Local npm Package (Most Private)

```bash
npx @ansvar/argentine-law-mcp
```

- Database is local SQLite file on your machine
- No data transmitted to external servers (except to AI client for LLM processing)
- Full control over data at rest

#### 2. Remote Endpoint (Vercel)

```
Endpoint: https://argentine-law-mcp.vercel.app/mcp
```

- Queries transit Vercel infrastructure
- Tool responses return through the same path
- Subject to Vercel's privacy policy

### What Gets Transmitted

When you use this Tool through an AI client:

- **Query Text**: Your search queries and tool parameters
- **Tool Responses**: Statute text, provision content, search results
- **Metadata**: Timestamps, request identifiers

**What Does NOT Get Transmitted:**
- Files on your computer
- Your full conversation history (depends on AI client configuration)

---

## Professional Obligations (Argentina)

### Argentine Bar Association Rules

Argentine lawyers (abogados) are bound by strict confidentiality rules under the Argentine Code of Legal Ethics and the rules of the Colegio Público de Abogados de la Capital Federal (CPACF) and provincial bar associations (colegios de abogados).

#### Secreto profesional

- All client communications are privileged under Argentine law (Articles 156, 244 of the Argentine Penal Code)
- Client identity may be confidential in sensitive matters
- Case strategy and legal analysis are protected by professional secrecy
- Information that could identify clients or matters must be safeguarded
- Breach of professional secrecy is a criminal offense (violación del secreto profesional)

### Ley de Protección de Datos Personales (Ley 25.326) and Client Data Processing

Under **Ley 25.326 (Personal Data Protection Law)** and its regulatory decree, when using services that process client data:

- You are the **Data Controller** (responsable de la base de datos)
- AI service providers (Anthropic, Vercel) may be **Data Processors** (cesionarios/encargados del tratamiento)
- Registration with the **AAIP** (Agencia de Acceso a la Información Pública) may be required
- Ensure adequate technical and organizational measures
- International data transfers require that the recipient country provides an adequate level of data protection or that specific consent is obtained

---

## Risk Assessment by Use Case

### LOW RISK: General Legal Research

**Safe to use through any deployment:**

```
Example: "What does the Argentine Civil and Commercial Code say about contract formation?"
```

- No client identity involved
- No case-specific facts
- Publicly available legal information

### MEDIUM RISK: Anonymized Queries

**Use with caution:**

```
Example: "What are the penalties for securities fraud under Argentine law?"
```

- Query pattern may reveal you are working on a securities fraud matter
- Anthropic/Vercel logs may link queries to your API key

### HIGH RISK: Client-Specific Queries

**DO NOT USE through cloud AI services:**

- Remove ALL identifying details
- Use the local npm package with a self-hosted LLM
- Or use commercial legal databases with proper data processing agreements

---

## Data Collection by This Tool

### What This Tool Collects

**Nothing.** This Tool:

- Does NOT log queries
- Does NOT store user data
- Does NOT track usage
- Does NOT use analytics
- Does NOT set cookies

The database is read-only. No user data is written to disk.

### What Third Parties May Collect

- **Anthropic** (if using Claude): Subject to [Anthropic Privacy Policy](https://www.anthropic.com/legal/privacy)
- **Vercel** (if using remote endpoint): Subject to [Vercel Privacy Policy](https://vercel.com/legal/privacy-policy)

---

## Recommendations

### For Solo Practitioners / Small Firms

1. Use local npm package for maximum privacy
2. General research: Cloud AI is acceptable for non-client queries
3. Client matters: Use commercial legal databases (Thomson Reuters La Ley, Abeledo Perrot, Microjuris)

### For Large Firms / Corporate Legal

1. Negotiate data processing agreements with AI service providers
2. Consider on-premise deployment with self-hosted LLM
3. Train staff on safe vs. unsafe query patterns
4. Register data processing activities with AAIP as required

### For Government / Public Sector

1. Use self-hosted deployment, no external APIs
2. Follow Argentine government data security requirements
3. Air-gapped option available for classified matters

---

## Questions and Support

- **Privacy Questions**: Open issue on [GitHub](https://github.com/Ansvar-Systems/argentine-law-mcp/issues)
- **Anthropic Privacy**: Contact privacy@anthropic.com
- **Argentine Bar Guidance**: Consult the CPACF or the Federación Argentina de Colegios de Abogados ethics guidance
- **AAIP**: Contact the Agencia de Acceso a la Información Pública for data protection matters

---

**Last Updated**: 2026-02-22
**Tool Version**: 1.0.0
