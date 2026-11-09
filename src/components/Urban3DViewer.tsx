// ============================================================================
// POLIMI BEM STUDIO - 3D THREE.JS WEBGL URBAN DISTRICT & BUILDING VIEWER
// Supports:
// 1. Dynamic 3D Scene with Target Building & Neighboring Canyon Blocks
// 2. Real-time Directional Sun Shadow Casting (Celestial Solar Geometry)
// 3. Smooth Pointer Drag Orbit, Right-Click Pan, Wheel Zoom
// 4. View Modes: Architectural Realistic, Thermal Zones, Solar Heatmap
// 5. Solstice / Equinox Sun Trajectory scrubber
// ============================================================================

import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import {
  Sun,
  Layers,
  RotateCcw,
  Eye,
  Maximize2,
  Calendar,
  Clock,
  Compass,
  Sparkles
} from 'lucide-react';
import { calcSolarPosition } from '../utils/epwEngine';

interface Urban3DViewerProps {
  footprintLength: number;
  footprintWidth: number;
  floorsCount: number;
  floorHeight: number;
  urbanAzimuth: number;
  streetWidth: number;
  neighborNorthH: number;
  neighborSouthH: number;
  neighborEastH: number;
  neighborWestH: number;
  latitude: number;
  wwrSouth: number;
  wwrNorth: number;
  wwrEast: number;
  wwrWest: number;
  perimeterDepth: number;
  urbanShadingSouth: number;
  urbanShadingNorth: number;
  urbanShadingEast: number;
  urbanShadingWest: number;
}

export type ViewRenderMode = 'architectural' | 'thermal_zones' | 'solar_heatmap';

