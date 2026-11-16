# UTCI Scenarios & CSV/SVG Export

> 8 nodes · cohesion 0.36

## Key Concepts

- **ClimaChartCard()** (10 connections) — `src/components/ClimaStudioSubTabs.tsx`
- **SubTab8Utci()** (10 connections) — `src/components/ClimaStudioSubTabs.tsx`
- **calcUtciScenarioDataset()** (7 connections) — `src/utils/utciEngine.ts`
- **exportDataToCsvFile()** (6 connections) — `src/utils/epwParser.ts`
- **colorForUtciContinuous()** (6 connections) — `src/utils/utciEngine.ts`
- **calcAllUtciScenariosSummary()** (5 connections) — `src/utils/utciEngine.ts`
- **getUtciStressCategory()** (5 connections) — `src/utils/utciEngine.ts`
- **exportSvgNodeToFile()** (3 connections) — `src/utils/epwParser.ts`

## Relationships

- [Clima Studio Sub-Tabs](Clima_Studio_Sub-Tabs.md) (10 shared connections)
- [Stage 1 Climate & Morphing](Stage_1_Climate_&_Morphing.md) (10 shared connections)
- [EPW Parser & Solar Analytics](EPW_Parser_&_Solar_Analytics.md) (6 shared connections)
- [UTCI Core Physics Engine](UTCI_Core_Physics_Engine.md) (4 shared connections)
- [Psychrometric Polygons & Passive Strategies](Psychrometric_Polygons_&_Passive_Strategies.md) (1 shared connections)
- [Climate Panels & EPW Map](Climate_Panels_&_EPW_Map.md) (1 shared connections)

## Source Files

- `src/components/ClimaStudioSubTabs.tsx`
- `src/utils/epwParser.ts`
- `src/utils/utciEngine.ts`

## Audit Trail

- EXTRACTED: 42 (100%)
- INFERRED: 0 (0%)
- AMBIGUOUS: 0 (0%)

---

*Part of the graphify knowledge wiki. See [index](index.md) to navigate.*