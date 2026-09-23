/**
 * A decorative QR-like glyph for the landing page phone mock. Deliberately not
 * a real, scannable code — the real one is generated server-side per room
 * (GET /api/rooms/{id}/qr). Purely illustrative, so it's hidden from a11y.
 */
const MODULES = 13;

function moduleFilled(row, col) {
  // Deterministic pseudo-random fill so the glyph is stable across renders.
  const n = Math.sin(row * 12.9898 + col * 78.233) * 43758.5453;
  return n - Math.floor(n) > 0.45;
}

function isFinderZone(row, col) {
  const inCorner = (r0, c0) => row >= r0 && row < r0 + 3 && col >= c0 && col < c0 + 3;
  return inCorner(0, 0) || inCorner(0, MODULES - 3) || inCorner(MODULES - 3, 0);
}

export default function FauxQR({ size = 74 }) {
  const cell = size / MODULES;
  const cells = [];

  for (let row = 0; row < MODULES; row++) {
    for (let col = 0; col < MODULES; col++) {
      if (isFinderZone(row, col) || !moduleFilled(row, col)) continue;
      cells.push(<rect key={`${row}-${col}`} x={col * cell} y={row * cell} width={cell} height={cell} />);
    }
  }

  const finder = (x, y) => (
    <g key={`f-${x}-${y}`}>
      <rect x={x} y={y} width={cell * 3} height={cell * 3} rx={cell * 0.5} />
      <rect x={x + cell * 0.75} y={y + cell * 0.75} width={cell * 1.5} height={cell * 1.5} fill="#fff" />
    </g>
  );

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
      <rect width={size} height={size} fill="#fff" rx="6" />
      <g fill="#0a0a0c">
        {cells}
        {finder(0, 0)}
        {finder(size - cell * 3, 0)}
        {finder(0, size - cell * 3)}
      </g>
    </svg>
  );
}
