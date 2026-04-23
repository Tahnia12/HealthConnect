/* ===============================
   CONFIG
   Stores the medicines file path and all storage keys
   used for medicine search, saved items, history,
   and results page tracking.
================================ */

const MEDICINES_URL = "data/medicines.json";

const MED_KEY_RESULTS = "hc_medicine_results";
const MED_KEY_QUERY = "hc_medicine_query";
const MED_KEY_CATEGORY = "hc_medicine_category";
const MED_KEY_SAVED = "hc_saved_medicines";

/* 
   These use the same storage values as the conditions script,
   but I renamed the variable names here to avoid clashes.
*/
const MED_SHARED_KEY_HISTORY = "hc_search_history";
const MED_SHARED_KEY_LAST_RESULTS_TYPE = "hc_last_results_type";

/* 
   Holds the full medicines dataset after it is loaded.
*/
let MEDICINES = [];

/* ===============================
   HELPERS
   Reusable helper functions for selecting elements
   and normalizing text values.
================================ */

/* 
   Returns an element from the page using its ID.
*/
function med$(id) {
  return document.getElementById(id);
}

/* 
   Converts any value into a lowercase trimmed string
   so text comparisons are easier and more consistent.
*/
function medNorm(value) {
  return (value || "").toString().trim().toLowerCase();
}

/* ===============================
   SAVED MEDICINES
   Handles saving, removing, and checking medicines
   in localStorage.
================================ */

/* 
   Gets the list of saved medicines from localStorage.
   Returns an empty array if nothing has been saved yet.
*/
function getSavedMedicines() {
  return JSON.parse(localStorage.getItem(MED_KEY_SAVED) || "[]");
}

/* 
   Checks if a medicine is already saved
   by comparing its name.
*/
function isMedicineSaved(name) {
  return getSavedMedicines().some(item => item.name === name);
}

/* 
   Adds or removes a medicine from saved items.
   If the medicine already exists, it is removed.
   If it does not exist, it is found and added.

   After updating storage, the results section
   and saved medicines section are both re-rendered.
*/
function toggleSaveMedicineByName(name) {
  const saved = getSavedMedicines();
  const existingIndex = saved.findIndex(item => item.name === name);

  if (existingIndex > -1) {
    saved.splice(existingIndex, 1);
  } else {
    const allMedicines = MEDICINES.length
      ? MEDICINES
      : JSON.parse(sessionStorage.getItem(MED_KEY_RESULTS) || "[]");

    const medicineToSave = allMedicines.find(item => item.name === name);

    if (medicineToSave) {
      saved.push(medicineToSave);
    }
  }

  localStorage.setItem(MED_KEY_SAVED, JSON.stringify(saved));

  renderMedicineResults();
  renderSavedMedicines();
}

/* 
   Clears all saved medicines from localStorage
   and refreshes the saved medicines section.
*/
function clearSavedMedicines() {
  localStorage.removeItem(MED_KEY_SAVED);
  renderSavedMedicines();
  renderMedicineResults();
}

/* ===============================
   SHARED HISTORY
   Handles reading and saving search history.
================================ */

/* 
   Gets the shared search history from localStorage.
*/
function getMedicineSearchHistory() {
  return JSON.parse(localStorage.getItem(MED_SHARED_KEY_HISTORY) || "[]");
}

/* 
   Saves a new medicine search into history.
   Adds a unique ID and a readable timestamp,
   then stores the updated history list.
*/
function saveMedicineSearchToHistory(entry) {
  const history = getMedicineSearchHistory();

  history.unshift({
    id: Date.now(),
    ...entry,
    createdAt: new Date().toLocaleString()
  });

  localStorage.setItem(MED_SHARED_KEY_HISTORY, JSON.stringify(history));
}

/* ===============================
   LOAD MEDICINES
   Loads the medicines dataset from the JSON file
   and updates status messages on the page.
================================ */

