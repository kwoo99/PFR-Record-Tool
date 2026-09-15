/** Renders the searchable AutoPay workbook reference from the shared schema. */
(() => {
  const schema = window.autoPayWorkbookSchema;
  const rows = document.getElementById("referenceRows");
  const search = document.getElementById("referenceSearch");
  const count = document.getElementById("referenceCount");
  const empty = document.getElementById("referenceEmpty");
  const topicButtons = document.querySelectorAll("[data-topic]");
  const topicPanels = document.querySelectorAll(".topic-panel");
  let sheetFilter = "all";

  function showTopic(topic) {
    topicButtons.forEach((button) => {
      const current = button.dataset.topic === topic;
      button.classList.toggle("is-current", current);
      button.setAttribute("aria-pressed", String(current));
    });
    topicPanels.forEach((panel) => {
      panel.hidden = panel.id !== `${topic}Topic`;
    });
  }

  function normalizeSearchText(value) {
    return String(value)
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .toLowerCase();
  }

  function appendCell(row, text, className) {
    const cell = document.createElement("td");
    cell.textContent = text;
    if (className) cell.className = className;
    row.append(cell);
  }

  function searchableText(field) {
    return [
      field.name,
      field.type,
      field.required,
      field.description,
      field.example,
      ...(field.options || []),
      ...field.sheets,
    ]
      .map(normalizeSearchText)
      .join(" ");
  }

  function render() {
    const query = normalizeSearchText(search.value.trim());
    const matching = schema.fields.filter(
      (field) =>
        (sheetFilter === "all" || field.sheets.includes(sheetFilter)) &&
        searchableText(field).includes(query),
    );
    const fragment = document.createDocumentFragment();
    for (const field of matching) {
      const row = document.createElement("tr");
      appendCell(row, field.name, "column-name");
      appendCell(row, field.sheets.join(" and "));
      appendCell(row, `${field.type}. ${field.required}.`);
      appendCell(
        row,
        field.options?.length
          ? field.options.join(", ")
          : `Example: ${field.example}`,
        field.options?.length ? "option-list" : "example-value",
      );
      appendCell(row, field.description);
      fragment.append(row);
    }
    rows.replaceChildren(fragment);
    empty.hidden = matching.length > 0;
    count.textContent = `${matching.length} Column${matching.length === 1 ? "" : "s"} Shown`;
  }

  search.addEventListener("input", render);
  topicButtons.forEach((button) => {
    button.addEventListener("click", () => showTopic(button.dataset.topic));
  });
  document.querySelectorAll("[data-sheet]").forEach((button) => {
    button.addEventListener("click", () => {
      sheetFilter = button.dataset.sheet;
      document.querySelectorAll("[data-sheet]").forEach((candidate) => {
        candidate.classList.toggle("is-current", candidate === button);
      });
      render();
    });
  });
  render();
})();
