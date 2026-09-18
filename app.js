/* ==========================================================================
   30th Anniversary Celebration — Masterset Tracker
   Data source: the free, public Pokémon TCG API (https://pokemontcg.io)
   No fake cards, no invented numbers: everything shown comes straight from
   the API response. If the set isn't in the database yet, we say so.
   ========================================================================== */

const API_BASE = "https://api.pokemontcg.io/v2";
const STORAGE_KEY = "celebration30th_owned_ids";
const SET_NAME_PATTERN = /30th/i;

const state = {
  cards: [],       // normalized card objects
  owned: new Set(loadOwnedIds()),
  search: "",
  status: "all",    // all | owned | missing
  rarity: "all",
  sort: "number-asc",
  activeModalId: null,
};

// ---------- DOM references ----------

const els = {
  loadingState: document.getElementById("loadingState"),
  loadingText: document.getElementById("loadingText"),
  emptyState: document.getElementById("emptyState"),
  emptyTitle: document.getElementById("emptyTitle"),
  emptySub: document.getElementById("emptySub"),
  retryBtn: document.getElementById("retryBtn"),
  toolbar: document.getElementById("toolbar"),
  grid: document.getElementById("cardGrid"),
  resultsInfo: document.getElementById("resultsInfo"),
  searchInput: document.getElementById("searchInput"),
  sortSelect: document.getElementById("sortSelect"),
  statusChips: document.getElementById("statusChips"),
  rarityChips: document.getElementById("rarityChips"),
  resetBtn: document.getElementById("resetBtn"),
  ownedCount: document.getElementById("ownedCount"),
  totalCount: document.getElementById("totalCount"),
  missingCount: document.getElementById("missingCount"),
  progressPercent: document.getElementById("progressPercent"),
  progressFill: document.getElementById("progressFill"),
  modalBackdrop: document.getElementById("modalBackdrop"),
  modalClose: document.getElementById("modalClose"),
  modalImage: document.getElementById("modalImage"),
  modalRarity: document.getElementById("modalRarity"),
  modalName: document.getElementById("modalName"),
  modalNumber: document.getElementById("modalNumber"),
  modalToggle: document.getElementById("modalToggle"),
};

// ---------- localStorage helpers ----------

function loadOwnedIds() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (err) {
    console.warn("Impossible de lire la collection sauvegardée:", err);
    return [];
  }
}

function saveOwnedIds() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(state.owned)));
  } catch (err) {
    console.warn("Impossible de sauvegarder la collection:", err);
  }
}

// ---------- Data loading ----------

async function init() {
  showLoading("Recherche du set 30th Anniversary Celebration…");
  hide(els.emptyState);
  hide(els.toolbar);
  els.grid.innerHTML = "";
  hide(els.resultsInfo);

  try {
    const set = await findCelebrationSet();
    if (!set) {
      showEmpty(
        "Le set n'est pas encore disponible dans l'API",
        "L'API publique Pokémon TCG (pokemontcg.io) ne référence pas encore de set contenant \u00ab 30th \u00bb dans son nom. Ce set étant tout juste sorti, la base de données communautaire qui alimente l'API peut mettre du temps à être mise à jour. Réessayez un peu plus tard — aucune carte inventée ne sera affichée ici en attendant."
      );
      return;
    }

    showLoading(`Chargement du Master Set \u00ab ${set.name} \u00bb…`);
    const rawCards = await fetchAllCardsForSet(set.id, set.name);

    if (!rawCards.length) {
      showEmpty(
        "Aucune carte trouvée pour ce set",
        `Le set \u00ab ${set.name} \u00bb a été localisé dans l'API mais ne contient encore aucune carte indexée. Réessayez un peu plus tard.`
      );
      return;
    }

    state.cards = rawCards.map(normalizeCard);
    buildRarityChips();
    hide(els.loadingState);
    show(els.toolbar);
    render();
  } catch (err) {
    console.error(err);
    showEmpty(
      "Impossible de contacter l'API Pokémon TCG",
      `Une erreur empêche de récupérer les données depuis pokemontcg.io. Vérifiez votre connexion et réessayez. Détail technique : ${err.message}`
    );
  }
}

// Small helper: fetch with a couple of retries (handles transient 429/5xx and
// blips from the free, unauthenticated pokemontcg.io API).
async function fetchWithRetry(url, attempts = 3) {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url);
      if (res.status === 429 || res.status >= 500) {
        lastErr = new Error(`HTTP ${res.status} depuis ${url}`);
      } else if (!res.ok) {
        throw new Error(`HTTP ${res.status} depuis ${url}`);
      } else {
        return res;
      }
    } catch (err) {
      lastErr = err;
    }
    // wait a bit longer each retry before trying again
    await new Promise((resolve) => setTimeout(resolve, 600 * (i + 1)));
  }
  throw lastErr;
}

