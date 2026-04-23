const COMPARE_DATA_URL = "data/conditions.json";
let COMPARE_CONDITIONS = [];

function $(id) {
  return document.getElementById(id);
}

function norm(value) {
  return (value || "").toString().trim().toLowerCase();
}

async function loadCompareConditions() {
  const statusEl = $("compareStatus");

  try {
    if (statusEl) {
      statusEl.textContent = "Loading conditions...";
    }

    const res = await fetch(COMPARE_DATA_URL);
    if (!res.ok) throw new Error("Failed to load conditions");

    COMPARE_CONDITIONS = await res.json();

    populateCompareDropdowns();

    if (statusEl) {
      statusEl.textContent = `Loaded ${COMPARE_CONDITIONS.length} conditions.`;
    }
  } catch (err) {
    console.error(err);
    if (statusEl) {
      statusEl.textContent = "Could not load conditions.";
    }
  }
}

function populateCompareDropdowns() {
  const selectOne = $("compareOne");
  const selectTwo = $("compareTwo");

  if (!selectOne || !selectTwo) return;

  const names = COMPARE_CONDITIONS.map(item => item.name).sort();

  names.forEach(name => {
    const option1 = document.createElement("option");
    option1.value = name;
    option1.textContent = name;
    selectOne.appendChild(option1);

    const option2 = document.createElement("option");
    option2.value = name;
    option2.textContent = name;
    selectTwo.appendChild(option2);
  });
}

function renderConditionCard(condition, targetId) {
  const target = $(targetId);
  if (!target || !condition) return;

  const symptoms = (condition.symptoms || []).join(", ");
  const remedies = (condition.educationalRemedies || [])
    .map(item => `<li>${item}</li>`)
    .join("");

  target.innerHTML = `
    <h3>${condition.name}</h3>
    <p>${condition.description || ""}</p>
    <p><strong>Body area:</strong> ${condition.bodyArea || "General"}</p>
    <p><strong>Symptoms:</strong> ${symptoms || "Not listed"}</p>
    <p><strong>Educational guidance:</strong></p>
    <ul>${remedies || "<li>No guidance listed</li>"}</ul>
  `;
}

function runCompare() {
  const valueOne = $("compareOne")?.value || "";
  const valueTwo = $("compareTwo")?.value || "";

  if (!valueOne || !valueTwo) {
    alert("Please select two conditions to compare.");
    return;
  }

  const conditionOne = COMPARE_CONDITIONS.find(item => item.name === valueOne);
  const conditionTwo = COMPARE_CONDITIONS.find(item => item.name === valueTwo);

  if (!conditionOne || !conditionTwo) {
    alert("Could not find one or both selected conditions.");
    return;
  }

  renderConditionCard(conditionOne, "compareResultOne");
  renderConditionCard(conditionTwo, "compareResultTwo");

  const grid = $("compareGrid");
  if (grid) {
    grid.style.display = "grid";
  }
}

function clearCompare() {
  const selectOne = $("compareOne");
  const selectTwo = $("compareTwo");
  const resultOne = $("compareResultOne");
  const resultTwo = $("compareResultTwo");
  const grid = $("compareGrid");

  if (selectOne) selectOne.value = "";
  if (selectTwo) selectTwo.value = "";
  if (resultOne) resultOne.innerHTML = "";
  if (resultTwo) resultTwo.innerHTML = "";
  if (grid) grid.style.display = "none";
}

document.addEventListener("DOMContentLoaded", async () => {
  await loadCompareConditions();

  const compareBtn = $("compareBtn");
  const clearBtn = $("clearCompareBtn");

  if (compareBtn) compareBtn.onclick = runCompare;
  if (clearBtn) clearBtn.onclick = clearCompare;
});