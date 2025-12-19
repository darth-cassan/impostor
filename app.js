/* eslint-disable no-alert */

const STORAGE_KEY = "impostor:setup:v1";

const DEFAULT_WORDS = [
  "Pineapple",
  "Volcano",
  "Spaceship",
  "Moonlight",
  "Espresso",
  "Skateboard",
  "Rainbow",
  "Piano",
  "Telescope",
  "Waterfall",
  "Sushi",
  "Cactus",
  "Fireworks",
  "Octopus",
  "Treasure",
  "Jungle",
  "Dragon",
  "Lantern",
  "Snowstorm",
  "Sunflower",
  "Lighthouse",
  "Chameleon",
  "Marshmallow",
  "Thunder",
  "Neon",
  "Galaxy",
  "Coral",
  "Origami",
  "Backpack",
  "Chocolate",
  "Hammock",
  "Popsicle",
  "Sandcastle",
  "Bicycle",
  "Bubblegum",
  "Tornado",
  "Aurora",
  "Mermaid",
  "Pirate",
  "Cupcake",
  "Meteor",
  "Dolphin",
  "Castle",
  "Bonsai",
  "Comet",
  "Penguin",
  "Iceberg",
  "Cinnamon",
  "Disco",
  "Mango",
];

const el = (id) => document.getElementById(id);
const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

function on(id, event, handler, options) {
  const node = el(id);
  if (!node) return null;
  node.addEventListener(event, handler, options);
  return node;
}

function focusId(id) {
  const node = el(id);
  if (node && typeof node.focus === "function") node.focus();
}

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function normalizeName(raw) {
  return raw
    .trim()
    .replace(/\s+/g, " ")
    .replace(/^[,.-]+|[,.-]+$/g, "");
}

function capitalizeFirstLetter(text) {
  const s = String(text || "").trim();
  if (!s) return "";
  return s[0].toLocaleUpperCase("es-ES") + s.slice(1);
}

function uniqByCaseInsensitive(names) {
  const seen = new Set();
  const out = [];
  for (const name of names) {
    const key = name.toLocaleLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
  }
  return out;
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function loadWordsFromTextFile(path) {
  const res = await fetch(path, { cache: "no-cache" });
  if (!res.ok) throw new Error(`Failed to load words: ${res.status}`);
  const text = await res.text();
  const words = text
    .split(/\r?\n/g)
    .map((line) => capitalizeFirstLetter(line))
    .filter((line) => line && !line.startsWith("#"));
  return uniqByCaseInsensitive(words);
}

function saveSetup(participants, impostorCount) {
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ participants, impostorCount, savedAt: Date.now() }),
    );
  } catch {
    // ignore
  }
}

function loadSetup() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.participants)) return null;
    return {
      participants: parsed.participants.filter((n) => typeof n === "string"),
      impostorCount: Number.isFinite(parsed.impostorCount)
        ? parsed.impostorCount
        : 1,
    };
  } catch {
    return null;
  }
}

const state = {
  view: "home",
  participants: [],
  impostorCount: 1,
  words: DEFAULT_WORDS,
  word: "",
  assignments: [],
  turnIndex: 0,
  revealed: false,
  starter: "",
};

function setView(view) {
  state.view = view;
  document.body.dataset.view = view;
  for (const node of document.querySelectorAll(".view")) {
    node.classList.toggle("active", node.dataset.view === view);
  }
}

function updateSetupUI() {
  const count = state.participants.length;
  el("playerCount").textContent = `${count} jugador${count === 1 ? "" : "es"}`;

  // Require fewer impostors than jugadores normales:
  // impostores < (jugadores - impostores)  =>  2*impostores < jugadores
  const maxImpostors = Math.max(1, Math.floor((count - 1) / 2));
  el("impostorRange").max = String(maxImpostors);
  el("impostorMaxLabel").textContent = String(maxImpostors);

  state.impostorCount = clamp(state.impostorCount, 1, maxImpostors);
  el("impostorRange").value = String(state.impostorCount);
  el("impostorCountLabel").textContent = String(state.impostorCount);

  const sliderBlock = el("impostorSliderBlock");
  if (sliderBlock) sliderBlock.style.display = maxImpostors === 1 ? "none" : "";

  const chips = el("nameChips");
  chips.innerHTML = "";
  for (const [idx, name] of state.participants.entries()) {
    const chip = document.createElement("div");
    chip.className = "chip";

    const text = document.createElement("span");
    text.textContent = name;

    const del = document.createElement("button");
    del.type = "button";
    del.title = `Eliminar ${name}`;
    del.setAttribute("aria-label", `Eliminar ${name}`);
    del.textContent = "×";
    del.addEventListener("click", () => {
      state.participants.splice(idx, 1);
      updateSetupUI();
      saveSetup(state.participants, state.impostorCount);
    });

    chip.append(text, del);
    chips.appendChild(chip);
  }

}

