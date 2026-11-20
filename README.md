# astro

Astroneer mods and guides by yuexr. The site is plain HTML, CSS, and JavaScript, with no build step.

## Pages

- /astro/ — home page
- /astro/mods/ — mod catalog
- /astro/mods/mod.html?id=backpack-pro-max — shared mod detail page
- /astro/mods/installation.html — installation guide
- /astro/summon/ — searchable summon code list
- /astro/customization/ — customization list and item details
- /astro/styles.html — typography reference

See EDITING.md for adding mods, external metadata sources, and Markdown content.

## Data

- mods/mods.json controls mod cards, descriptions, images, sections, repositories, and metadata URLs.
- mods/author-notes/ contains editable author diaries. Empty files hide the diary section. README content and images come from each mod's GitHub repository.
- mods/index.json is the separate AML-Classic update index with version-specific PAK URLs.
- summon/summon.json contains the summon list, flags, and risk information.
- customization/customization.json contains customization items and original unlock information. EXO Outfitters offers live in customization/store.json; DLC packs live in customization/dlc.json. Event history is in customization/events.json. Personal notes and protected corrections are in customization/obtainment-notes.json.

New mod packages using the updater should set download.type to index_file and download.url to https://yuexr.github.io/astro/mods/index.json. The package mod_id, index key, and PAK filename ID must match. Enable only one Backpack Pro Max variant at a time.

## Publishing

GitHub Pages serves this repository at https://yuexr.github.io/astro/. The .nojekyll file allows the files to be served directly. Commit and push when ready to publish through the existing Pages setup.
