import { useEffect, useRef } from "react";

const W = 640;
const H = 800;

function moodWord(mood) {
  if (!mood) return "tuning in";
  const { valence, energy } = mood;
  if (energy > 0.7 && valence > 0.6) return "euphoric";
  if (energy > 0.7 && valence <= 0.6) return "restless";
  if (energy <= 0.35 && valence > 0.6) return "serene";
  if (energy <= 0.35 && valence <= 0.6) return "moody";
  if (valence > 0.6) return "warm";
  return "in the pocket";
}

function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export default function ShareCard({ mood }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    canvas.width = W;
    canvas.height = H;

    // Background
    ctx.fillStyle = "#0a0a0c";
    ctx.fillRect(0, 0, W, H);
    const g1 = ctx.createRadialGradient(W * 0.25, H * 0.08, 0, W * 0.25, H * 0.08, W * 0.7);
    g1.addColorStop(0, "rgba(124,77,255,0.55)");
    g1.addColorStop(1, "rgba(124,77,255,0)");
    ctx.fillStyle = g1;
    ctx.fillRect(0, 0, W, H);
    const g2 = ctx.createRadialGradient(W * 0.85, H * 0.92, 0, W * 0.85, H * 0.92, W * 0.7);
    g2.addColorStop(0, "rgba(255,46,99,0.5)");
    g2.addColorStop(1, "rgba(255,46,99,0)");
    ctx.fillStyle = g2;
    ctx.fillRect(0, 0, W, H);

    // Border card
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 2;
    drawRoundedRect(ctx, 20, 20, W - 40, H - 40, 28);
    ctx.stroke();

    // Brand
    ctx.fillStyle = "rgba(245,245,247,0.85)";
    ctx.font = "700 22px 'Space Grotesk', sans-serif";
    ctx.fillText("SOUNDTRACK", 56, 90);

    // Mood word
    ctx.fillStyle = "#f5f5f7";
    ctx.font = "700 72px 'Space Grotesk', sans-serif";
    const word = moodWord(mood);
    ctx.fillText(word, 56, 260, W - 112);

    ctx.fillStyle = "rgba(245,245,247,0.6)";
    ctx.font = "400 20px 'Inter', sans-serif";
    const summary = mood?.summary || "waiting for a read on the room";
    wrapText(ctx, summary, 56, 305, W - 112, 28);

    // Params
    const params = [
      { label: "ENERGY", value: mood?.energy ?? 0 },
      { label: "VALENCE", value: mood?.valence ?? 0 },
    ];
    let py = H - 220;
    params.forEach((p) => {
      ctx.fillStyle = "rgba(245,245,247,0.5)";
      ctx.font = "700 13px 'Inter', sans-serif";
      ctx.fillText(p.label, 56, py);
      drawRoundedRect(ctx, 56, py + 12, W - 112, 10, 5);
      ctx.fillStyle = "rgba(255,255,255,0.1)";
      ctx.fill();
      drawRoundedRect(ctx, 56, py + 12, (W - 112) * Math.min(1, Math.max(0, p.value)), 10, 5);
      const grad = ctx.createLinearGradient(56, 0, W - 56, 0);
      grad.addColorStop(0, "#7c4dff");
      grad.addColorStop(1, "#ff2e63");
      ctx.fillStyle = grad;
      ctx.fill();
      py += 60;
    });

    if (mood?.tempo) {
      ctx.fillStyle = "rgba(245,245,247,0.85)";
      ctx.font = "700 16px 'Space Grotesk', sans-serif";
      ctx.fillText(`${Math.round(mood.tempo)} BPM`, 56, H - 56);
    }
    ctx.fillStyle = "rgba(245,245,247,0.35)";
    ctx.font = "400 14px 'Inter', sans-serif";
    ctx.textAlign = "right";
    ctx.fillText(new Date().toLocaleString(), W - 56, H - 56);
    ctx.textAlign = "left";
  }, [mood]);

  function download() {
    const canvas = canvasRef.current;
    const link = document.createElement("a");
    link.download = "soundtrack-of-the-moment.png";
    link.href = canvas.toDataURL("image/png");
    link.click();
  }

  return (
    <div>
      <canvas ref={canvasRef} style={{ width: "100%", maxWidth: 320, borderRadius: 14, display: "block" }} />
      <button className="btn btn-secondary btn-block" style={{ marginTop: 12 }} onClick={download}>
        Download card
      </button>
    </div>
  );
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(" ");
  let line = "";
  let curY = y;
  let lines = 0;
  for (const word of words) {
    const test = line + word + " ";
    if (ctx.measureText(test).width > maxWidth && line !== "" && lines < 2) {
      ctx.fillText(line, x, curY);
      line = word + " ";
      curY += lineHeight;
      lines += 1;
    } else {
      line = test;
    }
  }
  ctx.fillText(line, x, curY);
}