/* 
   Fetches the medicines file, stores the data,
   updates loading text, and then prepares the UI
   by filling categories, example chips,
   and compare dropdowns.
*/
async function loadMedicines() {
  const statusEl = med$("medicineStatus");
  const compareStatusEl = med$("medicineCompareStatus");

  try {
    if (statusEl) {
      statusEl.textContent = "Loading medicines...";
    }

    if (compareStatusEl) {
      compareStatusEl.textContent = "Loading medicines...";
    }

    const res = await fetch(MEDICINES_URL);
    if (!res.ok) throw new Error("Failed to load medicines");

    MEDICINES = await res.json();

    if (statusEl) {
      statusEl.textContent = `Loaded ${MEDICINES.length} medicines.`;
    }

    if (compareStatusEl) {
      compareStatusEl.textContent = `Loaded ${MEDICINES.length} medicines.`;
    }

    populateMedicineCategories();
    populateMedicineExamples();
    populateMedicineCompareOptions();
  } catch (err) {
    console.error(err);

    if (statusEl) {
      statusEl.textContent = "Could not load medicines.";
    }

    if (compareStatusEl) {
      compareStatusEl.textContent = "Could not load medicines.";
    }
  }
}

/* ===============================
   CATEGORIES
   Fills the medicine category dropdown
   with unique category values.
================================ */

/* 
   Builds the category dropdown using all unique
   medicine categories found in the dataset.
*/
function populateMedicineCategories() {
  const select = med$("medicineCategory");
  if (!select) return;

  const categories = [...new Set(MEDICINES.map(m => m.category).filter(Boolean))];

  select.innerHTML = `<option value="all">All</option>`;

  categories.forEach(category => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    select.appendChild(option);
  });
}

/* ===============================
   EXAMPLES
   Creates quick example buttons for medicine search.
================================ */

