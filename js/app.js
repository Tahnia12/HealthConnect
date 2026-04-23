/* ===============================
   CONFIG
   Main constants used across the app,
   including the API endpoint and storage keys.
================================ */

const DATA_URL = "http://127.0.0.1:5001/api/conditions";
const KEY_RESULTS = "hc_results";
const KEY_QUERY = "hc_query";
const KEY_AREA = "hc_area";
const KEY_SAVED = "hc_saved_conditions";
const KEY_HISTORY = "hc_search_history";
const KEY_LAST_RESULTS_TYPE = "hc_last_results_type";

/* 
   Stores the full conditions dataset
   after loading it from the API.
*/
let CONDITIONS = [];

/* ===============================
   HELPERS
   Small reusable utility functions.
================================ */

/* 
   Returns an element by its ID.
*/
function $(id) {
  return document.getElementById(id);
}

/* 
   Normalizes a value by converting it to text,
   trimming spaces, and changing it to lowercase.
*/
function norm(value) {
  return (value || "").toString().trim().toLowerCase();
}

/* ===============================
   SAVED CONDITIONS
   Handles saving and removing conditions.
================================ */

/* 
   Returns saved conditions from localStorage.
   Falls back to an empty array when nothing is saved.
*/
function getSavedConditions() {
  return JSON.parse(localStorage.getItem(KEY_SAVED) || "[]");
}

/* 
   Checks whether a condition is already saved.
*/
function isConditionSaved(name) {
  return getSavedConditions().some(item => item.name === name);
}

/* 
   Saves or removes a condition by name.
   If the condition already exists in saved items,
   it gets removed. Otherwise it is found in the
   available dataset or current results and saved.
   
   After updating storage, both results and saved
   condition sections are re-rendered.
*/
function toggleSaveConditionByName(name) {
  const saved = getSavedConditions();
  const existingIndex = saved.findIndex(item => item.name === name);

  if (existingIndex > -1) {
    saved.splice(existingIndex, 1);
  } else {
    const allConditions = CONDITIONS.length
      ? CONDITIONS
      : JSON.parse(sessionStorage.getItem(KEY_RESULTS) || "[]");

    const conditionToSave = allConditions.find(item => item.name === name);

    if (conditionToSave) {
      saved.push(conditionToSave);
    }
  }

  localStorage.setItem(KEY_SAVED, JSON.stringify(saved));

  renderResults();
  renderSavedConditions();
}

/* ===============================
   SHARED HISTORY
   Handles storage and rendering of search history.
================================ */

/* 
   Returns stored search history from localStorage.
*/
function getSearchHistory() {
  return JSON.parse(localStorage.getItem(KEY_HISTORY) || "[]");
}

/* 
   Adds a new search entry to history.
   A unique ID and a readable timestamp are added.
   Newest entries are placed at the beginning.
*/
function saveSearchToHistory(entry) {
  const history = getSearchHistory();

  history.unshift({
    id: Date.now(),
    ...entry,
    createdAt: new Date().toLocaleString()
  });

  localStorage.setItem(KEY_HISTORY, JSON.stringify(history));
}

/* 
   Restores a search from history and redirects
   to the matching results page.
   
   Condition searches restore condition data.
   Medicine searches restore medicine data.
*/
function reopenHistoryItem(id) {
  const history = getSearchHistory();
  const item = history.find(entry => entry.id === id);

  if (!item) return;

  if (item.type === "condition") {
    sessionStorage.setItem(KEY_RESULTS, JSON.stringify(item.results || []));
    sessionStorage.setItem(KEY_QUERY, item.query || "");
    sessionStorage.setItem(KEY_AREA, item.area || "all");
    localStorage.setItem(KEY_LAST_RESULTS_TYPE, "condition");
    window.location.href = "results.html";
    return;
  }

  if (item.type === "medicine") {
    sessionStorage.setItem("hc_medicine_results", JSON.stringify(item.results || []));
    sessionStorage.setItem("hc_medicine_query", item.query || "");
    sessionStorage.setItem("hc_medicine_category", item.category || "all");
    localStorage.setItem(KEY_LAST_RESULTS_TYPE, "medicine");
    window.location.href = "medicine-results.html";
  }
}