async function findCelebrationSet() {
  const res = await fetchWithRetry(`${API_BASE}/sets?pageSize=250`);
  const json = await res.json();
  const sets = Array.isArray(json.data) ? json.data : [];
  const candidates = sets.filter((s) => SET_NAME_PATTERN.test(s.name || ""));
  if (!candidates.length) return null;
  // Prefer the largest matching set (the main expansion rather than a small promo subset)
  candidates.sort((a, b) => (b.total || 0) - (a.total || 0));
  return candidates[0];
}

async function fetchAllCardsForSet(setId) {
  const pageSize = 250;
  let page = 1;
  let out = [];
  let totalCount = Infinity;

  while (out.length < totalCount) {
    const url = `${API_BASE}/cards?q=set.id:${encodeURIComponent(setId)}&pageSize=${pageSize}&page=${page}&orderBy=number`;
    const res = await fetchWithRetry(url);
    const json = await res.json();
    const data = Array.isArray(json.data) ? json.data : [];
    out = out.concat(data);
    totalCount = typeof json.totalCount === "number" ? json.totalCount : out.length;
    if (data.length === 0 || data.length < pageSize) break;
    page += 1;
  }
  return out;
}

function normalizeCard(raw) {
  const images = raw.images || {};
  return {
    id: raw.id,
    name: raw.name || "Carte sans nom",
    number: raw.number || "?",
    rarity: raw.rarity || "Sans rareté",
    image: images.large || images.small || null,
    supertype: raw.supertype || "",
  };
}

// ---------- Filters / sort ----------

function buildRarityChips() {
  const rarities = Array.from(new Set(state.cards.map((c) => c.rarity))).sort((a, b) =>
    a.localeCompare(b, "fr")
  );

  els.rarityChips.innerHTML = "";
  els.rarityChips.appendChild(makeChip("Toutes raretés", "all", true));
  rarities.forEach((r) => els.rarityChips.appendChild(makeChip(r, r, false)));
}

function makeChip(label, value, isActive) {
  const btn = document.createElement("button");
  btn.className = "chip" + (isActive ? " is-active" : "");
  btn.textContent = label;
  btn.dataset.rarity = value;
  btn.addEventListener("click", () => {
    state.rarity = value;
    document.querySelectorAll("#rarityChips .chip").forEach((c) => c.classList.remove("is-active"));
    btn.classList.add("is-active");
    render();
  });
  return btn;
}

function naturalNumberCompare(a, b) {
  const parse = (n) => {
    const match = String(n).match(/\d+/);
    return match ? parseInt(match[0], 10) : Number.MAX_SAFE_INTEGER;
  };
  const na = parse(a.number);
  const nb = parse(b.number);
  if (na !== nb) return na - nb;
  return String(a.number).localeCompare(String(b.number));
}

function getFilteredSortedCards() {
  const q = state.search.trim().toLowerCase();

  let list = state.cards.filter((c) => {
    if (state.status === "owned" && !state.owned.has(c.id)) return false;
    if (state.status === "missing" && state.owned.has(c.id)) return false;
    if (state.rarity !== "all" && c.rarity !== state.rarity) return false;
    if (q) {
      const haystack = `${c.name} ${c.number} ${c.rarity}`.toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  switch (state.sort) {
    case "number-asc":
      list.sort(naturalNumberCompare);
      break;
    case "number-desc":
      list.sort((a, b) => naturalNumberCompare(b, a));
      break;
    case "name-asc":
      list.sort((a, b) => a.name.localeCompare(b.name, "fr"));
      break;
    case "name-desc":
      list.sort((a, b) => b.name.localeCompare(a.name, "fr"));
      break;
  }

  return list;
}

// ---------- Rendering ----------

function render() {
  renderStats();
  const list = getFilteredSortedCards();
  renderGrid(list);
  renderResultsInfo(list.length);
}

function renderStats() {
  const total = state.cards.length;
  const ownedCount = state.cards.filter((c) => state.owned.has(c.id)).length;
  const missing = total - ownedCount;
  const pct = total ? (ownedCount / total) * 100 : 0;

  els.ownedCount.textContent = ownedCount;
  els.totalCount.textContent = total;
  els.missingCount.textContent = missing;
  els.progressPercent.textContent = `${pct.toFixed(1)}%`;
  els.progressFill.style.width = `${pct}%`;
  els.progressTrack && els.progressTrack.setAttribute("aria-valuenow", pct.toFixed(1));
}

function renderResultsInfo(count) {
  show(els.resultsInfo);
  els.resultsInfo.textContent =
    count === 0
      ? "Aucune carte ne correspond à ces filtres."
      : `${count} carte${count > 1 ? "s" : ""} affichée${count > 1 ? "s" : ""}`;
}

function renderGrid(list) {
  els.grid.innerHTML = "";
  const fragment = document.createDocumentFragment();

  list.forEach((card) => {
    const isOwned = state.owned.has(card.id);

    const item = document.createElement("article");
    item.className = "card-item" + (isOwned ? " is-owned" : "");
    item.tabIndex = 0;
    item.setAttribute("role", "button");
    item.setAttribute("aria-label", `${card.name}, ${isOwned ? "possédée" : "manquante"}. Ouvrir les détails.`);

    const thumb = document.createElement("div");
    thumb.className = "card-thumb";

    const img = document.createElement("img");
    img.loading = "lazy";
    img.alt = `${card.name} (${card.number})`;
    img.src = card.image || "";
    img.addEventListener("error", () => img.classList.add("img-error"));
    if (!card.image) img.classList.add("img-error");

    const fallback = document.createElement("div");
    fallback.className = "thumb-fallback";
    fallback.innerHTML = `<span>🃏</span><span>Image indisponible</span>`;

    const badge = document.createElement("span");
    badge.className = "status-badge";
    badge.textContent = isOwned ? "OWNED" : "MISSING";

    const check = document.createElement("span");
    check.className = "owned-check";
    check.textContent = "✓";
    check.setAttribute("aria-hidden", "true");

    thumb.append(img, fallback, badge, check);

    const body = document.createElement("div");
    body.className = "card-body";

    const name = document.createElement("p");
    name.className = "card-name";
    name.textContent = card.name;

    const meta = document.createElement("p");
    meta.className = "card-meta";
    meta.textContent = `#${card.number} · ${card.rarity}`;

    const toggleBtn = document.createElement("button");
    toggleBtn.className = "card-toggle";
    toggleBtn.textContent = isOwned ? "✓ Possédée" : "+ Marquer comme possédée";
    toggleBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      toggleOwned(card.id);
    });

    body.append(name, meta, toggleBtn);
    item.append(thumb, body);

    item.addEventListener("click", () => openModal(card.id));
    item.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        openModal(card.id);
      }
    });

    fragment.appendChild(item);
  });

  els.grid.appendChild(fragment);
}

