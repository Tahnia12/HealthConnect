/* ============================================================
   HealthConnect - app.js

   This file does 3 main jobs:

   1) Loads my dataset from data/conditions.json
      - so the website has “conditions + symptoms” information to search

   2) Runs the search when the user clicks Search
      - user can type 1 symptom or multiple symptoms separated by commas
      - the system then finds which conditions match

   3) Shows results on results.html
      - it reads what I saved in sessionStorage and renders results cards

   IMPORTANT:
   - No user personal data is collected
   - I only store the search session temporarily (sessionStorage)
   ============================================================ */


/* This is the path to my dataset file */
const DATA_URL = "data/conditions.json";

/* These are just names (keys) where I store things temporarily in the browser */
const KEY_RESULTS = "hc_results"; // stores the list of matching results
const KEY_QUERY   = "hc_query";   // stores what the user searched

/* This variable will hold the full dataset once it loads */
let CONDITIONS = [];

/* Simple helper so I can do $("id") instead of document.getElementById("id") */
const $ = (id) => document.getElementById(id);


/* ------------------------------------------------------------
   norm() = normalise text so matching works properly

   Why I need it:
   - Users might type: " Headache " or "HEADACHE"
   - My dataset might store: "headache"
   - This function makes them match by:
     1) converting to lower case
     2) removing extra spaces
------------------------------------------------------------ */
function norm(value){
  return (value || "").toString().trim().toLowerCase();
}


/* ------------------------------------------------------------
   goDisclaimer() = sends user to the disclaimer page

   Why I made this:
   - The header “Disclaimer” link and footer “Read full disclaimer”
     should always work (even if JS search fails).
------------------------------------------------------------ */
function goDisclaimer(){
  window.location.href = "disclaimer.html";
}


/* ------------------------------------------------------------
   wireDisclaimerLinks() = makes disclaimer buttons/links work

   What it does:
   - If your HTML has a button/link with id="disclaimerBtn"
     it will go to disclaimer.html
   - If your footer link has id="footerDisclaimer"
     it will go to disclaimer.html
------------------------------------------------------------ */
function wireDisclaimerLinks(){
  const btn = $("disclaimerBtn");
  if (btn){
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      goDisclaimer();
    });
  }

  const footer = $("footerDisclaimer");
  if (footer){
    footer.addEventListener("click", (e) => {
      e.preventDefault();
      goDisclaimer();
    });
  }
}


/* ------------------------------------------------------------
   loadDataset() = loads conditions.json into the CONDITIONS array

   What happens here:
   1) fetch() downloads the JSON file from /data/conditions.json
   2) response.json() converts it into usable JavaScript data
   3) I store it in CONDITIONS so I can search it
   4) I then use that data to populate:
      - body area dropdown
      - example buttons for demo

   Extra note (important for your bug):
   - If the dropdown only shows "All", it usually means either:
     (a) CONDITIONS did not load
     (b) bodyArea is missing/blank in the JSON objects
     (c) the <select id="area"> was not found on the page
------------------------------------------------------------ */
async function loadDataset(){
  const status = $("status"); // status text element on search.html

  try {
    const response = await fetch(DATA_URL, { cache: "no-store" });

    /* If the server cannot find the file, response.ok will be false */
    if (!response.ok) throw new Error(`Dataset fetch failed: ${response.status}`);

    const json = await response.json();

    /* I expect the file to be an array of objects */
    CONDITIONS = Array.isArray(json) ? json : (json.conditions || []);

    /* Update the status message on the page (shows dataset loaded) */
    if (status){
      status.textContent = `Loaded ${CONDITIONS.length} conditions.`;
    }

    /* Build body area dropdown options from data */
    if ($("area")) populateBodyAreas();

    /* Create example chips for quick demo */
    if ($("examples")) populateExampleChips();

  } catch (error){
    console.error(error);

    /* If loading fails, show a message so I can debug */
    if (status){
      status.textContent = "Could not load dataset. Check: data/conditions.json and folder names.";
    }
  }
}


