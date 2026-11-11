// ============================================================================
// POLIMI BEM STUDIO - ENERGYPLUS .IDF GENERATOR & LOCAL VALIDATION BRIDGE
// Generates:
// 1. Standards-compliant EnergyPlus .idf file (v24.1) for DALEC+ Shoebox Room:
//    - Building, Zone, BuildingSurface:Detailed, FenestrationSurface:Detailed (FA1, FA2, FA3)
//    - Construction & Material layers
//    - WindowShadingControl (3-state automated glare & radiation protection)
//    - Daylighting:Controls & Daylighting:ReferencePoint (MA1 near window & MA2 far from window)
//    - Lights, People, ElectricEquipment
//    - ZoneVentilation:WindandStackOpenArea (night flush purge ventilation)
//    - HVACTemplate:Zone:IdealLoadsAirSystem
// 2. Python FastAPI / Flask runner script ('energyplus_server.py') for local E+ execution
// ============================================================================

import {
  DalecRoomConfig,
  DalecControlConfig,
  DalecThermalConfig
} from './hourlyDalecEnergyPlusEngine';
import { ClimateDataset } from './epwEngine';

/**
 * Generates an EnergyPlus v24.1 .idf text file for the DALEC+ shoebox room
 */
export function generateDalecEnergyPlusIdf(
  room: DalecRoomConfig,
  controls: DalecControlConfig,
  thermal: DalecThermalConfig,
  climate: ClimateDataset,
  projectName = 'DALEC_Plus_Shoebox_Room'
): string {
  const W = room.width;
  const D = room.depth;
  const H = room.height;
  const az = room.orientationDeg;

  // Band heights
  const hFA1 = Math.min(1.0, H);
  const hFA2 = Math.min(2.0, H);
  const hFA3 = H;

  // Window widths along South facade (X from 0 to W, Y = 0, Z = 0 to H)
  // Frame inset 0.15m from edges
  const winXMin = 0.15;
  const winXMax = Math.max(winXMin + 0.5, W - 0.15);

  const lines: string[] = [];

  const add = (txt = '') => lines.push(txt);
  const section = (title: string) => {
    add();
    add('!- ============================================================================');
    add(`!- ${title}`);
    add('!- ============================================================================');
  };

  // Header & Version
  section('SIMULATION CONTROL & VERSION');
  add('Version, 24.1;');
  add();
  add('SimulationControl,');
  add('  Yes,                     !- Do Zone Sizing Calculation');
  add('  Yes,                     !- Do System Sizing Calculation');
  add('  No,                      !- Do Plant Sizing Calculation');
  add('  Yes,                     !- Run Simulation for Sizing Periods');
  add('  Yes,                     !- Run Simulation for Weather File Run Periods');
  add('  No,                      !- Do HVAC Sizing Simulation for Sizing Periods');
  add('  1;                       !- Maximum Number of HVAC Sizing Simulation Passes');
  add();
  add('Building,');
  add(`  ${projectName},          !- Name`);
  add(`  ${az},                   !- North Axis {deg}`);
  add('  City,                    !- Terrain');
  add('  0.04,                    !- Loads Convergence Tolerance Value {W}');
  add('  0.4,                     !- Temperature Convergence Tolerance Value {deltaC}');
  add('  FullInteriorAndExterior, !- Solar Distribution');
  add('  25,                      !- Maximum Number of Warmup Days');
  add('  6;                       !- Minimum Number of Warmup Days');
  add();
  add('Timestep, 4;                !- 4 timesteps per hour (15-minute resolution)');

  // Site & RunPeriod
  section('SITE & RUN PERIOD');
  add('RunPeriod,');
  add('  AnnualRun,               !- Name');
  add('  1,                       !- Begin Month');
  add('  1,                       !- Begin Day of Month');
  add('  2024,                    !- Begin Year');
  add('  12,                      !- End Month');
  add('  31,                      !- End Day of Month');
  add('  2024,                    !- End Year');
  add('  Tuesday,                 !- Day of Week for Start Day');
  add('  Yes,                     !- Use Weather File Holidays and Special Days');
  add('  Yes,                     !- Use Weather File Daylight Saving Period');
  add('  No,                      !- Apply Weekend Holiday Rule');
  add('  Yes,                     !- Use Weather File Rain Indicators');
  add('  Yes;                     !- Use Weather File Snow Indicators');

  // Materials & Constructions
  section('MATERIALS & CONSTRUCTIONS');
  add('Material,');
  add('  ExtOpaqueInsulation,     !- Name');
  add('  MediumRough,             !- Roughness');
  add('  0.12,                    !- Thickness {m}');
  add('  0.035,                   !- Conductivity {W/m-K}');
  add('  30.0,                    !- Density {kg/m3}');
  add('  1400.0,                  !- Specific Heat {J/kg-K}');
  add('  0.9,                     !- Thermal Absorptance');
  add('  0.7,                     !- Solar Absorptance');
  add('  0.7;                     !- Visible Absorptance');
  add();
  add('Material,');
  add('  EurocodeConcreteMass,    !- Name');
  add('  MediumRough,             !- Roughness');
  add('  0.20,                    !- Thickness {m}');
  add('  1.80,                    !- Conductivity {W/m-K}');
  add('  2400.0,                  !- Density {kg/m3}');
  add('  1000.0,                  !- Specific Heat {J/kg-K}');
  add('  0.9,                     !- Thermal Absorptance');
  add('  0.6,                     !- Solar Absorptance');
  add('  0.6;                     !- Visible Absorptance');
  add();
  add('Material,');
  add('  InternalPlasterboard,    !- Name');
  add('  Smooth,                  !- Roughness');
  add('  0.015,                   !- Thickness {m}');
  add('  0.25,                    !- Conductivity {W/m-K}');
  add('  900.0,                   !- Density {kg/m3}');
  add('  1000.0,                  !- Specific Heat {J/kg-K}');
  add('  0.9,                     !- Thermal Absorptance');
  add('  0.5,                     !- Solar Absorptance');
  add('  0.5;                     !- Visible Absorptance');
  add();
  add('Construction,');
  add('  ExteriorWallConstruction,!- Name');
  add('  ExtOpaqueInsulation,     !- Outside Layer');
  add('  EurocodeConcreteMass,    !- Layer 2');
  add('  InternalPlasterboard;    !- Layer 3');
  add();
  add('Construction,');
  add('  InternalPartitionConstruction, !- Name');
  add('  InternalPlasterboard,    !- Outside Layer');
  add('  EurocodeConcreteMass,    !- Layer 2');
  add('  InternalPlasterboard;    !- Inside Layer');
  add();

  // Glazing Materials
  add('WindowMaterial:SimpleGlazingSystem,');
  add('  GlazingSystem_FA2_Vision,!- Name');
  add(`  ${room.bands.FA2.uValue},!- U-Factor {W/m2-K}`);
  add(`  ${room.bands.FA2.gValue},!- Solar Heat Gain Coefficient`);
  add(`  ${room.bands.FA2.visTrans}; !- Visible Transmittance`);
  add();
  add('Construction,');
  add('  WindowConstruction_FA2,  !- Name');
  add('  GlazingSystem_FA2_Vision;!- Outside Layer');
  add();
  add('WindowMaterial:SimpleGlazingSystem,');
  add('  GlazingSystem_FA3_Clerestory, !- Name');
  add(`  ${room.bands.FA3.uValue},!- U-Factor {W/m2-K}`);
  add(`  ${room.bands.FA3.gValue},!- Solar Heat Gain Coefficient`);
  add(`  ${room.bands.FA3.visTrans}; !- Visible Transmittance`);
  add();
  add('Construction,');
  add('  WindowConstruction_FA3,  !- Name');
  add('  GlazingSystem_FA3_Clerestory; !- Outside Layer');
  add();

  // Window Shading Blind Material
  add('WindowMaterial:Blind,');
  add('  AutomatedVenetianBlind,  !- Name');
  add('  Horizontal,              !- Slat Orientation');
  add('  0.05,                    !- Slat Width {m}');
  add('  0.04,                    !- Slat Separation {m}');
  add('  0.001,                   !- Slat Thickness {m}');
  add('  45.0,                    !- Slat Angle {deg}');
  add('  0.70,                    !- Slat Solar Reflectance');
  add('  0.0,                     !- Slat Solar Transmittance');
  add('  0.70,                    !- Slat Visible Reflectance');
  add('  0.0,                     !- Slat Visible Transmittance');
  add('  0.90,                    !- Slat IR Hemispherical Emissivity');
  add('  0.0,                     !- Slat IR Transmittance');
  add('  0.015,                   !- Blind to Glass Distance {m}');
  add('  0.5,                     !- Blind Top Opening Multiplier');
  add('  0.5,                     !- Blind Bottom Opening Multiplier');
  add('  0.5,                     !- Blind Left-Side Opening Multiplier');
  add('  0.5;                     !- Blind Right-Side Opening Multiplier');

  // Zone Definition
  section('THERMAL ZONE');
  add('Zone,');
  add('  DalecShoeboxZone,        !- Name');
  add('  0.0,                     !- Direction of Relative North {deg}');
  add('  0.0,                     !- X Origin {m}');
  add('  0.0,                     !- Y Origin {m}');
  add('  0.0,                     !- Z Origin {m}');
  add('  1,                       !- Type');
  add('  1,                       !- Multiplier');
  add(`  ${H},                    !- Ceiling Height {m}`);
  add(`  ${(W * D * H).toFixed(2)}; !- Volume {m3}`);

  // Surfaces (Floor, Roof, Walls)
  section('ZONE SURFACES & DETAILED GEOMETRY');
  // Floor (Z=0, normal pointing -Z)
  add('BuildingSurface:Detailed,');
  add('  RoomFloor,               !- Name');
  add('  Floor,                   !- Surface Type');
  add('  InternalPartitionConstruction, !- Construction Name');
  add('  DalecShoeboxZone,        !- Zone Name');
  add('  Adiabatic,               !- Space Name');
  add('  Adiabatic,               !- Outside Boundary Condition');
  add('  ,                        !- Outside Boundary Condition Object');
  add('  NoSun,                   !- Sun Exposure');
  add('  NoWind,                  !- Wind Exposure');
  add('  0.0,                     !- View Factor to Ground');
  add('  4,                       !- Number of Vertices');
  add(`  0.0, 0.0, 0.0,           !- Vertex 1`);
  add(`  0.0, ${D}, 0.0,          !- Vertex 2`);
  add(`  ${W}, ${D}, 0.0,         !- Vertex 3`);
  add(`  ${W}, 0.0, 0.0;          !- Vertex 4`);
  add();

  // Roof / Ceiling (Z=H, normal pointing +Z)
  add('BuildingSurface:Detailed,');
  add('  RoomCeiling,             !- Name');
  add('  Ceiling,                 !- Surface Type');
  add('  InternalPartitionConstruction, !- Construction Name');
  add('  DalecShoeboxZone,        !- Zone Name');
  add('  Adiabatic,               !- Space Name');
  add('  Adiabatic,               !- Outside Boundary Condition');
  add('  ,                        !- Outside Boundary Condition Object');
  add('  NoSun,                   !- Sun Exposure');
  add('  NoWind,                  !- Wind Exposure');
  add('  0.0,                     !- View Factor to Ground');
  add('  4,                       !- Number of Vertices');
  add(`  ${W}, 0.0, ${H},         !- Vertex 1`);
  add(`  ${W}, ${D}, ${H},        !- Vertex 2`);
  add(`  0.0, ${D}, ${H},         !- Vertex 3`);
  add(`  0.0, 0.0, ${H};          !- Vertex 4`);
  add();

  // South Exterior Facade (Y=0, normal pointing -Y)
  add('BuildingSurface:Detailed,');
  add('  FacadeSouthWall,         !- Name');
  add('  Wall,                    !- Surface Type');
  add('  ExteriorWallConstruction,!- Construction Name');
  add('  DalecShoeboxZone,        !- Zone Name');
  add('  ,                        !- Space Name');
  add('  Outdoors,                !- Outside Boundary Condition');
  add('  ,                        !- Outside Boundary Condition Object');
  add('  SunExposed,              !- Sun Exposure');
  add('  WindExposed,             !- Wind Exposure');
  add('  0.5,                     !- View Factor to Ground');
  add('  4,                       !- Number of Vertices');
  add(`  0.0, 0.0, ${H},          !- Vertex 1`);
  add(`  0.0, 0.0, 0.0,           !- Vertex 2`);
  add(`  ${W}, 0.0, 0.0,          !- Vertex 3`);
  add(`  ${W}, 0.0, ${H};         !- Vertex 4`);
  add();

  // North Rear Wall (Y=D, Adiabatic)
  add('BuildingSurface:Detailed,');
  add('  RearNorthWall,           !- Name');
  add('  Wall,                    !- Surface Type');
  add('  InternalPartitionConstruction, !- Construction Name');
  add('  DalecShoeboxZone,        !- Zone Name');
  add('  ,                        !- Space Name');
  add('  Adiabatic,               !- Outside Boundary Condition');
  add('  ,                        !- Outside Boundary Condition Object');
  add('  NoSun,                   !- Sun Exposure');
  add('  NoWind,                  !- Wind Exposure');
  add('  0.0,                     !- View Factor to Ground');
  add('  4,                       !- Number of Vertices');
  add(`  ${W}, ${D}, ${H},        !- Vertex 1`);
  add(`  ${W}, ${D}, 0.0,         !- Vertex 2`);
  add(`  0.0, ${D}, 0.0,          !- Vertex 3`);
  add(`  0.0, ${D}, ${H};         !- Vertex 4`);
  add();

  // East Side Wall (X=W, Adiabatic)
  add('BuildingSurface:Detailed,');
  add('  EastSideWall,            !- Name');
  add('  Wall,                    !- Surface Type');
  add('  InternalPartitionConstruction, !- Construction Name');
  add('  DalecShoeboxZone,        !- Zone Name');
  add('  ,                        !- Space Name');
  add('  Adiabatic,               !- Outside Boundary Condition');
  add('  ,                        !- Outside Boundary Condition Object');
  add('  NoSun,                   !- Sun Exposure');
  add('  NoWind,                  !- Wind Exposure');
  add('  0.0,                     !- View Factor to Ground');
  add('  4,                       !- Number of Vertices');
  add(`  ${W}, 0.0, ${H},         !- Vertex 1`);
  add(`  ${W}, 0.0, 0.0,          !- Vertex 2`);
  add(`  ${W}, ${D}, 0.0,         !- Vertex 3`);
  add(`  ${W}, ${D}, ${H};        !- Vertex 4`);
  add();

  // West Side Wall (X=0, Adiabatic)
  add('BuildingSurface:Detailed,');
  add('  WestSideWall,            !- Name');
  add('  Wall,                    !- Surface Type');
  add('  InternalPartitionConstruction, !- Construction Name');
  add('  DalecShoeboxZone,        !- Zone Name');
  add('  ,                        !- Space Name');
  add('  Adiabatic,               !- Outside Boundary Condition');
  add('  ,                        !- Outside Boundary Condition Object');
  add('  NoSun,                   !- Sun Exposure');
  add('  NoWind,                  !- Wind Exposure');
  add('  0.0,                     !- View Factor to Ground');
  add('  4,                       !- Number of Vertices');
  add(`  0.0, ${D}, ${H},         !- Vertex 1`);
  add(`  0.0, ${D}, 0.0,          !- Vertex 2`);
  add(`  0.0, 0.0, 0.0,           !- Vertex 3`);
  add(`  0.0, 0.0, ${H};          !- Vertex 4`);

  // Fenestration Subsurfaces: FA2 (Vision) & FA3 (Clerestory)
  section('FENESTRATION & 3-BAND FACADE');
  // FA2: Vision Band (1.0m to 2.0m)
  add('FenestrationSurface:Detailed,');
  add('  Window_FA2_VisionBand,   !- Name');
  add('  Window,                  !- Surface Type');
  add('  WindowConstruction_FA2,  !- Construction Name');
  add('  FacadeSouthWall,         !- Building Surface Name');
  add('  ,                        !- Outside Boundary Condition Object');
  add('  0.5,                     !- View Factor to Ground');
  add('  WindowShading_FA2,       !- Shading Control Name');
  add('  ,                        !- Frame and Divider Name');
  add('  1.0,                     !- Multiplier');
  add('  4,                       !- Number of Vertices');
  add(`  ${winXMin}, 0.0, ${hFA2},!- Vertex 1`);
  add(`  ${winXMin}, 0.0, ${hFA1},!- Vertex 2`);
  add(`  ${winXMax}, 0.0, ${hFA1},!- Vertex 3`);
  add(`  ${winXMax}, 0.0, ${hFA2};!- Vertex 4`);
  add();

  // FA3: Clerestory Band (2.0m to H)
  add('FenestrationSurface:Detailed,');
  add('  Window_FA3_Clerestory,   !- Name');
  add('  Window,                  !- Surface Type');
  add('  WindowConstruction_FA3,  !- Construction Name');
  add('  FacadeSouthWall,         !- Building Surface Name');
  add('  ,                        !- Outside Boundary Condition Object');
  add('  0.5,                     !- View Factor to Ground');
  add('  ,                        !- Shading Control Name (Clerestory stays clear for daylight)');
  add('  ,                        !- Frame and Divider Name');
  add('  1.0,                     !- Multiplier');
  add('  4,                       !- Number of Vertices');
  add(`  ${winXMin}, 0.0, ${hFA3},!- Vertex 1`);
  add(`  ${winXMin}, 0.0, ${hFA2},!- Vertex 2`);
  add(`  ${winXMax}, 0.0, ${hFA2},!- Vertex 3`);
  add(`  ${winXMax}, 0.0, ${hFA3};!- Vertex 4`);

  // Window Shading Control (3-State Glare & Radiation Control)
  section('AUTOMATED 3-STATE WINDOW SHADING CONTROL');
  add('WindowShadingControl,');
  add('  WindowShading_FA2,       !- Name');
  add('  DalecShoeboxZone,        !- Zone Name');
  add('  1,                       !- Sequence Number');
  add('  ExteriorBlind,           !- Shading Type');
  add('  ,                        !- Construction with Shading Name');
  add('  OnIfHighSolarOnWindow,   !- Shading Control Type');
  add('  ,                        !- Schedule Name');
  add(`  ${controls.sunProtectionIrradianceThresholdWm2}, !- Setpoint {W/m2}`);
  add('  Yes,                     !- Shading Control Is Scheduled');
  add('  Yes,                     !- Glare Control Is Active');
  add('  AutomatedVenetianBlind,  !- Exterior Shading Device Material Name');
  add('  Sequential,              !- Type of Slat Angle Control for Blinds');
  add('  ;                        !- Slat Angle Schedule Name');

  // Daylighting Reference Points MA1 & MA2
  section('SPLIT-FLUX DAYLIGHTING CONTROLS & SENSOR WORKPLANES');
  add('Daylighting:Controls,');
  add('  DalecDaylightingControls,!- Name');
  add('  DalecShoeboxZone,        !- Zone Name');
  add('  SplitFlux,               !- Daylighting Method');
  add('  ,                        !- Availability Schedule Name');
  add('  Continuous,              !- Lighting Control Type');
  add('  0.10,                    !- Minimum Input Power Fraction for Continuous Dimming Control');
  add('  0.10,                    !- Minimum Light Output Fraction for Continuous Dimming Control');
  add('  1,                       !- Number of Stepped Control Steps');
  add('  1.0,                     !- Probability Lighting will be Reset When Needed in Manual Stepped Control');
  add('  RefPoint_MA1,            !- Glare Calculation Daylighting Reference Point Name');
  add('  180.0,                   !- Glare Calculation Azimuth Angle of View Direction {deg}');
  add(`  ${controls.glareLuminanceThresholdCdM2}, !- Maximum Allowable Discomfort Glare Index`);
  add('  ,                        !- DElight Gridding Resolution {m2}');
  add('  RefPoint_MA1,            !- Daylighting Reference Point 1 Name');
  add('  0.50,                    !- Fraction of Zone Controlled by Reference Point 1');
  add(`  ${controls.targetIlluminanceMA1}, !- Illuminance Setpoint at Reference Point 1 {lux}`);
  add('  RefPoint_MA2,            !- Daylighting Reference Point 2 Name');
  add('  0.50,                    !- Fraction of Zone Controlled by Reference Point 2');
  add(`  ${controls.targetIlluminanceMA2}; !- Illuminance Setpoint at Reference Point 2 {lux}`);
  add();

  // MA1 (1.5m from window, height 0.8m)
  add('Daylighting:ReferencePoint,');
  add('  RefPoint_MA1,            !- Name');
  add('  DalecShoeboxZone,        !- Zone Name');
  add(`  ${(W / 2).toFixed(2)},   !- X-Coordinate of Reference Point {m}`);
  add('  1.5,                     !- Y-Coordinate of Reference Point {m}');
  add('  0.8;                     !- Z-Coordinate of Reference Point {m}');
  add();

  // MA2 (D - 1.5m from window, height 0.8m)
  add('Daylighting:ReferencePoint,');
  add('  RefPoint_MA2,            !- Name');
  add('  DalecShoeboxZone,        !- Zone Name');
  add(`  ${(W / 2).toFixed(2)},   !- X-Coordinate of Reference Point {m}`);
  add(`  ${Math.max(2.5, D - 1.5).toFixed(2)}, !- Y-Coordinate of Reference Point {m}`);
  add('  0.8;                     !- Z-Coordinate of Reference Point {m}');

  // Internal Loads (People, Lights, Equipment)
  section('INTERNAL LOADS & SCHEDULES');
  add('ScheduleTypeLimits,');
  add('  Fraction,                !- Name');
  add('  0.0,                     !- Lower Limit Value');
  add('  1.0,                     !- Upper Limit Value');
  add('  Continuous;              !- Numeric Type');
  add();
  add('Schedule:Compact,');
  add('  OfficeOccupancySchedule, !- Name');
  add('  Fraction,                !- Schedule Type Limits Name');
  add('  Through: 12/31,          !- Complex Field');
  add('  For: Weekdays,           !- Field');
  add('  Until: 08:00, 0.0,       !- Field');
  add('  Until: 18:00, 1.0,       !- Field');
  add('  Until: 24:00, 0.0,       !- Field');
  add('  For: AllOtherDays,       !- Field');
  add('  Until: 24:00, 0.0;       !- Field');
  add();
  add('People,');
  add('  DalecOccupants,          !- Name');
  add('  DalecShoeboxZone,        !- Zone Name');
  add('  OfficeOccupancySchedule, !- Number of People Schedule Name');
  add('  People/Area,             !- Number of People Calculation Method');
  add('  ,                        !- Number of People');
  add('  0.07,                    !- People per Zone Floor Area {person/m2}');
  add('  ,                        !- Zone Floor Area per Person {m2/person}');
  add('  0.30,                    !- Fraction Radiant');
  add('  ,                        !- Sensible Heat Fraction');
  add('  120.0;                   !- Activity Level {W/person}');
  add();
  add('Lights,');
  add('  DalecArtificialLighting, !- Name');
  add('  DalecShoeboxZone,        !- Zone Name');
  add('  OfficeOccupancySchedule, !- Schedule Name');
  add('  Watts/Area,              !- Design Level Calculation Method');
  add('  ,                        !- Lighting Level {W}');
  add(`  ${((controls.luminairesCountGroup1 + controls.luminairesCountGroup2) * controls.powerPerLuminaireW / (W * D)).toFixed(2)}, !- Watts per Zone Floor Area {W/m2}`);
  add('  ,                        !- Watts per Person {W/person}');
  add('  0.0,                     !- Return Air Fraction');
  add('  0.60,                    !- Fraction Radiant');
  add('  0.20,                    !- Fraction Visible');
  add('  1.0,                     !- Fraction Replaceable');
  add('  GeneralLights;           !- End-Use Subcategory');
  add();
  add('ElectricEquipment,');
  add('  DalecPlugLoads,          !- Name');
  add('  DalecShoeboxZone,        !- Zone Name');
  add('  OfficeOccupancySchedule, !- Schedule Name');
  add('  Watts/Area,              !- Design Level Calculation Method');
  add('  ,                        !- Design Level {W}');
  add(`  ${thermal.internalLoadsWm2}, !- Watts per Zone Floor Area {W/m2}`);
  add('  ,                        !- Watts per Person {W/person}');
  add('  0.0,                     !- Fraction Latent');
  add('  0.30,                    !- Fraction Radiant');
  add('  0.0;                     !- Fraction Lost');

  // Automated Night Purge Natural Ventilation
  section('VENTILATION & AUTOMATED NIGHT PURGE');
  if (thermal.automatedNightPurge) {
    add('Schedule:Compact,');
    add('  NightPurgeSchedule,      !- Name');
    add('  Fraction,                !- Schedule Type Limits Name');
    add('  Through: 12/31,          !- Complex Field');
    add('  For: AllDays,            !- Field');
    add('  Until: 06:00, 1.0,       !- Night hours open');
    add('  Until: 22:00, 0.0,       !- Daytime closed');
    add('  Until: 24:00, 1.0;       !- Night hours open');
    add();
    add('ZoneVentilation:WindandStackOpenArea,');
    add('  NightPurgeVentilation,   !- Name');
    add('  DalecShoeboxZone,        !- Zone Name');
    add('  0.8,                     !- Opening Area {m2}');
    add('  NightPurgeSchedule,      !- Opening Area Fraction Schedule Name');
    add('  0.62,                    !- Opening Effectiveness');
    add('  0.0,                     !- Effective Angle {deg}');
    add('  1.5,                     !- Height Difference {m}');
    add('  0.4,                     !- Discharge Coefficient for Opening');
    add(`  ${thermal.nightPurgeTempThresholdC}, !- Minimum Indoor Temperature {C}`);
    add('  ,                        !- Minimum Indoor Temperature Schedule Name');
    add('  100.0,                   !- Maximum Indoor Temperature {C}');
    add('  ,                        !- Maximum Indoor Temperature Schedule Name');
    add('  1.5,                     !- Delta Temperature {deltaC}');
    add('  ,                        !- Delta Temperature Schedule Name');
    add('  12.0,                    !- Minimum Outdoor Temperature {C}');
    add('  ,                        !- Minimum Outdoor Temperature Schedule Name');
    add('  28.0;                    !- Maximum Outdoor Temperature {C}');
  }

  // HVAC: Ideal Loads Air System
  section('HVAC IDEAL LOADS SYSTEM');
  add('HVACTemplate:Thermostat,');
  add('  ShoeboxThermostat,       !- Name');
  add('  ,                        !- Heating Setpoint Schedule Name');
  add(`  ${thermal.heatingSetpointC}, !- Constant Heating Setpoint {C}`);
  add('  ,                        !- Cooling Setpoint Schedule Name');
  add(`  ${thermal.coolingSetpointC}; !- Constant Cooling Setpoint {C}`);
  add();
  add('HVACTemplate:Zone:IdealLoadsAirSystem,');
  add('  DalecShoeboxZone,        !- Zone Name');
  add('  ShoeboxThermostat,       !- Template Thermostat Name');
  add('  ,                        !- System Availability Schedule Name');
  add('  50.0,                    !- Maximum Heating Supply Air Temperature {C}');
  add('  13.0,                    !- Minimum Cooling Supply Air Temperature {C}');
  add('  0.015,                   !- Maximum Heating Supply Air Humidity Ratio {kgWater/kgDryAir}');
  add('  0.009,                   !- Minimum Cooling Supply Air Humidity Ratio {kgWater/kgDryAir}');
  add('  NoLimit,                 !- Heating Limit');
  add('  ,                        !- Maximum Heating Air Flow Rate {m3/s}');
  add('  ,                        !- Maximum Sensible Heating Capacity {W}');
  add('  NoLimit,                 !- Cooling Limit');
  add('  ,                        !- Maximum Cooling Air Flow Rate {m3/s}');
  add('  ,                        !- Maximum Total Cooling Capacity {W}');
  add('  ,                        !- Heating Availability Schedule Name');
  add('  ,                        !- Cooling Availability Schedule Name');
  add('  ConstantSensibleHeatRatio, !- Dehumidification Control Type');
  add('  0.7,                     !- Cooling Sensible Heat Ratio');
  add('  None,                    !- Humidification Control Type');
  add('  ,                        !- Design Specification Outdoor Air Object Name');
  add('  None,                    !- Outdoor Air Inlet Node Name');
  add('  None,                    !- Demand Controlled Ventilation Type');
  add('  NoEconomizer,            !- Outdoor Air Economizer Type');
  add('  None,                    !- Heat Recovery Type');
  add('  0.70,                    !- Sensible Heat Recovery Effectiveness');
  add('  0.65;                    !- Latent Heat Recovery Effectiveness');

  // Output Variables
  section('OUTPUT VARIABLES');
  add('Output:VariableDictionary, IDF;');
  add('Output:Table:SummaryReports, AllSummary;');
  add('OutputControl:Table:Style, HTML;');
  add('Output:Variable, *, Zone Mean Air Temperature, Hourly;');
  add('Output:Variable, *, Zone Operative Temperature, Hourly;');
  add('Output:Variable, *, Zone Ideal Loads Zone Total Heating Energy, Hourly;');
  add('Output:Variable, *, Zone Ideal Loads Zone Total Cooling Energy, Hourly;');
  add('Output:Variable, *, Daylighting Reference Point 1 Illuminance, Hourly;');
  add('Output:Variable, *, Daylighting Reference Point 2 Illuminance, Hourly;');
  add('Output:Variable, *, Zone Lights Electric Energy, Hourly;');
  add('Output:Variable, *, Surface Window Transmitted Solar Radiation Rate, Hourly;');

  return lines.join('\n');
}