// ---------- Owned toggling ----------

function toggleOwned(id) {
  if (state.owned.has(id)) {
    state.owned.delete(id);
  } else {
    state.owned.add(id);
  }
  saveOwnedIds();
  render();
  if (state.activeModalId === id) updateModalToggleLabel(id);
}

// ---------- Modal ----------

function openModal(id) {
  const card = state.cards.find((c) => c.id === id);
  if (!card) return;
  state.activeModalId = id;

  els.modalImage.src = card.image || "";
  els.modalImage.alt = `${card.name} (${card.number})`;
  els.modalRarity.textContent = card.rarity;
  els.modalName.textContent = card.name;
  els.modalNumber.textContent = `Carte n° ${card.number}`;

  updateModalToggleLabel(id);

  show(els.modalBackdrop);
  document.body.style.overflow = "hidden";
  els.modalClose.focus();
}

function updateModalToggleLabel(id) {
  const isOwned = state.owned.has(id);
  els.modalToggle.textContent = isOwned ? "✓ Possédée — retirer de la collection" : "+ Ajouter à la collection";
  els.modalToggle.classList.toggle("is-owned", isOwned);
}

function closeModal() {
  hide(els.modalBackdrop);
  document.body.style.overflow = "";
  state.activeModalId = null;
}

// ---------- Small DOM helpers ----------

function show(el) { el.hidden = false; }
function hide(el) { el.hidden = true; }

function showLoading(text) {
  show(els.loadingState);
  hide(els.emptyState);
  els.loadingText.textContent = text;
}

function showEmpty(title, sub) {
  hide(els.loadingState);
  show(els.emptyState);
  els.emptyTitle.textContent = title;
  els.emptySub.textContent = sub;
}

// ---------- Event wiring ----------

els.searchInput.addEventListener("input", (e) => {
  state.search = e.target.value;
  render();
});

els.sortSelect.addEventListener("change", (e) => {
  state.sort = e.target.value;
  render();
});

els.statusChips.addEventListener("click", (e) => {
  const btn = e.target.closest(".chip");
  if (!btn) return;
  state.status = btn.dataset.status;
  els.statusChips.querySelectorAll(".chip").forEach((c) => c.classList.remove("is-active"));
  btn.classList.add("is-active");
  render();
});

els.resetBtn.addEventListener("click", () => {
  if (state.owned.size === 0) return;
  const confirmed = window.confirm(
    "Réinitialiser toute votre collection ? Cette action supprimera le statut \u00ab possédée \u00bb de toutes les cartes et ne peut pas être annulée."
  );
  if (confirmed) {
    state.owned.clear();
    saveOwnedIds();
    render();
  }
});

els.retryBtn.addEventListener("click", init);

els.modalClose.addEventListener("click", closeModal);
els.modalBackdrop.addEventListener("click", (e) => {
  if (e.target === els.modalBackdrop) closeModal();
});
els.modalToggle.addEventListener("click", () => {
  if (state.activeModalId) toggleOwned(state.activeModalId);
});

document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !els.modalBackdrop.hidden) closeModal();
});

// ---------- Boot ----------

init();
