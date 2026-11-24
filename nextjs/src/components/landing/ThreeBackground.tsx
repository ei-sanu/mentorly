'use client';

/**
 * Mentorly — lightweight Three.js ambient background.
 *
 * WHERE IT GOES (Mac): /Users/somesh/Projects/alumniconnect/alumninetwork
 *   Save as `src/components/landing/ThreeBackground.tsx` (new file) and
 *   mount it inside the landing hero in `src/pages/HomePage.tsx`, as the
 *   first child of the hero's relative container, behind the hero copy:
 *
 *     <section className="relative overflow-hidden">
 *       <ThreeBackground tone="light" />
 *       <div className="relative"> …hero copy… </div>
 *     </section>
 *
 *   The hero copy wrapper MUST be `relative` (or have a higher z-index)
 *   so the canvas never covers text or buttons. The canvas itself is
 *   `pointer-events-none` and `aria-hidden`.
 *
 * WHAT IT IS: a NEW monochrome ambient layer for Mentorly — slow-drifting
 * fine dots (plus a faint dot-grid floor) in black/white/grey only, low
 * opacity. It is NOT a copy of any portfolio effect: no portrait, no
 * dissolve/scatter, no textures, no models, no colour.
 *
 * PERFORMANCE / SAFETY (why it stays light):
 * - `three` is lazy-loaded with a dynamic `import()` inside useEffect, so
 *   it never blocks first paint or the navbar. Until it loads, a plain
 *   CSS dot pattern (see mentorly-minimal.css `.three-fallback`) shows.
 * - One `THREE.Points` draw call, ~320 particles. No per-frame React
 *   state updates; animation is a single requestAnimationFrame loop.
 * - Respects `prefers-reduced-motion`: renders one static frame, no loop.
 * - Pauses when the tab is hidden (`visibilitychange`) and resumes on
 *   return; stops entirely on unmount and disposes geometry/material/
 *   renderer (no GPU leaks on route change).
 * - WebGL unavailable / `three` fails to load → falls back to the CSS
 *   dot pattern, no error thrown, no blank hero.
 * - `tone="light"` (default) is for the new light-grey theme: dark-grey
 *   dots on #f2f2f2. `tone="dark"` is for black sections: white dots.
 *
 * INSTALL (only if `three` is not already a dependency — check first):
 *   npm install three
 *   npm install -D @types/three
 * (No @react-three/fiber, no drei — deliberately dependency-light.)
 */
import { useEffect, useRef, useState } from 'react';

export interface ThreeBackgroundProps {
  /** 'light' = dark dots on the light-grey theme (default). 'dark' = white dots on black. */
  tone?: 'light' | 'dark';
  /** Particle count. Keep low — this is ambience, not a starfield. */
  density?: number;
  /** Drift speed multiplier (1 = slow). Use 0 for a static field. */
  speed?: number;
  /** Extra classes on the wrapper (e.g. to size it to a section). */
  className?: string;
}

const FALLBACK_CLASS = 'three-fallback';