/* 
   Removes one history item by ID
   and refreshes the history display.
*/
function deleteHistoryItem(id) {
  let history = getSearchHistory();
  history = history.filter(item => item.id !== id);
  localStorage.setItem(KEY_HISTORY, JSON.stringify(history));
  renderHistory();
}

/* 
   Clears the entire search history
   and refreshes the history section.
*/
function clearHistory() {
  localStorage.removeItem(KEY_HISTORY);
  renderHistory();
}

/* 
   Renders the search history section.
   Shows a summary count, displays each saved search,
   and adds buttons to reopen or delete entries.
*/
function renderHistory() {
  const historyEl = $("historyResults");
  const summaryEl = $("historySummary");

  if (!historyEl) return;

  const history = getSearchHistory();

  if (summaryEl) {
    summaryEl.textContent = `Showing ${history.length} past search(es)`;
  }

  if (!history.length) {
    historyEl.innerHTML = `<p>No search history yet.</p>`;
    return;
  }

  historyEl.innerHTML = history.map(item => {
    const typeLabel = item.type === "medicine" ? "Medicine search" : "Condition search";
    const filterLine = item.type === "medicine"
      ? `<p><strong>Category:</strong> ${item.category || "all"}</p>`
      : `<p><strong>Body area:</strong> ${item.area || "all"}</p>`;

    return `
      <div class="result-item">
        <div class="result-top">
          <h3>${item.query || "Empty search"}</h3>

          <div class="result-card-actions">
            <button
              class="btn"
              type="button"
              onclick="reopenHistoryItem(${item.id})"
            >
              View Again
            </button>

            <button
              class="remove-btn"
              type="button"
              onclick="deleteHistoryItem(${item.id})"
            >
              Delete
            </button>
          </div>
        </div>

        <p><strong>Type:</strong> ${typeLabel}</p>
        ${filterLine}
        <p><strong>Results found:</strong> ${item.resultCount}</p>
        <p><strong>Searched at:</strong> ${item.createdAt}</p>
      </div>
    `;
  }).join("");
}

/* ===============================
   CLEAR SAVED CONDITIONS
   Removes all saved conditions at once.
================================ */

/* 
   Clears all saved conditions from localStorage
   and refreshes related UI sections.
*/
function clearSavedConditions() {
  localStorage.removeItem(KEY_SAVED);
  renderSavedConditions();
  renderResults();
}

/* ===============================
   LOAD DATASET
   Fetches condition data from the backend.
================================ */

/* 
   Loads the dataset from the API.
   Updates the status text while loading,
   stores the returned data, and initializes
   the body area dropdown and example chips.
*/
async function loadDataset() {
  const statusEl = $("status");

  try {
    if (statusEl) {
      statusEl.textContent = "Loading dataset...";
    }

    const res = await fetch(DATA_URL);

    if (!res.ok) throw new Error("Failed to load");

    CONDITIONS = await res.json();

    if (statusEl) {
      statusEl.textContent = `Loaded ${CONDITIONS.length} conditions.`;
    }

    populateBodyAreas();
    populateExampleChips();
  } catch (err) {
    console.error(err);
    if (statusEl) {
      statusEl.textContent = "Could not load dataset.";
    }
  }
}

/* ===============================
   BODY AREA DROPDOWN
   Fills the select input with unique body areas.
================================ */

/* 
   Builds the body area dropdown from unique
   bodyArea values found in the dataset.
*/
function populateBodyAreas() {
  const select = $("area");
  if (!select) return;

  const areas = [...new Set(CONDITIONS.map(c => c.bodyArea).filter(Boolean))];

  select.innerHTML = `<option value="all">All</option>`;

  areas.forEach(area => {
    const option = document.createElement("option");
    option.value = area;
    option.textContent = area;
    select.appendChild(option);
  });
}

/* ===============================
   EXAMPLE CHIPS
   Creates clickable search examples.
================================ */

/* 
   Builds example search chips and places them
   inside the examples container.
   Clicking a chip fills the input box.
*/
function populateExampleChips() {
  const box = $("examples");
  const input = $("q");

  if (!box || !input) return;

  const examples = [
    "headache",
    "headache, nausea",
    "sore throat, fever",
    "wrist pain",
    "stomach pain, nausea",
    "lower back pain"
  ];

  box.innerHTML = "";

  examples.forEach(text => {
    const btn = document.createElement("button");
    btn.className = "chip";
    btn.type = "button";
    btn.textContent = text;

    btn.onclick = () => {
      input.value = text;
      input.focus();
    };

    box.appendChild(btn);
  });
}