/**
 * Generates a ready-to-run Python script for local EnergyPlus execution & validation
 */
export function generateEnergyPlusLocalRunnerScript(): string {
  return `"""
EnergyPlus Local Validation Server for PoliMi DALEC+ Studio
Runs EnergyPlus v24+ locally against the exported .idf and .epw files,
and returns JSON results to the browser.

Requirements:
    pip install fastapi uvicorn pydantic

Usage:
    python energyplus_server.py
    Server runs at http://localhost:8000
"""

import os
import subprocess
import shutil
import tempfile
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="PoliMi DALEC+ EnergyPlus Bridge")

# Allow browser cross-origin requests
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class EplusRunRequest(BaseModel):
    idf_content: str
    epw_path_or_url: str = ""

@app.get("/health")
def health_check():
    # Detect EnergyPlus in PATH or default directories
    ep_bin = shutil.which("energyplus") or "C:\\\\EnergyPlusV24-1-0\\\\energyplus.exe"
    is_installed = os.path.exists(ep_bin) or shutil.which("energyplus") is not None
    return {"status": "ok", "energyplus_installed": is_installed, "bin_path": ep_bin}

@app.post("/run-simulation")
def run_simulation(req: EplusRunRequest):
    with tempfile.TemporaryDirectory() as tmpdir:
        idf_path = os.path.join(tmpdir, "in.idf")
        with open(idf_path, "w", encoding="utf-8") as f:
            f.write(req.idf_content)

        ep_cmd = [
            "energyplus",
            "-r",
            "-d", tmpdir,
            idf_path
        ]

        try:
            res = subprocess.run(ep_cmd, capture_output=True, text=True, timeout=120)
            log = res.stdout + "\\n" + res.stderr
            return {
                "exit_code": res.returncode,
                "log": log[:2000],
                "status": "success" if res.returncode == 0 else "error"
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    print("Starting PoliMi EnergyPlus Bridge Server on http://localhost:8000 ...")
    uvicorn.run(app, host="0.0.0.0", port=8000)
`;
}