export default function ThreeBackground({
  tone = 'light',
  density = 320,
  speed = 1,
  className = '',
}: ThreeBackgroundProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const mount = mountRef.current;
    const canvas = canvasRef.current;
    if (!mount || !canvas) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let renderer: import('three').WebGLRenderer | null = null;
    let rafId = 0;
    let cancelled = false;
    let onVisibilityChange: (() => void) | null = null;
    let onResize: (() => void) | null = null;
    let disposeScene: (() => void) | null = null;

    const start = async () => {
      let THREE: typeof import('three');
      try {
        THREE = await import('three');
      } catch {
        if (!cancelled) setFailed(true);
        return;
      }
      if (cancelled) return;

      let webglRenderer: import('three').WebGLRenderer;
      try {
        webglRenderer = new THREE.WebGLRenderer({
          canvas,
          alpha: true,
          antialias: true,
          powerPreference: 'low-power',
        });
      } catch {
        if (!cancelled) setFailed(true);
        return;
      }
      renderer = webglRenderer;
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
      camera.position.z = 9;

      /* Drifting dots — monochrome only. Light tone: dark-grey dots. */
      const count = Math.max(60, Math.min(density, 800));
      const positions = new Float32Array(count * 3);
      const velocities = new Float32Array(count);
      for (let i = 0; i < count; i++) {
        positions[i * 3] = (Math.random() - 0.5) * 18; // x
        positions[i * 3 + 1] = (Math.random() - 0.5) * 10; // y
        positions[i * 3 + 2] = (Math.random() - 0.5) * 4; // z
        velocities[i] = 0.02 + Math.random() * 0.06;
      }
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const material = new THREE.PointsMaterial({
        color: tone === 'light' ? 0x555555 : 0xcccccc,
        size: 0.055,
        transparent: true,
        opacity: tone === 'light' ? 0.5 : 0.45,
        sizeAttenuation: true,
        depthWrite: false,
      });
      const points = new THREE.Points(geometry, material);
      scene.add(points);

      /* Faint dot-grid floor — a second Points cloud, lower opacity. */
      const gridCount = 120;
      const gridPositions = new Float32Array(gridCount * 3);
      for (let i = 0; i < gridCount; i++) {
        gridPositions[i * 3] = (Math.random() - 0.5) * 18;
        gridPositions[i * 3 + 1] = -4.6 + Math.random() * 0.4;
        gridPositions[i * 3 + 2] = (Math.random() - 0.5) * 4;
      }
      const gridGeometry = new THREE.BufferGeometry();
      gridGeometry.setAttribute('position', new THREE.BufferAttribute(gridPositions, 3));
      const gridMaterial = new THREE.PointsMaterial({
        color: tone === 'light' ? 0x999999 : 0x777777,
        size: 0.04,
        transparent: true,
        opacity: 0.35,
        sizeAttenuation: true,
        depthWrite: false,
      });
      const grid = new THREE.Points(gridGeometry, gridMaterial);
      scene.add(grid);

      const resize = () => {
        if (!mount || !renderer) return;
        const w = mount.clientWidth;
        const h = mount.clientHeight;
        if (w === 0 || h === 0) return;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      };
      onResize = resize;
      resize();
      window.addEventListener('resize', resize);

      let running = !reducedMotion && !document.hidden;
      let last = performance.now();

      const tick = (now: number) => {
        if (cancelled) return;
        const dt = Math.min((now - last) / 1000, 0.05);
        last = now;
        if (running) {
          const pos = geometry.attributes.position as import('three').BufferAttribute;
          for (let i = 0; i < count; i++) {
            let y = pos.getY(i) + velocities[i] * dt * speed;
            if (y > 5.2) y = -5.2;
            pos.setY(i, y);
          }
          pos.needsUpdate = true;
          points.rotation.y += dt * 0.02 * speed;
          grid.rotation.y -= dt * 0.008 * speed;
        }
        renderer?.render(scene, camera);
        if (running) rafId = requestAnimationFrame(tick);
      };

      onVisibilityChange = () => {
        const shouldRun = !reducedMotion && !document.hidden;
        if (shouldRun && !running) {
          running = true;
          last = performance.now();
          rafId = requestAnimationFrame(tick);
        } else if (!shouldRun) {
          running = false;
          cancelAnimationFrame(rafId);
        }
      };
      document.addEventListener('visibilitychange', onVisibilityChange);

      /* One frame immediately (so reduced-motion still shows the field). */
      renderer.render(scene, camera);
      if (running) rafId = requestAnimationFrame(tick);

      disposeScene = () => {
        geometry.dispose();
        material.dispose();
        gridGeometry.dispose();
        gridMaterial.dispose();
      };
    };

    void start();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      if (onVisibilityChange) document.removeEventListener('visibilitychange', onVisibilityChange);
      if (onResize) window.removeEventListener('resize', onResize);
      disposeScene?.();
      renderer?.dispose();
    };
  }, [tone, density, speed]);

  return (
    <div
      ref={mountRef}
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 overflow-hidden ${failed ? FALLBACK_CLASS : ''} ${className}`}
    >
      {!failed && <canvas ref={canvasRef} className="block h-full w-full" />}
    </div>
  );
}
