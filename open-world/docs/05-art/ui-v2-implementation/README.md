# V2 UI implementation

Direction: modern vibrant cartoon fantasy — saturated color, clean blue panels, cream typography, apricot actions, expressive dimensional equipment. WoW-inspired color and silhouette, without muddy bronze/leather chrome. V2 reference images remain in the parent docs/05-art/ui-standard-v2-20260929 folder. No V1 restoration.

## Single owners
- Layout and controls: apps/web/src/style.css + v2-layout.css; shared ui-components.ts and ui-assets.ts are used by the game and component page.
- Source images: assets/ui-source/v2/ui-source.json. Run `python3 tools/build_ui_v2.py` to validate and publish. Never run the retired placeholder generator.
- Equipment: six original transparent images in equipment/, with source and hash provenance.
- Hero: assets/actors/wushi contains selected original SP33 files, source hashes, derived frames and export metadata. Combat sprite, HUD portrait and inventory figure use the same character. Appearance does not change attributes or equipped effects.
- Export: `node tools/export_sp33_actor.mjs`, then `python3 tools/pack_sp33_actor.py`, then `python3 tools/build_ui_v2.py`. The internal Spine 3.6 exporter is not part of the client bundle. Runtime game uses a normal Phaser atlas.

## Layout behavior
- Inventory: 27:46:27 role, six-column equipment grid and detail/action columns at all four target sizes. Detail content scrolls independently; action buttons remain outside its scroll area.
- Build: four top slots, scrollable four-column library with two visible rows, separate selected-skill details, visible save bar. Checkbox changes update the draft immediately, and service acknowledgement remains the formal save boundary.
- HUD: compact portrait/bars, left objective tracker, circular minimap, large skill artwork and compact mode/system controls.
- Shared panels: login, travel, goals, auto settings, settings and confirmation use the same frame, typography and button colors.
- Modal focus: confirmation takes keyboard priority; Esc closes the top layer; returning to the world restores stable system-entry focus.
- Asset publication: required IDs and image decode/size checked before commit; failed manifest commit restores previous images; post-commit backup cleanup cannot roll back a successful manifest.

## Verification
`node node_modules/typescript/bin/tsc --noEmit`
`python3 tools/build_ui_v2.py --self-test`
`python3 tools/verify_v2_integration.py`
`node node_modules/vitest/vitest.mjs run tests/preview-guard.test.ts tests/objective.test.ts tests/simulation.test.ts`
`node tools/accept_v2_ui.mjs ../docs/reviews/open-world/ui-v2-final-20260930`

The last command uses an isolated PostgreSQL database and static production build, records actual browser operations, and cleans its working directory. It does not add accounts to the persistent game service.

## 2026-09-30 reference correction
Inventory now uses larger artwork, slot filters, real currency summary and green equipped marks. Skill library uses four art-led columns and two visible rows. Runtime scenery uses generated modular props and ground textures from `packages/asset-manifest/environment.v2.json`, with navigation-derived roads and foreground fade. These are implemented improvements, not a claim that the entire scene now matches the V2 reference. See parent `docs/reviews/open-world/ui-reference-correction-20260930/整改说明.md` for remaining art gaps.

## 2026-09-30 destination browser

The travel panel now uses real meadow, forest and rift illustrations, native SVG compass/ribbon/corner details, independent region navigation, activity tabs, availability filters, global name/boss search, fixed detail/action areas and six-result pagination. One real result expands to an illustrated feature card; it does not leave a mostly empty grid. The current catalog is three outdoor regions and their three existing boss encounters. Counts and availability come from content and the server snapshot.

Source artwork and the complete built-in imagegen prompts are in `assets/ui-source/travel/source.json`. `node tools/build-travel-assets.mjs` checks source IDs, PNG size and hashes, publishes `/art/travel/`, and generates `packages/asset-manifest/travel.json`. It is included in `pnpm build`. A new illustration can be registered in the source manifest; a missing region/theme image is reported instead of silently substituting another region.

Implementation: `apps/web/src/travel-browser.ts` and `travel-browser.css`; panel state lives in GameApp separately from the server snapshot. Selecting a locked region shows its actual unlock condition without travelling. Dungeon entry still requires the existing six-kill rule and walking to the gate with E confirmation; this browser does not add remote boss entry. Search retains its caret, tabs support arrow keys, focus stays inside the modal, and departure shows a disabled loading state while the real permit request is pending.

Drop preview uses authenticated, read-only `GET /api/travel/:region/drops`. The API summarizes the existing authorized reward snapshot when one is active, otherwise current reward rules. It returns per-kill currency/XP/material ranges and display-only equipment templates. No RNG, rolled candidates, item instances or drop probability configuration is shipped. The panel shows six current equipment icons with tooltip details, loading/error/retry states and guards against stale responses after changing the selection. The details section scrolls independently so drop icons and the departure button remain available in small windows.

Validation: `node tools/accept-travel-browser.mjs` registers a player in an isolated real PostgreSQL, creates a character, walks to the camp portal, opens travel, tests selection/filter/search/keyboard interactions, and departs to the actual meadow. Screenshots cover 1280×720, 1024×576, 1600×900 and 1920×1080. The separately labelled 18-region layout fixture exercises six-card pagination and scrolling; those fixture regions are not added to playable content or the persistent database. Evidence is in parent `docs/reviews/open-world/travel-polish-20260930/`. Windows resource publication/build should run with the local service stopped, then start it again.