/* 
   Builds clickable example chips.
   Clicking a chip puts that example text
   into the search input.
*/
function populateMedicineExamples() {
  const box = med$("medicineExamples");
  const input = med$("medicineQ");
  if (!box || !input) return;

  const examples = [
    "paracetamol",
    "ibuprofen",
    "allergy",
    "antibiotic",
    "heartburn",
    "cold and flu"
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
   SEARCH
   Searches medicines by keyword and category.
================================ */

/* 
   Runs the medicine search using the search text
   and selected category.

   The search checks the medicine name, category,
   description, used-for list, side effects,
   and important notes.

   Matching results are saved in sessionStorage,
   the search is added to history,
   and the page redirects to medicine results.
*/
function runMedicineSearch() {
  const input = med$("medicineQ");
  const categorySelect = med$("medicineCategory");

  if (!input) return;

  const rawText = input.value.trim();
  const selectedCategory = categorySelect ? categorySelect.value : "all";
  const token = medNorm(rawText);

  let results = MEDICINES.filter(item => {
    const bag = medNorm([
      item.name,
      item.category,
      item.description,
      ...(item.usedFor || []),
      ...(item.commonSideEffects || []),
      ...(item.importantNotes || [])
    ].join(" "));

    return token ? bag.includes(token) : true;
  });

  if (selectedCategory !== "all") {
    results = results.filter(item => item.category === selectedCategory);
  }

  sessionStorage.setItem(MED_KEY_RESULTS, JSON.stringify(results));
  sessionStorage.setItem(MED_KEY_QUERY, rawText);
  sessionStorage.setItem(MED_KEY_CATEGORY, selectedCategory);
  localStorage.setItem(MED_SHARED_KEY_LAST_RESULTS_TYPE, "medicine");

  saveMedicineSearchToHistory({
    type: "medicine",
    query: rawText,
    category: selectedCategory,
    resultCount: results.length,
    results
  });

  window.location.href = "medicine-results.html";
}

/* ===============================
   RENDER MEDICINE RESULTS
   Displays the stored medicine search results.
================================ */

/* 
   Reads the saved search results from sessionStorage
   and displays them on the results page.

   Each medicine card shows category, description,
   what it is used for, side effects,
   important notes, and a save button.
*/
function renderMedicineResults() {
  const resultsEl = med$("medicineResults");
  const summaryEl = med$("medicineSummary");

  if (!resultsEl) return;

  const results = JSON.parse(sessionStorage.getItem(MED_KEY_RESULTS) || "[]");
  const query = sessionStorage.getItem(MED_KEY_QUERY) || "";
  const category = sessionStorage.getItem(MED_KEY_CATEGORY) || "all";

  if (summaryEl) {
    summaryEl.textContent =
      `Showing ${results.length} result(s) for "${query || "all medicines"}"` +
      (category !== "all" ? ` in ${category}` : "");
  }

  if (!results.length) {
    resultsEl.innerHTML = `<p>No medicines found</p>`;
    return;
  }

  resultsEl.innerHTML = results.map(item => {
    const activeClass = isMedicineSaved(item.name) ? "active" : "";
    const safeName = item.name.replace(/'/g, "\\'");

    return `
      <div class="result-item">
        <div class="result-top">
          <h3>${item.name}</h3>
          <button
            class="save-btn ${activeClass}"
            type="button"
            onclick="toggleSaveMedicineByName('${safeName}')"
            aria-label="Save ${item.name}"
          >
            ★
          </button>
        </div>

        <p><strong>Category:</strong> ${item.category}</p>
        <p>${item.description || ""}</p>
        <p><strong>Used for:</strong> ${(item.usedFor || []).join(", ")}</p>
        <p><strong>Common side effects:</strong> ${(item.commonSideEffects || []).join(", ")}</p>
        <p><strong>Important notes:</strong> ${(item.importantNotes || []).join(", ")}</p>
      </div>
    `;
  }).join("");
}

/* ===============================
   RENDER SAVED MEDICINES
   Displays all medicines saved by the user.
================================ */

/* 
   Reads saved medicines from localStorage
   and shows them on the saved medicines page.

   Each card includes medicine details and
   buttons for removing the medicine from saved items.
*/
function renderSavedMedicines() {
  const savedEl = med$("savedMedicinesResults");
  const summaryEl = med$("savedMedicinesSummary");

  if (!savedEl) return;

  const saved = getSavedMedicines();

  if (summaryEl) {
    summaryEl.textContent = `Showing ${saved.length} saved medicine(s)`;
  }

  if (!saved.length) {
    savedEl.innerHTML = `<p>No saved medicines yet.</p>`;
    return;
  }

  savedEl.innerHTML = saved.map(item => {
    const safeName = item.name.replace(/'/g, "\\'");

    return `
      <div class="result-item">
        <div class="result-top">
          <h3>${item.name}</h3>

          <div class="result-card-actions">
            <button
              class="save-btn active"
              type="button"
              onclick="toggleSaveMedicineByName('${safeName}')"
              aria-label="Remove ${item.name} from saved"
            >
              ★
            </button>

            <button
              class="remove-btn"
              type="button"
              onclick="toggleSaveMedicineByName('${safeName}')"
            >
              Remove
            </button>
          </div>
        </div>

        <p><strong>Category:</strong> ${item.category}</p>
        <p>${item.description || ""}</p>
        <p><strong>Used for:</strong> ${(item.usedFor || []).join(", ")}</p>
        <p><strong>Common side effects:</strong> ${(item.commonSideEffects || []).join(", ")}</p>
        <p><strong>Important notes:</strong> ${(item.importantNotes || []).join(", ")}</p>
      </div>
    `;
  }).join("");
}

/* ===============================
   COMPARE MEDICINES
   Handles the medicine comparison feature.
================================ */

/* 
   Fills both compare dropdowns with medicine names
   from the loaded dataset.
*/
function populateMedicineCompareOptions() {
  const select1 = med$("medicineCompare1");
  const select2 = med$("medicineCompare2");

  if (!select1 || !select2) return;

  const options = MEDICINES.map(item =>
    `<option value="${item.name}">${item.name}</option>`
  ).join("");

  select1.innerHTML = `<option value="">Select first medicine</option>${options}`;
  select2.innerHTML = `<option value="">Select second medicine</option>${options}`;
}

/* 
   Compares two selected medicines and shows
   both of their details side by side.

   If either selection is missing,
   a message is shown instead.
*/
function compareMedicines() {
  const select1 = med$("medicineCompare1");
  const select2 = med$("medicineCompare2");
  const resultsEl = med$("medicineCompareResults");

  if (!select1 || !select2 || !resultsEl) return;

  const med1Name = select1.value;
  const med2Name = select2.value;

  if (!med1Name || !med2Name) {
    resultsEl.innerHTML = `<p>Please select two medicines to compare.</p>`;
    return;
  }

  const med1 = MEDICINES.find(item => item.name === med1Name);
  const med2 = MEDICINES.find(item => item.name === med2Name);

  if (!med1 || !med2) {
    resultsEl.innerHTML = `<p>Could not compare medicines.</p>`;
    return;
  }

  resultsEl.innerHTML = `
    <div class="compare-panel">
      <div class="result-item">
        <h3>${med1.name}</h3>
        <p><strong>Category:</strong> ${med1.category}</p>
        <p>${med1.description || ""}</p>
        <p><strong>Used for:</strong> ${(med1.usedFor || []).join(", ")}</p>
        <p><strong>Common side effects:</strong> ${(med1.commonSideEffects || []).join(", ")}</p>
        <p><strong>Important notes:</strong> ${(med1.importantNotes || []).join(", ")}</p>
      </div>
    </div>

    <div class="compare-panel">
      <div class="result-item">
        <h3>${med2.name}</h3>
        <p><strong>Category:</strong> ${med2.category}</p>
        <p>${med2.description || ""}</p>
        <p><strong>Used for:</strong> ${(med2.usedFor || []).join(", ")}</p>
        <p><strong>Common side effects:</strong> ${(med2.commonSideEffects || []).join(", ")}</p>
        <p><strong>Important notes:</strong> ${(med2.importantNotes || []).join(", ")}</p>
      </div>
    </div>
  `;
}

/* 
   Resets both compare dropdowns
   and clears the comparison results.
*/
function clearMedicineCompare() {
  const select1 = med$("medicineCompare1");
  const select2 = med$("medicineCompare2");
  const resultsEl = med$("medicineCompareResults");

  if (select1) select1.value = "";
  if (select2) select2.value = "";
  if (resultsEl) resultsEl.innerHTML = "";
}

/* ===============================
   CLEAR RESULTS BUTTON
   Handles the medicine clear button.
================================ */

/* 
   Connects the clear button to logic that removes
   stored search results and returns to the
   medicine search page.
*/
function wireMedicineClearButton() {
  const btn = med$("medicineClearBtn");
  if (!btn) return;

  btn.onclick = () => {
    sessionStorage.removeItem(MED_KEY_RESULTS);
    sessionStorage.removeItem(MED_KEY_QUERY);
    sessionStorage.removeItem(MED_KEY_CATEGORY);
    localStorage.setItem(MED_SHARED_KEY_LAST_RESULTS_TYPE, "medicine");
    window.location.href = "medicine-search.html";
  };
}

/* ===============================
   INIT
   Runs once the page has fully loaded.
================================ */

/* 
   Starts the medicines feature when the DOM is ready.

   Loads medicine data only on pages that need it,
   then connects events and renders any relevant sections.
*/
document.addEventListener("DOMContentLoaded", async () => {
  try {
    /* 
       Only load the medicines dataset on pages that
       actually need it, such as search, results, or compare.
       The saved page can render directly from localStorage.
    */
    if (med$("medicineQ") || med$("medicineResults") || med$("medicineCompare1")) {
      await loadMedicines();
    }
  } catch (e) {
    console.warn("Skipping medicine load:", e);
  }

  const searchBtn = med$("medicineSearchBtn");
  if (searchBtn) {
    searchBtn.onclick = runMedicineSearch;
  }

  const input = med$("medicineQ");
  if (input) {
    input.addEventListener("keydown", e => {
      if (e.key === "Enter") {
        e.preventDefault();
        runMedicineSearch();
      }
    });
  }

  const clearSavedMedicinesBtn = med$("clearSavedMedicinesBtn");
  if (clearSavedMedicinesBtn) {
    clearSavedMedicinesBtn.onclick = clearSavedMedicines;
  }

  const compareBtn = med$("medicineCompareBtn");
  if (compareBtn) {
    compareBtn.onclick = compareMedicines;
  }

  const compareClearBtn = med$("medicineCompareClearBtn");
  if (compareClearBtn) {
    compareClearBtn.onclick = clearMedicineCompare;
  }

  renderMedicineResults();
  renderSavedMedicines();
  wireMedicineClearButton();
});