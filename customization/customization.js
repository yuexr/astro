import { createPagination, element, fetchJSON } from "../catalog.js";
import { buildCatalog, itemKey, paidOffer } from "./customization-data.js";

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
const methodLabels = { "Available to all": "Default", Event: "In-game event", "In-game unlock": "In-game mission", "Limited Offer": "Limited offer" };
const alphabetical = new Intl.Collator("en", { sensitivity: "base", numeric: true });
let items = [];
const itemsByKey = new Map();
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
  const frame = element("div", undefined, "customization-art");
  const image = document.createElement("img");
  image.src = item.image;
  image.alt = item.display_name;
  image.width = 128;
  image.height = 128;
  image.loading = "lazy";
  image.decoding = "async";
  frame.append(image);
  if (item.name.trim().toLowerCase() === "none") {
    frame.classList.add("is-none");
    frame.style.setProperty("--icon", `url("${item.image}")`);
  }
  return frame;
}

function bundleItems(item, offer) {
  if (!offer.items.length && !offer.included_qbits) return null;
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
  if (offer.included_qbits) {
    const currency = element("div", undefined, "customization-bundle-item");
    const icon = element("span", undefined, "customization-qbits");
    icon.setAttribute("aria-hidden", "true");
    const text = element("span");
    text.append(element("strong", `${offer.included_qbits.toLocaleString()} QBITS`), element("small", "Currency"));
    currency.append(icon, text);
    list.append(currency);
  }
  return list;
}

function externalLink(label, url) {
  const link = element("a", label);
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  return link;
}

function renderFacts(item) {
  const facts = document.querySelector("#customization-facts");
  facts.replaceChildren();
  function fact(label, value) {
    if (value === undefined || value === null || value === "") return;
    const row = element("div");
    const definition = element("dd");
    definition.append(value);
    row.append(element("dt", label), definition);
    facts.append(row);
    return definition;
  }
  const originalMethods = [...new Set([item.obtainment_method, ...(item.required_dlc ? ["DLC"] : [])])];
  const source = fact("Original source", methodTags(originalMethods));
  const descriptionText = item.obtained_through?.trim();
  const detailsText = item.obtainment_details?.trim();
  const genericStoreDescription = ["Store", "Limited Offer"].includes(item.obtainment_method)
    && descriptionText === "Purchased from EXO Outfitters Store."
    && !detailsText;
  if (descriptionText && !genericStoreDescription) {
    const description = element("p", item.obtained_through);
    description.id = "customization-description";
    source.append(description);
    popup.setAttribute("aria-describedby", description.id);
  } else popup.removeAttribute("aria-describedby");
  const sourceDetails = document.createDocumentFragment();
  if (detailsText) sourceDetails.append(detailsText);
  const references = item.sources.filter(reference => !item.event_history.some(appearance => appearance.source_url === reference.url));
  if (references.length) {
    const links = element("span", undefined, "customization-source-links");
    for (const reference of references) {
      if (links.childNodes.length) links.append(" · ");
      links.append(externalLink(reference.label, reference.url));
    }
    sourceDetails.append(links);
  }
  if (sourceDetails.childNodes.length) fact("Source details", sourceDetails);
  const additionalMethods = item.methods.filter(name => !originalMethods.includes(name));
  if (additionalMethods.length) fact("Other tags", methodTags(additionalMethods));
}

function renderHistory(item) {
  const history = document.querySelector("#customization-history");
  history.replaceChildren();
  history.hidden = !item.event_history.length;
  if (history.hidden) return;

  const details = document.createElement("details");
  const summary = element("summary");
  summary.append(element("h3", `Event history (${item.event_history.length})`));
  details.append(summary);
  for (const appearance of item.event_history) {
    const row = element("p");
    const title = appearance.source_url ? externalLink(appearance.event, appearance.source_url) : element("span", appearance.event);
    row.append(title, element("small", appearance.requirement + (appearance.bundle ? ` · ${appearance.bundle}` : "")));
    if (appearance.dates?.start || appearance.dates?.end) {
      row.append(element("small", [appearance.dates.start, appearance.dates.end].filter(Boolean).join(" – ") + (appearance.dates.start ? "" : " (end date)")));
    }
    if (appearance.notes) row.append(element("small", appearance.notes));
    details.append(row);
  }
  history.append(details);
}

