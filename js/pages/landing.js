/**
 * ============================================================================
 * DataForge — Optical Glass Data Monolith Cinematic Engine
 * Minimalist, restrained technical elegance (Linear / Apple Pro Aesthetic)
 * ============================================================================
 */

import { isLoggedIn } from '../services/auth.js';
import { qs, qsa } from '../utils/dom.js';

// ---- Auth Status & Nav ----
if (isLoggedIn()) {
  const ctaBtn = qs('#nav-cta-btn');
  const loginLink = qs('#nav-login-link');
  if (ctaBtn) {
    ctaBtn.textContent = 'Dashboard';
    ctaBtn.href = 'dashboard.html';
  }
  if (loginLink) {
    loginLink.textContent = 'Dashboard';
    loginLink.href = 'dashboard.html';
  }
}

// ---- Nav Scrolled State ----
const nav = qs('#main-nav');
window.addEventListener('scroll', () => {
  if (window.scrollY > 20) {
    nav.classList.add('scrolled');
  } else {
    nav.classList.remove('scrolled');
  }
}, { passive: true });

// ============================================================================
// Tactile Web Audio Engine (Subtle Acoustic Feedback)
// ============================================================================
let audioCtx = null;
let soundEnabled = false;

function initAudio() {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (AudioContextClass) {
      audioCtx = new AudioContextClass();
    }
  }
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume();
  }
}

function playSubtleClick(freq = 780, duration = 0.04) {
  if (!soundEnabled || !audioCtx) return;
  try {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.5, audioCtx.currentTime + duration);

    gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);

    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch (e) {
    // ignore
  }
}

const btnAudio = qs('#btn-audio-toggle');
if (btnAudio) {
  btnAudio.addEventListener('click', () => {
    initAudio();
    soundEnabled = !soundEnabled;
    btnAudio.classList.toggle('active', soundEnabled);
    if (soundEnabled) playSubtleClick(880, 0.06);
  });
}

// ============================================================================
// Optical Data Monolith 3D Cinematic Engine
// ============================================================================
class OpticalMonolithEngine {
  constructor() {
    this.canvas = qs('#forge-canvas');
    if (!this.canvas || !window.THREE) {
      console.warn('Three.js or #forge-canvas not found.');
      return;
    }

    this.initScene();
    this.initStudioEnvironment();
    this.loadOpticalMonolith();
    this.setupEventListeners();

    this.lastTime = performance.now();
    this.scrollProgress = 0;
    this.currentChapter = 0;

    this.animate = this.animate.bind(this);
    requestAnimationFrame(this.animate);
  }

