export const itemKey = item => `${item.category}:${item.name}`;
export const paidOffer = offer => offer.payment === 'real_money' || offer.base_cost > 0;

export function buildCatalog(data, store, dlc, personal, eventData = {}) {
  const knownItems = new Set(data.map(itemKey));
  const notes = personal.notes || personal;
  const origins = new Map((personal.origins || []).map(item => [itemKey(item), item]));
  const entryOverrides = new Map((personal.entry_overrides || []).map(
    ({name, category, menu_position, ...changes}) => [`${category}:${name}:${menu_position}`, changes]
  ));
  const bundles = new Map(store.bundles.map(bundle => [bundle.id, bundle]));
  const offers = new Map();
  const displayNames = new Map();
  const eventHistory = new Map();
  const eventBundleNames = new Set((eventData.bundles || []).map(bundle => bundle.name.toLowerCase()));
  const eventIds = new Set();
  for (const event of eventData.events || []) {
    if (!event.id || eventIds.has(event.id)) throw new Error('Invalid or duplicate event ID: ' + event.id);
    eventIds.add(event.id);
    for (const reward of event.rewards) {
      for (const member of reward.items) {
        const key = itemKey(member);
        if (!knownItems.has(key)) throw new Error('Unknown event reward: ' + key);
        if (!eventHistory.has(key)) eventHistory.set(key, []);
        eventHistory.get(key).push({event: event.name, requirement: reward.requirement,
          bundle: reward.bundle, returning: Boolean(reward.returning), dates: event.dates,
          notes: event.notes, source_url: event.source_url});
      }
    }
  }

  function contents(included = [], bonuses = []) {
    const members = new Map();
    for (const [role, references] of [['included', included], ['bonus', bonuses]]) {
      for (const reference of references) {
        const key = itemKey(reference);
        if (!knownItems.has(key)) throw new Error('Unknown cosmetic in an offer: ' + key);
        if (members.has(key) && members.get(key).role !== role) throw new Error('Item is both included and a bonus: ' + key);
        members.set(key, {...reference, role});
        if (reference.display_name) displayNames.set(key, reference.display_name);
      }
    }
    return [...members.values()];
  }

  function addOffer(offer) {
    if (offer.visible === false) return;
    if (offer.channel === 'store') {
      if (!paidOffer(offer)) offer.availability = 'limited_time';
      else if (offer.kind === 'item') offer.availability ||= 'always';
    }
    for (const member of offer.items) {
      const key = itemKey(member);
      if (!offers.has(key)) offers.set(key, []);
      offers.get(key).push({...offer, role: member.role});
    }
  }

  const cashItems = new Set(store.bundles.filter(bundle => bundle.payment === 'real_money').flatMap(bundle => bundle.included_items.map(itemKey)));
  for (const price of store.items) {
    if (!knownItems.has(itemKey(price))) throw new Error('Unknown store item: ' + itemKey(price));
    if (price.cost_basis === 'bundle_total' || !Number.isFinite(price.base_cost)) continue;
    if (price.base_cost === 0 && cashItems.has(itemKey(price))) continue;
    addOffer({...price, id: itemKey(price), name: 'EXO Outfitters — individual item', channel: 'store', kind: 'item', payment: 'qbits', items: contents([price])});
  }
  for (const bundle of store.bundles) {
    if (!bundle.id || /\(1\)$/.test(bundle.id)) throw new Error('Invalid store bundle ID: ' + bundle.id);
    addOffer({...bundle, channel: 'store', kind: 'bundle', items: contents(bundle.included_items)});
  }
  for (const offer of store.offers || []) {
    addOffer({...offer, channel: 'store', kind: 'promotion', items: contents(offer.included_items)});
  }
  const dlcIds = new Set();
  for (const pack of dlc) {
    if (!pack.id || dlcIds.has(pack.id)) throw new Error('Invalid or duplicate DLC ID: ' + pack.id);
    dlcIds.add(pack.id);
    const included = [...(pack.included_items || [])];
    for (const id of pack.included_bundles || []) {
      const bundle = bundles.get(id);
      if (!bundle) throw new Error('Unknown bundle in DLC: ' + id);
      included.push(...bundle.included_items);
    }
    addOffer({...pack, channel: 'dlc', kind: 'dlc', items: contents(included, pack.bonus_items)});
  }

  return data.map((entry, sourceOrder) => {
    const key = itemKey(entry);
    const item = {...entry, ...origins.get(key), ...entryOverrides.get(`${key}:${entry.menu_position}`)};
    item.obtainment_details = notes[item.name] ?? item.obtainment_details;
    if (item.obtainment_method === 'Code redemption' && !item.obtainment_details?.trim()) {
      item.obtainment_details = 'Code details and availability unknown.';
    }
    item.display_name = displayNames.get(key) || item.name;
    item.offers = offers.get(key) || [];
    if (item.hide_store_offers) item.offers = item.offers.filter(offer => offer.channel !== 'store');
    item.event_history = eventHistory.get(key) || [];
    item.sources = personal.sources?.[key] || [];
    item.bundle_association = (item.bundle_association || '').split(/,\s*/)
      .filter(name => name && !eventBundleNames.has(name.toLowerCase())).join(', ');
    const storeOffers = item.offers.filter(offer => offer.channel === 'store');
    const regularStore = storeOffers.some(offer => offer.availability !== 'limited_time');
    const limitedStore = storeOffers.some(offer => offer.availability === 'limited_time');
    if (item.obtainment_method === 'Store' && limitedStore && !regularStore) item.obtainment_method = 'Limited Offer';
    item.methods = [...new Set([
      item.obtainment_method,
      ...(item.additional_methods || []),
      ...(item.required_dlc ? ['DLC'] : []),
      ...(item.event_history.length ? ['Event'] : []),
      ...(regularStore ? ['Store'] : []),
      ...(limitedStore ? ['Limited Offer'] : []),
      ...(item.offers.some(offer => offer.channel === 'dlc') ? ['DLC'] : [])
    ])];
    item.purchasable = storeOffers.some(paidOffer);
    item.sourceOrder = sourceOrder;
    const eventTerms = item.event_history.flatMap(appearance => [
      appearance.event, appearance.event.replace(/\./g, ''), appearance.requirement, appearance.bundle, appearance.notes
    ]);
    const offerTerms = item.offers.flatMap(offer => [
      offer.name,
      offer.channel === 'store' ? 'EXO Outfitters' : 'DLC',
      offer.payment === 'real_money' ? 'real money' : offer.base_cost > 0 ? 'QBITS' : 'free',
      offer.role === 'bonus' ? 'free bonus' : '',
      offer.availability === 'limited_time' ? 'limited-time' : offer.availability === 'always' ? 'always available' : '',
      offer.included_qbits ? `${offer.included_qbits} QBITS` : ''
    ]);
    item.searchText = [
      item.name, item.display_name, item.category, ...item.methods, item.required_dlc,
      item.obtained_through, item.obtainment_details, item.bundle_association, ...eventTerms, ...offerTerms
    ].join(' ').toLocaleLowerCase();
    return item;
  }).filter(item => item.visible !== false);
}