function offerPrice(offer, offers) {
  const payment = offer.payment === "real_money" ? "Real money" : offer.base_cost > 0 ? `${offer.base_cost.toLocaleString()} QBITS` : "Free";
  const regularPrice = offer.base_cost > 0 && offers.some(other => other.channel === "store" && other.base_cost === 0);
  const price = element("p");
  if (offer.kind !== "item" || (offer.channel === "store" && !paidOffer(offer))) price.append(`${offer.channel === "dlc" ? "DLC" : "EXO Outfitters"} · `);
  else if (regularPrice) price.append("Regular price: ");
  if (offer.payment !== "real_money" && offer.base_cost > 0) {
    const icon = element("span", undefined, "customization-price-qbits");
    icon.setAttribute("aria-hidden", "true");
    price.append(icon);
  }
  price.append(payment);
  return price;
}

function offerAvailability(offer, index) {
  const availability = element("small", offer.availability === "always" ? "Always available" : "Limited-time offer");
  if (offer.availability === "limited_time") {
    const tooltip = element("span", "Offer was previously available in-store for a limited time. Offer availability in future not guaranteed.", "customization-tooltip");
    tooltip.id = `offer-availability-${index}`;
    tooltip.setAttribute("role", "tooltip");
    availability.className = "customization-availability";
    availability.tabIndex = 0;
    availability.setAttribute("aria-describedby", tooltip.id);
    availability.append(tooltip);
  }
  return availability;
}

function offerRow(item, offer) {
  const row = element("div", undefined, "customization-bundle");
  const freeStoreOffer = offer.channel === "store" && !paidOffer(offer);
  row.append(element("h4", freeStoreOffer && offer.kind === "item" ? "INDIVIDUAL ITEM" : offer.name));
  row.append(offerPrice(offer, item.offers));
  if (offer.availability) row.append(offerAvailability(offer, item.offers.indexOf(offer)));
  if (offer.channel === "dlc" && offer.role === "bonus") row.append(element("small", "Free bonus with this DLC"));
  if (offer.available_from && offer.available_until) {
    row.append(element("small", `Documented offer: ${offer.available_from.slice(0, 10)} – ${offer.available_until.slice(0, 10)}`));
  }
  if (offer.availability_note) row.append(element("small", offer.availability_note));
  for (const entry of offer.history || []) {
    const previous = element("small");
    previous.append(externalLink(entry.description, entry.source_url));
    row.append(previous);
  }
  if (offer.kind !== "item") {
    const members = bundleItems(item, offer);
    if (members) {
      const contents = element("details", undefined, "customization-offer-contents");
      contents.open = offer.channel === "store" || item.methods.every(method => method === "DLC");
      contents.append(element("summary", `Bundle includes (${members.children.length})`), members);
      row.append(contents);
    }
  }
  if (offer.url) {
    row.append(externalLink(offer.channel === "dlc" ? "View DLC on Steam" : "View bundle details", offer.url));
  }
  if (offer.source_url) {
    row.append(externalLink("Official source", offer.source_url));
  }
  return row;
}

function renderOffers(item) {
  const bundles = document.querySelector("#customization-bundles");
  bundles.replaceChildren();
  const offers = item.offers;
  bundles.hidden = !offers.length;
  if (bundles.hidden) return;

  const purchases = [];
  const limitedOffers = [];
  for (const offer of offers) {
    const limitedStoreOffer = offer.channel === "store" && offer.availability === "limited_time";
    (limitedStoreOffer ? limitedOffers : purchases).push(offer);
  }
  for (const [title, group] of [["Purchase options", purchases], ["Limited offer", limitedOffers]]) {
    if (!group.length) continue;
    const section = element("section");
    section.append(element("h3", title));
    for (const offer of group) {
      section.append(offerRow(item, offer));
    }
    bundles.append(section);
  }
}

function showItem(item) {
  document.querySelector("#customization-image").replaceChildren(artwork(item));
  document.querySelector("#customization-type").textContent = labels[item.category];
  document.querySelector("#customization-title").textContent = item.display_name;
  renderFacts(item);
  renderHistory(item);
  renderOffers(item);

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
  const [data, store, dlc, notes, events] = await Promise.all([
    fetchJSON("customization.json"),
    fetchJSON("store.json"),
    fetchJSON("dlc.json"),
    fetchJSON("obtainment-notes.json").catch((error) => {
      console.warn("Could not load obtainment notes", error);
      return {};
    }),
    fetchJSON("events.json"),
  ]);
  items = buildCatalog(data, store, dlc, notes, events).map(item => ({...item, searchText: `${item.searchText} ${item.methods.map(methodLabel).join(" ").toLocaleLowerCase()}`}));
  for (const item of items) {
    if (!itemsByKey.has(itemKey(item))) itemsByKey.set(itemKey(item), item);
  }
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
