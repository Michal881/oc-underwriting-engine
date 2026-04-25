// Activity dropdown controller
// Fixes:
// 1) always renders real <option> nodes
// 2) keeps <select> enabled only when data exists
// 3) resets stale selected state when activity type changes

(() => {
  const activitySelect = document.getElementById("activity");
  const activityTypeSelect = document.getElementById("activityType");

  if (!activitySelect) return;

  const state = {
    activityType: activityTypeSelect?.value || "",
    selectedActivity: "",
    activities: [],
  };

  function resetActivityDropdown(placeholder = "Select an activity") {
    state.selectedActivity = "";
    state.activities = [];

    activitySelect.replaceChildren();

    const option = document.createElement("option");
    option.value = "";
    option.textContent = placeholder;
    option.disabled = true;
    option.selected = true;
    activitySelect.appendChild(option);

    activitySelect.value = "";
    activitySelect.disabled = true;
  }

  function normalizeActivities(payload) {
    if (!Array.isArray(payload)) return [];

    return payload
      .map((item) => {
        if (typeof item === "string") {
          return { value: item, label: item };
        }

        if (item && typeof item === "object") {
          const value = String(item.value ?? item.id ?? item.name ?? "").trim();
          const label = String(item.label ?? item.name ?? item.value ?? "").trim();
          if (!value || !label) return null;
          return { value, label };
        }

        return null;
      })
      .filter(Boolean);
  }

  function renderActivityOptions(activities) {
    resetActivityDropdown(
      activities.length ? "Select an activity" : "No activities available"
    );

    if (!activities.length) return;

    const fragment = document.createDocumentFragment();

    for (const activity of activities) {
      const option = document.createElement("option");
      option.value = activity.value;
      option.textContent = activity.label;
      fragment.appendChild(option);
    }

    activitySelect.appendChild(fragment);
    activitySelect.disabled = false;
  }

  async function loadActivities(activityType = "") {
    resetActivityDropdown("Loading activities...");

    const query = activityType
      ? `?type=${encodeURIComponent(activityType)}`
      : "";

    const response = await fetch(`/activities${query}`, {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      throw new Error(`Failed to load activities (${response.status})`);
    }

    const payload = await response.json();
    const list = normalizeActivities(payload);

    state.activities = list;
    renderActivityOptions(list);
  }

  activitySelect.addEventListener("change", (event) => {
    state.selectedActivity = event.target.value;
  });

  if (activityTypeSelect) {
    activityTypeSelect.addEventListener("change", async (event) => {
      state.activityType = event.target.value;
      resetActivityDropdown();

      try {
        await loadActivities(state.activityType);
      } catch (error) {
        console.error(error);
        resetActivityDropdown("Unable to load activities");
      }
    });
  }

  loadActivities(state.activityType).catch((error) => {
    console.error(error);
    resetActivityDropdown("Unable to load activities");
  });
})();
