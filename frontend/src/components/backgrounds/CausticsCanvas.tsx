import React, { useEffect, useRef } from 'react';

// Self-contained Perlin Noise implementation for zero external dependencies
class PerlinNoise {
  private p: Uint8Array;
  constructor() {
    this.p = new Uint8Array(512);
    const permutation = new Uint8Array(256);
    for (let i = 0; i < 256; i++) permutation[i] = i;
    // Shuffle
    for (let i = 255; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = permutation[i];
      permutation[i] = permutation[j];
      permutation[j] = tmp;
    }
    // Fill doubled permutation array
    for (let i = 0; i < 512; i++) {
      this.p[i] = permutation[i & 255];
    }
  }

  private fade(t: number) {
    return t * t * t * (t * (t * 6 - 15) + 10);
  }

  private lerp(t: number, a: number, b: number) {
    return a + t * (b - a);
  }

  private grad(hash: number, x: number, y: number): number {
    const h = hash & 15;
    const u = h < 8 ? x : y;
    const v = h < 4 ? y : h === 12 || h === 14 ? x : 0;
    return ((h & 1) === 0 ? u : -u) + ((h & 2) === 0 ? v : -v);
  }

  noise2D(x: number, y: number): number {
    const X = Math.floor(x) & 255;
    const Y = Math.floor(y) & 255;

    x -= Math.floor(x);
    y -= Math.floor(y);

    const u = this.fade(x);
    const v = this.fade(y);

    const aa = this.p[this.p[X] + Y];
    const ab = this.p[this.p[X] + Y + 1];
    const ba = this.p[this.p[X + 1] + Y];
    const bb = this.p[this.p[X + 1] + Y + 1];

    const val = this.lerp(v,
      this.lerp(u, this.grad(aa, x, y), this.grad(ba, x - 1, y)),
      this.lerp(u, this.grad(ab, x, y - 1), this.grad(bb, x - 1, y - 1))
    );

    return (val + 1) / 2; // Normalize to [0, 1]
  }
}

interface CausticsCanvasProps {
  interactive?: boolean;
  intensity?: number; // 0.0 to 1.0 (opacity of the caustics layer)
}

export const CausticsCanvas: React.FC<CausticsCanvasProps> = ({
  interactive = true,
  intensity = 0.4,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({ x: 0, y: 0, targetX: 0, targetY: 0 });
  const noiseRef = useRef(new PerlinNoise());
  const animationFrameRef = useRef<number | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const isVisibleRef = useRef(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Grid details for rendering. Lower resolution + CSS blur is 10x faster
    const gridWidth = 40;
    const gridHeight = 25;
    
    // Set up sizing
    const resize = () => {
      canvas.width = gridWidth;
      canvas.height = gridHeight;
    };
    resize();

    // Mouse movement tracker
    const handleMouseMove = (e: MouseEvent) => {
      if (!interactive) return;
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = (e.clientY - rect.top) / rect.height;
      mouseRef.current.targetX = x;
      mouseRef.current.targetY = y;
    };

    window.addEventListener('mousemove', handleMouseMove);

    // Intersection observer to pause rendering when background is out of view
    observerRef.current = new IntersectionObserver(([entry]) => {
      isVisibleRef.current = entry.isIntersecting;
    }, { threshold: 0.1 });
    observerRef.current.observe(canvas);

    const noise = noiseRef.current;
    const period = 30000; // 30 second loop period (in milliseconds)

    const render = (now: number) => {
      if (!isVisibleRef.current) {
        animationFrameRef.current = requestAnimationFrame(render);
        return;
      }

      // Delta time independent update
      const elapsed = now % period;
      const t = (elapsed / period) * 2 * Math.PI; // Circle angle

      // Seamless circular scrolling offsets for two octaves
      const offset1 = {
        x: Math.cos(t) * 1.5,
        y: Math.sin(t) * 1.5
      };
      const offset2 = {
        x: Math.cos(t * 2) * 0.8,
        y: Math.sin(t * 2) * 0.8
      };

      // Mouse lazy lag (lerp)
      const mouse = mouseRef.current;
      mouse.x += (mouse.targetX - mouse.x) * 0.04;
      mouse.y += (mouse.targetY - mouse.y) * 0.04;

      // Detect active theme
      const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
      
      // Color Palettes
      // Primary: Indigo-violet
      // Warm neutral base
      const baseColor = isDark 
        ? { r: 12, g: 10, b: 9 }      // Stone 950
        : { r: 252, g: 251, b: 249 }; // Stone 50

      const primaryColor = { r: 79, g: 70, b: 229 }; // Indigo

      // Clear with base background
      ctx.fillStyle = `rgb(${baseColor.r}, ${baseColor.g}, ${baseColor.b})`;
      ctx.fillRect(0, 0, gridWidth, gridHeight);

      // Render low-res caustic cells
      for (let x = 0; x < gridWidth; x++) {
        for (let y = 0; y < gridHeight; y++) {
          const nx = x / gridWidth;
          const ny = y / gridHeight;

          // Compute distance to mouse for interaction
          let mouseDist = 0;
          if (interactive) {
            const dx = nx - mouse.x;
            const dy = ny - mouse.y;
            mouseDist = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy) * 2.5); // circular radius
          }

          // Octave 1
          const n1 = noise.noise2D(nx * 3 + offset1.x, ny * 3 + offset1.y);
          // Octave 2
          const n2 = noise.noise2D(nx * 6 + offset2.x, ny * 6 + offset2.y);
          
          // Combine noise with mouse interaction
          const val = (n1 * 0.6 + n2 * 0.4) + (mouseDist * 0.15);
          
          // Clamp val between 0 and 1
          const clval = Math.max(0, Math.min(1, val));

          // Interpolate colors based on noise value
          if (clval > 0.45) {
            // Overlay caustics waves
            const factor = (clval - 0.45) / 0.55; // 0 to 1
            const r = Math.round(baseColor.r + (primaryColor.r - baseColor.r) * factor * intensity);
            const g = Math.round(baseColor.g + (primaryColor.g - baseColor.g) * factor * intensity);
            const b = Math.round(baseColor.b + (primaryColor.b - baseColor.b) * factor * intensity);
            
            ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
            ctx.fillRect(x, y, 1, 1);
          }
        }
      }

      animationFrameRef.current = requestAnimationFrame(render);
    };

    animationFrameRef.current = requestAnimationFrame(render);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current);
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [interactive, intensity]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        zIndex: -1,
        pointerEvents: 'none',
        // High quality GPU blur transforms the blocky low-res grid into fluid volumetric caustics
        filter: 'blur(32px)',
        transform: 'scale(1.15)', // Scale slightly to hide blur edge leakage
        opacity: 0.85,
        backgroundColor: 'var(--bg-primary)'
      }}
    />
  );
};
