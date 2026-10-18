# 录音素材来源与授权

成品音效（`apps/web/public/audio`）由 `tools/audio/recipes/recorded.py` 把下列录音切片、变调、分层、滤波、限幅后重新渲染得到；
原始素材与切片素材包只留在本地 `.qa/audio-sourcing/`，不提交。每个音效实际用到的来源写在 `sample-manifest.json` 的 `license` 字段。

## 授权

| 来源 | 授权 | 要点 |
|---|---|---|
| Kenney（kenney.nl） | CC0 1.0 | 公有领域，可商用，无需署名 |
| rubberduck（opengameart.org） | CC0 1.0 | 公有领域，可商用，无需署名 |
| Sonniss GDC Game Audio Bundle（2020/2023/2024/2026） | Sonniss GDC 免版税授权 | 可商用、可改编、无需署名；**禁止用于 AI/机器学习训练**；不得单独转售原始素材 |

## 获取

CC0 包（整包 zip，各放 `.qa/audio-sourcing/raw-cc0/`，解压到 `raw-cc0/x/<包名>/`）：

- `https://kenney.nl/assets/rpg-audio`、`impact-sounds`、`ui-audio`、`interface-sounds`
- `https://opengameart.org/sites/default/files/` 下：`80-CC0-RPG-SFX_0.zip`、`80-CC0-creature-SFX_0.zip`、`80-CC0-creature-sfx-2.zip`、`sfx_breaking_and_falling.zip`、`sfx_100_v2.zip`、`water-splash-slime-sfx.zip`

Sonniss（只按文件远程抽取，不下载整卷；Referer 需为 `https://sonniss.com/gameaudiogdc/`）：

- 2020：`https://downloads.sonniss.com/Sonniss.com%20-%20GDC%202020%20-%20Game%20Audio%20Bundle%20Part{i}of14.zip`
- 2023：`https://downloads.sonniss.com/Sonniss.com-GDC2023-GameAudioBundle{i}of14.zip`
- 2024：`https://downloads.sonniss.com/Sonniss.com-GDC2024-GameAudioBundle{i}of9.zip`
- 2026：`https://downloads.sonniss.com/Sonniss.com-GDC2026-GameAudioBundle{i}of5.zip`

选用清单在 `picks/`（395 个文件，约 1.5GB），流程见 `fetch.py` 文件头；切片索引 `python -X utf8 tools/audio/sourcing/index.py`。