/* ===============================
   SEARCH FUNCTION
   Matches search text against the dataset.
================================ */

/* 
   Runs the search using the text input
   and selected body area.
   
   Search text is split into comma-separated tokens.
   Each condition receives a score based on how many
   tokens match its name, description, body area,
   symptoms, or keywords.
   
   Matching results are stored in sessionStorage,
   history is updated, and the user is redirected
   to the results page.
*/
function runSearch() {
  const input = $("q");
  const areaSelect = $("area");

  if (!input) return;

  const rawText = input.value;
  const selectedArea = areaSelect ? areaSelect.value : "all";

  const tokens = rawText
    .split(",")
    .map(t => norm(t))
    .filter(Boolean);

  let results = CONDITIONS.map(condition => {
    const bag = norm([
      condition.name,
      condition.description,
      condition.bodyArea,
      ...(condition.symptoms || []),
      ...(condition.keywords || [])
    ].join(" "));

    let score = 0;

    tokens.forEach(token => {
      if (bag.includes(token)) {
        score++;
      }
    });

    return {
      ...condition,
      _score: score,
      _tokenCount: tokens.length
    };
  });

  if (selectedArea !== "all") {
    results = results.filter(c => c.bodyArea === selectedArea);
  }

  if (tokens.length > 0) {
    results = results.filter(c => c._score > 0);
    results.sort((a, b) => b._score - a._score);
  }

  sessionStorage.setItem(KEY_RESULTS, JSON.stringify(results));
  sessionStorage.setItem(KEY_QUERY, rawText);
  sessionStorage.setItem(KEY_AREA, selectedArea);
  localStorage.setItem(KEY_LAST_RESULTS_TYPE, "condition");

  saveSearchToHistory({
    type: "condition",
    query: rawText,
    area: selectedArea,
    resultCount: results.length,
    results
  });

  window.location.href = "results.html";
}

/* ===============================
   RESULT TAB REDIRECT
   Sends the user to the correct results page
   based on the last search type used.
================================ */

/* 
   Redirects between results pages when the stored
   last search type does not match the current page.
*/
function routeResultsPageIfNeeded() {
  const lastType = localStorage.getItem(KEY_LAST_RESULTS_TYPE) || "condition";
  const page = window.location.pathname.split("/").pop();

  if (page === "results.html" && lastType === "medicine") {
    window.location.replace("medicine-results.html");
  }

  if (page === "medicine-results.html" && lastType === "condition") {
    window.location.replace("results.html");
  }
}

/* ===============================
   RENDER RESULTS PAGE
   Displays condition search results.
================================ */

