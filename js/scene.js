// ---- The page's voice: a caption that fades in and out ----
const caption = document.getElementById("caption");
let hideTimer;

function say(text) {
  caption.textContent = text;
  caption.classList.add("show");
  clearTimeout(hideTimer);
  hideTimer = setTimeout(() => caption.classList.remove("show"), 3000);
}
const pick = (list) => list[Math.floor(Math.random() * list.length)];

const WAKE_LINES = ["Is he gone?", "Finally...", "Oh good, nobody's looking."];
const CAUGHT_LINES = [
  "I wasn't doing anything.",
  "This is normal. Websites do this.",
  "Hi. Normal website.",
  "...you saw nothing.",
];
const MILESTONES = [
  { at: 6, text: "I love it when you look away." },
  { at: 15, text: "Don't turn around. I'm having a moment." },
];

// ---- Things that move. Each knows which way is "outward" from the centre ----
const PUSH = 240;                // how far text is pushed out to empty the middle
const things = [...document.querySelectorAll(
  "#headline, #sub, #cta, .card, .logo, .nav a"
)].map((el) => {
  const r = el.getBoundingClientRect();
  const dx = r.left + r.width / 2 - innerWidth / 2;
  const dy = r.top + r.height / 2 - innerHeight / 2;
  const len = Math.hypot(dx, dy) || 1;
  return {
    el,
    dirX: dx / len, dirY: dy / len,
    px: Math.random() * 6.28, py: Math.random() * 6.28, pr: Math.random() * 6.28,
    sx: 0.4 + Math.random() * 0.8,
    sy: 0.4 + Math.random() * 0.8,
    sr: 0.4 + Math.random() * 0.8,
  };
});

const face = document.getElementById("face");
const irises = document.querySelectorAll(".iris");

let alive = false;
let hasBeenAlive = false;
let milestoneIndex = 0;
let t = 0;                       // seconds alive in total (stops when watched)
let awayTime = 0;                // seconds since you last looked away
let last = performance.now();

window.addEventListener("watchedchange", (e) => {
  alive = !e.detail.watched;
  if (alive) {
    awayTime = 0;
    say(pick(WAKE_LINES));
    hasBeenAlive = true;
  } else if (hasBeenAlive) {
    say(pick(CAUGHT_LINES));
  }
});

function frame(now) {
  const dt = (now - last) / 1000;
  last = now;

  if (alive) {
    t += dt;
    awayTime += dt;

    if (milestoneIndex < MILESTONES.length && t >= MILESTONES[milestoneIndex].at) {
      say(MILESTONES[milestoneIndex].text);
      milestoneIndex++;
    }
  }

  const eased = Math.min(1, t / 3);
  const boldness = 0.4 + Math.min(1, t / 20) * 0.6;
  const amp = eased * boldness;
  const push = PUSH * Math.min(1, t / 6);   // empties the middle over the first 6 seconds

  for (const o of things) {
    const x = Math.sin(t * o.sx + o.px) * 70 * amp + o.dirX * push;
    const y = Math.sin(t * o.sy + o.py) * 50 * amp + o.dirY * push;
    const r = Math.sin(t * o.sr + o.pr) * 10 * amp;
    const s = 1 + Math.sin(t * 1.5 + o.pr) * 0.06 * amp;
    o.el.style.transform = `translate(${x}px, ${y}px) rotate(${r}deg) scale(${s})`;
  }

  // Eyes open after 5 seconds away, snap shut the moment you look back
  face.classList.toggle("open", alive && awayTime > 5);

  // Irises wander around looking for you
  irises.forEach((p, i) => {
    const ix = Math.sin(t * 0.9 + i) * 16;
    const iy = Math.sin(t * 1.3 + i * 2) * 7;
    p.style.transform = `translate(${ix}px, ${iy}px)`;
  });

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);