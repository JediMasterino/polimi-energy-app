# Architecture Overview (`polimi-energy-app`)

## Application Entry & State Spine

- **Mount & Root Shell**: `src/main.tsx` mounts `src/App.tsx` inside `React.StrictMode` with Leaflet CSS and Tailwind CSS (`src/index.css`).
- **Central Reactive Engine**: `src/context/DesignProjectContext.tsx` provides `DesignProjectProvider` and `useDesignProject`, coordinating building geometry, urban context, envelope layers (`solveIso13786Matrix`), thermal zones (`South`, `North`, `East`, `West`, `Core`), HVAC/renewables, whole-life carbon LCA, structural BoQ (`computeStructuralBoQ`), legislative targets (`nZEB_Italy_DM2015`, `EU_EPBD_2030_ZEB`, `Passivhaus`, `LEED_Platinum`), and saved comparison scenarios.

---

## Multi-Stage Simulation UI (`src/components/`)

| Stage / Studio | Component | Primary Responsibility |
| :--- | :--- | :--- |
| **Stage 1** | `src/components/Stage1Climate.tsx`, `ClimaStudioSubTabs.tsx`, `ClimaAndAdvancedPanels.tsx`, `EpwInteractiveMap.tsx` | Global weather station catalog map (Leaflet), EPW/ZIP import & validation, UTCI, adaptive comfort, wind rose, solar path, radiation rose, degree days |
| **Stage 2** | `src/components/Stage2Urban.tsx`, `Urban3DViewer.tsx` | Urban canyon geometry, Sky View Factor (SVF), UHI microclimate offset, 2.5D/3D Three.js solar shading context |
| **Stage 3** | `src/components/Stage3FormZoning.tsx`, `Urban3DViewer.tsx` | Building typology presets, massing, 5-zone ASHRAE 209 perimeter/core zoning |
| **Stage 4** | `src/components/Stage4FacadeFabric.tsx` | Orientation-specific WWR, glazing/shading libraries, multi-layer opaque wall assembly, ISO 13786 inertia |
| **Stage 5** | `src/components/Stage5EnergyComfort.tsx`, `HourlySimulationTab.tsx`, `AdvancedHvacRenewableModal.tsx` | Monthly ISO 52000-1 / CIBSE TM54 balance, 8,760-hour 2R1C dynamic simulation & carpet heatmap, ASHP/GSHP/PV/BESS sizing |
| **Stage 6** | `src/components/Stage6LCA.tsx` | Whole-life carbon LCA (Modules A1–A5, B1–B6, C1–C4, D), 5Rs circularity, structural system carbon comparison via `computeStructuralBoQ` |
| **Structural Studio** | `src/components/StructuralEurocodeStudio.tsx`, `StructuralBay3DViewer.tsx`, `CrossSection3DViewer.tsx`, `EurocodeGuideModal.tsx`, `StructuralReportModal.tsx` | Eurocode (EN 1990–1996) pre-dimensioning studio, tributary load takedown, 3D structural bay & 2D/3D cross-section viewers |
| **Multi-Objective** | `src/components/ParetoExplorerModal.tsx` | 48-configuration Pareto frontier exploration across Operational EUI, Embodied Carbon, Capital Cost, and Daylight Autonomy |

---

## Physics, Climate, Structural & Export Engines (`src/utils/` & `src/data/`)

- **Weather & Solar Physics**: `src/utils/epwEngine.ts` (`ClimateDataset`, `HourlyWeatherRecord`, `parseEpwText`, `extractEpwFromZipBuffer`, `exportDatasetToEpw`, `calcSolarPosition`, `calcHumidityRatio`, `buildClimateFromHourly`).
- **EPW Quality, Morphing & Clima Analytics**: `src/utils/epwParser.ts` (`validateEpwDataset`, `parseEpwFileWithQuality`, `morphClimateDataset`, `calcCustomDegreeDays`, `calcMonthlyDiurnalProfiles`, `calcSolarBoxplotsAndFacadeRose`, `calcFacadeShadingRadiationBreakdown`).
- **Outdoor Thermal Comfort**: `src/utils/utciEngine.ts` (`UTCI_SCENARIOS`, `calcUtciForScenario`, `calcUtci`, `calcUtciScenarioDataset`, `getUtciStressCategory`).
- **Structural Pre-Dimensioning**: `src/utils/eurocodeCalculators.ts` (`SharedDesignBasis`, `StructuralBayConfig`, `computeTributaryLoadTakedown`, `computeStructuralBoQ`, `generateRcInteractionCurve`, `generateBucklingCurves`) backed by `src/data/eurocodeDataset.ts` (`CONCRETE_CLASSES`, `TIMBER_CLASSES`, `TIMBER_KMOD`, `TIMBER_KDEF`, `STEEL_PROFILES`, `MASONRY_GROUPS`, `NATIONAL_ANNEX_PRESETS`).
- **Climate & Material Libraries**: `src/data/climateAndStrategies.ts` (`KOPPEN_DESCRIPTIONS`, `DEFAULT_CLIMATE_DATASET`, `CLIMATE_SCOUT_STRATEGIES`, `ENVELOPE_MATERIALS`) and `src/data/componentLibraries.ts` (`GLAZING_LIBRARY`, `SHADING_LIBRARY`).
- **Interoperability Exports**: `src/utils/bldExportEngine.ts` (`generateEnergyPlusIdf`, `generateGbXml`, `generateProjectReportHtml`, `generateSimulationCsv`, `downloadTextFile`).

---

## Legacy Root Prototype

- `polimi_early_stage_bem_sustainability_studio.tsx` is a standalone 3,005-line early prototype at the repository root. It remains listed in `tsconfig.json` (`include`) for type-checking reference, while the active Vite bundle mounts `src/main.tsx` -> `src/App.tsx`.
