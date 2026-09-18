(function () {
  "use strict";

  const STORE_KEY = "parking-escape-v1";
  const HINTS_PER_LEVEL = 3;
  const SNAP_THRESHOLD = 0.45;
  const TAP_SLOP = 14;
  const GAP = 0.08;

  const $ = (id) => document.getElementById(id);

  const els = {
    start: $("screen-start"),
    levels: $("screen-levels"),
    game: $("screen-game"),
    sound: $("sound-toggle"),
    play: $("btn-play"),
    toLevels: $("btn-levels"),
    levelsBack: $("btn-levels-back"),
    levelGrid: $("level-grid"),
    gameBack: $("btn-game-back"),
    hudLevel: $("hud-level"),
    hudMoves: $("hud-moves"),
    hudStars: $("hud-stars"),
    board: $("board"),
    lotFrame: $("lot-frame"),
    exitBay: $("exit-bay"),
    coach: $("coach"),
    reset: $("btn-reset"),
    undo: $("btn-undo"),
    hint: $("btn-hint"),
    toast: $("toast"),
    modal: $("modal-complete"),
    modalStars: $("modal-stars"),
    modalMoves: $("modal-moves"),
    next: $("btn-next"),
    replay: $("btn-replay"),
    modalLevels: $("btn-to-levels")
  };

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const state = {
    screen: "start",
    level: null,
    cars: [],
    moves: 0,
    undo: [],
    hintsLeft: HINTS_PER_LEVEL,
    cell: 56,
    drag: null,
    locked: false,
    sliding: false,
    progress: loadProgress()
  };

  let audioCtx = null;
  let toastTimer = 0;

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const data = JSON.parse(raw);
        return {
          unlocked: Math.max(1, data.unlocked || 1),
          stars: data.stars || {},
          bestMoves: data.bestMoves || {},
          sound: data.sound !== false
        };
      }
    } catch (err) {}
    return { unlocked: 1, stars: {}, bestMoves: {}, sound: true };
  }

  function saveProgress() {
    localStorage.setItem(
      STORE_KEY,
      JSON.stringify({
        unlocked: state.progress.unlocked,
        stars: state.progress.stars,
        bestMoves: state.progress.bestMoves,
        sound: state.progress.sound
      })
    );
  }

  function getCtx() {
    if (!audioCtx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      audioCtx = new Ctx();
    }
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function tone(freq, duration, type, gain, delay) {
    if (!state.progress.sound) return;
    const ctx = getCtx();
    if (!ctx) return;
    const start = ctx.currentTime + (delay || 0);
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type || "sine";
    osc.frequency.setValueAtTime(freq, start);
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(gain || 0.06, start + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  function playMoveSound() {
    tone(180, 0.08, "triangle", 0.05);
    tone(90, 0.1, "sine", 0.03);
  }

  function playButtonSound() {
    tone(520, 0.05, "sine", 0.035);
  }

  function playSuccessSound() {
    tone(523.25, 0.16, "triangle", 0.07, 0);
    tone(659.25, 0.16, "triangle", 0.07, 0.09);
    tone(783.99, 0.28, "triangle", 0.08, 0.18);
  }

  function playHintSound() {
    tone(880, 0.12, "sine", 0.04);
  }

  function playBumpSound() {
    tone(110, 0.07, "square", 0.03);
    tone(70, 0.09, "sine", 0.04);
  }

  function vibrate(ms) {
    if (navigator.vibrate) navigator.vibrate(ms);
  }

  function showScreen(name) {
    state.screen = name;
    document.querySelectorAll(".screen").forEach((el) => {
      const on = el.dataset.screen === name;
      el.classList.toggle("active", on);
      el.setAttribute("aria-hidden", on ? "false" : "true");
      if (on) el.removeAttribute("inert");
      else el.setAttribute("inert", "");
    });
    els.sound.style.display = "grid";
  }

  function toast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove("show"), 1600);
  }

  function setSoundUi() {
    els.sound.classList.toggle("is-muted", !state.progress.sound);
    els.sound.setAttribute("aria-label", state.progress.sound ? "Mute sound" : "Unmute sound");
  }

  function renderLevelSelect() {
    const levels = PE.LEVELS;
    els.levelGrid.innerHTML = "";
    levels.forEach((level) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "level-cell";
      const unlocked = level.id <= state.progress.unlocked;
      const stars = state.progress.stars[level.id] || 0;
      btn.disabled = !unlocked;
      if (stars) btn.classList.add("is-done");
      if (!unlocked) {
        btn.setAttribute("aria-label", "Level " + level.id + " locked");
        btn.innerHTML = '<span class="lock"></span>';
      } else {
        btn.setAttribute("aria-label", "Level " + level.id);
        btn.innerHTML =
          "<span>" +
          level.id +
          "</span>" +
          (stars
            ? '<span class="mini-stars">' +
              [1, 2, 3].map((n) => "<i class='" + (stars >= n ? "on" : "") + "'></i>").join("") +
              "</span>"
            : "");
      }
      btn.addEventListener("click", () => {
        playButtonSound();
        startLevel(level.id);
      });
      els.levelGrid.appendChild(btn);
    });
  }

  function startLevel(id) {
    const level = PE.LEVELS.find((l) => l.id === id);
    if (!level) return;
    state.level = level;
    state.cars = PE.cloneCars(level.cars);
    state.moves = 0;
    state.undo = [];
    state.hintsLeft = HINTS_PER_LEVEL;
    state.locked = false;
    state.sliding = false;
    state.drag = null;
    showScreen("game");
    layoutBoard();
    renderBoard();
    updateHud();
    els.coach.textContent = "Tap the red car's front to drive out";
    els.coach.classList.toggle("hidden", id !== 1);
    hideModal();
  }

  function updateHud() {
    const par = state.level ? state.level.par : 1;
    els.hudLevel.textContent = "Level " + (state.level ? state.level.id : 1);
    els.hudMoves.textContent = String(state.moves);
    const live = state.moves === 0 ? 3 : PE.starsForMoves(state.moves, par);
    paintStars(els.hudStars, live, false);
    els.undo.disabled = state.undo.length === 0;
    els.hint.style.opacity = state.hintsLeft ? "1" : "0.55";
  }

  function paintStars(root, count, animate) {
    root.querySelectorAll(".star").forEach((star) => {
      const n = Number(star.dataset.star);
      star.classList.toggle("on", n <= count);
      star.classList.toggle("pop", Boolean(animate) && n <= count);
      if (animate) star.style.animationDelay = (n - 1) * 0.14 + "s";
    });
  }

  function layoutBoard() {
    const size = state.level.size;
    const stage = document.querySelector(".board-stage");
    const dock = document.querySelector(".game-dock");
    const hud = document.querySelector(".game-hud");
    const availW = Math.min(window.innerWidth, document.getElementById("app").clientWidth) - 36;
    const availH =
      window.innerHeight -
      (hud ? hud.getBoundingClientRect().height : 80) -
      (dock ? dock.getBoundingClientRect().height : 70) -
      90 -
      24;
    const frameExtraW = 44;
    const frameExtraH = 24;
    const cell = Math.floor(Math.max(38, Math.min((availW - frameExtraW) / size, (availH - frameExtraH) / size, 78)));
    state.cell = cell;
    document.documentElement.style.setProperty("--cell", cell + "px");
    els.board.style.width = cell * size + "px";
    els.board.style.height = cell * size + "px";

    const target = state.cars.find((c) => c.target);
    const row = target ? target.y : 2;
    els.exitBay.style.top = 10 + row * cell + "px";
    els.exitBay.style.height = cell + "px";
  }

  function renderBoard() {
    const size = state.level.size;
    const cell = state.cell;
    const target = state.cars.find((c) => c.target);
    const exitRow = target ? target.y : 2;
    const frag = document.createDocumentFragment();

    for (let y = 0; y < size; y++) {
      if (y === exitRow) {
        const lane = document.createElement("div");
        lane.className = "lane";
        lane.style.top = y * cell + "px";
        lane.style.height = cell + "px";
        frag.appendChild(lane);
        continue;
      }
      for (let x = 0; x < size; x++) {
        const stall = document.createElement("div");
        stall.className = "stall";
        stall.style.left = x * cell + 4 + "px";
        stall.style.top = y * cell + 4 + "px";
        stall.style.width = cell - 8 + "px";
        stall.style.height = cell - 8 + "px";
        frag.appendChild(stall);
      }
    }

    state.cars.forEach((car) => {
      frag.appendChild(createCarEl(car));
    });

    els.board.innerHTML = "";
    els.board.appendChild(frag);
  }

  function createCarEl(car) {
    const colors = PE.CAR_COLORS[car.target ? "red" : car.letter] || PE.CAR_COLORS.A;
    const el = document.createElement("div");
    el.className =
      "car " +
      car.orientation +
      (car.length > 2 ? " long" : "") +
      (car.target ? " target" : "");
    el.dataset.id = car.id;
    el.setAttribute("role", "button");
    el.setAttribute("aria-label", car.target ? "Target car" : "Car " + car.letter);
    el.style.setProperty("--body", colors.body);
    el.style.setProperty("--shade", colors.shade);
    el.style.setProperty("--cabin", colors.cabin);
    el.style.setProperty("--glass", colors.glass);
    el.style.setProperty("--light", colors.light);
    el.style.setProperty("--tail", colors.tail);
    el.innerHTML =
      '<div class="car-body">' +
      '<div class="car-cabin"></div>' +
      '<div class="car-window w-a"></div>' +
      '<div class="car-window w-b"></div>' +
      (car.length > 2 ? '<div class="car-window w-c"></div>' : "") +
      '<div class="car-light head"></div>' +
      '<div class="car-light tail"></div>' +
      '<div class="car-wheel k1"></div>' +
      '<div class="car-wheel k2"></div>' +
      '<div class="car-wheel k3"></div>' +
      '<div class="car-wheel k4"></div>' +
      (car.target ? '<div class="car-stripe"></div>' : "") +
      '<span class="car-end back" aria-hidden="true"></span>' +
      '<span class="car-end front" aria-hidden="true"></span>' +
      "</div>";
    placeCar(el, car.x, car.y, car, false);
    bindCar(el, car);
    return el;
  }

  function slideDuration(cells) {
    if (reducedMotion) return 90;
    return Math.min(480, 110 + Math.max(1, cells) * 85);
  }

  function placeCar(el, x, y, car, animate, cells) {
    const cell = state.cell;
    const pad = cell * GAP;
    const ms = slideDuration(cells || 1);
    if (!animate) el.style.transition = "none";
    else {
      el.style.transition = reducedMotion
        ? "left 0.09s linear, top 0.09s linear"
        : "left " + ms + "ms cubic-bezier(.18,.86,.22,1), top " + ms + "ms cubic-bezier(.18,.86,.22,1)";
    }
    el.style.left = x * cell + pad + "px";
    el.style.top = y * cell + pad + "px";
    el.style.width = (car.orientation === "horizontal" ? car.length : 1) * cell - pad * 2 + "px";
    el.style.height = (car.orientation === "vertical" ? car.length : 1) * cell - pad * 2 + "px";
    return ms;
  }

  function tapEnd(car, el, clientX, clientY) {
    const r = el.getBoundingClientRect();
    if (car.orientation === "horizontal") {
      return (clientX - r.left) / Math.max(1, r.width) >= 0.5 ? "forward" : "back";
    }
    return (clientY - r.top) / Math.max(1, r.height) >= 0.5 ? "forward" : "back";
  }

  function bindCar(el, car) {
    el.addEventListener("pointerdown", (e) => onDown(e, car, el));
  }

  document.addEventListener("pointermove", onMove, { passive: false });
  document.addEventListener("pointerup", onUp);
  document.addEventListener("pointercancel", onUp);

  function onDown(e, car, el) {
    if (state.locked || state.drag || state.sliding) return;
    e.preventDefault();
    e.stopPropagation();
    try {
      el.setPointerCapture(e.pointerId);
    } catch (err) {}
    const bounds = PE.getDragBounds(car, state.cars, state.level.size, state.level.exit);
    const end = tapEnd(car, el, e.clientX, e.clientY);
    state.drag = {
      car: car,
      el: el,
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      origX: car.x,
      origY: car.y,
      liveX: car.x,
      liveY: car.y,
      bounds: bounds,
      end: end,
      moved: false
    };
    el.classList.add("is-dragging");
    el.classList.add(end === "forward" ? "press-front" : "press-back");
    els.coach.classList.add("hidden");
  }

  function onMove(e) {
    const drag = state.drag;
    if (!drag) return;
    if (e.pointerId != null && drag.pointerId != null && e.pointerId !== drag.pointerId) return;
    e.preventDefault();
    const dist = Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY);
    if (dist >= TAP_SLOP) drag.moved = true;
    if (!drag.moved) return;
    const cell = state.cell;
    let x = drag.origX;
    let y = drag.origY;
    if (drag.car.orientation === "horizontal") {
      x = clamp(drag.origX + (e.clientX - drag.startX) / cell, drag.bounds.min, drag.bounds.max);
    } else {
      y = clamp(drag.origY + (e.clientY - drag.startY) / cell, drag.bounds.min, drag.bounds.max);
    }
    drag.liveX = x;
    drag.liveY = y;
    placeCar(drag.el, x, y, drag.car, false);
  }

  function onUp(e) {
    const drag = state.drag;
    if (!drag || (e.pointerId != null && e.pointerId !== drag.pointerId)) return;
    const car = drag.car;
    const el = drag.el;
    const size = state.level.size;
    el.classList.remove("is-dragging", "press-front", "press-back");
    state.drag = null;

    if (!drag.moved) {
      autoSlide(car, el, drag.end);
      return;
    }

    let nx = drag.origX;
    let ny = drag.origY;

    if (car.orientation === "horizontal") {
      nx = snapAxis(drag.liveX, drag.origX, drag.bounds);
      ny = car.y;
    } else {
      ny = snapAxis(drag.liveY, drag.origY, drag.bounds);
      nx = car.x;
    }

    const exiting =
      car.target &&
      state.level.exit === "right" &&
      drag.liveX >= size - car.length + SNAP_THRESHOLD;

    if (exiting) {
      commitMove(car, Math.max(size - car.length + 1, nx), ny, el, true, "forward");
      return;
    }

    const boardMaxX = car.orientation === "horizontal" ? size - car.length : size - 1;
    const boardMaxY = car.orientation === "vertical" ? size - car.length : size - 1;
    nx = clamp(nx, 0, boardMaxX);
    ny = clamp(ny, 0, boardMaxY);

    if (nx === car.x && ny === car.y) {
      placeCar(el, nx, ny, car, true, 1);
      bounce(el);
      return;
    }

    const end = nx > car.x || ny > car.y ? "forward" : "back";
    commitMove(car, nx, ny, el, false, end);
  }

  function autoSlide(car, el, end) {
    const bounds = PE.getDragBounds(car, state.cars, state.level.size, state.level.exit);
    const size = state.level.size;
    let nx = car.x;
    let ny = car.y;
    if (car.orientation === "horizontal") {
      nx = end === "forward" ? Math.floor(bounds.max) : Math.ceil(bounds.min);
    } else {
      ny = end === "forward" ? Math.floor(bounds.max) : Math.ceil(bounds.min);
    }

    const exiting =
      car.target &&
      state.level.exit === "right" &&
      end === "forward" &&
      nx > size - car.length;

    if (!exiting) {
      const boardMaxX = car.orientation === "horizontal" ? size - car.length : size - 1;
      const boardMaxY = car.orientation === "vertical" ? size - car.length : size - 1;
      nx = clamp(nx, 0, boardMaxX);
      ny = clamp(ny, 0, boardMaxY);
    }

    if (nx === car.x && ny === car.y) {
      bumpCar(el, car, end);
      playBumpSound();
      vibrate(7);
      return;
    }

    commitMove(car, nx, ny, el, exiting, end);
  }

  function bumpCar(el, car, end) {
    if (reducedMotion) {
      bounce(el);
      return;
    }
    const cls =
      car.orientation === "horizontal"
        ? end === "forward"
          ? "bump-right"
          : "bump-left"
        : end === "forward"
          ? "bump-down"
          : "bump-up";
    el.classList.remove("bump-left", "bump-right", "bump-up", "bump-down");
    void el.offsetWidth;
    el.classList.add(cls);
    setTimeout(() => el.classList.remove(cls), 220);
  }

  function snapAxis(live, orig, bounds) {
    const delta = live - orig;
    let snapped = orig;
    if (Math.abs(delta) >= SNAP_THRESHOLD) snapped = Math.round(live);
    else snapped = orig;
    return clamp(snapped, Math.ceil(bounds.min), Math.floor(bounds.max));
  }

  function commitMove(car, x, y, el, didExit, end) {
    const fromX = car.x;
    const fromY = car.y;
    const cells = Math.max(
      1,
      Math.abs(car.orientation === "horizontal" ? x - fromX : y - fromY)
    );
    const rollEnd = end || (x > fromX || y > fromY ? "forward" : "back");
    state.undo.push({
      cars: PE.cloneCars(state.cars),
      moves: state.moves
    });
    car.x = x;
    car.y = y;
    state.moves += 1;
    state.sliding = true;
    const ms = placeCar(el, x, y, car, true, cells);
    el.classList.add("is-rolling");
    el.classList.toggle("roll-forward", rollEnd === "forward");
    el.classList.toggle("roll-back", rollEnd === "back");
    if (!reducedMotion) spawnDust(el, car, rollEnd);
    playMoveSound();
    vibrate(8);
    updateHud();
    if (didExit || (car.target && hasEscaped(car))) {
      finishEscape(el, car, ms);
      return;
    }
    setTimeout(() => {
      el.classList.remove("is-rolling", "roll-forward", "roll-back");
      bounce(el);
      state.sliding = false;
    }, ms);
  }

  function hasEscaped(car) {
    const size = state.level.size;
    if (state.level.exit === "right") return car.x + car.length > size;
    if (state.level.exit === "left") return car.x < 0;
    if (state.level.exit === "bottom") return car.y + car.length > size;
    return car.y < 0;
  }

  function finishEscape(el, car, delay) {
    state.locked = true;
    state.sliding = true;
    const size = state.level.size;
    const endX = state.level.exit === "right" ? size + 1.15 : car.x;
    const duration = reducedMotion ? 80 : Math.max(delay || 0, 380);
    el.classList.add("is-rolling", "roll-forward", "is-escaping");
    placeCar(el, endX, car.y, car, true, 3);
    if (!reducedMotion) spawnBurst();
    playSuccessSound();
    vibrate(18);
    setTimeout(showComplete, duration);
  }

  function bounce(el) {
    if (reducedMotion) return;
    el.classList.remove("land");
    void el.offsetWidth;
    el.classList.add("land");
  }

  function spawnDust(el, car, end) {
    const rect = el.getBoundingClientRect();
    const boardRect = els.board.getBoundingClientRect();
    const n = 5;
    for (let i = 0; i < n; i++) {
      const p = document.createElement("div");
      p.className = "dust";
      let x = rect.left - boardRect.left + rect.width / 2;
      let y = rect.top - boardRect.top + rect.height / 2;
      if (car.orientation === "horizontal") {
        x = end === "forward" ? rect.left - boardRect.left + 6 : rect.right - boardRect.left - 6;
      } else {
        y = end === "forward" ? rect.top - boardRect.top + 6 : rect.bottom - boardRect.top - 6;
      }
      p.style.left = x + (Math.random() * 10 - 5) + "px";
      p.style.top = y + (Math.random() * 10 - 5) + "px";
      els.board.appendChild(p);
      p.animate(
        [
          { transform: "translate(-50%,-50%) scale(0.7)", opacity: 0.45 },
          { transform: "translate(-50%,-50%) scale(1.6)", opacity: 0 }
        ],
        { duration: 280 + Math.random() * 120, easing: "ease-out" }
      ).onfinish = () => p.remove();
    }
  }

  function spawnBurst() {
    const board = els.board.getBoundingClientRect();
    const target = state.cars.find((c) => c.target);
    const cx = board.left + (target.x + target.length) * state.cell;
    const cy = board.top + (target.y + 0.5) * state.cell;
    for (let i = 0; i < 18; i++) {
      const p = document.createElement("div");
      p.className = "burst";
      p.style.left = cx + "px";
      p.style.top = cy + "px";
      p.style.background = i % 2 ? "#f3b43b" : "#fff";
      document.body.appendChild(p);
      const ang = (Math.PI * 2 * i) / 18;
      const dist = 24 + Math.random() * 46;
      p.animate(
        [
          { transform: "translate(-50%,-50%) scale(1)", opacity: 1 },
          {
            transform: "translate(calc(-50% + " + Math.cos(ang) * dist + "px), calc(-50% + " + Math.sin(ang) * dist + "px)) scale(0.2)",
            opacity: 0
          }
        ],
        { duration: 520, easing: "cubic-bezier(.2,.7,.2,1)" }
      ).onfinish = () => p.remove();
    }
  }

  function showComplete() {
    const par = state.level.par;
    const stars = PE.starsForMoves(state.moves, par);
    const id = state.level.id;
    state.progress.unlocked = Math.max(state.progress.unlocked, Math.min(id + 1, PE.LEVELS.length));
    state.progress.stars[id] = Math.max(state.progress.stars[id] || 0, stars);
    const prevBest = state.progress.bestMoves[id];
    state.progress.bestMoves[id] = prevBest ? Math.min(prevBest, state.moves) : state.moves;
    saveProgress();

    els.modalMoves.textContent =
      state.moves + " move" + (state.moves === 1 ? "" : "s") + "  ·  par " + par;
    paintStars(els.modalStars, stars, !reducedMotion);
    els.next.style.display = id < PE.LEVELS.length ? "inline-flex" : "none";
    els.modal.classList.add("show");
    els.modal.setAttribute("aria-hidden", "false");
  }

  function hideModal() {
    els.modal.classList.remove("show");
    els.modal.setAttribute("aria-hidden", "true");
  }

  function resetLevel() {
    if (!state.level) return;
    state.cars = PE.cloneCars(state.level.cars);
    state.moves = 0;
    state.undo = [];
    state.hintsLeft = HINTS_PER_LEVEL;
    state.locked = false;
    state.sliding = false;
    renderBoard();
    updateHud();
  }

  function undoMove() {
    const snap = state.undo.pop();
    if (!snap || state.locked || state.sliding) return;
    state.cars = PE.cloneCars(snap.cars);
    state.moves = snap.moves;
    renderBoard();
    updateHud();
  }

  function giveHint() {
    if (state.locked || state.sliding) return;
    if (!state.hintsLeft) {
      toast("No hints left this attempt");
      return;
    }
    const puzzle = {
      size: state.level.size,
      exit: state.level.exit,
      cars: PE.cloneCars(state.cars)
    };
    const path = PE.solvePuzzle(puzzle, 180000);
    if (!path || !path.length) {
      toast("No hint available");
      return;
    }
    const step = path[0];
    const car = state.cars.find((c) => c.id === step.id);
    const el = els.board.querySelector('.car[data-id="' + step.id + '"]');
    if (!car || !el) return;
    state.hintsLeft -= 1;
    playHintSound();
    el.classList.add("is-hint");
    showHintArrow(el, car, step.dir);
    updateHud();
    setTimeout(() => el.classList.remove("is-hint"), 1400);
  }

  function showHintArrow(el, car, dir) {
    document.querySelectorAll(".hint-arrow").forEach((n) => n.remove());
    const arrow = document.createElement("div");
    arrow.className = "hint-arrow";
    const rot = { right: 0, down: 90, left: 180, up: 270 }[dir] || 0;
    arrow.innerHTML =
      '<svg viewBox="0 0 24 24" style="transform:rotate(' +
      rot +
      'deg)"><path d="M4 11h12l-4-4 1.4-1.4L21.8 12l-8.4 6.4L12 17l4-4H4z"/></svg>';
    const rect = el.getBoundingClientRect();
    const boardRect = els.board.getBoundingClientRect();
    let x = rect.left - boardRect.left + rect.width / 2;
    let y = rect.top - boardRect.top + rect.height / 2;
    if (dir === "right") x = rect.right - boardRect.left + 14;
    if (dir === "left") x = rect.left - boardRect.left - 14;
    if (dir === "down") y = rect.bottom - boardRect.top + 14;
    if (dir === "up") y = rect.top - boardRect.top - 14;
    arrow.style.left = x + "px";
    arrow.style.top = y + "px";
    els.board.appendChild(arrow);
    setTimeout(() => arrow.remove(), 1500);
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
  }

  function continueFromStart() {
    let id = 1;
    for (let i = 1; i <= PE.LEVELS.length; i++) {
      if (i > state.progress.unlocked) break;
      id = i;
      if (!state.progress.stars[i]) break;
    }
    startLevel(id);
  }

  els.play.addEventListener("click", () => {
    playButtonSound();
    continueFromStart();
  });
  els.toLevels.addEventListener("click", () => {
    playButtonSound();
    renderLevelSelect();
    showScreen("levels");
  });
  els.levelsBack.addEventListener("click", () => {
    playButtonSound();
    showScreen("start");
  });
  els.gameBack.addEventListener("click", () => {
    playButtonSound();
    hideModal();
    renderLevelSelect();
    showScreen("levels");
  });
  els.reset.addEventListener("click", () => {
    playButtonSound();
    resetLevel();
  });
  els.undo.addEventListener("click", () => {
    playButtonSound();
    undoMove();
  });
  els.hint.addEventListener("click", () => {
    playButtonSound();
    giveHint();
  });
  els.replay.addEventListener("click", () => {
    playButtonSound();
    hideModal();
    resetLevel();
  });
  els.modalLevels.addEventListener("click", () => {
    playButtonSound();
    hideModal();
    renderLevelSelect();
    showScreen("levels");
  });
  els.next.addEventListener("click", () => {
    playButtonSound();
    hideModal();
    const next = state.level.id + 1;
    if (next <= PE.LEVELS.length) startLevel(next);
    else {
      renderLevelSelect();
      showScreen("levels");
    }
  });
  els.sound.addEventListener("click", () => {
    state.progress.sound = !state.progress.sound;
    saveProgress();
    setSoundUi();
    if (state.progress.sound) playButtonSound();
  });

  window.addEventListener("resize", () => {
    if (state.screen !== "game" || !state.level) return;
    layoutBoard();
    renderBoard();
  });

  document.addEventListener(
    "touchmove",
    (e) => {
      if (state.screen === "game" && (state.drag || (e.target && e.target.closest && e.target.closest(".board, .lot-frame")))) {
        e.preventDefault();
      }
    },
    { passive: false }
  );

  if (!PE.LEVELS || !PE.LEVELS.length) {
    console.error("Parking Escape failed to load levels", PE.LEVEL_ERRORS);
  }

  setSoundUi();
  showScreen("start");
})();
