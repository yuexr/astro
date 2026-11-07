import { createPagination, element, fetchJSON } from "../catalog.js";
import { buildCatalog, itemKey } from "./customization-data.js";

const form = document.querySelector(".list-filters");
const search = document.querySelector("#search");
const category = document.querySelector("#category");
const method = document.querySelector("#method");
const sort = document.querySelector("#sort");
const perPage = document.querySelector("#per-page");
const grid = document.querySelector("#items");
const pagination = createPagination(perPage, render);
const popup = document.querySelector(".customization-popup");
const labels = { suit: "Suit", palette: "Palette", visor: "Visor", hat: "Hat", mask: "Mask", emote: "Emote" };
const categories = Object.keys(labels);
const methodLabels = { "Available to all": "Default", Event: "In-game event", "In-game unlock": "In-game mission" };
const alphabetical = new Intl.Collator("en", { sensitivity: "base", numeric: true });
let items = [];
let itemsByKey = new Map();
let filtered = [];

function methodLabel(name) {
  return methodLabels[name] || name;
}

function methodTags(methods) {
  const tags = element("div", undefined, "customization-methods");
  for (const name of methods) {
    const tag = element("span", methodLabel(name), "customization-method");
    tag.dataset.method = name;
    tags.append(tag);
  }
  return tags;
}

function artwork(item) {
  const artwork = element("div", undefined, "customization-art");
  const image = document.createElement("img");
  image.src = item.image;
  image.alt = item.display_name;
  image.width = 128;
  image.height = 128;
  image.loading = "lazy";
  image.decoding = "async";
  artwork.append(image);
  if (item.name.trim().toLowerCase() === "none") {
    artwork.classList.add("is-none");
    artwork.style.setProperty("--icon", `url("${item.image}")`);
  }
  return artwork;
}

function bundleItems(item, offer) {
  if (!offer.items.length) return null;
  const list = element("div", undefined, "customization-bundle-items");
  for (const member of offer.items) {
    const other = itemsByKey.get(itemKey(member));
    if (!other) continue;
    const button = element("button", undefined, "customization-bundle-item");
    button.type = "button";
    button.setAttribute("aria-label", `View details for ${other.display_name} (${labels[other.category]})`);
    if (itemKey(other) === itemKey(item)) button.setAttribute("aria-current", "true");
    const text = element("span");
    text.append(element("strong", other.display_name), element("small", labels[other.category] + (member.role === "bonus" ? " · Free bonus" : "")));
    button.append(artwork(other), text);
    button.addEventListener("click", () => showItem(other));
    list.append(button);
  }
  return list;
}

function showItem(item) {
  document.querySelector("#customization-image").replaceChildren(artwork(item));
  document.querySelector("#customization-type").textContent = labels[item.category];
  document.querySelector("#customization-title").textContent = item.display_name;
  document.querySelector("#customization-description").textContent = item.obtained_through;
  const obtainmentDetails = document.querySelector("#customization-obtainment-details");
  obtainmentDetails.textContent = item.obtainment_details || "";
  obtainmentDetails.hidden = !item.obtainment_details;
  const facts = document.querySelector("#customization-facts");
  facts.replaceChildren();
  function fact(label, value) {
    if (value === undefined || value === null || value === "") return;
    const row = element("div");
    const definition = element("dd");
    definition.append(value);
    row.append(element("dt", label), definition);
    facts.append(row);
  }
  fact("Original source", methodTags([item.obtainment_method]));
  const additionalMethods = item.methods.filter(name => name !== item.obtainment_method);
  if (additionalMethods.length) fact("Also obtainable", methodTags(additionalMethods));

  const bundles = document.querySelector("#customization-bundles");
  bundles.replaceChildren();
  const offers = item.offers;
  const extraNames = (item.bundle_association || "").split(/,\s*/).filter((name) => name && !offers.some((offer) => offer.name.toLowerCase() === name.toLowerCase()));
  bundles.hidden = !offers.length && !extraNames.length;
  if (!bundles.hidden) {
    if (offers.length) bundles.append(element("h3", "Purchase options"));
    for (const offer of offers) {
      const row = element("div", undefined, "customization-bundle");
      row.append(element("h4", offer.name));
      const payment = offer.payment === "real_money" ? "Real money" : offer.base_cost > 0 ? `${offer.base_cost.toLocaleString()} QBITS` : "Free";
      row.append(element("p", offer.kind === "item" ? payment : `${offer.channel === "dlc" ? "DLC" : "EXO Outfitters"} · ${payment}`));
      if (offer.availability) row.append(element("small", offer.availability === "always" ? "Always available" : "Limited-time offer"));
      if (offer.channel === "dlc") row.append(element("small", offer.role === "bonus" ? "Free bonus with this DLC" : "Included in this DLC"));
      if (offer.included_qbits) row.append(element("p", `Also includes ${offer.included_qbits.toLocaleString()} QBITS`));
      if (offer.kind !== "item") {
        const members = bundleItems(item, offer);
        if (members && offer.channel === "dlc") {
          const contents = element("details", undefined, "customization-offer-contents");
          contents.append(element("summary", `Included cosmetics (${offer.items.length})`), members);
          row.append(contents);
        } else if (members) row.append(element("p", "Items in this bundle"), members);
      }
      if (offer.url) {
        const link = element("a", offer.channel === "dlc" ? "View DLC on Steam" : "View bundle details");
        link.href = offer.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        row.append(link);
      }
      bundles.append(row);
    }
    if (extraNames.length) bundles.append(element("p", `Associated with: ${extraNames.join(", ")}`));
  }

  if (popup.open) popup.querySelector(".customization-close").focus();
  else popup.showModal();
  popup.scrollTop = 0;
}

