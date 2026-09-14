"use strict";

/* ==========================================================================
   RENSEIGNE TA CLÉ GEMINI ICI (gratuite sur https://aistudio.google.com/apikey)
   ATTENTION : contrairement à l'ancienne version, ce fichier tourne dans le
   navigateur de la personne qui utilise l'appli, pas sur un serveur privé.
   N'importe qui ayant l'URL de l'appli et sachant ouvrir les outils
   développeur du navigateur peut voir cette clé en clair. C'est un choix
   raisonnable pour un usage perso/entre amis de confiance (clé gratuite,
   pas de facturation possible dessus), mais ne mets jamais ici une clé que
   tu utilises aussi ailleurs pour un projet sensible.
   ========================================================================== */
const GEMINI_API_KEY = "COLLE_TA_CLE_ICI";

/* ---------- Logique musicale (équivalent JS de model.py) ---------- */

const FLATS = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const NOTE_TO_SEMITONE = {
  C: 0, "B#": 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, Fb: 4,
  "E#": 5, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9,
  "A#": 10, Bb: 10, B: 11, Cb: 11,
};
const CHORD_RE = /^([A-Ga-g][b#]?)([^/]*)(?:\/([A-Ga-g][b#]?))?$/;

function normalizeNote(note) {
  note = note[0].toUpperCase() + note.slice(1);
  if (!(note in NOTE_TO_SEMITONE)) throw new Error(`Note non reconnue : ${note}`);
  return note;
}

function parseChord(symbol) {
  const m = CHORD_RE.exec(symbol.trim());
  if (!m) throw new Error(`Accord non reconnu : ${symbol}`);
  let [, root, quality, bass] = m;
  root = normalizeNote(root);
  if (bass) bass = normalizeNote(bass);
  return { semitone: NOTE_TO_SEMITONE[root], quality, bass };
}

function keyRoot(symbol) {
  return FLATS[parseChord(symbol).semitone];
}

function mod12(n) { return ((n % 12) + 12) % 12; }

function transposeChord(symbol, shift) {
  const { semitone, quality, bass } = parseChord(symbol);
  let result = FLATS[mod12(semitone + shift)] + quality;
  if (bass) {
    const bassSemitone = NOTE_TO_SEMITONE[bass];
    result += "/" + FLATS[mod12(bassSemitone + shift)];
  }
  return result;
}

function transposeBars(bars, baseKey, targetKey) {
  const shift = parseChord(targetKey).semitone - parseChord(baseKey).semitone;
  return bars.map((bar) => bar.map((c) => transposeChord(c, shift)));
}

function slugify(title) {
  return title.trim().replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function normalizeTitle(title) {
  if (title === title.toUpperCase()) {
    return title.replace(/\w\S*/g, (t) => t[0] + t.slice(1).toLowerCase());
  }
  return title;
}

/* ---------- Analyse harmonique (2-5-1, anatoles, christophes) ---------- */
/* Heuristique sur la chaîne de qualité de l'accord — fonctionne pour les
   écritures courantes, mais peut se tromper sur des symboles inhabituels. */
function qualityCategory(quality) {
  const q = quality.toLowerCase();
  if (q.includes("m7b5") || q.includes("ø") || q.includes("dim")) return "halfdim_or_dim";
  if (q.startsWith("maj")) return "major";
  if (q.startsWith("m") && !q.startsWith("maj")) return "minor";
  if (q === "" || q.startsWith("6")) return "major";
  if (/^(7|9|11|13)/.test(q)) return "dominant";
  return "other";
}

const HL_COLORS = {
  "251-major": "#d7f0d2",
  "251-minor": "#d7f0d2",
  anatole: "#d2e6f5",
  christophe: "#f5d6e3",
};
const HL_TEXT_COLORS = {
  "251-major": "#2f6b2a",
  "251-minor": "#2f6b2a",
  anatole: "#2a5a8a",
  christophe: "#8a2f57",
};

function analyzeProgressions(bars) {
  const flat = [];
  bars.forEach((bar, bi) => {
    bar.forEach((chord, ci) => {
      try {
        const { semitone, quality } = parseChord(chord);
        flat.push({ bi, ci, semitone, category: qualityCategory(quality) });
      } catch (e) {
        flat.push({ bi, ci, semitone: null, category: "other" });
      }
    });
  });

  const claimed = new Set();
  const highlights = {};

  const tryMark = (idxs, type, degrees) => {
    const keys = idxs.map((k) => `${flat[k].bi}-${flat[k].ci}`);
    if (keys.some((k) => claimed.has(k))) return; // déjà pris par une cadence prioritaire
    keys.forEach((k, n) => {
      highlights[k] = { type, degree: degrees[n] };
      claimed.add(k);
    });
  };

  // Priorité 1 : anatoles (I-VI-II-V)
  for (let i = 0; i + 3 < flat.length; i++) {
    const [a, b, c, d] = [flat[i], flat[i + 1], flat[i + 2], flat[i + 3]];
    if ([a, b, c, d].some((x) => x.semitone === null)) continue;
    const s1 = mod12(b.semitone - a.semitone);
    const s2 = mod12(c.semitone - b.semitone);
    const s3 = mod12(d.semitone - c.semitone);
    if (
      s1 === 9 && s2 === 5 && s3 === 5 &&
      a.category === "major" && b.category === "minor" &&
      c.category === "minor" && d.category === "dominant"
    ) {
      tryMark([i, i + 1, i + 2, i + 3], "anatole", ["I", "VI", "II", "V"]);
    }
  }

  // Priorité 1 également : christophe (I - I7 - IV - IVm7, ou IV° un demi-ton au-dessus)
  for (let i = 0; i + 3 < flat.length; i++) {
    const [a, b, c, d] = [flat[i], flat[i + 1], flat[i + 2], flat[i + 3]];
    if ([a, b, c, d].some((x) => x.semitone === null)) continue;
    const sameRootAB = mod12(b.semitone - a.semitone) === 0;
    const fourthAC = mod12(c.semitone - a.semitone) === 5;
    const sameRootCD = mod12(d.semitone - c.semitone) === 0;
    const semitoneUpCD = mod12(d.semitone - c.semitone) === 1;
    if (
      sameRootAB && fourthAC &&
      a.category === "major" && b.category === "dominant" && c.category === "major" &&
      ((sameRootCD && d.category === "minor") ||
        (semitoneUpCD && d.category === "halfdim_or_dim"))
    ) {
      tryMark([i, i + 1, i + 2, i + 3], "christophe", ["I", "I7", "IV", "IVm7"]);
    }
  }

  // Priorité 2 : II-V-I majeur / mineur
  for (let i = 0; i + 2 < flat.length; i++) {
    const [a, b, c] = [flat[i], flat[i + 1], flat[i + 2]];
    if (a.semitone === null || b.semitone === null || c.semitone === null) continue;
    const s1 = mod12(b.semitone - a.semitone);
    const s2 = mod12(c.semitone - b.semitone);
    if (s1 === 5 && s2 === 5) {
      if (a.category === "minor" && b.category === "dominant" && c.category === "major") {
        tryMark([i, i + 1, i + 2], "251-major", ["II", "V", "I"]);
      } else if (
        a.category === "halfdim_or_dim" &&
        b.category === "dominant" &&
        c.category === "minor"
      ) {
        tryMark([i, i + 1, i + 2], "251-minor", ["II", "V", "I"]);
      }
    }
  }

  return highlights;
}

/* ---------- Icônes ---------- */

const COPY_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
const PASTE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"></path><rect x="8" y="2" width="8" height="4" rx="1"></rect></svg>`;

/* ---------- État de l'appli ---------- */

const LIB_KEY = "grilles_jazz_library";
let library = {};
let currentSlug = null;
let currentKey = "C";
let columnsCount = 8;
let copiedRow = null;
let editMode = false;

function saveLibrary() {
  localStorage.setItem(LIB_KEY, JSON.stringify(library));
}

async function loadLibrary() {
  const stored = localStorage.getItem(LIB_KEY);
  if (stored) {
    library = JSON.parse(stored);
    return;
  }
  try {
    const resp = await fetch("default-songs.json");
    library = await resp.json();
  } catch (e) {
    library = {};
  }
  saveLibrary();
}

/* ---------- Combobox de sélection de morceau ---------- */

const comboTrigger = document.getElementById("combobox-trigger");
const comboPanel = document.getElementById("combobox-panel");

comboTrigger.addEventListener("click", () => {
  const wasHidden = comboPanel.hidden;
  document.getElementById("menu-panel").hidden = true;
  comboPanel.hidden = !wasHidden;
  if (wasHidden) {
    const search = document.getElementById("song-search");
    search.value = "";
    renderSongList("");
    search.focus();
  }
});

document.addEventListener("click", (e) => {
  if (!document.getElementById("song-combobox").contains(e.target)) {
    comboPanel.hidden = true;
  }
  if (!document.querySelector(".menu-wrap").contains(e.target)) {
    document.getElementById("menu-panel").hidden = true;
  }
});

function renderSongList(filter = "") {
  const listEl = document.getElementById("song-list");
  listEl.innerHTML = "";
  const q = filter.trim().toLowerCase();
  Object.keys(library)
    .sort()
    .forEach((slug) => {
      const title = library[slug].title || slug.replace(/_/g, " ");
      if (q && !title.toLowerCase().includes(q) && !slug.toLowerCase().includes(q)) return;
      const btn = document.createElement("button");
      btn.textContent = title;
      btn.className = "song-item" + (slug === currentSlug ? " active" : "");
      btn.addEventListener("click", () => {
        selectSong(slug);
        comboPanel.hidden = true;
      });
      listEl.appendChild(btn);
    });
}

document.getElementById("song-search").addEventListener("input", (e) => {
  renderSongList(e.target.value);
});

function renderKeySelect() {
  const sel = document.getElementById("key-select");
  sel.innerHTML = "";
  FLATS.forEach((note) => {
    const opt = document.createElement("option");
    opt.value = note;
    opt.textContent = note;
    if (note === currentKey) opt.selected = true;
    sel.appendChild(opt);
  });
}

document.getElementById("key-select").addEventListener("change", (e) => {
  currentKey = e.target.value;
  renderGrid();
});

function selectSong(slug) {
  currentSlug = slug;
  const song = library[slug];
  currentKey = keyRoot(song.base_key);
  document.getElementById("song-title").textContent = song.title;
  document.getElementById("song-form").textContent = song.form || "";
  document.getElementById("validated-checkbox").checked = !!song.validated;
  document.getElementById("combobox-label").textContent = song.title || slug.replace(/_/g, " ");
  document.getElementById("edit-error").hidden = true;
  renderKeySelect();
  renderSongList(document.getElementById("song-search").value);
  renderGrid();
}

/* ---------- Mode édition ---------- */

document.getElementById("edit-mode-btn").addEventListener("click", () => {
  editMode = !editMode;
  document.getElementById("edit-mode-btn").classList.toggle("active", editMode);
  document.getElementById("add-remove-row").hidden = !editMode;
  renderGrid();
});

/* ---------- Grille ---------- */

function renderGrid() {
  const song = library[currentSlug];
  const bars = transposeBars(song.bars, song.base_key, currentKey);
  columnsCount = bars.length <= 16 ? 4 : 8;

  const analyzeOn = document.getElementById("analyze-checkbox").checked;
  const highlights = analyzeOn ? analyzeProgressions(bars) : {};

  const gridEl = document.getElementById("grid");
  gridEl.style.transform = "none";
  gridEl.style.marginBottom = "0px";
  gridEl.style.gridTemplateColumns = editMode
    ? `auto repeat(${columnsCount}, 1fr)`
    : `repeat(${columnsCount}, 1fr)`;
  gridEl.innerHTML = "";

  const numRows = Math.ceil(bars.length / columnsCount);
  for (let r = 0; r < numRows; r++) {
    if (editMode) {
      const ctrl = document.createElement("div");
      ctrl.className = "row-ctrl";
      const copyBtn = document.createElement("button");
      copyBtn.className = "icon-btn";
      copyBtn.title = "Copier la ligne";
      copyBtn.innerHTML = COPY_ICON;
      copyBtn.addEventListener("click", () => copyRow(r));
      const pasteBtn = document.createElement("button");
      pasteBtn.className = "icon-btn";
      pasteBtn.title = "Coller la ligne";
      pasteBtn.innerHTML = PASTE_ICON;
      pasteBtn.disabled = !copiedRow;
      pasteBtn.addEventListener("click", () => pasteRow(r));
      ctrl.appendChild(copyBtn);
      ctrl.appendChild(pasteBtn);
      gridEl.appendChild(ctrl);
    }

    for (let c = 0; c < columnsCount; c++) {
      const i = r * columnsCount + c;
      if (i >= bars.length) {
        gridEl.appendChild(document.createElement("div"));
        continue;
      }
      const cell = document.createElement("div");
      cell.className = "bar-cell";
      cell.dataset.index = i;
      renderBarContent(cell, bars[i], i, highlights);
      cell.addEventListener("dblclick", () => startEditBar(i));
      gridEl.appendChild(cell);
    }
  }
  requestAnimationFrame(fitGridToScreen);
}

// Plutôt que de compter sur le pincement du navigateur (qui a des limites
// variables selon l'appareil et le système), on calcule directement la
// place disponible et on réduit la grille en conséquence si besoin, pour
// que toutes les lignes soient toujours visibles sans avoir à zoomer.
function fitGridToScreen() {
  const gridEl = document.getElementById("grid");
  if (!gridEl.children.length) return;
  const rect = gridEl.getBoundingClientRect();
  const reserveBelow = editMode ? 140 : 60; // place pour ce qui suit la grille
  const available = window.innerHeight - rect.top - reserveBelow;
  const scale = Math.min(1, Math.max(available / rect.height, 0.35));
  gridEl.style.transformOrigin = "top left";
  gridEl.style.transform = `scale(${scale})`;
  const gap = rect.height * (1 - scale);
  gridEl.style.marginBottom = `-${gap}px`;
}

window.addEventListener("resize", () => requestAnimationFrame(fitGridToScreen));
window.addEventListener("orientationchange", () => {
  setTimeout(() => requestAnimationFrame(fitGridToScreen), 250);
});

function renderBarContent(cell, bar, barIndex, highlights) {
  cell.innerHTML = "";
  const hl = (ci) => highlights[`${barIndex}-${ci}`];

  const addDegreeLabel = (parent, h) => {
    const label = document.createElement("span");
    label.className = "degree-label";
    label.textContent = h.degree;
    label.style.color = HL_TEXT_COLORS[h.type];
    parent.appendChild(label);
  };

  if (bar.length === 1) {
    const span = document.createElement("span");
    span.className = "chord chord-single";
    span.textContent = bar[0];
    const h = hl(0);
    if (h) {
      cell.style.background = HL_COLORS[h.type];
      addDegreeLabel(cell, h);
    }
    cell.appendChild(span);
  } else if (bar.length === 2) {
    const h0 = hl(0);
    const h1 = hl(1);
    let fillSvg = "";
    if (h0) fillSvg += `<polygon points="0,0 100,0 0,100" fill="${HL_COLORS[h0.type]}"></polygon>`;
    if (h1) fillSvg += `<polygon points="100,0 100,100 0,100" fill="${HL_COLORS[h1.type]}"></polygon>`;
    cell.insertAdjacentHTML(
      "beforeend",
      `<svg class="diagonal-line" viewBox="0 0 100 100" preserveAspectRatio="none">${fillSvg}<line x1="100" y1="0" x2="0" y2="100"></line></svg>`
    );
    const top = document.createElement("span");
    top.className = "chord chord-top";
    top.textContent = bar[0];
    const bottom = document.createElement("span");
    bottom.className = "chord chord-bottom";
    bottom.textContent = bar[1];
    cell.appendChild(top);
    cell.appendChild(bottom);
    if (h0) {
      const label = document.createElement("span");
      label.className = "degree-label degree-label-topleft";
      label.textContent = h0.degree;
      label.style.color = HL_TEXT_COLORS[h0.type];
      cell.appendChild(label);
    }
    if (h1) {
      const label = document.createElement("span");
      label.className = "degree-label degree-label-right";
      label.textContent = h1.degree;
      label.style.color = HL_TEXT_COLORS[h1.type];
      cell.appendChild(label);
    }
    requestAnimationFrame(() => positionDiagonalText(cell, top, bottom));
  } else {
    const wrap = document.createElement("div");
    wrap.className = "quad";
    bar.slice(0, 4).forEach((chord, ci) => {
      const quadCell = document.createElement("div");
      quadCell.className = "chord-quad-cell";
      const span = document.createElement("span");
      span.className = "chord chord-quad";
      span.textContent = chord;
      quadCell.appendChild(span);
      const h = hl(ci);
      if (h) {
        quadCell.style.background = HL_COLORS[h.type];
        const label = document.createElement("span");
        label.className = "degree-label degree-label-quad";
        label.textContent = h.degree;
        label.style.color = HL_TEXT_COLORS[h.type];
        quadCell.appendChild(label);
      }
      wrap.appendChild(quadCell);
    });
    cell.appendChild(wrap);
  }
}

function positionDiagonalText(cell, topEl, bottomEl) {
  const w = cell.clientWidth;
  const h = cell.clientHeight;
  if (!w || !h) return;

  const yTop = h * 0.32;
  const availTop = Math.max(w * (1 - yTop / h) - 6, 20);
  topEl.style.left = "3px";
  topEl.style.width = availTop + "px";
  topEl.style.top = yTop - topEl.offsetHeight / 2 + "px";
  topEl.style.textAlign = "center";

  const yBottom = h * 0.68;
  const availBottom = Math.max(w * (yBottom / h) - 6, 20);
  bottomEl.style.right = "3px";
  bottomEl.style.width = availBottom + "px";
  bottomEl.style.top = yBottom - bottomEl.offsetHeight / 2 + "px";
  bottomEl.style.textAlign = "center";
}

/* ---------- Édition d'une mesure ---------- */

function startEditBar(i) {
  const song = library[currentSlug];
  const bars = transposeBars(song.bars, song.base_key, currentKey);
  const cell = document.querySelector(`.bar-cell[data-index="${i}"]`);
  const value = bars[i].join(", ");
  cell.innerHTML = "";
  const input = document.createElement("input");
  input.type = "text";
  input.className = "bar-edit-input";
  input.value = value;
  cell.appendChild(input);
  input.focus();
  input.select();
  input.addEventListener("blur", () => saveEditBar(i, input.value));
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") input.blur();
  });
}

function saveEditBar(i, value) {
  const song = library[currentSlug];
  const errorEl = document.getElementById("edit-error");
  const displayedChords = value.split(",").map((s) => s.trim()).filter(Boolean);

  if (displayedChords.length === 0) {
    errorEl.textContent = "Une mesure ne peut pas être vide.";
    errorEl.hidden = false;
    renderGrid();
    return;
  }
  try {
    const shift = parseChord(currentKey).semitone - parseChord(song.base_key).semitone;
    song.bars[i] = displayedChords.map((c) => transposeChord(c, -shift));
    errorEl.hidden = true;
  } catch (e) {
    errorEl.textContent = e.message;
    errorEl.hidden = false;
  }
  saveLibrary();
  renderGrid();
}

/* ---------- Copier / coller une ligne ---------- */

function copyRow(r) {
  const song = library[currentSlug];
  const start = r * columnsCount;
  copiedRow = song.bars.slice(start, start + columnsCount).map((b) => [...b]);
  renderGrid();
}

function pasteRow(r) {
  if (!copiedRow) return;
  const song = library[currentSlug];
  const start = r * columnsCount;
  for (let k = 0; k < copiedRow.length && start + k < song.bars.length; k++) {
    song.bars[start + k] = [...copiedRow[k]];
  }
  saveLibrary();
  renderGrid();
}

document.getElementById("add-row-btn").addEventListener("click", () => {
  const song = library[currentSlug];
  for (let k = 0; k < columnsCount; k++) song.bars.push(["C"]);
  saveLibrary();
  renderGrid();
});

document.getElementById("remove-row-btn").addEventListener("click", () => {
  const song = library[currentSlug];
  if (song.bars.length <= columnsCount) return;
  song.bars.splice(song.bars.length - columnsCount, columnsCount);
  saveLibrary();
  renderGrid();
});

document.getElementById("validated-checkbox").addEventListener("change", (e) => {
  library[currentSlug].validated = e.target.checked;
  saveLibrary();
});

document.getElementById("analyze-checkbox").addEventListener("change", () => {
  renderGrid();
});

/* ---------- Menu (créer / importer / exporter) ---------- */

document.getElementById("menu-btn").addEventListener("click", (e) => {
  e.stopPropagation();
  const panel = document.getElementById("menu-panel");
  const wasHidden = panel.hidden;
  comboPanel.hidden = true;
  panel.hidden = !wasHidden;
});

document.getElementById("new-song-menu-item").addEventListener("click", () => {
  document.getElementById("menu-panel").hidden = true;
  document.getElementById("new-song-panel").hidden = false;
  document.getElementById("new-song-title").value = "";
  document.getElementById("new-song-title").focus();
});

document.getElementById("confirm-new-song").addEventListener("click", confirmCreateSong);
document.getElementById("cancel-new-song").addEventListener("click", () => {
  document.getElementById("new-song-panel").hidden = true;
});

function confirmCreateSong() {
  const title = document.getElementById("new-song-title").value.trim();
  const numBars = parseInt(document.getElementById("new-song-bars").value, 10);
  if (!title) return;
  const base = slugify(title);
  let slug = base;
  let n = 1;
  while (library[slug]) {
    n++;
    slug = `${base}_${n}`;
  }
  library[slug] = {
    title,
    base_key: "C",
    form: "",
    source: "saisie manuelle",
    validated: false,
    bars: Array.from({ length: numBars }, () => ["C"]),
  };
  saveLibrary();
  document.getElementById("new-song-panel").hidden = true;

  editMode = true;
  document.getElementById("edit-mode-btn").classList.add("active");
  document.getElementById("add-remove-row").hidden = false;

  renderSongList();
  selectSong(slug);
}

document.getElementById("import-menu-item").addEventListener("click", () => {
  document.getElementById("menu-panel").hidden = true;
  document.getElementById("import-input").click();
});

document.getElementById("import-input").addEventListener("change", async (e) => {
  for (const file of e.target.files) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      if (parsed.bars) {
        const slug = file.name.replace(/\.json$/i, "");
        library[slug] = parsed;
      } else {
        Object.assign(library, parsed);
      }
    } catch (err) {
      alert(`Erreur d'import pour ${file.name} : ${err.message}`);
    }
  }
  saveLibrary();
  renderSongList();
  e.target.value = "";
});

