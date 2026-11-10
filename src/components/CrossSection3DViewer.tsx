// ============================================================================
// POLIMI STRUCTURAL EUROCODE PRE-DIMENSIONING STUDIO
// Dual-Mode 3D WebGL & 2D Eurocode Stress/Strain Distribution Visualizer
// True 3D Extruded Cutaways + Precision 2D CAD & Eurocode Stress Blocks (EN 1992-1996)
// ============================================================================

import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';
import {
  Layers,
  Box,
  Eye,
  RotateCcw,
  Sparkles,
  Info,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  HelpCircle,
  Maximize2,
  Sliders
} from 'lucide-react';
import { STEEL_PROFILES, CONCRETE_CLASSES, TIMBER_CLASSES } from '../data/eurocodeDataset';
import { SelectedMemberType } from './StructuralBay3DViewer';
import { EurocodeStatus } from '../utils/eurocodeCalculators';

interface CrossSection3DViewerProps {
  memberType: SelectedMemberType;
  params: any;
  result: any;
}

type ViewMode = '3d' | '2d' | 'split';

export const CrossSection3DViewer: React.FC<CrossSection3DViewerProps> = ({
  memberType,
  params,
  result
}) => {
  const [viewMode, setViewMode] = useState<ViewMode>('3d');
  const [concreteOpacity, setConcreteOpacity] = useState<number>(0.55);
  const [showNeutralAxisPlane, setShowNeutralAxisPlane] = useState<boolean>(true);
  const [wireframe, setWireframe] = useState<boolean>(false);

  const mountRef = useRef<HTMLDivElement | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const resetCameraRef = useRef<(() => void) | null>(null);

  const eta = result?.eta_max || 0;

  // Helper color for utilization
  const getEtaColorHex = (ratio: number) => {
    if (ratio <= 0.8) return 0x10b981; // emerald
    if (ratio <= 1.0) return 0xf59e0b; // amber
    return 0xef4444; // rose
  };

  // Status badge helper
  const getStatusBadge = () => {
    const status: EurocodeStatus = result?.status || 'SCREEN ONLY';
    switch (status) {
      case 'SCREEN ONLY':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950/80 text-emerald-300 border border-emerald-800 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" /> VERIFIED (SCREEN ONLY)
          </span>
        );
      case 'DOCUMENTED PRODUCT':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-950/80 text-teal-300 border border-teal-800 flex items-center gap-1">
            <Sparkles className="w-3 h-3" /> DOCUMENTED PRODUCT (ETA)
          </span>
        );
      case 'EXAMPLE DATA':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> EXAMPLE DATA (PRELIMINARY)
          </span>
        );
      case 'EXCEEDS SCREEN':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800 flex items-center gap-1">
            <XCircle className="w-3 h-3" /> EXCEEDS LIMIT (Î· &gt; 1.0)
          </span>
        );
      case 'OUT OF SCOPE':
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-950/80 text-purple-300 border border-purple-800 flex items-center gap-1">
            <AlertTriangle className="w-3 h-3" /> OUT OF SCOPE (SLENDER/NON-PLASTIC)
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">
            <HelpCircle className="w-3 h-3" /> CHECK INPUTS
          </span>
        );
    }
  };

  // ==========================================================================
  // THREE.JS 3D EXTRUDED CUTAWAY SCENE INITIALIZATION & INTERACTION
  // ==========================================================================
  useEffect(() => {
    const domEl = mountRef.current;
    if (!domEl || viewMode === '2d') return;

    // Clear previous canvas
    while (domEl.firstChild) {
      domEl.removeChild(domEl.firstChild);
    }

    const width = domEl.clientWidth || 400;
    const height = domEl.clientHeight || 260;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x0b1120); // deep slate slate-950

    // Camera
    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 100);
    cameraRef.current = camera;

    // Renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    rendererRef.current = renderer;
    domEl.appendChild(renderer.domElement);

    // Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.95);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0xffffff, 1.3);
    dirLight1.position.set(4, 7, 5);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0x38bdf8, 0.6); // subtle cyan rim light
    dirLight2.position.set(-5, -3, -4);
    scene.add(dirLight2);

    // Subtle Ground Grid
    const grid = new THREE.GridHelper(3.0, 15, 0x1e293b, 0x0f172a);
    grid.position.y = -0.7;
    scene.add(grid);

    // ------------------------------------------------------------------------
    // BUILD 3D MEMBER EXTRUDED MESHES
    // ------------------------------------------------------------------------
    const rootGroup = new THREE.Group();
    scene.add(rootGroup);

    const L_extrude = 1.6; // extrusion length in meters (along Z axis)

    if (memberType === 'rc_slab') {
      const h_m = (params.h || 220) / 1000;
      const b_m = 1.0; // 1.0m strip
      const cnom_m = (params.cnom || 30) / 1000;
      const phi_m = (params.phi || 12) / 1000;
      const s_m = (params.s || 150) / 1000;
      const phi_t_m = (params.phi_t || 8) / 1000;
      const s_t_m = (params.s_t || 200) / 1000;
      const x_m = (result?.x_prov || 20) / 1000;

      // Concrete Slab Body (translucent to reveal rebar)
      const concreteGeo = new THREE.BoxGeometry(b_m, h_m, L_extrude);
      const concreteMat = new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        transparent: true,
        opacity: concreteOpacity,
        roughness: 0.5,
        wireframe
      });
      const concreteMesh = new THREE.Mesh(concreteGeo, concreteMat);
      rootGroup.add(concreteMesh);

      // Rebar steel material
      const rebarMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        metalness: 0.8,
        roughness: 0.3
      });

      // Bottom Main Reinforcement Bars (along Z axis)
      const nBars = Math.max(3, Math.floor(b_m / s_m));
      const startX = -b_m / 2 + cnom_m + phi_m / 2;
      const endX = b_m / 2 - cnom_m - phi_m / 2;
      const stepX = (endX - startX) / (nBars - 1);
      const barY = -h_m / 2 + cnom_m + phi_m / 2;

      for (let i = 0; i < nBars; i++) {
        const barX = startX + i * stepX;
        const barGeo = new THREE.CylinderGeometry(phi_m / 2, phi_m / 2, L_extrude, 16);
        barGeo.rotateX(Math.PI / 2);
        const barMesh = new THREE.Mesh(barGeo, rebarMat);
        barMesh.position.set(barX, barY, 0);
        rootGroup.add(barMesh);
      }

      // Transverse Distribution Bars (sitting on top of bottom bars, along X axis)
      const transRebarMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.75, roughness: 0.35 });
      const nTransBars = Math.floor(L_extrude / s_t_m);
      const transY = barY + phi_m / 2 + phi_t_m / 2;
      for (let t = 0; t <= nTransBars; t++) {
        const tz = -L_extrude / 2 + (t + 0.5) * (L_extrude / (nTransBars + 1));
        const transGeo = new THREE.CylinderGeometry(phi_t_m / 2, phi_t_m / 2, b_m - 2 * cnom_m, 12);
        transGeo.rotateZ(Math.PI / 2);
        const transMesh = new THREE.Mesh(transGeo, transRebarMat);
        transMesh.position.set(0, transY, tz);
        rootGroup.add(transMesh);
      }

      // Neutral Axis Compression Plane
      if (showNeutralAxisPlane) {
        const naY = h_m / 2 - x_m;
        const naGeo = new THREE.PlaneGeometry(b_m * 1.08, L_extrude * 1.05);
        naGeo.rotateX(-Math.PI / 2);
        const naMat = new THREE.MeshBasicMaterial({
          color: 0x38bdf8,
          transparent: true,
          opacity: 0.35,
          side: THREE.DoubleSide
        });
        const naMesh = new THREE.Mesh(naGeo, naMat);
        naMesh.position.set(0, naY, 0);
        rootGroup.add(naMesh);
      }
    } else if (memberType === 'rc_beam') {
      const b_m = (params.b || 300) / 1000;
      const h_m = (params.h || 550) / 1000;
      const cnom_m = (params.cnom || 30) / 1000;
      const phi_m = (params.phi || 20) / 1000;
      const phi_link_m = (params.phi_link || 8) / 1000;
      const n = params.n || 4;
      const sw_m = (params.sw || 200) / 1000;
      const x_m = (result?.x_prov || 113) / 1000;

      // Concrete Beam Body
      const concreteGeo = new THREE.BoxGeometry(b_m, h_m, L_extrude);
      const concreteMat = new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        transparent: true,
        opacity: concreteOpacity,
        roughness: 0.5,
        wireframe
      });
      const concreteMesh = new THREE.Mesh(concreteGeo, concreteMat);
      rootGroup.add(concreteMesh);

      // Steel Materials
      const rebarMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.85, roughness: 0.25 });
      const stirrupMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.7, roughness: 0.35 });

      // Bottom Tension Bars
      const botY = -h_m / 2 + cnom_m + phi_link_m + phi_m / 2;
      const startX = -b_m / 2 + cnom_m + phi_link_m + phi_m / 2;
      const endX = b_m / 2 - cnom_m - phi_link_m - phi_m / 2;
      const stepX = n > 1 ? (endX - startX) / (n - 1) : 0;

      for (let i = 0; i < n; i++) {
        const barGeo = new THREE.CylinderGeometry(phi_m / 2, phi_m / 2, L_extrude, 16);
        barGeo.rotateX(Math.PI / 2);
        const barMesh = new THREE.Mesh(barGeo, rebarMat);
        barMesh.position.set(n > 1 ? startX + i * stepX : 0, botY, 0);
        rootGroup.add(barMesh);
      }

      // Top Hanger Bars (2 bars)
      const topY = h_m / 2 - cnom_m - phi_link_m - 0.006;
      [-b_m / 2 + cnom_m + phi_link_m + 0.006, b_m / 2 - cnom_m - phi_link_m - 0.006].forEach((hx) => {
        const hGeo = new THREE.CylinderGeometry(0.006, 0.006, L_extrude, 12);
        hGeo.rotateX(Math.PI / 2);
        const hMesh = new THREE.Mesh(hGeo, rebarMat);
        hMesh.position.set(hx, topY, 0);
        rootGroup.add(hMesh);
      });

      // 3D Closed Stirrup Links along Beam Extrusion
      const nStirrups = Math.floor(L_extrude / sw_m);
      const linkW = b_m - 2 * cnom_m;
      const linkH = h_m - 2 * cnom_m;
      const rLink = phi_link_m / 2;

      for (let s = 0; s <= nStirrups; s++) {
        const zPos = -L_extrude / 2 + (s + 0.5) * (L_extrude / (nStirrups + 1));
        const linkGroup = new THREE.Group();

        // Top horiz
        const topG = new THREE.CylinderGeometry(rLink, rLink, linkW, 8);
        topG.rotateZ(Math.PI / 2);
        const topM = new THREE.Mesh(topG, stirrupMat);
        topM.position.set(0, linkH / 2, 0);
        linkGroup.add(topM);

        // Bottom horiz
        const botG = new THREE.CylinderGeometry(rLink, rLink, linkW, 8);
        botG.rotateZ(Math.PI / 2);
        const botM = new THREE.Mesh(botG, stirrupMat);
        botM.position.set(0, -linkH / 2, 0);
        linkGroup.add(botM);

        // Left vert
        const leftG = new THREE.CylinderGeometry(rLink, rLink, linkH, 8);
        const leftM = new THREE.Mesh(leftG, stirrupMat);
        leftM.position.set(-linkW / 2, 0, 0);
        linkGroup.add(leftM);

        // Right vert
        const rightG = new THREE.CylinderGeometry(rLink, rLink, linkH, 8);
        const rightM = new THREE.Mesh(rightG, stirrupMat);
        rightM.position.set(linkW / 2, 0, 0);
        linkGroup.add(rightM);

        linkGroup.position.set(0, 0, zPos);
        rootGroup.add(linkGroup);
      }

      // Neutral Axis Plane
      if (showNeutralAxisPlane) {
        const naY = h_m / 2 - x_m;
        const naGeo = new THREE.PlaneGeometry(b_m * 1.15, L_extrude * 1.05);
        naGeo.rotateX(-Math.PI / 2);
        const naMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.4, side: THREE.DoubleSide });
        const naMesh = new THREE.Mesh(naGeo, naMat);
        naMesh.position.set(0, naY, 0);
        rootGroup.add(naMesh);
      }
    } else if (memberType === 'rc_column') {
      const b_m = (params.b || 400) / 1000;
      const h_m = (params.h || 400) / 1000;
      const a_m = (params.a || 50) / 1000;
      const phi_m = (params.phi || 20) / 1000;
      const nBarsPerFace = params.n_bars || 3;
      const x_m = (result?.x || 150) / 1000;

      // Concrete Column Body
      const concreteGeo = new THREE.BoxGeometry(b_m, h_m, L_extrude);
      const concreteMat = new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        transparent: true,
        opacity: concreteOpacity,
        roughness: 0.5,
        wireframe
      });
      const concreteMesh = new THREE.Mesh(concreteGeo, concreteMat);
      rootGroup.add(concreteMesh);

      // Rebar Steel Material
      const rebarMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.85, roughness: 0.25 });
      const tieMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.7, roughness: 0.35 });

      // Symmetrical Rebars on opposite compression and tension faces
      const yTop = h_m / 2 - a_m;
      const yBot = -h_m / 2 + a_m;
      const startX = -b_m / 2 + a_m;
      const endX = b_m / 2 - a_m;
      const stepX = nBarsPerFace > 1 ? (endX - startX) / (nBarsPerFace - 1) : 0;

      for (let i = 0; i < nBarsPerFace; i++) {
        const bx = nBarsPerFace > 1 ? startX + i * stepX : 0;

        // Top face bar
        const tGeo = new THREE.CylinderGeometry(phi_m / 2, phi_m / 2, L_extrude, 14);
        tGeo.rotateX(Math.PI / 2);
        const tMesh = new THREE.Mesh(tGeo, rebarMat);
        tMesh.position.set(bx, yTop, 0);
        rootGroup.add(tMesh);

        // Bottom face bar
        const bGeo = new THREE.CylinderGeometry(phi_m / 2, phi_m / 2, L_extrude, 14);
        bGeo.rotateX(Math.PI / 2);
        const bMesh = new THREE.Mesh(bGeo, rebarMat);
        bMesh.position.set(bx, yBot, 0);
        rootGroup.add(bMesh);
      }

      // 3D Column Ties / Links along Column height
      const tieSpacing = Math.min(0.25, Math.max(0.12, (params.b || 400) * 0.4 / 1000));
      const nTies = Math.floor(L_extrude / tieSpacing);
      const tieW = b_m - 2 * (a_m - phi_m / 2);
      const tieH = h_m - 2 * (a_m - phi_m / 2);
      const rTie = Math.max(0.003, phi_m / 8);

      for (let t = 0; t <= nTies; t++) {
        const zPos = -L_extrude / 2 + (t + 0.5) * (L_extrude / (nTies + 1));
        const tieGroup = new THREE.Group();

        // Top
        const tg = new THREE.CylinderGeometry(rTie, rTie, tieW, 8);
        tg.rotateZ(Math.PI / 2);
        const tm = new THREE.Mesh(tg, tieMat);
        tm.position.set(0, tieH / 2, 0);
        tieGroup.add(tm);

        // Bot
        const bg = new THREE.CylinderGeometry(rTie, rTie, tieW, 8);
        bg.rotateZ(Math.PI / 2);
        const bm = new THREE.Mesh(bg, tieMat);
        bm.position.set(0, -tieH / 2, 0);
        tieGroup.add(bm);

        // Left
        const lg = new THREE.CylinderGeometry(rTie, rTie, tieH, 8);
        const lm = new THREE.Mesh(lg, tieMat);
        lm.position.set(-tieW / 2, 0, 0);
        tieGroup.add(lm);

        // Right
        const rg = new THREE.CylinderGeometry(rTie, rTie, tieH, 8);
        const rm = new THREE.Mesh(rg, tieMat);
        rm.position.set(tieW / 2, 0, 0);
        tieGroup.add(rm);

        tieGroup.position.set(0, 0, zPos);
        rootGroup.add(tieGroup);
      }

      // Neutral Axis Plane
      if (showNeutralAxisPlane) {
        const naY = h_m / 2 - x_m;
        const naGeo = new THREE.PlaneGeometry(b_m * 1.15, L_extrude * 1.05);
        naGeo.rotateX(-Math.PI / 2);
        const naMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
        const naMesh = new THREE.Mesh(naGeo, naMat);
        naMesh.position.set(0, naY, 0);
        rootGroup.add(naMesh);
      }
    } else if (memberType === 'rc_wall') {
      const b_m = 1.0; // 1m wall strip
      const h_m = (params.h || 200) / 1000; // wall thickness
      const a_m = (params.a || 40) / 1000;
      const phi_m = (params.phi || 12) / 1000;
      const s_m = (params.s || 200) / 1000;
      const phi_h_m = (params.phi_h || 8) / 1000;
      const s_h_m = (params.s_h || 200) / 1000;
      const x_m = (result?.x || 60) / 1000;

      // Concrete Wall Body
      const concreteGeo = new THREE.BoxGeometry(b_m, h_m, L_extrude);
      const concreteMat = new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        transparent: true,
        opacity: concreteOpacity,
        roughness: 0.5,
        wireframe
      });
      const concreteMesh = new THREE.Mesh(concreteGeo, concreteMat);
      rootGroup.add(concreteMesh);

      // Rebar Steel Materials
      const vertMat = new THREE.MeshStandardMaterial({ color: 0xef4444, metalness: 0.85, roughness: 0.25 });
      const horizMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.75, roughness: 0.3 });

      // Two layers (front & back faces) of vertical bars spaced at s
      const nBarsPerFace = Math.max(3, Math.floor(b_m / s_m));
      const yFront = h_m / 2 - a_m;
      const yBack = -h_m / 2 + a_m;
      const startX = -b_m / 2 + a_m;
      const endX = b_m / 2 - a_m;
      const stepX = (endX - startX) / (nBarsPerFace - 1);

      for (let i = 0; i < nBarsPerFace; i++) {
        const bx = startX + i * stepX;

        // Front face vertical rebar
        const fGeo = new THREE.CylinderGeometry(phi_m / 2, phi_m / 2, L_extrude, 12);
        fGeo.rotateX(Math.PI / 2);
        const fMesh = new THREE.Mesh(fGeo, vertMat);
        fMesh.position.set(bx, yFront, 0);
        rootGroup.add(fMesh);

        // Back face vertical rebar
        const bGeo = new THREE.CylinderGeometry(phi_m / 2, phi_m / 2, L_extrude, 12);
        bGeo.rotateX(Math.PI / 2);
        const bMesh = new THREE.Mesh(bGeo, vertMat);
        bMesh.position.set(bx, yBack, 0);
        rootGroup.add(bMesh);
      }

      // Horizontal reinforcement bars spaced at s_h
      const nHoriz = Math.floor(L_extrude / s_h_m);
      for (let h = 0; h <= nHoriz; h++) {
        const hz = -L_extrude / 2 + (h + 0.5) * (L_extrude / (nHoriz + 1));

        // Front horizontal bar
        const hfGeo = new THREE.CylinderGeometry(phi_h_m / 2, phi_h_m / 2, b_m - 2 * a_m, 10);
        hfGeo.rotateZ(Math.PI / 2);
        const hfMesh = new THREE.Mesh(hfGeo, horizMat);
        hfMesh.position.set(0, yFront + phi_m / 2 + phi_h_m / 2, hz);
        rootGroup.add(hfMesh);

        // Back horizontal bar
        const hbGeo = new THREE.CylinderGeometry(phi_h_m / 2, phi_h_m / 2, b_m - 2 * a_m, 10);
        hbGeo.rotateZ(Math.PI / 2);
        const hbMesh = new THREE.Mesh(hbGeo, horizMat);
        hbMesh.position.set(0, yBack - phi_m / 2 - phi_h_m / 2, hz);
        rootGroup.add(hbMesh);
      }

      // Neutral Axis Plane
      if (showNeutralAxisPlane) {
        const naY = h_m / 2 - x_m;
        const naGeo = new THREE.PlaneGeometry(b_m * 1.05, L_extrude * 1.05);
        naGeo.rotateX(-Math.PI / 2);
        const naMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
        const naMesh = new THREE.Mesh(naGeo, naMat);
        naMesh.position.set(0, naY, 0);
        rootGroup.add(naMesh);
      }
    } else if (memberType === 'steel_beam' || memberType === 'steel_column') {
      const profName = params.profileName || 'IPE 300';
      const prof = STEEL_PROFILES[profName] || STEEL_PROFILES['IPE 300'];
      const h_m = prof.h / 1000;
      const b_m = prof.b / 1000;
      const tw_m = prof.tw / 1000;
      const tf_m = prof.tf / 1000;

      const steelColor = getEtaColorHex(eta);
      const steelMat = new THREE.MeshStandardMaterial({
        color: steelColor,
        metalness: 0.75,
        roughness: 0.3,
        wireframe
      });

      if (prof.type === 'CHS') {
        const rOuter = h_m / 2;
        const rInner = Math.max(0.005, rOuter - tf_m);
        const shape = new THREE.Shape();
        shape.absarc(0, 0, rOuter, 0, Math.PI * 2, false);
        const hole = new THREE.Path();
        hole.absarc(0, 0, rInner, 0, Math.PI * 2, true);
        shape.holes.push(hole);

        const extrudeSettings = { depth: L_extrude, bevelEnabled: false };
        const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geo.translate(0, 0, -L_extrude / 2);
        const mesh = new THREE.Mesh(geo, steelMat);
        rootGroup.add(mesh);
      } else if (prof.type === 'SHS') {
        const shape = new THREE.Shape();
        const halfB = b_m / 2;
        const halfH = h_m / 2;
        shape.moveTo(-halfB, -halfH);
        shape.lineTo(halfB, -halfH);
        shape.lineTo(halfB, halfH);
        shape.lineTo(-halfB, halfH);
        shape.closePath();

        const hole = new THREE.Path();
        const inB = halfB - tf_m;
        const inH = halfH - tf_m;
        hole.moveTo(-inB, -inH);
        hole.lineTo(inB, -inH);
        hole.lineTo(inB, inH);
        hole.lineTo(-inB, inH);
        hole.closePath();
        shape.holes.push(hole);

        const extrudeSettings = { depth: L_extrude, bevelEnabled: false };
        const geo = new THREE.ExtrudeGeometry(shape, extrudeSettings);
        geo.translate(0, 0, -L_extrude / 2);
        const mesh = new THREE.Mesh(geo, steelMat);
        rootGroup.add(mesh);
      } else {
        // True 3D Extruded I / H Section
        const topFlangeGeo = new THREE.BoxGeometry(b_m, tf_m, L_extrude);
        const topMesh = new THREE.Mesh(topFlangeGeo, steelMat);
        topMesh.position.set(0, h_m / 2 - tf_m / 2, 0);
        rootGroup.add(topMesh);

        const botFlangeGeo = new THREE.BoxGeometry(b_m, tf_m, L_extrude);
        const botMesh = new THREE.Mesh(botFlangeGeo, steelMat);
        botMesh.position.set(0, -h_m / 2 + tf_m / 2, 0);
        rootGroup.add(botMesh);

        const webH = Math.max(0.01, h_m - 2 * tf_m);
        const webGeo = new THREE.BoxGeometry(tw_m, webH, L_extrude);
        const webMesh = new THREE.Mesh(webGeo, steelMat);
        webMesh.position.set(0, 0, 0);
        rootGroup.add(webMesh);
      }

      // Strong & Weak Buckling Axes Indicators (y-y Cyan, z-z Magenta)
      const axisLen = Math.max(b_m, h_m) * 0.85;
      const yAxisGeo = new THREE.CylinderGeometry(0.003, 0.003, axisLen, 8);
      const yAxisMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });
      const yMesh = new THREE.Mesh(yAxisGeo, yAxisMat);
      yMesh.position.set(0, 0, L_extrude / 2 + 0.04);
      rootGroup.add(yMesh);

      const zAxisGeo = new THREE.CylinderGeometry(0.003, 0.003, axisLen, 8);
      zAxisGeo.rotateZ(Math.PI / 2);
      const zAxisMat = new THREE.MeshBasicMaterial({ color: 0xf43f5e });
      const zMesh = new THREE.Mesh(zAxisGeo, zAxisMat);
      zMesh.position.set(0, 0, L_extrude / 2 + 0.04);
      rootGroup.add(zMesh);
    } else if (memberType === 'clt_slab' || memberType === 'clt_wall') {
      const t_m = (params.t || 160) / 1000;
      const b_m = 1.0; // 1m strip
      const nLayers = 5;
      const layerH = t_m / nLayers;

      // 5 alternating layers (0Â° longitudinal, 90Â° transverse)
      for (let i = 0; i < nLayers; i++) {
        const isLong = i % 2 === 0;
        const layerGeo = new THREE.BoxGeometry(b_m, layerH, L_extrude);
        const layerMat = new THREE.MeshStandardMaterial({
          color: isLong ? 0xd97706 : 0x92400e, // warm honey vs darker amber
          roughness: 0.7,
          wireframe
        });
        const layerMesh = new THREE.Mesh(layerGeo, layerMat);
        const ly = -t_m / 2 + (i + 0.5) * layerH;
        layerMesh.position.set(0, ly, 0);
        rootGroup.add(layerMesh);
      }
    } else if (memberType === 'wood_beam' || memberType === 'wood_column') {
      const b_m = (params.b || 120) / 1000;
      const h_m = (params.h || 320) / 1000;
      const lamCount = Math.max(4, Math.min(12, Math.round((params.h || 320) / 40)));
      const lamH = h_m / lamCount;

      for (let i = 0; i < lamCount; i++) {
        const lamGeo = new THREE.BoxGeometry(b_m, lamH * 0.96, L_extrude);
        const lamMat = new THREE.MeshStandardMaterial({
          color: i % 2 === 0 ? 0xb45309 : 0x92400e,
          roughness: 0.65,
          wireframe
        });
        const lamMesh = new THREE.Mesh(lamGeo, lamMat);
        const ly = -h_m / 2 + (i + 0.5) * lamH;
        lamMesh.position.set(0, ly, 0);
        rootGroup.add(lamMesh);
      }
    } else if (memberType === 'masonry_wall') {
      const t_m = (params.t || 250) / 1000;
      const l_m = Math.min(1.2, params.l || 1.0);
      const nCourses = 8;
      const courseH = 0.08;

      for (let c = 0; c < nCourses; c++) {
        const isOffset = c % 2 === 1;
        const cy = -((nCourses * courseH) / 2) + (c + 0.5) * courseH;

        const brickGeo = new THREE.BoxGeometry(l_m, courseH * 0.9, t_m);
        const brickMat = new THREE.MeshStandardMaterial({
          color: 0x991b1b, // terracotta brick red
          roughness: 0.85,
          wireframe
        });
        const brickMesh = new THREE.Mesh(brickGeo, brickMat);
        brickMesh.position.set(isOffset ? 0.04 : 0, cy, 0);
        rootGroup.add(brickMesh);
      }

      // Highlighted Compressed Contact Zone Plane (EN 1996 lc or t - 2e)
      const lc_m = Math.min(l_m, params.lc || (l_m * 0.75));
      const compGeo = new THREE.PlaneGeometry(lc_m, t_m * 1.05);
      compGeo.rotateX(-Math.PI / 2);
      const compMat = new THREE.MeshBasicMaterial({ color: 0x10b981, transparent: true, opacity: 0.45, side: THREE.DoubleSide });
      const compMesh = new THREE.Mesh(compGeo, compMat);
      compMesh.position.set(-l_m / 2 + lc_m / 2, (nCourses * courseH) / 2 + 0.01, 0);
      rootGroup.add(compMesh);
    }

    // ------------------------------------------------------------------------
    // MOUSE ORBIT, PAN & ZOOM INTERACTION
    // ------------------------------------------------------------------------
    let isDragging = false;
    let prevMouse = { x: 0, y: 0 };
    let theta = 0.75;
    let phi = 0.55;
    let radius = 2.4;

    const updateCamera = () => {
      camera.position.x = radius * Math.sin(theta) * Math.cos(phi);
      camera.position.y = radius * Math.sin(phi);
      camera.position.z = radius * Math.cos(theta) * Math.cos(phi);
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
    };

    updateCamera();

    resetCameraRef.current = () => {
      theta = 0.75;
      phi = 0.55;
      radius = 2.4;
      updateCamera();
    };

    const onMouseDown = (e: MouseEvent) => {
      isDragging = true;
      prevMouse = { x: e.clientX, y: e.clientY };
    };

    const onMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - prevMouse.x;
      const dy = e.clientY - prevMouse.y;
      prevMouse = { x: e.clientX, y: e.clientY };

      theta -= dx * 0.008;
      phi = Math.max(-Math.PI / 2.3, Math.min(Math.PI / 2.3, phi + dy * 0.008));
      updateCamera();
    };

    const onMouseUp = () => {
      isDragging = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      radius = Math.max(0.8, Math.min(5.0, radius + e.deltaY * 0.002));
      updateCamera();
    };

    domEl.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    domEl.addEventListener('wheel', onWheel, { passive: false });

    // Initial render
    renderer.render(scene, camera);

    return () => {
      domEl.removeEventListener('mousedown', onMouseDown);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      domEl.removeEventListener('wheel', onWheel);
      renderer.dispose();
    };
  }, [memberType, params, result, viewMode, concreteOpacity, showNeutralAxisPlane, wireframe, eta]);

  // ==========================================================================
  // 2D SCALED CAD SECTION & EUROCODE STRESS/STRAIN DIAGRAM
  // ==========================================================================
  const render2DCadAndStressDiagram = () => {
    // ------------------------------------------------------------------------
    // 1. REINFORCED CONCRETE (SLAB, BEAM, COLUMN, WALL)
    // ------------------------------------------------------------------------
    if (memberType === 'rc_slab' || memberType === 'rc_beam' || memberType === 'rc_column' || memberType === 'rc_wall') {
      const isSlab = memberType === 'rc_slab';
      const isBeam = memberType === 'rc_beam';
      const isCol = memberType === 'rc_column';
      const isWall = memberType === 'rc_wall';

      const b = params.b || (isSlab || isWall ? 1000 : 300);
      const h = params.h || (isSlab ? 220 : isWall ? 200 : isCol ? 400 : 550);
      const cnom = isCol || isWall ? (params.a ? params.a - (params.phi || 16) / 2 : 35) : (params.cnom || 30);
      const phi = params.phi || (isSlab || isWall ? 12 : 20);
      const phi_link = params.phi_link || 8;
      const n = params.n || params.n_bars || 4;
      const s = params.s || 150;
      const sw = params.sw || 200;
      const x = result?.x_prov || result?.x || Math.round(h * 0.25);
      const d = result?.d || Math.round(h - cnom - (isBeam ? phi_link : 0) - phi / 2);
      const z = result?.z || Math.round(d - 0.4 * x);
      const fck = CONCRETE_CLASSES[params.concreteClass]?.fck || 30;
      const fcd = (fck / 1.5).toFixed(1);

      // Section scaling inside 200x200 box
      const scale = 170 / Math.max(b, h);
      const drawW = Math.max(30, b * scale);
      const drawH = Math.max(40, h * scale);
      const startX = 20 + (180 - drawW) / 2;
      const startY = 25 + (180 - drawH) / 2;
      const drawCnom = Math.max(3, cnom * scale);
      const drawX = Math.min(drawH, Math.max(4, x * scale));
      const drawPhi = Math.max(4, phi * scale);

      // Number of bars calculation
      let nBottom = 4;
      let nTop = 2;
      if (isSlab) {
        nBottom = Math.max(3, Math.min(8, Math.round(b / s)));
        nTop = 0;
      } else if (isBeam) {
        nBottom = Math.max(2, Math.min(8, n));
        nTop = 2; // hanger bars
      } else if (isCol) {
        nBottom = Math.max(2, Math.min(6, params.n_bars || 3));
        nTop = nBottom; // symmetrical face
      } else if (isWall) {
        nBottom = Math.max(3, Math.min(7, Math.round(b / s)));
        nTop = nBottom; // front and back face
      }

      return (
        <svg viewBox="0 0 440 260" className="w-full h-64 select-none">
          {/* ----------------- LEFT: SCALED CAD CROSS-SECTION ----------------- */}
          <g>
            <text x="110" y="16" fill="#94a3b8" fontSize="10" fontWeight="bold" textAnchor="middle">
              1. Scaled Cross-Section ({b}Ã—{h} mm)
            </text>

            {/* Concrete Section Body */}
            <rect x={startX} y={startY} width={drawW} height={drawH} rx="2" fill="#1e293b" stroke="#64748b" strokeWidth="1.5" />

            {/* Concrete Compression Zone above Neutral Axis */}
            <rect x={startX} y={startY} width={drawW} height={drawX} fill="#0284c7" fillOpacity="0.25" />

            {/* Neutral Axis Dashed Line */}
            <line x1={startX - 10} y1={startY + drawX} x2={startX + drawW + 10} y2={startY + drawX} stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3 3" />
            <text x={startX + drawW + 12} y={startY + drawX + 3} fill="#38bdf8" fontSize="9" fontWeight="bold">N.A. x={x.toFixed(0)}mm</text>

            {/* Links / Stirrups (Only for Beam and Column) */}
            {(isBeam || isCol) && (
              <rect
                x={startX + drawCnom}
                y={startY + drawCnom}
                width={Math.max(10, drawW - 2 * drawCnom)}
                height={Math.max(10, drawH - 2 * drawCnom)}
                rx="3"
                fill="none"
                stroke="#fbbf24"
                strokeWidth="1.5"
              />
            )}

            {/* Bottom Face Rebars */}
            {Array.from({ length: nBottom }).map((_, idx) => {
              const spacing = nBottom > 1 ? (drawW - 2 * drawCnom - drawPhi) / (nBottom - 1) : 0;
              const cx = startX + drawCnom + drawPhi / 2 + idx * spacing;
              const cy = startY + drawH - drawCnom - drawPhi / 2;
              return (
                <circle key={`bot-${idx}`} cx={cx} cy={cy} r={drawPhi / 2} fill="#ef4444" stroke="#fca5a5" strokeWidth="1" />
              );
            })}

            {/* Top Face Rebars (Hangers for beam, or symmetrical face for column/wall) */}
            {nTop > 0 && Array.from({ length: nTop }).map((_, idx) => {
              const spacing = nTop > 1 ? (drawW - 2 * drawCnom - drawPhi) / (nTop - 1) : 0;
              const cx = startX + drawCnom + drawPhi / 2 + idx * spacing;
              const cy = startY + drawCnom + drawPhi / 2;
              return (
                <circle key={`top-${idx}`} cx={cx} cy={cy} r={isBeam ? 3 : drawPhi / 2} fill={isBeam ? '#f87171' : '#ef4444'} stroke="#fca5a5" strokeWidth="1" />
              );
            })}

            {/* Transverse / Distribution bars for Slab */}
            {isSlab && (
              <g>
                <text x={startX + drawW / 2} y={startY + drawH - drawCnom - drawPhi - 4} fill="#fbbf24" fontSize="8" textAnchor="middle">
                  Ã˜{params.phi_t || 8}@{params.s_t || 200} trans
                </text>
              </g>
            )}

            {/* Dimensions */}
            <text x={startX + drawW / 2} y={startY + drawH + 16} fill="#94a3b8" fontSize="10" textAnchor="middle">b = {b} mm</text>
            <text x={startX - 8} y={startY + drawH / 2} fill="#94a3b8" fontSize="10" textAnchor="end">h = {h} mm</text>
            <text x={startX + drawW / 2} y={startY - 6} fill="#38bdf8" fontSize="9" textAnchor="middle">
              {isBeam ? `Links Ã˜${phi_link} s=${sw}mm` : isCol ? `Ties a=${params.a || 50}mm` : isWall ? `2x Mesh Ã˜${phi}@${s}` : `Bottom Ã˜${phi}@${s}`}
            </text>
          </g>

          {/* ----------------- RIGHT: EUROCODE STRAIN & STRESS ----------------- */}
          <g transform="translate(230, 0)">
            <text x="100" y="16" fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle">
              2. Eurocode EN 1992 Strain & Stress Block
            </text>

            {/* Strain Diagram (linear through NA) */}
            <line x1="40" y1={startY} x2="40" y2={startY + drawH} stroke="#475569" strokeWidth="1" />
            <polygon
              points={`40,${startY} 15,${startY} 40,${startY + drawX}`}
              fill="#38bdf8"
              fillOpacity="0.4"
              stroke="#38bdf8"
              strokeWidth="1.2"
            />
            <polygon
              points={`40,${startY + drawX} 65,${startY + drawH} 40,${startY + drawH}`}
              fill="#ef4444"
              fillOpacity="0.3"
              stroke="#ef4444"
              strokeWidth="1.2"
            />
            <text x="10" y={startY + 10} fill="#38bdf8" fontSize="8" textAnchor="end">Îµcu3=3.5â€°</text>
            <text x="70" y={startY + drawH - 2} fill="#ef4444" fontSize="8">Îµs &ge; 2.17â€°</text>

            {/* Eurocode Rectangular Stress Block (λx = 0.8x at ηfcd) */}
            <line x1="120" y1={startY} x2="120" y2={startY + drawH} stroke="#475569" strokeWidth="1" />
            <rect
              x="120"
              y={startY}
              width="45"
              height={Math.max(4, drawX * 0.8)}
              fill="#0284c7"
              fillOpacity="0.75"
              stroke="#38bdf8"
              strokeWidth="1"
            />
            <text x="170" y={startY + (drawX * 0.8) / 2 + 3} fill="#38bdf8" fontSize="9" fontWeight="bold">Î·fcd = {fcd} MPa</text>
            <text x="115" y={startY + (drawX * 0.8) + 12} fill="#94a3b8" fontSize="8" textAnchor="end">Î»x = {(0.8 * x).toFixed(0)}mm</text>

            {/* Concrete Compression Force Fc Arrow */}
            <line x1="165" y1={startY + (drawX * 0.8) / 2} x2="135" y2={startY + (drawX * 0.8) / 2} stroke="#38bdf8" strokeWidth="2" markerEnd="url(#arrow-cyan)" />
            <text x="175" y={startY + (drawX * 0.8) / 2 - 4} fill="#38bdf8" fontSize="9" fontWeight="bold">Fc</text>

            {/* Steel Tension Force Fs Arrow */}
            <line x1="100" y1={startY + drawH - drawCnom} x2="145" y2={startY + drawH - drawCnom} stroke="#ef4444" strokeWidth="2" />
            <polygon points={`145,${startY + drawH - drawCnom} 140,${startY + drawH - drawCnom - 3} 140,${startY + drawH - drawCnom + 3}`} fill="#ef4444" />
            <text x="152" y={startY + drawH - drawCnom + 3} fill="#ef4444" fontSize="9" fontWeight="bold">Fs</text>

            {/* Lever Arm z dimension */}
            <line x1="195" y1={startY + (drawX * 0.4)} x2="195" y2={startY + drawH - drawCnom} stroke="#a755f7" strokeWidth="1" strokeDasharray="2 2" />
            <text x="200" y={startY + drawH / 2} fill="#c084fc" fontSize="9" fontWeight="bold">z = {z}mm</text>

            {/* Bottom Scope / Verification Tag */}
            <rect x="25" y="215" width="165" height="20" rx="4" fill="#0f172a" stroke="#334155" />
            <text x="107" y="229" fill="#38bdf8" fontSize="9" textAnchor="middle" fontWeight="bold">
              {isSlab ? `d = ${d}mm â€¢ Unreinforced VRd,c` : isBeam ? `d = ${d}mm â€¢ Shear Truss cotÎ¸=2.0` : isCol ? `eTot = ${(result?.eTot || 20).toFixed(1)}mm â€¢ NEd/NRd` : `Slender Wall â€¢ 2nd Order e2`}
            </text>
          </g>
        </svg>
      );
    }

    // ------------------------------------------------------------------------
    // 2. STRUCTURAL STEEL BEAM / COLUMN (EN 1993-1-1)
    // ------------------------------------------------------------------------
    if (memberType === 'steel_beam' || memberType === 'steel_column') {
      const profName = params.profileName || 'IPE 300';
      const prof = STEEL_PROFILES[profName] || STEEL_PROFILES['IPE 300'];
      const fy = params.grade === 'S235' ? 235 : params.grade === 'S275' ? 275 : 355;
      const sClass = result?.sectionClass || 1;

      return (
        <svg viewBox="0 0 440 260" className="w-full h-64 select-none">
          {/* ----------------- LEFT: SCALED PROFILE CAD ----------------- */}
          <g>
            <text x="110" y="16" fill="#94a3b8" fontSize="10" fontWeight="bold" textAnchor="middle">
              1. Steel Cross-Section ({prof.profile})
            </text>

            {prof.type === 'CHS' ? (
              <g transform="translate(110, 115)">
                <circle cx="0" cy="0" r="60" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
                <circle cx="0" cy="0" r={Math.max(10, 60 - prof.tf * 2)} fill="#0b1120" stroke="#38bdf8" strokeWidth="1" />
                <text x="0" y="4" fill="#38bdf8" fontSize="10" textAnchor="middle" fontWeight="bold">D = {prof.h}mm</text>
                <text x="0" y="20" fill="#94a3b8" fontSize="9" textAnchor="middle">t = {prof.tf}mm</text>
              </g>
            ) : prof.type === 'SHS' ? (
              <g transform="translate(110, 115)">
                <rect x="-55" y="-55" width="110" height="110" rx="6" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
                <rect x={-55 + prof.tf * 1.5} y={-55 + prof.tf * 1.5} width={110 - prof.tf * 3} height={110 - prof.tf * 3} rx="4" fill="#0b1120" stroke="#38bdf8" strokeWidth="1" />
                <text x="0" y="4" fill="#38bdf8" fontSize="10" textAnchor="middle" fontWeight="bold">{prof.h}Ã—{prof.b}mm</text>
                <text x="0" y="20" fill="#94a3b8" fontSize="9" textAnchor="middle">t = {prof.tf}mm</text>
              </g>
            ) : (
              <g transform="translate(110, 115)">
                {/* Top Flange */}
                <rect x="-50" y="-70" width="100" height="15" rx="1" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.5" />
                {/* Web */}
                <rect x="-5" y="-55" width="10" height="110" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.5" />
                {/* Bottom Flange */}
                <rect x="-50" y="55" width="100" height="15" rx="1" fill="#1e293b" stroke="#38bdf8" strokeWidth="1.5" />

                {/* Dimension callouts */}
                <text x="0" y="-76" fill="#94a3b8" fontSize="9" textAnchor="middle">b = {prof.b} mm (tf = {prof.tf} mm)</text>
                <text x="-58" y="0" fill="#94a3b8" fontSize="9" textAnchor="end">h = {prof.h} mm</text>
                <text x="12" y="0" fill="#94a3b8" fontSize="8" textAnchor="start">tw = {prof.tw} mm</text>

                {/* Centroid / Axes */}
                <line x1="-65" y1="0" x2="65" y2="0" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2 2" />
                <text x="68" y="3" fill="#38bdf8" fontSize="8">y-y</text>
                <line x1="0" y1="-80" x2="0" y2="80" stroke="#f43f5e" strokeWidth="1" strokeDasharray="2 2" />
                <text x="3" y="86" fill="#f43f5e" fontSize="8">z-z</text>
              </g>
            )}

            <text x="110" y="215" fill="#fde047" fontSize="10" textAnchor="middle" fontWeight="bold">
              Grade {params.grade || 'S355'} â€¢ Class {sClass} Section
            </text>
          </g>

          {/* ----------------- RIGHT: EUROCODE PLASTIC / ELASTIC STRESS ----------------- */}
          <g transform="translate(230, 0)">
            <text x="100" y="16" fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle">
              2. Eurocode EN 1993 Stress Profile
            </text>

            <line x1="90" y1="45" x2="90" y2="195" stroke="#475569" strokeWidth="1.5" />

            {/* Top compression block */}
            <rect x="45" y="45" width="45" height="15" fill="#ef4444" fillOpacity="0.6" stroke="#ef4444" />
            <text x="40" y="56" fill="#ef4444" fontSize="9" textAnchor="end">-fy={fy}MPa</text>

            {/* Bottom tension block */}
            <rect x="90" y="180" width="45" height="15" fill="#10b981" fillOpacity="0.6" stroke="#10b981" />
            <text x="140" y="191" fill="#10b981" fontSize="9">+fy={fy}MPa</text>

            {/* Plastic vs Elastic distribution */}
            <line x1="45" y1="120" x2="135" y2="120" stroke="#38bdf8" strokeWidth="1.5" strokeDasharray="3 3" />
            <text x="140" y="123" fill="#38bdf8" fontSize="9">Plastic N.A.</text>

            <rect x="25" y="215" width="165" height="20" rx="4" fill="#0f172a" stroke="#334155" />
            <text x="107" y="229" fill="#fde047" fontSize="9" textAnchor="middle" fontWeight="bold">
              {sClass <= 2 ? 'Full Plastic Stress Block (Mpl,Rd)' : 'Elastic Triangular Stress (Mel,Rd)'}
            </text>
          </g>
        </svg>
      );
    }

    // ------------------------------------------------------------------------
    // 3. MASONRY WALL (EN 1996-1-1)
    // ------------------------------------------------------------------------
    if (memberType === 'masonry_wall') {
      const t = params.t || 250;
      const l = Math.round((params.l || 1.0) * 1000);
      const lc = Math.round((params.lc || 0.75) * 1000);
      const fd = (result?.fd || 2.5).toFixed(2);
      const fk = (result?.fk || 4.5).toFixed(2);
      const em = (result?.emk || 15).toFixed(1);

      return (
        <svg viewBox="0 0 440 260" className="w-full h-64 select-none">
          {/* ----------------- LEFT: SCALED MASONRY CAD SECTION ----------------- */}
          <g>
            <text x="110" y="16" fill="#94a3b8" fontSize="10" fontWeight="bold" textAnchor="middle">
              1. Masonry Wall Strip (t={t} mm, l={l} mm)
            </text>

            {/* Wall Outline */}
            <rect x="35" y="45" width="150" height="150" rx="2" fill="#1e293b" stroke="#64748b" strokeWidth="1.5" />

            {/* Brick Courses with Mortar Bed Joints */}
            {[0, 1, 2, 3, 4, 5, 6].map((i) => (
              <line key={i} x1="35" y1={45 + (i + 1) * 21.4} x2="185" y2={45 + (i + 1) * 21.4} stroke="#475569" strokeWidth="1" />
            ))}

            {/* Head Joints */}
            {[0, 2, 4, 6].map((i) => (
              <g key={`h-${i}`}>
                <line x1="85" y1={45 + i * 21.4} x2="85" y2={45 + (i + 1) * 21.4} stroke="#475569" strokeWidth="1" />
                <line x1="135" y1={45 + i * 21.4} x2="135" y2={45 + (i + 1) * 21.4} stroke="#475569" strokeWidth="1" />
              </g>
            ))}
            {[1, 3, 5].map((i) => (
              <g key={`h2-${i}`}>
                <line x1="60" y1={45 + i * 21.4} x2="60" y2={45 + (i + 1) * 21.4} stroke="#475569" strokeWidth="1" />
                <line x1="110" y1={45 + i * 21.4} x2="110" y2={45 + (i + 1) * 21.4} stroke="#475569" strokeWidth="1" />
                <line x1="160" y1={45 + i * 21.4} x2="160" y2={45 + (i + 1) * 21.4} stroke="#475569" strokeWidth="1" />
              </g>
            ))}

            {/* Compressed Length / Area lc */}
            <rect x="35" y="45" width="112" height="150" fill="#10b981" fillOpacity="0.2" stroke="#10b981" strokeWidth="1.5" strokeDasharray="3 3" />
            <text x="91" y="125" fill="#34d399" fontSize="10" textAnchor="middle" fontWeight="bold">Compressed lc = {lc} mm</text>

            {/* Normal Force Eccentricity Arrow */}
            <line x1="100" y1="25" x2="100" y2="45" stroke="#f59e0b" strokeWidth="2.5" />
            <polygon points="100,45 96,38 104,38" fill="#f59e0b" />
            <text x="105" y="35" fill="#f59e0b" fontSize="8" fontWeight="bold">NEd (e={em}mm)</text>

            <text x="110" y="215" fill="#fde68a" fontSize="10" textAnchor="middle" fontWeight="bold">
              {params.unitGroup || 'Clay / G1'} â€¢ fk = {fk} MPa
            </text>
          </g>

          {/* ----------------- RIGHT: EUROCODE EN 1996 STRESS BLOCK ----------------- */}
          <g transform="translate(230, 0)">
            <text x="100" y="16" fill="#38bdf8" fontSize="10" fontWeight="bold" textAnchor="middle">
              2. Eurocode EN 1996 Stress Block
            </text>

            {/* Rectangular stress block over effective width lc */}
            <line x1="90" y1="45" x2="90" y2="195" stroke="#475569" strokeWidth="1" />
            <rect x="50" y="45" width="40" height="110" fill="#0284c7" fillOpacity="0.75" stroke="#38bdf8" strokeWidth="1.5" />
            <text x="40" y="105" fill="#38bdf8" fontSize="9" textAnchor="end">fd = {fd} MPa</text>

            {/* Centroid force */}
            <line x1="70" y1="30" x2="70" y2="45" stroke="#38bdf8" strokeWidth="2" />
            <polygon points="70,45 67,39 73,39" fill="#38bdf8" />
            <text x="75" y="35" fill="#38bdf8" fontSize="9" fontWeight="bold">NRd</text>

            {/* Tension crack / zero tension zone */}
            <rect x="90" y="155" width="40" height="40" fill="#ef4444" fillOpacity="0.2" stroke="#ef4444" strokeDasharray="2 2" />
            <text x="135" y="178" fill="#ef4444" fontSize="8">Zero tension zone</text>

            <rect x="25" y="215" width="165" height="20" rx="4" fill="#0f172a" stroke="#334155" />
            <text x="107" y="229" fill="#38bdf8" fontSize="9" textAnchor="middle" fontWeight="bold">
              EN 1996-1-1 Â§6.1 â€¢ Î¦i = {(result?.Phi_i || 0.85).toFixed(2)}
            </text>
          </g>
        </svg>
      );
    }

    // ------------------------------------------------------------------------
    // 4. TIMBER GLULAM & CLT (EN 1995-1-1 / ETA)
    // ------------------------------------------------------------------------
    const isCLT = memberType === 'clt_slab' || memberType === 'clt_wall';
    const b = params.b || 120;
    const h = params.h || 320;
    const t = params.t || 160;
    const fmd = (result?.fmd || 14.8).toFixed(1);
    const fvd = (result?.fvd || 2.1).toFixed(1);

    return (
      <svg viewBox="0 0 440 260" className="w-full h-64 select-none">
        {/* ----------------- LEFT: TIMBER SECTION & LAYUP ----------------- */}
        <g>
          <text x="110" y="16" fill="#94a3b8" fontSize="10" fontWeight="bold" textAnchor="middle">
            {isCLT ? `1. Cross-Laminated Layup (t=${t} mm)` : `1. Glulam Section (${b}Ã—${h} mm)`}
          </text>

          {isCLT ? (
            // 5 Alternating CLT plies
            [0, 1, 2, 3, 4].map((i) => (
              <rect
                key={i}
                x="30"
                y={45 + i * 30}
                width="160"
                height="27"
                fill={i % 2 === 0 ? '#d97706' : '#92400e'}
                stroke="#78350f"
                strokeWidth="1.5"
              />
            ))
          ) : (
            // Glulam laminations
            <g transform="translate(45, 45)">
              <rect x="0" y="0" width="130" height="150" fill="#1e293b" stroke="#b45309" strokeWidth="2" />
              {[1, 2, 3, 4].map((i) => (
                <line key={i} x1="0" y1={i * 30} x2="130" y2={i * 30} stroke="#78350f" strokeWidth="1.5" />
              ))}
              <text x="65" y="78" fill="#fde68a" fontSize="10" textAnchor="middle" fontWeight="bold">
                {params.timberClass || 'GL24h'}
              </text>
            </g>
          )}

          <text x="110" y="215" fill="#fde68a" fontSize="10" textAnchor="middle" fontWeight="bold">
            {isCLT ? `5-Ply ETA Documented (MR,d = ${(result?.MR_d || 46).toFixed(1)} kNm)` : `${params.timberClass || 'GL24h'} â€¢ Service Class ${params.serviceClass || 1}`}
          </text>
        </g>

        {/* ----------------- RIGHT: SHEAR ANALOGY & BENDING STRESS ----------------- */}
        <g transform="translate(230, 0)">
          <text x="100" y="16" fill="#10b981" fontSize="10" fontWeight="bold" textAnchor="middle">
            2. {isCLT ? 'Shear Analogy Normal & Rolling Shear' : 'Eurocode Linear Bending & Shear'}
          </text>

          <line x1="90" y1="45" x2="90" y2="195" stroke="#475569" strokeWidth="1" />

          {/* Bending triangles */}
          <polygon points="90,45 50,45 90,120" fill="#ef4444" fillOpacity="0.45" stroke="#ef4444" />
          <polygon points="90,195 130,195 90,120" fill="#10b981" fillOpacity="0.45" stroke="#10b981" />

          <text x="40" y="55" fill="#ef4444" fontSize="9" textAnchor="end">-fm,d = {fmd} MPa</text>
          <text x="135" y="195" fill="#10b981" fontSize="9">+fm,d = {fmd} MPa</text>

          {/* Shear parabola indicator */}
          <path d="M 90,45 Q 125,120 90,195" fill="none" stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="2 2" />
          <text x="128" y="123" fill="#f59e0b" fontSize="8">Ï„max={fvd}MPa</text>

          <rect x="25" y="215" width="165" height="20" rx="4" fill="#0f172a" stroke="#334155" />
          <text x="107" y="229" fill="#a7f3d0" fontSize="9" textAnchor="middle" fontWeight="bold">
            {isCLT ? 'Shear Analogy â€¢ Rolling Shear fr,d' : 'EN 1995-1-1 Â§6.1 â€¢ kmod = 0.80'}
          </text>
        </g>
      </svg>
    );
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3 shadow-xl">
      {/* Header & View Mode Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="p-1 rounded bg-sky-500/20 text-sky-400">
            <Layers className="w-3.5 h-3.5" />
          </span>
          <span className="text-xs font-extrabold uppercase tracking-wider text-white">
            Section Cutaway & Stress Profile
          </span>
        </div>

        {/* View Mode Buttons */}
        <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-xl border border-slate-800 text-[11px]">
          <button
            type="button"
            onClick={() => setViewMode('3d')}
            className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
              viewMode === '3d' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Box className="w-3 h-3" />
            3D Cutaway
          </button>
          <button
            type="button"
            onClick={() => setViewMode('2d')}
            className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
              viewMode === '2d' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Sliders className="w-3 h-3" />
            2D Stress Diagram
          </button>
          <button
            type="button"
            onClick={() => setViewMode('split')}
            className={`px-2.5 py-1 rounded-lg font-bold transition flex items-center gap-1 ${
              viewMode === 'split' ? 'bg-sky-600 text-white shadow' : 'text-slate-400 hover:text-white'
            }`}
          >
            <Maximize2 className="w-3 h-3" />
            Split
          </button>
        </div>
      </div>

      {/* Visual Toggles Bar */}
      {viewMode !== '2d' && (
        <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] bg-slate-950/60 px-3 py-1.5 rounded-xl border border-slate-800/80">
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={showNeutralAxisPlane}
                onChange={(e) => setShowNeutralAxisPlane(e.target.checked)}
                className="rounded border-slate-700 text-sky-500 focus:ring-sky-400 w-3 h-3"
              />
              <span className="font-semibold">N.A. Compression Plane</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
              <input
                type="checkbox"
                checked={wireframe}
                onChange={(e) => setWireframe(e.target.checked)}
                className="rounded border-slate-700 text-sky-500 focus:ring-sky-400 w-3 h-3"
              />
              <span className="font-semibold">Wireframe</span>
            </label>
            <div className="flex items-center gap-1.5 text-slate-400">
              <span>Concrete Opacity:</span>
              <input
                type="range"
                min="0.2"
                max="0.9"
                step="0.05"
                value={concreteOpacity}
                onChange={(e) => setConcreteOpacity(parseFloat(e.target.value))}
                className="w-16 accent-sky-500 h-1 bg-slate-800 rounded cursor-pointer"
              />
            </div>
          </div>
          <button
            type="button"
            onClick={() => resetCameraRef.current?.()}
            className="text-slate-400 hover:text-sky-300 flex items-center gap-1 transition"
            title="Reset 3D camera angle"
          >
            <RotateCcw className="w-3 h-3" />
            Reset Camera
          </button>
        </div>
      )}

      {/* Main Viewport Container */}
      <div className={`grid gap-3 ${viewMode === 'split' ? 'grid-cols-1 xl:grid-cols-2' : 'grid-cols-1'}`}>
        {/* 3D WebGL Canvas */}
        {(viewMode === '3d' || viewMode === 'split') && (
          <div className="bg-slate-950/90 rounded-xl border border-slate-800/80 overflow-hidden relative shadow-inner">
            <div ref={mountRef} className="w-full h-64 cursor-grab active:cursor-grabbing" />
            <div className="absolute bottom-2 left-2 pointer-events-none text-[10px] text-slate-400 bg-slate-900/80 px-2 py-0.5 rounded border border-slate-800 backdrop-blur-sm">
              ðŸ–±ï¸  Drag to orbit â€¢ Scroll to zoom
            </div>
          </div>
        )}

        {/* 2D CAD & Eurocode Stress Distribution Diagram */}
        {(viewMode === '2d' || viewMode === 'split') && (
          <div className="bg-slate-950/90 rounded-xl border border-slate-800/80 p-2 flex items-center justify-center overflow-x-auto shadow-inner">
            {render2DCadAndStressDiagram()}
          </div>
        )}
      </div>

      {/* Real-time Utilization Bar */}
      <div className="space-y-1.5 pt-1">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-300">Governing Utilisation (Î·max):</span>
            {getStatusBadge()}
          </div>
          <span className={`font-mono font-extrabold ${eta <= 0.8 ? 'text-emerald-400' : eta <= 1.0 ? 'text-amber-400' : 'text-rose-400'}`}>
            {eta.toFixed(3)} ({Math.round(eta * 100)}%)
          </span>
        </div>
        <div className="w-full h-2.5 rounded-full bg-slate-800 overflow-hidden relative">
          <div
            className={`h-full transition-all duration-300 rounded-full ${
              eta <= 0.8 ? 'bg-emerald-500' : eta <= 1.0 ? 'bg-amber-500' : 'bg-rose-500'
            }`}
            style={{ width: `${Math.min(100, Math.max(3, eta * 100))}%` }}
          />
          <div className="absolute top-0 bottom-0 right-0 w-0.5 bg-rose-400 opacity-70" />
        </div>
      </div>
    </div>
  );
};
