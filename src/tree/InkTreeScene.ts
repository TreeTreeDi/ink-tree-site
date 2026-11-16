import * as THREE from 'three';
import {
  BIO_PARAGRAPHS,
  ME_PHOTOS,
  UPDATE_ENTRIES,
  WORK_LINKS,
  WRITING_POSTS,
  type BranchId,
} from '../data/siteContent';
import {
  buildCanopyGeometry,
  buildGroundFlora,
  buildStrokeGeometry,
  buildTwigWithThorns,
  buildWobblyUnderline,
  generateCanopyCluster,
  sampleOrganicPath,
  type Point2D,
} from './geometry';
import {
  createAbstractPhotoTexture,
  createBioParagraphTexture,
  createTextTexture,
  type BioLinkHitbox,
} from './proceduralArt';
import { createRng } from './rng';
import {
  CANOPY_FRAG,
  CANOPY_VERT,
  DUST_FRAG,
  DUST_VERT,
  HALFTONE_PHOTO_FRAG,
  HALFTONE_PHOTO_VERT,
  INK_STROKE_FRAG,
  INK_STROKE_VERT,
  INK_TEXT_FRAG,
  INK_TEXT_VERT,
  PAPER_BG_FRAG,
  PAPER_BG_VERT,
  TAPE_FRAG,
  TORN_FRAME_FRAG,
  TORN_FRAME_VERT,
} from './shaders';

const INK_COLOR = new THREE.Color().setRGB(
  196 / 255,
  195 / 255,
  204 / 255,
  THREE.LinearSRGBColorSpace,
);

export interface HitTargetScreen {
  id: string;
  label: string;
  text: string;
  x: number;
  y: number;
  w: number;
  h: number;
  kind: 'branch' | 'route' | 'external' | 'photo';
  branchId?: BranchId;
  href?: string;
  caption?: string;
}

export interface SceneCallbacks {
  onSelectBranch: (branch: BranchId | null) => void;
  onNavigateRoute: (route: string) => void;
  onHoverChange: (hoveredId: string | null, caption: string | null) => void;
  onHitTargetsUpdate: (targets: HitTargetScreen[]) => void;
}

interface BranchRuntime {
  id: BranchId;
  rootGroup: THREE.Group;
  twigMesh: THREE.Mesh;
  twigMat: THREE.ShaderMaterial;
  growthGroup: THREE.Group;
  growthMats: THREE.ShaderMaterial[];
  canopyMats: THREE.ShaderMaterial[];
  labelMesh: THREE.Mesh;
  labelMat: THREE.ShaderMaterial;
  labelDotMesh: THREE.Mesh;
  labelDotMat: THREE.ShaderMaterial;
  underlineMesh: THREE.Mesh;
  underlineMat: THREE.ShaderMaterial;
  labelWorldCenter: Point2D;
  labelSize: { w: number; h: number };
  openProgress: number; // 0..1
  hoverProgress: number; // 0..1
  openedAtMs: number;
  cameraTarget: { x: number; y: number; zoom: number };
  childItems: Array<{
    id: string;
    label: string;
    kind: 'route' | 'external';
    href: string;
    worldCenter: Point2D;
    size: { w: number; h: number };
    underlineMat: THREE.ShaderMaterial;
    hoverProgress: number;
    appearDelaySec: number;
    textMat: THREE.ShaderMaterial;
    subTextMat?: THREE.ShaderMaterial;
  }>;
}

interface BioRuntimeItem {
  mesh: THREE.Mesh;
  mat: THREE.ShaderMaterial;
  worldCenter: Point2D;
  size: { w: number; h: number };
  links: BioLinkHitbox[];
  delaySec: number;
}

interface PhotoRuntimeItem {
  group: THREE.Group;
  photoMat: THREE.ShaderMaterial;
  tapeMats: THREE.ShaderMaterial[];
  captionMesh: THREE.Mesh;
  captionMat: THREE.ShaderMaterial;
  worldCenter: Point2D;
  w: number;
  h: number;
  caption: string;
  id: string;
  delaySec: number;
  baseY: number;
  hoverProgress: number;
}

export class InkTreeScene {
  private container: HTMLElement;
  private callbacks: SceneCallbacks;
  private renderer: THREE.WebGLRenderer;
  private scene: THREE.Scene;
  private bgScene: THREE.Scene;
  private frameScene: THREE.Scene;
  private camera: THREE.OrthographicCamera;
  private orthoCam: THREE.OrthographicCamera;

  private width = 1440;
  private height = 900;
  private worldW = 1440;
  private worldH = 900;
  private isMobile = false;
  private pixelRatio = 1;
  private reducedMotion = false;

  private disposables: Array<{ dispose: () => void }> = [];
  private sharedMaterials: THREE.ShaderMaterial[] = [];

  private paperBgMat!: THREE.ShaderMaterial;
  private tornFrameMat!: THREE.ShaderMaterial;
  private dustMat!: THREE.ShaderMaterial;
  private rootsMat!: THREE.ShaderMaterial;
  private extraGrassMat!: THREE.ShaderMaterial;
  private shrubsMat!: THREE.ShaderMaterial;

  private treeGroup = new THREE.Group();
  private branches = new Map<BranchId, BranchRuntime>();
  private bioItems: BioRuntimeItem[] = [];
  private photoItems: PhotoRuntimeItem[] = [];

  private activeBranch: BranchId | null = null;
  private hoveredId: string | null = null;
  private branchOpenElapsed = 0;

  // Camera state
  private camPos = new THREE.Vector2(0, 0);
  private camTarget = new THREE.Vector2(0, 0);
  private camZoom = 1;
  private camTargetZoom = 1;
  private camVel = new THREE.Vector2(0, 0);
  private panOffset = new THREE.Vector2(0, 0);
  private tiltOffset = new THREE.Vector2(0, 0);

  // Pointer drag state
  private isDragging = false;
  private dragStart = new THREE.Vector2();
  private dragLast = new THREE.Vector2();
  private dragMovedDist = 0;
  private pointerWorld = new THREE.Vector2(99999, 99999);

  private rafId = 0;
  private lastTime = performance.now();
  private elapsed = 0;
  private destroyed = false;
  private resizeObserver: ResizeObserver;
  private lastHitSig = '';

  constructor(container: HTMLElement, callbacks: SceneCallbacks) {
    this.container = container;
    this.callbacks = callbacks;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.width = Math.max(320, container.clientWidth || window.innerWidth);
    this.height = Math.max(320, container.clientHeight || window.innerHeight);
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(this.width, this.height);
    this.renderer.autoClear = false;
    this.renderer.setClearColor(0x111012, 1);
    this.renderer.domElement.style.display = 'block';
    this.renderer.domElement.style.width = '100%';
    this.renderer.domElement.style.height = '100%';
    this.renderer.domElement.setAttribute('aria-hidden', 'true');
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.bgScene = new THREE.Scene();
    this.frameScene = new THREE.Scene();
    this.orthoCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 10);
    this.camera = new THREE.OrthographicCamera(-720, 720, 450, -450, -100, 100);
    this.camera.position.z = 20;

    this.buildFullscreenPasses();
    this.rebuildWorld();
    this.bindEvents();

    this.resizeObserver = new ResizeObserver(() => this.handleResize());
    this.resizeObserver.observe(container);

