(function () {
  "use strict";

  var TAU = Math.PI * 2;

  var T = {
    particles: 600,
    namesIn: 1500,
    namesStep: 110,
    namesDur: 1300,
    morph: 4100,
    morphStep: 85,
    morphDur: 2600,
    braid: 5700,
    braidDur: 3300,
    ring: 6200,
    ringStep: 450,
    ringDur: 2600,
    dust: 7600,
    sweep: 10900,
    sweepDur: 1900,
    beat: 12900,
    caption: 13000,
    cycle: 3400
  };

  var STYLES = {
    herBraid: { fill: "#ff667d", glow: "rgba(236,36,70,.95)", gb: 0.85 },
    meBraid: { fill: "#ffb3bf", glow: "rgba(255,84,114,.9)", gb: 0.85 },
    r1: { fill: "#e6334f", glow: "rgba(200,20,50,.9)", gb: 0.7 },
    r2: { fill: "#c71c38", glow: "rgba(170,14,38,.85)", gb: 0.6 },
    r3: { fill: "#a5142c", glow: "rgba(140,10,30,.8)", gb: 0.5 },
    r4: { fill: "#850e20", glow: "rgba(120,8,24,.8)", gb: 0.5 },
    gold: { fill: "#f7d994", glow: "rgba(240,190,96,.9)", gb: 0.8 },
    hot: { fill: "#fff2f4", glow: "rgba(255,110,140,1)", gb: 1.1 },
    name: { grad: ["#fffafa", "#ff9fb0"], glow: "rgba(255,52,92,.95)", gb: 0.42 }
  };

  var RINGS = [
    { id: "her", k: 1, f: 1, kind: "her", style: "herBraid", braid: 1, amax: 1, order: -1 },
    { id: "me", k: 1, f: 1, kind: "me", style: "meBraid", braid: -1, amax: 1, order: -1 },
    { id: "r1", k: 0.79, f: 0.95, kind: "mix", style: "r1", braid: 0, amax: 0.9, order: 0, skip: true },
    { id: "r2", k: 0.6, f: 0.86, kind: "frag", style: "r2", braid: 0, amax: 0.62, order: 1 },
    { id: "r3", k: 0.41, f: 0.8, kind: "frag", style: "r3", braid: 0, amax: 0.5, order: 2 },
    { id: "r4", k: 0.22, f: 0.75, kind: "frag", style: "r4", braid: 0, amax: 0.4, order: 3 }
  ];

  var canvas = null;
  var ctx = null;
  var slot = null;
  var run = null;
  var raf = 0;
  var spriteCache = {};
  var emCache = {};
  var fontCache = "";
  var SP = null;
  var mctx = null;

  var BASE = (function () {
    var n = 960;
    var xs = new Float32Array(n + 1);
    var ys = new Float32Array(n + 1);
    var cum = new Float32Array(n + 1);
    var minY = Infinity;
    var maxY = -Infinity;
    var i, t, s;
    for (i = 0; i <= n; i++) {
      t = (i / n) * TAU;
      s = Math.sin(t);
      xs[i] = 16 * s * s * s;
      ys[i] = -(13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t));
      if (ys[i] < minY) minY = ys[i];
      if (ys[i] > maxY) maxY = ys[i];
    }
    var yc = (minY + maxY) / 2;
    for (i = 0; i <= n; i++) ys[i] -= yc;
    for (i = 1; i <= n; i++) {
      cum[i] = cum[i - 1] + Math.sqrt(Math.pow(xs[i] - xs[i - 1], 2) + Math.pow(ys[i] - ys[i - 1], 2));
    }
    return { n: n, xs: xs, ys: ys, cum: cum, total: cum[n], H: maxY - minY };
  })();

  function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }
  function ease01(x) { x = clamp(x, 0, 1); return 1 - Math.pow(1 - x, 3); }
  function easeIO(x) { x = clamp(x, 0, 1); return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }
  function ramp(t, t0, d) { return clamp((t - t0) / d, 0, 1); }
  function gauss(x, c, w) { var d = (x - c) / w; return Math.exp(-d * d); }
  function sOfT(t) { return BASE.cum[Math.round((t / TAU) * BASE.n)] / BASE.total; }

  function mulberry(seed) {
    return function () {
      seed |= 0;
      seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hashStr(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function fontStack() {
    if (fontCache) return fontCache;
    var v = "";
    try { v = window.getComputedStyle(document.documentElement).getPropertyValue("--font-display"); } catch (e) { v = ""; }
    fontCache = (v && v.trim()) || 'Georgia, "Times New Roman", serif';
    return fontCache;
  }

  function em(ch) {
    if (emCache[ch] === undefined) {
      if (!mctx) mctx = document.createElement("canvas").getContext("2d");
      mctx.font = "italic 400 100px " + fontStack();
      emCache[ch] = mctx.measureText(ch).width / 100;
    }
    return emCache[ch];
  }

  function pathAt(sf, k, off, u, out) {
    sf -= Math.floor(sf);
    var B = BASE;
    var n = B.n;
    var target = sf * B.total;
    var lo = 0;
    var hi = n;
    var mid;
    while (hi - lo > 1) {
      mid = (lo + hi) >> 1;
      if (B.cum[mid] <= target) lo = mid; else hi = mid;
    }
    var span = B.cum[lo + 1] - B.cum[lo];
    var f = span > 0 ? (target - B.cum[lo]) / span : 0;
    var x = B.xs[lo] + (B.xs[lo + 1] - B.xs[lo]) * f;
    var y = B.ys[lo] + (B.ys[lo + 1] - B.ys[lo]) * f;
    var a = (lo + 4) % n;
    var b = (lo - 3 + n) % n;
    var tx = B.xs[a] - B.xs[b];
    var ty = B.ys[a] - B.ys[b];
    var l = Math.sqrt(tx * tx + ty * ty) || 1;
    tx /= l;
    ty /= l;
    out.x = x * k * u + ty * off;
    out.y = y * k * u - tx * off;
    out.tx = tx;
    out.ty = ty;
    return out;
  }

  function glyph(ch, px, style, dpr) {
    var key = ch + "|" + style + "|" + px + "|" + dpr;
    var hit = spriteCache[key];
    if (hit) return hit;
    var st = STYLES[style];
    var adv = em(ch) * px;
    var pad = Math.ceil(px * st.gb + 3);
    var w = Math.ceil(adv + pad * 2);
    var h = Math.ceil(px * 1.45 + pad * 2);
    var c = document.createElement("canvas");
    c.width = Math.ceil(w * dpr);
    c.height = Math.ceil(h * dpr);
    var g = c.getContext("2d");
    g.scale(dpr, dpr);
    g.font = "italic 400 " + px + "px " + fontStack();
    g.textAlign = "center";
    g.textBaseline = "alphabetic";
    var bx = w / 2;
    var by = pad + px * 1.05;
    var fill = st.fill;
    if (st.grad) {
      fill = g.createLinearGradient(0, by - px * 0.85, 0, by + px * 0.1);
      fill.addColorStop(0, st.grad[0]);
      fill.addColorStop(1, st.grad[1]);
    }
    g.fillStyle = fill;
    g.shadowColor = st.glow;
    g.shadowBlur = px * st.gb * dpr;
    g.fillText(ch, bx, by);
    g.shadowBlur = px * st.gb * 0.4 * dpr;
    g.fillText(ch, bx, by);
    g.shadowBlur = 0;
    g.fillText(ch, bx, by);
    hit = { c: c, w: w, h: h, bx: bx, by: by, px: px };
    spriteCache[key] = hit;
    return hit;
  }

  function radial(size, stops) {
    var c = document.createElement("canvas");
    c.width = c.height = size;
    var g = c.getContext("2d");
    var grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (var i = 0; i < stops.length; i++) grd.addColorStop(stops[i][0], stops[i][1]);
    g.fillStyle = grd;
    g.fillRect(0, 0, size, size);
    return c;
  }

  function petalSprite(soft) {
    var c = document.createElement("canvas");
    c.width = c.height = 64;
    var g = c.getContext("2d");
    var path = new Path2D("M32 5C47 9 57 26 53 42C49 56 39 61 32 59C25 61 15 56 11 42C7 26 17 9 32 5Z");
    if (soft) {
      g.shadowColor = "rgba(210,28,58,.9)";
      g.shadowBlur = 11;
      g.shadowOffsetX = 300;
      g.translate(-300, 0);
      g.fillStyle = "#c8102e";
      g.fill(path);
      g.fill(path);
      return c;
    }
    var grd = g.createLinearGradient(10, 60, 50, 6);
    grd.addColorStop(0, "#5d0813");
    grd.addColorStop(0.55, "#b8152d");
    grd.addColorStop(1, "#ee4a63");
    g.fillStyle = grd;
    g.fill(path);
    g.strokeStyle = "rgba(255,180,190,.22)";
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(32, 56);
    g.quadraticCurveTo(30, 34, 34, 12);
    g.stroke();
    return c;
  }

  function starSprite() {
    var c = document.createElement("canvas");
    c.width = c.height = 64;
    var g = c.getContext("2d");
    var grd = g.createRadialGradient(32, 32, 0, 32, 32, 22);
    grd.addColorStop(0, "rgba(255,232,176,.8)");
    grd.addColorStop(1, "rgba(240,190,96,0)");
    g.fillStyle = grd;
    g.fillRect(0, 0, 64, 64);
    g.fillStyle = "rgba(255,238,196,.95)";
    g.beginPath();
    g.moveTo(32, 3);
    g.quadraticCurveTo(34, 30, 61, 32);
    g.quadraticCurveTo(34, 34, 32, 61);
    g.quadraticCurveTo(30, 34, 3, 32);
    g.quadraticCurveTo(30, 30, 32, 3);
    g.fill();
    return c;
  }

  function makeSprites() {
    return {
      spark: radial(64, [[0, "rgba(255,225,230,1)"], [0.18, "rgba(255,110,135,.85)"], [0.5, "rgba(200,20,50,.28)"], [1, "rgba(160,10,34,0)"]]),
      dust: radial(32, [[0, "rgba(255,170,182,1)"], [0.3, "rgba(230,57,80,.7)"], [1, "rgba(160,12,34,0)"]]),
      bokeh: radial(96, [[0, "rgba(190,20,48,.34)"], [0.78, "rgba(190,20,48,.26)"], [0.93, "rgba(255,110,130,.45)"], [1, "rgba(255,110,130,0)"]]),
      comet: radial(128, [[0, "rgba(255,246,247,1)"], [0.12, "rgba(255,140,160,.9)"], [0.4, "rgba(230,40,72,.34)"], [1, "rgba(200,20,50,0)"]]),
      star: starSprite(),
      petal: petalSprite(false),
      petalSoft: petalSprite(true)
    };
  }

  function sizeCanvas() {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, vw < 700 ? 2 : 1.5);
    run.dpr = dpr;
    run.vw = vw;
    run.vh = vh;
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    run.layer = null;
    run.glowLayer = null;
    spriteCache = {};
    run.Wh = 0;
    seedParticles();
  }

  function seedParticles() {
    var vw = run.vw;
    var vh = run.vh;
    var small = vw < 700;
    var rnd = Math.random;
    var i;
    run.parts = [];
    for (i = 0; i < (small ? 34 : 56); i++) {
      run.parts.push({ x: rnd() * vw, y: rnd() * vh, r: 1.2 + rnd() * 3, vy: 0.01 + rnd() * 0.028, amp: 6 + rnd() * 26, ph: rnd() * TAU, sp: 0.0003 + rnd() * 0.0006, a: 0.25 + rnd() * 0.5 });
    }
    run.bokeh = [];
    for (i = 0; i < (small ? 7 : 11); i++) {
      run.bokeh.push({ x: rnd() * vw, y: rnd() * vh, r: 14 + rnd() * 40, vy: 0.004 + rnd() * 0.01, a: 0.06 + rnd() * 0.1, ph: rnd() * TAU, near: rnd() < 0.4 });
    }
    run.petals = [];
    for (i = 0; i < (small ? 9 : 14); i++) {
      var z = 0.45 + rnd() * 0.9;
      run.petals.push({ x: rnd() * vw, y: rnd() * vh, z: z, rot: rnd() * TAU, vr: (0.0003 + rnd() * 0.0006) * (rnd() < 0.5 ? -1 : 1), ph: rnd() * TAU, sw: 18 + rnd() * 46, vy: 0.012 + rnd() * 0.016, near: z > 1.0 });
    }
  }

  function makeStream(kind, her, me, rng, n) {
    function frag(w) {
      var L = w.length;
      if (L <= 2) return w;
      var len = 2 + Math.floor(rng() * Math.min(3, L - 1));
      var st = Math.floor(rng() * (L - len + 1));
      return w.substr(st, len);
    }
    var out = "";
    while (out.length < n) {
      if (kind === "her") out += her + " · ";
      else if (kind === "me") out += me + " · ";
      else if (kind === "mix") out += her + " · " + me + " · " + frag(her) + " · " + frag(me) + " · ";
      else out += (rng() < 0.5 ? frag(her) : frag(me)) + (rng() < 0.3 ? " · " : " ");
    }
    return out;
  }

  function layoutName(word, side, g) {
    var chars = word.split("");
    var advs = [];
    var total = 0;
    var i;
    for (i = 0; i < chars.length; i++) {
      advs.push(em(chars[i]) + 0.035);
      total += advs[i];
    }
    total -= 0.035;
    var perim = BASE.total * g.u * 0.79;
    var tries = [[0.3, 1.62], [0.3, 2.05], [0.3, 2.5]];
    var fsMax = g.Wh * 0.085;
    var fsMin = g.Wh * 0.05;
    var best = null;
    for (i = 0; i < tries.length; i++) {
      var s0 = sOfT(tries[i][0]);
      var s1 = sOfT(tries[i][1]);
      var L = (s1 - s0) * perim;
      best = { s0: s0, s1: s1, L: L, fs: Math.min(fsMax, (L * 0.94) / total) };
      if (best.fs >= fsMin) break;
    }
    var fs = best.fs;
    var len = total * fs;
    var start = (best.L - len) / 2;
    var arcStart = side === "right" ? best.s0 : 1 - best.s1;
    var pad = g.tiny * 1.4;
    var tmp = {};
    var d = start;
    var list = [];
    for (i = 0; i < chars.length; i++) {
      var w = advs[i] * fs;
      if (chars[i] !== " ") {
        var center = d + (em(chars[i]) * fs) / 2;
        pathAt(arcStart + center / perim, 0.79, 0, g.u, tmp);
        list.push({ ch: chars[i], idx: i, ex: tmp.x, ey: tmp.y, ea: Math.atan2(tmp.ty, tmp.tx), off: d + (em(chars[i]) * fs) / 2 });
      }
      d += w;
    }
    return {
      word: word,
      list: list,
      fs: fs,
      total: total,
      zone: [arcStart + (start - pad) / perim, arcStart + (start + len + pad) / perim]
    };
  }

  function inZone(s, zones) {
    for (var i = 0; i < zones.length; i++) {
      if (s >= zones[i][0] && s <= zones[i][1]) return true;
    }
    return false;
  }

  function build() {
    var rect = slot.getBoundingClientRect();
    var Wh = Math.max(150, rect.width * 0.9);
    var u = Wh / 32;
    var dpr = run.dpr;
    var g = { Wh: Wh, u: u, Hh: BASE.H * u, tiny: clamp(Wh * 0.027, 7.5, 17) };
    run.Wh = Wh;
    run.u = u;
    run.Hh = g.Hh;
    run.tiny = g.tiny;
    run.layer = null;
    run.glowLayer = null;

    var her = run.cfg.her;
    var me = run.cfg.me;
    var rng = mulberry(hashStr(her + "|" + me));
    var tmp = {};
    var i, j;

    var nA = layoutName(her, "left", g);
    var nB = layoutName(me, "right", g);
    var fsEnd = Math.max(nA.fs, nB.fs);
    var fsS = clamp((Wh * 0.8) / Math.max(nA.total, nB.total), fsEnd * 1.1, Wh * 0.14);
    var spx = Math.max(6, Math.round(fsS));
    var names = [];
    [nA, nB].forEach(function (nm, ni) {
      var wS = nm.total * fsS;
      var yS = (ni === 0 ? -1 : 1) * fsS * 0.62;
      var mx = 0;
      var my = 0;
      for (j = 0; j < nm.list.length; j++) { mx += nm.list[j].ex; my += nm.list[j].ey; }
      mx /= nm.list.length || 1;
      my /= nm.list.length || 1;
      var wx = mx;
      var wy = my - yS;
      var wl = Math.sqrt(wx * wx + wy * wy) || 1;
      var step = Math.min(T.morphStep * 1.6, 1100 / (nm.list.length || 1));
      for (j = 0; j < nm.list.length; j++) {
        var L = nm.list[j];
        var accum = 0;
        for (var q = 0; q < L.idx; q++) accum += em(nm.word.charAt(q)) + 0.035;
        var sx = -wS / 2 + (accum + em(L.ch) / 2) * fsS;
        var da = L.ea;
        while (da > Math.PI) da -= TAU;
        while (da < -Math.PI) da += TAU;
        names.push({
          sp: glyph(L.ch, spx, "name", dpr),
          sx: sx, sy: yS, ex: L.ex, ey: L.ey, da: da,
          nx: -wy / wl, ny: wx / wl,
          fsS: fsS, fsE: nm.fs,
          amp: (ni === 0 ? 1 : -1) * Wh * 0.11,
          tIn: T.namesIn + j * T.namesStep + ni * T.namesStep * 0.5,
          tMove: T.morph + j * step + ni * 120,
          ph: rng() * TAU
        });
      }
    });
    run.names = names;

    var zones = [nA.zone, nB.zone];
    var letters = [];
    var hot = [];
    var maxT0 = 0;
    var braidW = g.tiny * 0.95;

    RINGS.forEach(function (def, ri) {
      var fs = Math.max(6, g.tiny * def.f);
      var px = Math.round(fs);
      var perim = BASE.total * u * def.k;
      var text = makeStream(def.kind, her, me, rng, Math.ceil(perim / (fs * 0.28)) + 30);
      var track = fs * 0.12;
      var items = [];
      var d = 0;
      var ch, a;
      for (i = 0; i < text.length && d < perim; i++) {
        ch = text.charAt(i);
        a = em(ch) * fs;
        if (ch === " ") { d += a * 0.9 + track; continue; }
        items.push({ ch: ch, d: d + a / 2 });
        d += a + track;
      }
      var f = perim / d;
      var t0 = def.order < 0 ? T.braid : T.ring + def.order * T.ringStep;
      var dur = def.order < 0 ? T.braidDur : T.ringDur;
      for (i = 0; i < items.length; i++) {
        var s = 0.5 + (items[i].d * f) / perim;
        s -= Math.floor(s);
        if (def.skip && inZone(s, zones)) continue;
        var off = def.braid ? def.braid * braidW * Math.sin(TAU * 6 * s) : 0;
        pathAt(s, def.k, off, u, tmp);
        var p = Math.abs(s - 0.5) * 2;
        var style = def.style;
        if (def.order <= 0 && rng() < 0.055) style = "gold";
        var L = {
          sp: glyph(items[i].ch, px, style, dpr),
          hot: null,
          ch: items[i].ch,
          px: px,
          x: tmp.x, y: tmp.y,
          a: Math.atan2(tmp.ty, tmp.tx),
          s: s,
          t0: t0 + p * dur + rng() * 160,
          amax: def.amax,
          ring: ri
        };
        if (L.t0 > maxT0) maxT0 = L.t0;
        letters.push(L);
        if (def.order <= 0) hot.push(L);
      }
    });
    run.letters = letters;
    run.hot = hot;
    run.doneAt = maxT0 + 900;

    run.ribbons = [];
    for (i = 0; i < 2; i++) {
      var pts = [];
      var sgn = i === 0 ? 1 : -1;
      var M = 240;
      for (j = 0; j <= M; j++) {
        var ss = 0.5 + j / M;
        pathAt(ss, 1, sgn * braidW * Math.sin(TAU * 6 * ss), u, tmp);
        pts.push({ x: tmp.x, y: tmp.y });
      }
      run.ribbons.push({ pts: pts, color: i === 0 ? "rgba(255,102,125," : "rgba(255,179,191," });
    }

    run.dust = [];
    var want = run.vw < 700 ? 46 : 78;
    var tries = 0;
    while (run.dust.length < want && tries < 4000) {
      tries++;
      var px2 = (rng() * 2 - 1) * 14;
      var py2 = (rng() * 2 - 1) * (BASE.H / 2) * 0.92;
      if (insideHeart(px2 / 0.88, py2 / 0.88)) {
        run.dust.push({ x: px2 * u, y: py2 * u, r: 2 + rng() * 4.5, ph: rng() * TAU, sp: 0.0006 + rng() * 0.0012, a: 0.15 + rng() * 0.4, dx: 2 + rng() * 5 });
      }
    }

    run.sparks = [];
    for (i = 0; i < (run.vw < 700 ? 16 : 26); i++) {
      var sk = rng() < 0.7 ? 1 : 0.79;
      pathAt(rng(), sk, (rng() * 2 - 1) * g.tiny * 1.4, u, tmp);
      run.sparks.push({ x: tmp.x, y: tmp.y, r: g.tiny * (0.9 + rng() * 1.3), ph: rng() * TAU, sp: 0.0005 + rng() * 0.0008, t0: 7000 + rng() * 5000 });
    }
  }

  function insideHeart(x, y) {
    var inside = false;
    var xs = BASE.xs;
    var ys = BASE.ys;
    for (var i = 0, j = BASE.n - 1; i < BASE.n; j = i++) {
      if ((ys[i] > y) !== (ys[j] > y) && x < ((xs[j] - xs[i]) * (y - ys[i])) / (ys[j] - ys[i]) + xs[i]) inside = !inside;
    }
    return inside;
  }

  function heartPath(g, k, u) {
    g.beginPath();
    for (var i = 0; i <= BASE.n; i += 4) {
      var x = BASE.xs[i] * k * u;
      var y = BASE.ys[i] * k * u;
      if (i === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.closePath();
  }

  function buildGlow() {
    var dpr = run.dpr;
    var Wh = run.Wh;
    var w = Wh * 1.7;
    var h = run.Hh * 1.7;
    var c = document.createElement("canvas");
    c.width = Math.ceil(w * dpr);
    c.height = Math.ceil(h * dpr);
    var g = c.getContext("2d");
    g.translate((w * dpr) / 2, (h * dpr) / 2);
    g.scale(dpr, dpr);
    heartPath(g, 0.9, run.u);
    g.shadowColor = "rgba(235,40,75,.9)";
    g.shadowBlur = Wh * 0.16 * dpr;
    g.fillStyle = "rgba(120,8,30,.55)";
    g.fill();
    g.shadowBlur = Wh * 0.05 * dpr;
    g.fillStyle = "rgba(60,3,14,.55)";
    g.fill();
    run.glowLayer = { c: c, w: w, h: h };
  }

  function put(sp, x, y, ang, sc, alpha, B, E, F) {
    var c = Math.cos(ang) * sc * B;
    var s = Math.sin(ang) * sc * B;
    ctx.globalAlpha = alpha;
    ctx.setTransform(c, s, -s, c, B * x + E, B * y + F);
    ctx.drawImage(sp.c, -sp.bx, -sp.by + sp.px * 0.34, sp.w, sp.h);
  }

  function blob(img, x, y, r, alpha, B, E, F) {
    ctx.globalAlpha = alpha;
    ctx.setTransform(B, 0, 0, B, E, F);
    ctx.drawImage(img, x - r, y - r, r * 2, r * 2);
  }

  function drawRibbons(B, E, F, t) {
    var q = ramp(t, T.braid, T.braidDur);
    if (q <= 0) return;
    var e = easeIO(q);
    ctx.setTransform(B, 0, 0, B, E, F);
    ctx.lineWidth = 1;
    ctx.lineJoin = "round";
    for (var r = 0; r < run.ribbons.length; r++) {
      var rb = run.ribbons[r];
      var pts = rb.pts;
      var M = pts.length - 1;
      var half = Math.floor((M / 2) * e);
      ctx.strokeStyle = rb.color + ".38)";
      ctx.globalAlpha = 1;
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (var i = 1; i <= half; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.moveTo(pts[M].x, pts[M].y);
      for (var k = M - 1; k >= M - half; k--) ctx.lineTo(pts[k].x, pts[k].y);
      ctx.stroke();
    }
  }

  function drawLettersLive(t, B, E, F) {
    var L = run.letters;
    for (var i = 0; i < L.length; i++) {
      var l = L[i];
      var el = t - l.t0;
      if (el <= 0) continue;
      var q = Math.min(el / 800, 1);
      var e = ease01(q);
      put(l.sp, l.x, l.y - (1 - e) * 3, l.a, 0.6 + 0.4 * e, l.amax * e, B, E, F);
      if (q < 1) {
        if (!l.hot) l.hot = glyph(l.ch, l.px, "hot", run.dpr);
        ctx.globalCompositeOperation = "lighter";
        put(l.hot, l.x, l.y - (1 - e) * 3, l.a, 0.6 + 0.4 * e, (1 - q) * 0.7, B, E, F);
        ctx.globalCompositeOperation = "source-over";
      }
    }
  }

  function buildLayer() {
    var dpr = run.dpr;
    var m = run.Wh * 0.06;
    var lx = run.Wh / 2 + m;
    var ly = run.Hh / 2 + m;
    var c = document.createElement("canvas");
    c.width = Math.ceil(lx * 2 * dpr);
    c.height = Math.ceil(ly * 2 * dpr);
    var main = ctx;
    var lc = c.getContext("2d");
    ctx = lc;
    drawRibbons(dpr, lx * dpr, ly * dpr, 1e9);
    var L = run.letters;
    for (var i = 0; i < L.length; i++) {
      put(L[i].sp, L[i].x, L[i].y, L[i].a, 1, L[i].amax, dpr, lx * dpr, ly * dpr);
    }
    ctx = main;
    run.layer = { c: c, lx: lx, ly: ly };
  }

  function namePos(n, t, out) {
    var m = (t - n.tMove) / T.morphDur;
    if (m <= 0) {
      out.x = n.sx;
      out.y = n.sy + Math.sin(t * 0.0014 + n.ph) * 1.6;
      out.a = 0;
      out.s = n.fsS;
      return out;
    }
    m = Math.min(m, 1);
    var e = easeIO(m);
    var sw = Math.sin(TAU * e) * n.amp * (1 - e * 0.35);
    out.x = n.sx + (n.ex - n.sx) * e + n.nx * sw;
    out.y = n.sy + (n.ey - n.sy) * e + n.ny * sw;
    out.a = n.da * e;
    out.s = n.fsS + (n.fsE - n.fsS) * e;
    return out;
  }

  function drawNames(t, B, E, F) {
    var pos = {};
    var tp = {};
    var N = run.names;
    var i, lag;
    var lags = [70, 140, 220, 320, 440];
    for (i = 0; i < N.length; i++) {
      var n = N[i];
      var tin = t - n.tIn;
      if (tin <= 0) continue;
      var alpha = ease01(tin / 1300);
      namePos(n, t, pos);
      var mv = (t - n.tMove) / T.morphDur;
      if (mv > 0 && mv < 1.15) {
        ctx.globalCompositeOperation = "lighter";
        for (lag = 0; lag < lags.length; lag++) {
          var tt = t - lags[lag];
          if (tt < n.tMove) continue;
          namePos(n, tt, tp);
          blob(SP.spark, tp.x, tp.y, run.Wh * (0.026 - lag * 0.0034), alpha * (0.42 - lag * 0.07) * Math.min(1, (1.15 - mv) * 4), B, E, F);
        }
        ctx.globalCompositeOperation = "source-over";
      }
      put(n.sp, pos.x, pos.y, pos.a, pos.s / n.sp.px, alpha, B, E, F);
    }
  }

  function beatState(t) {
    var out = { b: 0, g: 0, lt: -1, idx: -1 };
    var tb = t - T.beat;
    if (tb < 0) return out;
    var idx = Math.floor(tb / T.cycle);
    var lt = tb - idx * T.cycle;
    var amp = idx === 0 ? 1 : 0.55;
    out.b = amp * (0.05 * gauss(lt, 130, 110) + 0.032 * gauss(lt, 370, 120));
    out.g = amp * (0.9 * gauss(lt, 160, 260) + 0.6 * gauss(lt, 390, 260));
    out.lt = lt;
    out.idx = idx;
    return out;
  }

  function sweepState(t) {
    var s0 = t - T.sweep;
    if (s0 >= 0 && s0 <= T.sweepDur) return { head: 0.5 + easeIO(s0 / T.sweepDur), k: 1, p: s0 / T.sweepDur };
    var rep = t - (T.sweep + 9000);
    if (rep >= 0) {
      var c = Math.floor(rep / 9000);
      var lt = rep - c * 9000;
      if (lt <= 2300) return { head: 0.5 + easeIO(lt / 2300), k: 0.5, p: lt / 2300 };
    }
    return null;
  }

  function updateParticles(dt) {
    var vw = run.vw;
    var vh = run.vh;
    var i, p;
    for (i = 0; i < run.parts.length; i++) {
      p = run.parts[i];
      p.y -= p.vy * dt;
      if (p.y < -20) { p.y = vh + 20; p.x = Math.random() * vw; }
    }
    for (i = 0; i < run.bokeh.length; i++) {
      p = run.bokeh[i];
      p.y -= p.vy * dt;
      if (p.y < -60) { p.y = vh + 60; p.x = Math.random() * vw; }
    }
    for (i = 0; i < run.petals.length; i++) {
      p = run.petals[i];
      p.y += p.vy * dt * p.z;
      p.rot += p.vr * dt;
      if (p.y > vh + 30) { p.y = -30; p.x = Math.random() * vw; }
    }
  }

  function drawParticles(t, dpr, nearPass) {
    var i, p;
    var a0 = ramp(t, T.particles, 2200);
    if (a0 <= 0) return;
    ctx.globalCompositeOperation = "lighter";
    if (!nearPass) {
      for (i = 0; i < run.parts.length; i++) {
        p = run.parts[i];
        var fl = 0.55 + 0.45 * Math.sin(t * 0.0011 + p.ph);
        blob(SP.dust, p.x + Math.sin(t * p.sp + p.ph) * p.amp, p.y, p.r * 2.2, p.a * fl * a0, dpr, 0, 0);
      }
    }
    for (i = 0; i < run.bokeh.length; i++) {
      p = run.bokeh[i];
      if (p.near !== nearPass) continue;
      blob(SP.bokeh, p.x + Math.sin(t * 0.0002 + p.ph) * 18, p.y, p.r, p.a * a0 * (0.7 + 0.3 * Math.sin(t * 0.0007 + p.ph)), dpr, 0, 0);
    }
    ctx.globalCompositeOperation = "source-over";
    var a1 = ramp(t, T.particles + 1200, 2600);
    if (a1 <= 0) return;
    for (i = 0; i < run.petals.length; i++) {
      p = run.petals[i];
      if (p.near !== nearPass) continue;
      var sz = 17 * p.z;
      var fx = 0.3 + 0.7 * Math.abs(Math.cos(p.ph + t * 0.0006));
      var cr = Math.cos(p.rot);
      var sr = Math.sin(p.rot);
      var x = p.x + Math.sin(t * 0.0004 + p.ph) * p.sw;
      ctx.globalAlpha = (nearPass ? 0.5 : 0.78) * a1 * Math.min(1, p.z + 0.2);
      ctx.setTransform(cr * fx * dpr, sr * fx * dpr, -sr * dpr, cr * dpr, x * dpr, p.y * dpr);
      var img = nearPass ? SP.petalSoft : SP.petal;
      var s2 = nearPass ? sz * 2.1 : sz;
      ctx.drawImage(img, -s2 / 2, -s2 / 2, s2, s2);
    }
  }

  function render(t, dt) {
    if (window.innerWidth !== run.vw || window.innerHeight !== run.vh) sizeCanvas();
    var rect = slot.getBoundingClientRect();
    if (!run.Wh || Math.abs(rect.width * 0.9 - run.Wh) > 1.5) build();
    var dpr = run.dpr;
    var cx = rect.left + rect.width / 2;
    var cy = rect.top + rect.height / 2;

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    updateParticles(dt);

    var bs = beatState(t);
    var beat = 1 + bs.b;
    var B = dpr * beat;
    var E = dpr * cx;
    var F = dpr * cy;

    drawParticles(t, dpr, false);

    var growth = ramp(t, T.braid, 5200);
    var ga = growth * (0.58 + 0.08 * Math.sin(t * 0.0012)) + bs.g * 0.35;
    if (ga > 0.01) {
      if (!run.glowLayer) buildGlow();
      var gl = run.glowLayer;
      ctx.globalCompositeOperation = "lighter";
      ctx.globalAlpha = clamp(ga, 0, 1);
      ctx.setTransform(B, 0, 0, B, E, F);
      ctx.drawImage(gl.c, -gl.w / 2, -gl.h / 2, gl.w, gl.h);
      ctx.globalCompositeOperation = "source-over";
    }

    var du = ramp(t, T.dust, 2600);
    if (du > 0) {
      ctx.globalCompositeOperation = "lighter";
      for (var i = 0; i < run.dust.length; i++) {
        var d = run.dust[i];
        var tw = 0.5 + 0.5 * Math.sin(t * d.sp + d.ph);
        blob(SP.dust, d.x + Math.sin(t * 0.0003 + d.ph) * d.dx, d.y + Math.cos(t * 0.00025 + d.ph) * d.dx, d.r, d.a * tw * du, B, E, F);
      }
      ctx.globalCompositeOperation = "source-over";
    }

    if (t >= run.doneAt) {
      if (!run.layer) buildLayer();
      var ly = run.layer;
      ctx.globalAlpha = 1;
      ctx.setTransform(B, 0, 0, B, E, F);
      ctx.drawImage(ly.c, -ly.lx, -ly.ly, ly.lx * 2, ly.ly * 2);
    } else {
      drawRibbons(B, E, F, t);
      drawLettersLive(t, B, E, F);
    }

    drawNames(t, B, E, F);

    var sw = sweepState(t);
    if (sw) {
      var fade = Math.sin(Math.PI * clamp(sw.p, 0, 1));
      ctx.globalCompositeOperation = "lighter";
      var H = run.hot;
      for (var h = 0; h < H.length; h++) {
        var l = H[h];
        var dd = Math.abs(l.s - sw.head);
        dd = Math.min(dd, Math.abs(dd - 1));
        if (dd > 0.13) continue;
        var k = Math.exp(-Math.pow(dd / 0.04, 2)) * sw.k;
        if (k < 0.04) continue;
        if (!l.hot) l.hot = glyph(l.ch, l.px, "hot", run.dpr);
        put(l.hot, l.x, l.y, l.a, 1.04, k, B, E, F);
      }
      var cp = pathAt(sw.head, 1, 0, run.u, {});
      blob(SP.comet, cp.x, cp.y, run.Wh * 0.075, 0.85 * sw.k * Math.min(1, fade * 3), B, E, F);
      ctx.globalCompositeOperation = "source-over";
    }

    if (bs.lt >= 0 && bs.lt < 1700 && bs.idx === 0) {
      var q = bs.lt / 1700;
      var kk = 1 + 0.34 * ease01(q);
      ctx.setTransform(dpr * beat, 0, 0, dpr * beat, E, F);
      ctx.globalAlpha = 0.55 * Math.pow(1 - q, 2);
      ctx.strokeStyle = "rgba(255,90,118,1)";
      ctx.lineWidth = 1.6;
      heartPath(ctx, kk * 0.98, run.u);
      ctx.stroke();
    }

    var sk = run.sparks;
    ctx.globalCompositeOperation = "lighter";
    for (var s = 0; s < sk.length; s++) {
      var sp = sk[s];
      var on = ramp(t, sp.t0, 1500);
      if (on <= 0) continue;
      var tw2 = Math.sin(t * sp.sp + sp.ph);
      if (tw2 <= 0) continue;
      blob(SP.star, sp.x, sp.y, sp.r * (0.6 + 0.4 * tw2), tw2 * tw2 * 0.9 * on, B, E, F);
    }
    ctx.globalCompositeOperation = "source-over";

    drawParticles(t, dpr, true);

    ctx.globalAlpha = 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function frame(now) {
    raf = 0;
    if (!run) return;
    var dt = run.last ? Math.min(now - run.last, 50) : 16;
    run.last = now;
    run.clock += dt;
    render(run.clock, dt);
    if (!run.captionFired && run.clock >= T.caption) {
      run.captionFired = true;
      if (run.cfg.onCaption) run.cfg.onCaption();
    }
    raf = window.requestAnimationFrame(frame);
  }

  function start(cfg) {
    stop();
    canvas = document.getElementById("heartCanvas");
    slot = document.getElementById("heartSlot");
    if (!canvas || !slot) return;
    ctx = canvas.getContext("2d");
    if (!ctx) return;
    if (!SP) SP = makeSprites();
    run = { cfg: cfg, clock: 0, last: 0, captionFired: false, dpr: 1, vw: 0, vh: 0, Wh: 0 };
    sizeCanvas();
    if (cfg.reduced) {
      run.clock = T.caption + 4000;
      render(run.clock, 0);
      run.captionFired = true;
      if (cfg.onCaption) cfg.onCaption();
      return;
    }
    raf = window.requestAnimationFrame(frame);
  }

  function stop() {
    if (raf) window.cancelAnimationFrame(raf);
    raf = 0;
    if (ctx && canvas) {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
    }
    run = null;
    spriteCache = {};
  }

  window.HeartScene = { start: start, stop: stop };
})();