  // --------------------------------------------------------------------------
  // 1. Scene, Camera, Studio Lighting Setup
  // --------------------------------------------------------------------------
  initScene() {
    const THREE = window.THREE;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.FogExp2(0x07080c, 0.028);

    this.camera = new THREE.PerspectiveCamera(42, window.innerWidth / window.innerHeight, 0.1, 1000);
    this.camera.position.set(1.2, 0.4, 9.6);
    this.currentCamPos = this.camera.position.clone();
    this.targetCamPos = this.camera.position.clone();
    this.currentLookAt = new THREE.Vector3(0.9, 0, 0);
    this.targetLookAt = new THREE.Vector3(0.9, 0, 0);

    this.renderer = new THREE.WebGLRenderer({
      canvas: this.canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.25;

    // Direct Studio Lights
    const ambientLight = new THREE.AmbientLight(0x0e1320, 1.8);
    this.scene.add(ambientLight);

    // Key Studio Light (Pure Neutral White Softbox)
    this.keyLight = new THREE.DirectionalLight(0xffffff, 4.0);
    this.keyLight.position.set(10, 14, 12);
    this.scene.add(this.keyLight);

    // Specular Rim Light (Crisp Edge Definition)
    this.rimLight = new THREE.DirectionalLight(0xdbeafe, 4.8);
    this.rimLight.position.set(-12, -4, -10);
    this.scene.add(this.rimLight);

    // Accent Pedestal Glow
    this.pedestalGlow = new THREE.PointLight(0x10b981, 1.6, 8);
    this.pedestalGlow.position.set(2.4, -2.4, 1.0);
    this.scene.add(this.pedestalGlow);

    // Monolith Container
    this.monolithRoot = new THREE.Group();
    this.monolithRoot.position.set(2.4, -0.15, 0);
    this.scene.add(this.monolithRoot);

    // Dynamic Element Handles
    this.glassMesh = null;
    this.pedestalMesh = null;
    this.majorityNodes = [];
    this.minorityNodes = [];
    this.syntheticNodes = [];
    this.manifoldMesh = null;
    this.minorityLines = null;
    this.syntheticLines = null;
    this.syntheticLineMat = null;

    // Mouse Tracking & Raycasting Handles
    this.mouseX = 0;
    this.mouseY = 0;
    this.targetMouseX = 0;
    this.targetMouseY = 0;
    this.screenMouseX = 0;
    this.screenMouseY = 0;
    this.mouseCoords = new THREE.Vector2(-999, -999);
    this.raycaster = new THREE.Raycaster();
    this.hoveredNode = null;
    this.interactiveNodes = [];

    // HUD Probe Elements
    this.hudEl = qs('#monolith-probe-hud');
    this.hudTypeEl = qs('#hud-node-type');
    this.hudIdEl = qs('#hud-node-id');
    this.hudCoordsEl = qs('#hud-coords');
    this.hudDensityEl = qs('#hud-density');
    this.hudEigenEl = qs('#hud-eigen');
    this.hudDotEl = qs('.hud-status-dot');
  }

  // --------------------------------------------------------------------------
  // 2. High-End Studio Environment Map (PMREM) for Realistic Glass & Titanium
  // --------------------------------------------------------------------------
  initStudioEnvironment() {
    const THREE = window.THREE;
    try {
      const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
      pmremGenerator.compileEquirectangularShader();

      const envScene = new THREE.Scene();
      envScene.background = new THREE.Color(0x06080e);

      // Studio overhead softbox
      const topSoftbox = new THREE.Mesh(
        new THREE.PlaneGeometry(24, 24),
        new THREE.MeshBasicMaterial({ color: 0xffffff })
      );
      topSoftbox.position.set(0, 16, 0);
      topSoftbox.rotation.x = Math.PI / 2;
      envScene.add(topSoftbox);

      // Left soft fill strip
      const leftStrip = new THREE.Mesh(
        new THREE.PlaneGeometry(8, 28),
        new THREE.MeshBasicMaterial({ color: 0xdbeafe })
      );
      leftStrip.position.set(-16, 6, 2);
      leftStrip.rotation.y = Math.PI / 2;
      envScene.add(leftStrip);

      // Right specular kicker
      const rightStrip = new THREE.Mesh(
        new THREE.PlaneGeometry(8, 28),
        new THREE.MeshBasicMaterial({ color: 0xf1f5f9 })
      );
      rightStrip.position.set(16, 6, -4);
      rightStrip.rotation.y = -Math.PI / 2;
      envScene.add(rightStrip);

      // Gradient floor bounce
      const floorBounce = new THREE.Mesh(
        new THREE.PlaneGeometry(30, 30),
        new THREE.MeshBasicMaterial({ color: 0x090d18 })
      );
      floorBounce.position.set(0, -10, 0);
      floorBounce.rotation.x = -Math.PI / 2;
      envScene.add(floorBounce);

      const renderTarget = pmremGenerator.fromScene(envScene, 0.04);
      this.scene.environment = renderTarget.texture;
    } catch (e) {
      console.warn('PMREM Studio environment initialization failed:', e);
    }
  }

  // --------------------------------------------------------------------------
  // 3. Load Optical Glass Monolith GLB Asset
  // --------------------------------------------------------------------------
  loadOpticalMonolith() {
    const THREE = window.THREE;
    const loader = new THREE.GLTFLoader();

    loader.load(
      'models/optical_data_monolith.glb',
      (gltf) => {
        const root = gltf.scene;

        root.traverse((child) => {
          if (child.isMesh) {
            const name = child.name;

            // 1. Refined Physical Glass Material for the Monolith Slab
            if (name.includes('OpticalMonolith_Glass')) {
              this.glassMesh = child;
              child.material = new THREE.MeshPhysicalMaterial({
                color: 0x050a14,
                transmission: 0.95,
                opacity: 1,
                transparent: true,
                roughness: 0.02,
                ior: 1.54,
                reflectivity: 0.92,
                clearcoat: 1.0,
                clearcoatRoughness: 0.03
              });
            }
            // 2. Bead-Blasted Titanium Pedestal
            else if (name.includes('TitaniumPedestal') || name.includes('Foot')) {
              this.pedestalMesh = child;
              child.material = new THREE.MeshStandardMaterial({
                color: 0x141822,
                metalness: 0.96,
                roughness: 0.28
              });
            }
            // 3. Majority Data Nodes (Cold White Laser Points)
            else if (name.includes('DataNode_Maj')) {
              this.majorityNodes.push(child);
              child.material = new THREE.MeshStandardMaterial({
                color: 0xf1f5f9,
                emissive: 0x94a3b8,
                emissiveIntensity: 0.35,
                roughness: 0.35,
                metalness: 0.1
              });
              const hash = Math.abs(Math.sin(child.position.x * 12.9898 + child.position.y * 78.233 + child.position.z * 37.719) * 43758.5453);
              child.userData = {
                id: '0x' + Math.floor((hash % 1) * 0xffff).toString(16).toUpperCase().padStart(4, '0'),
                type: 'majority',
                origEmissiveIntensity: 0.35,
                coords: `[${child.position.x >= 0 ? '+' : ''}${child.position.x.toFixed(2)}, ${child.position.y >= 0 ? '+' : ''}${child.position.y.toFixed(2)}, ${child.position.z >= 0 ? '+' : ''}${child.position.z.toFixed(2)}]`,
                density: (0.120 + (hash % 1) * 0.09).toFixed(3) + ' / mm³',
                eigen: `λ₁ = ${(0.920 + (hash % 1) * 0.07).toFixed(3)}`
              };
              this.interactiveNodes.push(child);
            }
            // 4. Minority Data Nodes (Warm Amber Laser Points)
            else if (name.includes('DataNode_Min')) {
              this.minorityNodes.push(child);
              child.material = new THREE.MeshStandardMaterial({
                color: 0xfbbf24,
                emissive: 0xd97706,
                emissiveIntensity: 0.9,
                roughness: 0.2,
                metalness: 0.2
              });
              const hash = Math.abs(Math.sin(child.position.x * 12.9898 + child.position.y * 78.233 + child.position.z * 37.719) * 43758.5453);
              child.userData = {
                id: '0x' + Math.floor((hash % 1) * 0xffff).toString(16).toUpperCase().padStart(4, '0'),
                type: 'minority',
                origEmissiveIntensity: 0.9,
                coords: `[${child.position.x >= 0 ? '+' : ''}${child.position.x.toFixed(2)}, ${child.position.y >= 0 ? '+' : ''}${child.position.y.toFixed(2)}, ${child.position.z >= 0 ? '+' : ''}${child.position.z.toFixed(2)}]`,
                density: (0.015 + (hash % 1) * 0.02).toFixed(3) + ' / mm³ (Sparse)',
                eigen: `λ₁ = ${(0.780 + (hash % 1) * 0.12).toFixed(3)}`
              };
              this.interactiveNodes.push(child);
            }
            // 5. Synthetic Interpolation Nodes (Emerald Laser Points)
            else if (name.includes('DataNode_Synth')) {
              this.syntheticNodes.push(child);
              child.material = new THREE.MeshStandardMaterial({
                color: 0x34d399,
                emissive: 0x059669,
                emissiveIntensity: 1.1,
                roughness: 0.2,
                metalness: 0.2
              });
              // Initial scale 0 (materializes in Chapter 2)
              child.scale.set(0.001, 0.001, 0.001);
              const hash = Math.abs(Math.sin(child.position.x * 12.9898 + child.position.y * 78.233 + child.position.z * 37.719) * 43758.5453);
              child.userData = {
                id: '0x' + Math.floor((hash % 1) * 0xffff).toString(16).toUpperCase().padStart(4, '0'),
                type: 'synthetic',
                origEmissiveIntensity: 1.1,
                coords: `[${child.position.x >= 0 ? '+' : ''}${child.position.x.toFixed(2)}, ${child.position.y >= 0 ? '+' : ''}${child.position.y.toFixed(2)}, ${child.position.z >= 0 ? '+' : ''}${child.position.z.toFixed(2)}]`,
                density: (0.075 + (hash % 1) * 0.03).toFixed(3) + ' / mm³ (Forged)',
                eigen: `λ₁ = ${(0.890 + (hash % 1) * 0.08).toFixed(3)}`
              };
              this.interactiveNodes.push(child);
            }
            // 6. Decision Manifold Ribbon
            else if (name.includes('Internal_Decision_Manifold')) {
              this.manifoldMesh = child;
              child.material = new THREE.MeshStandardMaterial({
                color: 0x0284c7,
                emissive: 0x0369a1,
                emissiveIntensity: 0.5,
                wireframe: true,
                transparent: true,
                opacity: 0.32
              });
            }
          }
        });

        // Add Laser Filaments & Scientific Fiducial Guides
        this.buildDataFilaments();
        this.addFiducialMarkings();
        this.addSoftGroundShadow();

        this.monolithRoot.add(root);
        console.log('Optical Data Monolith loaded with physically based transmission and studio IBL.');
      },
      undefined,
      (err) => {
        console.warn('Fallback: generating procedural optical slab.', err);
        this.createProceduralOpticalSlab();
      }
    );
  }

  // --------------------------------------------------------------------------
  // 4. Laser Filaments Between Nearest Neighbors
  // --------------------------------------------------------------------------
  buildDataFilaments() {
    const THREE = window.THREE;
    if (this.minorityNodes.length === 0) return;

    // Extract world/local positions of minority nodes
    const minPositions = this.minorityNodes.map((node) => node.position.clone());

    // 1. Amber filaments connecting nearest minority neighbors (k-NN graph)
    const amberLinePoints = [];
    for (let i = 0; i < minPositions.length; i++) {
      const p1 = minPositions[i];
      // Find 2 nearest neighbors
      const neighbors = minPositions
        .map((p2, idx) => ({ idx, dist: p1.distanceTo(p2) }))
        .filter((n) => n.idx !== i)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 2);

      neighbors.forEach((n) => {
        amberLinePoints.push(p1.x, p1.y, p1.z);
        amberLinePoints.push(minPositions[n.idx].x, minPositions[n.idx].y, minPositions[n.idx].z);
      });
    }

    const amberGeo = new THREE.BufferGeometry();
    amberGeo.setAttribute('position', new THREE.Float32BufferAttribute(amberLinePoints, 3));
    const amberMat = new THREE.LineBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.45
    });
    this.minorityLines = new THREE.LineSegments(amberGeo, amberMat);
    this.monolithRoot.add(this.minorityLines);

