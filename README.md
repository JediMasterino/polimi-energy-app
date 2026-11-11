# PoliMI Early-Stage BEM & Sustainability Studio

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](LICENSE)
![Institution](https://img.shields.io/badge/Institution-Politecnico%20di%20Milano%20(DABC)-teal.svg)
![Author](https://img.shields.io/badge/Author-Anxhelo%20Golloberda-indigo.svg)
![Supervisors](https://img.shields.io/badge/Supervisors-Prof.%20S.%20Viscuso%20%7C%20Prof.%20M.%20Manfren-blue.svg)

> **Integrated Building Energy Modeling (BEM), Climate Studio, Whole-Life Carbon LCA & Multi-Objective Architectural Optimization Platform**  
> Developed for early-stage architectural engineering, environmental design research, and building performance optimization at **Politecnico di Milano**.

---

## 🏛️ Overview

The **PoliMI Early-Stage BEM & Sustainability Studio** is a browser-based, high-performance computational platform designed for architects, environmental engineers, and researchers. It bridges the gap between schematic design intuition and rigorous physics-based building simulation by providing real-time, interactive feedback on climate, urban microclimate, building massing, facade optimization, HVAC systems, whole-life carbon (LCA), and structural sizing.

All simulations, EPW weather file decoders, psychrometric calculations, 8,760-hour hourly energy balances, and 3D WebGL visualizations run **100% client-side in the browser** with zero external backend or cloud dependencies.

---

## 🚀 Key Features & Modules

### 1. Stage 1: Climate Studio & Microclimate Analysis
*Inspired by UC Berkeley Center for the Built Environment (CBE) Clima and EnergyPlus.*
- **Interactive Global Weather Station Map**: Explore and download from over **23,227 official weather stations worldwide** (EnergyPlus DOE and OneBuilding datasets) rendered with Leaflet.
- **Client-Side EPW & ZIP Parser**: Seamless drag-and-drop parsing of raw `.epw` and compressed `.zip` weather files. Automatically decodes all 8 EPW header lines, location metadata, design conditions, ground temperatures, and 8,760 hourly data rows with data quality validation.
- **Outdoor Thermal Comfort (UTCI)**: Comprehensive Universal Thermal Climate Index (UTCI) computation based on the 6th-order polynomial approximation, computing thermal stress distributions (Extreme Cold to Extreme Heat) by month and hour.
- **Adaptive Comfort (ASHRAE 55 & EN 16798-1)**: Running mean outdoor temperature calculations, 80% and 90% acceptability limits, prevailing outdoor conditions, and natural ventilation suitability potential.
- **Interactive Psychrometric Chart**: Carrier/ASHRAE state-point plotting, dry-bulb temperature vs. humidity ratio, enthalpy lines, relative humidity curves, and Givoni bioclimatic passive design strategy overlays.
- **Wind Rose & Speed Distribution**: 16-compass-point polar wind rose, Weibull distributions, calm wind percentages, and seasonal/diurnal filtering.
- **3D Stereographic Sun Path & Shading**: Dynamic solar altitude/azimuth calculation with Equation of Time analemma figure-8 loops, summer/winter solstice arcs, and urban canyon obstruction masks.
- **Directional Vertical Facade Radiation Rose**: 8-cardinal orientation incident solar radiation comparison (Annual, Summer, Winter) with jitter-free, non-clipping hover tooltips.
- **Heating & Cooling Degree Days (HDD / CDD)**: Dynamic base-temperature slider calculations with Italian DPR 412/93 climatic zoning (Zones A through F).
- **Climate Change Morphing**: Belcher-Hakimian-Powell diurnal morphing algorithms to stress-test designs against future climate scenarios (IPCC RCP/SSP projections).

### 2. Stage 2: Urban & Site Context
- **Urban Canyon Aspect Ratio ($H/W$)**: Real-time canyon geometry modeling, Sky View Factor (SVF) calculation, and wind sheltering coefficient estimation.
- **Urban Heat Island (UHI) Microclimate Offset**: Oke (1982) and Santamouris empirical models for nocturnal canopy layer UHI intensity based on urban density, albedo, and green cover.
- **3D Urban Context Viewer**: Interactive Three.js WebGL visualization of adjacent building masses, solar envelopes, and street canyon orientation.

### 3. Stage 3: Building Form, Massing & Passive Zoning
- **Thermal Zoning (ASHRAE 209)**: Automated 5-zone model generation (North, South, East, West perimeter zones + Core zone) with standard 4.5 m (15 ft) depth.
- **Geometric Compactness**: Surface-to-Volume ratio ($S/V$), shape factor, compactness index, and envelope gross area breakdown.
- **Window-to-Wall Ratio (WWR)**: Independent orientation-specific glazing percentages, daylight penetration factor, and perimeter daylight autonomy estimation.
- **3D Architectural Massing Viewer**: Real-time WebGL building model with interactive orientation rotation, solar shadow projection, and floor plate slicing.

### 4. Stage 4: Facade Fabric & Envelope Optimization
- **Opaque Assembly Thermal Transmittance ($U$-value)**: ISO 6946 multi-layer conduction calculator with thermal bridging adjustments ($\Delta U_{tb}$).
- **Glazing Systems**: Double/triple low-E glazing, Center-of-Glass $U_g$, frame $U_f$, Solar Heat Gain Coefficient ($g$-value / SHGC), and visual light transmittance ($T_{vis}$).
- **Thermal Inertia & Decrement**: ISO 13786 periodic thermal transmittance ($Y_{ie}$), dynamic thermal mass, decrement factor ($f_d$), and time lag ($\Delta t$ in hours).
- **Glaser Condensation Risk**: Dynamic vapor pressure profile calculation across envelope strata to detect interstitial moisture risk according to ISO 13788.

### 5. Stage 5: Energy Balance & HVAC Systems
- **Quasi-Steady-State & 8,760h Energy Balance**: Based on ISO 52000-1 and Italian national standard UNI/TS 11300.
- **Heating & Cooling Demands**: Transmission losses, ventilation/infiltration sensible and latent heat loads, and internal/solar thermal heat gains.
- **HVAC Generation & Distribution**:
  - Air-source and ground-source heat pumps (ASHP / GSHP) with temperature-dependent seasonal COP/SCOP and EER/SEER curves.
  - Variable Refrigerant Flow (VRF), 4-pipe fan coils, and radiant ceiling/floor systems.
  - Mechanical Ventilation with Heat Recovery (MVHR, up to 90% sensible effectiveness).
- **On-Site Photovoltaic (PV) Simulation**: Orientation, tilt, temperature degradation coefficient, inverter efficiency, and hourly self-consumption vs. grid export balance.
- **NZEB Benchmarking**: Italian DM 26/06/2015 *"Requisiti Minimi"* and EU Energy Performance of Buildings Directive (EPBD) non-renewable primary energy rating ($EP_{gl,nren}$).

### 6. Stage 6: Whole-Life Carbon LCA & Circular Economy (5Rs)
- **Life Cycle Assessment (EN 15978 / Level(s))**:
  - **Module A1–A3**: Raw material supply, transport, and manufacturing (Upfront Embodied Carbon).
  - **Module A4–A5**: Construction process and site assembly.
  - **Module B1–B5**: In-use maintenance, repair, and component replacement.
  - **Module B6**: Operational carbon from grid electricity and fuel consumption over the building service life.
  - **Module C1–C4**: End-of-life deconstruction, demolition, waste processing, and disposal.
  - **Module D**: Circular potential, material recovery credits, and avoided future impacts.
- **5Rs Circular Economy Hierarchy**: Quantitative scoring and impact tracking for **Refuse**, **Reduce**, **Reuse**, **Repurpose**, and **Recycle**.

### 7. Structural Eurocode Studio & 3D Bay Sizer
- **Eurocodes Integration**: EC0 (Basis of Design), EC1 (Actions & Loads: dead, live, snow, wind), EC2 (Reinforced Concrete), EC3 (Structural Steel), and EC5 (Mass Timber: CLT / Glulam).
- **Structural Bay Sizing**: Analytical calculation of maximum bending moments, shear forces, deflection limits ($L/250$ to $L/400$), and structural section depths.
- **Embodied Carbon of Structural System**: Real-time comparison of mass timber vs. low-carbon steel vs. post-tensioned concrete structural frame carbon footprints ($kgCO_2e/m^2$).

### 8. Multi-Objective Optimization & Pareto Explorer
- **Interactive 3D / 2D Pareto Frontier**: Multi-objective trade-off space exploring **Operational EUI ($kWh/m^2yr$)** vs. **Embodied Carbon ($kgCO_2e/m^2$)** vs. **Capital Cost ($\text{€}/m^2$)**.
- **Automated Scenario Comparison**: Baseline vs. Current Design vs. NZEB Target vs. Best-in-Class Zero Carbon variant.

---

## 🛠️ Technology Stack

| Layer | Technology |
| :--- | :--- |
| **Framework** | [React 18](https://react.dev/) + [TypeScript 5](https://www.typescriptlang.org/) |
| **Build & Bundler** | [Vite 6](https://vitejs.dev/) |
| **Styling** | [Tailwind CSS 3](https://tailwindcss.com/) + PostCSS + Autoprefixer |
| **3D Rendering** | [Three.js](https://threejs.org/) (Custom WebGL viewports for massing, cross-sections & structural bays) |
| **Geospatial Mapping** | [Leaflet](https://leafletjs.com/) (OpenStreetMap vector tiles + GeoJSON weather station clusters) |
| **Icons & UI** | [Lucide React](https://lucide.dev/) |
| **Analytics & Telemetry** | [Vercel Analytics & Speed Insights](https://vercel.com/) |

---

## 📦 Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (version **18.0.0** or later recommended)
- `npm` (version **9.0.0** or later) or `pnpm` / `yarn`

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/YourUsername/polimi-energy-app.git
   cd polimi-energy-app
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

### Development Server

Launch the Vite local development server with Hot Module Replacement (HMR):
```bash
npm run dev
```
Open your browser at `http://localhost:5173`.

### Production Build

Type-check and compile optimized static assets for production:
```bash
npm run build
```
The output will be generated in the `dist/` directory, ready to be deployed on any static hosting platform (Vercel, Netlify, Cloudflare Pages, GitHub Pages).

### Preview Build

Preview the production build locally:
```bash
npm run preview
```

---

## 📐 Scientific & Regulatory Standards

This studio incorporates formulas, algorithms, and thresholds directly referenced from international building performance and engineering codes:

- **Thermal Comfort**:
  - *ASHRAE Standard 55-2023* — Thermal Environmental Conditions for Human Occupancy.
  - *EN 16798-1:2019* — Indoor environmental input parameters for design and assessment of energy performance of buildings.
  - *UTCI Working Group* — Universal Thermal Climate Index (Broede et al., 2012).
- **Building Energy & Performance**:
  - *ISO 52000-1:2017* — Overarching EPB assessment and primary energy factors.
  - *ISO 13790 / ISO 52016-1* — Calculation of energy use for space heating and cooling.
  - *UNI/TS 11300 (Parts 1–4)* — Italian national methodology for building energy performance.
  - *D.M. 26/06/2015* — Decreto Requisiti Minimi (Italian NZEB building code).
  - *D.P.R. 412/93* — Italian climatic zoning and heating degree days classification.
- **Building Envelope & Physics**:
  - *ISO 6946:2017* — Building components and elements — Thermal resistance and thermal transmittance.
  - *ISO 13786:2017* — Dynamic thermal characteristics of building components.
  - *ISO 13788:2012* — Glaser calculation of internal surface temperature and interstitial condensation.
- **Life Cycle Assessment**:
  - *EN 15978:2011* — Sustainability of construction works — Assessment of environmental performance of buildings.
  - *EU Level(s) Framework* — Common European approach to core sustainability indicators.
- **Structural Engineering**:
  - *Eurocode 0 (EN 1990)* — Basis of Structural Design.
  - *Eurocode 1 (EN 1991)* — Actions on Structures (Dead, Live, Snow, Wind).
  - *Eurocode 2 (EN 1992)*, *Eurocode 3 (EN 1993)*, *Eurocode 5 (EN 1995)* — Concrete, Steel, and Timber Design.

---

## 📂 Project Directory Structure

```text
polimi-energy-app/
├── dist/                             # Compiled production build output
├── public/                           # Static assets, fallback weather files, markers
│   └── weather/
│       └── milan.epw                 # Reference 8,760h EnergyPlus weather file
├── src/
│   ├── components/                   # Modular UI & simulation panels
│   │   ├── AdvancedHvacRenewableModal.tsx # Detailed heat pumps, chillers & PV arrays
│   │   ├── ClimaAndAdvancedPanels.tsx     # Extended CBE Clima analysis views
│   │   ├── ClimaStudioSubTabs.tsx         # Wind rose, UTCI, degree days, psychrometrics
│   │   ├── CrossSection3DViewer.tsx       # 3D building cross-section & envelope layers
│   │   ├── EpwInteractiveMap.tsx          # Leaflet 23,227-station global map
│   │   ├── EurocodeGuideModal.tsx         # Structural Eurocodes reference guide
│   │   ├── HourlySimulationTab.tsx        # 8,760h hourly energy balance & loads
│   │   ├── ParetoExplorerModal.tsx        # Multi-objective Pareto frontier optimizer
│   │   ├── Stage1Climate.tsx              # Tab 1: Comprehensive climate studio
│   │   ├── Stage2Urban.tsx                # Tab 2: Urban canyon, SVF & microclimate
│   │   ├── Stage3FormZoning.tsx           # Tab 3: Massing, zoning & WWR
│   │   ├── Stage4FacadeFabric.tsx         # Tab 4: Envelope U-values, inertia & Glaser
│   │   ├── Stage5EnergyComfort.tsx        # Tab 5: Energy balance, HVAC & NZEB
│   │   ├── Stage6LCA.tsx                  # Tab 6: Whole-life carbon & 5Rs circularity
│   │   ├── StructuralBay3DViewer.tsx      # 3D structural bay sizing viewport
│   │   ├── StructuralEurocodeStudio.tsx   # Eurocode calculation & material selection
│   │   ├── StructuralReportModal.tsx      # Structural summary & compliance report
│   │   └── Urban3DViewer.tsx              # 3D urban context & street canyon viewer
│   ├── context/
│   │   └── DesignProjectContext.tsx       # Centralized multi-stage reactive state engine
│   ├── data/
│   │   └── climateAndStrategies.ts        # Climate archetypes, materials & strategies
│   ├── utils/
│   │   ├── epwEngine.ts                   # Solar angles, psychrometric math & EPW parsing
│   │   ├── epwParser.ts                   # EPW string decoder, ground temps & morphing
│   │   └── utciEngine.ts                  # Universal Thermal Climate Index (UTCI) solver
│   ├── App.tsx                            # Root application layout & top navigation
│   ├── index.css                          # Tailwind CSS base directives & design tokens
│   └── main.tsx                           # React DOM application mount
├── index.html                         # HTML5 template entry point
├── package.json                       # Project dependencies, scripts & metadata
├── tailwind.config.js                 # Tailwind styling rules and responsive breakpoints
├── tsconfig.json                      # TypeScript project compiler configuration
└── vite.config.ts                     # Vite build, asset chunking & plugin setup
```

---

## 📄 License, Anti-Theft Copyleft Protection & Academic Citation

This project is licensed under the **GNU General Public License v3.0 (GNU GPLv3)** — see the [LICENSE](LICENSE) file for the full legal text.

### 🛡️ Copyleft & Anti-Theft Protections (Why GPLv3?)
Under the GNU General Public License v3.0:
- **No Proprietary Closed-Sourcing**: No individual, enterprise, or organization may take this codebase, close the source code, and market or distribute it as proprietary software.
- **Mandatory Share-Alike (Copyleft)**: Any modifications, forks, or derivative works distributed to others must be made fully public under the exact same GPLv3 license terms.
- **Strict Authorship & Attribution Rights**: All original copyright notices, contributor credits, and academic attributions to the authors and Politecnico di Milano must be permanently preserved in all copies, forks, and distributions.

---

### 👨‍💻 Authorship & Academic Research Team

- **Author & Lead Developer**:
  **Anxhelo Golloberda**  
  *Architectural Engineering & Building Technology Research*  
  Politecnico di Milano — Department of Architecture, Built Environment and Construction Engineering (DABC)  
  Contact: `anxhelo.golloberda@mail.polimi.it`

- **Academic Supervisors & Scientific Advisors**:
  - **Prof. Salvatore Viscuso**  
    *Politecnico di Milano — Department of Architecture, Built Environment and Construction Engineering (DABC)*
  - **Prof. Massimiliano Manfren**  
    *Politecnico di Milano — Department of Architecture, Built Environment and Construction Engineering (DABC)*

- **Institution**:
  **Politecnico di Milano**  
  *Department of Architecture, Built Environment and Construction Engineering (DABC)*  
  Piazza Leonardo da Vinci, 32, 20133 Milano (MI), Italy

---

### 📚 Academic Citation Guide

If you use this platform, its simulation engines (EPW parser, UTCI comfort calculator, 8,760h hourly energy balance, ISO 52000-1 solver), or the Eurocode structural pre-dimensioning studio in academic publications, journal papers, master/PhD theses, or architectural design projects, **please cite this work as follows**:

#### APA 7th Edition
> Golloberda, A., Viscuso, S., & Manfren, M. (2026). *PoliMI Early-Stage BEM & Sustainability Studio: Integrated Building Energy Modeling, Climate Studio, Whole-Life Carbon LCA & Multi-Objective Architectural Optimization Platform* (Version 1.0.0) [Computer software]. Politecnico di Milano, Department of Architecture, Built Environment and Construction Engineering (DABC). https://github.com/AnxheloGolloberda/polimi-energy-app

#### BibTeX Entry
```bibtex
@software{golloberda2026polimi,
  author       = {Golloberda, Anxhelo and Viscuso, Salvatore and Manfren, Massimiliano},
  title        = {{PoliMI Early-Stage BEM & Sustainability Studio: Integrated Building Energy Modeling, Climate Studio, Whole-Life Carbon LCA & Multi-Objective Architectural Optimization Platform}},
  month        = nov,
  year         = 2026,
  publisher    = {Politecnico di Milano},
  institution  = {Department of Architecture, Built Environment and Construction Engineering (DABC)},
  version      = {1.0.0},
  url          = {https://github.com/AnxheloGolloberda/polimi-energy-app},
  license      = {GPL-3.0-or-later}
}
```

> [!TIP]
> A standardized [`CITATION.cff`](CITATION.cff) file is included at the repository root. GitHub will automatically display a **"Cite this repository"** button in the sidebar with one-click export to APA, BibTeX, and EndNote.

---

*Engineered with precision for zero-carbon architecture and resilient urban futures.*

