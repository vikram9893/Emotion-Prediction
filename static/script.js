const $ = s => document.querySelector(s);
const EMO = {
  sadness:  {e:"😢", c:"#4f7cff"}, joy:      {e:"😄", c:"#ffc233"},
  love:     {e:"❤️", c:"#ff5c93"}, anger:    {e:"😠", c:"#ff4a36"},
  fear:     {e:"😨", c:"#9a6bff"}, surprise: {e:"😲", c:"#2fd9c0"}
};
const SAMPLES = [
  "I miss how things used to be.",
  "I just got the job offer, I'm over the moon!",
  "Being with you makes everything feel right.",
  "How dare they lie to my face again.",
  "Something is moving in the dark and I can't breathe.",
  "I never expected the whole room to stand up and cheer."
];
const input = $("#input"), btn = $("#go"), card = document.querySelector(".card");
let busy = false, history = [];

/* ---------- health ---------- */
fetch("/health").then(r => r.json()).then(d => {
  $("#dot").className = "dot " + (d.model_loaded ? "on" : "off");
  $("#statusText").textContent = d.model_loaded ? "Model ready" : "Model is still loading";
}).catch(() => { $("#dot").className = "dot off"; $("#statusText").textContent = "Server unreachable"; });

/* ---------- input ---------- */
const grow = () => { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 260) + "px"; $("#count").textContent = input.value.length; };
input.addEventListener("input", grow);
input.addEventListener("keydown", e => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) analyze(); });
btn.addEventListener("click", analyze);
SAMPLES.forEach(t => {
  const b = document.createElement("button");
  b.type = "button"; b.textContent = t;
  b.onclick = () => { input.value = t; grow(); analyze(); };
  $("#chips").append(b);
});

function toast(msg) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toast.id); toast.id = setTimeout(() => t.classList.remove("show"), 3800);
}

/* ---------- predict ---------- */
async function analyze() {
  const text = input.value.trim();
  if (!text) { card.classList.remove("shake"); void card.offsetWidth; card.classList.add("shake"); input.focus(); return; }
  if (busy) return;
  busy = true; btn.disabled = true; btn.classList.add("busy");
  try {
    const [res] = await Promise.all([
      fetch("/predict", {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify({text})}),
      new Promise(r => setTimeout(r, 450))
    ]);
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(typeof err.detail === "string" ? err.detail : "Something went wrong. Check your text and try again.");
    }
    show(await res.json());
  } catch (e) {
    toast(e.message === "Failed to fetch" ? "Can't reach the server. Check your connection." : e.message);
  } finally {
    busy = false; btn.disabled = false; btn.classList.remove("busy");
  }
}

/* ---------- render ---------- */
function show(d) {
  const emo = d.predicted_emotion, pct = d.confidence * 100;
  document.body.dataset.emotion = emo;
  FX.set(emo);

  const res = $("#result"); res.hidden = false;
  res.classList.remove("in"); void res.offsetWidth; res.classList.add("in");

  const em = $("#emoji"); em.textContent = EMO[emo].e;
  em.classList.remove("pop"); void em.offsetWidth; em.classList.add("pop");
  $("#label").textContent = emo;

  const arc = $("#arc");
  arc.style.transition = "none"; arc.style.strokeDashoffset = 339.3; void arc.getBoundingClientRect();
  arc.style.transition = ""; arc.style.strokeDashoffset = 339.3 * (1 - d.confidence);
  countUp($("#pct"), pct);

  const bars = $("#bars"); bars.innerHTML = "";
  Object.entries(d.all_probabilites).sort((a, b) => b[1] - a[1]).forEach(([k, v], i) => {
    const li = document.createElement("li");
    if (k === emo) li.className = "top";
    li.innerHTML = `<span>${EMO[k].e}</span><span style="text-transform:capitalize">${k}</span><span class="t"><span class="f"></span></span><span class="v">${(v * 100).toFixed(1)}%</span>`;
    bars.append(li);
    setTimeout(() => li.querySelector(".f").style.width = Math.max(v * 100, 1) + "%", 120 + i * 90);
  });

  const r = $(".ring").getBoundingClientRect();
  FX.burst(r.left + r.width / 2, r.top + r.height / 2);
  if (r.top < 0 || r.bottom > innerHeight) res.scrollIntoView({behavior: "smooth", block: "center"});

  history = [{text: d.text, emo}, ...history.filter(h => h.text !== d.text)].slice(0, 5);
  const ul = $("#hist"); ul.innerHTML = "";
  history.forEach(h => {
    const li = document.createElement("li"), b = document.createElement("button");
    b.type = "button";
    b.innerHTML = `<b>${EMO[h.emo].e}</b><span></span><em>${h.emo}</em>`;
    b.querySelector("span").textContent = h.text;
    b.onclick = () => { input.value = h.text; grow(); analyze(); };
    li.append(b); ul.append(li);
  });
  $("#history").hidden = false;
}