    // 2. Emerald filaments connecting synthetic nodes to nearest amber anchors
    if (this.syntheticNodes.length > 0) {
      const synthLinePoints = [];
      this.syntheticNodes.forEach((sNode) => {
        const sp = sNode.position;
        // Find closest minority anchor
        let closest = minPositions[0];
        let minDist = sp.distanceTo(closest);
        for (let j = 1; j < minPositions.length; j++) {
          const d = sp.distanceTo(minPositions[j]);
          if (d < minDist) {
            minDist = d;
            closest = minPositions[j];
          }
        }
        synthLinePoints.push(sp.x, sp.y, sp.z);
        synthLinePoints.push(closest.x, closest.y, closest.z);
      });

      const synthGeo = new THREE.BufferGeometry();
      synthGeo.setAttribute('position', new THREE.Float32BufferAttribute(synthLinePoints, 3));
      this.syntheticLineMat = new THREE.LineBasicMaterial({
        color: 0x10b981,
        transparent: true,
        opacity: 0.0 // starts invisible, revealed in Chapter 2
      });
      this.syntheticLines = new THREE.LineSegments(synthGeo, this.syntheticLineMat);
      this.monolithRoot.add(this.syntheticLines);
    }
  }

  // --------------------------------------------------------------------------
  // 5. Scientific Fiducial Measurement Markings on Glass Slab
  // --------------------------------------------------------------------------
  addFiducialMarkings() {
    const THREE = window.THREE;
    const bracketGeo = new THREE.BufferGeometry();
    const bLen = 0.22;
    const w = 1.6;
    const h = 2.4;
    const d = 0.51;

    // Corner crosshairs / tick markers at the 4 front corners
    const pts = [
      // Top Left Corner
      -w, h, d,   -w + bLen, h, d,
      -w, h, d,   -w, h - bLen, d,

      // Top Right Corner
      w, h, d,    w - bLen, h, d,
      w, h, d,    w, h - bLen, d,

      // Bottom Left Corner
      -w, -h, d,  -w + bLen, -h, d,
      -w, -h, d,  -w, -h + bLen, d,

      // Bottom Right Corner
      w, -h, d,   w - bLen, -h, d,
      w, -h, d,   w, -h + bLen, d,
    ];

    bracketGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    const bracketMat = new THREE.LineBasicMaterial({
      color: 0x94a3b8,
      transparent: true,
      opacity: 0.35
    });
    const brackets = new THREE.LineSegments(bracketGeo, bracketMat);
    this.monolithRoot.add(brackets);
  }

  // --------------------------------------------------------------------------
  // 6. Soft Ground Contact Shadow
  // --------------------------------------------------------------------------
  addSoftGroundShadow() {
    const THREE = window.THREE;
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const grad = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
    grad.addColorStop(0.5, 'rgba(0, 0, 0, 0.25)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 128, 128);

    const shadowTex = new THREE.CanvasTexture(canvas);
    const shadowGeo = new THREE.PlaneGeometry(7.0, 4.0);
    const shadowMat = new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      opacity: 0.8,
      depthWrite: false
    });
    const shadowPlane = new THREE.Mesh(shadowGeo, shadowMat);
    shadowPlane.rotation.x = -Math.PI / 2;
    shadowPlane.position.set(0, -2.48, 0);
    this.monolithRoot.add(shadowPlane);
  }

  createProceduralOpticalSlab() {
    const THREE = window.THREE;
    const geo = new THREE.BoxGeometry(3.2, 4.8, 1.0);
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0x050a14,
      transmission: 0.94,
      roughness: 0.02,
      ior: 1.54,
      reflectivity: 0.9,
      clearcoat: 1.0,
      transparent: true
    });
    const mesh = new THREE.Mesh(geo, mat);
    this.monolithRoot.add(mesh);
  }

  // --------------------------------------------------------------------------
  // 7. Event Listeners & Kinematics
  // --------------------------------------------------------------------------
  setupEventListeners() {
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });

    window.addEventListener('mousemove', (e) => {
      this.targetMouseX = (e.clientX / window.innerWidth) * 2 - 1;
      this.targetMouseY = -(e.clientY / window.innerHeight) * 2 + 1;
      this.screenMouseX = e.clientX;
      this.screenMouseY = e.clientY;
      this.mouseCoords.x = (e.clientX / window.innerWidth) * 2 - 1;
      this.mouseCoords.y = -(e.clientY / window.innerHeight) * 2 + 1;
    });

    window.addEventListener('scroll', () => {
      this.updateScroll();
    }, { passive: true });

    // Timeline dots click navigation
    qsa('.timeline-step').forEach((step) => {
      step.addEventListener('click', () => {
        const stepIdx = parseInt(step.dataset.step, 10);
        const targets = ['#hero', '#imbalance', '#synthesis', '#verification'];
        const el = qs(targets[stepIdx]);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
          playSubtleClick(800, 0.04);
        }
      });
    });
  }

  // --------------------------------------------------------------------------
  // 8. Scroll Choreography & Camera Trajectory
  // --------------------------------------------------------------------------
  updateScroll() {
    const heroEl = qs('#hero');
    const imbEl = qs('#imbalance');
    const synEl = qs('#synthesis');
    const verEl = qs('#verification');
    const ctaEl = qs('#cta');

    if (!heroEl || !imbEl || !synEl || !verEl || !ctaEl) return;

    const vh = window.innerHeight;
    const y = window.scrollY;
    const probe = y + vh * 0.35;

    const imbTop = imbEl.offsetTop;
    const synTop = synEl.offsetTop;
    const verTop = verEl.offsetTop;
    const ctaTop = ctaEl.offsetTop;

    let chapterIdx = 0;
    let t = 0;

    // Natural reading zone activation
    if (probe < imbTop) {
      chapterIdx = 0;
      const range = Math.max(imbTop - vh * 0.35, 1);
      t = Math.min(Math.max(y / range, 0), 1);
    } else if (probe < synTop) {
      chapterIdx = 1;
      t = Math.min(Math.max((probe - imbTop) / (synTop - imbTop), 0), 1);
    } else if (probe < verTop) {
      chapterIdx = 2;
      t = Math.min(Math.max((probe - synTop) / (verTop - synTop), 0), 1);
    } else if (probe < ctaTop) {
      chapterIdx = 3;
      t = Math.min(Math.max((probe - verTop) / (ctaTop - verTop), 0), 1);
    } else {
      chapterIdx = 4;
      t = 1.0;
    }

    if (chapterIdx !== this.currentChapter) {
      this.currentChapter = chapterIdx;
      playSubtleClick(600 + chapterIdx * 100, 0.03);
    }

    const activeTimelineIdx = Math.min(chapterIdx, 3);
    qsa('.timeline-step').forEach((step, idx) => {
      step.classList.toggle('active', idx === activeTimelineIdx);
    });

    // --- Dynamic Camera & Monolith Trajectories ---

    // Chapter 0: Hero — Optical Monolith showcased on the right
    if (chapterIdx === 0) {
      this.monolithRoot.position.set(2.4, -0.15, 0);
      this.targetCamPos.set(1.2 - t * 0.2, 0.4 + t * 0.4, 9.6 - t * 2.0);
      this.targetLookAt.set(0.9 + t * 0.4, 0, 0);
      this.monolithRoot.rotation.y = -0.42 + t * 0.15;
      this.monolithRoot.rotation.x = 0.08;

      // Hide synthetic points & synthetic lines
      this.syntheticNodes.forEach((node) => node.scale.set(0.001, 0.001, 0.001));
      if (this.syntheticLineMat) this.syntheticLineMat.opacity = 0;
      if (this.minorityLines) this.minorityLines.material.opacity = 0.35;
    }

    // Chapter 1: Imbalance Void — Macro zoom directly onto amber minority cluster
    else if (chapterIdx === 1) {
      this.monolithRoot.position.set(2.4, -0.15, 0);
      this.monolithRoot.rotation.y = -0.27 + 0.05 * t;
      this.monolithRoot.rotation.x = 0.08 + 0.04 * t;

      this.targetCamPos.set(1.0 + 1.2 * t, 0.8 + 0.4 * t, 7.6 - 3.2 * t);
      this.targetLookAt.set(1.3 + 1.2 * t, 0.4 + 0.9 * t, 0);

      // Pulse minority amber nodes & brighten amber nearest-neighbor filaments
      const pulse = 1.0 + Math.sin(t * Math.PI) * 0.35;
      this.minorityNodes.forEach((node) => node.scale.set(pulse, pulse, pulse));
      if (this.minorityLines) this.minorityLines.material.opacity = 0.35 + 0.35 * Math.sin(t * Math.PI);
      if (this.syntheticLineMat) this.syntheticLineMat.opacity = 0;
      this.syntheticNodes.forEach((node) => node.scale.set(0.001, 0.001, 0.001));
    }

    // Chapter 2: Geodesic Synthesis — Monolith anchored cleanly on left, emerald synthesis bridge ignites
    else if (chapterIdx === 2) {
      this.monolithRoot.position.set(-5.6, -0.15, 0);
      this.monolithRoot.rotation.y = 0.42 + 0.08 * t;
      this.monolithRoot.rotation.x = 0.08;

      this.targetCamPos.set(-0.4, 0.6, 7.6);
      this.targetLookAt.set(-4.4, 0.2, 0);

      // Sequentially materialize synthetic emerald nodes along probability geodesics
      this.syntheticNodes.forEach((node, i) => {
        const threshold = i / this.syntheticNodes.length;
        const s = t >= threshold ? 1.0 : 0.001;
        node.scale.set(s, s, s);
      });
      if (this.syntheticLineMat) {
        this.syntheticLineMat.opacity = Math.min(t * 1.4, 0.7);
      }
    }

    // Chapter 3: TSTR Verification — Monolith anchored on right in high-angle isometric perspective
    else if (chapterIdx === 3) {
      this.monolithRoot.position.set(3.5, -0.35, 0);
      this.monolithRoot.rotation.x = 0.48;
      this.monolithRoot.rotation.y = -0.38 + 0.05 * t;

      this.targetCamPos.set(1.6, 1.9, 7.8);
      this.targetLookAt.set(2.6, 0.1, 0);

      // All nodes stabilized and visible
      this.syntheticNodes.forEach((node) => node.scale.set(1.0, 1.0, 1.0));
      if (this.syntheticLineMat) this.syntheticLineMat.opacity = 0.65;
      if (this.minorityLines) this.minorityLines.material.opacity = 0.5;
    }

    // Chapter 4: CTA — Clean split view with monolith anchored on right
    else {
      this.monolithRoot.position.set(2.8, -0.15, 0);
      this.monolithRoot.rotation.x = 0.12;
      this.monolithRoot.rotation.y = -0.40 + t * 0.15;

      this.targetCamPos.set(1.2, 0.4, 9.2);
      this.targetLookAt.set(1.6, 0, 0);

      this.syntheticNodes.forEach((node) => node.scale.set(1.0, 1.0, 1.0));
      if (this.syntheticLineMat) this.syntheticLineMat.opacity = 0.65;
    }

    // Mobile Viewport Kinematics Adjustment
    if (window.innerWidth <= 768) {
      this.monolithRoot.position.x = 0;
      this.targetCamPos.z += 2.2;
    }
  }

  // --------------------------------------------------------------------------
  // 9. Interactive Data Node Raycast & HUD Probe
  // --------------------------------------------------------------------------
  updateRaycast() {
    if (!this.raycaster || !this.interactiveNodes || this.interactiveNodes.length === 0) return;

    this.raycaster.setFromCamera(this.mouseCoords, this.camera);
    const visibleCandidates = this.interactiveNodes.filter((n) => n.scale.x > 0.05);

    const THREE = window.THREE;
    const nodeWorldPos = new THREE.Vector3();
    let closestNode = null;
    let closestDist = 0.28; // Snappy interaction zone

    for (let i = 0; i < visibleCandidates.length; i++) {
      const node = visibleCandidates[i];
      node.getWorldPosition(nodeWorldPos);
      const distToRay = this.raycaster.ray.distanceToPoint(nodeWorldPos);
      if (distToRay < closestDist) {
        closestDist = distToRay;
        closestNode = node;
      }
    }

    if (closestNode) {
      if (this.hoveredNode !== closestNode) {
        if (this.hoveredNode && this.hoveredNode.userData) {
          this.hoveredNode.material.emissiveIntensity = this.hoveredNode.userData.origEmissiveIntensity;
        }
        this.hoveredNode = closestNode;
        closestNode.material.emissiveIntensity = closestNode.userData.type === 'synthetic' ? 2.6 : closestNode.userData.type === 'minority' ? 2.2 : 1.1;
        playSubtleClick(1200, 0.015);

        // Update HUD elements
        const d = closestNode.userData;
        if (this.hudTypeEl) {
          this.hudTypeEl.textContent = d.type === 'minority' ? 'MINORITY ANCHOR' : d.type === 'synthetic' ? 'SYNTHETIC INTERPOLANT' : 'MAJORITY NODE';
        }
        if (this.hudIdEl) this.hudIdEl.textContent = d.id;
        if (this.hudCoordsEl) this.hudCoordsEl.textContent = d.coords;
        if (this.hudDensityEl) this.hudDensityEl.textContent = d.density;
        if (this.hudEigenEl) this.hudEigenEl.textContent = d.eigen;

        if (this.hudDotEl) {
          this.hudDotEl.className = 'hud-status-dot' + (d.type === 'synthetic' ? ' synthetic' : d.type === 'majority' ? ' majority' : '');
        }

        if (this.hudEl) this.hudEl.classList.add('active');
        document.body.style.cursor = 'crosshair';
      }

      if (this.hudEl) {
        let px = this.screenMouseX + 16;
        let py = this.screenMouseY + 16;
        if (px + 200 > window.innerWidth) px = this.screenMouseX - 200;
        if (py + 130 > window.innerHeight) py = this.screenMouseY - 130;
        this.hudEl.style.transform = `translate(${px}px, ${py}px)`;
      }
    } else {
      if (this.hoveredNode) {
        if (this.hoveredNode.userData) {
          this.hoveredNode.material.emissiveIntensity = this.hoveredNode.userData.origEmissiveIntensity;
        }
        this.hoveredNode = null;
        if (this.hudEl) this.hudEl.classList.remove('active');
        document.body.style.cursor = 'default';
      }
    }
  }

  // --------------------------------------------------------------------------
  // 10. Main 60 FPS Render Loop
  // --------------------------------------------------------------------------
  animate(time) {
    requestAnimationFrame(this.animate);

    const delta = (time - this.lastTime) * 0.001;
    this.lastTime = time;

    // Smooth Mouse Parallax Interpolation
    this.mouseX += (this.targetMouseX - this.mouseX) * 0.05;
    this.mouseY += (this.targetMouseY - this.mouseY) * 0.05;

    // Camera Motion Interpolation
    this.currentCamPos.lerp(this.targetCamPos, 0.05);
    this.currentLookAt.lerp(this.targetLookAt, 0.05);

    this.camera.position.x = this.currentCamPos.x + this.mouseX * 0.35;
    this.camera.position.y = this.currentCamPos.y + this.mouseY * 0.25;
    this.camera.position.z = this.currentCamPos.z;
    this.camera.lookAt(this.currentLookAt);

    // Subtle Monolith Breathing Motion in Hero
    if (this.scrollProgress < 0.22 && this.monolithRoot) {
      this.monolithRoot.position.y = -0.15 + Math.sin(time * 0.0012) * 0.04;
      this.monolithRoot.rotation.y += Math.sin(time * 0.0008) * 0.0002;
    }

    // Gentle Decision Manifold ripple
    if (this.manifoldMesh) {
      this.manifoldMesh.position.z = Math.sin(time * 0.002) * 0.025;
    }

    // Interactive Raycast Probe Update
    this.updateRaycast();

    this.renderer.render(this.scene, this.camera);
  }
}

// Initialize on DOM Ready
window.addEventListener('DOMContentLoaded', () => {
  window.dataForgeMonolith = new OpticalMonolithEngine();
});
