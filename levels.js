/**
 * Parking Escape — level data, parser, and shortest-path solver.
 * Grids are square ASCII maps: R = target car, A–Z = other cars, . = empty.
 * Cars must be orthogonal rectangles of length 2 or 3.
 */
(function (global) {
  const PE = (global.PE = global.PE || {});

  PE.CAR_COLORS = {
    red: { body: "#e23b2f", shade: "#9f1e16", cabin: "#3a1520", glass: "#8fd4ff", light: "#ffe7a3", tail: "#ff5a6a" },
    A: { body: "#2f6fed", shade: "#1b3fa8", cabin: "#142347", glass: "#b9dcff", light: "#fff4c8", tail: "#ff6b7d" },
    B: { body: "#1fa971", shade: "#0f6d48", cabin: "#0d2a20", glass: "#c4ffe8", light: "#fff1b0", tail: "#ff7a6e" },
    C: { body: "#8b5cf6", shade: "#5b35b8", cabin: "#1c1438", glass: "#d6c4ff", light: "#ffe9b5", tail: "#ff6d80" },
    D: { body: "#f59e0b", shade: "#b45309", cabin: "#3a2308", glass: "#fff0c4", light: "#fff7d6", tail: "#ef4444" },
    E: { body: "#06b6d4", shade: "#0e7490", cabin: "#082830", glass: "#c9f7ff", light: "#fff2c2", tail: "#fb7185" },
    F: { body: "#f43f5e", shade: "#9f1239", cabin: "#3f101c", glass: "#ffd0d8", light: "#ffe9b8", tail: "#fda4af" },
    G: { body: "#84cc16", shade: "#4d7c0f", cabin: "#1a2e0a", glass: "#e8ffc4", light: "#fff4c2", tail: "#fb7185" },
    H: { body: "#e5e7eb", shade: "#9ca3af", cabin: "#1f2937", glass: "#93c5fd", light: "#fff7d1", tail: "#ef4444" },
    I: { body: "#0f766e", shade: "#115e59", cabin: "#042f2e", glass: "#99f6e4", light: "#fde68a", tail: "#fb7185" },
    J: { body: "#db2777", shade: "#9d174d", cabin: "#3f0a22", glass: "#fbcfe8", light: "#fef3c7", tail: "#fda4af" },
    K: { body: "#4338ca", shade: "#312e81", cabin: "#1e1b4b", glass: "#c7d2fe", light: "#fde68a", tail: "#fb7185" },
    L: { body: "#b45309", shade: "#7c2d12", cabin: "#3b1608", glass: "#fed7aa", light: "#fff7c2", tail: "#f87171" },
    M: { body: "#334155", shade: "#1e293b", cabin: "#0f172a", glass: "#bae6fd", light: "#fef9c3", tail: "#f43f5e" },
    N: { body: "#65a30d", shade: "#3f6212", cabin: "#1a2e05", glass: "#d9f99d", light: "#fef08a", tail: "#fb7185" },
    O: { body: "#78716c", shade: "#44403c", cabin: "#1c1917", glass: "#e7e5e4", light: "#fef3c7", tail: "#f87171" },
    P: { body: "#14b8a6", shade: "#0f766e", cabin: "#042f2e", glass: "#ccfbf1", light: "#fde68a", tail: "#fb7185" },
    Q: { body: "#7c3aed", shade: "#5b21b6", cabin: "#2e1065", glass: "#ddd6fe", light: "#fde68a", tail: "#fb7185" },
    S: { body: "#ea580c", shade: "#9a3412", cabin: "#431407", glass: "#ffedd5", light: "#fef3c7", tail: "#f87171" },
    T: { body: "#155e75", shade: "#164e63", cabin: "#083344", glass: "#a5f3fc", light: "#fde68a", tail: "#fb7185" },
    U: { body: "#9f1239", shade: "#6b0f2a", cabin: "#4c0519", glass: "#fecdd3", light: "#fef3c7", tail: "#fda4af" },
    V: { body: "#0284c7", shade: "#075985", cabin: "#0c4a6e", glass: "#bae6fd", light: "#fef9c3", tail: "#fb7185" },
    W: { body: "#ca8a04", shade: "#854d0e", cabin: "#422006", glass: "#fef08a", light: "#fffbeb", tail: "#ef4444" },
    Y: { body: "#4d7c0f", shade: "#365314", cabin: "#1a2e05", glass: "#d9f99d", light: "#fef08a", tail: "#fb7185" }
  };

  function L(id, par, grid) {
    return { id: id, size: 6, exit: "right", par: par, grid: grid };
  }

  const RAW_LEVELS = [
    L(1, 1, ["......", "......", "RR....", "......", "......", "......"]),
    L(2, 2, ["......", "...A..", "RR.A..", "......", "......", "......"]),
    L(3, 2, ["....B.", "....B.", "RR..B.", "......", "......", "......"]),
    L(4, 3, ["...A..", "...A..", "RR.A.B", ".....B", "......", "......"]),
    L(5, 4, ["AA.B..", "...B..", "RR.B.C", ".....C", "..DD..", "......"]),
    L(6, 4, ["..ABBC", "..A..C", "RRA...", "...DD.", "..EE..", "..FF.."]),
    L(7, 4, ["AABB.C", "...D.C", "RR.D.C", "...D..", "EE....", "..FF.."]),
    L(8, 3, ["A.BBCC", "A..D..", "RR.D..", "...D.E", ".FF..E", "...GG."]),
    L(9, 5, ["AABB.C", "DEEG.C", "DRRG.C", "DFF.HH", "II....", "JJKK.."]),
    L(10, 6, ["AABB.C", "DEE..C", "DRR..C", "DFFGHH", "II.G..", "JJKK.."]),
    L(11, 7, ["A.BB.C", "A.D..C", "RRD..C", "..D.EE", "FF.G..", "...GHH"]),
    L(12, 7, ["A.BBCC", "A..DE.", "RR.DE.", "FF.DE.", "..G.HH", "..GII."]),
    L(13, 7, ["AABB.C", "D.EE.C", "DRR..C", "DFFGHH", "II.G..", "JJKK.."]),
    L(14, 8, ["AABB.C", "D.EE.C", "D.RR.C", "DFFGHH", "II.G..", "JJKK.."]),
    L(15, 8, ["..BCAA", "EEBCD.", ".RR.D.", "FFGGHH", "IIJJ..", "KKLL.."]),
    L(16, 9, ["A.BB.C", "A.D..C", "RRD..C", "..DEE.", ".FFG..", "...GHH"]),
    L(17, 9, ["AABB.C", "D.EE.C", "D.RR.C", "DFFGHH", "II.G..", "JJ..KK"]),
    L(18, 10, ["AABB.C", "DDEE.C", "RR.F.C", "..GFHH", "..GII.", "JJKK.."]),
    L(19, 10, ["AABB.C", "D.EE.C", "D.RR.C", "DFFGHH", "II.G..", "..JJKK"]),
    L(20, 10, ["A.BB..", "A....C", "..RR.C", "..DEEC", "..DGFF", "..DGHH"]),
    L(21, 11, ["..BB..", ".....C", "A.DRRC", "A.DEEC", "..DGFF", "...GHH"]),
    L(22, 12, ["AA..BB", "D.EE.C", "D.RR.C", "DFFHHC", "II.G..", "JJ.GKK"]),
    L(23, 13, ["BBCCE.", "A...E.", "ARRDE.", "FF.D..", "..GDHH", "..GII."]),
    L(24, 14, ["BBCCE.", "....E.", "RR.DE.", "AFFD..", "A.GDHH", "IIG..."]),
    L(25, 14, ["..AABB", "D.EE.C", "D.RR.C", "DFFHHC", "...GII", "JJ.GKK"]),
    L(26, 16, [".BBCC.", "...IE.", "DRRIEG", "D.FFEG", "D.AHHG", "..AJJ."]),
    L(27, 18, ["DBBCC.", "D..IE.", "DRRIEG", "FFA.EG", "..AHHG", "...JJ."]),
    L(28, 20, ["DBBCC.", "D...E.", "DRRIEG", "FFAIEG", "..AHHG", "..JJ.."]),
    L(29, 21, ["DBBICC", "D..IE.", "D.RREG", "FF..EG", "..AHHG", "JJA..."]),
    L(30, 21, ["DBBCC.", "D...EG", "D.RREG", "FFA.EG", "..AIHH", "JJ.I.."]),
    L(31, 8, ["A.BB.C", "A.D..C", "RRD..C", "..DEE.", "FF.G..", "...GHH"]),
    L(32, 9, ["A.BB..", "A.D..C", "RRD..C", "..DEEC", ".FFG..", "...GHH"]),
    L(33, 10, ["A.BB.C", "A....C", "..DRRC", "..DEE.", "..DGFF", "...GHH"]),
    L(34, 10, ["A.BB.C", "A.D..C", "..DRRC", "..DEE.", "...GFF", "...GHH"]),
    L(35, 11, ["..BB..", "..D..C", "A.DRRC", "A.DEEC", "...GFF", "...GHH"]),
    L(36, 12, ["BBCC..", "A...E.", "ARRDE.", "FF.DE.", "..GDHH", "..GII."]),
    L(37, 12, ["BBCCE.", "A..DE.", "ARRDE.", "FF.D..", "..G.HH", "..GII."]),
    L(38, 13, ["BBCCE.", "A...E.", "ARRDE.", "FFGD..", "..GDHH", "...II."]),
    L(39, 14, ["BBCCE.", "....E.", "RR..E.", "AFFD..", "A.GDHH", "IIGD.."]),
    L(40, 15, ["BB.CC.", "...IE.", "DRRIEG", "D.FFEG", "D.AHHG", "..AJJ."]),
    L(41, 15, [".BBCC.", "...IE.", ".RRIEG", "D.FFEG", "D.AHHG", "D.AJJ."]),
    L(42, 16, [".BB.CC", "...IE.", "DRRIEG", "D.FFEG", "D.AHHG", "..AJJ."]),
    L(43, 17, [".BBICC", "...IE.", "DRR.EG", "D.FFEG", "D.AHHG", "..AJJ."]),
    L(44, 18, ["DBBCC.", "D...E.", "DRRIEG", "FF.IEG", "..AHHG", "..AJJ."]),
    L(45, 19, ["DBBCC.", "D...E.", "DRRIEG", "FFAIEG", "..AHHG", "...JJ."]),
    L(46, 20, ["DBBCC.", "D...E.", "DRRIEG", "FFAIEG", "..AHHG", ".JJ..."]),
    L(47, 21, ["DBBCC.", "D...EG", "D.RREG", "FFA.EG", "..AIHH", ".JJI.."]),
    L(48, 21, ["DBBCCG", "D...EG", "D.RREG", "FFA.E.", "..AIHH", ".JJI.."]),
    L(49, 21, ["DBBCCG", "D...EG", "D.RREG", "FFA.E.", "..AIHH", "JJ.I.."]),
    L(50, 21, ["DBBICC", "D..IEG", "D.RREG", "FF..EG", "..AHH.", "JJA..."])
  ];

  function parseGrid(id, size, exit, rows) {
    if (!rows || rows.length !== size) {
      throw new Error("Level " + id + ": expected " + size + " rows");
    }
    for (let i = 0; i < rows.length; i++) {
      if (rows[i].length !== size) {
        throw new Error("Level " + id + ": row " + i + " is not width " + size);
      }
    }

    const visited = Array.from({ length: size }, () => Array(size).fill(false));
    const cars = [];

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const ch = rows[y][x];
        if (ch === "." || visited[y][x]) continue;
        if (!/[A-Z]/.test(ch)) {
          throw new Error("Level " + id + ": invalid cell '" + ch + "'");
        }

        const goRight = x + 1 < size && rows[y][x + 1] === ch;
        const goDown = y + 1 < size && rows[y + 1][x] === ch;
        if (goRight && goDown) {
          throw new Error("Level " + id + ": car " + ch + " is L-shaped");
        }

        const orientation = goDown ? "vertical" : "horizontal";
        let length = 1;
        if (orientation === "horizontal") {
          while (x + length < size && rows[y][x + length] === ch) length++;
        } else {
          while (y + length < size && rows[y + length][x] === ch) length++;
        }

        if (length < 2 || length > 3) {
          throw new Error("Level " + id + ": car " + ch + " has invalid length " + length);
        }

        for (let i = 0; i < length; i++) {
          const cx = orientation === "horizontal" ? x + i : x;
          const cy = orientation === "vertical" ? y + i : y;
          if (rows[cy][cx] !== ch) {
            throw new Error("Level " + id + ": car " + ch + " is not a straight block");
          }
          visited[cy][cx] = true;
        }

        cars.push({
          id: ch === "R" ? "red" : ch,
          letter: ch,
          x: x,
          y: y,
          length: length,
          orientation: orientation,
          target: ch === "R"
        });
      }
    }

    const targets = cars.filter((c) => c.target);
    if (targets.length !== 1) {
      throw new Error("Level " + id + ": expected exactly one target car");
    }

    const target = targets[0];
    if (exit === "right" || exit === "left") {
      if (target.orientation !== "horizontal") {
        throw new Error("Level " + id + ": target must be horizontal for " + exit + " exit");
      }
    } else if (target.orientation !== "vertical") {
      throw new Error("Level " + id + ": target must be vertical for " + exit + " exit");
    }

    return {
      id: id,
      size: size,
      exit: exit,
      cars: cars,
      grid: rows
    };
  }

  function occupiedSet(cars, excludeId) {
    const set = new Set();
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i];
      if (car.id === excludeId) continue;
      for (let k = 0; k < car.length; k++) {
        const x = car.orientation === "horizontal" ? car.x + k : car.x;
        const y = car.orientation === "vertical" ? car.y + k : car.y;
        set.add(x + "," + y);
      }
    }
    return set;
  }

  function stateKey(cars) {
    const parts = new Array(cars.length);
    for (let i = 0; i < cars.length; i++) {
      const c = cars[i];
      parts[i] = c.id + ":" + c.x + "," + c.y;
    }
    parts.sort();
    return parts.join("|");
  }

  function cloneCars(cars) {
    const next = new Array(cars.length);
    for (let i = 0; i < cars.length; i++) {
      const c = cars[i];
      next[i] = {
        id: c.id,
        letter: c.letter,
        x: c.x,
        y: c.y,
        length: c.length,
        orientation: c.orientation,
        target: c.target
      };
    }
    return next;
  }

  function canTargetExit(cars, size, exit) {
    const target = cars.find((c) => c.target);
    if (!target) return false;
    const occ = occupiedSet(cars, target.id);
    if (exit === "right") {
      for (let x = target.x + target.length; x < size; x++) {
        if (occ.has(x + "," + target.y)) return false;
      }
      return true;
    }
    if (exit === "left") {
      for (let x = target.x - 1; x >= 0; x--) {
        if (occ.has(x + "," + target.y)) return false;
      }
      return true;
    }
    if (exit === "bottom") {
      for (let y = target.y + target.length; y < size; y++) {
        if (occ.has(target.x + "," + y)) return false;
      }
      return true;
    }
    if (exit === "top") {
      for (let y = target.y - 1; y >= 0; y--) {
        if (occ.has(target.x + "," + y)) return false;
      }
      return true;
    }
    return false;
  }

  function exitDirection(exit) {
    if (exit === "right") return "right";
    if (exit === "left") return "left";
    if (exit === "bottom") return "down";
    return "up";
  }

  function collectSlides(car, occ, size) {
    const slides = [];
    if (car.orientation === "horizontal") {
      for (let x = car.x - 1; x >= 0; x--) {
        if (occ.has(x + "," + car.y)) break;
        slides.push({ x: x, y: car.y, dir: "left" });
      }
      for (let head = car.x + car.length; head < size; head++) {
        if (occ.has(head + "," + car.y)) break;
        slides.push({ x: head - car.length + 1, y: car.y, dir: "right" });
      }
    } else {
      for (let y = car.y - 1; y >= 0; y--) {
        if (occ.has(car.x + "," + y)) break;
        slides.push({ x: car.x, y: y, dir: "up" });
      }
      for (let head = car.y + car.length; head < size; head++) {
        if (occ.has(car.x + "," + head)) break;
        slides.push({ x: car.x, y: head - car.length + 1, dir: "down" });
      }
    }
    return slides;
  }

  function reconstructPath(endKey, parent, startKey) {
    const moves = [];
    let key = endKey;
    while (key !== startKey) {
      const node = parent.get(key);
      moves.push(node.move);
      key = node.prev;
    }
    moves.reverse();
    return moves;
  }

  function solvePuzzle(level, maxStates) {
    const size = level.size;
    const exit = level.exit || "right";
    const start = cloneCars(level.cars);
    const cap = maxStates || 250000;
    const t = start.find((c) => c.target);
    const exitMove = {
      id: t.id,
      dir: exitDirection(exit),
      exit: true,
      x: t.x,
      y: t.y
    };

    if (canTargetExit(start, size, exit)) {
      return [exitMove];
    }

    const startKey = stateKey(start);
    const queue = [start];
    const visited = new Set([startKey]);
    const parent = new Map();

    for (let qi = 0; qi < queue.length; qi++) {
      if (visited.size > cap) return null;
      const cars = queue[qi];
      const occ = occupiedSet(cars);

      for (let ci = 0; ci < cars.length; ci++) {
        const car = cars[ci];
        const slides = collectSlides(car, occ, size);
        for (let s = 0; s < slides.length; s++) {
          const slide = slides[s];
          const next = cloneCars(cars);
          next[ci].x = slide.x;
          next[ci].y = slide.y;
          const k = stateKey(next);
          if (visited.has(k)) continue;
          visited.add(k);
          parent.set(k, {
            prev: stateKey(cars),
            move: {
              id: car.id,
              dir: slide.dir,
              x: slide.x,
              y: slide.y,
              fromX: car.x,
              fromY: car.y
            }
          });
          if (canTargetExit(next, size, exit)) {
            const path = reconstructPath(k, parent, startKey);
            const nt = next.find((c) => c.target);
            path.push({
              id: nt.id,
              dir: exitDirection(exit),
              exit: true,
              x: nt.x,
              y: nt.y
            });
            return path;
          }
          queue.push(next);
        }
      }
    }
    return null;
  }

  function getDragBounds(car, cars, size, exit) {
    const occ = occupiedSet(cars, car.id);
    let min = car.orientation === "horizontal" ? car.x : car.y;
    let max = min;

    if (car.orientation === "horizontal") {
      for (let x = car.x - 1; x >= 0; x--) {
        if (occ.has(x + "," + car.y)) break;
        min = x;
      }
      for (let head = car.x + car.length; head < size; head++) {
        if (occ.has(head + "," + car.y)) break;
        max = head - car.length + 1;
      }
      if (car.target && exit === "right") {
        let blocked = false;
        for (let x = car.x + car.length; x < size; x++) {
          if (occ.has(x + "," + car.y)) {
            blocked = true;
            break;
          }
        }
        if (!blocked) max = size;
      }
      if (car.target && exit === "left") {
        let blocked = false;
        for (let x = car.x - 1; x >= 0; x--) {
          if (occ.has(x + "," + car.y)) {
            blocked = true;
            break;
          }
        }
        if (!blocked) min = 1 - car.length;
      }
    } else {
      for (let y = car.y - 1; y >= 0; y--) {
        if (occ.has(car.x + "," + y)) break;
        min = y;
      }
      for (let head = car.y + car.length; head < size; head++) {
        if (occ.has(car.x + "," + head)) break;
        max = head - car.length + 1;
      }
      if (car.target && exit === "bottom") {
        let blocked = false;
        for (let y = car.y + car.length; y < size; y++) {
          if (occ.has(car.x + "," + y)) {
            blocked = true;
            break;
          }
        }
        if (!blocked) max = size;
      }
      if (car.target && exit === "top") {
        let blocked = false;
        for (let y = car.y - 1; y >= 0; y--) {
          if (occ.has(car.x + "," + y)) {
            blocked = true;
            break;
          }
        }
        if (!blocked) min = 1 - car.length;
      }
    }
    return { min: min, max: max };
  }

  function starsForMoves(moves, par) {
    if (moves <= par) return 3;
    if (moves <= par + Math.max(2, Math.ceil(par * 0.45))) return 2;
    return 1;
  }

  function carsToGrid(cars, size) {
    const g = Array.from({ length: size }, () => Array(size).fill("."));
    for (let i = 0; i < cars.length; i++) {
      const c = cars[i];
      const ch = c.letter || (c.target ? "R" : c.id);
      for (let k = 0; k < c.length; k++) {
        const x = c.orientation === "horizontal" ? c.x + k : c.x;
        const y = c.orientation === "vertical" ? c.y + k : c.y;
        if (x < 0 || y < 0 || x >= size || y >= size) continue;
        g[y][x] = ch;
      }
    }
    return g.map((row) => row.join(""));
  }

  function expandLevels() {
    const levels = [];
    const errors = [];
    RAW_LEVELS.forEach((raw) => {
      try {
        const level = parseGrid(raw.id, raw.size, raw.exit, raw.grid);
        level.par = raw.par;
        levels.push(level);
      } catch (err) {
        errors.push(String(err && err.message ? err.message : err));
      }
    });
    return { levels: levels, errors: errors };
  }

  const expanded = expandLevels();
  const LEVELS = expanded.levels;
  PE.LEVEL_ERRORS = expanded.errors;
  if (expanded.errors.length && typeof console !== "undefined") {
    expanded.errors.forEach((msg) => console.error(msg));
  }

  PE.parseGrid = parseGrid;
  PE.solvePuzzle = solvePuzzle;
  PE.canTargetExit = canTargetExit;
  PE.getDragBounds = getDragBounds;
  PE.occupiedSet = occupiedSet;
  PE.cloneCars = cloneCars;
  PE.starsForMoves = starsForMoves;
  PE.collectSlides = collectSlides;
  PE.carsToGrid = carsToGrid;
  PE.stateKey = stateKey;
  PE.LEVELS = LEVELS;
  PE.RAW_LEVELS = RAW_LEVELS;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = PE;
  }
})(typeof window !== "undefined" ? window : globalThis);
