import { createPagination, element, fetchJSON } from "../catalog.js";

const help = document.querySelector(".summon-help");
const helpKey = "astro-summon-help-open:v1";
try {
  help.open = localStorage.getItem(helpKey) === "yes";
} catch {
  /* Help still works when browser storage is unavailable. */
}
help.addEventListener("toggle", () => {
  try {
    localStorage.setItem(helpKey, help.open ? "yes" : "no");
  } catch {
    /* Remember the choice only when storage is available. */
  }
});

const warning = document.querySelector(".summon-warning-dialog");
const acknowledgementKey = "astro-summon-acknowledged:v1";

function showWarning() {
  warning.showModal();
}

warning.addEventListener("cancel", (event) => event.preventDefault());
warning.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    event.preventDefault();
    event.stopPropagation();
  }
});
warning.querySelector("button").addEventListener("click", () => {
  try {
    sessionStorage.setItem(acknowledgementKey, "yes");
  } catch {
    /* Acknowledgement still works when browser storage is unavailable. */
  }
  warning.close();
});
document.querySelector("#read-warning").addEventListener("click", showWarning);
let acknowledged = false;
try {
  acknowledged = sessionStorage.getItem(acknowledgementKey) === "yes";
} catch {
  /* Show the warning when browser storage is unavailable. */
}
if (!acknowledged) showWarning();

const search = document.querySelector("#search");
const group = document.querySelector("#group");
const scope = document.querySelector("#scope");
const perPage = document.querySelector("#per-page");
const form = document.querySelector(".list-filters");
const rows = document.querySelector("#rows");
const table = document.querySelector(".summon-table");
const pagination = createPagination(perPage, render);
const scrollPane = document.querySelector(".scroll-pane");
let items = [];
let filtered = [];
let statusTimer;
const info = document.querySelector("#item-info");
let infoButton;
let infoTimer;
const riskLabels = { low: "Low risk", medium: "Medium risk", high: "High risk" };

function closeInfo() {
  clearTimeout(infoTimer);
  info.hidePopover();
  infoButton?.setAttribute("aria-expanded", "false");
  infoButton?.removeAttribute("aria-describedby");
  infoButton = null;
}

function positionInfo() {
  if (!infoButton) return;
  const anchor = infoButton.getBoundingClientRect();
  const left = Math.max(12, Math.min(anchor.right + 10, innerWidth - info.offsetWidth - 12));
  const top = Math.max(12, Math.min(anchor.top - 8, innerHeight - info.offsetHeight - 12));
  info.style.left = `${left}px`;
  info.style.top = `${top}px`;
}

function showInfo(button, item, type = "details") {
  clearTimeout(infoTimer);
  infoButton?.setAttribute("aria-expanded", "false");
  infoButton?.removeAttribute("aria-describedby");
  infoButton = button;
  info.replaceChildren(element("div", item.name || item.variant, "summon-info-title"));
  if (type === "risk") {
    info.append(element("p", riskLabels[item.risk_level], "summon-risk-label"));
    for (const issue of item.risk_issues) info.append(element("p", issue));
    if (!item.risk_issues.length) info.append(element("p", "No risk information recorded."));
  } else {
    if (item.description) info.append(element("p", item.description));
    if (item.category) info.append(element("p", item.category, "summon-category"));
    info.append(element("p", `Group · ${item.group}`), element("code", item.item_type));
  }
  button.setAttribute("aria-expanded", "true");
  button.setAttribute("aria-describedby", "item-info");
  info.showPopover();
  positionInfo();
}

function leaveInfo() {
  clearTimeout(infoTimer);
  infoTimer = setTimeout(closeInfo, 160);
}

function connectInfo(button, item, type = "details") {
  button.setAttribute("aria-expanded", "false");
  button.setAttribute("aria-controls", "item-info");
  button.addEventListener("pointerenter", () => showInfo(button, item, type));
  button.addEventListener("focus", () => showInfo(button, item, type));
  button.addEventListener("pointerleave", leaveInfo);
  button.addEventListener("blur", leaveInfo);
}

info.addEventListener("pointerenter", () => clearTimeout(infoTimer));
info.addEventListener("pointerleave", leaveInfo);
document.addEventListener("pointerdown", (event) => {
  if (!info.contains(event.target) && !infoButton?.contains(event.target)) closeInfo();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeInfo();
});
scrollPane.addEventListener("scroll", positionInfo, { passive: true });
window.addEventListener("resize", positionInfo);

