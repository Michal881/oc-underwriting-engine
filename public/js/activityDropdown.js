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
      option.textContent = "Brak dostępnych aktywności w Sekcji A";
      option.disabled = true;
      option.selected = true;
      activitySelect.appendChild(option);
      activitySelect.disabled = true;
      return;
    }

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Wybierz działalność";
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

  function createHelpText(text) {
    if (!text) {
      return null;
    }

    const help = document.createElement("p");
    help.className = "muted";
    help.textContent = text;
    return help;
  }

  function createInput(question) {
    const inputType = question.input_type;

    if (inputType === "boolean") {
      const select = document.createElement("select");
      select.name = question.id;
      select.id = question.id;
      select.required = Boolean(question.required);

      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "Wybierz odpowiedź";
      empty.disabled = true;
      empty.selected = true;
      select.appendChild(empty);

      [
        { value: "yes", label: "Tak" },
        { value: "no", label: "Nie" },
      ].forEach((item) => {
        const option = document.createElement("option");
        option.value = item.value;
        option.textContent = item.label;
        select.appendChild(option);
      });

      return select;
    }

    if (inputType === "number") {
      const input = document.createElement("input");
      input.type = "number";
      input.name = question.id;
      input.id = question.id;
      input.min = "0";
      input.step = "1";
      input.placeholder = "Wpisz liczbę";
      input.required = Boolean(question.required);
      return input;
    }

    if (inputType === "text") {
      const textarea = document.createElement("textarea");
      textarea.name = question.id;
      textarea.id = question.id;
      textarea.rows = 2;
      textarea.placeholder = "Wpisz odpowiedź";
      textarea.required = Boolean(question.required);
      return textarea;
    }

    if (inputType === "single_select") {
      const select = document.createElement("select");
      select.name = question.id;
      select.id = question.id;
      select.required = Boolean(question.required);

      const empty = document.createElement("option");
      empty.value = "";
      empty.textContent = "Wybierz opcję";
      empty.disabled = true;
      empty.selected = true;
      select.appendChild(empty);

      (question.options || []).forEach((entry) => {
        const option = document.createElement("option");
        option.value = entry;
        option.textContent = entry;
        select.appendChild(option);
      });

      return select;
    }

    if (inputType === "multi_select") {
      const wrapper = document.createElement("div");
      wrapper.dataset.multiSelect = question.id;

      (question.options || []).forEach((entry, index) => {
        const line = document.createElement("label");
        line.style.display = "block";
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.name = question.id;
        checkbox.value = entry;
        checkbox.id = `${question.id}_${index}`;
        line.appendChild(checkbox);
        line.append(` ${entry}`);
        wrapper.appendChild(line);
      });

      return wrapper;
    }

    const fallback = document.createElement("input");
    fallback.type = "text";
    fallback.name = question.id;
    fallback.id = question.id;
    fallback.required = Boolean(question.required);
    return fallback;
  }

  function renderQuestions() {
    underwritingQuestionsContainer.replaceChildren();

    const heading = document.createElement("h2");
    heading.textContent = "Kwestionariusz underwritingu";
    underwritingQuestionsContainer.appendChild(heading);

    if (!state.questions || !Array.isArray(state.questions.sections)) {
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = "Brak pytań dla wybranej działalności.";
      underwritingQuestionsContainer.appendChild(p);
      return;
    }

    const allQuestions = state.questions.questionnaire_schema || [];
    let questionNumber = 1;

    state.questions.sections.forEach((section) => {
      const sectionCard = document.createElement("div");
      sectionCard.className = "card";

      const sectionTitle = document.createElement("h3");
      sectionTitle.textContent = section.name;
      sectionCard.appendChild(sectionTitle);

      section.questions.forEach((question) => {
        const block = document.createElement("div");
        block.className = "question";

        const label = document.createElement("label");
        label.setAttribute("for", question.id);
        label.textContent = `${questionNumber}. ${question.label_pl}`;
        block.appendChild(label);

        const meta = document.createElement("p");
        meta.className = "muted";
        meta.textContent = `Źródło: ${question.source} • Wpływ: ${question.affects}`;
        block.appendChild(meta);

        const help = createHelpText(question.help_text_pl);
        if (help) {
          block.appendChild(help);
        }

        const input = createInput(question);
        block.appendChild(input);

        sectionCard.appendChild(block);
        questionNumber += 1;
      });

      underwritingQuestionsContainer.appendChild(sectionCard);
    });

    if (!allQuestions.length) {
      const p = document.createElement("p");
      p.className = "muted";
      p.textContent = "Brak pytań w schemacie.";
      underwritingQuestionsContainer.appendChild(p);
    }
  }

  function collectAnswers() {
    const answers = {};
    const questions = state.questions?.questionnaire_schema || [];

    questions.forEach((question) => {
      if (question.input_type === "multi_select") {
        const checked = underwritingForm.querySelectorAll(`input[name="${question.id}"]:checked`);
        answers[question.id] = Array.from(checked).map((input) => input.value);
        return;
      }

      const field = underwritingForm.elements.namedItem(question.id);
      answers[question.id] = field ? field.value : "";
    });

    return answers;
  }

  function formatNumber(value) {
    if (typeof value !== "number") {
      return String(value);
    }

    return value.toLocaleString("pl-PL", { maximumFractionDigits: 2 });
  }

  function renderResult(payload) {
    resultContainer.replaceChildren();

    const heading = document.createElement("h2");
    heading.textContent = "Wynik kalkulacji";
    resultContainer.appendChild(heading);

    const decision = document.createElement("p");
    const status = payload.decision_status || "unavailable";
    decision.className = status === "accept" ? "ok" : status === "manual_review" ? "warning" : "error";
    decision.textContent = `Status decyzji: ${status}`;
    resultContainer.appendChild(decision);

    if (status === "manual_review" && Array.isArray(payload.manual_review_reasons)) {
      const reasonTitle = document.createElement("p");
      reasonTitle.textContent = "Powody przekazania do oceny manualnej:";
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
      unavailable.textContent = payload.message || "Brak wyniku kalkulacji.";
      resultContainer.appendChild(unavailable);
      return;
    }

    const q = payload.quote_result;
    const list = document.createElement("ul");
    list.innerHTML = `
      <li>Stawka bazowa ‰: ${formatNumber(q.base_rate_per_mille)}</li>
      <li>Składka bazowa (EUR): ${formatNumber(q.base_premium_eur)}</li>
      <li>Składka minimalna (EUR): ${formatNumber(q.minimum_premium_eur)}</li>
      <li>Zniżka degresyjna: ${formatNumber(q.degression_discount_applied_percent)}%</li>
      <li>Łączne dopłaty (EUR): ${formatNumber(q.total_surcharges_eur)}</li>
      <li><strong>Składka końcowa (EUR): ${formatNumber(q.final_premium_eur)}</strong></li>
    `;
    resultContainer.appendChild(list);

    const uw = q.underwriting_output || {};

    const uwTitle = document.createElement("h3");
    uwTitle.textContent = "Podsumowanie odpowiedzi underwritingowych";
    resultContainer.appendChild(uwTitle);

    function appendAnswerGroup(title, items) {
      const subtitle = document.createElement("h4");
      subtitle.textContent = title;
      resultContainer.appendChild(subtitle);

      if (!Array.isArray(items) || !items.length) {
        const empty = document.createElement("p");
        empty.className = "muted";
        empty.textContent = "Brak pozycji.";
        resultContainer.appendChild(empty);
        return;
      }

      const ul = document.createElement("ul");
      items.forEach((item) => {
        const li = document.createElement("li");
        const answer = Array.isArray(item.answer) ? item.answer.join(", ") : item.answer;
        li.textContent = `${item.label_pl}: ${answer}`;
        ul.appendChild(li);
      });
      resultContainer.appendChild(ul);
    }

    appendAnswerGroup("Reguły taryfowe wpływające na składkę", uw.premium_affecting_tariff_rules);
    appendAnswerGroup("Triggery manual review", uw.manual_review_underwriting_answers);
    appendAnswerGroup("Odpowiedzi informacyjne", uw.information_only_underwriting_answers);

    const traceTitle = document.createElement("h3");
    traceTitle.textContent = "Ślad audytowy";
    resultContainer.appendChild(traceTitle);

    const trace = document.createElement("pre");
    trace.textContent = JSON.stringify(payload.audit_trace || [], null, 2);
    resultContainer.appendChild(trace);
  }

  async function loadQuestions(activityId = "") {
    const query = activityId ? `?activity_id=${encodeURIComponent(activityId)}` : "";
    const response = await fetch(`/api/section-a/questions${query}`);

    if (!response.ok) {
      throw new Error("Nie udało się pobrać pytań");
    }

    state.questions = await response.json();
    renderQuestions();
  }

  async function loadInitialData() {
    const activitiesResponse = await fetch("/api/section-a/activities");

    if (!activitiesResponse.ok) {
      throw new Error("Nie udało się pobrać aktywności Sekcji A");
    }

    const activitiesPayload = await activitiesResponse.json();

    state.activities = Array.isArray(activitiesPayload.activities) ? activitiesPayload.activities : [];

    renderActivities(state.activities);
    await loadQuestions();
  }

  activitySelect.addEventListener("change", async () => {
    await loadQuestions(activitySelect.value);
  });

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
      throw new Error(`Kalkulacja nie powiodła się (${response.status})`);
    }

    const payload = await response.json();
    renderResult(payload);
  });

  loadInitialData().catch((error) => {
    resultContainer.replaceChildren();
    const heading = document.createElement("h2");
    heading.textContent = "Wynik kalkulacji";
    resultContainer.appendChild(heading);

    const msg = document.createElement("p");
    msg.className = "error";
    msg.textContent = `Błąd ładowania danych: ${error.message}`;
    resultContainer.appendChild(msg);
  });
})();
