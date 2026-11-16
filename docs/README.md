# PoliMI Early-Stage BEM & Sustainability Studio — Knowledge Graph & Docs Guide

This `docs/` directory anchors architectural documentation, standards traceability, and research references so **[Graphify](https://github.com/Graphify-Labs/graphify)** can build a unified knowledge graph connecting:
- TypeScript / TSX implementation modules in `src/` (deterministic `tree-sitter` AST graph), and
- Scientific standards, methodology notes, and reference PDFs/spreadsheets in `docs/` (semantic + cross-reference graph).

---

## Quick Graphify Commands (Windows PowerShell)

All Graphify outputs are written to `graphify-out/` (gitignored via `.gitignore`). Excluded large static datasets (`public/weather/`, `public/epwmap-catalog.json`, `public/world-countries.geojson`, `dist/`, `node_modules/`) are configured in `.graphifyignore`.

```powershell
# 1. Incremental AST + docs rebuild (AST code updates require no LLM API cost)
graphify update .

# 2. Query the graph instead of reading large TSX/TS files directly
graphify query "How does DesignProjectContext feed Stage5EnergyComfort and Stage6LCA?"
graphify path "solveIso13786Matrix" "Stage4FacadeFabric"
graphify explain "computeStructuralBoQ"
graphify god-nodes

# 3. Export shareable visual & documentation deliverables (into graphify-out/)
graphify export html
graphify export callflow-html
graphify export wiki
graphify tree

# 4. Watch mode during active refactoring
graphify watch .
```

---

## Directory Layout

- [architecture-overview.md](./architecture-overview.md) — Module topology across `src/App.tsx`, `DesignProjectContext.tsx`, Stages 1–6, Eurocode studio, 3D WebGL/Leaflet viewers, and calculation engines.
- [standards-traceability.md](./standards-traceability.md) — Mapping between international/Italian standards (ISO, EN, UNI/TS, ASHRAE, UTCI, Eurocodes) and the source files implementing them.
- [references/README.md](./references/README.md) — Instructions for adding thesis PDFs, journal papers, or reference spreadsheets (`BT_AY26-27_Structural_Predimensioning_Eurocodes_EN.xlsx`) into the knowledge graph.
