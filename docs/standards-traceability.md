# Engineering Standards & Scientific Traceability Matrix

This document links the international and Italian engineering standards referenced in `README.md` and source headers to their TypeScript implementation modules in `polimi-energy-app`. When Graphify parses both `docs/` and `src/`, it bridges conceptual standards nodes to concrete AST code symbols.

---

## 1. Climate, Microclimate & Outdoor Thermal Comfort

| Standard / Reference | Scope in Platform | Implementation Files & Key Symbols |
| :--- | :--- | :--- |
| **UTCI (Bröde et al., 2012) / pythermalcomfort / CBE Clima** | Universal Thermal Climate Index across four microclimate exposure scenarios (`sun_wind`, `nosun_wind`, `sun_nowind`, `nosun_nowind`) | `src/utils/utciEngine.ts` (`UTCI_SCENARIOS`, `calcUtciForScenario`, `calcUtci`, `getUtciStressCategory`), `src/utils/epwParser.ts`, `src/components/Stage1Climate.tsx`, `src/components/ClimaStudioSubTabs.tsx` |
| **Köppen–Geiger Climate Classification** | Climate zone classification & descriptions | `src/data/climateAndStrategies.ts` (`KOPPEN_DESCRIPTIONS`, `getKoppenDescription`, `formatKoppen`) |
| **ASHRAE Standard 55-2023 & EN 16798-1:2019** | Adaptive comfort running-mean outdoor temperature, acceptability limits & indoor PMV/adaptive modes | `src/components/Stage1Climate.tsx`, `src/utils/epwParser.ts` (`calcDailyTempAndRunningMean`), `src/components/Stage5EnergyComfort.tsx` |
| **Belcher–Hakimian–Powell Weather Morphing** | Future climate scenario diurnal morphing | `src/utils/epwParser.ts` (`morphClimateDataset`), `src/context/DesignProjectContext.tsx` |
| **D.P.R. 412/93** | Italian heating degree days & climatic zoning | `src/components/Stage1Climate.tsx`, `src/utils/epwParser.ts` (`calcCustomDegreeDays`) |

---

## 2. Building Form, Envelope & Dynamic Thermal Physics

| Standard / Reference | Scope in Platform | Implementation Files & Key Symbols |
| :--- | :--- | :--- |
| **ASHRAE Standard 209 (Cycles #1, #2, #4)** | Simple box massing, 5-zone thermal zoning (`South`, `North`, `East`, `West`, `Core`) & iterative energy modeling workflow | `src/context/DesignProjectContext.tsx` (`ThermalZoneName`), `src/components/Stage3FormZoning.tsx`, `src/components/Stage5EnergyComfort.tsx` |
| **ISO 6946:2017** | Multi-layer opaque assembly thermal resistance and U-value | `src/context/DesignProjectContext.tsx`, `src/components/Stage4FacadeFabric.tsx` |
| **ISO 13786:2017 (Annex C Complex Matrix Solver)** | Exact 2×2 complex transmission matrix for periodic thermal transmittance (`yIe`), decrement factor, time shift, and areal heat capacities (`kappaI`, `kappaE`) | `src/context/DesignProjectContext.tsx` (`solveIso13786Matrix`, `Iso13786Result`) |
| **ISO 13788:2012** | Glaser interstitial condensation vapor pressure assessment | `src/components/Stage4FacadeFabric.tsx` |

---

## 3. Energy Balance, HVAC & NZEB Compliance

| Standard / Reference | Scope in Platform | Implementation Files & Key Symbols |
| :--- | :--- | :--- |
| **ISO 52000-1:2017 / ISO 13790 / ISO 52016-1 / CIBSE TM54** | Quasi-steady-state monthly energy balance and 8,760-hour 2R1C lumped-parameter thermal network | `src/context/DesignProjectContext.tsx`, `src/components/Stage5EnergyComfort.tsx`, `src/components/HourlySimulationTab.tsx` (`HourlySimResult`) |
| **UNI/TS 11300 (Parts 1–4) & Italian D.M. 26/06/2015** | Italian NZEB (*Requisiti Minimi*) & EU EPBD targets | `src/context/DesignProjectContext.tsx` (`LegislativeTargetType`), `src/components/Stage5EnergyComfort.tsx` |
| **VDI 4640** | Ground-source heat pump (GSHP) vertical borehole field sizing | `src/components/AdvancedHvacRenewableModal.tsx` |
| **EnergyPlus IDF (v24.1) & gbXML** | Interoperable BEM export for downstream simulation tools | `src/utils/bldExportEngine.ts` (`generateEnergyPlusIdf`, `generateGbXml`, `generateSimulationCsv`) |

---

## 4. Whole-Life Carbon LCA & Structural Eurocodes

| Standard / Reference | Scope in Platform | Implementation Files & Key Symbols |
| :--- | :--- | :--- |
| **EN 15978:2011 & EU Level(s)** | Whole-life carbon modules (A1–A3, A4–A5, B1–B5, B6, C1–C4, D) and 5Rs circularity | `src/components/Stage6LCA.tsx`, `src/context/DesignProjectContext.tsx` |
| **Eurocode 0 (EN 1990) & Eurocode 1 (EN 1991-1-1, -1-3, -1-4, -1-5)** | Partial safety factors, occupancy live loads, snow, wind & thermal actions | `src/utils/eurocodeCalculators.ts` (`SharedDesignBasis`, `DEFAULT_DESIGN_BASIS`, `computeTributaryLoadTakedown`), `src/data/eurocodeDataset.ts` (`NATIONAL_ANNEX_PRESETS`, `OCCUPANCY_LOAD_PRESETS`) |
| **Eurocode 2 (EN 1992-1-1)** | Reinforced concrete strength classes and M–N interaction curves | `src/data/eurocodeDataset.ts` (`CONCRETE_CLASSES`), `src/utils/eurocodeCalculators.ts` (`generateRcInteractionCurve`), `src/components/CrossSection3DViewer.tsx` |
| **Eurocode 3 (EN 1993-1-1)** | Structural steel profiles and buckling verification curves | `src/data/eurocodeDataset.ts` (`STEEL_PROFILES`), `src/utils/eurocodeCalculators.ts` (`generateBucklingCurves`) |
| **Eurocode 5 (EN 1995-1-1) & EN 338 / EN 14080** | Timber/Glulam strength classes, `kmod` duration factors & `kdef` creep factors | `src/data/eurocodeDataset.ts` (`TIMBER_CLASSES`, `TIMBER_KMOD`, `TIMBER_KDEF`), `src/components/StructuralEurocodeStudio.tsx` |
| **Eurocode 6 (EN 1996-1-1)** | Masonry groups and structural pre-dimensioning | `src/data/eurocodeDataset.ts` (`MASONRY_GROUPS`), `src/utils/eurocodeCalculators.ts` |
| **Eurocode 8 (EN 1998)** | Seismic ground types, importance factors, design/elastic spectra & storey seismic forces | `src/utils/eurocodeCalculators.ts` (`GROUND_TYPE_TABLE`, `IMPORTANCE_FACTORS`, `calcDesignSpectrumSd`, `calcElasticSpectrumSe`, `computeEurocode8SeismicActions`) |
| **PoliMI Structural Reference Workbook** | `BT_AY26-27_Structural_Predimensioning_Eurocodes_EN.xlsx` (11 member calculators & structural BoQ) | `src/utils/eurocodeCalculators.ts` (`computeStructuralBoQ`), `src/components/StructuralEurocodeStudio.tsx`, `src/components/StructuralBay3DViewer.tsx` |
