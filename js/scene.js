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

// ---- Everything that moves is driven by one clock that only runs while alive ----
const things = [...document.querySelectorAll(
  "#headline, #sub, #cta, .card, .logo, .nav a"
)].map((el) => ({
  el,
  px: Math.random() * 6.28, py: Math.random() * 6.28, pr: Math.random() * 6.28,
  sx: 0.4 + Math.random() * 0.8,
  sy: 0.4 + Math.random() * 0.8,
  sr: 0.4 + Math.random() * 0.8,
}));

let alive = false;
let hasBeenAlive = false;
let milestoneIndex = 0;
let t = 0;                       // seconds the page has been alive in total
let last = performance.now();

window.addEventListener("watchedchange", (e) => {
  alive = !e.detail.watched;
  if (alive) {
    say(pick(WAKE_LINES));
    hasBeenAlive = true;
  } else if (hasBeenAlive) {
    say(pick(CAUGHT_LINES));     // caught moving: it makes an excuse
  }
});

function frame(now) {
  const dt = (now - last) / 1000;
  last = now;

  if (alive) {
    t += dt;                     // when watched, the clock stops and the pose freezes

    if (milestoneIndex < MILESTONES.length && t >= MILESTONES[milestoneIndex].at) {
      say(MILESTONES[milestoneIndex].text);
      milestoneIndex++;
    }
  }

  const eased = Math.min(1, t / 3);
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