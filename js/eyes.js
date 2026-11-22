// eyes.js: lots of small pairs of eyes that open all over the page.
const SVG_NS = "http://www.w3.org/2000/svg";
let open = false;

// One pair of little eyes as an SVG picture
function eyePair(width, delay, tilt) {
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", "0 0 130 50");
  svg.setAttribute("class", "mini-eyes");
  svg.style.width = width + "px";
  svg.style.setProperty("--delay", delay + "s");          // each pair opens at a slightly different time
  if (tilt) svg.style.transform = `rotate(${tilt}deg)`;
  svg.innerHTML = `
    <g class="mini-eye">
      <ellipse cx="32" cy="25" rx="28" ry="20" fill="#fff" stroke="#111" stroke-width="4"/>
      <circle class="mini-iris" cx="32" cy="25" r="11" fill="#d62020"/>
    </g>
    <g class="mini-eye">
      <ellipse cx="98" cy="25" rx="28" ry="20" fill="#fff" stroke="#111" stroke-width="4"/>
      <circle class="mini-iris" cx="98" cy="25" r="11" fill="#d62020"/>
    </g>`;
  return svg;
}

export function buildEyes() {
  const layer = document.createElement("div");
  layer.id = "eyesLayer";
  document.body.appendChild(layer);

   // 1) Pairs scattered around the screen: one per grid cell, so they never overlap
  const COLS = 5, ROWS = 4;
  const cells = [];
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r < ROWS; r++) {
      const cx = ((c + 0.5) / COLS) * 100;
      const cy = ((r + 0.5) / ROWS) * 100;
      if (cx > 28 && cx < 72 && cy > 22 && cy < 78) continue;   // keep the middle free for the big face
      if (cx > 65 && cy > 70) continue;                          // keep the debug box corner free
      cells.push({ c, r });
    }
  }
  cells.sort(() => Math.random() - 0.5);                         // shuffle
  for (const { c, r } of cells.slice(0, 10)) {                   // use 10 of the free cells
    const x = ((c + 0.1 + Math.random() * 0.3) / COLS) * 100;    // small random nudge inside the cell
    const y = ((r + 0.1 + Math.random() * 0.4) / ROWS) * 100;
    const svg = eyePair(44 + Math.random() * 26, Math.random() * 2.2, (Math.random() - 0.5) * 40);
    svg.style.left = x + "%";
    svg.style.top = y + "%";
    layer.appendChild(svg);
  }

  // 2) Pairs peeking out from the page items, so they drift along with them
  const spots = [
    { sel: ".card",     w: 70, style: { left: "50%", top: "-26px", marginLeft: "-35px" } },
    { sel: "#cta",      w: 56, style: { right: "-64px", top: "-4px" } },
    { sel: ".logo",     w: 54, style: { right: "-62px", top: "-8px" } },
    { sel: "#headline", w: 80, style: { left: "0px", top: "-34px" } },
  ];
  for (const s of spots) {
    document.querySelectorAll(s.sel).forEach((el) => {
      const svg = eyePair(s.w, Math.random() * 2.2, 0);
      Object.assign(svg.style, s.style);
      el.appendChild(svg);
    });
  }
}

// Open or close all the little eyes. Returns true if this changed anything.
export function setEyesOpen(value) {
  if (value === open) return false;
  open = value;
  document.body.classList.toggle("eyes-open", open);
  return true;
}

// Make all the little irises look the same way (a few pixels)
export function lookAt(x, y) {
  const root = document.documentElement.style;
  root.setProperty("--ix", Math.max(-8, Math.min(8, x)) + "px");
  root.setProperty("--iy", Math.max(-4, Math.min(4, y)) + "px");
}