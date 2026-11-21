// Everything that moves is driven by one clock that only runs while the page is alive
const things = [...document.querySelectorAll(
  "#headline, #sub, #cta, .card, .logo, .nav a"
)].map((el) => ({
  el,
  // Each element gets its own random phase and speed, so they don't move in sync
  px: Math.random() * 6.28, py: Math.random() * 6.28, pr: Math.random() * 6.28,
  sx: 0.4 + Math.random() * 0.8,
  sy: 0.4 + Math.random() * 0.8,
  sr: 0.4 + Math.random() * 0.8,
}));

let alive = false;
let t = 0;                       // seconds the page has been alive in total
let last = performance.now();

window.addEventListener("watchedchange", (e) => {
  alive = !e.detail.watched;
});

function frame(now) {
  const dt = (now - last) / 1000;
  last = now;

  if (alive) t += dt;            // when watched, the clock stops and the pose freezes

  // Ramp up: gentle first, then bolder the longer it has been alive
  const eased = Math.min(1, t / 3);              // 0 to 1 over the first 3 seconds
  const boldness = 0.4 + Math.min(1, t / 20) * 0.6;
  const amp = eased * boldness;

  for (const o of things) {
    const x = Math.sin(t * o.sx + o.px) * 70 * amp;
    const y = Math.sin(t * o.sy + o.py) * 50 * amp;
    const r = Math.sin(t * o.sr + o.pr) * 10 * amp;
    const s = 1 + Math.sin(t * 1.5 + o.pr) * 0.06 * amp;
    o.el.style.transform = `translate(${x}px, ${y}px) rotate(${r}deg) scale(${s})`;
  }

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);