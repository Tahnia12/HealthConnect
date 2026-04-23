from pathlib import Path
import json

from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# =========================================================
# FILE PATHS
# These point to the two main JSON datasets used by the API.
# =========================================================

ROOT = Path(__file__).resolve().parent.parent
CONDITIONS_FILE = ROOT / "data" / "conditions.json"
MEDICINES_FILE = ROOT / "data" / "medicines.json"


# =========================================================
# HELPER FUNCTIONS
# These helper functions keep the code cleaner and reusable.
# =========================================================

def load_conditions():
    """Load all condition data from conditions.json."""
    with open(CONDITIONS_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def load_medicines():
    """Load all medicine data from medicines.json."""
    with open(MEDICINES_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def norm(value):
    """Normalise text for easier searching and matching."""
    return (value or "").strip().lower()


def find_case_insensitive(items, name):
    """Find an item by name without requiring exact capital letters."""
    wanted = norm(name)
    return next((item for item in items if norm(item.get("name", "")) == wanted), None)


# =========================================================
# BASIC ROUTES
# These help confirm that the API is running correctly.
# =========================================================

@app.get("/")
def home():
    return jsonify({
        "message": "HealthConnect API is running",
        "available_endpoints": [
            "/api/health",
            "/api/conditions",
            "/api/body-areas",
            "/api/search",
            "/api/suggestions",
            "/api/compare",
            "/api/top-conditions",
            "/api/condition",
            "/api/medicines",
            "/api/medicine-categories",
            "/api/medicine-search",
            "/api/compare-medicines",
            "/api/medicine"
        ]
    })


@app.get("/api/health")
def health_check():
    return jsonify({
        "status": "ok",
        "conditions_count": len(load_conditions()),
        "medicines_count": len(load_medicines())
    })


from pathlib import Path
import json

from flask import Flask, jsonify, request
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# =========================================================
# FILE PATHS
# I keep all important data file paths here in one place
# so they are easy to manage and update if needed.
# =========================================================

ROOT = Path(__file__).resolve().parent.parent
DATA_DIR = ROOT / "data"

CONDITIONS_FILE = DATA_DIR / "conditions.json"
MEDICINES_FILE = DATA_DIR / "medicines.json"
SAVED_FILE = DATA_DIR / "saved.json"
HISTORY_FILE = DATA_DIR / "history.json"


# =========================================================
# HELPER FUNCTIONS
# These helper functions are used throughout the API
# for loading/saving JSON files and normalising text.
# =========================================================

def norm(value):
    return (value or "").strip().lower()


def load_json_file(path):
    """
    Safely loads a JSON file.
    If the file does not exist or is empty/invalid,
    it returns an empty list instead of crashing.
    """
    try:
        with open(path, "r", encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return []
    except json.JSONDecodeError:
        return []


def save_json_file(path, data):
    """
    Saves Python data into a JSON file.
    Indent is used to keep the file readable.
    """
    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)


def load_conditions():
    return load_json_file(CONDITIONS_FILE)


def load_medicines():
    return load_json_file(MEDICINES_FILE)


def load_saved():
    return load_json_file(SAVED_FILE)


def save_saved(data):
    save_json_file(SAVED_FILE, data)


def load_history():
    return load_json_file(HISTORY_FILE)


def save_history(data):
    save_json_file(HISTORY_FILE, data)


def find_case_insensitive(items, name):
    """
    Finds an item by name without requiring exact capitalisation.
    """
    wanted = norm(name)
    return next((item for item in items if norm(item.get("name", "")) == wanted), None)


# =========================================================
# ROOT / HEALTH CHECK
# Simple routes used to test whether the API is running.
# =========================================================

@app.get("/")
def home():
    return jsonify({
        "message": "HealthConnect API is running",
        "endpoints": [
            "/api/health",
            "/api/conditions",
            "/api/body-areas",
            "/api/search",
            "/api/suggestions",
            "/api/compare",
            "/api/condition",
            "/api/top-conditions",
            "/api/medicines",
            "/api/medicine-categories",
            "/api/medicine-search",
            "/api/compare-medicines",
            "/api/medicine",
            "/api/saved",
            "/api/history"
        ]
    })


@app.get("/api/health")
def health_check():
    return jsonify({
        "status": "ok",
        "conditions": len(load_conditions()),
        "medicines": len(load_medicines()),
        "saved": len(load_saved()),
        "history": len(load_history())
    })


# =========================================================
# CONDITIONS ENDPOINTS
# These routes return condition data and support searching.
# =========================================================

@app.get("/api/conditions")
def get_conditions():
    return jsonify(load_conditions())


@app.get("/api/body-areas")
def get_body_areas():
    conditions = load_conditions()
    areas = sorted(set(
        c.get("bodyArea", "") for c in conditions if c.get("bodyArea")
    ))
    return jsonify(areas)


@app.get("/api/condition")
def get_condition():
    """
    Returns one condition by name.
    Example:
    /api/condition?name=Migraine
    """
    name = request.args.get("name", "")
    conditions = load_conditions()

    match = find_case_insensitive(conditions, name)
    return jsonify(match or {})


@app.get("/api/top-conditions")
def top_conditions():
    """
    Returns the first 10 conditions.
    Useful for homepage cards or quick access lists.
    """
    conditions = load_conditions()
    return jsonify(conditions[:10])


@app.get("/api/search")
def search_conditions():
    """
    Main condition search route.
    Supports:
    - q = symptom text, separated by commas
    - area = selected body area
    """
    conditions = load_conditions()

    raw_q = request.args.get("q", "")
    selected_area = request.args.get("area", "all")

    tokens = [norm(t) for t in raw_q.split(",") if norm(t)]

    results = []

    for condition in conditions:
        bag = norm(" ".join([
            condition.get("name", ""),
            condition.get("description", ""),
            condition.get("bodyArea", ""),
            " ".join(condition.get("symptoms", [])),
            " ".join(condition.get("keywords", []))
        ]))

        score = 0
        matched_terms = []

        for token in tokens:
            # Higher score if token is in the condition name
            if token in norm(condition.get("name", "")):
                score += 3
                matched_terms.append(token)
            elif token in bag:
                score += 1
                matched_terms.append(token)

        # Filter by area if the user selected one
        if selected_area != "all" and condition.get("bodyArea") != selected_area:
            continue

        # If no tokens were provided, return all (or filtered) conditions
        # Otherwise only return conditions with a score above 0
        if not tokens or score > 0:
            results.append({
                **condition,
                "_score": score,
                "_tokenCount": len(tokens),
                "_matchedTerms": matched_terms
            })

    results.sort(key=lambda x: x.get("_score", 0), reverse=True)
    return jsonify(results)


@app.get("/api/suggestions")
def get_suggestions():
    """
    Returns matching symptoms/keywords for autocomplete suggestions.
    """
    conditions = load_conditions()
    query = norm(request.args.get("q", ""))

    suggestions = set()

    if not query:
        return jsonify([])

    for condition in conditions:
        for symptom in condition.get("symptoms", []):
            if query in norm(symptom):
                suggestions.add(symptom)

        for keyword in condition.get("keywords", []):
            if query in norm(keyword):
                suggestions.add(keyword)

    return jsonify(sorted(suggestions))


@app.get("/api/compare")
def compare_conditions():
    """
    Returns two selected conditions for side-by-side comparison.
    Example:
    /api/compare?first=Migraine&second=Tension%20headache
    """
    conditions = load_conditions()

    first = request.args.get("first", "")
    second = request.args.get("second", "")

    first_match = find_case_insensitive(conditions, first)
    second_match = find_case_insensitive(conditions, second)

    return jsonify({
        "first": first_match,
        "second": second_match
    })


# =========================================================
# MEDICINE ENDPOINTS
# These routes return medicine data and support searching.
# =========================================================

@app.get("/api/medicines")
def get_medicines():
    return jsonify(load_medicines())


@app.get("/api/medicine")
def get_medicine():
    """
    Returns one medicine by name.
    Example:
    /api/medicine?name=Paracetamol
    """
    name = request.args.get("name", "")
    medicines = load_medicines()

    match = find_case_insensitive(medicines, name)
    return jsonify(match or {})


@app.get("/api/medicine-categories")
def get_medicine_categories():
    medicines = load_medicines()
    categories = sorted(set(
        m.get("category", "") for m in medicines if m.get("category")
    ))
    return jsonify(categories)


@app.get("/api/medicine-search")
def search_medicines():
    """
    Main medicine search route.
    Supports:
    - q = text search
    - category = medicine category filter
    """
    medicines = load_medicines()

    raw_q = request.args.get("q", "")
    selected_category = request.args.get("category", "all")

    token = norm(raw_q)
    results = []

    for medicine in medicines:
        bag = norm(" ".join([
            medicine.get("name", ""),
            medicine.get("category", ""),
            medicine.get("description", ""),
            " ".join(medicine.get("usedFor", [])),
            " ".join(medicine.get("commonSideEffects", [])),
            " ".join(medicine.get("importantNotes", []))
        ]))

        if selected_category != "all" and medicine.get("category") != selected_category:
            continue

        if not token or token in bag:
            results.append(medicine)

    return jsonify(results)


@app.get("/api/compare-medicines")
def compare_medicines():
    """
    Returns two selected medicines for side-by-side comparison.
    """
    medicines = load_medicines()

    first = request.args.get("first", "")
    second = request.args.get("second", "")

    first_match = find_case_insensitive(medicines, first)
    second_match = find_case_insensitive(medicines, second)

    return jsonify({
        "first": first_match,
        "second": second_match
    })


# =========================================================
# SAVED / FAVOURITES
# In your app, this is basically the same as the star feature.
# I am calling it "saved" because that matches the UI better.
# =========================================================

@app.get("/api/saved")
def get_saved_items():
    return jsonify(load_saved())


@app.post("/api/saved")
def add_saved_item():
    """
    Adds an item to saved list.
    This can be a condition or a medicine.
    """
    item = request.get_json(silent=True)

    if not item:
        return jsonify({"message": "No item provided"}), 400

    saved_items = load_saved()

    name = norm(item.get("name", ""))
    item_type = norm(item.get("type", ""))

    already_exists = any(
        norm(existing.get("name", "")) == name and
        norm(existing.get("type", "")) == item_type
        for existing in saved_items
    )

    if not already_exists:
        saved_items.append(item)
        save_saved(saved_items)

    return jsonify({"message": "Saved successfully"})


@app.delete("/api/saved")
def delete_saved_item():
    """
    Removes one saved item by name and type.
    Example:
    DELETE /api/saved?name=Migraine&type=condition
    """
    name = norm(request.args.get("name", ""))
    item_type = norm(request.args.get("type", ""))

    saved_items = load_saved()

    updated_items = [
        item for item in saved_items
        if not (
            norm(item.get("name", "")) == name and
            norm(item.get("type", "")) == item_type
        )
    ]

    save_saved(updated_items)
    return jsonify({"message": "Saved item removed"})


@app.delete("/api/saved/all")
def clear_saved_items():
    """
    Clears all saved items.
    """
    save_saved([])
    return jsonify({"message": "All saved items cleared"})


# =========================================================
# HISTORY
# These routes store and return search history.
# Your frontend currently uses localStorage, but this gives
# you proper API support as well if you want to mention it.
# =========================================================

@app.get("/api/history")
def get_history_items():
    return jsonify(load_history())


@app.post("/api/history")
def add_history_item():
    """
    Adds one search to history.
    Example body:
    {
      "type": "condition",
      "query": "headache, nausea",
      "area": "Head & Face",
      "resultCount": 4
    }
    """
    item = request.get_json(silent=True)

    if not item:
        return jsonify({"message": "No history item provided"}), 400

    history = load_history()

    history.insert(0, item)

    # keep history from growing too large
    history = history[:100]

    save_history(history)
    return jsonify({"message": "History saved"})


@app.delete("/api/history")
def clear_history_items():
    """
    Clears all history.
    """
    save_history([])
    return jsonify({"message": "History cleared"})


# =========================================================
# MAIN
# Starts Flask server
# =========================================================

if __name__ == "__main__":
    print("Starting HealthConnect API...")
    app.run(debug=True, port=5001)