function setSetupError(message) {
  el("setupError").textContent = message || "";
}

function hydrateFromSavedSetup() {
  const loaded = loadSetup();
  if (!loaded) return false;
  const participants = uniqByCaseInsensitive(
    loaded.participants.map(normalizeName).filter(Boolean),
  );
  if (participants.length < 3) return false;
  state.participants = participants;
  state.impostorCount = clamp(
    loaded.impostorCount || 1,
    1,
    Math.max(1, Math.floor((participants.length - 1) / 2)),
  );
  return true;
}

function newRound() {
  // Randomize turn order each round (input order stays the same in setup).
  const players = shuffleInPlace([...state.participants]);
  const impostors = clamp(state.impostorCount, 1, Math.max(1, Math.floor((players.length - 1) / 2)));

  const indices = players.map((_, i) => i);
  shuffleInPlace(indices);
  const impostorIdx = new Set(indices.slice(0, impostors));

  const pool = Array.isArray(state.words) && state.words.length ? state.words : DEFAULT_WORDS;
  state.word = pickRandom(pool);
  state.assignments = players.map((name, i) => ({
    name,
    isImpostor: impostorIdx.has(i),
  }));

  state.turnIndex = 0;
  state.revealed = false;
  state.starter = pickRandom(players);
}

function setTurnUI() {
  const total = state.assignments.length;
  const current = state.assignments[state.turnIndex];
  el("turnBadge").textContent = `Jugador ${state.turnIndex + 1} de ${total}`;
  el("turnProgress").textContent = state.revealed ? "Revelado" : "Oculto";
  el("turnName").textContent = current?.name ?? "—";

  // reset reveal card
  const revealArea = el("revealArea");
  revealArea.classList.toggle("revealed", state.revealed);
  el("revealBack").setAttribute("aria-hidden", state.revealed ? "false" : "true");

  el("btnNext").disabled = !state.revealed;
  el("btnNext").textContent =
    state.turnIndex === total - 1 ? "Empezar" : "Siguiente";

  if (!state.revealed) {
    el("roleLabel").textContent = "";
    el("wordLabel").textContent = "";
  }
}

function revealCurrent() {
  if (state.revealed) return;
  const current = state.assignments[state.turnIndex];
  if (!current) return;

  state.revealed = true;
  const revealArea = el("revealArea");
  revealArea.classList.add("revealed");
  el("revealBack").setAttribute("aria-hidden", "false");
  el("turnProgress").textContent = "Revelado";

  if (current.isImpostor) {
    el("roleLabel").textContent = "ERES EL IMPOSTOR";
    el("wordLabel").textContent = "IMPOSTOR";
    el("wordLabel").style.background = "none";
    el("wordLabel").style.color = "rgba(251,113,133,.98)";
    el("wordLabel").style.webkitTextFillColor = "rgba(251,113,133,.98)";
    el("roleHint").textContent =
      "Escucha a los demás, finge seguridad y adivina la palabra sin que te descubran.";
  } else {
    el("roleLabel").textContent = "PALABRA SECRETA";
    el("wordLabel").textContent = state.word;
    el("wordLabel").style.background = "";
    el("wordLabel").style.color = "";
    el("wordLabel").style.webkitTextFillColor = "";
    el("roleHint").textContent =
      "Habla de la palabra sin decirla literalmente e intenta descubrir al impostor.";
  }

  el("btnNext").disabled = false;
}

function nextTurn() {
  const last = state.turnIndex === state.assignments.length - 1;
  if (last) {
    el("starterName").textContent = state.starter;
    setView("begin");
    return;
  }
  state.turnIndex += 1;
  state.revealed = false;
  setTurnUI();
}