export const Urban3DViewer: React.FC<Urban3DViewerProps> = ({
  footprintLength: L,
  footprintWidth: W,
  floorsCount,
  floorHeight: H,
  urbanAzimuth,
  streetWidth,
  neighborNorthH,
  neighborSouthH,
  neighborEastH,
  neighborWestH,
  latitude,
  wwrSouth,
  wwrNorth,
  wwrEast,
  wwrWest,
  perimeterDepth,
  urbanShadingSouth,
  urbanShadingNorth,
  urbanShadingEast,
  urbanShadingWest
}) => {
  const mountRef = useRef<HTMLDivElement>(null);

  // Time & Solar simulation controls
  const [selectedMonth, setSelectedMonth] = useState<number>(6); // June default
  const [selectedHour, setSelectedHour] = useState<number>(13.5); // 13:30 default
  const [viewMode, setViewMode] = useState<ViewRenderMode>('architectural');
  const [showWireframe, setShowWireframe] = useState<boolean>(false);

  // Orbit controls state refs
  const isDraggingRef = useRef<boolean>(false);
  const isPanningRef = useRef<boolean>(false);
  const prevMouseRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const sphericalRef = useRef<{ radius: number; theta: number; phi: number }>({
    radius: 120,
    theta: Math.PI / 4,
    phi: Math.PI / 3
  });
  const targetRef = useRef<THREE.Vector3>(new THREE.Vector3(0, (floorsCount * H) / 2, 0));

  // Three.js instances ref
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sunLightRef = useRef<THREE.DirectionalLight | null>(null);
  const sunSphereRef = useRef<THREE.Mesh | null>(null);
  const rootGroupRef = useRef<THREE.Group | null>(null);
  const animFrameRef = useRef<number | null>(null);

  const totalBuildingHeight = floorsCount * H;

  // Day of year for month midpoint
  const dayOfYear = useMemo(() => {
    const daysBeforeMonth = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
    return daysBeforeMonth[selectedMonth - 1] + 15;
  }, [selectedMonth]);

  // Compute solar position
  const solarPos = useMemo(() => {
    return calcSolarPosition(latitude, dayOfYear, selectedHour);
  }, [latitude, dayOfYear, selectedHour]);

  // Initialize Three.js Scene
  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth || 800;
    const height = container.clientHeight || 520;

    // 1. Scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf1f5f9); // slate-100
    scene.fog = new THREE.FogExp2(0xf1f5f9, 0.002);
    sceneRef.current = scene;

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(45, width / height, 1, 1000);
    cameraRef.current = camera;
    updateCameraPosition();

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // 4. Ambient & Hemisphere Light
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.45);
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xbae6fd, 0x64748b, 0.4);
    hemiLight.position.set(0, 200, 0);
    scene.add(hemiLight);

    // 5. Sun Directional Light (with shadow projection)
    const sunLight = new THREE.DirectionalLight(0xfffbeb, 1.3);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 400;
    const shadowD = 120;
    sunLight.shadow.camera.left = -shadowD;
    sunLight.shadow.camera.right = shadowD;
    sunLight.shadow.camera.top = shadowD;
    sunLight.shadow.camera.bottom = -shadowD;
    sunLight.shadow.bias = -0.0005;
    scene.add(sunLight);
    sunLightRef.current = sunLight;

    // Visual Sun Sphere in the sky
    const sunGeo = new THREE.SphereGeometry(3, 16, 16);
    const sunMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    const sunSphere = new THREE.Mesh(sunGeo, sunMat);
    scene.add(sunSphere);
    sunSphereRef.current = sunSphere;

    // 6. Ground Plane with Road Grid
    const groundGeo = new THREE.PlaneGeometry(500, 500);
    const groundMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      roughness: 0.9,
      metalness: 0.1
    });
    const groundMesh = new THREE.Mesh(groundGeo, groundMat);
    groundMesh.rotation.x = -Math.PI / 2;
    groundMesh.receiveShadow = true;
    scene.add(groundMesh);

    // Grid Helper
    const grid = new THREE.GridHelper(240, 24, 0x94a3b8, 0xcfd8dc);
    grid.position.y = 0.05;
    scene.add(grid);

    // Compass ring on ground
    const compassRingGeo = new THREE.RingGeometry(80, 81, 64);
    const compassRingMat = new THREE.MeshBasicMaterial({ color: 0x0f766e, side: THREE.DoubleSide, transparent: true, opacity: 0.4 });
    const compassMesh = new THREE.Mesh(compassRingGeo, compassRingMat);
    compassMesh.rotation.x = -Math.PI / 2;
    compassMesh.position.y = 0.08;
    scene.add(compassMesh);

    // Root Group for building models
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);
    rootGroupRef.current = rootGroup;

    // Animation Loop
    const animate = () => {
      animFrameRef.current = requestAnimationFrame(animate);
      if (rendererRef.current && sceneRef.current && cameraRef.current) {
        rendererRef.current.render(sceneRef.current, cameraRef.current);
      }
    };
    animate();

    // Native non-passive Wheel listener to prevent webpage scroll when zooming 3D model
    const onNativeWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      sphericalRef.current.radius = Math.max(20, Math.min(350, sphericalRef.current.radius + e.deltaY * 0.08));
      updateCameraPosition();
    };
    container.addEventListener('wheel', onNativeWheel, { passive: false });

    // Resize Handler
    const handleResize = () => {
      if (!container || !cameraRef.current || !rendererRef.current) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      cameraRef.current.aspect = w / h;
      cameraRef.current.updateProjectionMatrix();
      rendererRef.current.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      container.removeEventListener('wheel', onNativeWheel);
      window.removeEventListener('resize', handleResize);
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Update Sun Light and Sphere based on calculated Solar Position
  useEffect(() => {
    if (!sunLightRef.current || !sunSphereRef.current) return;

    const sun = sunLightRef.current;
    const sphere = sunSphereRef.current;

    // Convert solar altitude and azimuth (azimuth: 0=N, 90=E, 180=S, 270=W)
    const altRad = (solarPos.alt * Math.PI) / 180;
    const azRad = (solarPos.az * Math.PI) / 180;

    const distance = 180;

    if (solarPos.alt <= 0) {
      // Night / Sun below horizon
      sun.intensity = 0.05;
      sun.position.set(0, -50, 0);
      sphere.visible = false;
    } else {
      // Sun in the sky
      // In Three.js: -Z is North, +Z is South, +X is East, -X is West
      const x = distance * Math.cos(altRad) * Math.sin(azRad);
      const y = Math.max(5, distance * Math.sin(altRad));
      const z = -distance * Math.cos(altRad) * Math.cos(azRad);

      sun.position.set(x, y, z);
      sun.target.position.set(0, (floorsCount * H) / 2, 0);
      sun.target.updateMatrixWorld();
      sun.intensity = Math.max(0.3, Math.min(1.5, Math.sin(altRad) * 1.6));

      sphere.position.set(x * 0.9, y * 0.9, z * 0.9);
      sphere.visible = true;
    }
  }, [solarPos, floorsCount, H]);

  // Build and Update 3D Geometry for Target & Neighbors
  useEffect(() => {
    const root = rootGroupRef.current;
    if (!root) return;

    // Clear previous building meshes
    while (root.children.length > 0) {
      const obj = root.children[0];
      root.remove(obj);
      if ((obj as THREE.Mesh).geometry) (obj as THREE.Mesh).geometry.dispose();
    }

    const azimRad = (-urbanAzimuth * Math.PI) / 180;
    root.rotation.y = azimRad;

    // -------------------------------------------------------------
    // A. TARGET BUILDING MESH
    // -------------------------------------------------------------
    const targetGroup = new THREE.Group();
    root.add(targetGroup);

    // Floor slabs & core
    const slabThick = 0.35;
    const slabMat = new THREE.MeshStandardMaterial({
      color: 0x334155, // slate-700
      roughness: 0.5,
      metalness: 0.2
    });

    for (let f = 0; f <= floorsCount; f++) {
      const slabGeo = new THREE.BoxGeometry(L + 0.3, slabThick, W + 0.3);
      const slabMesh = new THREE.Mesh(slabGeo, slabMat);
      slabMesh.position.set(0, f * H + slabThick / 2, 0);
      slabMesh.castShadow = true;
      slabMesh.receiveShadow = true;
      targetGroup.add(slabMesh);
    }

    // Material definitions for facade
    let facadeMatSouth: THREE.Material;
    let facadeMatNorth: THREE.Material;
    let facadeMatEast: THREE.Material;
    let facadeMatWest: THREE.Material;
    let coreMat: THREE.Material;

    if (viewMode === 'thermal_zones') {
      // Color-coded zones
      facadeMatSouth = new THREE.MeshStandardMaterial({ color: 0xf97316, transparent: true, opacity: 0.85, roughness: 0.3 }); // Orange
      facadeMatNorth = new THREE.MeshStandardMaterial({ color: 0x06b6d4, transparent: true, opacity: 0.85, roughness: 0.3 }); // Cyan
      facadeMatEast = new THREE.MeshStandardMaterial({ color: 0xeab308, transparent: true, opacity: 0.85, roughness: 0.3 }); // Yellow
      facadeMatWest = new THREE.MeshStandardMaterial({ color: 0xa855f7, transparent: true, opacity: 0.85, roughness: 0.3 }); // Purple
      coreMat = new THREE.MeshStandardMaterial({ color: 0x64748b, transparent: true, opacity: 0.85, roughness: 0.5 }); // Slate
    } else if (viewMode === 'solar_heatmap') {
      // Facades colored according to urban-shaded solar potential
      facadeMatSouth = new THREE.MeshStandardMaterial({ color: getHeatmapColor(urbanShadingSouth * 1.0), roughness: 0.4 });
      facadeMatNorth = new THREE.MeshStandardMaterial({ color: getHeatmapColor(urbanShadingNorth * 0.35), roughness: 0.4 });
      facadeMatEast = new THREE.MeshStandardMaterial({ color: getHeatmapColor(urbanShadingEast * 0.75), roughness: 0.4 });
      facadeMatWest = new THREE.MeshStandardMaterial({ color: getHeatmapColor(urbanShadingWest * 0.70), roughness: 0.4 });
      coreMat = new THREE.MeshStandardMaterial({ color: 0x475569 });
    } else {
      // Architectural Realistic: Glass curtain wall + Spandrel panels
      facadeMatSouth = new THREE.MeshPhysicalMaterial({
        color: 0x0284c7,
        roughness: 0.1,
        metalness: 0.1,
        transmission: 0.7,
        transparent: true,
        opacity: 0.75
      });
      facadeMatNorth = facadeMatSouth;
      facadeMatEast = facadeMatSouth;
      facadeMatWest = facadeMatSouth;
      coreMat = new THREE.MeshStandardMaterial({ color: 0xcbd5e1, roughness: 0.7 });
    }

    // Build the 4 perimeter zone volumes & Core
    const d = Math.min(perimeterDepth, Math.min(L, W) / 2 - 1);
    const innerL = L - 2 * d;
    const innerW = W - 2 * d;

    // South Zone (+Z)
    const southGeo = new THREE.BoxGeometry(L, totalBuildingHeight, d);
    const southMesh = new THREE.Mesh(southGeo, facadeMatSouth);
    southMesh.position.set(0, totalBuildingHeight / 2, W / 2 - d / 2);
    southMesh.castShadow = true;
    southMesh.receiveShadow = true;
    targetGroup.add(southMesh);

    // North Zone (-Z)
    const northGeo = new THREE.BoxGeometry(L, totalBuildingHeight, d);
    const northMesh = new THREE.Mesh(northGeo, facadeMatNorth);
    northMesh.position.set(0, totalBuildingHeight / 2, -W / 2 + d / 2);
    northMesh.castShadow = true;
    northMesh.receiveShadow = true;
    targetGroup.add(northMesh);

    // East Zone (+X)
    const eastGeo = new THREE.BoxGeometry(d, totalBuildingHeight, innerW);
    const eastMesh = new THREE.Mesh(eastGeo, facadeMatEast);
    eastMesh.position.set(L / 2 - d / 2, totalBuildingHeight / 2, 0);
    eastMesh.castShadow = true;
    eastMesh.receiveShadow = true;
    targetGroup.add(eastMesh);

    // West Zone (-X)
    const westGeo = new THREE.BoxGeometry(d, totalBuildingHeight, innerW);
    const westMesh = new THREE.Mesh(westGeo, facadeMatWest);
    westMesh.position.set(-L / 2 + d / 2, totalBuildingHeight / 2, 0);
    westMesh.castShadow = true;
    westMesh.receiveShadow = true;
    targetGroup.add(westMesh);

    // Core Zone
    if (innerL > 0 && innerW > 0) {
      const coreGeo = new THREE.BoxGeometry(innerL, totalBuildingHeight, innerW);
      const coreMesh = new THREE.Mesh(coreGeo, coreMat);
      coreMesh.position.set(0, totalBuildingHeight / 2, 0);
      coreMesh.castShadow = true;
      coreMesh.receiveShadow = true;
      targetGroup.add(coreMesh);
    }

    // Rooftop PV array visualizer
    const pvRows = 6;
    const pvCols = Math.max(3, Math.floor(L / 3));
    const pvMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, metalness: 0.8, roughness: 0.2 });
    for (let r = 0; r < pvRows; r++) {
      for (let c = 0; c < pvCols; c++) {
        const pvGeo = new THREE.BoxGeometry((L - 4) / pvCols - 0.4, 0.08, (W - 4) / pvRows - 0.5);
        const pvMesh = new THREE.Mesh(pvGeo, pvMat);
        pvMesh.rotation.x = (15 * Math.PI) / 180; // 15 deg tilt
        pvMesh.position.set(
          -L / 2 + 2 + c * ((L - 4) / pvCols) + ((L - 4) / pvCols) / 2,
          totalBuildingHeight + slabThick + 0.3,
          -W / 2 + 2 + r * ((W - 4) / pvRows) + ((W - 4) / pvRows) / 2
        );
        pvMesh.castShadow = true;
        targetGroup.add(pvMesh);
      }
    }

    // -------------------------------------------------------------
    // B. NEIGHBORING CANYON BUILDINGS
    // -------------------------------------------------------------
    const neighborMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8, // slate-400
      roughness: 0.8,
      metalness: 0.1
    });

    const canyonSpacing = streetWidth;

    // North Neighbor (-Z)
    if (neighborNorthH > 0) {
      const nGeo = new THREE.BoxGeometry(L * 1.4, neighborNorthH, W * 0.9);
      const nMesh = new THREE.Mesh(nGeo, neighborMat);
      nMesh.position.set(0, neighborNorthH / 2, -W / 2 - canyonSpacing - (W * 0.9) / 2);
      nMesh.castShadow = true;
      nMesh.receiveShadow = true;
      root.add(nMesh);
    }

    // South Neighbor (+Z)
    if (neighborSouthH > 0) {
      const sGeo = new THREE.BoxGeometry(L * 1.4, neighborSouthH, W * 0.9);
      const sMesh = new THREE.Mesh(sGeo, neighborMat);
      sMesh.position.set(0, neighborSouthH / 2, W / 2 + canyonSpacing + (W * 0.9) / 2);
      sMesh.castShadow = true;
      sMesh.receiveShadow = true;
      root.add(sMesh);
    }

    // East Neighbor (+X)
    if (neighborEastH > 0) {
      const eGeo = new THREE.BoxGeometry(L * 0.9, neighborEastH, W * 1.4);
      const eMesh = new THREE.Mesh(eGeo, neighborMat);
      eMesh.position.set(L / 2 + canyonSpacing + (L * 0.9) / 2, neighborEastH / 2, 0);
      eMesh.castShadow = true;
      eMesh.receiveShadow = true;
      root.add(eMesh);
    }

    // West Neighbor (-X)
    if (neighborWestH > 0) {
      const wGeo = new THREE.BoxGeometry(L * 0.9, neighborWestH, W * 1.4);
      const wMesh = new THREE.Mesh(wGeo, neighborMat);
      wMesh.position.set(-L / 2 - canyonSpacing - (L * 0.9) / 2, neighborWestH / 2, 0);
      wMesh.castShadow = true;
      wMesh.receiveShadow = true;
      root.add(wMesh);
    }

    // Optional Wireframe helper
    if (showWireframe) {
      root.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const wire = new THREE.LineSegments(
            new THREE.WireframeGeometry((child as THREE.Mesh).geometry),
            new THREE.LineBasicMaterial({ color: 0x0284c7, linewidth: 1, transparent: true, opacity: 0.35 })
          );
          child.add(wire);
        }
      });
    }
  }, [
    L,
    W,
    floorsCount,
    H,
    urbanAzimuth,
    streetWidth,
    neighborNorthH,
    neighborSouthH,
    neighborEastH,
    neighborWestH,
    viewMode,
    showWireframe,
    perimeterDepth,
    urbanShadingSouth,
    urbanShadingNorth,
    urbanShadingEast,
    urbanShadingWest
  ]);

  // Orbit / Pan / Zoom pointer handlers
  const updateCameraPosition = () => {
    if (!cameraRef.current) return;
    const { radius, theta, phi } = sphericalRef.current;
    const target = targetRef.current;

    const x = target.x + radius * Math.sin(phi) * Math.sin(theta);
    const y = target.y + radius * Math.cos(phi);
    const z = target.z + radius * Math.sin(phi) * Math.cos(theta);

    cameraRef.current.position.set(x, y, z);
    cameraRef.current.lookAt(target);
  };

  const handlePointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    if (e.button === 2 || e.shiftKey) {
      isPanningRef.current = true;
    } else {
      isDraggingRef.current = true;
    }
    prevMouseRef.current = { x: e.clientX, y: e.clientY };
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current && !isPanningRef.current) return;

    const dx = e.clientX - prevMouseRef.current.x;
    const dy = e.clientY - prevMouseRef.current.y;
    prevMouseRef.current = { x: e.clientX, y: e.clientY };

    if (isDraggingRef.current) {
      sphericalRef.current.theta -= dx * 0.008;
      sphericalRef.current.phi = Math.max(0.05, Math.min(Math.PI / 2 - 0.05, sphericalRef.current.phi - dy * 0.008));
      updateCameraPosition();
    } else if (isPanningRef.current && cameraRef.current) {
      const panSpeed = 0.12;
      const right = new THREE.Vector3();
      const up = new THREE.Vector3(0, 1, 0);
      cameraRef.current.getWorldDirection(right);
      right.cross(up).normalize();

      targetRef.current.addScaledVector(right, -dx * panSpeed);
      targetRef.current.y += dy * panSpeed;
      updateCameraPosition();
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    isDraggingRef.current = false;
    isPanningRef.current = false;
  };

  const setViewPreset = (preset: 'iso' | 'top' | 'south') => {
    if (preset === 'iso') {
      sphericalRef.current = { radius: 120, theta: Math.PI / 4, phi: Math.PI / 3 };
    } else if (preset === 'top') {
      sphericalRef.current = { radius: 140, theta: 0, phi: 0.05 };
    } else if (preset === 'south') {
      sphericalRef.current = { radius: 110, theta: 0, phi: Math.PI / 2 - 0.1 };
    }
    targetRef.current = new THREE.Vector3(0, totalBuildingHeight / 2, 0);
    updateCameraPosition();
  };

  return (
    <div className="relative w-full rounded-2xl overflow-hidden bg-slate-900 border border-slate-700 shadow-xl select-none">
      {/* 3D WebGL Canvas Mount */}
      <div
        ref={mountRef}
        className="w-full h-[520px] cursor-grab active:cursor-grabbing touch-none overscroll-contain"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onContextMenu={(e) => e.preventDefault()}
      />

      {/* Top Floating Control Bar */}
      <div className="absolute top-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 pointer-events-none">
        {/* Left: View Mode Switcher */}
        <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-700/80 shadow-lg pointer-events-auto">
          <button
            type="button"
            onClick={() => setViewMode('architectural')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
              viewMode === 'architectural'
                ? 'bg-teal-600 text-white shadow'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            Realistic
          </button>
          <button
            type="button"
            onClick={() => setViewMode('thermal_zones')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
              viewMode === 'thermal_zones'
                ? 'bg-amber-600 text-white shadow'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            Thermal Zones
          </button>
          <button
            type="button"
            onClick={() => setViewMode('solar_heatmap')}
            className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition ${
              viewMode === 'solar_heatmap'
                ? 'bg-rose-600 text-white shadow'
                : 'text-slate-300 hover:text-white hover:bg-slate-800'
            }`}
          >
            Solar Potential
          </button>

          <span className="w-px h-4 bg-slate-700 mx-1" />

          <button
            type="button"
            onClick={() => setShowWireframe(!showWireframe)}
            className={`p-1.5 rounded-lg text-xs font-medium border transition ${
              showWireframe ? 'bg-sky-950 text-sky-400 border-sky-500' : 'text-slate-400 hover:text-white border-transparent'
            }`}
            title="Toggle Wireframe Edges"
          >
            <Layers className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Camera Orientation Presets */}
        <div className="flex items-center gap-1 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-xl border border-slate-700/80 shadow-lg pointer-events-auto">
          <button
            type="button"
            onClick={() => setViewPreset('iso')}
            className="px-2 py-1 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            3D Axon
          </button>
          <button
            type="button"
            onClick={() => setViewPreset('top')}
            className="px-2 py-1 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            Top 2D
          </button>
          <button
            type="button"
            onClick={() => setViewPreset('south')}
            className="px-2 py-1 text-xs font-medium text-slate-300 hover:text-white hover:bg-slate-800 rounded-lg transition"
          >
            South Elev.
          </button>
          <button
            type="button"
            onClick={() => setViewPreset('iso')}
            className="p-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800"
            title="Reset Camera Target"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Bottom Floating Solar Time Scrubber Bar */}
      <div className="absolute bottom-3 left-3 right-3 bg-slate-900/90 backdrop-blur-md p-3 rounded-xl border border-slate-700/80 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          {/* Solar Position Display */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Sun className="w-4 h-4 animate-spin-slow" />
            </div>
            <div>
              <div className="text-xs font-bold text-white flex items-center gap-2">
                <span>Solar Alt: {solarPos.alt > 0 ? `${solarPos.alt.toFixed(1)}°` : 'Night'}</span>
                <span className="text-slate-400">•</span>
                <span>Azimuth: {solarPos.az.toFixed(0)}°</span>
              </div>
              <div className="text-[10px] text-slate-400">
                Real-time dynamic shadow casting onto target building & canyon
              </div>
            </div>
          </div>

          {/* Quick Solstice Buttons */}
          <div className="flex items-center gap-1.5 text-xs">
            <button
              type="button"
              onClick={() => { setSelectedMonth(6); setSelectedHour(12); }}
              className={`px-2 py-1 rounded text-[11px] font-medium border ${
                selectedMonth === 6 ? 'bg-amber-950 text-amber-300 border-amber-600' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              Summer Solstice (21 Jun)
            </button>
            <button
              type="button"
              onClick={() => { setSelectedMonth(3); setSelectedHour(12); }}
              className={`px-2 py-1 rounded text-[11px] font-medium border ${
                selectedMonth === 3 ? 'bg-emerald-950 text-emerald-300 border-emerald-600' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              Equinox (21 Mar)
            </button>
            <button
              type="button"
              onClick={() => { setSelectedMonth(12); setSelectedHour(12); }}
              className={`px-2 py-1 rounded text-[11px] font-medium border ${
                selectedMonth === 12 ? 'bg-sky-950 text-sky-300 border-sky-600' : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
              }`}
            >
              Winter Solstice (21 Dec)
            </button>
          </div>

          {/* Interactive Sliders: Month & Hour */}
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 flex items-center gap-1 font-semibold">
                <Calendar className="w-3 h-3 text-teal-400" />
                M{selectedMonth}
              </span>
              <input
                type="range"
                min={1}
                max={12}
                step={1}
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="w-20 accent-teal-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-400 flex items-center gap-1 font-semibold">
                <Clock className="w-3 h-3 text-amber-400" />
                {formatDecimalHour(selectedHour)}
              </span>
              <input
                type="range"
                min={6}
                max={20}
                step={0.5}
                value={selectedHour}
                onChange={(e) => setSelectedHour(Number(e.target.value))}
                className="w-28 accent-amber-500 cursor-pointer"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Orbit hint label */}
      <div className="absolute bottom-16 right-3 pointer-events-none text-[10px] text-slate-400 bg-slate-900/60 px-2 py-0.5 rounded backdrop-blur border border-slate-800">
        🖱️ Drag: Orbit • Right-Click: Pan • Scroll: Zoom
      </div>
    </div>
  );
};

function formatDecimalHour(h: number): string {
  const hr = Math.floor(h);
  const min = Math.round((h - hr) * 60);
  return `${hr.toString().padStart(2, '0')}:${min.toString().padStart(2, '0')}`;
}

function getHeatmapColor(val01: number): number {
  const clamped = Math.max(0, Math.min(1, val01));
  // Heatmap gradient from Blue (0) -> Cyan (0.33) -> Yellow (0.66) -> Red (1.0)
  const color = new THREE.Color();
  if (clamped < 0.33) {
    color.setRGB(0.1, 0.2 + clamped * 2, 0.9);
  } else if (clamped < 0.66) {
    color.setRGB((clamped - 0.33) * 3, 0.85, 0.2);
  } else {
    color.setRGB(0.95, Math.max(0.1, 0.85 - (clamped - 0.66) * 2.5), 0.1);
  }
  return color.getHex();
}