/* ------------------------------------------------------------
   populateBodyAreas() = fills dropdown options using dataset

   Why this is useful:
   - I don’t hardcode body areas
   - If I add more conditions later, the dropdown updates automatically
   - This is more scalable than manually typing options

   IMPORTANT BUG FIX:
   - This function first resets the dropdown so it doesn’t “stick”
     on only one option.
   - It also adds a safe fallback if bodyArea is missing in the data.
------------------------------------------------------------ */
function populateBodyAreas(){
  const select = $("area");
  if (!select) return;

  /* Reset dropdown completely */
  select.innerHTML = "";

  /* Always include the default option */
  const allOpt = document.createElement("option");
  allOpt.value = "all";
  allOpt.textContent = "All";
  select.appendChild(allOpt);

  /* Collect bodyArea fields from dataset and remove duplicates */
  const uniqueAreas = [...new Set(
    CONDITIONS
      .map(c => (c.bodyArea || "").trim())
      .filter(Boolean)
  )].sort((a,b) => a.localeCompare(b));

  /* Add each unique body area as a dropdown option */
  uniqueAreas.forEach(area => {
    const opt = document.createElement("option");
    opt.value = norm(area);      // internal value for filtering
    opt.textContent = area;      // what the user sees
    select.appendChild(opt);
  });
}


/* ------------------------------------------------------------
   populateExampleChips() = creates clickable example searches

   Why I add these:
   - For IPD demo, I can quickly show the system works
   - It also helps users understand input format
------------------------------------------------------------ */
function populateExampleChips(){
  const box = $("examples");
  const input = $("q");
  if (!box || !input) return;

  const examples = [
    "headache",
    "headache, nausea, light sensitivity",
    "wrist pain",
    "sore throat, fever"
  ];

  box.innerHTML = "";

  examples.forEach(text => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip";
    btn.textContent = text;

    /* Clicking a chip fills the input box */
    btn.addEventListener("click", () => {
      input.value = text;
      input.focus();
    });

    box.appendChild(btn);
  });
}


/* ------------------------------------------------------------
   runSearch() = the main search logic

   Steps:
   1) Read what the user typed in the symptom box
   2) Split by commas → list of symptoms
   3) For each condition in the dataset:
      - check how many symptoms match
      - give it a score
   4) Filter by body area if user selected a specific one
   5) Sort results by highest score
   6) Save results in sessionStorage
   7) Redirect user to results.html

   IMPORTANT BUG NOTE:
   - If CONDITIONS is empty, it means dataset failed to load,
     so searching would always show 0 results.
------------------------------------------------------------ */
function runSearch(){
  const rawText = ($("q")?.value || "").trim();
  const selectedArea = norm($("area")?.value || "all");

  /* If dataset didn’t load, stop early and show message */
  if (!CONDITIONS.length){
    const status = $("status");
    if (status){
      status.textContent = "Dataset not loaded yet. Make sure you are running via a local server (python -m http.server).";
    }
    return;
  }

  /* Split symptoms by comma: "a, b" => ["a","b"] */
  const tokens = rawText
    .split(",")
    .map(s => norm(s))
    .filter(Boolean);

  const scored = CONDITIONS.map(condition => {

    /* bag = searchable text that represents the condition */
    const bag = [
      norm(condition.name),
      norm(condition.description),
      norm(condition.bodyArea),
      (condition.symptoms || []).map(norm).join(" "),
      (condition.keywords || []).map(norm).join(" ")
    ].join(" ");

    let score = 0;

    /* If user typed nothing, show everything */
    if (tokens.length === 0){
      score = 1;
    } else {
      /* Increase score for each token found in the condition “bag” */
      tokens.forEach(t => {
        if (bag.includes(t)) score += 1;
      });
    }

    /* Return the condition plus the score */
    return {
      ...condition,
      _score: score,
      _tokenCount: tokens.length
    };
  });

  /* Remove conditions that had no matching symptoms */
  let results = scored.filter(c => c._score > 0);

  /* Filter by body area if not "all" */
  if (selectedArea !== "all"){
    results = results.filter(c => norm(c.bodyArea) === selectedArea);
  }

  /* Sort best match first */
  results.sort((a, b) => b._score - a._score);

  /* Save results and query so results.html can display them */
  sessionStorage.setItem(KEY_RESULTS, JSON.stringify(results));
  sessionStorage.setItem(KEY_QUERY, JSON.stringify({ tokens, selectedArea }));

  /* Move to results page */
  window.location.href = "results.html";
}