function renderResults() {
  const impostors = state.assignments.filter((a) => a.isImpostor).map((a) => a.name);
  el("impostorNames").textContent = impostors.length ? impostors.join(", ") : "—";
  el("resultsWord").textContent = state.word || "—";
}

function resetAll() {
  if (!confirm("¿Reiniciar la partida y la configuración?")) return;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
  state.participants = [];
  state.impostorCount = 1;
  state.word = "";
  state.assignments = [];
  state.turnIndex = 0;
  state.revealed = false;
  state.starter = "";
  setSetupError("");
  updateSetupUI();
  setView("home");
}

function wireEvents() {
  on("btnGoSetup", "click", () => {
    setSetupError("");
    setView("setup");
    focusId("nameInput");
  });

  on("btnBackHome", "click", () => setView("home"));

  on("btnReset", "click", resetAll);

  const addName = () => {
    const input = el("nameInput");
    const raw = input ? input.value : "";
    const name = normalizeName(raw);
    if (!name) return;
    state.participants = uniqByCaseInsensitive([...state.participants, name]);
    if (input) input.value = "";
    setSetupError("");
    updateSetupUI();
    saveSetup(state.participants, state.impostorCount);
    focusId("nameInput");
  };

  on("btnAddName", "click", addName);
  on("nameInput", "keydown", (e) => {
    if (e.key === "Enter") addName();
  });

  on("impostorRange", "input", (e) => {
    state.impostorCount = Number(e.target.value);
    el("impostorCountLabel").textContent = String(state.impostorCount);
    saveSetup(state.participants, state.impostorCount);
  });

  on("btnStartGame", "click", () => {
    const count = state.participants.length;
    const maxImpostors = Math.max(1, Math.floor((count - 1) / 2));

    if (count < 3) {
      setSetupError("Agrega al menos 3 participantes.");
      return;
    }
    if (state.impostorCount < 1 || state.impostorCount > maxImpostors) {
      setSetupError(`Debe haber menos impostores que jugadores normales (máximo ${maxImpostors}).`);
      return;
    }

    setSetupError("");
    saveSetup(state.participants, state.impostorCount);
    newRound();
    setView("turn");
    setTurnUI();
  });

  on("btnRestartSetup", "click", () => {
    if (!confirm("¿Seguro que quieres salir? Se perderán los roles actuales.")) return;
    setView("setup");
    setSetupError("");
    updateSetupUI();
    focusId("nameInput");
  });

  on("btnReveal", "click", (e) => {
    e.stopPropagation();
    revealCurrent();
  });

  on("btnNext", "click", nextTurn);

  // Swipe up gesture to reveal
  let touchStartY = null;
  const revealArea = el("revealArea");
  if (revealArea) {
    revealArea.addEventListener("touchstart", (e) => {
      if (!e.touches?.length) return;
      touchStartY = e.touches[0].clientY;
    });
    revealArea.addEventListener("touchend", (e) => {
      const endY = e.changedTouches?.[0]?.clientY;
      if (touchStartY == null || endY == null) return;
      const delta = endY - touchStartY;
      touchStartY = null;
      if (delta < -45) revealCurrent();
    });
  }

  on("btnRevealImpostors", "click", () => {
    renderResults();
    setView("results");
  });

  const playAgain = () => {
    if (state.participants.length < 3) {
      setView("setup");
      return;
    }
    newRound();
    setView("turn");
    setTurnUI();
  };

  on("btnPlayAgain", "click", playAgain);
  on("btnPlayAgain2", "click", playAgain);

  on("btnChangeParticipants", "click", () => {
    setView("setup");
    setSetupError("");
    updateSetupUI();
    focusId("nameInput");
  });
}

function init() {
  wireEvents();

  loadWordsFromTextFile("./words.txt")
    .then((words) => {
      if (Array.isArray(words) && words.length) state.words = words;
    })
    .catch(() => {
      // Keep DEFAULT_WORDS
    });

  // Load saved setup for convenience, but don’t force it.
  if (hydrateFromSavedSetup()) {
    updateSetupUI();
  } else {
    updateSetupUI();
  }

  setView("home");

  // Keep quick start button state fresh if localStorage changes (multiple tabs).
  window.addEventListener("storage", (e) => {
    if (e.key !== STORAGE_KEY) return;
  });
}

document.addEventListener("DOMContentLoaded", init);
