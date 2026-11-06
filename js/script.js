(function () {
  "use strict";

  /* ============================================================
     CONFIGURACIÓN: escribe aquí TU nombre (el de quien escribe).
     Es el único lugar que debes cambiar. Valor provisional: */
  var AUTHOR_NAME = "Clever";
  /* ============================================================ */

  var SCENES = ["intro", "rose", "letters", "final", "heart"];
  var SVG_NS = "http://www.w3.org/2000/svg";
  var motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  var motionOK = !motionQuery.matches;

  var timers = [];
  function later(fn, ms) {
    var id = window.setTimeout(fn, ms);
    timers.push(id);
    return id;
  }
  function clearTimers() {
    for (var i = 0; i < timers.length; i++) window.clearTimeout(timers[i]);
    timers.length = 0;
  }

  if (motionQuery.addEventListener) {
    motionQuery.addEventListener("change", function (e) { motionOK = !e.matches; });
  }

  var sections = Array.prototype.slice.call(document.querySelectorAll(".scene"));
  var progress = document.getElementById("progress");
  var progressBars = Array.prototype.slice.call(progress.querySelectorAll("i"));
  var curtain = document.getElementById("curtain");
  var current = "intro";
  var transitioning = false;

  function sceneEl(id) { return document.getElementById("scene-" + id); }

  function setActive(id) {
    var idx = SCENES.indexOf(id);
    if (idx < 0) return;
    current = id;
    for (var i = 0; i < sections.length; i++) {
      sections[i].classList.toggle("is-active", sections[i].id === "scene-" + id);
    }
    progress.classList.toggle("is-visible", idx > 0 && id !== "heart");
    for (var j = 0; j < progressBars.length; j++) {
      progressBars[j].classList.toggle("is-current", j === idx);
      progressBars[j].classList.toggle("is-done", j < idx);
    }
    window.scrollTo(0, 0);
    var el = sceneEl(id);
    if (el) {
      try { el.focus({ preventScroll: true }); } catch (err) { el.focus(); }
    }
    if (ENTER[id]) ENTER[id]();
  }

  function goTo(id) {
    if (transitioning || id === current || SCENES.indexOf(id) < 0) return;
    if (!motionOK) { setActive(id); return; }
    transitioning = true;
    curtain.classList.remove("is-running");
    void curtain.offsetWidth;
    curtain.classList.add("is-running");
    later(function () { setActive(id); }, 530);
    later(function () {
      curtain.classList.remove("is-running");
      transitioning = false;
    }, 1160);
  }

  var ENTER = {};

  document.addEventListener("click", function (e) {
    var btn = e.target.closest ? e.target.closest("[data-go]") : null;
    if (btn) goTo(btn.getAttribute("data-go"));
  });

  /* ---------------- partículas ---------------- */

  var canvas = document.getElementById("particles");
  var ctx = canvas.getContext ? canvas.getContext("2d") : null;
  var sprite = null;
  var dots = [];
  var rafId = 0;
  var lastTime = 0;
  var running = false;
  var cssW = 0;
  var cssH = 0;

  function buildSprite() {
    var c = document.createElement("canvas");
    c.width = 64;
    c.height = 64;
    var g = c.getContext("2d");
    if (!g) return null;
    var grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, "rgba(255,150,162,1)");
    grd.addColorStop(0.26, "rgba(230,57,80,.72)");
    grd.addColorStop(1, "rgba(160,12,34,0)");
    g.fillStyle = grd;
    g.beginPath();
    g.arc(32, 32, 32, 0, Math.PI * 2);
    g.fill();
    return c;
  }

  function fillDots() {
    var area = cssW * cssH;
    var target = Math.round(area / 21000);
    target = Math.max(12, Math.min(target, 64));
    while (dots.length < target) dots.push(makeDot(true));
    dots.length = target;
  }

  function makeDot(anywhere) {
    return {
      x: Math.random() * cssW,
      y: anywhere ? Math.random() * cssH : cssH + 20 + Math.random() * 60,
      r: 1.4 + Math.random() * 3.4,
      vy: 0.008 + Math.random() * 0.022,
      amp: 8 + Math.random() * 34,
      ph: Math.random() * Math.PI * 2,
      sp: 0.00025 + Math.random() * 0.0005,
      a: 0.28 + Math.random() * 0.5
    };
  }

  function sizeCanvas() {
    cssW = window.innerWidth;
    cssH = window.innerHeight;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    fillDots();
    if (!running) paint(0);
  }

  function paint(t) {
    if (!ctx) return;
    ctx.clearRect(0, 0, cssW, cssH);
    if (!sprite) return;
    ctx.globalCompositeOperation = "lighter";
    for (var i = 0; i < dots.length; i++) {
      var p = dots[i];
      var flick = 0.55 + 0.45 * Math.sin(t * 0.0011 + p.ph);
      ctx.globalAlpha = Math.max(0, Math.min(1, p.a * flick));
      var x = p.x + Math.sin(t * p.sp + p.ph) * p.amp;
      ctx.drawImage(sprite, x - p.r, p.y - p.r, p.r * 2, p.r * 2);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  function frame(now) {
    rafId = 0;
    var dt = lastTime ? Math.min(now - lastTime, 48) : 16;
    lastTime = now;
    for (var i = 0; i < dots.length; i++) {
      var p = dots[i];
      p.y -= p.vy * dt;
      if (p.y < -30) {
        var fresh = makeDot(false);
        dots[i] = fresh;
      }
    }
    paint(now);
    rafId = window.requestAnimationFrame(frame);
  }

  function startLoop() {
    if (!ctx || !motionOK || running || document.hidden || current === "heart") return;
    running = true;
    lastTime = 0;
    rafId = window.requestAnimationFrame(frame);
  }

  function stopLoop() {
    running = false;
    if (rafId) window.cancelAnimationFrame(rafId);
    rafId = 0;
  }

  /* ---------------- rosa ---------------- */

  var PETAL_D = "M200 204 C174 188 166 148 182 116 C191 98 209 98 218 116 C234 148 226 188 200 204 Z";
  var LEAF_D = "M200 200 C180 172 178 132 200 100 C222 132 220 172 200 200 Z";

  var RINGS = [
    { count: 8, scale: 1.35, delay: 0, grad: "gOuter", offset: 0 },
    { count: 6, scale: 1, delay: 0.5, grad: "gMid", offset: 28 },
    { count: 6, scale: 0.72, delay: 1, grad: "gInner", offset: 10 },
    { count: 4, scale: 0.5, delay: 1.45, grad: "gCore", offset: 50 }
  ];

  var LEAVES = [
    { angle: 42, scale: 1.55 },
    { angle: 166, scale: 1.5 },
    { angle: 288, scale: 1.55 }
  ];

  function makeEl(name, attrs) {
    var el = document.createElementNS(SVG_NS, name);
    for (var k in attrs) {
      if (Object.prototype.hasOwnProperty.call(attrs, k)) el.setAttribute(k, attrs[k]);
    }
    return el;
  }

  function buildRose() {
    var leafHost = document.getElementById("roseLeaves");
    var petalHost = document.getElementById("rosePetals");
    if (!leafHost || !petalHost) return;

    LEAVES.forEach(function (leaf) {
      var g = makeEl("g", { "class": "leaf" });
      g.style.setProperty("--a", leaf.angle + "deg");
      g.style.setProperty("--s", leaf.scale);
      g.appendChild(makeEl("path", { d: LEAF_D, fill: "url(#gLeaf)" }));
      g.appendChild(makeEl("path", {
        d: "M200 198 L200 106",
        fill: "none",
        stroke: "rgba(0,0,0,.3)",
        "stroke-width": "3"
      }));
      leafHost.appendChild(g);
    });

    RINGS.forEach(function (ring) {
      for (var i = 0; i < ring.count; i++) {
        var angle = (360 / ring.count) * i + ring.offset;
        var p = makeEl("path", {
          "class": "petal",
          d: PETAL_D,
          fill: "url(#" + ring.grad + ")"
        });
        p.style.setProperty("--a", angle.toFixed(2) + "deg");
        p.style.setProperty("--s", ring.scale);
        p.style.setProperty("--d", ring.delay + "s");
        petalHost.appendChild(p);
      }
    });
  }

  var nameForm = document.getElementById("nameForm");
  var nameInput = document.getElementById("nameInput");
  var nameError = document.getElementById("nameError");
  var roseForm = document.getElementById("roseForm");
  var roseStage = document.getElementById("roseStage");
  var rose = document.getElementById("rose");
  var roseName = document.getElementById("roseName");
  var roseCaption = document.getElementById("roseCaption");
  var roseCta = document.getElementById("roseCta");

  function showError(msg) {
    nameError.textContent = msg;
    nameForm.classList.add("is-invalid");
    window.setTimeout(function () { nameForm.classList.remove("is-invalid"); }, 600);
  }

  function fitRoseName() {
    roseName.style.fontSize = "";
    var size = rose.clientWidth;
    var natural = roseName.scrollWidth;
    var limit = size * 0.6;
    if (natural > limit && natural > 0) {
      var base = parseFloat(window.getComputedStyle(roseName).fontSize);
      roseName.style.fontSize = Math.max(base * (limit / natural), 10) + "px";
    }
  }

  var fitTimer = 0;
  window.addEventListener("resize", function () {
    if (fitTimer) window.clearTimeout(fitTimer);
    fitTimer = window.setTimeout(function () {
      if (!roseStage.hidden) fitRoseName();
    }, 150);
  });

  function revealRose(name) {
    roseForm.hidden = true;
    roseStage.hidden = false;
    roseName.textContent = name;
    fitRoseName();
    roseCaption.textContent = "Tu nombre ya está guardado entre sus pétalos.";

    later(function () {
      roseStage.classList.add("is-visible");
    }, 40);

    var bloomAt = motionOK ? 750 : 60;
    var finishAt = motionOK ? 4400 : 320;

    later(function () { rose.classList.add("is-bloomed"); }, bloomAt);
    later(function () {
      roseCaption.classList.add("is-visible");
      roseCta.classList.add("is-visible");
    }, finishAt);
  }

  if (nameForm) {
    nameForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var value = nameInput.value.replace(/\s+/g, " ").trim();
      if (!value) {
        showError("Necesito saber tu nombre…");
        nameInput.focus();
        return;
      }
      if (value.length < 2) {
        showError("Un poquito más, por favor.");
        nameInput.focus();
        return;
      }
      nameError.textContent = "";
      revealRose(value.slice(0, 24));
    });

    nameInput.addEventListener("input", function () {
      if (nameError.textContent) nameError.textContent = "";
    });
  }

  /* ---------------- cartas ---------------- */

  var LETTERS = [
    {
      title: "El día en que dejaste de ser una cualquiera",
      text: "No sé muy bien cuándo empezaste a importarme. Solo sé que un día dejaste de ser una cualquiera y te convertiste en alguien a quien quiero contar las cosas pequeñas."
    },
    {
      title: "Tu forma de estar",
      text: "Hay algo en tu manera de estar: tranquila, sin prisa, como si el mundo pudiera esperar. Contigo descubrí que la calma también puede tener nombre."
    },
    {
      title: "Sin disfraces",
      text: "No prometo certezas ni llego con respuestas prefabricadas. Solo traigo curiosidad sincera, paciencia y ganas de conocerte tal como eres, sin disfraces."
    },
    {
      title: "Motivos pequeños",
      text: "A veces basta una sonrisa tuya para que mi día entero encuentre un motivo. No te lo digo para que lo cambies: te lo digo porque es simplemente verdad."
    },
    {
      title: "El siguiente capítulo",
      text: "Si algún día quieres, me encantaría seguir escribiendo este capítulo contigo. Sin prisas, sin presiones… solo para descubrir hacia dónde nos lleva todo esto."
    }
  ];

  var ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];

  var card = document.getElementById("card");
  var envelope = document.getElementById("envelope");
  var seal = document.getElementById("seal");
  var paper = document.getElementById("paper");
  var letterIndexEl = document.getElementById("letterIndex");
  var letterTitle = document.getElementById("letterTitle");
  var letterText = document.getElementById("letterText");
  var nextBtn = document.getElementById("nextLetter");
  var dotsHost = document.getElementById("dots");

  var letterIndex = 0;
  var typer = null;
  var busy = false;

  function buildDots() {
    for (var i = 0; i < LETTERS.length; i++) {
      var d = document.createElement("i");
      dotsHost.appendChild(d);
    }
  }

  function syncDots() {
    var all = dotsHost.children;
    for (var i = 0; i < all.length; i++) {
      all[i].classList.toggle("is-current", i === letterIndex);
      all[i].classList.toggle("is-done", i < letterIndex);
    }
    if (nextBtn) {
      nextBtn.textContent = letterIndex >= LETTERS.length - 1 ? "Continuar" : "Siguiente carta";
    }
  }

  function createTyper(el, text, onDone) {
    var i = 0;
    var timer = 0;
    var finished = false;

    function done() {
      if (finished) return;
      finished = true;
      if (timer) window.clearTimeout(timer);
      el.textContent = text;
      el.classList.remove("is-typing");
      onDone();
    }

    function stop() {
      if (finished) return;
      finished = true;
      if (timer) window.clearTimeout(timer);
      el.classList.remove("is-typing");
    }

    function step() {
      if (finished) return;
      i += 1;
      el.textContent = text.slice(0, i);
      if (i >= text.length) { done(); return; }
      timer = window.setTimeout(step, 16 + Math.random() * 18);
    }

    if (!motionOK) { done(); return { finish: done, stop: stop }; }

    el.classList.add("is-typing");
    timer = window.setTimeout(step, 340);
    return { finish: done, stop: stop };
  }

  function startTyping() {
    var data = LETTERS[letterIndex];
    letterIndexEl.textContent = "Carta " + ROMAN[letterIndex];
    letterTitle.textContent = data.title;
    letterText.textContent = "";
    card.classList.remove("is-done");

    typer = createTyper(letterText, data.text, function () {
      card.classList.add("is-done");
    });
  }

  function openLetter() {
    if (busy || card.classList.contains("is-opening")) return;
    busy = true;
    card.classList.add("is-opening");

    later(function () {
      card.classList.remove("is-resetting");
      card.classList.add("is-reading");
      busy = false;
      startTyping();
    }, motionOK ? 620 : 30);
  }

  function resetCard() {
    if (typer) { typer.stop(); typer = null; }
    card.classList.add("is-resetting");
    card.classList.remove("is-opening", "is-reading", "is-done");
    letterTitle.textContent = "";
    letterText.textContent = "";
    letterIndexEl.textContent = "Carta " + ROMAN[letterIndex];
  }

  function resetLetters() {
    letterIndex = 0;
    busy = false;
    if (typer) { typer.stop(); typer = null; }
    resetCard();
    syncDots();
  }

  if (seal) {
    seal.addEventListener("click", openLetter);
  }

  if (paper) {
    paper.addEventListener("click", function (e) {
      if (e.target.closest && e.target.closest("button")) return;
      if (typer) typer.finish();
    });
  }

  if (nextBtn) {
    nextBtn.addEventListener("click", function () {
      if (busy) return;
      if (letterIndex >= LETTERS.length - 1) {
        goTo("final");
        return;
      }
      busy = true;
      card.classList.add("is-fading");
      later(function () {
        letterIndex += 1;
        resetCard();
        syncDots();
        card.classList.remove("is-fading");
        busy = false;
      }, motionOK ? 430 : 30);
    });
  }

  /* ---------------- escena final ---------------- */

  var petalsHost = document.getElementById("petals");
  var petalsBuilt = false;

  function buildPetals() {
    if (petalsBuilt || !petalsHost) return;
    petalsBuilt = true;
    if (!motionOK) return;
    var count = window.innerWidth < 640 ? 11 : 16;
    for (var i = 0; i < count; i++) {
      var s = document.createElement("span");
      s.className = "fall-petal";
      s.style.setProperty("--x", (Math.random() * 100).toFixed(2) + "%");
      s.style.setProperty("--dur", (9 + Math.random() * 8).toFixed(2) + "s");
      s.style.setProperty("--del", (-Math.random() * 16).toFixed(2) + "s");
      s.style.setProperty("--sc", (0.5 + Math.random() * 0.85).toFixed(2));
      s.style.setProperty("--rot", (Math.random() > 0.5 ? "" : "-") + (320 + Math.random() * 260).toFixed(0) + "deg");
      s.style.setProperty("--sway", (28 + Math.random() * 76).toFixed(0) + "px");
      s.style.setProperty("--op", (0.4 + Math.random() * 0.4).toFixed(2));
      petalsHost.appendChild(s);
    }
  }

  var restartBtn = document.getElementById("restart");

  function resetAll() {
    clearTimers();
    transitioning = false;
    curtain.classList.remove("is-running");

    rose.classList.remove("is-bloomed");
    roseName.textContent = "";
    roseCaption.classList.remove("is-visible");
    roseCta.classList.remove("is-visible");
    roseStage.classList.remove("is-visible");
    roseStage.hidden = true;
    roseForm.hidden = false;
    nameInput.value = "";
    nameError.textContent = "";

    resetLetters();
    if (petalsHost) petalsHost.innerHTML = "";
    petalsBuilt = false;
  }

  if (restartBtn) {
    restartBtn.addEventListener("click", function () {
      resetAll();
      goTo("intro");
    });
  }

  var names = { her: "", me: AUTHOR_NAME };

  /* ---------------- corazón final ---------------- */

  var heartScene = document.getElementById("scene-heart");
  var heartCaption = document.getElementById("heartCaption");
  var heartPhraseLive = document.getElementById("heartPhraseLive");
  var heartNames = document.getElementById("heartNames");
  var heartNameA = document.getElementById("heartNameA");
  var heartNameB = document.getElementById("heartNameB");
  var heartActions = document.getElementById("heartActions");
  var heartTyper = null;
  var HEART_PHRASE = "Hay personas que llegan sin hacer ruido y, sin darse cuenta, hacen que todo sea un poquito más bonito.";

  function showHeartCaption() {
    heartCaption.classList.add("is-on");
    if (heartTyper) heartTyper.stop();
    heartTyper = createTyper(heartPhraseLive, HEART_PHRASE, function () {
      later(function () { heartNames.classList.add("is-on"); }, motionOK ? 350 : 0);
      later(function () { heartActions.classList.add("is-on"); }, motionOK ? 1500 : 0);
    });
  }

  function layoutHeartNames() {
    heartNames.classList.remove("is-stacked");
    if (heartNameB.offsetTop > heartNameA.offsetTop + 2) heartNames.classList.add("is-stacked");
  }

  var namesResize = 0;
  window.addEventListener("resize", function () {
    if (namesResize) window.clearTimeout(namesResize);
    namesResize = window.setTimeout(function () {
      if (current === "heart") layoutHeartNames();
    }, 200);
  });

  function resetHeart() {
    if (!window.HeartScene) return;
    window.HeartScene.stop();
    if (heartTyper) { heartTyper.stop(); heartTyper = null; }
    heartScene.classList.remove("is-lit");
    heartCaption.classList.remove("is-on");
    heartNames.classList.remove("is-on");
    heartActions.classList.remove("is-on");
    heartPhraseLive.textContent = "";
    heartNameA.textContent = "";
    heartNameB.textContent = "";
    names.her = "";
  }

  /* ---------------- escenas ---------------- */

  ENTER.intro = function () { resetHeart(); startLoop(); };
  ENTER.letters = function () { resetLetters(); };
  ENTER.final = function () { buildPetals(); };
  ENTER.heart = function () {
    names.her = roseName.textContent;
    names.me = AUTHOR_NAME;
    if (!window.HeartScene || !names.her || !names.me) return;
    stopLoop();
    heartNameA.textContent = names.her;
    heartNameB.textContent = names.me;
    layoutHeartNames();
    later(function () { heartScene.classList.add("is-lit"); }, 60);
    window.HeartScene.start({
      her: names.her,
      me: names.me,
      reduced: !motionOK,
      onCaption: showHeartCaption
    });
  };

  /* ---------------- arranque ---------------- */

  function init() {
    buildRose();
    buildDots();
    syncDots();

    sprite = buildSprite();
    sizeCanvas();
    startLoop();

    setActive("intro");
  }

  var resizeTimer = 0;
  window.addEventListener("resize", function () {
    if (resizeTimer) window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(sizeCanvas, 180);
  });

  document.addEventListener("visibilitychange", function () {
    if (document.hidden) stopLoop();
    else startLoop();
  });

  if (motionQuery.addEventListener) {
    motionQuery.addEventListener("change", function () {
      if (motionOK) startLoop(); else { stopLoop(); paint(0); }
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
