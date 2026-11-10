// ============================================================================
// POLIMI STRUCTURAL EUROCODE PRE-DIMENSIONING STUDIO
// 3D Interactive Structural Bay & Load Path Viewer (Three.js WebGL)
// Supports Orbit, Pan, Zoom, Interactive Member Selection, and Live Eta Color Coding
// ============================================================================

import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import {
  RotateCcw,
  Eye,
  Maximize2,
  Box,
  Layers,
  ArrowDown,
  Sparkles,
  Info
} from 'lucide-react';
import { StructuralBayConfig } from '../utils/eurocodeCalculators';

export type SelectedMemberType =
  | 'rc_slab'
  | 'rc_beam'
  | 'rc_wall'
  | 'rc_column'
  | 'steel_beam'
  | 'steel_column'
  | 'clt_slab'
  | 'clt_wall'
  | 'wood_beam'
  | 'wood_column'
  | 'masonry_wall';

interface StructuralBay3DViewerProps {
  config: StructuralBayConfig;
  memberUtilisations: Record<string, { eta_max: number; status: string }>;
  activeMember: SelectedMemberType;
  onSelectMember: (member: SelectedMemberType) => void;
}

export const StructuralBay3DViewer: React.FC<StructuralBay3DViewerProps> = ({
  config,
  memberUtilisations,
  activeMember,
  onSelectMember
}) => {
  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());
  const resetCameraRef = useRef<(() => void) | null>(null);

  // Persistent camera orbit & zoom state across parameter updates
  const cameraStateRef = useRef<{ theta: number; phi: number; distance: number | null }>({
    theta: 0.8,
    phi: 0.6,
    distance: null
  });

  // Interactive UI toggles
  const [showLoads, setShowLoads] = useState(true);
  const [showDimensions, setShowDimensions] = useState(true);
  const [wireframe, setWireframe] = useState(false);
  const [hoveredMember, setHoveredMember] = useState<{ id: string; name: string; eta: number } | null>(null);

  // Helper function to pick color based on utilisation eta_max
  const getEtaColorHex = (eta: number): number => {
    if (eta <= 0.80) return 0x10b981; // emerald-500
    if (eta <= 1.00) return 0xf59e0b; // amber-500
    return 0xef4444; // rose-500
  };

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    const width = container.clientWidth;
    const height = container.clientHeight || 420;

    // 1. Scene, Camera & WebGL Renderer
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x090d16); // slate-950

    const camera = new THREE.PerspectiveCamera(40, width / height, 0.1, 100);
    cameraRef.current = camera;
    camera.position.set(config.spanL * 1.5, config.storeyHeightH * 2.2, config.tributaryWidthBtr * 2.5);
    camera.lookAt(config.spanL / 2, (config.storeyHeightH * config.numberOfStoreys) / 2, config.tributaryWidthBtr / 2);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    rendererRef.current = renderer;

    while (container.firstChild) {
      container.removeChild(container.firstChild);
    }
    container.appendChild(renderer.domElement);

    // 2. Lighting Setup
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.7);
    scene.add(ambientLight);

    const dirLight = new THREE.DirectionalLight(0xffffff, 1.2);
    dirLight.position.set(20, 30, 20);
    dirLight.castShadow = true;
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    scene.add(dirLight);

    const fillLight = new THREE.DirectionalLight(0x38bdf8, 0.4); // soft sky blue fill
    fillLight.position.set(-15, 10, -15);
    scene.add(fillLight);

    // 3. Ground Grid
    const gridHelper = new THREE.GridHelper(Math.max(config.spanL, config.tributaryWidthBtr) * 3, 20, 0x1e293b, 0x0f172a);
    gridHelper.position.y = 0;
    scene.add(gridHelper);

    // 4. Build 3D Bay Geometry (Columns, Beams, Slabs, Walls)
    const interactiveMeshes: THREE.Mesh[] = [];

    const L = config.spanL;
    const B = config.tributaryWidthBtr;
    const H = config.storeyHeightH;
    const nFloors = config.numberOfStoreys;

    // Material theme colors
    let baseMatColor = 0x94a3b8;
    if (config.materialSystem === 'RC') baseMatColor = 0x94a3b8;
    else if (config.materialSystem === 'Steel') baseMatColor = 0x64748b;
    else if (config.materialSystem === 'Timber') baseMatColor = 0xd97706;
    else if (config.materialSystem === 'Masonry') baseMatColor = 0xb45309;

    // Build storeys
    for (let fl = 0; fl < nFloors; fl++) {
      const baseY = fl * H;
      const topY = (fl + 1) * H;

      // COLUMNS or WALLS
      if (config.materialSystem === 'Masonry') {
        // Load-bearing wall strip along Z=0 and Z=B
        const wallGeo = new THREE.BoxGeometry(L, H, 0.25);
        const wallEta = memberUtilisations['masonry_wall']?.eta_max || 0.85;
        const wallMat = new THREE.MeshStandardMaterial({
          color: getEtaColorHex(wallEta),
          wireframe,
          roughness: 0.85,
          metalness: 0.1
        });
        const wallFront = new THREE.Mesh(wallGeo, wallMat);
        wallFront.position.set(L / 2, baseY + H / 2, 0);
        wallFront.castShadow = true;
        wallFront.receiveShadow = true;
        wallFront.userData = { id: 'masonry_wall', name: 'Masonry Wall Strip (250mm)', eta: wallEta };
        scene.add(wallFront);
        interactiveMeshes.push(wallFront);
      } else {
        // 4 Columns at bay corners: (0,0), (L,0), (0,B), (L,B)
        const colPositions = [
          [0, 0],
          [L, 0],
          [0, B],
          [L, B]
        ];
        const colSize = config.materialSystem === 'RC' ? 0.4 : config.materialSystem === 'Steel' ? 0.24 : 0.22;
        const colId = config.materialSystem === 'RC' ? 'rc_column' : config.materialSystem === 'Steel' ? 'steel_column' : 'wood_column';
        const colEta = memberUtilisations[colId]?.eta_max || 0.35;
        const colColor = getEtaColorHex(colEta);

        const colGeo = new THREE.BoxGeometry(colSize, H, colSize);
        const colMat = new THREE.MeshStandardMaterial({
          color: colColor,
          wireframe,
          roughness: 0.5,
          metalness: config.materialSystem === 'Steel' ? 0.6 : 0.1
        });

        colPositions.forEach(([cx, cz]) => {
          const colMesh = new THREE.Mesh(colGeo, colMat);
          colMesh.position.set(cx, baseY + H / 2, cz);
          colMesh.castShadow = true;
          colMesh.receiveShadow = true;
          colMesh.userData = { id: colId, name: `${config.materialSystem} Column`, eta: colEta };
          scene.add(colMesh);
          interactiveMeshes.push(colMesh);
        });
      }

      // PRIMARY & SECONDARY BEAMS (at floor level topY)
      const beamId = config.materialSystem === 'RC' ? 'rc_beam' : config.materialSystem === 'Steel' ? 'steel_beam' : 'wood_beam';
      const beamEta = memberUtilisations[beamId]?.eta_max || 0.55;
      const beamColor = getEtaColorHex(beamEta);

      const bWidth = config.materialSystem === 'RC' ? 0.3 : 0.15;
      const bHeight = config.materialSystem === 'RC' ? 0.55 : 0.35;

      const beamMat = new THREE.MeshStandardMaterial({
        color: beamColor,
        wireframe,
        roughness: 0.4,
        metalness: config.materialSystem === 'Steel' ? 0.7 : 0.15
      });

      // Primary Beam along X-axis (span L) at Z = 0 and Z = B
      const pBeamGeo = new THREE.BoxGeometry(L, bHeight, bWidth);
      const b1 = new THREE.Mesh(pBeamGeo, beamMat);
      b1.position.set(L / 2, topY - bHeight / 2, 0);
      b1.castShadow = true;
      b1.userData = { id: beamId, name: `Primary Beam (Span ${L}m)`, eta: beamEta };
      scene.add(b1);
      interactiveMeshes.push(b1);

      const b2 = new THREE.Mesh(pBeamGeo, beamMat);
      b2.position.set(L / 2, topY - bHeight / 2, B);
      b2.castShadow = true;
      b2.userData = { id: beamId, name: `Primary Beam (Span ${L}m)`, eta: beamEta };
      scene.add(b2);
      interactiveMeshes.push(b2);

      // Transverse Edge Beams along Z
      const secBeamGeo = new THREE.BoxGeometry(bWidth, bHeight, B);
      const b3 = new THREE.Mesh(secBeamGeo, beamMat);
      b3.position.set(0, topY - bHeight / 2, B / 2);
      b3.castShadow = true;
      scene.add(b3);

      const b4 = new THREE.Mesh(secBeamGeo, beamMat);
      b4.position.set(L, topY - bHeight / 2, B / 2);
      b4.castShadow = true;
      scene.add(b4);

      // SLAB (One-Way Spanning Floor)
      const slabId = config.materialSystem === 'RC' ? 'rc_slab' : config.materialSystem === 'Timber' ? 'clt_slab' : 'rc_slab';
      const slabEta = memberUtilisations[slabId]?.eta_max || 0.60;
      const slabColor = getEtaColorHex(slabEta);
      const slabThickness = config.materialSystem === 'RC' ? 0.22 : 0.16;

      const slabGeo = new THREE.BoxGeometry(L, slabThickness, B);
      const slabMat = new THREE.MeshStandardMaterial({
        color: slabColor,
        wireframe,
        transparent: true,
        opacity: 0.88,
        roughness: 0.6
      });
      const slabMesh = new THREE.Mesh(slabGeo, slabMat);
      slabMesh.position.set(L / 2, topY + slabThickness / 2, B / 2);
      slabMesh.castShadow = true;
      slabMesh.receiveShadow = true;
      slabMesh.userData = { id: slabId, name: `Floor Slab (${slabThickness * 1000}mm)`, eta: slabEta };
      scene.add(slabMesh);
      interactiveMeshes.push(slabMesh);

      // Downward Load Takedown Arrows on Roof / Top Slab
      if (showLoads && fl === nFloors - 1) {
        const arrowGroup = new THREE.Group();
        const arrowCols = 5;
        const arrowRows = 3;
        for (let ax = 1; ax < arrowCols; ax++) {
          for (let az = 1; az < arrowRows; az++) {
            const px = (ax / arrowCols) * L;
            const pz = (az / arrowRows) * B;
            const dir = new THREE.Vector3(0, -1, 0);
            const origin = new THREE.Vector3(px, topY + slabThickness + 0.8, pz);
            const arrow = new THREE.ArrowHelper(dir, origin, 0.7, 0x38bdf8, 0.2, 0.12);
            arrowGroup.add(arrow);
          }
        }
        scene.add(arrowGroup);
      }
    }

    // 5. Mouse Orbit / Drag Controls (Persistent Across Param Updates)
    let isDragging = false;
    let previousMousePosition = { x: 0, y: 0 };
    let cameraAngleTheta = cameraStateRef.current.theta;
    let cameraAnglePhi = cameraStateRef.current.phi;
    const defaultDist = Math.max(L, B, H * nFloors) * 1.8;
    let cameraDistance = cameraStateRef.current.distance ?? defaultDist;

    const updateCameraPos = () => {
      const targetX = L / 2;
      const targetY = (H * nFloors) / 2;
      const targetZ = B / 2;

      camera.position.x = targetX + cameraDistance * Math.sin(cameraAngleTheta) * Math.cos(cameraAnglePhi);
      camera.position.y = targetY + cameraDistance * Math.sin(cameraAnglePhi);
      camera.position.z = targetZ + cameraDistance * Math.cos(cameraAngleTheta) * Math.cos(cameraAnglePhi);
      camera.lookAt(targetX, targetY, targetZ);
    };
    updateCameraPos();

    resetCameraRef.current = () => {
      cameraStateRef.current = { theta: 0.8, phi: 0.6, distance: defaultDist };
      cameraAngleTheta = 0.8;
      cameraAnglePhi = 0.6;
      cameraDistance = defaultDist;
      updateCameraPos();
    };

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      previousMousePosition = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      if (isDragging) {
        const deltaX = e.clientX - previousMousePosition.x;
        const deltaY = e.clientY - previousMousePosition.y;

        cameraAngleTheta -= deltaX * 0.008;
        cameraAnglePhi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, cameraAnglePhi + deltaY * 0.008));
        cameraStateRef.current.theta = cameraAngleTheta;
        cameraStateRef.current.phi = cameraAnglePhi;

        updateCameraPos();
        previousMousePosition = { x: e.clientX, y: e.clientY };
      } else {
        // Raycasting for member hover
        raycasterRef.current.setFromCamera(mouseRef.current, camera);
        const intersects = raycasterRef.current.intersectObjects(interactiveMeshes);
        if (intersects.length > 0) {
          const u = intersects[0].object.userData;
          if (u?.id) {
            setHoveredMember({ id: u.id, name: u.name, eta: u.eta });
            renderer.domElement.style.cursor = 'pointer';
          }
        } else {
          setHoveredMember(null);
          renderer.domElement.style.cursor = 'grab';
        }
      }
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraDistance = Math.max(3, Math.min(50, cameraDistance + e.deltaY * 0.015));
      cameraStateRef.current.distance = cameraDistance;
      updateCameraPos();
    };

    const onClick = () => {
      raycasterRef.current.setFromCamera(mouseRef.current, camera);
      const intersects = raycasterRef.current.intersectObjects(interactiveMeshes);
      if (intersects.length > 0) {
        const u = intersects[0].object.userData;
        if (u?.id) {
          onSelectMember(u.id as SelectedMemberType);
        }
      }
    };

    const dom = renderer.domElement;
    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('wheel', onWheel, { passive: false });
    dom.addEventListener('click', onClick);

    // Animation Loop
    let animId = 0;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      renderer.render(scene, camera);
    };
    animate();

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight || 420;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animId);
      dom.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('wheel', onWheel);
      dom.removeEventListener('click', onClick);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    };
  }, [config, memberUtilisations, wireframe, showLoads, showDimensions, onSelectMember]);

  return (
    <div className="relative w-full h-[460px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
      {/* 3D WebGL Canvas */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Floating Control Bar */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/80 shadow-lg text-xs">
        <span className="font-extrabold text-sky-400 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
          <Box className="w-3.5 h-3.5 text-sky-400" />
          3D Multi-Storey Bay: {config.spanL}m × {config.tributaryWidthBtr}m
        </span>
        <span className="text-slate-600">|</span>
        <span className="text-slate-300 font-semibold">
          {config.numberOfStoreys} Storeys ({config.storeyHeightH}m)
        </span>
      </div>

      {/* Top Right Quick Toggles */}
      <div className="absolute top-3 right-3 z-10 flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setShowLoads((v) => !v)}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 border ${
            showLoads
              ? 'bg-sky-600/30 text-sky-300 border-sky-500/50'
              : 'bg-slate-900/80 text-slate-400 border-slate-700'
          }`}
          title="Toggle characteristic load takedown vectors"
        >
          <ArrowDown className="w-3.5 h-3.5" />
          Load Path
        </button>
        <button
          type="button"
          onClick={() => setWireframe((v) => !v)}
          className={`px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 border ${
            wireframe
              ? 'bg-amber-600/30 text-amber-300 border-amber-500/50'
              : 'bg-slate-900/80 text-slate-400 border-slate-700'
          }`}
          title="Toggle wireframe mode"
        >
          <Layers className="w-3.5 h-3.5" />
          Wireframe
        </button>
        <button
          type="button"
          onClick={() => resetCameraRef.current?.()}
          className="px-2.5 py-1 rounded-lg text-xs font-bold transition flex items-center gap-1 border bg-slate-900/80 text-slate-400 border-slate-700 hover:text-white hover:bg-slate-800"
          title="Reset 3D Bay camera view to default"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          Reset View
        </button>
      </div>

      {/* Hovered Member Floating Badge */}
      {hoveredMember && (
        <div className="absolute bottom-4 left-4 z-10 bg-slate-900/95 backdrop-blur-md p-2.5 rounded-xl border border-sky-500/80 shadow-2xl text-xs space-y-1">
          <div className="font-extrabold text-white flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{
              backgroundColor: hoveredMember.eta <= 0.8 ? '#10b981' : hoveredMember.eta <= 1.0 ? '#f59e0b' : '#ef4444'
            }} />
            {hoveredMember.name}
          </div>
          <div className="text-[11px] text-slate-400 flex items-center gap-2">
            <span>Governing Utilisation:</span>
            <span className={`font-mono font-bold ${
              hoveredMember.eta <= 0.8 ? 'text-emerald-400' : hoveredMember.eta <= 1.0 ? 'text-amber-400' : 'text-rose-400'
            }`}>
              ηmax = {hoveredMember.eta.toFixed(3)} ({Math.round(hoveredMember.eta * 100)}%)
            </span>
          </div>
          <div className="text-[10px] text-teal-400 italic">Click member to open detailed cross-section in Step 3 ↗</div>
        </div>
      )}

      {/* Bottom Right Legend */}
      <div className="absolute bottom-4 right-4 z-10 bg-slate-900/85 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-800 text-[11px] space-y-1 text-slate-300 shadow">
        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Eurocode Utilisation ηmax</div>
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> &le; 0.80 Optimal
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-500" /> 0.80–1.00 High
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> &gt; 1.00 Exceeded
          </span>
        </div>
      </div>
    </div>
  );
};

