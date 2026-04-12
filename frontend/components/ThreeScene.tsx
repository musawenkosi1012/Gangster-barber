"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import Lenis from "lenis";

// ─── Smooth interpolation helpers ───
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const easeInOutCubic = (t: number) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// ─── Optimized Assets (Adaptive Level of Detail) ───
export type ThreeDisposable = THREE.BufferGeometry | THREE.Material | THREE.Texture;

export const createStraightRazor = (disposables: Set<ThreeDisposable>) => {
  const razor = new THREE.Group();
  const matGold = new THREE.MeshStandardMaterial({ color: 0xffd700, metalness: 0.8, roughness: 0.2 });
  const matSteel = new THREE.MeshStandardMaterial({ color: 0xe0e0e0, metalness: 0.9, roughness: 0.1 });
  const matBlack = new THREE.MeshStandardMaterial({ color: 0x111111, metalness: 0.5, roughness: 0.5 });
  disposables.add(matGold); disposables.add(matSteel); disposables.add(matBlack);

  const handleGeom = new THREE.BoxGeometry(0.3, 3, 0.15);
  disposables.add(handleGeom);
  const handle = new THREE.Mesh(handleGeom, matBlack);
  razor.add(handle);

  const pivotGeom = new THREE.CylinderGeometry(0.08, 0.08, 0.2, 16);
  disposables.add(pivotGeom);
  const pivot = new THREE.Mesh(pivotGeom, matGold);
  pivot.rotation.x = Math.PI / 2;
  pivot.position.y = 1.3;
  razor.add(pivot);

  const blade = new THREE.Group();
  const bladeBackGeom = new THREE.BoxGeometry(0.04, 2.5, 0.4);
  disposables.add(bladeBackGeom);
  const bladeBack = new THREE.Mesh(bladeBackGeom, matSteel);
  bladeBack.position.y = 1.25;
  blade.add(bladeBack);
  
  const edgeGeom = new THREE.BoxGeometry(0.01, 2.4, 0.1);
  disposables.add(edgeGeom);
  const edge = new THREE.Mesh(edgeGeom, matSteel);
  edge.position.set(0, 1.25, 0.25);
  blade.add(edge);

  blade.position.y = 1.3;
  blade.rotation.x = -Math.PI * 0.3;
  razor.add(blade);
  
  razor.traverse(obj => { if (obj instanceof THREE.Mesh) obj.frustumCulled = true; });

  return razor;
};

export const createClipper = (
  bodyColor: number,
  accentColor: number,
  bladeColor: number,
  disposables: Set<ThreeDisposable>
) => {
  const isMob = globalThis.window !== undefined && globalThis.window.innerWidth < 768;
  const Mat = isMob ? THREE.MeshStandardMaterial : THREE.MeshPhysicalMaterial;
  const clipper = new THREE.Group();

  const s = new THREE.Shape();
  s.moveTo(-0.5, -2);
  s.quadraticCurveTo(0.6, -2, 0.65, -1.8);
  s.lineTo(0.7, -0.5);
  s.lineTo(0.6, 1.5);
  s.quadraticCurveTo(0.55, 1.9, 0.4, 1.9);
  s.lineTo(-0.4, 1.9);
  s.quadraticCurveTo(-0.55, 1.9, -0.6, 1.5);
  s.lineTo(-0.7, -0.5);
  s.lineTo(-0.65, -1.8);
  s.quadraticCurveTo(-0.65, -2, -0.5, -2);

  const extrude = {
    depth: 0.5,
    bevelEnabled: true,
    bevelThickness: 0.15,
    bevelSize: 0.12,
    bevelSegments: isMob ? 2 : 48,
    curveSegments: isMob ? 6 : 128, 
  };

  const bodyGeom = new THREE.ExtrudeGeometry(s, extrude);
  bodyGeom.center();
  bodyGeom.computeVertexNormals();
  disposables.add(bodyGeom);

  const bodyMat = new Mat({
    color: bodyColor,
    metalness: isMob ? 0.4 : 0.95,
    roughness: isMob ? 0.4 : 0.05,
    ...(isMob ? {} : { clearcoat: 1, envMapIntensity: 2.5 })
  });
  disposables.add(bodyMat);

  const bodyMesh = new THREE.Mesh(bodyGeom, bodyMat);
  bodyMesh.castShadow = !isMob;
  bodyMesh.receiveShadow = !isMob;
  clipper.add(bodyMesh);

  const bladeMat = new Mat({
    color: bladeColor,
    metalness: 1,
    roughness: 0.02,
    ...(isMob ? {} : { clearcoat: 1, envMapIntensity: 4 })
  });
  disposables.add(bladeMat);

  const bladeBaseGeom = new THREE.BoxGeometry(1.2, 0.1, 0.5);
  disposables.add(bladeBaseGeom);
  const bladeBase = new THREE.Mesh(bladeBaseGeom, bladeMat);
  bladeBase.position.set(0, 2.05, 0);
  clipper.add(bladeBase);

  const toothGeom = new THREE.CylinderGeometry(0.015, 0.015, 0.25, isMob ? 6 : 24);
  disposables.add(toothGeom);

  for (let i = 0; i < (isMob ? 6 : 32); i++) {
    const tooth = new THREE.Mesh(toothGeom, bladeMat);
    tooth.position.set((isMob ? -0.3 : -0.7) + i * (isMob ? 0.12 : 0.045), 2.15, 0.2);
    clipper.add(tooth);
  }

  clipper.traverse(obj => { if (obj instanceof THREE.Mesh) obj.frustumCulled = true; });

  return clipper;
};

