# Graph Report - polimi-energy-app  (2026-11-16)

## Corpus Check
- 42 files · ~157,266 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: (none) 3, .cff 1, .toml 1)

## Summary
- 442 nodes · 1045 edges · 20 communities (18 shown, 2 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- BEM Architecture, Stages & Standards
- Package Manifest & Browser Entry
- Climate Panels & EPW Map
- Clima Studio Sub-Tabs
- Design Context & Eurocode Results
- Stage 1 Climate & Morphing
- 3D Cross-Section & Material Datasets
- Eurocode Studio & Design Basis
- EPW Parser & Solar Analytics
- Eurocode Member Calculators
- UTCI Core Physics Engine
- TypeScript Compiler Config
- Eurocode Guide & Structural Report
- Climate Presets & Envelope Materials
- UTCI Scenarios & CSV/SVG Export
- 3D Structural Bay Viewer
- Vercel Deployment Config
- Psychrometric Polygons & Passive Strategies

## God Nodes (most connected - your core abstractions)
1. `Stage1Climate()` - 30 edges
2. `StructuralEurocodeStudio()` - 26 edges
3. `react` - 24 edges
4. `useDesignProject()` - 23 edges
5. `lucide-react` - 22 edges
6. `StudioWorkspace()` - 20 edges
7. `parseEpwText()` - 15 edges
8. `compilerOptions` - 14 edges
9. `ClimateDataset` - 13 edges
10. `generateOptioneeringMatrix()` - 13 edges

## Surprising Connections (you probably didn't know these)
- `Belcher-Hakimian-Powell Climate Morphing & DPR 412/93` --implements--> `morphClimateDataset()`  [EXTRACTED]
  docs/standards-traceability.md → src/utils/epwParser.ts
- `EN 15978:2011 & EU Level(s) Whole-Life Carbon LCA` --conceptually_related_to--> `computeStructuralBoQ()`  [INFERRED]
  docs/standards-traceability.md → src/utils/eurocodeCalculators.ts
- `UTCI (Broede et al., 2012) & CBE Clima Scenarios` --implements--> `calcUtciForScenario()`  [EXTRACTED]
  docs/standards-traceability.md → src/utils/utciEngine.ts
- `UTCI (Broede et al., 2012) & CBE Clima Scenarios` --references--> `Stage1Climate()`  [EXTRACTED]
  docs/standards-traceability.md → src/components/Stage1Climate.tsx
- `ASHRAE Standard 209 Thermal Zoning & Cycles` --references--> `Stage3FormZoning()`  [EXTRACTED]
  docs/standards-traceability.md → src/components/Stage3FormZoning.tsx

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **Six-Stage Multi-Scale BEM & LCA Pipeline** — src_components_stage1climate_stage1climate, src_components_stage2urban_stage2urban, src_components_stage3formzoning_stage3formzoning, src_components_stage4facadefabric_stage4facadefabric, src_components_stage5energycomfort_stage5energycomfort, src_components_stage6lca_stage6lca, src_context_designprojectcontext_designprojectprovider [EXTRACTED 1.00]
- **Structural Eurocode Pre-Dimensioning & Embodied Carbon Chain** — docs_standards_eurocodes_0_to_8, src_data_eurocodedataset, src_utils_eurocodecalculators_computestructuralboq, src_components_structuraleurocodestudio_structuraleurocodestudio, src_components_stage6lca_stage6lca [EXTRACTED 1.00]

## Communities (20 total, 2 thin omitted)

### Community 0 - "BEM Architecture, Stages & Standards"
Cohesion: 0.05
Nodes (73): Architecture Overview (docs/architecture-overview.md), Graphify Knowledge Graph & Docs Workflow, Research Papers & Reference Spreadsheets Corpus, ASHRAE Standard 209 Thermal Zoning & Cycles, ASHRAE 55-2023 & EN 16798-1:2019 Adaptive Comfort, EN 15978:2011 & EU Level(s) Whole-Life Carbon LCA, EnergyPlus IDF (v24.1) & gbXML Interoperability, ISO 6946, ISO 13786 & ISO 13788 Envelope Physics (+65 more)

### Community 1 - "Package Manifest & Browser Entry"
Cohesion: 0.06
Nodes (45): index.html Browser Entry Point, author, contributors, dependencies, leaflet@^1.9.4, lucide-react@^0.475.0, react@^18.3.1, react-dom@^18.3.1 (+37 more)

### Community 2 - "Climate Panels & EPW Map"
Cohesion: 0.10
Nodes (45): CbeClimaExplorerTab(), ClimaTabProps, EpwSearchAndUploadWidget(), EpwWidgetProps, MONTHS, ParetoPanelProps, SavedScenarioItem, calcCompassBearing() (+37 more)

### Community 3 - "Clima Studio Sub-Tabs"
Cohesion: 0.09
Nodes (27): CarpetHeatmap24x365(), CarpetHeatmapProps, CBE_NATVENT_GRADIENT_CSS, CBE_UTCI_10BAND_GRADIENT_CSS, CBE_WIND_DIR_GRADIENT_CSS, CBE_WIND_SPEED_GRADIENT_CSS, ClimaChartCardProps, ClimaTooltipCtx (+19 more)

### Community 4 - "Design Context & Eurocode Results"
Cohesion: 0.08
Nodes (25): DesignProjectContextValue, BisectionIterationResult, BucklingCurvePoint, calcDesignSpectrumSd(), calcElasticSpectrumSe(), CltSlabResult, CltWallResult, computeEurocode8SeismicActions() (+17 more)

### Community 5 - "Stage 1 Climate & Morphing"
Cohesion: 0.14
Nodes (24): UTCI (Broede et al., 2012) & CBE Clima Scenarios, Belcher-Hakimian-Powell Climate Morphing & DPR 412/93, CBE_RDYLBU_R_GRADIENT_CSS, CBE_YLGNBU_GRADIENT_CSS, extractVar(), SubTab7NatVent(), SubTab9DataExplorer(), CLIMA_SUB_TABS (+16 more)

### Community 6 - "3D Cross-Section & Material Datasets"
Cohesion: 0.11
Nodes (22): CrossSection3DViewer(), CrossSection3DViewerProps, ViewMode, SelectedMemberType, CONCRETE_CLASSES, ConcreteClassData, EMBODIED_CARBON_FACTORS, MASONRY_GROUPS (+14 more)

### Community 7 - "Eurocode Studio & Design Basis"
Cohesion: 0.09
Nodes (23): MEMBER_SCOPE_NOTES, StructuralEurocodeStudioProps, TimberLoadDuration, BuildingImportanceClass, CltSlabInputs, CltWallInputs, DEFAULT_DESIGN_BASIS, DuctilityClass (+15 more)

### Community 8 - "EPW Parser & Solar Analytics"
Cohesion: 0.10
Nodes (22): AnnualNocturnalCoolingSummary, BioclimaticPolygonDef, calcAnnualNocturnalCoolingSummary(), calcNocturnalRadiativeCooling(), calcPerezDiffuseTilted(), calcSolarBoxplotsAndFacadeRose(), calcTotalTiltedIrradiance(), DailyRunningMeanRecord (+14 more)

### Community 9 - "Eurocode Member Calculators"
Cohesion: 0.22
Nodes (18): Structural Eurocodes (EN 1990-1998) & PoliMI Predimensioning Workbook, StructuralEurocodeStudio(), calcCltSlab(), calcCltWall(), calcMasonryWall(), calcRcBeam(), calcRcColumn(), calcRcSlab() (+10 more)

### Community 10 - "UTCI Core Physics Engine"
Cohesion: 0.14
Nodes (17): AllUtciScenariosSummary, ALT_RANGE, AZ_RANGE, calcSolarGainMrtDelta(), calcUtci(), calcUtciPolynomial(), calcVaporPressureKpa(), CBE_UTCI_BLUE_RED_YELLOW_GRADIENT_CSS (+9 more)

### Community 11 - "TypeScript Compiler Config"
Cohesion: 0.12
Nodes (15): compilerOptions, allowJs, esModuleInterop, isolatedModules, jsx, lib, module, moduleResolution (+7 more)

### Community 12 - "Eurocode Guide & Structural Report"
Cohesion: 0.24
Nodes (10): EurocodeGuideModal(), EurocodeGuideModalProps, ProjectMetadata, StructuralReportModal(), StructuralReportModalProps, NationalAnnexId, CalculationRow, EurocodeStatus (+2 more)

### Community 13 - "Climate Presets & Envelope Materials"
Cohesion: 0.18
Nodes (11): CLIMATE_SCOUT_STRATEGIES, ClimateScoutStrategy, DEFAULT_CLIMATE_DATASET, ENVELOPE_MATERIALS, EnvelopeMaterialSpec, formatKoppen(), getKoppenDescription(), INITIAL_CLIMATE_PRESETS (+3 more)

### Community 14 - "UTCI Scenarios & CSV/SVG Export"
Cohesion: 0.36
Nodes (8): ClimaChartCard(), SubTab8Utci(), exportDataToCsvFile(), exportSvgNodeToFile(), calcAllUtciScenariosSummary(), calcUtciScenarioDataset(), colorForUtciContinuous(), getUtciStressCategory()

### Community 15 - "3D Structural Bay Viewer"
Cohesion: 0.53
Nodes (5): getAvailableMembersForSystem(), getMemberDisplayName(), StructuralBay3DViewer(), StructuralBay3DViewerProps, StructuralBayConfig

### Community 16 - "Vercel Deployment Config"
Cohesion: 0.33
Nodes (5): buildCommand, framework, headers, outputDirectory, rewrites

### Community 17 - "Psychrometric Polygons & Passive Strategies"
Cohesion: 0.50
Nodes (5): SubTab6Psychrometric(), scoreStrategyRelevance(), evaluatePsychrometricPolygons(), getBioclimaticPolygons(), pointInPolygon()

## Knowledge Gaps
- **2 isolated node(s):** `Research Papers & Reference Spreadsheets Corpus`, `index.html Browser Entry Point`
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 144 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **2 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react` connect `BEM Architecture, Stages & Standards` to `Package Manifest & Browser Entry`, `Climate Panels & EPW Map`, `Clima Studio Sub-Tabs`, `Stage 1 Climate & Morphing`, `3D Cross-Section & Material Datasets`, `Eurocode Studio & Design Basis`, `Eurocode Guide & Structural Report`, `3D Structural Bay Viewer`?**
  _High betweenness centrality (0.141) - this node is a cross-community bridge._
- **What connects `Research Papers & Reference Spreadsheets Corpus`, `index.html Browser Entry Point` to the rest of the system?**
  _2 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `BEM Architecture, Stages & Standards` be split into smaller, more focused modules?**
  _Cohesion score 0.05368289637952559 - nodes in this community are weakly interconnected._
- **Why does `lucide-react` connect `BEM Architecture, Stages & Standards` to `Package Manifest & Browser Entry`, `Climate Panels & EPW Map`, `Clima Studio Sub-Tabs`, `Stage 1 Climate & Morphing`, `3D Cross-Section & Material Datasets`, `Eurocode Studio & Design Basis`, `Eurocode Guide & Structural Report`, `3D Structural Bay Viewer`?**
  _High betweenness centrality (0.116) - this node is a cross-community bridge._
- **Should `Package Manifest & Browser Entry` be split into smaller, more focused modules?**
  _Cohesion score 0.05697278911564626 - nodes in this community are weakly interconnected._
- **Why does `useDesignProject()` connect `BEM Architecture, Stages & Standards` to `Eurocode Member Calculators`, `Stage 1 Climate & Morphing`, `Eurocode Studio & Design Basis`?**
  _High betweenness centrality (0.021) - this node is a cross-community bridge._
- **Should `Climate Panels & EPW Map` be split into smaller, more focused modules?**
  _Cohesion score 0.0977891156462585 - nodes in this community are weakly interconnected._