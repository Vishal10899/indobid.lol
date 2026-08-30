'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { LeaderboardItemData } from '@/components/LeaderboardCard';
import { SceneControls } from './SceneControls';
import { BuildingInfoCard } from './BuildingInfoCard';
import { getCountryFlag } from '@/lib/countries';
import { Layers } from 'lucide-react';

interface LiveOfficeSceneProps {
  items: LeaderboardItemData[];
  onOutbid?: (item: LeaderboardItemData) => void;
  onOpenSubmit?: (data?: { targetBidDollars?: number; categoryId?: string }) => void;
}

// ---------------------------------------------------------------------------
// 1. Definition of the Six Buildings in Master Reference Architectural Palette
// ---------------------------------------------------------------------------
interface BuildingSlotConfig {
  rank: number; // 1 to 6
  x: number;
  z: number;
  baseHeight: number;
  width: number;
  depth: number;
  structureColor: string;
  secondaryColor: string;
  glassColor: string;
  accentColor: string;
  roofType: 'helipad' | 'penthouse' | 'stepped' | 'terrace';
}

const SIX_BUILDINGS: BuildingSlotConfig[] = [
  // #1: Central Landmark Headquarters (Dominant 100% Scale Hero Tower)
  {
    rank: 1,
    x: 0,
    z: 0,
    baseHeight: 5.8,
    width: 2.3,
    depth: 2.3,
    structureColor: '#35464B', // Charcoal Structural Frame
    secondaryColor: '#58676A', // Slate Trim
    glassColor: '#173F46', // Deep Teal Glass
    accentColor: '#DE8063', // Brand Coral Accent
    roofType: 'helipad',
  },
  // #2: Upper-Left / Left-Back Modern Glass Tower (65% Height of #1)
  {
    rank: 2,
    x: -5.4,
    z: -3.6,
    baseHeight: 3.8,
    width: 1.4,
    depth: 1.4,
    structureColor: '#39494E',
    secondaryColor: '#52656A',
    glassColor: '#17616A', // Teal Glass
    accentColor: '#087F78',
    roofType: 'penthouse',
  },
  // #3: Lower-Left / Front-Left Stepped Terrace Tower (60% Height of #1)
  {
    rank: 3,
    x: -5.2,
    z: 3.2,
    baseHeight: 3.5,
    width: 1.35,
    depth: 1.35,
    structureColor: '#D8D5C9', // Light Concrete
    secondaryColor: '#C9C5B8',
    glassColor: '#26383D',
    accentColor: '#D8795D', // Coral Facade Accent
    roofType: 'stepped',
  },
  // #4: Upper-Right / Right-Back Corporate HQ (58% Height of #1)
  {
    rank: 4,
    x: 5.4,
    z: -3.6,
    baseHeight: 3.4,
    width: 1.4,
    depth: 1.4,
    structureColor: '#C9C5B8', // Warm Concrete
    secondaryColor: '#52656A',
    glassColor: '#3E7881', // Desaturated Blue Glass
    accentColor: '#087F78',
    roofType: 'terrace',
  },
  // #5: Lower-Right / Front-Right Corner Glass Pavilion (55% Height of #1)
  {
    rank: 5,
    x: 5.2,
    z: 3.2,
    baseHeight: 3.2,
    width: 1.35,
    depth: 1.35,
    structureColor: '#39494E', // Charcoal
    secondaryColor: '#52656A',
    glassColor: '#1F3B40',
    accentColor: '#DE8063',
    roofType: 'penthouse',
  },
  // #6: Far Center-Front Tech Pavilion (46% Height of #1 - Low profile preserves open sightline to #1)
  {
    rank: 6,
    x: 0,
    z: 5.4,
    baseHeight: 2.6,
    width: 1.3,
    depth: 1.3,
    structureColor: '#D8D5C9', // Light Concrete
    secondaryColor: '#52656A',
    glassColor: '#17616A',
    accentColor: '#087F78',
    roofType: 'terrace',
  },
];

