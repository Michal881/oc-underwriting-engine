(() => {
  const activitySelect = document.getElementById("activity");
  const activityTypeSelect = document.getElementById("activityType");
  const underwritingForm = document.getElementById("underwritingForm");
  const activityQuestions = document.getElementById("activityQuestions");

  if (!activitySelect || !activityTypeSelect) return;

  const state = {
    selectedCategory: "",
    selectedActivity: "",
    allActivities: [],
  };

  function resetSelect(select, placeholder) {
    select.replaceChildren();

    const option = document.createElement("option");
    option.value = "";
    option.textContent = placeholder;
    option.disabled = true;
    option.selected = true;
    select.appendChild(option);

    select.value = "";
    select.disabled = true;
  }

  function normalizeActivities(payload) {
    if (!Array.isArray(payload)) return [];

    return payload
      .map((item) => {
        if (!item || typeof item !== "object") return null;

        const category = String(item.category || "").trim();
        const code = String(item.code || item.id || "").trim();
        const labelPl = String(item.label_pl || "").trim();
        const labelSource = String(item.label_source || "").trim();
        const label = labelPl || labelSource;

        if (!category || !code || !label) return null;

        return {
          id: String(item.id || `${category}:${code}`),
          category,
          code,
          label,
          label_pl: labelPl,
          label_source: labelSource,
          tariff_section: String(item.tariff_section || "").trim(),
        };
      })
      .filter(Boolean);
  }

  function getCategories(activities) {
    return [...new Set(activities.map((item) => item.category))].sort((a, b) =>
      a.localeCompare(b, "pl")
    );
  }

  function renderCategories(categories) {
    resetSelect(
      activityTypeSelect,
      categories.length ? "Select category" : "No categories available"
    );

    if (!categories.length) return;

    const fragment = document.createDocumentFragment();

    for (const category of categories) {
      const option = document.createElement("option");
      option.value = category;
      option.textContent = category;
      fragment.appendChild(option);
    }

    activityTypeSelect.appendChild(fragment);
    activityTypeSelect.disabled = false;
  }

  function renderActivities(category) {
    const activities = state.allActivities.filter((item) => item.category === category);

    resetSelect(
      activitySelect,
      activities.length ? "Select an activity" : "No activities for this category"
    );

    if (!activities.length) return;

    const fragment = document.createDocumentFragment();

    for (const activity of activities) {
      const option = document.createElement("option");
      option.value = activity.id;
      option.textContent = activity.label;
      fragment.appendChild(option);
    }

    activitySelect.appendChild(fragment);
    activitySelect.disabled = false;
  }

  function resetActivityDependentUI() {
    state.selectedActivity = "";

    if (activityQuestions) {
      activityQuestions.replaceChildren();
    }

    if (underwritingForm) {
      const savedCategory = state.selectedCategory;
      underwritingForm.reset();
      activityTypeSelect.value = savedCategory;
    }
  }

  async function loadActivities() {
    const response = await fetch("/activities", {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Failed to load activities (${response.status})`);
    }

    const payload = await response.json();
    state.allActivities = normalizeActivities(payload);

    const categories = getCategories(state.allActivities);
    renderCategories(categories);

    resetSelect(activitySelect, "Select category first");
  }

  activityTypeSelect.addEventListener("change", (event) => {
    state.selectedCategory = event.target.value;
    resetActivityDependentUI();
    renderActivities(state.selectedCategory);
  });

  activitySelect.addEventListener("change", (event) => {
    state.selectedActivity = event.target.value;
  });

  loadActivities().catch((error) => {
    console.error(error);
    resetSelect(activityTypeSelect, "Unable to load categories");
    resetSelect(activitySelect, "Unable to load activities");
  });
})();