popup.querySelector(".customization-close").addEventListener("click", () => popup.close());
popup.addEventListener("click", (event) => {
  if (event.target !== popup) return;
  const bounds = popup.getBoundingClientRect();
  if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) popup.close();
});

function card(item) {
  const node = element("article", undefined, "customization-card");
  node.append(artwork(item), element("span", labels[item.category], "customization-category"), element("h3", item.display_name), methodTags(item.methods));
  if (item.purchasable) {
    const badge = element("span", undefined, "customization-store");
    badge.setAttribute("role", "img");
    badge.setAttribute("aria-label", "Purchasable from EXO Outfitters Store");
    node.append(badge);
  }
  const button = element("button", undefined, "customization-open");
  button.type = "button";
  button.setAttribute("aria-label", `View details for ${item.display_name} (${labels[item.category]})`);
  button.setAttribute("aria-haspopup", "dialog");
  button.addEventListener("click", () => showItem(item));
  node.append(button);
  return node;
}

function render() {
  grid.replaceChildren(...pagination.render(filtered).map(card));
}

function compare(a, b) {
  if (sort.value === "az") return alphabetical.compare(a.display_name, b.display_name);
  if (sort.value === "za") return alphabetical.compare(b.display_name, a.display_name);
  return categories.indexOf(a.category) - categories.indexOf(b.category) || (a.menu_position ?? Infinity) - (b.menu_position ?? Infinity) || a.sourceOrder - b.sourceOrder;
}

function filter() {
  const query = search.value.trim().toLocaleLowerCase();
  filtered = items.filter((item) => (!category.value || item.category === category.value) && (!method.value || item.methods.includes(method.value)) && (!query || item.searchText.includes(query))).sort(compare);
  pagination.reset();
  render();
}

form.addEventListener("submit", (event) => event.preventDefault());
form.addEventListener("input", filter);
form.addEventListener("reset", (event) => {
  event.preventDefault();
  search.value = "";
  category.value = "";
  method.value = "";
  sort.value = "menu";
  perPage.value = "48";
  filter();
});

try {
  const [data, store, dlc, notes] = await Promise.all([
    fetchJSON("customization.json"),
    fetchJSON("store.json"),
    fetchJSON("dlc.json"),
    fetchJSON("obtainment-notes.json").catch((error) => {
      console.warn("Personal obtainment notes unavailable", error);
      return {};
    }),
  ]);
  items = buildCatalog(data, store, dlc, notes).map(item => ({...item, searchText: `${item.searchText} ${item.methods.map(methodLabel).join(" ").toLocaleLowerCase()}`}));
  itemsByKey = new Map(items.map(item => [itemKey(item), item]));
  const methods = [...new Set(items.flatMap((item) => item.methods))].sort((a, b) => Number(b === "Available to all") - Number(a === "Available to all") || alphabetical.compare(methodLabel(a), methodLabel(b)));
  for (const name of methods) {
    const option = element("option", methodLabel(name));
    option.value = name;
    method.append(option);
  }
  form.querySelectorAll("[disabled]").forEach((control) => {
    control.disabled = false;
  });
  filter();
} catch (error) {
  document.querySelector("#count").textContent = "Customization list unavailable";
  document.querySelector("#error").hidden = false;
  console.error(error);
}
