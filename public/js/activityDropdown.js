(() => {
  const activitySelect = document.getElementById("activity");
  const underwritingForm = document.getElementById("underwritingForm");
  const underwritingQuestionsContainer = document.getElementById("underwritingQuestions");
  const resultContainer = document.getElementById("result");

  if (!activitySelect || !underwritingForm || !underwritingQuestionsContainer || !resultContainer) {
    return;
  }

  const state = {
    activities: [],
    questions: null,
  };

  function renderActivities(activities) {
    activitySelect.replaceChildren();

    if (!activities.length) {
      const option = document.createElement("option");
      option.value = "";
      option.textContent = "No Section A activities available";
      option.disabled = true;
      option.selected = true;
      activitySelect.appendChild(option);
      activitySelect.disabled = true;
      return;
    }

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select a Section A activity";
    placeholder.disabled = true;
    placeholder.selected = true;
    activitySelect.appendChild(placeholder);

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

  function buildYesNoQuestion(question, index) {
    const wrapper = document.createElement("div");
    wrapper.className = "question";

    const label = document.createElement("label");
    label.textContent = `${index + 1}. ${question.question_pl || question.question_de}`;
    label.setAttribute("for", question.id);

    const select = document.createElement("select");
    select.id = question.id;
    select.name = question.id;
    select.required = true;

    const unknown = document.createElement("option");
    unknown.value = "";
    unknown.textContent = "Select answer";
    unknown.selected = true;
    unknown.disabled = true;

    const yes = document.createElement("option");
    yes.value = "yes";
    yes.textContent = "Yes";

    const no = document.createElement("option");
    no.value = "no";
    no.textContent = "No";

    select.appendChild(unknown);
    select.appendChild(yes);
    select.appendChild(no);

    wrapper.appendChild(label);
    wrapper.appendChild(select);
    return wrapper;
  }

  function renderQuestions() {
    underwritingQuestionsContainer.replaceChildren();

    const heading = document.createElement("h2");
    heading.textContent = "Underwriting questions";
    underwritingQuestionsContainer.appendChild(heading);

    if (!state.questions) {
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = "Questions are not available in extracted data.";
      underwritingQuestionsContainer.appendChild(p);
      return;
    }

    const uw = Array.isArray(state.questions.underwriting_questions)
      ? state.questions.underwriting_questions
      : [];

    if (!uw.length) {
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = "Underwriting questions are not available in extracted data.";
      underwritingQuestionsContainer.appendChild(p);
    }

    uw.forEach((question, index) => {
      underwritingQuestionsContainer.appendChild(buildYesNoQuestion(question, index));
    });

    const conditionalTitle = document.createElement("h3");
    conditionalTitle.textContent = "Conditional questions";
    underwritingQuestionsContainer.appendChild(conditionalTitle);

    const conditional = Array.isArray(state.questions.conditional_questions)
      ? state.questions.conditional_questions
      : [];

    if (!conditional.length) {
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = "Conditional questions: not available in extracted data.";
      underwritingQuestionsContainer.appendChild(p);
      return;
    }

    const ul = document.createElement("ul");
    for (const item of conditional) {
      const li = document.createElement("li");
      li.textContent = `${item.condition_de} → ${item.question_de}`;
      ul.appendChild(li);
    }

    underwritingQuestionsContainer.appendChild(ul);
  }

  function collectAnswers() {
    const answers = {};
    const questions = state.questions?.underwriting_questions || [];

    for (const question of questions) {
      const field = underwritingForm.elements.namedItem(question.id);
      answers[question.id] = field ? field.value : "";
    }

    return answers;
  }

  function formatNumber(value) {
    if (typeof value !== "number") {
      return String(value);
    }

    return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
  }

  function renderResult(payload) {
    resultContainer.replaceChildren();

    const heading = document.createElement("h2");
    heading.textContent = "Premium breakdown";
    resultContainer.appendChild(heading);

    const decision = document.createElement("p");
    const status = payload.decision_status || "unavailable";
    decision.className = status === "accept" ? "ok" : status === "manual_review" ? "warning" : "error";
    decision.textContent = `Decision status: ${status}`;
    resultContainer.appendChild(decision);

    if (status === "manual_review" && Array.isArray(payload.manual_review_reasons)) {
      const reasonTitle = document.createElement("p");
      reasonTitle.textContent = "Manual review reasons:";
      resultContainer.appendChild(reasonTitle);

      const ul = document.createElement("ul");
      payload.manual_review_reasons.forEach((reason) => {
        const li = document.createElement("li");
        li.textContent = reason;
        ul.appendChild(li);
      });
      resultContainer.appendChild(ul);
    }

    if (!payload.quote_result) {
      const unavailable = document.createElement("p");
      unavailable.textContent = payload.message || "Quote result not available in extracted data.";
      resultContainer.appendChild(unavailable);
    } else {
      const q = payload.quote_result;
      const list = document.createElement("ul");
      list.innerHTML = `
        <li>Base rate per mille: ${formatNumber(q.base_rate_per_mille)}</li>
        <li>Base premium (EUR): ${formatNumber(q.base_premium_eur)}</li>
        <li>Minimum premium (EUR): ${formatNumber(q.minimum_premium_eur)}</li>
        <li>Degression discount applied: ${formatNumber(q.degression_discount_applied_percent)}%</li>
        <li>Total surcharges (EUR): ${formatNumber(q.total_surcharges_eur)}</li>
        <li><strong>Final premium (EUR): ${formatNumber(q.final_premium_eur)}</strong></li>
      `;
      resultContainer.appendChild(list);
    }

    const traceTitle = document.createElement("h3");
    traceTitle.textContent = "Audit trace";
    resultContainer.appendChild(traceTitle);

    const trace = document.createElement("pre");
    trace.textContent = JSON.stringify(payload.audit_trace || [], null, 2);
    resultContainer.appendChild(trace);
  }

  async function loadInitialData() {
    const [activitiesResponse, questionsResponse] = await Promise.all([
      fetch("/api/section-a/activities"),
      fetch("/api/section-a/questions"),
    ]);

    if (!activitiesResponse.ok || !questionsResponse.ok) {
      throw new Error("Failed to load Section A data");
    }

    const activitiesPayload = await activitiesResponse.json();
    const questionsPayload = await questionsResponse.json();

    state.activities = Array.isArray(activitiesPayload.activities) ? activitiesPayload.activities : [];
    state.questions = questionsPayload;

    renderActivities(state.activities);
    renderQuestions();
  }

  underwritingForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const activity_id = activitySelect.value;
    const turnover_eur = Number(document.getElementById("turnover").value);

    const response = await fetch("/api/section-a/quote", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        activity_id,
        turnover_eur,
        answers: collectAnswers(),
      }),
    });

    if (!response.ok) {
      throw new Error(`Calculation failed (${response.status})`);
    }

    const payload = await response.json();
    renderResult(payload);
  });

  loadInitialData().catch((error) => {
    resultContainer.replaceChildren();
    const heading = document.createElement("h2");
    heading.textContent = "Premium breakdown";
    resultContainer.appendChild(heading);

    const msg = document.createElement("p");
    msg.className = "error";
    msg.textContent = `Failed to load Section A data: ${error.message}`;
    resultContainer.appendChild(msg);
  });
})();