function showCopyStatus(message, duration = 3000) {
  const status = document.querySelector("#copy-status");
  clearTimeout(statusTimer);
  status.textContent = message;
  status.classList.add("is-visible");
  if (duration) {
    statusTimer = setTimeout(() => status.classList.remove("is-visible"), duration);
  }
}

async function copyCommand(item, button, code) {
  try {
    await navigator.clipboard.writeText(item.command);
    button.textContent = "Copied!";
    showCopyStatus(`Copied command for ${item.name || item.variant}`);
    setTimeout(() => {
      button.textContent = "Copy";
    }, 1500);
  } catch {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(code);
    selection.removeAllRanges();
    selection.addRange(range);
    showCopyStatus("Clipboard unavailable. The command is selected so you can copy it manually.", 0);
  }
}

function itemRow(item) {
  const row = document.createElement("tr");
  row.dataset.risk = item.risk_level;
  const name = document.createElement("td");
  const risk = element("button", "", "summon-risk");
  risk.type = "button";
  risk.setAttribute("aria-label", `${riskLabels[item.risk_level]} for ${item.name || item.variant}`);
  connectInfo(risk, item, "risk");
  name.append(risk);
  const title = element("div", item.name || "Name unavailable", "summon-name");
  const icon = element("button", "ⓘ", "summon-info");
  icon.type = "button";
  icon.setAttribute("aria-label", `Details for ${item.name || item.variant}`);
  connectInfo(icon, item);
  title.append(icon);
  name.append(title);
  name.append(element("div", item.variant, "summon-variant"));
  const command = document.createElement("td");
  const code = element("code", item.command);
  code.title = code.textContent;
  command.append(code);
  for (const note of item.notes) command.append(element("p", note, "summon-note"));
  const action = document.createElement("td");
  const button = element("button", "Copy");
  button.type = "button";
  button.setAttribute("aria-label", `Copy command for ${item.name || item.variant}`);
  button.addEventListener("click", () => copyCommand(item, button, code));
  action.append(button);
  row.append(name, command, action);
  return row;
}

function render() {
  closeInfo();
  rows.replaceChildren(...pagination.render(filtered).map(itemRow));
  table.hidden = !filtered.length;
}

function filter() {
  const query = search.value.trim().toLocaleLowerCase();
  filtered = items.filter((item) => {
    if (group.value && item.group !== group.value) return false;
    if (scope.value === "unflagged" && item.needs_checking) return false;
    if (scope.value === "flagged" && !item.needs_checking) return false;
    if (riskLabels[scope.value] && item.risk_level !== scope.value) return false;
    return !query || item.searchText.includes(query);
  });
  pagination.reset();
  render();
}

form.addEventListener("submit", (event) => event.preventDefault());
form.addEventListener("input", filter);
form.addEventListener("reset", (event) => {
  event.preventDefault();
  search.value = "";
  group.value = "";
  scope.value = "all";
  perPage.value = "50";
  filter();
});
try {
  const data = await fetchJSON("summon.json");
  items = data.items
    .filter((item) => typeof item.command === "string" && item.command.trim())
    .map((item) => ({
      ...item,
      risk_level: riskLabels[item.risk_level] ? item.risk_level : "low",
      needs_checking: Boolean(item.needs_checking || item.risk_level === "medium" || item.risk_level === "high"),
      risk_issues: Array.isArray(item.risk_issues) ? item.risk_issues : [],
      searchText: [item.name, item.variant, item.command, item.category, item.group, item.description, item.item_type, ...item.notes].join(" ").toLocaleLowerCase(),
    }));
  for (const name of [...new Set(items.map((item) => item.group))].sort()) {
    const option = element("option", name);
    option.value = name;
    group.append(option);
  }
  const summary = data.summary;
  document.querySelector("#summary").textContent = `${items.length.toLocaleString()} definitions · ${summary.unique_commands.toLocaleString()} unique commands`;
  document.querySelector("#snapshot").textContent = `Extracted ${summary.date} · Steam build ${summary.steam_build_id}.`;
  form.querySelectorAll("[disabled]").forEach((control) => {
    control.disabled = false;
  });
  filter();
} catch (error) {
  document.querySelector("#summary").textContent = "Summon code reference";
  document.querySelector("#count").textContent = "Summon list unavailable";
  document.querySelector("#error").hidden = false;
  console.error(error);
}