## 实际用到的库
- Kenney (kenney.nl) · kenney_impact-sounds
- Kenney (kenney.nl) · kenney_interface-sounds
- Kenney (kenney.nl) · kenney_rpg-audio
- Kenney (kenney.nl) · kenney_ui-audio
- Sonniss GDC Game Audio Bundle · 344 Audio - Anime Fight Voices Vol. 1
- Sonniss GDC Game Audio Bundle · 344 Audio - Anime Fight Voices Vol. 2
- Sonniss GDC Game Audio Bundle · 344 Audio - Cinematic Fight Vol. 1
- Sonniss GDC Game Audio Bundle · 344 Audio - Elemental Palette Designed Vol. 1
- Sonniss GDC Game Audio Bundle · 344 Audio - Epic Impacts Vol. 1
- Sonniss GDC Game Audio Bundle · 344 Audio - Historical Weapons Vol. 2
- Sonniss GDC Game Audio Bundle · 344 Audio - Intense Trailer Elements
- Sonniss GDC Game Audio Bundle · 344 Audio - Organic User Interface
- Sonniss GDC Game Audio Bundle · Alexander Kopeikin - 100 kHz Designed Ice
- Sonniss GDC Game Audio Bundle · Alexander Kopeikin - Emotion and Magic
- Sonniss GDC Game Audio Bundle · Articulated Sounds - Magic Elements vol.2
- Sonniss GDC Game Audio Bundle · Audio Summoners - Future Melee Weapons
- Sonniss GDC Game Audio Bundle · Audiomeals - Dark Creature Sounds
- Sonniss GDC Game Audio Bundle · Bart Kamski - Clicks & Switches
- Sonniss GDC Game Audio Bundle · Bluezone - Cave Creature Sound Effects
- Sonniss GDC Game Audio Bundle · Bluezone - Cinematic Metal Impacts
- Sonniss GDC Game Audio Bundle · Bluezone - Crab - Creature
- Sonniss GDC Game Audio Bundle · Bluezone - Forest Creature Sound Effects
- Sonniss GDC Game Audio Bundle · Bluezone - Heaven - Ethereal Ambient Samples
- Sonniss GDC Game Audio Bundle · Bluezone - Mountain Dweller - Orc Sound Effects
- Sonniss GDC Game Audio Bundle · Bluezone - Snow Footsteps
- Sonniss GDC Game Audio Bundle · Bluezone - Switch And Button Sound Effects
- Sonniss GDC Game Audio Bundle · Bluezone - Wilderness - Flowing Water
- Sonniss GDC Game Audio Bundle · BluezoneCorp - Afterlife - Ethereal Ambient Samples
- Sonniss GDC Game Audio Bundle · BluezoneCorp - Designed Water
- Sonniss GDC Game Audio Bundle · BluezoneCorp - Detonation - Explosion
- Sonniss GDC Game Audio Bundle · BluezoneCorp - Forest Textures
- Sonniss GDC Game Audio Bundle · BluezoneCorp - Ice Cracking
- Sonniss GDC Game Audio Bundle · BluezoneCorp - Invader - Alien Creature
- Sonniss GDC Game Audio Bundle · BluezoneCorp - Modern Cinematic Impact
- Sonniss GDC Game Audio Bundle · BluezoneCorp - Steampunk Machines
- Sonniss GDC Game Audio Bundle · BluezoneCorp - Stone Impact
- Sonniss GDC Game Audio Bundle · CB Sound Design - Board Games – Gamedesigners Audio Toolkit 01
- Sonniss GDC Game Audio Bundle · CB Sound Design - Dreamcatcher - The Sound of Dreams & Magic
- Sonniss GDC Game Audio Bundle · CB Sound Design - Essential Sounds Vol.01 Coins
- Sonniss GDC Game Audio Bundle · CB Sound Design - Whoosh And Push
- Sonniss GDC Game Audio Bundle · CB_Sounddesign - Applicable Sounds - Organic UI and Building Games SFX
- Sonniss GDC Game Audio Bundle · Cinematic Sound Design - Colossal Impacts
- Sonniss GDC Game Audio Bundle · Cinematic Sound Design - Hybrid Game & UI Elements
- Sonniss GDC Game Audio Bundle · Cinematic Sound Design - Interface & Infographics
- Sonniss GDC Game Audio Bundle · Cinematic Sound Design - System & UI Feedback Elements
- Sonniss GDC Game Audio Bundle · Cinematic Sound Design - UI Interaction Elements
- Sonniss GDC Game Audio Bundle · Cinematic Sound Design - Ultra Transitions & Impacts
- Sonniss GDC Game Audio Bundle · Cinematic Sound Design - User Interface
- Sonniss GDC Game Audio Bundle · Conor Bradley - Metal Chains
- Sonniss GDC Game Audio Bundle · David Dumais Audio - Air Magic 1
- Sonniss GDC Game Audio Bundle · David Dumais Audio - Electricity Magic 1
- Sonniss GDC Game Audio Bundle · David Dumais Audio - Ice & Frost Magic 1
- Sonniss GDC Game Audio Bundle · David Dumais Audio - Magic Sound FX Pack 1
- Sonniss GDC Game Audio Bundle · David Dumais Audio - Magic Sound FX Pack 2
- Sonniss GDC Game Audio Bundle · David Dumais Audio - Melee Weapons Sound Effects Pack 1
- Sonniss GDC Game Audio Bundle · David Dumais Audio - Melee Weapons Sound Effects Pack 2
- Sonniss GDC Game Audio Bundle · David Dumais Audio - Monster Sound FX Pack 1
- Sonniss GDC Game Audio Bundle · David Dumais Audio - Monster Sound FX Pack 2
- Sonniss GDC Game Audio Bundle · David Dumais Audio - Spells Magic 1
- Sonniss GDC Game Audio Bundle · David Dumais Audio - UI Menu
- Sonniss GDC Game Audio Bundle · David Dumais Audio - Water Magic 1
- Sonniss GDC Game Audio Bundle · David Dumais Audio - Weapon Sounds - Weapon Swings
- Sonniss GDC Game Audio Bundle · DavidDumais - Explosion SFX Pack
- Sonniss GDC Game Audio Bundle · Doex Studio - 90s Anime SFX Pack
- Sonniss GDC Game Audio Bundle · Epic Stock Media - Anime Game
- Sonniss GDC Game Audio Bundle · Epic Stock Media - Elemental Mutation Whooshes and Impacts
- Sonniss GDC Game Audio Bundle · Epic Stock Media - Fantasy Game 2 - Sound Kit for Enchanted Realms
- Sonniss GDC Game Audio Bundle · Epic Stock Media - HD Game Materials
- Sonniss GDC Game Audio Bundle · Epic Stock Media - Halloween Game - Haunted House and Horror Audio Scare Kit
- Sonniss GDC Game Audio Bundle · Epic Stock Media - Humanoid Creatures Vol 4 - Monstrous and Undead Creature Vocalization Sound Sets
- Sonniss GDC Game Audio Bundle · Epic Stock Media - Strange Game Ambient Loops 3
- Sonniss GDC Game Audio Bundle · Epic Stock Media - Tower Defense Game
- Sonniss GDC Game Audio Bundle · Federico Soler - Effective Trailer Booms Vol. 2
- Sonniss GDC Game Audio Bundle · Federico Soler Fernandez - Effective Trailer Risers
- Sonniss GDC Game Audio Bundle · Fox Audio Post-Production - Ghost Whoosh – Male&Female
- Sonniss GDC Game Audio Bundle · InMotionAudio - Cave Design
- Sonniss GDC Game Audio Bundle · InspectorJ - Essentials 04 Chains
- Sonniss GDC Game Audio Bundle · InspectorJ - RPG Orchestral Essentials (Music FX)
- Sonniss GDC Game Audio Bundle · Ivo Vicic - Campfire - Bonfire FX
- Sonniss GDC Game Audio Bundle · Ivo Vicic - Church Bells
- Sonniss GDC Game Audio Bundle · Ivo Vicic - Watermill
- Sonniss GDC Game Audio Bundle · Ivo Vicic - Wind
- Sonniss GDC Game Audio Bundle · Jake Fielding - Haunted Metal Vol.1 - Cinematic Hits & Impacts
- Sonniss GDC Game Audio Bundle · Jake Fielding - Haunted Metal Vol.3 - Cinematic Tones & Textures
- Sonniss GDC Game Audio Bundle · Jake Fielding - Symphony of Steel - Steelwork Ambiences
- Sonniss GDC Game Audio Bundle · Joshua Reinhardt - Ultimate Creature Footstep and Movement Library
- Sonniss GDC Game Audio Bundle · Justsoundeffects - Forest Ambiences
- Sonniss GDC Game Audio Bundle · Justsoundeffects - Melee Weapons
- Sonniss GDC Game Audio Bundle · Marek Klemczak - Horror Stingers From Hell
- Sonniss GDC Game Audio Bundle · Olivier Girardot - Monster Sounds & Atmospheres
- Sonniss GDC Game Audio Bundle · On The Fly Audio - Steam Engines Real & Foley
- Sonniss GDC Game Audio Bundle · PMSFX - Rocky Impacts
- Sonniss GDC Game Audio Bundle · Phase 4 Libraries - Monster Roars
- Sonniss GDC Game Audio Bundle · Pole Position - Winter Forest Stream
- Sonniss GDC Game Audio Bundle · RYK-Sounds - Footstep
- Sonniss GDC Game Audio Bundle · Rescopic Sound - Distinct Whooshes
- Sonniss GDC Game Audio Bundle · Rogue Waves - Druid Magic
- Sonniss GDC Game Audio Bundle · Rogue Waves - Kawaii UI
- Sonniss GDC Game Audio Bundle · Rogue Waves - Yacht & Marina
- Sonniss GDC Game Audio Bundle · Scoba Sounds – Scoba Ui Essentials
- Sonniss GDC Game Audio Bundle · Shapeforms - Hit & Punch
- Sonniss GDC Game Audio Bundle · Shapeforms Audio - Future UI
- Sonniss GDC Game Audio Bundle · SmartSoundFX - Impacts, Hits & Whooshes
- Sonniss GDC Game Audio Bundle · SmartSoundFX - Monsters
- Sonniss GDC Game Audio Bundle · Sonic Bat - Videogame Foley Essentials Vol. I
- Sonniss GDC Game Audio Bundle · Sonic Bat - Videogame Foley Essentials Vol. II
- Sonniss GDC Game Audio Bundle · Sound Sower - Spring Waterfalls
- Sonniss GDC Game Audio Bundle · Sound Spark LLC - Electric Arcs and Energy
- Sonniss GDC Game Audio Bundle · Sound Spark LLC - Ocean Ambience 1 Caves, Crevices and Waves
- Sonniss GDC Game Audio Bundle · Sound Spark LLC - Whooshes Impacts and Transitions
- Sonniss GDC Game Audio Bundle · Sound of Essen - Tonal Wind
- Sonniss GDC Game Audio Bundle · SoundBits - Just Whoosh 4 - Whoosh Sweeteners
- Sonniss GDC Game Audio Bundle · SoundBits - Vox Hominis - Human Effort Voices
- Sonniss GDC Game Audio Bundle · Soundholder - Sack Of Coins
- Sonniss GDC Game Audio Bundle · Sounds Great - Metal Elements
- Sonniss GDC Game Audio Bundle · Sounds Great - Orc Creature Library
- Sonniss GDC Game Audio Bundle · Stefano Cremona - Explosions
- Sonniss GDC Game Audio Bundle · Wav Junction Sound Effects - Footsteps
- Sonniss GDC Game Audio Bundle · Wav Junction Sound Effects - Rocks
- Sonniss GDC Game Audio Bundle · Wav Junction Sound Effects - Zippers, Buckles & Clothing
- rubberduck (opengameart.org) · oga_80-CC0-RPG-SFX_0
- rubberduck (opengameart.org) · oga_80-CC0-creature-SFX_0
- rubberduck (opengameart.org) · oga_80-CC0-creature-sfx-2
- rubberduck (opengameart.org) · oga_sfx_100_v2
- rubberduck (opengameart.org) · oga_sfx_breaking_and_falling
- rubberduck (opengameart.org) · oga_water-splash-slime-sfx
