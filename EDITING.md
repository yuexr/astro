# Editing the Astroneer site

No build step is needed. GitHub Pages serves the files directly.

## Mods

Edit mods/mods.json to add, reorder, or update mods. Array order controls card order.

- id: unique lowercase slug. Keep it stable so links continue working.
- name, description, author, version, gameBuild: saved metadata.
- section: released or personal. Empty sections are hidden.
- image: path relative to the site root; null uses a star placeholder.
- nexusUrl: the individual Nexus Mods page, or null when there is none.
- visible: false hides a mod from both the catalog and detail page.

All detail pages use mods/mod.html?id=MOD-ID. Diary content comes from mods/author-notes/MOD-ID.md. Missing or empty sections stay hidden. README content and media come from the public GitHub repository.

## External metadata

Each mod can have a sources array. A source has url and format.

- mod-metadata reads name, author, version, game_build, nexus_url, and the boolean enable_ue4ss. The latter displays Yes or No. Status comes from the catalog section. Card and page descriptions always come from mods/mods.json.
- github-release reads the version and publication date from GitHub's latest release API.
- An optional key such as mods.BackpackProMax selects a nested object.

Later sources override only fields they provide. Sources must be public JSON URLs that allow browser requests. Successful requests are cached for five minutes per tab. If a source fails, the saved metadata remains available.

Backpack Pro Max and Baby Proof Explosions are connected to their public metadata and latest releases. The other entries can have sources added later. Nexus page links are stored in nexusUrl; no Nexus API key is needed.

## Customization

- customization/customization.json: item names, images, menu order, and original unlock information. Store data is no longer embedded in each item.
- customization/store.json: EXO Outfitters prices and bundles. Each bundle and its included_items are recorded once. The payment field distinguishes qbits from real_money.
- customization/dlc.json: the manually maintained DLC packs. included_items and bonus_items reference cosmetics by their exact saved name and category. included_bundles references bundle IDs in store.json. included_qbits is a currency grant, not a purchase price. url links to the pack on Steam.
- customization/events.json: historical events, reward requirements, and source links. Dates are included where documented; unmatched rewards stay separate until their identity is confirmed.
- customization/obtainment-notes.json: manual corrections preserved across imports. notes holds text by item name, applying to both palette and visor versions. origins holds category-specific unlock records. sources holds reference links, and renames preserves corrected names. store_overrides protects offer corrections. entry_overrides targets a name, category, and menu_position when duplicate names need different treatment.

obtainment_method is the original unlock source. obtained_through describes that original unlock, and obtainment_details adds optional context. bundle_association preserves other bundle associations separately. A later store or DLC offer adds a route; it does not replace an event or mission origin. The popup labels the history as Original source and lists purchase options separately.

The page labels Available to all as Default, Event as In-game event, and In-game unlock as In-game mission. additional_methods adds tags such as Unknown without replacing the original source. Event history and later offers can add other tags. The blue ribbon marks paid EXO Outfitters offers; DLC-only offers do not add it.

Store availability is always or limited_time. Limited store offers appear under Limited offer; other store listings and DLC appear under Purchase options. Free store offers are classified as limited-time. An item with only limited offers gets the Limited offer tag instead of Store. Explicit real_money offers display as Real money when no cash amount is recorded. Bonus cosmetics remain part of their paid DLC.

Match item references by exact saved name and category. For a duplicate-specific correction, use entry_overrides. visible: false hides a duplicate item or offer, while hide_store_offers prevents an item from inheriting a different same-named item's store listing.

The local importer is .astro-source/build-customization.cjs in the development workspace, outside this repository. It refreshes item and QBITS data, reapplies manual corrections, and preserves real-money bundles, grouped offers, DLC definitions, and event history. Keep source corrections in obtainment-notes.json, DLC edits in dlc.json, and event edits in events.json. For manual changes to imported offers, use store_overrides so the next import keeps them.

Card, filter, and popup behavior is in customization/customization.js; the data joins are in customization/customization-data.js. Page structure is in customization/index.html, and styling is in customization/customization.css.

## Pages and design

- navbar.html: shared sidebar and mobile navigation.
- footer.html: shared footer and fan-project disclaimer.

- site.css: shared design and animations.
- catalog.js: shared list controls, pagination, and JSON loading for summon and customization.
- mods/mods.css: mod cards, metadata, diary, and gallery styling.
- site.js: catalog, metadata, detail pages, and navigation behavior.
- mods/installation.html: installation guide.
- summon/index.html: summon code list.
- summon/summon.js: summon filtering, item details, copying, and warning behavior.
- customization/index.html: customization list and item popups.
- customization/customization.js: customization filtering, cards, and popup behavior.
- research-item/index.html: blank research item notes.
- research-samples/index.html: blank research sample notes.
- styles.html: typography reference.

Add content inside each blank page's article.paper. Edit navbar.html once to change the sidebar and mobile navigation everywhere. Edit footer.html once to change the footer everywhere. Shared-file links and image paths are relative to the site root. Reload a page to see edits.

mods/index.json is the separate AML-Classic updater index. Keep its version-specific PAK links intact.

Serve the repository with a local HTTP server to preview JSON loading. Commit and push when ready to publish through GitHub Pages.