/* ------------------------------------------------------------
   renderResults() = shows the result cards on results.html

   How it works:
   - reads sessionStorage
   - builds HTML cards
   - inserts them into the results container
------------------------------------------------------------ */
function renderResults(){
  const resultsEl = $("results");
  const summaryEl = $("summary");
  if (!resultsEl) return;

  const query = JSON.parse(sessionStorage.getItem(KEY_QUERY) || "{}");
  const data  = JSON.parse(sessionStorage.getItem(KEY_RESULTS) || "[]");

  const tokens = query.tokens || [];
  const area   = query.selectedArea || "all";

  /* Build summary text */
  const summaryText =
    tokens.length === 0
      ? `Showing all conditions${area !== "all" ? " | Body area: " + area : ""}.`
      : `Showing ${data.length} result(s) for: "${tokens.join(", ")}"${area !== "all" ? " | Body area: " + area : ""}.`;

  if (summaryEl) summaryEl.textContent = summaryText;

  /* If no results found */
  if (!data.length){
    resultsEl.innerHTML = `
      <div class="card">
        <p>No results found. Try different symptoms or change the body area.</p>
      </div>`;
    return;
  }

  /* Build result cards */
  resultsEl.innerHTML = data.map(item => {

    const symptoms = (item.symptoms || []).slice(0, 8);
    const remedies = (item.educationalRemedies || []).slice(0, 5);

    /* Only show match score if user typed multiple symptoms */
    const scoreLine = item._tokenCount > 1
      ? `<p class="small"><strong>Match score:</strong> ${item._score}/${item._tokenCount}</p>`
      : "";

    return `
      <div class="result-item">
        <h3>${item.name}</h3>
        <p>${item.description || ""}</p>

        ${scoreLine}

        <div class="tags">
          ${item.bodyArea ? `<span class="tag">${item.bodyArea}</span>` : ""}
          ${(item.keywords || []).slice(0,6).map(k => `<span class="tag">${k}</span>`).join("")}
        </div>

        ${symptoms.length ? `
          <p class="small"><strong>Symptoms:</strong> ${symptoms.join(", ")}</p>
        ` : ""}

        ${remedies.length ? `
          <p class="small"><strong>Educational guidance (not treatment):</strong></p>
          <ul class="small">
            ${remedies.map(r => `<li>${r}</li>`).join("")}
          </ul>
        ` : ""}
      </div>
    `;
  }).join("");
}


/* ------------------------------------------------------------
   When page loads:
   - Set disclaimer links on ALL pages
   - If we are on search.html -> load dataset and set listeners
   - If we are on results.html -> render results
------------------------------------------------------------ */
document.addEventListener("DOMContentLoaded", () => {

  /* Make disclaimer navigation work everywhere */
  wireDisclaimerLinks();

  /* Search page */
  if ($("searchBtn")){
    loadDataset();

    /* Clicking Search runs the search */
    $("searchBtn").addEventListener("click", runSearch);

    /* Pressing Enter in input runs the search too */
    $("q").addEventListener("keydown", (e) => {
      if (e.key === "Enter") runSearch();
    });
  }

  /* Results page */
  if ($("results")){
    renderResults();

    /* Clear button deletes results so the page resets */
    const clearBtn = $("clearBtn");
    if (clearBtn){
      clearBtn.addEventListener("click", () => {
        sessionStorage.removeItem(KEY_RESULTS);
        sessionStorage.removeItem(KEY_QUERY);
        $("results").innerHTML = `<div class="card"><p>Cleared. Start a new search.</p></div>`;
        if ($("summary")) $("summary").textContent = "";
      });
    }
  }
});