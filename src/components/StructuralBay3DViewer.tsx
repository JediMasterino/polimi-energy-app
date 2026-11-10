// ============================================================================
// POLIMI STRUCTURAL EUROCODE PRE-DIMENSIONING STUDIO
// 3D Interactive Structural Bay & Load Path Viewer (Three.js WebGL)
// Supports Orbit, Pan, Zoom, Interactive Member Selection, and Live Eta Color Coding
// ============================================================================

import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import {
  RotateCcw,
  Eye,
  Maximize2,
  Box,
  Layers,
  ArrowDown,
  Sparkles,
  Info,
  ExternalLink,
  MousePointerClick,
  ShieldCheck,
  ArrowRight
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

const getMemberDisplayName = (id: string, materialSystem?: string): string => {
  switch (id) {
    case 'rc_slab':
      return 'Reinforced Concrete Slab (EN 1992)';
    case 'rc_beam':
      return 'Reinforced Concrete Beam (EN 1992)';
    case 'rc_column':
      return 'Reinforced Concrete Column (EN 1992)';
    case 'rc_wall':
      return 'Reinforced Concrete Wall (EN 1992)';
    case 'steel_beam':
      return 'Structural Steel Beam (EN 1993)';
    case 'steel_column':
      return 'Structural Steel Column (EN 1993)';
    case 'clt_slab':
      return 'Cross-Laminated Timber Slab (ETA / EN 1995)';
    case 'clt_wall':
      return 'CLT Wall Panel (ETA / EN 1995)';
    case 'wood_beam':
      return 'Glulam Timber Beam (EN 1995)';
    case 'wood_column':
      return 'Glulam Timber Column (EN 1995)';
    case 'masonry_wall':
      return 'Unreinforced Masonry Wall Strip (EN 1996)';
    default:
      return `${materialSystem || ''} Structural Element`;
  }
};

const getAvailableMembersForSystem = (system: string): { id: SelectedMemberType; label: string }[] => {
  if (system === 'RC') {
    return [
      { id: 'rc_slab', label: 'RC Slab' },
      { id: 'rc_beam', label: 'RC Beam' },
      { id: 'rc_column', label: 'RC Column' },
      { id: 'rc_wall', label: 'RC Wall' }
    ];
  }
  if (system === 'Steel') {
    return [
      { id: 'steel_beam', label: 'Steel Beam' },
      { id: 'steel_column', label: 'Steel Column' }
    ];
  }
  if (system === 'Timber') {
    return [
      { id: 'clt_slab', label: 'CLT Slab' },
      { id: 'clt_wall', label: 'CLT Wall' },
      { id: 'wood_beam', label: 'Glulam Beam' },
      { id: 'wood_column', label: 'Glulam Column' }
    ];
  }
  return [
    { id: 'masonry_wall', label: 'Masonry Wall Strip' }
  ];
};

// Priority hierarchy so that roof/floor slabs (which cover the entire footprint)
// do not intercept or shadow clicks aimed at columns, beams, or walls underneath!
const MEMBER_PICK_PRIORITY: Record<string, number> = {
  rc_column: 10,
  steel_column: 10,
  wood_column: 10,
  rc_beam: 8,
  steel_beam: 8,
  wood_beam: 8,
  masonry_wall: 6,
  rc_wall: 6,
  clt_wall: 6,
  rc_slab: 2,
  clt_slab: 2
};

interface StructuralBay3DViewerProps {
  config: StructuralBayConfig;
  memberUtilisations: Record<string, { eta_max: number; status: string }>;
  activeMember: SelectedMemberType;
  onSelectMember: (member: SelectedMemberType) => void;
  onNavigateToStep3?: (member: SelectedMemberType) => void;
}

export const StructuralBay3DViewer: React.FC<StructuralBay3DViewerProps> = ({
  config,
  memberUtilisations,
  activeMember,
  onSelectMember,
  onNavigateToStep3
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

  // Keep refs for callback stability in event listeners
  const onSelectMemberRef = useRef(onSelectMember);
  const onNavigateToStep3Ref = useRef(onNavigateToStep3);

  useEffect(() => {
    onSelectMemberRef.current = onSelectMember;
    onNavigateToStep3Ref.current = onNavigateToStep3;
  });

  const availableMembers = useMemo(() => getAvailableMembersForSystem(config.materialSystem), [config.materialSystem]);

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

    // Invisible hit proxy material (transparent with depthWrite=false so it doesn't affect graphics)
    const hitProxyMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.0, depthWrite: false });

    const attachActiveHighlight = (mesh: THREE.Mesh, geo: THREE.BufferGeometry, memberId: string) => {
      if (memberId === activeMember) {
        if (mesh.material instanceof THREE.MeshStandardMaterial) {
          const clonedMat = mesh.material.clone();
          clonedMat.emissive = new THREE.Color(0x0284c7);
          clonedMat.emissiveIntensity = 0.35;
          mesh.material = clonedMat;
        }
        const edges = new THREE.EdgesGeometry(geo);
        const line = new THREE.LineSegments(
          edges,
          new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 2 })
        );
        mesh.add(line);
      }
    };

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
        // Load-bearing wall strips along Z=0 and Z=B
        const wallGeo = new THREE.BoxGeometry(L, H, 0.25);
        const wallEta = memberUtilisations['masonry_wall']?.eta_max || 0.85;
        const wallMat = new THREE.MeshStandardMaterial({
          color: getEtaColorHex(wallEta),
          wireframe,
          roughness: 0.85,
          metalness: 0.1
        });

        // Front Wall (Z = 0)
        const wallFront = new THREE.Mesh(wallGeo, wallMat);
        wallFront.position.set(L / 2, baseY + H / 2, 0);
        wallFront.castShadow = true;
        wallFront.receiveShadow = true;
        wallFront.userData = { id: 'masonry_wall', name: 'Masonry Wall Strip (250mm)', eta: wallEta };
        attachActiveHighlight(wallFront, wallGeo, 'masonry_wall');
        scene.add(wallFront);
        interactiveMeshes.push(wallFront);

        // Back Wall (Z = B)
        const wallBack = new THREE.Mesh(wallGeo, wallMat);
        wallBack.position.set(L / 2, baseY + H / 2, B);
        wallBack.castShadow = true;
        wallBack.receiveShadow = true;
        wallBack.userData = { id: 'masonry_wall', name: 'Masonry Wall Strip (250mm)', eta: wallEta };
        attachActiveHighlight(wallBack, wallGeo, 'masonry_wall');
        scene.add(wallBack);
        interactiveMeshes.push(wallBack);
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

        // Generous invisible hit-box proxy (0.65m wide) so columns are effortless to tap on touchscreens or with mouse
        const colHitGeo = new THREE.BoxGeometry(Math.max(0.65, colSize * 1.6), H * 1.05, Math.max(0.65, colSize * 1.6));

        colPositions.forEach(([cx, cz]) => {
          const colMesh = new THREE.Mesh(colGeo, colMat);
          colMesh.position.set(cx, baseY + H / 2, cz);
          colMesh.castShadow = true;
          colMesh.receiveShadow = true;
          colMesh.userData = { id: colId, name: `${config.materialSystem} Column`, eta: colEta };
          attachActiveHighlight(colMesh, colGeo, colId);
          scene.add(colMesh);
          interactiveMeshes.push(colMesh);

          const colHitProxy = new THREE.Mesh(colHitGeo, hitProxyMat);
          colHitProxy.position.set(cx, baseY + H / 2, cz);
          colHitProxy.userData = { id: colId, name: `${config.materialSystem} Column`, eta: colEta };
          scene.add(colHitProxy);
          interactiveMeshes.push(colHitProxy);
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

      // Generous invisible hit-box proxy for beams (0.6m wide)
      const pBeamHitGeo = new THREE.BoxGeometry(L * 1.02, Math.max(0.65, bHeight * 1.2), Math.max(0.6, bWidth * 1.8));

      // Primary Beam along X-axis (span L) at Z = 0 and Z = B
      const pBeamGeo = new THREE.BoxGeometry(L, bHeight, bWidth);
      const b1 = new THREE.Mesh(pBeamGeo, beamMat);
      b1.position.set(L / 2, topY - bHeight / 2, 0);
      b1.castShadow = true;
      b1.userData = { id: beamId, name: `Primary Beam (Span ${L}m)`, eta: beamEta };
      attachActiveHighlight(b1, pBeamGeo, beamId);
      scene.add(b1);
      interactiveMeshes.push(b1);

      const b1Hit = new THREE.Mesh(pBeamHitGeo, hitProxyMat);
      b1Hit.position.set(L / 2, topY - bHeight / 2, 0);
      b1Hit.userData = { id: beamId, name: `Primary Beam (Span ${L}m)`, eta: beamEta };
      scene.add(b1Hit);
      interactiveMeshes.push(b1Hit);

      const b2 = new THREE.Mesh(pBeamGeo, beamMat);
      b2.position.set(L / 2, topY - bHeight / 2, B);
      b2.castShadow = true;
      b2.userData = { id: beamId, name: `Primary Beam (Span ${L}m)`, eta: beamEta };
      attachActiveHighlight(b2, pBeamGeo, beamId);
      scene.add(b2);
      interactiveMeshes.push(b2);

      const b2Hit = new THREE.Mesh(pBeamHitGeo, hitProxyMat);
      b2Hit.position.set(L / 2, topY - bHeight / 2, B);
      b2Hit.userData = { id: beamId, name: `Primary Beam (Span ${L}m)`, eta: beamEta };
      scene.add(b2Hit);
      interactiveMeshes.push(b2Hit);

      // Transverse Edge Beams along Z at X = 0 and X = L
      const secBeamGeo = new THREE.BoxGeometry(bWidth, bHeight, B);
      const secBeamHitGeo = new THREE.BoxGeometry(Math.max(0.6, bWidth * 1.8), Math.max(0.65, bHeight * 1.2), B * 1.02);

      const b3 = new THREE.Mesh(secBeamGeo, beamMat);
      b3.position.set(0, topY - bHeight / 2, B / 2);
      b3.castShadow = true;
      b3.userData = { id: beamId, name: `${config.materialSystem} Secondary Beam`, eta: beamEta };
      attachActiveHighlight(b3, secBeamGeo, beamId);
      scene.add(b3);
      interactiveMeshes.push(b3);

      const b3Hit = new THREE.Mesh(secBeamHitGeo, hitProxyMat);
      b3Hit.position.set(0, topY - bHeight / 2, B / 2);
      b3Hit.userData = { id: beamId, name: `${config.materialSystem} Secondary Beam`, eta: beamEta };
      scene.add(b3Hit);
      interactiveMeshes.push(b3Hit);

      const b4 = new THREE.Mesh(secBeamGeo, beamMat);
      b4.position.set(L, topY - bHeight / 2, B / 2);
      b4.castShadow = true;
      b4.userData = { id: beamId, name: `${config.materialSystem} Secondary Beam`, eta: beamEta };
      attachActiveHighlight(b4, secBeamGeo, beamId);
      scene.add(b4);
      interactiveMeshes.push(b4);

      const b4Hit = new THREE.Mesh(secBeamHitGeo, hitProxyMat);
      b4Hit.position.set(L, topY - bHeight / 2, B / 2);
      b4Hit.userData = { id: beamId, name: `${config.materialSystem} Secondary Beam`, eta: beamEta };
      scene.add(b4Hit);
      interactiveMeshes.push(b4Hit);

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
      attachActiveHighlight(slabMesh, slabGeo, slabId);
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

    // Helper: Resolve the intended member from raycaster intersections
    // Prioritizes columns > beams > walls > slabs so the roof slab never intercepts columns/beams!
    const resolveIntersectedMember = (
      intersects: THREE.Intersection[]
    ): { id: SelectedMemberType; name: string; eta: number } | null => {
      if (!intersects || intersects.length === 0) return null;

      const candidates: { id: SelectedMemberType; name: string; eta: number; priority: number; distance: number }[] = [];

      for (const hit of intersects) {
        let targetObj: THREE.Object3D | null = hit.object;
        while (targetObj && !targetObj.userData?.id && targetObj.parent) {
          targetObj = targetObj.parent;
        }
        const u = targetObj?.userData;
        if (u?.id) {
          const id = u.id as SelectedMemberType;
          if (!candidates.some((c) => c.id === id)) {
            candidates.push({
              id,
              name: u.name || getMemberDisplayName(id),
              eta: u.eta ?? 0.5,
              priority: MEMBER_PICK_PRIORITY[id] || 4,
              distance: hit.distance
            });
          }
        }
      }

      if (candidates.length === 0) return null;
      if (candidates.length === 1) return candidates[0];

      // Sort by priority descending (columns 10 > beams 8 > walls 6 > slabs 2), then by distance
      candidates.sort((a, b) => {
        if (b.priority !== a.priority) {
          return b.priority - a.priority;
        }
        return a.distance - b.distance;
      });

      return candidates[0];
    };

    // 5. Unified Pointer Orbit & Selection Controls (Touchscreen, Pen & Mouse)
    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let startTime = 0;
    let previousPosition = { x: 0, y: 0 };
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

    const onPointerDown = (e: PointerEvent) => {
      // Only process primary interaction
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      startTime = Date.now();
      previousPosition = { x: e.clientX, y: e.clientY };
    };

    const onPointerMove = (e: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      const mouseX = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      const mouseY = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      mouseRef.current.x = mouseX;
      mouseRef.current.y = mouseY;

      if (isDragging) {
        const deltaX = e.clientX - previousPosition.x;
        const deltaY = e.clientY - previousPosition.y;

        cameraAngleTheta -= deltaX * 0.008;
        cameraAnglePhi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, cameraAnglePhi + deltaY * 0.008));
        cameraStateRef.current.theta = cameraAngleTheta;
        cameraStateRef.current.phi = cameraAnglePhi;

        updateCameraPos();
        previousPosition = { x: e.clientX, y: e.clientY };
      } else {
        // Priority-aware hover inspection
        raycasterRef.current.setFromCamera(mouseRef.current, camera);
        const intersects = raycasterRef.current.intersectObjects(interactiveMeshes, true);
        const resolved = resolveIntersectedMember(intersects);
        if (resolved) {
          setHoveredMember({ id: resolved.id, name: resolved.name, eta: resolved.eta });
          renderer.domElement.style.cursor = 'pointer';
        } else {
          setHoveredMember(null);
          renderer.domElement.style.cursor = 'grab';
        }
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!isDragging) return;
      isDragging = false;

      const moveDist = Math.hypot(e.clientX - startX, e.clientY - startY);
      const elapsed = Date.now() - startTime;

      // Deliberate click or touch tap:
      // Accepts normal mouse click or finger tap (up to 18px movement or < 400ms quick tap)
      if (moveDist <= 18 || (elapsed < 400 && moveDist <= 35)) {
        const rect = renderer.domElement.getBoundingClientRect();
        const clickMouse = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        );
        raycasterRef.current.setFromCamera(clickMouse, camera);
        const intersects = raycasterRef.current.intersectObjects(interactiveMeshes, true);
        const resolved = resolveIntersectedMember(intersects);
        if (resolved) {
          onSelectMemberRef.current?.(resolved.id);
        }
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      cameraDistance = Math.max(3, Math.min(50, cameraDistance + e.deltaY * 0.015));
      cameraStateRef.current.distance = cameraDistance;
      updateCameraPos();
    };

    const dom = renderer.domElement;
    dom.style.touchAction = 'none'; // Critical for immediate touchscreen responsiveness
    dom.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    dom.addEventListener('wheel', onWheel, { passive: false });

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
      dom.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('wheel', onWheel);
      window.removeEventListener('resize', handleResize);
      renderer.dispose();
      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
    };
  }, [config, memberUtilisations, wireframe, showLoads, showDimensions, activeMember]);

  const currentEta = memberUtilisations[activeMember]?.eta_max || 0.45;

  return (
    <div className="relative w-full h-[470px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
      {/* 3D WebGL Canvas */}
      <div ref={mountRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

      {/* Top Left Floating Bar: Dimensions + Component Quick Selection Pills */}
      <div className="absolute top-3 left-3 z-10 flex flex-wrap items-center gap-2 max-w-[70%]">
        <div className="bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-700/80 shadow-lg text-xs flex items-center gap-2">
          <span className="font-extrabold text-sky-400 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
            <Box className="w-3.5 h-3.5 text-sky-400" />
            3D Multi-Storey Bay: {config.spanL}m × {config.tributaryWidthBtr}m
          </span>
          <span className="text-slate-600">|</span>
          <span className="text-slate-300 font-semibold text-[11px]">
            {config.numberOfStoreys} Fl ({config.storeyHeightH}m)
          </span>
        </div>

        {/* Quick Component Selector Pills */}
        <div className="bg-slate-900/90 backdrop-blur-md px-2 py-1 rounded-xl border border-slate-700/80 shadow-lg flex items-center gap-1 text-xs">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-1">Select:</span>
          {availableMembers.map((m) => {
            const isSel = m.id === activeMember;
            const eta = memberUtilisations[m.id]?.eta_max || 0.5;
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => onSelectMemberRef.current?.(m.id)}
                className={`px-2 py-0.5 rounded-lg text-[11px] font-bold transition flex items-center gap-1 border ${
                  isSel
                    ? 'bg-sky-600 text-white border-sky-400 shadow'
                    : 'bg-slate-800/80 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{
                    backgroundColor: eta <= 0.8 ? '#10b981' : eta <= 1.0 ? '#f59e0b' : '#ef4444'
                  }}
                />
                {m.label}
              </button>
            );
          })}
        </div>
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

      {/* Permanently Pinned Member Inspector Card with Step 3 Direct Button */}
      <div className="absolute bottom-4 left-4 z-10 bg-slate-900/95 backdrop-blur-md p-3.5 rounded-2xl border border-sky-500/70 shadow-2xl text-xs space-y-2.5 max-w-xs transition-all">
        <div className="flex items-center justify-between gap-2 border-b border-slate-800 pb-1.5">
          <span className="text-[10px] uppercase font-bold text-sky-400 tracking-wider flex items-center gap-1.5">
            <Box className="w-3.5 h-3.5 text-sky-400" />
            Selected 3D Component
          </span>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-teal-300 font-bold border border-slate-700">
            {activeMember}
          </span>
        </div>

        <div className="space-y-1.5">
          <div className="font-extrabold text-white flex items-center gap-2 text-sm">
            <span
              className="w-3 h-3 rounded-full shrink-0 shadow"
              style={{
                backgroundColor: currentEta <= 0.8 ? '#10b981' : currentEta <= 1.0 ? '#f59e0b' : '#ef4444'
              }}
            />
            <span className="truncate">{getMemberDisplayName(activeMember, config.materialSystem)}</span>
          </div>

          <div className="flex items-center justify-between text-[11px] bg-slate-950/80 px-2.5 py-1.5 rounded-xl border border-slate-800">
            <span className="text-slate-400 font-semibold">Eurocode Utilisation:</span>
            <span
              className={`font-mono font-bold text-xs ${
                currentEta <= 0.8 ? 'text-emerald-400' : currentEta <= 1.0 ? 'text-amber-400' : 'text-rose-400'
              }`}
            >
              ηmax = {currentEta.toFixed(3)} ({Math.round(currentEta * 100)}%)
            </span>
          </div>
        </div>

        {/* Dedicated card button to direct the user to Step 3 for this element */}
        <button
          type="button"
          onClick={() => onNavigateToStep3Ref.current?.(activeMember)}
          className="w-full px-3.5 py-2 rounded-xl bg-teal-500 hover:bg-teal-400 active:scale-[0.98] text-slate-950 font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg transition group cursor-pointer"
        >
          <span>Open in Step 3 Studio</span>
          <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
        </button>

        <div className="text-[10.5px] text-slate-400 text-center flex items-center justify-center gap-1">
          <MousePointerClick className="w-3 h-3 text-sky-400 shrink-0" />
          <span>Click 3D model to select • Card button opens tab</span>
        </div>
      </div>

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
