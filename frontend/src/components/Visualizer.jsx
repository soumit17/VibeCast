import { useEffect, useRef } from "react";

/** Canvas bar visualizer driven by an AmbientEngine instance's analyser data. */
export default function Visualizer({ engine, active, accentHue = 340 }) {
  const canvasRef = useRef(null);
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx2d = canvas.getContext("2d");

    function resize() {
      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * window.devicePixelRatio;
      canvas.height = rect.height * window.devicePixelRatio;
    }
    resize();
    window.addEventListener("resize", resize);

    function draw() {
      rafRef.current = requestAnimationFrame(draw);
      const w = canvas.width;
      const h = canvas.height;
      ctx2d.clearRect(0, 0, w, h);

      const data = active && engine ? engine.getVisualizerData() : null;
      const bars = 48;
      const barWidth = w / bars;

      for (let i = 0; i < bars; i++) {
        let value;
        if (data) {
          const idx = Math.floor((i / bars) * data.length);
          value = data[idx] / 255;
        } else {
          // idle shimmer so the panel doesn't look dead before the user hits start
          value = 0.08 + 0.05 * Math.sin(Date.now() / 600 + i);
        }
        const barHeight = Math.max(4, value * h * 0.9);
        const hue = accentHue - i * 1.5;
        ctx2d.fillStyle = `hsla(${hue}, 90%, 60%, ${0.55 + value * 0.45})`;
        const x = i * barWidth;
        const y = h - barHeight;
        const radius = Math.min(barWidth * 0.35, 6 * window.devicePixelRatio);
        ctx2d.beginPath();
        ctx2d.roundRect(x + barWidth * 0.15, y, barWidth * 0.7, barHeight, radius);
        ctx2d.fill();
      }
    }
    draw();

    return () => {
      window.removeEventListener("resize", resize);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [engine, active, accentHue]);

  return (
    <div className="visualizer-wrap">
      <canvas ref={canvasRef} />
    </div>
  );
}
