// effects.js: little visual effects.
// burst() pops short random lines outward from a point (like the drawing).

const layer = document.createElement("div");
layer.style.cssText =
  "position:fixed;inset:0;pointer-events:none;z-index:20;overflow:hidden";
document.body.appendChild(layer);

export function burst(x, y, { count = 12, near = 14, far = 70, color = "#111" } = {}) {
  for (let i = 0; i < count; i++) {
    // Spread the lines around a circle, with some randomness
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const deg = (angle * 180) / Math.PI;
    const len = 12 + Math.random() * 22;
    const start = near + Math.random() * 8;
    const end = start + far * (0.5 + Math.random() * 0.5);

    const line = document.createElement("div");
    line.style.cssText =
      `position:absolute;left:${x}px;top:${y}px;width:${len}px;height:4px;` +
      `border-radius:2px;background:${color};transform-origin:0 50%;`;
    layer.appendChild(line);

    const anim = line.animate(
      [
        { transform: `rotate(${deg}deg) translateX(${start}px) scaleX(0.3)`, opacity: 1 },
        { transform: `rotate(${deg}deg) translateX(${end}px) scaleX(1)`, opacity: 0 },
      ],
      { duration: 350 + Math.random() * 250, easing: "cubic-bezier(.2,.8,.3,1)", fill: "forwards" }
    );
    anim.onfinish = () => line.remove();   // clean up when the animation ends
  }
}