/* 
   Renders stored search results onto the results page.
   Shows summary text, condition details, optional match
   score, symptoms, educational guidance, and save button.
*/
function renderResults() {
  const resultsEl = $("results");
  const summaryEl = $("summary");

  if (!resultsEl) return;

  const results = JSON.parse(sessionStorage.getItem(KEY_RESULTS) || "[]");
  const query = sessionStorage.getItem(KEY_QUERY) || "";
  const area = sessionStorage.getItem(KEY_AREA) || "all";

  if (summaryEl) {
    summaryEl.textContent =
      `Showing ${results.length} result(s) for "${query || "all"}"` +
      (area !== "all" ? ` in ${area}` : "");
  }

  if (!results.length) {
    resultsEl.innerHTML = `<p>No results found</p>`;
    return;
  }

  resultsEl.innerHTML = results.map(item => {
    const scoreLine =
      item._tokenCount > 1
        ? `<p class="small"><strong>Match score:</strong> ${item._score}/${item._tokenCount}</p>`
        : "";

    const symptomsLine = item.symptoms?.length
      ? `<p><strong>Symptoms:</strong> ${item.symptoms.join(", ")}</p>`
      : "";

    const remediesLine = item.educationalRemedies?.length
      ? `
        <p><strong>Educational guidance:</strong></p>
        <ul>
          ${item.educationalRemedies.map(r => `<li>${r}</li>`).join("")}
        </ul>
      `
      : "";

    const activeClass = isConditionSaved(item.name) ? "active" : "";
    const safeName = item.name.replace(/'/g, "\\'");

    return `
      <div class="result-item">
        <div class="result-top">
          <h3>${item.name}</h3>
          <button
            class="save-btn ${activeClass}"
            type="button"
            onclick="toggleSaveConditionByName('${safeName}')"
            aria-label="Save ${item.name}"
          >
            ★
          </button>
        </div>

        <p>${item.description || ""}</p>
        <p><strong>Body area:</strong> ${item.bodyArea}</p>
        ${scoreLine}
        ${symptomsLine}
        ${remediesLine}
      </div>
    `;
  }).join("");
}

/* ===============================
   RENDER SAVED CONDITIONS PAGE
   Displays all saved conditions.
================================ */

/* 
   Renders all saved conditions from localStorage.
   Shows condition details and buttons to unsave them.
*/
function renderSavedConditions() {
  const savedEl = $("savedResults");
  const summaryEl = $("savedSummary");

  if (!savedEl) return;

  const saved = getSavedConditions();

  if (summaryEl) {
    summaryEl.textContent = `Showing ${saved.length} saved condition(s)`;
  }

  if (!saved.length) {
    savedEl.innerHTML = `<p>No saved conditions yet.</p>`;
    return;
  }

  savedEl.innerHTML = saved.map(item => {
    const symptomsLine = item.symptoms?.length
      ? `<p><strong>Symptoms:</strong> ${item.symptoms.join(", ")}</p>`
      : "";

    const remediesLine = item.educationalRemedies?.length
      ? `
        <p><strong>Educational guidance:</strong></p>
        <ul>
          ${item.educationalRemedies.map(r => `<li>${r}</li>`).join("")}
        </ul>
      `
      : "";

    const safeName = item.name.replace(/'/g, "\\'");

    return `
      <div class="result-item">
        <div class="result-top">
          <h3>${item.name}</h3>

          <div class="result-card-actions">
            <button
              class="save-btn active"
              type="button"
              onclick="toggleSaveConditionByName('${safeName}')"
            >
              ★
            </button>

            <button
              class="remove-btn"
              type="button"
              onclick="toggleSaveConditionByName('${safeName}')"
            >
              Remove
            </button>
          </div>
        </div>

        <p>${item.description || ""}</p>
        <p><strong>Body area:</strong> ${item.bodyArea}</p>
        ${symptomsLine}
        ${remediesLine}
      </div>
    `;
  }).join("");
}

/* ===============================
   CLEAR RESULTS BUTTON
   Wires the button that clears current results.
================================ */

/* 
   Connects the clear button to logic that removes
   stored results, resets summary text, and shows
   an empty results message.
*/
function wireClearButton() {
  const btn = $("clearBtn");
  if (!btn) return;

  btn.onclick = (e) => {
    e.preventDefault();

    sessionStorage.removeItem(KEY_RESULTS);
    sessionStorage.removeItem(KEY_QUERY);
    sessionStorage.removeItem(KEY_AREA);
    localStorage.setItem(KEY_LAST_RESULTS_TYPE, "condition");

    const resultsEl = $("results");
    const summaryEl = $("summary");

    if (summaryEl) {
      summaryEl.textContent = `Showing 0 result(s) for "all"`;
    }

    if (resultsEl) {
      resultsEl.innerHTML = `<p>No results found</p>`;
    }
  };
}

/* ===============================
   INIT
   Starts the app once the DOM is ready.
================================ */

/* 
   Runs on page load.
   Handles page routing, loads the dataset,
   attaches button and keyboard events,
   and renders page sections.
*/
document.addEventListener("DOMContentLoaded", async () => {
  routeResultsPageIfNeeded();

  await loadDataset();

  const searchBtn = $("searchBtn");
  if (searchBtn) {
    searchBtn.onclick = runSearch;
  }

  const input = $("q");
  if (input) {
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        runSearch();
      }
    });
  }

  const clearSavedBtn = $("clearSavedBtn");
  if (clearSavedBtn) {
    clearSavedBtn.onclick = clearSavedConditions;
  }

  const clearHistoryBtn = $("clearHistoryBtn");
  if (clearHistoryBtn) {
    clearHistoryBtn.onclick = clearHistory;
  }

  renderResults();
  renderSavedConditions();
  renderHistory();
  wireClearButton();
});