export default function ThreeScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const disposables = useRef(new Set<ThreeDisposable>());

  useEffect(() => {
    if (!canvasRef.current) return;

    // ─── Adaptive Device Logic ───
    const checkMobile = () => window.innerWidth < 768;
    let isMobile = checkMobile();
    
    // ─── Post-Processing Performance Layer (Sigma Fix) ───
    const postConfig = {
      bloomSigma: isMobile ? 0.02 : 0.035, // Balanced for mobile performance
      enabled: !isMobile,
    };
    // Clamp sigma to elite safety range (prevents kernel clipping warnings)
    postConfig.bloomSigma = Math.min(postConfig.bloomSigma, 0.04);

    // ─── Timing System (THREE.Timer Deprecation Migration) ───
    let lastAnimTime = performance.now();
    let animId: number;

    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      orientation: "vertical",
      touchMultiplier: 1.5,
    });

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 1000);
    
    const renderer = new THREE.WebGLRenderer({
      canvas: canvasRef.current,
      antialias: !isMobile,
      alpha: true,
      powerPreference: "high-performance",
      logarithmicDepthBuffer: false,
    });
    
    // ─── Shader Precision Guard (Fix X4122 Warning) ───
    const injectPrecision = (shader: { fragmentShader: string; vertexShader: string }) => {
      shader.fragmentShader = `
        #ifdef GL_FRAGMENT_PRECISION_HIGH
        precision highp float;
        #else
        precision mediump float;
        #endif
        ${shader.fragmentShader}
      `;
    };

    renderer.setClearColor(0x000000, 0);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.5 : 2)); 
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = !isMobile;
    renderer.shadowMap.type = THREE.PCFShadowMap;

    // --- High-Fidelity Lighting ---
    const ambientLight = new THREE.AmbientLight(0xffffff, isMobile ? 2.5 : 0.4); 
    scene.add(ambientLight);

    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x000000, isMobile ? 3 : 0.6);
    scene.add(hemiLight);

    const mainSpot = new THREE.SpotLight(0xffffff, 0, 100, Math.PI * 0.15, 0.5, 0.5);
    mainSpot.position.set(10, 20, 20);
    if (!isMobile) {
      mainSpot.castShadow = true;
      mainSpot.shadow.mapSize.setScalar(2048);
    }
    scene.add(mainSpot);

    const redAccent = new THREE.PointLight(0xff0000, 2.5, 50);
    redAccent.position.set(-10, -5, 10);
    scene.add(redAccent);

    // --- Optimized Reflector Environment ---
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envScene = new THREE.Scene();
    const addStudioLight = (pos: [number, number, number], color: number, scale: [number, number], intensity: number = 1) => {
      const boxGeom = new THREE.PlaneGeometry(scale[0], scale[1]);
      const boxMat = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
      disposables.current.add(boxGeom); disposables.current.add(boxMat);
      const box = new THREE.Mesh(boxGeom, boxMat);
      box.scale.setScalar(intensity);
      box.position.set(...pos);
      box.lookAt(0, 0, 0);
      envScene.add(box);
    };
    addStudioLight([0, 30, 20], 0xffffff, [40, 40], 2);
    addStudioLight([-20, 10, 15], 0xffffff, [20, 40], 1.5);
    addStudioLight([20, 10, 15], 0xffffff, [20, 40], 1.5);
    
    // Safety clamp sigma to 0.035 to prevent kernel clipping
    const envTex = pmrem.fromScene(envScene, isMobile ? 0.035 : 0.01).texture;
    scene.environment = envTex;
    disposables.current.add(envTex);
    pmrem.dispose();

    // --- Tool Assets ---
    const d = disposables.current;
    const clipper1 = isMobile ? createStraightRazor(d) : createClipper(0x181818, 0xff0000, 0xffffff, d);
    clipper1.scale.setScalar(isMobile ? 2.8 : 1.5);
    scene.add(clipper1);

    // Dynamic Shader Upgrade for Assets
    clipper1.traverse(obj => {
      if (obj instanceof THREE.Mesh && obj.material) {
        obj.material.onBeforeCompile = injectPrecision;
      }
    });

    const clipper2 = createClipper(0x111111, 0x44ff44, 0xdddddd, d);
    clipper2.scale.setScalar(1.3);
    clipper2.position.set(-14, 2, -5);
    clipper2.visible = !isMobile;
    scene.add(clipper2);

    const clipper3 = createClipper(0x333333, 0xffaa00, 0xcccccc, d);
    clipper3.scale.setScalar(1.3);
    clipper3.position.set(14, -2, -5);
    clipper3.visible = !isMobile;
    scene.add(clipper3);

    // --- State & Scroller Sync ---
    let targetProgress = 0;
    let currentProgress = 0;

    const state = {
      camX: 0, camZ: isMobile ? 14 : 10,
      heroIntensity: 0, redIntensity: 2,
    };

    lenis.on('scroll', (e: { progress: number }) => {
      targetProgress = e.progress;
    });

    const updRes = () => {
      isMobile = checkMobile();
      camera.fov = isMobile ? 55 : 40;
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("resize", updRes);
    updRes();

    const applyPhase1 = (t: number, tNow: number, xOff: number, yOff: number) => {
      clipper1.position.set(xOff, yOff, 0);
      clipper1.rotation.set(0.1, tNow * 0.3 + t * Math.PI * 0.2, 0.1);
      state.camX = 0; 
      state.heroIntensity = lerp(isMobile ? 40 : 20, isMobile ? 120 : 80, easeInOutCubic(t));
    };

    const applyPhase2 = (t: number, xOff: number, yOff: number) => {
      const e = easeInOutCubic(t);
      clipper1.position.set(lerp(0, isMobile ? -0.8 : -5, e) + xOff, yOff, 0);
      state.camX = lerp(0, isMobile ? 1 : 1.8, e);
      state.heroIntensity = isMobile ? 120 : 80;
    };

    const applyPhase3 = (t: number, xOff: number, yOff: number) => {
      const e = easeInOutCubic(t);
      clipper1.position.set(
        lerp(isMobile ? -0.8 : -5, 0, e) + xOff, 
        lerp(0, isMobile ? -0.5 : -1, e) + yOff, 
        lerp(0, isMobile ? 6 : 5, e)
      );
      state.camZ = lerp(isMobile ? 14 : 10, isMobile ? 10 : 8, e);
      state.redIntensity = lerp(2, isMobile ? 25 : 18, e); // Brighter red for mobile
    };

    const applyScrollEffects = (progress: number, tNow: number, xOff: number, yOff: number) => {
      if (progress <= 0.3) {
        applyPhase1(progress / 0.3, tNow, xOff, yOff);
        return;
      }
      
      if (progress <= 0.65) {
        applyPhase2((progress - 0.3) / 0.35, xOff, yOff);
        return;
      }
      
      applyPhase3((progress - 0.65) / 0.35, xOff, yOff);
    };

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const now = performance.now();
      const dt = (now - lastAnimTime) / 1000;
      lastAnimTime = now;
      const time = now / 1000;
      
      lenis.raf(time * 1000);
      currentProgress = lerp(currentProgress, targetProgress, 1 - Math.exp(-12 * dt));
      
      const fX = Math.sin(time * 0.4) * 0.08;
      const fY = Math.cos(time * 0.3) * 0.12;

      applyScrollEffects(currentProgress, time, fX, fY);

      camera.position.x = lerp(camera.position.x, state.camX, 0.1);
      camera.position.z = lerp(camera.position.z, state.camZ, 0.1);
      camera.lookAt(0, isMobile ? -0.5 : 0, 0); // Tilt down slightly for mobile to center object

      mainSpot.intensity = lerp(mainSpot.intensity, state.heroIntensity, 0.1);
      redAccent.intensity = lerp(redAccent.intensity, state.redIntensity, 0.1);

      renderer.render(scene, camera);
    };

    animate();
    
    // --- Fail-Safes & Debugging ---
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      console.warn("WebGL Context Lost on mobile. Attempting cleanup.");
      cancelAnimationFrame(animId);
    };
    canvasRef.current.addEventListener('webglcontextlost', handleContextLost, false);

    window.addEventListener("resize", updRes);
    updRes();

    return () => {
      window.removeEventListener("resize", updRes);
      if (canvasRef.current) canvasRef.current.removeEventListener('webglcontextlost', handleContextLost);
      cancelAnimationFrame(animId);
      lenis.destroy();
      
      disposables.current.forEach(item => {
        if (item instanceof THREE.BufferGeometry || (item as any).dispose) {
          (item as any).dispose();
        }
      });
      renderer.dispose();
      scene.clear();
    };
  }, []);

  return (
    <div id="canvas-container" className="fixed top-0 left-0 w-full h-[100lvh] z-1 pointer-events-none bg-black/20">
      <canvas ref={canvasRef} className="block w-full h-full webgl-canvas" />
    </div>
  );
}