    this.animate();
  }

  private track<T extends { dispose: () => void }>(obj: T): T {
    this.disposables.push(obj);
    return obj;
  }

  private buildFullscreenPasses() {
    const quadGeo = this.track(new THREE.PlaneGeometry(2, 2));

    this.paperBgMat = this.track(
      new THREE.ShaderMaterial({
        vertexShader: PAPER_BG_VERT,
        fragmentShader: PAPER_BG_FRAG,
        depthWrite: false,
        depthTest: false,
        uniforms: {
          uResolution: { value: new THREE.Vector2(this.width * this.pixelRatio, this.height * this.pixelRatio) },
          uPanOffset: { value: new THREE.Vector2(0, 0) },
        },
      }),
    );
    this.bgScene.add(new THREE.Mesh(quadGeo, this.paperBgMat));

    this.tornFrameMat = this.track(
      new THREE.ShaderMaterial({
        vertexShader: TORN_FRAME_VERT,
        fragmentShader: TORN_FRAME_FRAG,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        uniforms: {
          uResolution: { value: new THREE.Vector2(this.width * this.pixelRatio, this.height * this.pixelRatio) },
          uPixelRatio: { value: this.pixelRatio },
        },
      }),
    );
    this.frameScene.add(new THREE.Mesh(quadGeo, this.tornFrameMat));
  }

  private computeVirtualDims() {
    const aspect = this.width / Math.max(1, this.height);
    this.isMobile = aspect < 0.78 || this.width < 640;
    if (this.isMobile) {
      this.worldW = 390;
      this.worldH = 390 / aspect;
    } else {
      this.worldH = 900;
      this.worldW = 900 * aspect;
    }
    this.camera.left = -this.worldW * 0.5;
    this.camera.right = this.worldW * 0.5;
    this.camera.top = this.worldH * 0.5;
    this.camera.bottom = -this.worldH * 0.5;
    this.camera.updateProjectionMatrix();
  }

  private toWorldY(pctFromTop: number): number {
    return this.worldH * (0.5 - pctFromTop);
  }

  private toWorldX(pctFromLeft: number): number {
    return this.worldW * (pctFromLeft - 0.5);
  }

  private makeStrokeMat(opts?: {
    progress?: number;
    opacity?: number;
    swayAmp?: number;
    swayPhase?: number;
    grainScale?: number;
  }): THREE.ShaderMaterial {
    const mat = this.track(
      new THREE.ShaderMaterial({
        vertexShader: INK_STROKE_VERT,
        fragmentShader: INK_STROKE_FRAG,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uProgress: { value: opts?.progress ?? 1 },
          uOpacity: { value: opts?.opacity ?? 1 },
          uInkColor: { value: INK_COLOR },
          uSwayAmp: { value: opts?.swayAmp ?? 0 },
          uSwayPhase: { value: opts?.swayPhase ?? 0 },
          uGrainScale: { value: opts?.grainScale ?? 1 },
          uReducedMotion: { value: this.reducedMotion ? 1 : 0 },
        },
      }),
    );
    this.sharedMaterials.push(mat);
    return mat;
  }

  private makeCanopyMat(opts?: {
    progress?: number;
    opacity?: number;
    swayAmp?: number;
    density?: number;
  }): THREE.ShaderMaterial {
    const mat = this.track(
      new THREE.ShaderMaterial({
        vertexShader: CANOPY_VERT,
        fragmentShader: CANOPY_FRAG,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTime: { value: 0 },
          uProgress: { value: opts?.progress ?? 1 },
          uOpacity: { value: opts?.opacity ?? 1 },
          uInkColor: { value: INK_COLOR },
          uSwayAmp: { value: opts?.swayAmp ?? 0.9 },
          uDensity: { value: opts?.density ?? 0.65 },
          uReducedMotion: { value: this.reducedMotion ? 1 : 0 },
        },
      }),
    );
    this.sharedMaterials.push(mat);
    return mat;
  }

  private makeTextMat(tex: THREE.Texture, progress = 1, opacity = 1): THREE.ShaderMaterial {
    const mat = this.track(
      new THREE.ShaderMaterial({
        vertexShader: INK_TEXT_VERT,
        fragmentShader: INK_TEXT_FRAG,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uTex: { value: tex },
          uProgress: { value: progress },
          uOpacity: { value: opacity },
          uInkColor: { value: INK_COLOR },
        },
      }),
    );
    this.sharedMaterials.push(mat);
    return mat;
  }

  private clearTreeGroup() {
    this.scene.remove(this.treeGroup);
    this.treeGroup = new THREE.Group();
    this.branches.clear();
    this.bioItems = [];
    this.photoItems = [];
    this.sharedMaterials = [];
  }

  private rebuildWorld() {
    this.clearTreeGroup();
    this.computeVirtualDims();

    const mobile = this.isMobile;
    const W = this.worldW;
    const H = this.worldH;

    // Key landmark coordinates
    const trunkX = mobile ? 12 : this.toWorldX(0.4);
    const groundY = mobile ? this.toWorldY(0.90) : this.toWorldY(0.942);
    const trunkBaseY = mobile ? groundY - 4 : this.toWorldY(0.968);
    const canopyTopY = mobile ? this.toWorldY(0.105) : this.toWorldY(0.18);
    const canopyBottomY = mobile ? this.toWorldY(0.65) : this.toWorldY(0.77);

    // 1. Trunk (straight, slightly tapered, passing visibly through canopy gaps)
    const trunkPts = sampleOrganicPath(
      [
        { x: trunkX, y: trunkBaseY },
        { x: trunkX + (mobile ? -1 : -1.5), y: (trunkBaseY + canopyBottomY) * 0.5 },
        { x: trunkX + 1, y: canopyBottomY + 24 },
        { x: trunkX, y: (canopyTopY + canopyBottomY) * 0.5 },
        { x: trunkX - 1, y: canopyTopY - 32 },
      ],
      14,
      1.0,
      42,
    );
    const trunkGeo = this.track(buildStrokeGeometry(trunkPts, mobile ? 9.5 : 11, 4.2, 42));
    const trunkMesh = new THREE.Mesh(trunkGeo, this.makeStrokeMat({ grainScale: 0.9 }));
    trunkMesh.position.z = 2.0;
    this.treeGroup.add(trunkMesh);

    // 2. Main Canopy (8-9 wide, solid S-curve staggered cloud layers so coves, holes & trunk peek through)
    const canopySpanY = canopyTopY - canopyBottomY;
    const canopyRx = mobile ? 60 : Math.min(126, W * 0.088);
    const clusterDefs = mobile
      ? [
          { yT: 0.93, dx: 9, rx: 0.56, ry: 0.090, lobes: 6, layer: 'front' },
          { yT: 0.82, dx: -16, rx: 0.64, ry: 0.096, lobes: 6, layer: 'back' },
          { yT: 0.70, dx: 24, rx: 0.72, ry: 0.104, lobes: 7, layer: 'front' },
          { yT: 0.57, dx: -25, rx: 0.76, ry: 0.112, lobes: 7, layer: 'front' },
          { yT: 0.44, dx: 25, rx: 0.74, ry: 0.106, lobes: 7, layer: 'back' },
          { yT: 0.33, dx: -22, rx: 0.70, ry: 0.102, lobes: 6, layer: 'front' },
          { yT: 0.21, dx: 19, rx: 0.64, ry: 0.096, lobes: 6, layer: 'back' },
          { yT: 0.09, dx: -11, rx: 0.54, ry: 0.086, lobes: 5, layer: 'front' },
        ]
      : [
          { yT: 0.94, dx: 12, rx: 0.56, ry: 0.088, lobes: 6, layer: 'front' },
          { yT: 0.84, dx: -40, rx: 0.66, ry: 0.098, lobes: 7, layer: 'back' },
          { yT: 0.73, dx: 44, rx: 0.72, ry: 0.104, lobes: 7, layer: 'front' },
          { yT: 0.61, dx: -46, rx: 0.76, ry: 0.114, lobes: 7, layer: 'front' },
          { yT: 0.49, dx: 45, rx: 0.75, ry: 0.108, lobes: 7, layer: 'back' },
          { yT: 0.38, dx: -40, rx: 0.72, ry: 0.104, lobes: 7, layer: 'back' },
          { yT: 0.27, dx: 42, rx: 0.68, ry: 0.098, lobes: 6, layer: 'front' },
          { yT: 0.16, dx: -32, rx: 0.64, ry: 0.092, lobes: 6, layer: 'front' },
          { yT: 0.06, dx: 16, rx: 0.52, ry: 0.082, lobes: 5, layer: 'back' },
        ];

    const backBlobs = clusterDefs
      .filter((c) => c.layer === 'back')
      .flatMap((c, idx) =>
        generateCanopyCluster(
          trunkX + c.dx,
          canopyBottomY + canopySpanY * c.yT,
          canopyRx * c.rx,
          canopySpanY * c.ry,
          c.lobes,
          300 + idx * 43,
        ),
      );
    const frontBlobs = clusterDefs
      .filter((c) => c.layer === 'front')
      .flatMap((c, idx) =>
        generateCanopyCluster(
          trunkX + c.dx,
          canopyBottomY + canopySpanY * c.yT,
          canopyRx * c.rx,
          canopySpanY * c.ry,
          c.lobes,
          470 + idx * 53,
        ),
      );

    const backCanopyGeo = this.track(buildCanopyGeometry(backBlobs));
    const backCanopyMesh = new THREE.Mesh(
      backCanopyGeo,
      this.makeCanopyMat({ swayAmp: 1.0, density: 0.72 }),
    );
    backCanopyMesh.position.z = 1.65;
    this.treeGroup.add(backCanopyMesh);

    const frontCanopyGeo = this.track(buildCanopyGeometry(frontBlobs));
    const frontCanopyMesh = new THREE.Mesh(
      frontCanopyGeo,
      this.makeCanopyMat({ swayAmp: 1.15, density: 0.78 }),
    );
    frontCanopyMesh.position.z = 2.35;
    this.treeGroup.add(frontCanopyMesh);

    // 3. Ground flora (continuous undulating grass 20-35px desktop / 40-60px mobile, irregular granular bed, ~8-12 wildflowers, zoomed roots & shrubs)
    const flora = buildGroundFlora({
      xMin: -W * 1.05,
      xMax: W * 1.05,
      groundY,
      trunkX,
      bandHeight: mobile ? 46 : 29,
      seed: 707,
      densityScale: mobile ? 0.96 : 0.98,
      flowerCount: mobile ? 9 : 11,
      flowerRange: mobile ? [-175, 175] : [-W * 0.46, W * 0.46],
    });
    this.track(flora.grassGeometry);
    this.track(flora.groundBedGeometry);
    this.track(flora.flowerHeadsGeometry);
    this.track(flora.rootsGeometry);
    this.track(flora.shrubsGeometry);

    const groundBedMesh = new THREE.Mesh(
      flora.groundBedGeometry,
      this.makeStrokeMat({ swayAmp: 0, grainScale: 1.15 }),
    );
    groundBedMesh.position.z = 2.05;
    this.treeGroup.add(groundBedMesh);

    const grassMesh = new THREE.Mesh(
      flora.grassGeometry,
      this.makeStrokeMat({ swayAmp: 1.35, swayPhase: 0.4, grainScale: 1.0 }),
    );
    grassMesh.position.z = 2.1;
    this.treeGroup.add(grassMesh);

    const flowerMesh = new THREE.Mesh(
      flora.flowerHeadsGeometry,
      this.makeCanopyMat({ swayAmp: 1.25, density: 0.78 }),
    );
    flowerMesh.position.z = 2.2;
    this.treeGroup.add(flowerMesh);

    this.rootsMat = this.makeStrokeMat({ progress: 0, opacity: 0.96 });
    const rootsMesh = new THREE.Mesh(flora.rootsGeometry, this.rootsMat);
    rootsMesh.position.z = 1.85;
    this.treeGroup.add(rootsMesh);

    this.shrubsMat = this.makeCanopyMat({ progress: 0, swayAmp: 0.55, density: 0.74 });
    const shrubsMesh = new THREE.Mesh(flora.shrubsGeometry, this.shrubsMat);
    shrubsMesh.position.z = 2.25;
    this.treeGroup.add(shrubsMesh);

    // Thicker ~60-80px lush grass band revealed when branches (especially me) open/zoom
    const extraFlora = buildGroundFlora({
      xMin: trunkX - 420,
      xMax: trunkX + 1080,
      groundY: groundY - 3,
      trunkX,
      bandHeight: mobile ? 62 : 66,
      seed: 808,
      densityScale: 1.02,
      flowerCount: 0,
    });
    this.track(extraFlora.grassGeometry);
    this.track(extraFlora.groundBedGeometry);
    extraFlora.flowerHeadsGeometry.dispose();
    extraFlora.rootsGeometry.dispose();
    extraFlora.shrubsGeometry.dispose();
    this.extraGrassMat = this.makeStrokeMat({
      progress: 0,
      opacity: 0.92,
      swayAmp: 1.5,
      swayPhase: 1.2,
    });
    const extraBedMesh = new THREE.Mesh(extraFlora.groundBedGeometry, this.extraGrassMat);
    extraBedMesh.position.z = 2.26;
    const extraGrassMesh = new THREE.Mesh(extraFlora.grassGeometry, this.extraGrassMat);
    extraGrassMesh.position.z = 2.3;
    this.treeGroup.add(extraBedMesh, extraGrassMesh);

    // 4. Sparse drifting dust particles across sheet
    this.buildDustParticles(W, H);

    // 5. Build the 4 top-level interactive branches + child growths
    this.buildBranches(trunkX, groundY, mobile);

    this.scene.add(this.treeGroup);

    // Restore active branch state if rebuilt after resize
    if (this.activeBranch) {
      const target = this.branches.get(this.activeBranch);
      if (target) {
        target.openProgress = 1;
        this.camTarget.set(target.cameraTarget.x, target.cameraTarget.y);
        this.camTargetZoom = target.cameraTarget.zoom;
        this.camPos.copy(this.camTarget);
        this.camZoom = this.camTargetZoom;
      }
    }
  }

  private buildDustParticles(W: number, H: number) {
    const rng = createRng(9911);
    const count = 150;
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    const alphas = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (rng() - 0.5) * W * 2.0;
      positions[i * 3 + 1] = (rng() - 0.5) * H * 1.7;
      positions[i * 3 + 2] = 0.5;
      sizes[i] = 1.6 + rng() * 2.1;
      alphas[i] = 0.24 + rng() * 0.34;
    }
    const geo = this.track(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute('aAlpha', new THREE.BufferAttribute(alphas, 1));
    this.dustMat = this.track(
      new THREE.ShaderMaterial({
        vertexShader: DUST_VERT,
        fragmentShader: DUST_FRAG,
        transparent: true,
        depthWrite: false,
        uniforms: {
          uPixelRatio: { value: this.pixelRatio },
          uTime: { value: 0 },
          uParallax: { value: new THREE.Vector2(0, 0) },
          uInkColor: { value: INK_COLOR },
        },
      }),
    );
    const pts = new THREE.Points(geo, this.dustMat);
    pts.position.z = 0.5;
    this.treeGroup.add(pts);
  }

  private createLabelUnit(
    text: string,
    dotText: string,
    center: Point2D,
    fontSize: number,
    seed: number,
  ) {
    const main = createTextTexture(text, { fontSize, fontWeight: 500 });
    const withDot = createTextTexture(dotText, { fontSize, fontWeight: 500 });
    this.track(main.texture);
    this.track(withDot.texture);

    const mainGeo = this.track(new THREE.PlaneGeometry(main.width, main.height));
    const mainMat = this.makeTextMat(main.texture, 1, 1);
    const mainMesh = new THREE.Mesh(mainGeo, mainMat);
    mainMesh.position.set(center.x, center.y, 6);

    const dotGeo = this.track(new THREE.PlaneGeometry(withDot.width, withDot.height));
    const dotMat = this.makeTextMat(withDot.texture, 1, 0);
    const dotMesh = new THREE.Mesh(dotGeo, dotMat);
    dotMesh.position.set(center.x, center.y, 6.1);

    const ulGeo = this.track(
      buildWobblyUnderline(
        center.x - main.width * 0.44,
        center.x + main.width * 0.44,
        center.y - fontSize * 0.56,
        seed,
      ),
    );
    const ulMat = this.makeStrokeMat({ progress: 0, opacity: 0.95 });
    const ulMesh = new THREE.Mesh(ulGeo, ulMat);
    ulMesh.position.z = 6.2;

    return {
      mainMesh,
      mainMat,
      dotMesh,
      dotMat,
      ulMesh,
      ulMat,
      size: { w: main.width, h: main.height },
    };
  }

  private buildBranches(trunkX: number, groundY: number, mobile: boolean) {
    const fontSize = 15;
    const labelGap = 8;

    const specs: Array<{
      id: BranchId;
      label: string;
      side: -1 | 1;
      y: number;
      startDx: number;
      tipDx: number;
      tipDy: number;
      thorns: number;
      seed: number;
      cameraTarget: { x: number; y: number; zoom: number };
    }> = mobile
      ? [
          {
            id: 'work',
            label: 'work with me',
            side: -1,
            y: this.toWorldY(0.185),
            startDx: -16,
            tipDx: -64,
            tipDy: 8,
            thorns: 2,
            seed: 101,
            cameraTarget: { x: -96, y: 148, zoom: 1.04 },
          },
          {
            id: 'updates',
            label: 'updates',
            side: 1,
            y: this.toWorldY(0.28),
            startDx: 18,
            tipDx: 76,
            tipDy: 9,
            thorns: 2,
            seed: 202,
            cameraTarget: { x: 110, y: 175, zoom: 1.08 },
          },
          {
            id: 'writing',
            label: 'writing',
            side: -1,
            y: this.toWorldY(0.39),
            startDx: -18,
            tipDx: -84,
            tipDy: 5,
            thorns: 2,
            seed: 303,
            cameraTarget: { x: -82, y: 50, zoom: 1.08 },
          },
          {
            id: 'me',
            label: 'me',
            side: 1,
            y: this.toWorldY(0.49),
            startDx: 16,
            tipDx: 78,
            tipDy: 4,
            thorns: 2,
            seed: 404,
            cameraTarget: { x: 148, y: -58, zoom: 0.90 },
          },
        ]
      : [
          {
            id: 'work',
            label: 'work with me',
            side: -1,
            y: this.toWorldY(0.305),
            startDx: -24,
            tipDx: -158,
            tipDy: 9,
            thorns: 2,
            seed: 101,
            cameraTarget: { x: -490, y: 208, zoom: 1.12 },
          },
          {
            id: 'updates',
            label: 'updates',
            side: 1,
            y: this.toWorldY(0.375),
            startDx: 26,
            tipDx: 172,
            tipDy: 10,
            thorns: 2,
            seed: 202,
            cameraTarget: { x: 245, y: 252, zoom: 1.16 },
          },
          {
            id: 'writing',
            label: 'writing',
            side: -1,
            y: this.toWorldY(0.505),
            startDx: -26,
            tipDx: -168,
            tipDy: 6,
            thorns: 2,
            seed: 303,
            cameraTarget: { x: -245, y: 20, zoom: 1.16 },
          },
          {
            id: 'me',
            label: 'me',
            side: 1,
            y: this.toWorldY(0.575),
            startDx: 24,
            tipDx: 164,
            tipDy: 5,
            thorns: 2,
            seed: 404,
            cameraTarget: { x: 364, y: -70, zoom: 1.02 },
          },
        ];

    for (const s of specs) {
      const rootGroup = new THREE.Group();
      const twigPts: Point2D[] = [
        { x: trunkX + s.startDx, y: s.y - 3 },
        { x: trunkX + (s.startDx + s.tipDx) * 0.5, y: s.y + s.tipDy * 0.48 },
        { x: trunkX + s.tipDx, y: s.y + s.tipDy },
      ];
      const twigGeo = this.track(buildTwigWithThorns(twigPts, 3.5, 1.9, s.thorns, s.seed));
      const twigMat = this.makeStrokeMat({ swayAmp: 0.38, swayPhase: s.seed * 0.05 });
      const twigMesh = new THREE.Mesh(twigGeo, twigMat);
      twigMesh.position.z = 2.15;
      rootGroup.add(twigMesh);

      const tip = twigPts[2];
      const tmpTex = createTextTexture(s.label, { fontSize, fontWeight: 500 });
      const labelCenter: Point2D = {
        x: tip.x + s.side * (tmpTex.width * 0.5 + labelGap),
        y: tip.y + 1,
      };
      tmpTex.texture.dispose();

      const lbl = this.createLabelUnit(s.label, `${s.label}.`, labelCenter, fontSize, s.seed + 9);
      rootGroup.add(lbl.mainMesh, lbl.dotMesh, lbl.ulMesh);

      const growthGroup = new THREE.Group();
      const growthMats: THREE.ShaderMaterial[] = [];
      const canopyMats: THREE.ShaderMaterial[] = [];
      const childItems: BranchRuntime['childItems'] = [];

      // Build branch-specific expansion content
      if (s.id === 'me') {
        this.buildMeGrowth(tip, trunkX, groundY, mobile, growthGroup, growthMats, canopyMats);
      } else if (s.id === 'writing') {
        this.buildWritingGrowth(
          tip,
          mobile,
          growthGroup,
          growthMats,
          canopyMats,
          childItems,
        );
      } else if (s.id === 'updates') {
        this.buildUpdatesGrowth(
          tip,
          mobile,
          growthGroup,
          growthMats,
          canopyMats,
          childItems,
        );
      } else if (s.id === 'work') {
        this.buildWorkGrowth(
          tip,
          mobile,
          growthGroup,
          growthMats,
          canopyMats,
          childItems,
        );
      }

      rootGroup.add(growthGroup);
      this.treeGroup.add(rootGroup);

      this.branches.set(s.id, {
        id: s.id,
        rootGroup,
        twigMesh,
        twigMat,
        growthGroup,
        growthMats,
        canopyMats,
        labelMesh: lbl.mainMesh,
        labelMat: lbl.mainMat,
        labelDotMesh: lbl.dotMesh,
        labelDotMat: lbl.dotMat,
        underlineMesh: lbl.ulMesh,
        underlineMat: lbl.ulMat,
        labelWorldCenter: labelCenter,
        labelSize: lbl.size,
        openProgress: 0,
        hoverProgress: 0,
        openedAtMs: 0,
        cameraTarget: s.cameraTarget,
        childItems,
      });
    }
  }

  private buildMeGrowth(
    tip: Point2D,
    _trunkX: number,
    _groundY: number,
    mobile: boolean,
    group: THREE.Group,
    growthMats: THREE.ShaderMaterial[],
    canopyMats: THREE.ShaderMaterial[],
  ) {
    // Extension branch curves neatly under/past the "me." label to a fuller foliage cloud (~70-100px)
    const extTip: Point2D = mobile
      ? { x: tip.x + 36, y: tip.y - 6 }
      : { x: tip.x + 48, y: tip.y - 10 };
    const extPts = [
      tip,
      { x: tip.x + (extTip.x - tip.x) * 0.48, y: tip.y - 12 },
      extTip,
    ];
    const branchGeo = this.track(buildTwigWithThorns(extPts, 3.1, 1.7, 2, 411));
    const branchMat = this.makeStrokeMat({ progress: 0 });
    growthMats.push(branchMat);
    const branchMesh = new THREE.Mesh(branchGeo, branchMat);
    branchMesh.position.z = 3.2;
    group.add(branchMesh);

    const canopyBlobs = generateCanopyCluster(
      extTip.x + (mobile ? 8 : 6),
      extTip.y + (mobile ? 4 : 6),
      mobile ? 34 : 44,
      mobile ? 26 : 34,
      6,
      455,
    );
    const canopyGeo = this.track(buildCanopyGeometry(canopyBlobs));
    const canopyMat = this.makeCanopyMat({ progress: 0, swayAmp: 0.7, density: 0.72 });
    canopyMats.push(canopyMat);
    const canopyMesh = new THREE.Mesh(canopyGeo, canopyMat);
    canopyMesh.position.z = 3.5;
    group.add(canopyMesh);

    // Desktop me camera is { x: 364, y: -70, zoom: 1.02 }:
    // screenX 33% -> worldLeft = +124; screenY 27% -> worldTop = +133
    // Keep all 6 paragraphs cleanly inside y ≈ 27%..60% clear of grass & trunk
    const bioMaxWidth = mobile ? 182 : 288;
    const bioX = mobile ? extTip.x + 114 : 124 + bioMaxWidth * 0.5;
    let cursorTopY = mobile ? extTip.y + 205 : 133;
    const bioFontSize = mobile ? 11.2 : 11.4;

    BIO_PARAGRAPHS.forEach((p, idx) => {
      const rendered = createBioParagraphTexture(p, {
        maxWidth: bioMaxWidth,
        fontSize: bioFontSize,
        lineHeightRatio: mobile ? 1.36 : 1.38,
      });
      this.track(rendered.texture);
      const geo = this.track(new THREE.PlaneGeometry(rendered.width, rendered.height));
      const mat = this.makeTextMat(rendered.texture, 0, 1);
      const mesh = new THREE.Mesh(geo, mat);
      const cy = cursorTopY - rendered.height * 0.5;
      mesh.position.set(bioX, cy, 5.5);
      group.add(mesh);

      this.bioItems.push({
        mesh,
        mat,
        worldCenter: { x: bioX, y: cy },
        size: { w: rendered.width, h: rendered.height },
        links: rendered.links,
        delaySec: 0.24 + idx * 0.14,
      });
      cursorTopY -= rendered.height + (mobile ? 5.5 : 7);
    });

    // Dispersed 2x2 overlapping halftone photo collage (~220x230px overall)
    // Desktop screenX 58% -> worldLeft = +477; screenY 27% -> worldTop = +133
    const deskScale = 0.88;
    const mobScale = 0.56;
    const photoScale = mobile ? mobScale : deskScale;
    const firstDispW = ME_PHOTOS[0].displayWidth * photoScale;
    const photoBaseX = mobile ? bioX - 38 : 477 + firstDispW * 0.5;
    const photoBaseY = mobile ? cursorTopY - 40 : 133 - firstDispW * 0.5;

    ME_PHOTOS.forEach((photo, idx) => {
      const aspect = photo.height / photo.width;
      const dispW = photo.displayWidth * photoScale;
      const dispH = dispW * aspect;
      const px = photoBaseX + photo.offsetX * photoScale;
      const py = photoBaseY - photo.offsetY * photoScale;

      const cardGroup = new THREE.Group();
      cardGroup.position.set(px, py, 7 + idx * 0.25);
      cardGroup.rotation.z = (-photo.rotationDeg * Math.PI) / 180;

      const photoTex = this.track(createAbstractPhotoTexture(photo));
      const photoGeo = this.track(new THREE.PlaneGeometry(dispW, dispH));
      const photoMat = this.track(
        new THREE.ShaderMaterial({
          vertexShader: HALFTONE_PHOTO_VERT,
          fragmentShader: HALFTONE_PHOTO_FRAG,
          transparent: true,
          depthWrite: false,
          uniforms: {
            uTex: { value: photoTex },
            uPhotoSize: { value: new THREE.Vector2(dispW, dispH) },
            uProgress: { value: 0 },
            uHovered: { value: 0 },
            uInkColor: { value: INK_COLOR },
          },
        }),
      );
      this.sharedMaterials.push(photoMat);
      cardGroup.add(new THREE.Mesh(photoGeo, photoMat));

      const tapeMats: THREE.ShaderMaterial[] = [];
      for (const tape of photo.tapes) {
        const tGeo = this.track(
          new THREE.PlaneGeometry(
            tape.length * photoScale,
            tape.width * photoScale,
          ),
        );
        const tMat = this.track(
          new THREE.ShaderMaterial({
            vertexShader: HALFTONE_PHOTO_VERT,
            fragmentShader: TAPE_FRAG,
            transparent: true,
            depthWrite: false,
            uniforms: {
              uProgress: { value: 0 },
              uInkColor: { value: INK_COLOR },
            },
          }),
        );
        this.sharedMaterials.push(tMat);
        const tMesh = new THREE.Mesh(tGeo, tMat);
        tMesh.position.set(tape.x * dispW, -tape.y * dispH, 0.12);
        tMesh.rotation.z = (-tape.angleDeg * Math.PI) / 180;
        cardGroup.add(tMesh);
        tapeMats.push(tMat);
      }

      // Hover note caption below card
      const capTex = createTextTexture(photo.caption, {
        fontSize: 11.5,
        fontWeight: 500,
        italic: true,
      });
      this.track(capTex.texture);
      const capGeo = this.track(new THREE.PlaneGeometry(capTex.width, capTex.height));
      const capMat = this.makeTextMat(capTex.texture, 0, 1);
      const capMesh = new THREE.Mesh(capGeo, capMat);
      capMesh.position.set(px, py - dispH * 0.5 - 15, 9);
      group.add(capMesh);

      group.add(cardGroup);
      this.photoItems.push({
        group: cardGroup,
        photoMat,
        tapeMats,
        captionMesh: capMesh,
        captionMat: capMat,
        worldCenter: { x: px, y: py },
        w: dispW,
        h: dispH,
        caption: photo.caption,
        id: photo.id,
        delaySec: 0.38 + idx * 0.22,
        baseY: py,
        hoverProgress: 0,
      });
    });
  }

  private buildWritingGrowth(
    tip: Point2D,
    mobile: boolean,
    group: THREE.Group,
    growthMats: THREE.ShaderMaterial[],
    canopyMats: THREE.ShaderMaterial[],
    childItems: BranchRuntime['childItems'],
  ) {
    const post = WRITING_POSTS[0];
    const target: Point2D = mobile
      ? { x: tip.x - 42, y: tip.y + 72 }
      : { x: tip.x - 135, y: tip.y + 92 };

    const pts = [
      tip,
      { x: tip.x - (tip.x - target.x) * 0.45, y: tip.y + (target.y - tip.y) * 0.62 },
      target,
    ];
    const geo = this.track(buildTwigWithThorns(pts, 3.0, 1.8, 2, 311));
    const mat = this.makeStrokeMat({ progress: 0 });
    growthMats.push(mat);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.z = 3.2;
    group.add(mesh);

    const canopyBlobs = generateCanopyCluster(
      target.x - 12,
      target.y + 14,
      mobile ? 42 : 54,
      mobile ? 32 : 42,
      7,
      322,
    );
    const cGeo = this.track(buildCanopyGeometry(canopyBlobs));
    const cMat = this.makeCanopyMat({ progress: 0, swayAmp: 0.7, density: 0.72 });
    canopyMats.push(cMat);
    const cMesh = new THREE.Mesh(cGeo, cMat);
    cMesh.position.z = 3.5;
    group.add(cMesh);

    // Place label cleanly on dark paper just left of the small canopy
    const lblTex = createTextTexture(post.label, { fontSize: 14.5, fontWeight: 600 });
    this.track(lblTex.texture);
    const lblCenter: Point2D = {
      x: target.x - (mobile ? 44 : 70) - lblTex.width * 0.5,
      y: target.y + 20,
    };
    const lblGeo = this.track(new THREE.PlaneGeometry(lblTex.width, lblTex.height));
    const lblMat = this.makeTextMat(lblTex.texture, 0, 1);
    const lblMesh = new THREE.Mesh(lblGeo, lblMat);
    lblMesh.position.set(lblCenter.x, lblCenter.y, 6);
    group.add(lblMesh);

    const dateTex = createTextTexture(post.dateLabel, {
      fontSize: 12,
      fontWeight: 500,
      color: '#a8a7b3',
    });
    this.track(dateTex.texture);
    const dateGeo = this.track(new THREE.PlaneGeometry(dateTex.width, dateTex.height));
    const dateMat = this.makeTextMat(dateTex.texture, 0, 1);
    const dateMesh = new THREE.Mesh(dateGeo, dateMat);
    dateMesh.position.set(lblCenter.x + lblTex.width * 0.5 - dateTex.width * 0.5, lblCenter.y - 18, 6);
    group.add(dateMesh);

    const ulGeo = this.track(
      buildWobblyUnderline(
        lblCenter.x - lblTex.width * 0.42,
        lblCenter.x + lblTex.width * 0.42,
        lblCenter.y - 9,
        355,
      ),
    );
    const ulMat = this.makeStrokeMat({ progress: 0 });
    const ulMesh = new THREE.Mesh(ulGeo, ulMat);
    ulMesh.position.z = 6.2;
    group.add(ulMesh);

    childItems.push({
      id: post.id,
      label: `${post.label} (${post.dateLabel})`,
      kind: 'route',
      href: post.route,
      worldCenter: lblCenter,
      size: { w: Math.max(lblTex.width, 90), h: 46 },
      underlineMat: ulMat,
      hoverProgress: 0,
      appearDelaySec: 0.36,
      textMat: lblMat,
      subTextMat: dateMat,
    });
  }

  private buildUpdatesGrowth(
    tip: Point2D,
    mobile: boolean,
    group: THREE.Group,
    growthMats: THREE.ShaderMaterial[],
    canopyMats: THREE.ShaderMaterial[],
    childItems: BranchRuntime['childItems'],
  ) {
    // Sweeping curved arch branch rising up-right with 7 tapering clouds (jun 13 close to main canopy -> apr 20 at tip)
    const spanX = mobile ? 168 : 510;
    const spanY = mobile ? 230 : 300;
    const spinePts: Point2D[] = [
      tip,
      { x: tip.x + spanX * 0.14, y: tip.y + spanY * 0.36 },
      { x: tip.x + spanX * 0.40, y: tip.y + spanY * 0.66 },
      { x: tip.x + spanX * 0.72, y: tip.y + spanY * 0.85 },
      { x: tip.x + spanX, y: tip.y + spanY },
    ];
    const spineSampled = sampleOrganicPath(spinePts, 14, 4.0, 501);
    const spineGeo = this.track(buildStrokeGeometry(spineSampled, 4.5, 1.4, 501));
    const spineMat = this.makeStrokeMat({ progress: 0 });
    growthMats.push(spineMat);
    const spineMesh = new THREE.Mesh(spineGeo, spineMat);
    spineMesh.position.z = 3.2;
    group.add(spineMesh);

    // Small forked twig at the far tip past apr 20
    const endPt = spineSampled[spineSampled.length - 1];
    const fork1 = this.track(
      buildTwigWithThorns(
        [
          endPt,
          { x: endPt.x + (mobile ? 16 : 30), y: endPt.y + (mobile ? 14 : 22) },
        ],
        1.5,
        0.7,
        1,
        515,
      ),
    );
    const fork2 = this.track(
      buildTwigWithThorns(
        [
          endPt,
          { x: endPt.x + (mobile ? 20 : 38), y: endPt.y + (mobile ? 2 : 4) },
        ],
        1.5,
        0.7,
        1,
        516,
      ),
    );
    const forkMat = this.makeStrokeMat({ progress: 0 });
    growthMats.push(forkMat);
    const f1 = new THREE.Mesh(fork1, forkMat);
    const f2 = new THREE.Mesh(fork2, forkMat);
    f1.position.z = 3.25;
    f2.position.z = 3.25;
    group.add(f1, f2);

    UPDATE_ENTRIES.forEach((entry, idx) => {
      const frac = idx / (UPDATE_ENTRIES.length - 1); // 0 = jun 13 (closest/largest) .. 1 = apr 20 (tip/smallest)
      const t = 0.05 + frac * 0.82;
      const sIdx = Math.min(
        spineSampled.length - 1,
        Math.floor(t * (spineSampled.length - 1)),
      );
      const anchor = spineSampled[sIdx];
      // Strong continuous taper from large first cloud near main canopy to small tip cloud
      const scaleT = 1 - frac * 0.62;
      const rx = (mobile ? 32 : 52) * scaleT;
      const ry = (mobile ? 24 : 38) * scaleT;
      const cloudCenter: Point2D = {
        x: anchor.x + (idx % 2 === 0 ? -5 : 6),
        y: anchor.y + ry * 0.22,
      };

      const blobs = generateCanopyCluster(
        cloudCenter.x,
        cloudCenter.y,
        rx,
        ry,
        6,
        560 + idx * 17,
      );
      const cGeo = this.track(buildCanopyGeometry(blobs));
      const cMat = this.makeCanopyMat({ progress: 0, swayAmp: 0.45, density: 0.72 });
      canopyMats.push(cMat);
      const cMesh = new THREE.Mesh(cGeo, cMat);
      cMesh.position.z = 3.5;
      group.add(cMesh);

      // Date label placed cleanly outside the cloud alternating top-left / bottom-right
      const side = idx % 2 === 0 ? -1 : 1;
      const lblTex = createTextTexture(entry.label, { fontSize: mobile ? 12.5 : 13.5, fontWeight: 600 });
      this.track(lblTex.texture);
      const lblCenter: Point2D = {
        x: cloudCenter.x + side * (rx + lblTex.width * 0.5 + 8),
        y: cloudCenter.y + (side < 0 ? 10 : -10),
      };
      const lblGeo = this.track(new THREE.PlaneGeometry(lblTex.width, lblTex.height));
      const lblMat = this.makeTextMat(lblTex.texture, 0, 1);
      const lblMesh = new THREE.Mesh(lblGeo, lblMat);
      lblMesh.position.set(lblCenter.x, lblCenter.y, 6);
      group.add(lblMesh);

      const ulGeo = this.track(
        buildWobblyUnderline(
          lblCenter.x - lblTex.width * 0.42,
          lblCenter.x + lblTex.width * 0.42,
          lblCenter.y - 8,
          590 + idx,
        ),
      );
      const ulMat = this.makeStrokeMat({ progress: 0 });
      const ulMesh = new THREE.Mesh(ulGeo, ulMat);
      ulMesh.position.z = 6.2;
      group.add(ulMesh);

      childItems.push({
        id: entry.id,
        label: `update ${entry.label}`,
        kind: 'route',
        href: entry.route,
        worldCenter: lblCenter,
        size: { w: Math.max(lblTex.width + 14, 58), h: 34 },
        underlineMat: ulMat,
        hoverProgress: 0,
        appearDelaySec: 0.25 + idx * 0.1,
        textMat: lblMat,
      });
    });
  }

  private buildWorkGrowth(
    tip: Point2D,
    mobile: boolean,
    group: THREE.Group,
    growthMats: THREE.ShaderMaterial[],
    canopyMats: THREE.ShaderMaterial[],
    childItems: BranchRuntime['childItems'],
  ) {
    // Sweeping curved branch arching up-left with a string of cloud clusters and child labels above the end
    const spanX = mobile ? -145 : -330;
    const spanY = mobile ? 132 : 196;
    const spinePts: Point2D[] = [
      tip,
      { x: tip.x + spanX * 0.24, y: tip.y + spanY * 0.42 },
      { x: tip.x + spanX * 0.58, y: tip.y + spanY * 0.74 },
      { x: tip.x + spanX, y: tip.y + spanY },
    ];
    const spineSampled = sampleOrganicPath(spinePts, 14, 3.6, 610);
    const spineGeo = this.track(buildStrokeGeometry(spineSampled, 4.2, 1.5, 610));
    const spineMat = this.makeStrokeMat({ progress: 0 });
    growthMats.push(spineMat);
    const spineMesh = new THREE.Mesh(spineGeo, spineMat);
    spineMesh.position.z = 3.2;
    group.add(spineMesh);

    const endPt = spineSampled[spineSampled.length - 1];

    // String of 4-5 cloud clusters along the up-left branch
    const cloudCount = mobile ? 4 : 5;
    for (let c = 0; c < cloudCount; c++) {
      const frac = c / (cloudCount - 1);
      const t = 0.20 + frac * 0.72;
      const sIdx = Math.min(spineSampled.length - 1, Math.floor(t * (spineSampled.length - 1)));
      const anchor = spineSampled[sIdx];
      const scaleT = 1 - frac * 0.45;
      const rx = (mobile ? 30 : 46) * scaleT;
      const ry = (mobile ? 22 : 34) * scaleT;
      const blobs = generateCanopyCluster(
        anchor.x + (c % 2 === 0 ? -4 : 6),
        anchor.y + ry * 0.18,
        rx,
        ry,
        6,
        650 + c * 19,
      );
      const cGeo = this.track(buildCanopyGeometry(blobs));
      const cMat = this.makeCanopyMat({ progress: 0, swayAmp: 0.55, density: 0.72 });
      canopyMats.push(cMat);
      const cMesh = new THREE.Mesh(cGeo, cMat);
      cMesh.position.z = 3.5;
      group.add(cMesh);
    }

    // Small twig tips rising slightly above the end cloud toward the child labels
    const twigTips: Point2D[] = mobile
      ? [
          { x: endPt.x - 10, y: endPt.y + 34 },
          { x: endPt.x + 12, y: endPt.y + 18 },
        ]
      : [
          { x: endPt.x - 24, y: endPt.y + 42 },
          { x: endPt.x + 16, y: endPt.y + 22 },
        ];
    twigTips.forEach((tt, idx) => {
      const subGeo = this.track(buildTwigWithThorns([endPt, tt], 1.7, 0.8, 1, 670 + idx));
      const subMat = this.makeStrokeMat({ progress: 0 });
      growthMats.push(subMat);
      const subMesh = new THREE.Mesh(subGeo, subMat);
      subMesh.position.z = 3.25;
      group.add(subMesh);
    });

    // Place child labels cleanly above the branch end
    WORK_LINKS.forEach((item, idx) => {
      const lblTex = createTextTexture(item.label, { fontSize: mobile ? 13.5 : 14, fontWeight: 600 });
      this.track(lblTex.texture);
      const lblCenter: Point2D = mobile
        ? {
            x: Math.max(-180 + lblTex.width * 0.5, endPt.x - 6 + idx * 14),
            y: endPt.y + (idx === 0 ? 78 : 48),
          }
        : {
            x: endPt.x - 20 + idx * 28,
            y: endPt.y + (idx === 0 ? 84 : 52),
          };
      const lblGeo = this.track(new THREE.PlaneGeometry(lblTex.width, lblTex.height));
      const lblMat = this.makeTextMat(lblTex.texture, 0, 1);
      const lblMesh = new THREE.Mesh(lblGeo, lblMat);
      lblMesh.position.set(lblCenter.x, lblCenter.y, 6);
      group.add(lblMesh);

      const ulGeo = this.track(
        buildWobblyUnderline(
          lblCenter.x - lblTex.width * 0.44,
          lblCenter.x + lblTex.width * 0.44,
          lblCenter.y - 8.5,
          680 + idx,
        ),
      );
      const ulMat = this.makeStrokeMat({ progress: 0 });
      const ulMesh = new THREE.Mesh(ulGeo, ulMat);
      ulMesh.position.z = 6.2;
      group.add(ulMesh);

      childItems.push({
        id: item.id,
        label: item.label,
        kind: 'external',
        href: item.href,
        worldCenter: lblCenter,
        size: { w: Math.max(lblTex.width + 12, 80), h: 32 },
        underlineMat: ulMat,
        hoverProgress: 0,
        appearDelaySec: 0.32 + idx * 0.14,
        textMat: lblMat,
      });
    });
  }

  public selectBranch(branchId: BranchId | null) {
    this.activeBranch = branchId;
    this.branchOpenElapsed = 0;
    if (branchId) {
      const b = this.branches.get(branchId);
      if (b) {
        b.openedAtMs = performance.now();
        this.camTarget.set(b.cameraTarget.x, b.cameraTarget.y);
        this.camTargetZoom = b.cameraTarget.zoom;
      }
    } else {
      this.camTarget.set(0, 0);
      this.camTargetZoom = 1;
    }
    this.callbacks.onSelectBranch(branchId);
  }

  public panBy(dxWorld: number, dyWorld: number) {
    this.camTarget.x += dxWorld;
    this.camTarget.y += dyWorld;
    this.clampCameraTarget();
  }

  private clampCameraTarget() {
    const maxPanX = this.worldW * 0.55;
    const maxPanY = this.worldH * 0.52;
    this.camTarget.x = Math.max(-maxPanX, Math.min(maxPanX, this.camTarget.x));
    this.camTarget.y = Math.max(-maxPanY, Math.min(maxPanY, this.camTarget.y));
  }

  private screenToWorld(clientX: number, clientY: number): Point2D {
    const rect = this.renderer.domElement.getBoundingClientRect();
    const nx = (clientX - rect.left) / Math.max(1, rect.width);
    const ny = (clientY - rect.top) / Math.max(1, rect.height);
    const ndcX = nx * 2 - 1;
    const ndcY = -(ny * 2 - 1);
    return {
      x: this.camera.position.x + (ndcX * this.worldW * 0.5) / this.camera.zoom,
      y: this.camera.position.y + (ndcY * this.worldH * 0.5) / this.camera.zoom,
    };
  }

  private worldToScreen(wx: number, wy: number): { x: number; y: number; scale: number } {
    const scale = (this.width / this.worldW) * this.camera.zoom;
    const ndcX = ((wx - this.camera.position.x) * this.camera.zoom) / (this.worldW * 0.5);
    const ndcY = ((wy - this.camera.position.y) * this.camera.zoom) / (this.worldH * 0.5);
    return {
      x: (ndcX * 0.5 + 0.5) * this.width,
      y: (-ndcY * 0.5 + 0.5) * this.height,
      scale,
    };
  }

  private findHitAtWorld(wx: number, wy: number): {
    id: string;
    kind: 'branch' | 'route' | 'external' | 'photo';
    branchId?: BranchId;
    href?: string;
    caption?: string;
  } | null {
    // 1. Check top-level branch labels
    for (const b of this.branches.values()) {
      const labelVisible = this.activeBranch === null || this.activeBranch === b.id;
      const pad = 12;
      if (
        labelVisible &&
        Math.abs(wx - b.labelWorldCenter.x) <= b.labelSize.w * 0.5 + pad &&
        Math.abs(wy - b.labelWorldCenter.y) <= b.labelSize.h * 0.5 + pad
      ) {
        return { id: `branch-${b.id}`, kind: 'branch', branchId: b.id };
      }

      // 2. Check active branch children
      if (this.activeBranch === b.id && b.openProgress > 0.35) {
        for (const ch of b.childItems) {
          if (
            Math.abs(wx - ch.worldCenter.x) <= ch.size.w * 0.5 + 10 &&
            Math.abs(wy - ch.worldCenter.y) <= ch.size.h * 0.5 + 8
          ) {
            return { id: ch.id, kind: ch.kind, href: ch.href };
          }
        }
      }
    }

    // 3. Check bio paragraph links and photos when "me" is active
    if (this.activeBranch === 'me') {
      for (const item of this.bioItems) {
        for (const link of item.links) {
          const lx = item.worldCenter.x + link.x;
          const ly = item.worldCenter.y + link.y;
          if (
            Math.abs(wx - lx) <= link.w * 0.5 + 6 &&
            Math.abs(wy - ly) <= link.h * 0.5 + 4
          ) {
            return {
              id: `bio-link-${link.label}`,
              kind: link.href.startsWith('/') ? 'route' : 'external',
              href: link.href,
            };
          }
        }
      }

      for (let i = this.photoItems.length - 1; i >= 0; i--) {
        const ph = this.photoItems[i];
        if (
          Math.abs(wx - ph.worldCenter.x) <= ph.w * 0.5 &&
          Math.abs(wy - ph.worldCenter.y) <= ph.h * 0.5
        ) {
          return { id: ph.id, kind: 'photo', caption: ph.caption };
        }
      }
    }

    return null;
  }

  private bindEvents() {
    const el = this.renderer.domElement;

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      this.isDragging = true;
      this.dragMovedDist = 0;
      this.dragStart.set(e.clientX, e.clientY);
      this.dragLast.set(e.clientX, e.clientY);
      this.camVel.set(0, 0);
      el.setPointerCapture?.(e.pointerId);
    };

    const onPointerMove = (e: PointerEvent) => {
      const world = this.screenToWorld(e.clientX, e.clientY);
      this.pointerWorld.set(world.x, world.y);

      if (this.isDragging) {
        const dxPx = e.clientX - this.dragLast.x;
        const dyPx = e.clientY - this.dragLast.y;
        this.dragMovedDist += Math.hypot(dxPx, dyPx);
        this.dragLast.set(e.clientX, e.clientY);

        const worldScale = this.worldW / Math.max(1, this.width) / this.camera.zoom;
        const dxW = -dxPx * worldScale;
        const dyW = dyPx * worldScale;
        this.camTarget.x += dxW;
        this.camTarget.y += dyW;
        this.camPos.x += dxW * 0.85;
        this.camPos.y += dyW * 0.85;
        this.camVel.set(dxW * 16, dyW * 16);
        this.clampCameraTarget();
      }

      const hit = this.findHitAtWorld(world.x, world.y);
      const nextHover = hit?.id ?? null;
      if (nextHover !== this.hoveredId) {
        this.hoveredId = nextHover;
        el.style.cursor = hit ? 'pointer' : this.isDragging ? 'grabbing' : 'grab';
        this.callbacks.onHoverChange(nextHover, hit?.caption ?? null);
      } else if (!hit) {
        el.style.cursor = this.isDragging ? 'grabbing' : 'default';
      }
    };

    const onPointerUp = (e: PointerEvent) => {
      if (!this.isDragging) return;
      this.isDragging = false;
      el.releasePointerCapture?.(e.pointerId);

      // Treat as a click if pointer moved < 7px
      if (this.dragMovedDist < 7) {
        const world = this.screenToWorld(e.clientX, e.clientY);
        const hit = this.findHitAtWorld(world.x, world.y);
        if (hit) {
          this.activateHit(hit);
        }
      }
    };

    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const worldScale = this.worldW / Math.max(1, this.width) / this.camera.zoom;
      this.camTarget.x += e.deltaX * 0.65 * worldScale;
      this.camTarget.y -= e.deltaY * 0.65 * worldScale;
      this.clampCameraTarget();
    };

    const onDeviceOrientation = (e: DeviceOrientationEvent) => {
      if (this.reducedMotion) return;
      const gamma = Math.max(-25, Math.min(25, e.gamma ?? 0));
      const beta = Math.max(-25, Math.min(25, (e.beta ?? 45) - 45));
      this.tiltOffset.set(gamma * 0.55, -beta * 0.45);
    };

    el.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    el.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('deviceorientation', onDeviceOrientation);

    this.unbindEvents = () => {
      el.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      el.removeEventListener('wheel', onWheel);
      window.removeEventListener('deviceorientation', onDeviceOrientation);
    };
  }

  private unbindEvents = () => {};

  private activateHit(hit: NonNullable<ReturnType<InkTreeScene['findHitAtWorld']>>) {
    if (hit.kind === 'branch' && hit.branchId) {
      if (this.activeBranch === hit.branchId) {
        this.selectBranch(null);
      } else {
        this.selectBranch(hit.branchId);
      }
    } else if (hit.kind === 'route' && hit.href) {
      this.callbacks.onNavigateRoute(hit.href);
    } else if (hit.kind === 'external' && hit.href) {
      window.open(hit.href, '_blank', 'noopener,noreferrer');
    }
  }

  private handleResize() {
    if (this.destroyed) return;
    this.width = Math.max(320, this.container.clientWidth || window.innerWidth);
    this.height = Math.max(320, this.container.clientHeight || window.innerHeight);
    this.pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    this.renderer.setPixelRatio(this.pixelRatio);
    this.renderer.setSize(this.width, this.height);
    this.paperBgMat.uniforms.uResolution.value.set(
      this.width * this.pixelRatio,
      this.height * this.pixelRatio,
    );
    this.tornFrameMat.uniforms.uResolution.value.set(
      this.width * this.pixelRatio,
      this.height * this.pixelRatio,
    );
    this.tornFrameMat.uniforms.uPixelRatio.value = this.pixelRatio;
    this.rebuildWorld();
  }

  public setExternalHover(id: string | null) {
    if (this.hoveredId !== id) {
      this.hoveredId = id;
      this.callbacks.onHoverChange(id, null);
    }
  }

  private emitHitTargets() {
    const targets: HitTargetScreen[] = [];
    for (const b of this.branches.values()) {
      const baseText = b.id === 'work' ? 'work with me' : b.id;
      const isOpen = this.activeBranch === b.id;
      const labelVisible = this.activeBranch === null || isOpen;

      if (labelVisible) {
        const s = this.worldToScreen(b.labelWorldCenter.x, b.labelWorldCenter.y);
        targets.push({
          id: `branch-${b.id}`,
          label: isOpen ? `${baseText} (expanded)` : baseText,
          text: isOpen ? `${baseText}.` : baseText,
          x: Math.round(s.x),
          y: Math.round(s.y),
          w: Math.round(Math.max(44, b.labelSize.w * s.scale + 12)),
          h: Math.round(Math.max(28, b.labelSize.h * s.scale + 8)),
          kind: 'branch',
          branchId: b.id,
        });
      }

      if (isOpen && b.openProgress > 0.35) {
        for (const ch of b.childItems) {
          const cs = this.worldToScreen(ch.worldCenter.x, ch.worldCenter.y);
          targets.push({
            id: ch.id,
            label: ch.label,
            text: ch.label,
            x: Math.round(cs.x),
            y: Math.round(cs.y),
            w: Math.round(Math.max(44, ch.size.w * cs.scale)),
            h: Math.round(Math.max(28, ch.size.h * cs.scale)),
            kind: ch.kind,
            href: ch.href,
          });
        }
      }
    }

    if (this.activeBranch === 'me') {
      for (const item of this.bioItems) {
        for (const link of item.links) {
          const ls = this.worldToScreen(item.worldCenter.x + link.x, item.worldCenter.y + link.y);
          targets.push({
            id: `bio-link-${link.label}`,
            label: link.label,
            text: link.label,
            x: Math.round(ls.x),
            y: Math.round(ls.y),
            w: Math.round(Math.max(24, link.w * ls.scale + 8)),
            h: Math.round(Math.max(22, link.h * ls.scale + 4)),
            kind: link.href.startsWith('/') ? 'route' : 'external',
            href: link.href,
          });
        }
      }
    }

    const sig = targets.map((t) => `${t.id}:${t.text}:${t.x}:${t.y}:${t.w}`).join('|');
    if (sig !== this.lastHitSig) {
      this.lastHitSig = sig;
      this.callbacks.onHitTargetsUpdate(targets);
    }
  }

  private animate = () => {
    if (this.destroyed) return;
    this.rafId = requestAnimationFrame(this.animate);

    const now = performance.now();
    const dt = Math.min(0.05, (now - this.lastTime) / 1000);
    this.lastTime = now;
    this.elapsed += dt;

    if (this.activeBranch) {
      this.branchOpenElapsed += dt;
    }

    // Apply inertia when released
    if (!this.isDragging && this.camVel.lengthSq() > 0.01) {
      this.camTarget.x += this.camVel.x * dt;
      this.camTarget.y += this.camVel.y * dt;
      this.camVel.multiplyScalar(Math.pow(0.02, dt));
      this.clampCameraTarget();
    }

    // Ease camera (~360ms snappy ease-out), snap when settled so DOM rects stay static
    const camLerp = this.reducedMotion ? 1 : 1 - Math.exp(-8.5 * dt);
    this.camPos.lerp(this.camTarget, camLerp);
    if (this.camPos.distanceToSquared(this.camTarget) < 0.04) {
      this.camPos.copy(this.camTarget);
    }
    this.camZoom += (this.camTargetZoom - this.camZoom) * camLerp;
    if (Math.abs(this.camTargetZoom - this.camZoom) < 0.0004) {
      this.camZoom = this.camTargetZoom;
    }

    this.camera.position.x = this.camPos.x + this.tiltOffset.x;
    this.camera.position.y = this.camPos.y + this.tiltOffset.y;
    this.camera.zoom = this.camZoom;
    this.camera.updateProjectionMatrix();

    // Update paper & dust parallax
    this.panOffset.set(this.camera.position.x * 1.15, this.camera.position.y * 1.15);
    this.paperBgMat.uniforms.uPanOffset.value.copy(this.panOffset);
    this.dustMat.uniforms.uTime.value = this.elapsed;
    this.dustMat.uniforms.uParallax.value.set(
      -this.camera.position.x * 0.14,
      -this.camera.position.y * 0.14,
    );

    // Update time on shared ink shaders
    for (const mat of this.sharedMaterials) {
      if (mat.uniforms.uTime) mat.uniforms.uTime.value = this.elapsed;
    }

    // Roots, shrubs & extra grass appear smoothly when a branch is open
    const zoomRevealTarget = this.activeBranch ? 1 : 0;
    const rootStep = this.reducedMotion ? 1 : dt * 2.4;
    const curRoot = this.rootsMat.uniforms.uProgress.value as number;
    const nextRoot =
      curRoot + Math.sign(zoomRevealTarget - curRoot) * Math.min(Math.abs(zoomRevealTarget - curRoot), rootStep);
    this.rootsMat.uniforms.uProgress.value = nextRoot;
    this.extraGrassMat.uniforms.uProgress.value = nextRoot;
    this.shrubsMat.uniforms.uProgress.value = nextRoot;

    // Update each branch animations
    for (const b of this.branches.values()) {
      const isOpen = this.activeBranch === b.id;
      const isSiblingHidden = this.activeBranch !== null && !isOpen;
      const targetOpen = isOpen ? 1 : 0;
      const openRate = this.reducedMotion ? 1 : isOpen ? dt * 2.1 : dt * 3.8;
      b.openProgress += Math.sign(targetOpen - b.openProgress) * Math.min(Math.abs(targetOpen - b.openProgress), openRate);

      // Selected label shows trailing dot & underline; inactive sibling labels fade out completely
      const isHovered = !isSiblingHidden && this.hoveredId === `branch-${b.id}`;
      const targetHover = isHovered || isOpen ? 1 : 0;
      const hoverRate = this.reducedMotion ? 1 : dt * 7.5;
      b.hoverProgress +=
        Math.sign(targetHover - b.hoverProgress) *
        Math.min(Math.abs(targetHover - b.hoverProgress), hoverRate);

      const fadeRate = this.reducedMotion ? 1 : dt * 5.2;
      const targetMainOp = isOpen || isSiblingHidden ? 0 : 1;
      const targetDotOp = isOpen ? 1 : 0;
      const curMainOp = b.labelMat.uniforms.uOpacity.value as number;
      const curDotOp = b.labelDotMat.uniforms.uOpacity.value as number;
      b.labelMat.uniforms.uOpacity.value =
        curMainOp + Math.sign(targetMainOp - curMainOp) * Math.min(Math.abs(targetMainOp - curMainOp), fadeRate);
      b.labelDotMat.uniforms.uOpacity.value =
        curDotOp + Math.sign(targetDotOp - curDotOp) * Math.min(Math.abs(targetDotOp - curDotOp), fadeRate);
      b.underlineMat.uniforms.uProgress.value = isSiblingHidden ? 0 : b.hoverProgress;
      b.twigMat.uniforms.uSwayAmp.value = isHovered ? 1.55 : 0.4;
      const targetTwig = isSiblingHidden ? 0 : 1;
      const twigRate = this.reducedMotion ? 1 : dt * 4.8;
      const curTwigOp = b.twigMat.uniforms.uOpacity.value as number;
      const curTwigProg = b.twigMat.uniforms.uProgress.value as number;
      b.twigMat.uniforms.uOpacity.value =
        curTwigOp + Math.sign(targetTwig - curTwigOp) * Math.min(Math.abs(targetTwig - curTwigOp), twigRate);
      b.twigMat.uniforms.uProgress.value =
        curTwigProg + Math.sign(targetTwig - curTwigProg) * Math.min(Math.abs(targetTwig - curTwigProg), twigRate);

      // Branch extension strokes draw first (0..0.55), then canopies puff in (0.35..1.0)
      const strokeProg = Math.min(1, b.openProgress / 0.55);
      const canopyProg = Math.max(0, Math.min(1, (b.openProgress - 0.32) / 0.55));
      for (const m of b.growthMats) {
        m.uniforms.uProgress.value = strokeProg;
      }
      for (const m of b.canopyMats) {
        m.uniforms.uProgress.value = canopyProg;
      }

      // Child labels fade/ink in staggered
      for (const ch of b.childItems) {
        const childReveal = isOpen
          ? this.reducedMotion
            ? 1
            : Math.max(0, Math.min(1, (this.branchOpenElapsed - ch.appearDelaySec) / 0.45))
          : 0;
        ch.textMat.uniforms.uProgress.value = childReveal;
        if (ch.subTextMat) ch.subTextMat.uniforms.uProgress.value = childReveal;

        const chHoverTarget = this.hoveredId === ch.id ? 1 : 0;
        ch.hoverProgress +=
          Math.sign(chHoverTarget - ch.hoverProgress) *
          Math.min(Math.abs(chHoverTarget - ch.hoverProgress), hoverRate);
        ch.underlineMat.uniforms.uProgress.value = childReveal > 0.5 ? ch.hoverProgress : 0;
      }
    }

    // Staggered bio paragraphs & taped halftone photos in "me"
    const meOpen = this.activeBranch === 'me';
    for (const item of this.bioItems) {
      const prog = meOpen
        ? this.reducedMotion
          ? 1
          : Math.max(0, Math.min(1, (this.branchOpenElapsed - item.delaySec) / 0.42))
        : 0;
      item.mat.uniforms.uProgress.value = prog;
    }

    for (const ph of this.photoItems) {
      const prog = meOpen
        ? this.reducedMotion
          ? 1
          : Math.max(0, Math.min(1, (this.branchOpenElapsed - ph.delaySec) / 0.45))
        : 0;
      ph.photoMat.uniforms.uProgress.value = prog;
      for (const tm of ph.tapeMats) {
        tm.uniforms.uProgress.value = prog;
      }
      // Subtle drop-in Y settle
      const dropOffset = this.reducedMotion ? 0 : (1 - prog) * 18;
      ph.group.position.y = ph.baseY + dropOffset;

      const isPhHover = meOpen && this.hoveredId === ph.id;
      ph.photoMat.uniforms.uHovered.value = isPhHover ? 1 : 0;
      const capTarget = isPhHover ? 1 : 0;
      const capRate = this.reducedMotion ? 1 : dt * 7;
      ph.hoverProgress +=
        Math.sign(capTarget - ph.hoverProgress) *
        Math.min(Math.abs(capTarget - ph.hoverProgress), capRate);
      ph.captionMat.uniforms.uProgress.value = ph.hoverProgress;
    }

    // Emit updated hit target rects for accessible DOM overlay
    this.emitHitTargets();

    // Render 3 passes: paper sheet -> botanical scene -> torn bevel frame
    this.renderer.clear();
    this.renderer.render(this.bgScene, this.orthoCam);
    this.renderer.clearDepth();
    this.renderer.render(this.scene, this.camera);
    this.renderer.clearDepth();
    this.renderer.render(this.frameScene, this.orthoCam);
  };

  public dispose() {
    this.destroyed = true;
    cancelAnimationFrame(this.rafId);
    this.resizeObserver.disconnect();
    this.unbindEvents();
    for (const d of this.disposables) {
      d.dispose();
    }
    this.disposables = [];
    this.renderer.dispose();
    if (this.renderer.domElement.parentElement === this.container) {
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
