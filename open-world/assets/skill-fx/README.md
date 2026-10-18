# Reused skill effect sources

This batch reuses 126 existing PNGs from the local SP33 asset collection. No new effect art was generated or repainted. `source/` contains exact original PNG bytes; `source.json` records their hashes, original paths, Spine 3.6.32 slot/bone geometry, original blend modes, and attachment timelines.

Run `node tools/build-skill-fx.mjs` from `open-world`. The builder reads only project-local source files, verifies their hashes, and emits `packages/asset-manifest/skill-fx.json` and the Phaser atlas `apps/web/public/art/effects/skill-source.png` / `.json`. The original external drives and a Spine editor are not build dependencies.

Clips: `slash`, `impact`, `arrow`, `flaming-arrow`, `arcane-projectile`, `ice-crystal`, `lightning`, `nature-aura-05`, `shield`, `orange-fire`, `ice-air`. `arrow` contains only `jian2.png`; it is a static attachment rather than a two-frame animation. `orange-fire` is the confirmed orange/yellow ground flame sequence from Xiaolong's original `TX/attack2/dimian` group. The purple arcane projectile is not labeled fireball.

Every clip has a stable logical `canvas` and `origin`; atlas `sourceSize` / `spriteSourceSize` preserve this origin after trimming. Frame canvases are registered using the original attachment-center offsets converted into PNG pixels. Original actor rotations, scale, and skeleton hierarchy are retained as provenance, not baked into the raw texture orientation. Directional projectile artwork points right. Nondirectional auras use the same right-facing convention for runtime mirroring.

Ground flames, ice, and the nature aura use the bottom center of the alpha union across their entire sequence as a new logical ground/feet anchor. Other origins retain the source attachment-local bone registration point. Origins describe the effect attachment's placement, not a legacy actor camera.

Use `timeline` for nonuniform frame timing; `fps` is a fallback. Null frames mean hidden. Orange ground fire has its old actor windup and idle tail removed from the runtime timeline, rebased to the first visible frame; the full original Attack2 timeline remains in `source.originalAttachmentTimelines`. The 25 nature leaf PNGs were hidden by the examined original Animation timeline, so this batch explicitly reuses them as an independent 30fps aura. It does not claim that the original skill's gameplay effect was healing.

The shield source supplies one additive front arc. This batch has no invented original rear-half shield clip. Runtime layering must respect this limitation and the source normal/add blending flags.

`review/verification.json` records the atlas reconstruction check: all 126 frames, 3,740,922 logical canvas pixels, all alpha values and visible RGB values match the registered source PNG exactly. Invisible RGB outside the alpha trim may be discarded. `review/contact-sheet.png` shows representative final frames. This resource check does not claim that the live game runtime has been verified.

Ice-air adds five existing blue-white qiliu airflow PNGs for a cold-air projectile trail or release. The original freezing Animation holds only qiliu_00006; this independent 30fps clip preserves that static original timeline as provenance and does not claim original projectile semantics. Pixel verification reports per-source PNG SHA256 and per-frame registered/restored RGBA SHA256 hashes.
