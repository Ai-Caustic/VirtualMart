document.addEventListener("DOMContentLoaded", () => {
  const grid = document.getElementById("resultsGrid");
  const sortSelect = document.getElementById("sortBy");
  const searchForm = document.getElementById("searchForm");

  if (!grid) return; // nothing to do if grid isn't on the page

  let vehicles = [];
  let currentList = [];

  // Utility: format engine size for display
  function formatEngine(e) {
    if (e == null) return "";
    if (typeof e === "number") {
      // treat >=100 as cc (e.g. 1800), otherwise liters (e.g. 1.8)
      return e >= 100 ? `${e}cc` : `${e}L`;
    }
    // string: return as-is (assume it already contains units)
    return e;
  }

  // Utility: safely get first image (paths in JSON expected relative to this HTML file)
  function firstImage(v) {
    if (v.images && Array.isArray(v.images) && v.images.length > 0)
      return v.images[0];
    // fallback placeholder (place an actual placeholder image at this path)
    return "images/placeholder.png";
  }

  // Render list into grid
  function renderVehicles(list) {
    grid.innerHTML = "";

    if (!Array.isArray(list) || list.length === 0) {
      grid.innerHTML =
        '<div class="col-12 text-center text-muted">No vehicles found.</div>';
      return;
    }

    const fragment = document.createDocumentFragment();

    list.forEach((v) => {
      const col = document.createElement("div");
      col.className = "col-md-4 mb-4";

      // Use template string for card markup
      const imgSrc = firstImage(v);
      const engineDisplay = formatEngine(v.engineSize);

      col.innerHTML = `
        <div class="blog_box h-100 d-flex flex-column">
          <div class="blog_img">
            <!-- onerror fallback to placeholder -->
            <img src="${imgSrc}" alt="${escapeHtml(
        v.make + " " + v.model
      )}" onerror="this.onerror=null;this.src='images/placeholder.png'">
          </div>
          <div class="btn_main">
            <div class="date_text"><a href="#">$${Number(
              v.price
            ).toLocaleString()}</a></div>
          </div>
          <h3 class="blog_text">${escapeHtml(v.make)} ${escapeHtml(
        v.model
      )}</h3>
          <p class="lorem_text">${escapeHtml(v.year)} — ${escapeHtml(
        engineDisplay
      )} — ${escapeHtml(v.transmission)} — ${escapeHtml(v.color)}</p>
          <ul class="list-unstyled mt-2 small">
            <li><strong>Model Code:</strong> ${escapeHtml(
              v.modelCode || ""
            )}</li>
            <li><strong>Engine:</strong> ${escapeHtml(engineDisplay)}</li>
          </ul>
          <div class="mt-auto read_bt">
            <a href="vehicle.html?id=${encodeURIComponent(v.id)}">View Details
              <span class="arrow_icon"><i class="fa fa-long-arrow-right" aria-hidden="true"></i></span>
            </a>
          </div>
        </div>
      `;

      fragment.appendChild(col);
    });

    grid.appendChild(fragment);
  }

  // Basic sanitization for innerHTML values
  function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Apply search filters
  function applySearch() {
    if (!searchForm) {
      // no search form — show all
      renderVehicles(vehicles);
      return;
    }

    const formData = new FormData(searchForm);
    const make = (formData.get("make") || "").trim().toLowerCase();
    const model = (formData.get("model") || "").trim().toLowerCase();
    const year = (formData.get("year") || "").trim();
    const enginesizeInput = (formData.get("enginesize") || "").trim();

    // Try to coerce engine size input to number if possible (user may type 1800 or 1.8)
    const engineQueryNum = enginesizeInput ? Number(enginesizeInput) : null;

    currentList = vehicles.filter((v) => {
      // make/model text match (partial)
      const okMake =
        !make || (v.make && v.make.toString().toLowerCase().includes(make));
      const okModel =
        !model || (v.model && v.model.toString().toLowerCase().includes(model));

      // year exact match if provided
      const okYear = !year || (v.year && v.year.toString() === year);

      // engine match: allow comparing numbers or substring match
      let okEngine = true;
      if (enginesizeInput) {
        const ve = v.engineSize;
        if (ve == null) okEngine = false;
        else if (typeof ve === "number" && !isNaN(engineQueryNum)) {
          // if both numbers: compare intelligently (if ve is 1800 treat engineQueryNum 1800, if ve 1.8 and query 1.8 numeric)
          if (ve >= 100) {
            okEngine = ve === engineQueryNum; // cc compare
          } else {
            // liters compare with small tolerance
            okEngine = Math.abs(ve - engineQueryNum) < 0.01;
          }
        } else {
          // fallback string match (case-insensitive)
          okEngine = ve
            .toString()
            .toLowerCase()
            .includes(enginesizeInput.toLowerCase());
        }
      }

      return okMake && okModel && okYear && okEngine;
    });

    renderVehicles(currentList);
  }

  // Sort logic
  function applySortBy(key) {
    let listToSort = currentList.length ? [...currentList] : [...vehicles];
    if (!key) {
      renderVehicles(listToSort);
      return;
    }

    if (key === "price") {
      listToSort.sort((a, b) => Number(a.price || 0) - Number(b.price || 0));
    } else if (key === "date") {
      listToSort.sort((a, b) => {
        const da = a.dateAdded ? new Date(a.dateAdded) : new Date(0);
        const db = b.dateAdded ? new Date(b.dateAdded) : new Date(0);
        return db - da; // newest first
      });
    } else if (key === "year") {
      listToSort.sort((a, b) => Number(b.year || 0) - Number(a.year || 0));
    }
    renderVehicles(listToSort);
  }

  // Event listeners (defensive)
  if (sortSelect) {
    sortSelect.addEventListener("change", () => applySortBy(sortSelect.value));
  }
  if (searchForm) {
    searchForm.addEventListener("submit", (e) => {
      e.preventDefault();
      applySearch();
    });
  }

  // Load vehicles.json
  fetch("vehicles.json")
    .then((res) => {
      if (!res.ok)
        throw new Error("Failed to fetch vehicles.json: " + res.status);
      return res.json();
    })
    .then((data) => {
      if (!Array.isArray(data))
        throw new Error("vehicles.json must be an array");
      vehicles = data;
      currentList = [...vehicles];
      renderVehicles(currentList);
    })
    .catch((err) => {
      console.error(err);
      grid.innerHTML =
        '<div class="col-12 text-center text-danger">Failed to load vehicle data.</div>';
    });
});