document.getElementById("export-menu-item").addEventListener("click", () => {
  document.getElementById("menu-panel").hidden = true;
  const blob = new Blob([JSON.stringify(library, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "grilles_export.json";
  a.click();
});

/* ---------- Synchronisation avec default-songs.json ---------- */

let syncRemote = null;
let syncNewSlugs = [];

document.getElementById("sync-menu-item").addEventListener("click", async () => {
  document.getElementById("menu-panel").hidden = true;
  try {
    const resp = await fetch(`default-songs.json?t=${Date.now()}`, { cache: "no-store" });
    syncRemote = await resp.json();
  } catch (e) {
    alert("Impossible de récupérer le fichier default-songs.json : " + e.message);
    return;
  }
  const remoteSlugs = Object.keys(syncRemote);
  syncNewSlugs = remoteSlugs.filter((s) => !(s in library));
  const existingCount = remoteSlugs.length - syncNewSlugs.length;
  document.getElementById("sync-summary").textContent =
    `${syncNewSlugs.length} nouvelle(s) grille(s) sur le serveur, ${existingCount} déjà présente(s) chez toi (potentiellement modifiées).`;
  document.getElementById("sync-panel").hidden = false;
});

document.getElementById("sync-new-only").addEventListener("click", () => {
  syncNewSlugs.forEach((s) => (library[s] = syncRemote[s]));
  saveLibrary();
  renderSongList();
  document.getElementById("sync-panel").hidden = true;
  alert(`${syncNewSlugs.length} nouvelle(s) grille(s) ajoutée(s). Tes grilles existantes n'ont pas été touchées.`);
});

document.getElementById("sync-overwrite").addEventListener("click", () => {
  Object.assign(library, syncRemote);
  saveLibrary();
  renderSongList();
  if (currentSlug) selectSong(currentSlug);
  document.getElementById("sync-panel").hidden = true;
  alert("Toutes les grilles du serveur ont remplacé tes versions locales.");
});

document.getElementById("sync-cancel").addEventListener("click", () => {
  document.getElementById("sync-panel").hidden = true;
});

/* ---------- Ajout d'une grille par photo (Gemini) ---------- */

// Comme pour l'ancien script Python : si "model not found", vérifie le nom
// actuel du modèle Flash sur https://aistudio.google.com/
const GEMINI_MODEL = "gemini-3-flash-preview";

const GEMINI_PROMPT = `
Tu regardes l'image d'une grille d'accords de jazz (chart/changes).
Renvoie UNIQUEMENT un objet JSON valide, sans texte autour, sans balises
markdown, avec exactement cette structure :

{
  "title": "Nom du morceau",
  "base_key": "Bb",
  "form": "AABA",
  "source": "photo fournie par l'utilisateur",
  "bars": [
    ["Bb"], ["G7"], ["Cm7", "F7"]
  ]
}

Règles :
- "bars" est une liste, une entrée par mesure, dans l'ordre de lecture de la
  grille (gauche à droite, haut en bas). Ne saute aucune mesure.
- Chaque mesure est une liste d'un, deux, trois ou quatre accords en texte
  brut, écrits comme sur une partition : ex. "Ab", "Bbm7", "C7b9", "Gm7b5",
  "Bdim", "Fmaj7". Utilise des bémols (b) plutôt que des dièses (#).
- "base_key" est la tonalité de la grille telle que lue dans l'image (une
  seule note, avec b si besoin, ex. "Eb"), avec "m" collé si c'est une
  tonalité mineure (ex. "Gm").
- Si un élément n'est pas clairement lisible, fais ton meilleur jugement
  plutôt que d'inventer un accord qui n'a pas de sens harmonique, mais ne
  laisse jamais un champ vide.
`;

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

async function extraireGrilleDepuisImage(base64, mimeType) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;
  const body = {
    contents: [
      {
        parts: [
          { inline_data: { mime_type: mimeType, data: base64 } },
          { text: GEMINI_PROMPT },
        ],
      },
    ],
  };
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok) {
    const errText = await resp.text();
    throw new Error(`Erreur Gemini (${resp.status}) : ${errText}`);
  }
  const data = await resp.json();
  let text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
  text = text.trim().replace(/^```(json)?/, "").replace(/```$/, "").trim();
  const grille = JSON.parse(text);
  for (const champ of ["title", "base_key", "form", "bars"]) {
    if (!(champ in grille)) throw new Error(`Champ manquant dans la réponse de Gemini : ${champ}`);
  }
  return grille;
}

document.getElementById("photo-btn").addEventListener("click", () => {
  document.getElementById("photo-input").click();
});

document.getElementById("photo-input").addEventListener("change", async (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const statusEl = document.getElementById("upload-status");
  if (!GEMINI_API_KEY || GEMINI_API_KEY === "COLLE_TA_CLE_ICI") {
    statusEl.textContent = "Renseigne ta clé Gemini en haut de app.js (voir README).";
    e.target.value = "";
    return;
  }
  statusEl.textContent = "Analyse de l'image en cours...";
  try {
    const base64 = await fileToBase64(file);
    const grille = await extraireGrilleDepuisImage(base64, file.type || "image/jpeg");
    grille.title = normalizeTitle(grille.title);
    grille.validated = false;
    const slug = slugify(grille.title);
    library[slug] = grille;
    saveLibrary();
    renderSongList();
    selectSong(slug);
    statusEl.textContent = `Ajoutée : ${grille.title}`;
  } catch (err) {
    statusEl.textContent = `Erreur : ${err.message}`;
  }
  e.target.value = "";
});

/* ---------- Démarrage ---------- */

async function init() {
  await loadLibrary();
  const slugs = Object.keys(library).sort();
  renderSongList();
  if (slugs.length > 0) selectSong(slugs[0]);
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(console.error);
  }
}

init();
