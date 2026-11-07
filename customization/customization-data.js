export const itemKey = item => `${item.category}:${item.name}`;
export const paidOffer = offer => offer.payment === 'real_money' || offer.base_cost > 0;

export function buildCatalog(data, store, dlc, personal) {
  const byKey = new Map(data.map(item => [itemKey(item), item]));
  const notes = personal.notes || personal;
  const origins = new Map((personal.origins || []).map(item => [itemKey(item), item]));
  const bundles = new Map(store.bundles.map(bundle => [bundle.id, bundle]));
  const offers = new Map();
  const displayNames = new Map();

  function contents(included = [], bonuses = []) {
    const members = new Map();
    for (const [role, references] of [['included', included], ['bonus', bonuses]]) {
      for (const reference of references) {
        const key = itemKey(reference);
        if (!byKey.has(key)) throw new Error('Unknown cosmetic in an offer: ' + key);
        if (members.has(key) && members.get(key).role !== role) throw new Error('Item is both included and a bonus: ' + key);
        members.set(key, {...reference, role});
        if (reference.display_name) displayNames.set(key, reference.display_name);
      }
    }
    return [...members.values()];
  }

  function addOffer(offer) {
    for (const member of offer.items) {
      const key = itemKey(member);
      if (!offers.has(key)) offers.set(key, []);
      offers.get(key).push({...offer, role: member.role});
    }
  }

  const cashItems = new Set(store.bundles.filter(bundle => bundle.payment === 'real_money').flatMap(bundle => bundle.included_items.map(itemKey)));
  for (const price of store.items) {
    if (!byKey.has(itemKey(price))) throw new Error('Unknown store item: ' + itemKey(price));
    if (price.cost_basis === 'bundle_total' || !Number.isFinite(price.base_cost)) continue;
    if (price.base_cost === 0 && cashItems.has(itemKey(price))) continue;
    addOffer({id: itemKey(price), name: 'EXO Outfitters — individual item', channel: 'store', kind: 'item', payment: 'qbits', base_cost: price.base_cost, items: contents([price])});
  }
  for (const bundle of store.bundles) {
    if (!bundle.id || /\(1\)$/.test(bundle.id)) throw new Error('Invalid store bundle ID: ' + bundle.id);
    addOffer({...bundle, channel: 'store', kind: 'bundle', items: contents(bundle.included_items)});
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
    const item = {...entry, ...origins.get(key)};
    item.obtainment_details = notes[item.name] ?? item.obtainment_details;
    item.display_name = displayNames.get(key) || item.name;
    item.offers = offers.get(key) || [];
    item.methods = [...new Set([
      item.obtainment_method,
      ...(item.offers.some(offer => offer.channel === 'store') ? ['Store'] : []),
      ...(item.offers.some(offer => offer.channel === 'dlc') ? ['DLC'] : [])
    ])];
    item.purchasable = item.offers.some(offer => offer.channel === 'store' && paidOffer(offer));
    item.sourceOrder = sourceOrder;
    item.searchText = [item.name, item.display_name, item.category, ...item.methods, item.obtained_through, item.obtainment_details, item.bundle_association,
      ...item.offers.flatMap(offer => [offer.name, offer.channel === 'store' ? 'EXO Outfitters' : 'DLC', offer.payment === 'real_money' ? 'real money' : offer.base_cost > 0 ? 'QBITS' : 'free', offer.role === 'bonus' ? 'free bonus' : '', offer.availability === 'limited_time' ? 'limited-time' : offer.availability === 'always' ? 'always available' : '', offer.included_qbits ? `${offer.included_qbits} QBITS` : ''])
    ].join(' ').toLocaleLowerCase();
    return item;
  });
}