// ---------------------------------------------------------------------------
// 2. High-Fidelity Office Window Texture (Warm Amber Glow & Dark Slate Glass)
// ---------------------------------------------------------------------------
function createStylizedWindowTexture(glassColorHex: string, isUnclaimed?: boolean): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d');

  if (ctx) {
    // Glass base tint
    ctx.fillStyle = isUnclaimed ? '#1F2A2E' : glassColorHex;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const cols = 5;
    const rows = 14;
    const padX = 16;
    const padY = 12;
    const winW = (canvas.width - (cols + 1) * padX) / cols;
    const winH = (canvas.height - (rows + 1) * padY) / rows;

    for (let r = 0; r < rows; r++) {
      // Horizontal concrete/charcoal floor spandrels
      ctx.fillStyle = isUnclaimed ? 'rgba(70, 84, 90, 0.4)' : 'rgba(88, 103, 106, 0.45)';
      ctx.fillRect(0, r * (winH + padY), canvas.width, padY);

      for (let c = 0; c < cols; c++) {
        const wx = padX + c * (winW + padX);
        const wy = padY + r * (winH + padY);

        // Natural office illumination pattern (45-50% warmly lit with Amber #F3B45F & #FFD38A)
        const isIlluminated = (r * 3 + c * 5) % 3 === 0 || (r * 7 + c * 2) % 5 === 0;

        if (isIlluminated) {
          // Warm glowing Amber office interior
          const grad = ctx.createLinearGradient(wx, wy, wx, wy + winH);
          grad.addColorStop(0, '#FFF6E0');
          grad.addColorStop(0.6, '#FFD38A'); // Warm interior glow
          grad.addColorStop(1, '#F3B45F'); // Amber window glow
          ctx.fillStyle = grad;
        } else {
          // Dark reflective glass pane
          const grad = ctx.createLinearGradient(wx, wy, wx, wy + winH);
          if (isUnclaimed) {
            grad.addColorStop(0, 'rgba(45, 60, 66, 0.7)');
            grad.addColorStop(1, 'rgba(24, 33, 38, 0.95)');
          } else {
            grad.addColorStop(0, 'rgba(62, 120, 129, 0.65)');
            grad.addColorStop(1, 'rgba(23, 63, 70, 0.95)');
          }
          ctx.fillStyle = grad;
        }

        ctx.fillRect(wx, wy, winW, winH);

        // Window mullion frame border
        ctx.strokeStyle = 'rgba(16, 37, 54, 0.4)';
        ctx.lineWidth = 2;
        ctx.strokeRect(wx, wy, winW, winH);
      }
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

// ---------------------------------------------------------------------------
// 3. Main LiveOfficeScene Component
// ---------------------------------------------------------------------------
export function LiveOfficeScene({ items, onOutbid, onOpenSubmit }: LiveOfficeSceneProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedItem, setSelectedItem] = useState<LeaderboardItemData | null>(null);
  const [hoveredRank, setHoveredRank] = useState<number | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [webglSupported, setWebglSupported] = useState(true);

  // Label element refs for direct 60fps DOM transform updates (zero React state lag & zero flickering)
  const labelRefs = useRef<(HTMLDivElement | null)[]>([]);

  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  // Elevated 3/4 isometric camera target: theta 45°, phi 37.9°, radius 35.0 (generous top breathing room)
  const targetOrbitAngle = useRef({ theta: Math.PI / 4.0, phi: Math.PI / 4.75, radius: 35.0 });
  const currentOrbitAngle = useRef({ theta: Math.PI / 4.0, phi: Math.PI / 4.75, radius: 35.0 });
  const isDragging = useRef(false);
  const previousPointer = useRef({ x: 0, y: 0 });

  // Mesh to data mapping for raycast inspection
  const meshToItemMap = useRef<Map<THREE.Object3D, LeaderboardItemData>>(new Map());
  const meshToRankMap = useRef<Map<THREE.Object3D, number>>(new Map());

  // 3D Anchor positions for screen-space projection
  const labelAnchorsRef = useRef<{ rank: number; position: THREE.Vector3; isCenter: boolean }[]>([]);

  // Animated elements references
  const treesRef = useRef<{ group: THREE.Group; initialRotZ: number; speed: number }[]>([]);
  const beaconRef = useRef<THREE.Mesh | null>(null);

  // Check WebGL support
  useEffect(() => {
    try {
      const canvas = document.createElement('canvas');
      const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
      if (!gl) setWebglSupported(false);
    } catch {
      setWebglSupported(false);
    }
  }, []);

  // Main Three.js Scene Setup & Render Loop
  useEffect(() => {
    if (!containerRef.current || !webglSupported) return;

    const container = containerRef.current;
    const width = container.clientWidth || 800;
    const height = container.clientHeight || 540;
    const isMobile = width < 640;

    // Automatic distance framing: spacious overview showing all 6 buildings comfortably
    const initialRadius = isMobile ? 42.0 : 35.0;
    targetOrbitAngle.current.radius = initialRadius;
    currentOrbitAngle.current.radius = initialRadius;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // 1. Scene & Warm Ivory Background (#FBF9F3 / #F8F6EF)
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xFBF9F3); // Warm Ivory
    scene.fog = new THREE.FogExp2(0xFBF9F3, 0.007);

    // 2. Camera: Elevated 3/4 isometric perspective (FOV 28° / 32°)
    const camera = new THREE.PerspectiveCamera(isMobile ? 32 : 28, width / height, 0.5, 200);
    cameraRef.current = camera;

    // 3. Renderer
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance',
      alpha: true,
    });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    // 4. Warm Architectural Studio Daylight + Ambient Fill
    const ambientLight = new THREE.AmbientLight(0xFFFBF0, 2.5);
    scene.add(ambientLight);

    const sunLight = new THREE.DirectionalLight(0xFFF5E4, 3.2);
    sunLight.position.set(24, 40, 24);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 1024;
    sunLight.shadow.mapSize.height = 1024;
    sunLight.shadow.camera.near = 5;
    sunLight.shadow.camera.far = 110;
    sunLight.shadow.camera.left = -28;
    sunLight.shadow.camera.right = 28;
    sunLight.shadow.camera.top = 28;
    sunLight.shadow.camera.bottom = -28;
    sunLight.shadow.bias = -0.0002;
    sunLight.shadow.normalBias = 0.02;
    scene.add(sunLight);

    const fillLight = new THREE.HemisphereLight(0xFBF9F3, 0xD8D5C9, 1.2);
    scene.add(fillLight);

    // -----------------------------------------------------------------------
    // 5. MINIATURE ARCHITECTURAL CITY PODIUM, NATURAL GRASS & URBAN ROADS
    // -----------------------------------------------------------------------
    // A. Main Warm Concrete Pedestal Base (#D8D5C9)
    const pedestalGeo = new THREE.CylinderGeometry(14.8, 15.3, 0.45, 64);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0xD8D5C9, // Warm Concrete
      roughness: 0.85,
      metalness: 0.05,
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.y = -0.225;
    pedestal.receiveShadow = true;
    scene.add(pedestal);

    // B. Natural Muted Green Grass Base Island (#547B55)
    const grassBaseGeo = new THREE.CylinderGeometry(14.3, 14.3, 0.02, 64);
    const grassBaseMat = new THREE.MeshStandardMaterial({
      color: 0x547B55, // Muted Green Grass
      roughness: 0.85,
    });
    const grassBase = new THREE.Mesh(grassBaseGeo, grassBaseMat);
    grassBase.position.y = 0.01;
    grassBase.receiveShadow = true;
    scene.add(grassBase);

    // C. Paved Asphalt City Streets (#46545A)
    const roadMat = new THREE.MeshStandardMaterial({
      color: 0x46545A, // Dark Slate Road
      roughness: 0.8,
      metalness: 0.1,
      side: THREE.DoubleSide,
    });

    // Inner Central Plaza Ring around #1
    const innerRoadGeo = new THREE.RingGeometry(3.0, 4.4, 64);
    const innerRoad = new THREE.Mesh(innerRoadGeo, roadMat);
    innerRoad.rotation.x = -Math.PI / 2;
    innerRoad.position.y = 0.02;
    innerRoad.receiveShadow = true;
    scene.add(innerRoad);

    // Outer Boulevard Ring connecting outer buildings
    const outerRoadGeo = new THREE.RingGeometry(7.6, 9.0, 64);
    const outerRoad = new THREE.Mesh(outerRoadGeo, roadMat);
    outerRoad.rotation.x = -Math.PI / 2;
    outerRoad.position.y = 0.02;
    outerRoad.receiveShadow = true;
    scene.add(outerRoad);

    // Radial Connecting Avenues
    const radialAngles = [
      Math.PI / 4,
      (3 * Math.PI) / 4,
      (5 * Math.PI) / 4,
      (7 * Math.PI) / 4,
      Math.PI / 2,
      -Math.PI / 2,
    ];
    radialAngles.forEach((ang) => {
      const radRoadGeo = new THREE.PlaneGeometry(1.3, 3.4);
      const radRoad = new THREE.Mesh(radRoadGeo, roadMat);
      radRoad.rotation.x = -Math.PI / 2;
      radRoad.rotation.z = -ang;
      radRoad.position.set(Math.cos(ang) * 6.0, 0.021, Math.sin(ang) * 6.0);
      radRoad.receiveShadow = true;
      scene.add(radRoad);
    });

    // D. Painted Off-White Dashed Centerlines (#F7F3E8)
    const dashedGeo = new THREE.RingGeometry(3.7 - 0.025, 3.7 + 0.025, 64);
    const dashedMat = new THREE.MeshBasicMaterial({
      color: 0xF7F3E8,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
    const dashedLine = new THREE.Mesh(dashedGeo, dashedMat);
    dashedLine.rotation.x = -Math.PI / 2;
    dashedLine.position.y = 0.025;
    scene.add(dashedLine);

    // E. High-Visibility Painted Zebra Crosswalks at Building Access Points
    const crosswalkLocations = [
      { x: 0, z: 2.9, rot: 0 },
      { x: 0, z: -2.9, rot: 0 },
      { x: -2.9, z: 0, rot: Math.PI / 2 },
      { x: 2.9, z: 0, rot: Math.PI / 2 },
      { x: -4.8, z: 1.2, rot: Math.PI / 4 },
      { x: 4.8, z: 1.2, rot: -Math.PI / 4 },
      { x: 0, z: 4.8, rot: 0 },
    ];

    crosswalkLocations.forEach((loc) => {
      const cwGroup = new THREE.Group();
      cwGroup.position.set(loc.x, 0.026, loc.z);
      cwGroup.rotation.y = loc.rot;

      for (let s = -3; s <= 3; s++) {
        const stripeGeo = new THREE.PlaneGeometry(0.12, 0.85);
        const stripeMat = new THREE.MeshBasicMaterial({ color: 0xF7F3E8, side: THREE.DoubleSide });
        const stripe = new THREE.Mesh(stripeGeo, stripeMat);
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(s * 0.18, 0, 0);
        cwGroup.add(stripe);
      }

      scene.add(cwGroup);
    });

    // F. Light Sidewalks & Curbs (#BEBCAF)
    const sidewalkMat = new THREE.MeshStandardMaterial({ color: 0xBEBCAF, roughness: 0.7 });
    const innerSidewalkGeo = new THREE.RingGeometry(2.65, 3.0, 64);
    const innerSidewalk = new THREE.Mesh(innerSidewalkGeo, sidewalkMat);
    innerSidewalk.rotation.x = -Math.PI / 2;
    innerSidewalk.position.y = 0.028;
    innerSidewalk.receiveShadow = true;
    scene.add(innerSidewalk);

    // G. Muted Green Stylized Trees & Landscaping (#547B55 & #355A43)
    treesRef.current = [];

    const treeTrunkGeo = new THREE.CylinderGeometry(0.05, 0.07, 0.4, 8);
    const treeTrunkMat = new THREE.MeshStandardMaterial({ color: 0x5C4638, roughness: 0.85 });
    const coniferGeo = new THREE.ConeGeometry(0.3, 0.65, 8);
    const coniferMat = new THREE.MeshStandardMaterial({ color: 0x355A43, roughness: 0.75 }); // Dark Green
    const roundTreeGeo = new THREE.SphereGeometry(0.28, 8, 8);
    const roundTreeMat = new THREE.MeshStandardMaterial({ color: 0x547B55, roughness: 0.75 }); // Primary Green
    const shrubGeo = new THREE.SphereGeometry(0.14, 6, 6);
    const shrubMat = new THREE.MeshStandardMaterial({ color: 0x78966C, roughness: 0.8 }); // Light Foliage Shrub

    const treePositions = [
      { x: 1.8, z: 1.8 }, { x: -1.8, z: 1.8 }, { x: 1.8, z: -1.8 }, { x: -1.8, z: -1.8 },
      { x: 6.2, z: 0 }, { x: -6.2, z: 0 }, { x: 0, z: -5.6 },
      { x: 7.8, z: 4.2 }, { x: -7.8, z: 4.2 }, { x: 7.8, z: -4.2 }, { x: -7.8, z: -4.2 },
      { x: 10.5, z: 1.8 }, { x: -10.5, z: 1.8 }, { x: 3.2, z: 6.8 }, { x: -3.2, z: 6.8 },
    ];

    treePositions.forEach((pos, idx) => {
      const treeGroup = new THREE.Group();
      treeGroup.position.set(pos.x, 0, pos.z);

      const trunk = new THREE.Mesh(treeTrunkGeo, treeTrunkMat);
      trunk.position.y = 0.2;
      trunk.castShadow = true;
      treeGroup.add(trunk);

      const isConifer = idx % 2 === 0;
      const foliage = new THREE.Mesh(isConifer ? coniferGeo : roundTreeGeo, isConifer ? coniferMat : roundTreeMat);
      foliage.position.y = isConifer ? 0.62 : 0.58;
      foliage.castShadow = true;
      treeGroup.add(foliage);

      // Shrub next to tree
      const shrub = new THREE.Mesh(shrubGeo, shrubMat);
      shrub.position.set(0.18, 0.1, 0.15);
      treeGroup.add(shrub);

      scene.add(treeGroup);
      treesRef.current.push({ group: treeGroup, initialRotZ: 0, speed: 1.2 + (idx % 3) * 0.3 });
    });

    // H. Miniature Street Lamps at Crosswalk Intersections (Warm Amber Light #F4B85F)
    const lampPostGeo = new THREE.CylinderGeometry(0.025, 0.025, 0.6, 8);
    const lampPostMat = new THREE.MeshStandardMaterial({ color: 0x35464B, metalness: 0.6, roughness: 0.3 });
    const lampLightGeo = new THREE.SphereGeometry(0.07, 8, 8);
    const lampLightMat = new THREE.MeshBasicMaterial({ color: 0xF4B85F }); // Warm Amber Glow

    const lampPositions = [
      { x: 2.9, z: 1.0 }, { x: -2.9, z: 1.0 }, { x: 2.9, z: -1.0 }, { x: -2.9, z: -1.0 },
      { x: 6.8, z: 2.6 }, { x: -6.8, z: 2.6 },
    ];

    lampPositions.forEach((pos) => {
      const lampGroup = new THREE.Group();
      lampGroup.position.set(pos.x, 0, pos.z);

      const pole = new THREE.Mesh(lampPostGeo, lampPostMat);
      pole.position.y = 0.3;
      lampGroup.add(pole);

      const bulb = new THREE.Mesh(lampLightGeo, lampLightMat);
      bulb.position.y = 0.62;
      lampGroup.add(bulb);

      scene.add(lampGroup);
    });

    // I. Tiny Stylized Miniature Cars (Teal #087F78, Coral #DE8063, Navy #102536, Light Concrete #D8D5C9)
    const carColors = [0x087F78, 0xDE8063, 0x102536, 0xD8D5C9, 0x056B66];
    const carSpots = [
      { x: 4.2, z: -1.4, rot: Math.PI / 3, color: carColors[0] }, // Teal
      { x: -4.2, z: -1.4, rot: -Math.PI / 3, color: carColors[1] }, // Coral
      { x: 1.4, z: 4.2, rot: 0.1, color: carColors[2] }, // Navy
      { x: -1.4, z: 4.2, rot: -0.1, color: carColors[3] }, // Light Concrete
      { x: 6.4, z: -2.2, rot: Math.PI / 4, color: carColors[4] },
    ];

    carSpots.forEach((spot) => {
      const carGroup = new THREE.Group();
      carGroup.position.set(spot.x, 0.05, spot.z);
      carGroup.rotation.y = spot.rot;

      const bodyGeo = new THREE.BoxGeometry(0.35, 0.12, 0.2);
      const bodyMat = new THREE.MeshStandardMaterial({ color: spot.color, roughness: 0.4 });
      const body = new THREE.Mesh(bodyGeo, bodyMat);
      body.position.y = 0.06;
      body.castShadow = true;
      carGroup.add(body);

      const cabinGeo = new THREE.BoxGeometry(0.18, 0.09, 0.16);
      const cabinMat = new THREE.MeshStandardMaterial({ color: 0x182126, roughness: 0.2 });
      const cabin = new THREE.Mesh(cabinGeo, cabinMat);
      cabin.position.set(-0.02, 0.15, 0);
      carGroup.add(cabin);

      scene.add(carGroup);
    });

    // -----------------------------------------------------------------------
    // 6. RENDER EXACTLY SIX ARCHITECTURAL STARTUP BUILDINGS
    // -----------------------------------------------------------------------
    meshToItemMap.current.clear();
    meshToRankMap.current.clear();
    labelAnchorsRef.current = [];

    SIX_BUILDINGS.forEach((config) => {
      const isCenter = config.rank === 1;

      // Check for real database listing
      const realItem = items.find((it) => it.rank === config.rank);
      const isClaimed = !!realItem;

      // Height and proportions (100% scale for #1, 50-65% for surrounding)
      const dollars = realItem ? realItem.verifiedBid / 100 : undefined;
      const height = isCenter
        ? config.baseHeight
        : config.baseHeight + (isClaimed ? Math.min(0.4, Math.log10(Math.max(1, dollars || 1)) * 0.15) : 0);
      const width = config.width;
      const depth = config.depth;

      const structColor = config.structureColor;
      const secColor = config.secondaryColor;
      const glassColor = config.glassColor;
      const accentColor = config.accentColor;

      const buildingGroup = new THREE.Group();
      buildingGroup.position.set(config.x, 0, config.z);

      // A. Designated Landscaped Base Plot (Muted Grass Lawn + Stone Curb)
      const plotWidth = width + 0.45;
      const plotDepth = depth + 0.45;
      const plotGeo = new THREE.BoxGeometry(plotWidth, 0.08, plotDepth);
      const plotMat = new THREE.MeshStandardMaterial({
        color: isClaimed ? 0x547B55 : 0x355A43, // Grass Plot
        roughness: 0.8,
      });
      const plotMesh = new THREE.Mesh(plotGeo, plotMat);
      plotMesh.position.y = 0.04;
      plotMesh.receiveShadow = true;
      buildingGroup.add(plotMesh);

      // Stone Curb Border around Plot
      const curbGeo = new THREE.BoxGeometry(plotWidth + 0.08, 0.05, plotDepth + 0.08);
      const curbMat = new THREE.MeshStandardMaterial({ color: 0xBEBCAF, roughness: 0.7 });
      const curbMesh = new THREE.Mesh(curbGeo, curbMat);
      curbMesh.position.y = 0.025;
      buildingGroup.add(curbMesh);

      // Paved Entrance Path connecting building to the street
      const pathGeo = new THREE.BoxGeometry(width * 0.45, 0.02, 0.35);
      const pathMat = new THREE.MeshStandardMaterial({ color: 0xD8D5C9, roughness: 0.6 });
      const pathMesh = new THREE.Mesh(pathGeo, pathMat);
      pathMesh.position.set(0, 0.085, depth / 2 + 0.15);
      buildingGroup.add(pathMesh);

      // Small Entrance Shrubbery
      const shrubLeft = new THREE.Mesh(shrubGeo, shrubMat);
      shrubLeft.position.set(-width * 0.4, 0.12, depth / 2 + 0.12);
      buildingGroup.add(shrubLeft);

      const shrubRight = new THREE.Mesh(shrubGeo, shrubMat);
      shrubRight.position.set(width * 0.4, 0.12, depth / 2 + 0.12);
      buildingGroup.add(shrubRight);

      // B. Window grid texture with Amber glow & dark glass
      const winTex = createStylizedWindowTexture(glassColor, !isClaimed);

      // C. Tower Main Glass Core
      const towerGeo = new THREE.BoxGeometry(width, height, depth);
      const towerMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(glassColor),
        roughness: 0.24,
        metalness: 0.3,
        map: winTex,
      });
      const towerMesh = new THREE.Mesh(towerGeo, towerMat);
      towerMesh.position.y = height / 2;
      towerMesh.castShadow = true;
      towerMesh.receiveShadow = true;
      buildingGroup.add(towerMesh);

      // D. 3D Architectural Structural Corner Columns & Facade Mullions
      const colWidth = width * 0.09;
      const colGeo = new THREE.BoxGeometry(colWidth, height + 0.02, colWidth);
      const colMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(structColor),
        roughness: 0.7,
        metalness: 0.1,
      });

      const cornerOffsets = [
        { x: width / 2 - colWidth / 2, z: depth / 2 - colWidth / 2 },
        { x: -width / 2 + colWidth / 2, z: depth / 2 - colWidth / 2 },
        { x: width / 2 - colWidth / 2, z: -depth / 2 + colWidth / 2 },
        { x: -width / 2 + colWidth / 2, z: -depth / 2 + colWidth / 2 },
      ];

      cornerOffsets.forEach((off) => {
        const colMesh = new THREE.Mesh(colGeo, colMat);
        colMesh.position.set(off.x, height / 2, off.z);
        colMesh.castShadow = true;
        buildingGroup.add(colMesh);
      });

      // Horizontal Floor Spandrel Bands
      const numFloors = Math.floor(height / 0.85);
      for (let f = 1; f < numFloors; f++) {
        const floorY = (height / numFloors) * f;
        const slabGeo = new THREE.BoxGeometry(width + 0.04, 0.06, depth + 0.04);
        const slabMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(secColor),
          roughness: 0.65,
        });
        const slabMesh = new THREE.Mesh(slabGeo, slabMat);
        slabMesh.position.y = floorY;
        slabMesh.castShadow = true;
        buildingGroup.add(slabMesh);
      }

      // E. Rooftop Parapet Curb & Trim
      const parapetGeo = new THREE.BoxGeometry(width * 0.94, 0.22, depth * 0.94);
      const parapetMat = new THREE.MeshStandardMaterial({
        color: new THREE.Color(structColor),
        roughness: 0.5,
        metalness: 0.15,
      });
      const parapetMesh = new THREE.Mesh(parapetGeo, parapetMat);
      parapetMesh.position.y = height + 0.11;
      parapetMesh.castShadow = true;
      buildingGroup.add(parapetMesh);

      // Roof Surface Inner Deck
      const roofDeckGeo = new THREE.BoxGeometry(width * 0.88, 0.02, depth * 0.88);
      const roofDeckMat = new THREE.MeshStandardMaterial({
        color: isCenter ? 0x547B55 : 0xBEBCAF, // #1 has rooftop green lawn
        roughness: 0.8,
      });
      const roofDeck = new THREE.Mesh(roofDeckGeo, roofDeckMat);
      roofDeck.position.y = height + 0.18;
      buildingGroup.add(roofDeck);

      // F. Rooftop Mechanical Penthouse / Helipad / Spire Details
      if (isCenter) {
        // Upper Stepped Observation Penthouse
        const penthouseGeo = new THREE.BoxGeometry(width * 0.55, 0.5, depth * 0.55);
        const penthouseMat = new THREE.MeshStandardMaterial({
          color: 0x35464B, // Charcoal
          roughness: 0.5,
        });
        const penthouse = new THREE.Mesh(penthouseGeo, penthouseMat);
        penthouse.position.y = height + 0.44;
        penthouse.castShadow = true;
        buildingGroup.add(penthouse);

        // Rooftop Garden Planter & Mini Tree on #1 Roof Deck
        const roofPlanterGeo = new THREE.BoxGeometry(0.45, 0.1, 0.45);
        const roofPlanterMat = new THREE.MeshStandardMaterial({ color: 0x087F78 });
        const roofPlanter = new THREE.Mesh(roofPlanterGeo, roofPlanterMat);
        roofPlanter.position.set(-width * 0.28, height + 0.24, -depth * 0.28);
        buildingGroup.add(roofPlanter);

        // Stainless Steel Antenna Mast
        const antennaGeo = new THREE.CylinderGeometry(0.04, 0.07, 1.4, 16);
        const antennaMat = new THREE.MeshStandardMaterial({ color: 0xD8D5C9, metalness: 0.9, roughness: 0.1 });
        const antenna = new THREE.Mesh(antennaGeo, antennaMat);
        antenna.position.y = height + 1.38;
        antenna.castShadow = true;
        buildingGroup.add(antenna);

        // Golden Glowing Beacon Light Sphere (#F4C343)
        const beaconGeo = new THREE.SphereGeometry(0.15, 16, 16);
        const beaconMat = new THREE.MeshBasicMaterial({ color: 0xF4C343 });
        const beacon = new THREE.Mesh(beaconGeo, beaconMat);
        beacon.position.y = height + 2.08;
        buildingGroup.add(beacon);
        beaconRef.current = beacon;
      } else if (config.roofType === 'penthouse' || config.roofType === 'stepped') {
        const hvacGeo = new THREE.BoxGeometry(width * 0.45, 0.32, depth * 0.45);
        const hvacMat = new THREE.MeshStandardMaterial({
          color: 0x58676A,
          roughness: 0.6,
        });
        const hvac = new THREE.Mesh(hvacGeo, hvacMat);
        hvac.position.y = height + 0.34;
        hvac.castShadow = true;
        buildingGroup.add(hvac);

        // Small HVAC Fan Cylinder
        const fanGeo = new THREE.CylinderGeometry(0.12, 0.12, 0.1, 12);
        const fanMat = new THREE.MeshStandardMaterial({ color: 0x35464B, metalness: 0.5, roughness: 0.4 });
        const fan = new THREE.Mesh(fanGeo, fanMat);
        fan.position.set(0, height + 0.54, 0);
        buildingGroup.add(fan);
      } else {
        // Rooftop Garden / Terrace Accent Box
        const terraceGeo = new THREE.BoxGeometry(width * 0.42, 0.24, depth * 0.42);
        const terraceMat = new THREE.MeshStandardMaterial({
          color: new THREE.Color(accentColor),
          roughness: 0.6,
        });
        const terrace = new THREE.Mesh(terraceGeo, terraceMat);
        terrace.position.y = height + 0.28;
        terrace.castShadow = true;
        buildingGroup.add(terrace);
      }

      // G. Ground Floor Entrance Canopy & Glass Lobby
      const canopyGeo = new THREE.BoxGeometry(width * 0.6, 0.08, 0.38);
      const canopyMat = new THREE.MeshStandardMaterial({
        color: isClaimed ? 0x087F78 : 0x58676A,
        roughness: 0.2,
      });
      const canopy = new THREE.Mesh(canopyGeo, canopyMat);
      canopy.position.set(0, 0.42, depth / 2 + 0.16);
      canopy.castShadow = true;
      buildingGroup.add(canopy);

      // Entrance Pillars
      const pillarGeo = new THREE.CylinderGeometry(0.03, 0.03, 0.4, 8);
      const pillarMat = new THREE.MeshStandardMaterial({ color: 0xD8D5C9, metalness: 0.4, roughness: 0.3 });
      const pLeft = new THREE.Mesh(pillarGeo, pillarMat);
      pLeft.position.set(-width * 0.25, 0.2, depth / 2 + 0.3);
      buildingGroup.add(pLeft);

      const pRight = new THREE.Mesh(pillarGeo, pillarMat);
      pRight.position.set(width * 0.25, 0.2, depth / 2 + 0.3);
      buildingGroup.add(pRight);

      // Register 3D anchor position at physical roof level for screen-space HTML projection
      labelAnchorsRef.current.push({
        rank: config.rank,
        position: new THREE.Vector3(config.x, height + (isCenter ? 0.35 : 0.25), config.z),
        isCenter,
      });

      scene.add(buildingGroup);

      // Register interactive meshes for raycast inspection
      meshToRankMap.current.set(towerMesh, config.rank);
      meshToRankMap.current.set(parapetMesh, config.rank);
      meshToRankMap.current.set(canopy, config.rank);
      meshToRankMap.current.set(buildingGroup, config.rank);

      if (realItem) {
        meshToItemMap.current.set(towerMesh, realItem);
        meshToItemMap.current.set(parapetMesh, realItem);
        meshToItemMap.current.set(canopy, realItem);
        meshToItemMap.current.set(buildingGroup, realItem);
      }
    });

    // -----------------------------------------------------------------------
    // 7. Raycasting for hover & click interaction
    // -----------------------------------------------------------------------
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();

    const getRaycastHit = (clientX: number, clientY: number) => {
      const rect = container.getBoundingClientRect();
      pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);

      const allMeshes = Array.from(meshToRankMap.current.keys());
      const intersects = raycaster.intersectObjects(allMeshes, true);

      if (intersects.length > 0) {
        let hitObj: THREE.Object3D | null = intersects[0].object;
        while (hitObj) {
          if (meshToRankMap.current.has(hitObj)) {
            const rank = meshToRankMap.current.get(hitObj)!;
            const item = meshToItemMap.current.get(hitObj) || null;
            return { rank, item };
          }
          hitObj = hitObj.parent;
        }
      }
      return null;
    };

    const onPointerDown = (e: PointerEvent) => {
      isDragging.current = true;
      previousPointer.current = { x: e.clientX, y: e.clientY };
    };

    const onPointerMove = (e: PointerEvent) => {
      if (isDragging.current) {
        const deltaX = e.clientX - previousPointer.current.x;
        const deltaY = e.clientY - previousPointer.current.y;

        targetOrbitAngle.current.theta -= deltaX * 0.005;
        targetOrbitAngle.current.phi = Math.max(
          0.32,
          Math.min(Math.PI / 2.6, targetOrbitAngle.current.phi + deltaY * 0.005)
        );

        previousPointer.current = { x: e.clientX, y: e.clientY };
      } else {
        const hit = getRaycastHit(e.clientX, e.clientY);
        container.style.cursor = hit ? 'pointer' : 'grab';
        setHoveredRank(hit ? hit.rank : null);
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (isDragging.current) {
        const movedDist =
          Math.abs(e.clientX - previousPointer.current.x) +
          Math.abs(e.clientY - previousPointer.current.y);

        if (movedDist < 5) {
          const hit = getRaycastHit(e.clientX, e.clientY);
          if (hit) {
            if (hit.item) {
              setSelectedItem(hit.item);
            } else if (onOpenSubmit) {
              onOpenSubmit({ targetBidDollars: 2 });
            }
          }
        }
      }
      isDragging.current = false;
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      targetOrbitAngle.current.radius = Math.max(
        28.0,
        Math.min(44.0, targetOrbitAngle.current.radius + e.deltaY * 0.015)
      );
    };

    container.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    container.addEventListener('wheel', onWheel, { passive: false });

    const onResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);

    // 8. Smooth Animation Loop with Pure GPU-Composited Screen-Space Projection
    let animationFrameId: number;
    const clock = new THREE.Clock();

    const animate = () => {
      animationFrameId = requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Subtle tree breeze animation
      if (!prefersReducedMotion) {
        treesRef.current.forEach((t, i) => {
          t.group.rotation.z = Math.sin(elapsedTime * t.speed + i) * 0.02;
        });

        // Beacon Gold pulse
        if (beaconRef.current) {
          const s = 1.0 + Math.sin(elapsedTime * 3.5) * 0.12;
          beaconRef.current.scale.set(s, s, s);
        }
      }

      currentOrbitAngle.current.theta +=
        (targetOrbitAngle.current.theta - currentOrbitAngle.current.theta) * 0.06;
      currentOrbitAngle.current.phi +=
        (targetOrbitAngle.current.phi - currentOrbitAngle.current.phi) * 0.06;
      currentOrbitAngle.current.radius +=
        (targetOrbitAngle.current.radius - currentOrbitAngle.current.radius) * 0.06;

      const { theta, phi, radius } = currentOrbitAngle.current;
      camera.position.x = radius * Math.sin(phi) * Math.sin(theta);
      camera.position.y = radius * Math.cos(phi) + 1.2;
      camera.position.z = radius * Math.sin(phi) * Math.cos(theta);
      camera.lookAt(0, 1.2, 0); // Elevated lookAt target centers scene comfortably with large top margin for #1 label

      renderer.render(scene, camera);

      // Project 3D anchor points to 2D Screen-space coordinates for crisp HTML labels
      const currentContainerWidth = container.clientWidth || 800;
      const currentContainerHeight = container.clientHeight || 540;

      const rawProjected = labelAnchorsRef.current.map((anchor) => {
        const tempVec = anchor.position.clone();
        tempVec.project(camera);

        const screenX = ((tempVec.x + 1) / 2) * currentContainerWidth;
        const screenY = ((-tempVec.y + 1) / 2) * currentContainerHeight;
        const isVisible = tempVec.z < 1;

        return {
          rank: anchor.rank,
          screenX,
          screenY,
          isVisible,
          isCenter: anchor.isCenter,
        };
      });

      // Collision avoidance & safe clamping
      const centerLabel = rawProjected.find((l) => l.isCenter);

      rawProjected.forEach((lbl, idx) => {
        const el = labelRefs.current[idx];
        if (!el) return;

        if (!lbl.isVisible) {
          el.style.opacity = '0';
          el.style.pointerEvents = 'none';
          return;
        }

        let adjX = lbl.screenX;
        let adjY = lbl.screenY;

        if (lbl.isCenter) {
          // #1 Center Label: Strict top safe margin clamping (minimum 90px from top)
          adjY = Math.max(90, Math.min(currentContainerHeight - 25, adjY));
          adjX = Math.max(120, Math.min(currentContainerWidth - 120, adjX));
        } else if (centerLabel) {
          // Check proximity to #1 center card
          const dx = adjX - centerLabel.screenX;
          const dy = adjY - centerLabel.screenY;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const minCenterDist = 145; // Safe buffer around center card

          if (dist < minCenterDist && dist > 0) {
            const push = (minCenterDist - dist) / dist;
            adjX += dx * push * 0.8;
            adjY += dy * push * 0.8;
          }

          // Clamp surrounding labels to safe viewport bounds
          adjX = Math.max(85, Math.min(currentContainerWidth - 85, adjX));
          adjY = Math.max(70, Math.min(currentContainerHeight - 20, adjY));
        }

        el.style.opacity = '1';
        el.style.pointerEvents = 'auto';
        el.style.transform = `translate3d(${adjX}px, ${adjY}px, 0) translate(-50%, -100%)`;
      });
    };

    animate();

    // 9. Cleanup on unmount
    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', onResize);
      container.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('wheel', onWheel);

      scene.clear();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [items, onOpenSubmit, webglSupported]);

  // Camera Controls Handlers
  const handleResetCamera = useCallback(() => {
    targetOrbitAngle.current = { theta: Math.PI / 4.0, phi: Math.PI / 4.75, radius: 35.0 };
  }, []);

  const handleZoomIn = useCallback(() => {
    targetOrbitAngle.current.radius = Math.max(28.0, targetOrbitAngle.current.radius - 2.5);
  }, []);

  const handleZoomOut = useCallback(() => {
    targetOrbitAngle.current.radius = Math.min(44.0, targetOrbitAngle.current.radius + 2.5);
  }, []);

  const handleToggleFullscreen = useCallback(() => {
    if (!containerRef.current?.parentElement) return;
    if (!document.fullscreenElement) {
      containerRef.current.parentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  // WebGL Fallback
  if (!webglSupported) {
    return (
      <div className="w-full h-64 rounded-2xl bg-white border border-[#E5DDCC] p-6 flex flex-col items-center justify-center text-center space-y-3 shadow-xs">
        <Layers className="w-9 h-9 text-[#087F78] opacity-80" />
        <h3 className="font-bold text-sm text-[#102536]">
          Live Office 3D View Unavailable
        </h3>
        <p className="text-xs text-[#405866] max-w-md">
          Your browser does not currently support hardware-accelerated WebGL. Please use the interactive List View below.
        </p>
      </div>
    );
  }

  return (
    <div
      className={`relative w-full rounded-2xl border border-[#E5DDCC] bg-[#FBF9F3] overflow-hidden shadow-xs transition-all ${
        isFullscreen ? 'fixed inset-0 z-50 rounded-none h-screen' : 'h-[420px] sm:h-[480px] md:h-[540px] lg:h-[580px] max-h-[620px]'
      }`}
    >
      {/* 3D Canvas Viewport */}
      <div
        ref={containerRef}
        className="w-full h-full cursor-grab active:cursor-grabbing select-none"
      />

      {/* --------------------------------------------------------------------- */}
      {/* CRISP SCREEN-SPACE HTML LEADERBOARD CARDS IN TEAL & GOLD CHARCOAL BADGES */}
      {/* --------------------------------------------------------------------- */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden z-10">
        {SIX_BUILDINGS.map((config, idx) => {
          const isCenter = config.rank === 1;
          const realItem = items.find((it) => it.rank === config.rank);
          const isClaimed = !!realItem;
          const isHovered = hoveredRank === config.rank;
          const flag = realItem?.countryCode ? getCountryFlag(realItem.countryCode) : '';
          const dollars = realItem ? realItem.verifiedBid / 100 : 0;

          return (
            <div
              key={config.rank}
              ref={(el) => {
                labelRefs.current[idx] = el;
              }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                transform: 'translate3d(0, 0, 0) translate(-50%, -100%)',
                willChange: 'transform, opacity',
                opacity: 0,
              }}
              className="flex flex-col items-center cursor-pointer group select-none"
              onClick={(e) => {
                e.stopPropagation();
                if (realItem) {
                  setSelectedItem(realItem);
                } else if (onOpenSubmit) {
                  onOpenSubmit({ targetBidDollars: 2 });
                }
              }}
              onMouseEnter={() => setHoveredRank(config.rank)}
              onMouseLeave={() => setHoveredRank(null)}
            >
              {/* 1. Floating Rank Badge: Almost-black charcoal #182126 with Gold #F4C343 text */}
              <div
                className={`flex items-center justify-center font-black rounded-xl border shadow-md transition-transform duration-150 ${
                  isCenter
                    ? 'w-[60px] sm:w-[68px] h-[38px] sm:h-[44px] text-xl sm:text-2xl bg-[#182126] text-[#F4C343] border-[#F4C343] ring-2 ring-[#DE8063]/50'
                    : 'w-[40px] sm:w-[46px] h-[26px] sm:h-[30px] text-xs sm:text-sm bg-[#182126] text-[#F4C343] border-[#F4C343]/80'
                } ${isHovered ? 'scale-110 shadow-lg' : ''}`}
              >
                #{config.rank}
              </div>

              {/* Connector Pin between Badge & Signboard */}
              <div
                className={`w-[1.5px] ${
                  isCenter ? 'h-2 bg-[#DE8063]' : 'h-1.5 bg-[#087F78]'
                }`}
              />

              {/* 2. Building Information Board / Signboard: Brand Teal #087F78 */}
              <div
                className={`flex flex-col items-center justify-center rounded-2xl backdrop-blur-md border shadow-xl transition-transform duration-150 ${
                  isCenter
                    ? 'min-w-[210px] sm:min-w-[245px] max-w-[270px] px-4 sm:px-5 py-2.5 sm:py-3 bg-[#087F78]/96 border-[#DE8063] ring-2 ring-[#DE8063]/30'
                    : isClaimed
                    ? 'min-w-[145px] sm:min-w-[170px] max-w-[190px] px-2.5 sm:px-3 py-1.5 sm:py-2 bg-[#087F78]/94 border-[#B9DFDA]/80'
                    : 'min-w-[135px] sm:min-w-[155px] max-w-[175px] px-2.5 sm:px-3 py-1.5 sm:py-2 bg-[#087F78]/85 border-[#B9DFDA]/50'
                } ${isHovered ? 'scale-105 shadow-2xl brightness-110' : ''}`}
              >
                {isClaimed ? (
                  <>
                    {/* Company Title */}
                    <div
                      className={`flex items-center space-x-1.5 truncate ${
                        isCenter ? 'max-w-[230px]' : 'max-w-[155px]'
                      }`}
                    >
                      {flag && <span className={isCenter ? 'text-base' : 'text-xs'}>{flag}</span>}
                      <span
                        className={`font-black text-white tracking-tight truncate ${
                          isCenter ? 'text-base sm:text-lg' : 'text-xs sm:text-sm'
                        }`}
                      >
                        {realItem?.title}
                      </span>
                    </div>

                    {/* Verified Bid Amount in White / Gold */}
                    <div className="flex items-center space-x-1.5 mt-0.5">
                      <span
                        className={`font-mono font-bold text-[#FFD38A] ${
                          isCenter ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'
                        }`}
                      >
                        ${dollars.toLocaleString()}
                      </span>
                      <span
                        className={`font-bold text-white/90 uppercase tracking-wider ${
                          isCenter ? 'text-xs' : 'text-[10px]'
                        }`}
                      >
                        Verified
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    {/* UNCLAIMED */}
                    <span
                      className={`font-extrabold text-white tracking-wide ${
                        isCenter ? 'text-sm sm:text-base' : 'text-xs sm:text-sm'
                      }`}
                    >
                      AVAILABLE
                    </span>
                    <span
                      className={`font-bold text-[#FFD38A] ${
                        isCenter ? 'text-xs mt-0.5' : 'text-[10px]'
                      }`}
                    >
                      Claim Spot · $2
                    </span>
                  </>
                )}
              </div>

              {/* Thin Vertical Stem Connector leading straight down to building roof */}
              <div className="flex flex-col items-center">
                <div
                  className={`w-[2px] ${
                    isCenter ? 'h-3.5 bg-[#DE8063]' : 'h-2 bg-[#087F78]'
                  }`}
                />
                <div
                  className={`w-2 h-2 rounded-full border ${
                    isCenter
                      ? 'bg-[#F4C343] border-[#DE8063]'
                      : 'bg-[#F4C343] border-[#087F78]'
                  } shadow-xs`}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Floating Camera Controls (Top-Right) */}
      <SceneControls
        onReset={handleResetCamera}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        isFullscreen={isFullscreen}
        onToggleFullscreen={handleToggleFullscreen}
      />

      {/* Interactive Helper Hint Badge (Top-Left) */}
      <div className="absolute top-3.5 left-3.5 z-20 hidden sm:flex items-center space-x-1.5 bg-white/95 backdrop-blur-md border border-[#E5DDCC] px-3 py-1.5 rounded-xl text-xs text-[#405866] font-medium shadow-xs pointer-events-none">
        <span className="w-1.5 h-1.5 rounded-full bg-[#087F78]" />
        <span>Drag to rotate • Scroll to zoom • Click building for details</span>
      </div>

      {/* Selected Building Detail Modal */}
      <BuildingInfoCard
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onOutbid={onOutbid}
      />
    </div>
  );
}
