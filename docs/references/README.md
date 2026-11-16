# Research Papers, Standards PDFs & Reference Spreadsheets

Drop academic PDFs, standard excerpts, thesis drafts, or reference Excel files (for example, `BT_AY26-27_Structural_Predimensioning_Eurocodes_EN.xlsx`) into this folder to incorporate them into the Graphify knowledge graph.

## Workflow

1. Place `.pdf`, `.md`, `.docx`, `.xlsx`, or diagram images (`.png`, `.jpg`) inside `docs/references/`.
2. Run an incremental update:
   ```powershell
   graphify update .
   ```
   Or invoke `/graphify ./docs --mode deep` inside Antigravity to extract semantic concept nodes and `INFERRED` / `cites` / `implements` links connecting these references to `src/` modules.
3. Inspect cross-document links in `graphify-out/GRAPH_REPORT.md` or `graphify-out/graph.html`.

> **Copyright note**: If you place copyrighted ISO/EN/ASHRAE standard PDFs here locally, add `docs/references/*.pdf` (or `docs/references/*.xlsx`) to `.gitignore` before committing so restricted documents stay local while still being indexed by Graphify.