function countUp(el, to) {
  const t0 = performance.now();
  (function tick(t) {
    const p = Math.min((t - t0) / 1200, 1);
    el.textContent = (to * (1 - Math.pow(1 - p, 3))).toFixed(1);
    if (p < 1) requestAnimationFrame(tick);
  })(t0);
}

/* ---------- cursor light ---------- */
const spot = $("#spot"); let mx = innerWidth / 2, my = innerHeight / 3, sx = mx, sy = my;
addEventListener("pointermove", e => { mx = e.clientX; my = e.clientY; });
(function follow() { sx += (mx - sx) * .08; sy += (my - sy) * .08; spot.style.transform = `translate(${sx}px,${sy}px)`; requestAnimationFrame(follow); })();

/* ---------- emotion-driven particles ---------- */
const FX = (() => {
  const cv = $("#fx"), cx = cv.getContext("2d");
  const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  // vy: vertical drift, j: jitter, s: size
  const MODE = {
    neutral:  {vy:-.15, j:.05, s:1.4, c:"#9aa0ff"},
    sadness:  {vy: .7,  j:.05, s:1.6, c:EMO.sadness.c},
    joy:      {vy:-.9,  j:.25, s:2,   c:EMO.joy.c},
    love:     {vy:-.35, j:.2,  s:2.2, c:EMO.love.c},
    anger:    {vy:-.5,  j:1.4, s:1.4, c:EMO.anger.c},
    fear:     {vy: .05, j:.9,  s:1.2, c:EMO.fear.c},
    surprise: {vy:-.2,  j:.1,  s:1.8, c:EMO.surprise.c}
  };
  let W, H, mode = MODE.neutral, ps = [];
  const size = () => { const d = devicePixelRatio || 1; W = cv.width = innerWidth * d; H = cv.height = innerHeight * d; cx.setTransform(d, 0, 0, d, 0, 0); W = innerWidth; H = innerHeight; };
  addEventListener("resize", size); size();
  const mk = () => ({x: Math.random() * W, y: Math.random() * H, r: .5 + Math.random(), a: .15 + Math.random() * .5, vx: 0, vy: 0, life: 1, burst: false});
  for (let i = 0; i < 70; i++) ps.push(mk());

  function frame() {
    cx.clearRect(0, 0, W, H);
    for (let i = ps.length - 1; i >= 0; i--) {
      const p = ps[i];
      if (p.burst) {
        p.x += p.vx; p.y += p.vy; p.vx *= .955; p.vy *= .955; p.life -= .014;
        if (p.life <= 0) { ps.splice(i, 1); continue; }
      } else {
        p.x += (Math.random() - .5) * mode.j; p.y += mode.vy * (.4 + p.r);
        if (p.y > H + 10) p.y = -10; if (p.y < -10) p.y = H + 10;
        if (p.x > W + 10) p.x = -10; if (p.x < -10) p.x = W + 10;
      }
      cx.globalAlpha = p.a * (p.burst ? p.life : 1);
      cx.fillStyle = mode.c;
      cx.beginPath(); cx.arc(p.x, p.y, p.r * mode.s, 0, 6.283); cx.fill();
    }
    requestAnimationFrame(frame);
  }
  if (!still) frame();
  return {
    set: k => { mode = MODE[k] || MODE.neutral; },
    burst: (x, y) => {
      if (still) return;
      for (let i = 0; i < 38; i++) {
        const a = Math.random() * 6.283, v = 2 + Math.random() * 5;
        ps.push({x, y, r: 1 + Math.random() * 1.6, a: .9, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 1, burst: true});
      }
    }
  };
})();
grow();
