"""从 listings/*.json 选 Sonniss 素材：ALL 中的库全取，ONE 中的环境库各取一个不超过 110MB 的最小文件；写 picks/*.txt。工作目录 .qa/audio-sourcing。"""
import json,glob,os,collections,sys
ALL=r'''
2020|Articulated Sounds - Magic Elements vol.2
2020|Audio Summoners - Future Melee Weapons
2020|Audiomeals - Dark Creature Sounds
2020|Bart Kamski - Clicks & Switches
2020|Bluezone - Cave Creature Sound Effects
2020|Bluezone - Cinematic Metal Impacts
2020|Bluezone - Crab - Creature
2020|Bluezone - Forest Creature Sound Effects
2020|Bluezone - Mountain Dweller - Orc Sound Effects
2020|Bluezone - Snow Footsteps
2020|Bluezone - Switch And Button Sound Effects
2020|BluezoneCorp - Designed Water
2020|BluezoneCorp - Stone Impact
2020|BluezoneCorp - Modern Cinematic Impact
2020|BluezoneCorp - Steampunk Machines
2020|Conor Bradley - Metal Chains
2020|David Dumais Audio - Air Magic 1
2020|David Dumais Audio - Electricity Magic 1
2020|David Dumais Audio - Ice & Frost Magic 1
2020|David Dumais Audio - Magic Sound FX Pack 1
2020|David Dumais Audio - Monster Sound FX Pack 1
2020|David Dumais Audio - Spells Magic 1
2020|David Dumais Audio - UI Menu
2020|David Dumais Audio - Water Magic 1
2020|David Dumais Audio - Weapon Sounds - Weapon Swings
2020|DavidDumais - Explosion SFX Pack
2020|Fox Audio Post-Production - Ghost Whoosh – Male&Female
2020|Jake Fielding - Haunted Metal Vol.1 - Cinematic Hits & Impacts
2020|Justsoundeffects - Melee Weapons
2020|Joshua Reinhardt - Ultimate Creature Footstep and Movement Library
2020|Olivier Girardot - Monster Sounds & Atmospheres
2020|PMSFX - Rocky Impacts
2020|Phase 4 Libraries - Monster Roars
2020|Rescopic Sound - Distinct Whooshes
2020|Rogue Waves - Kawaii UI
2020|Scoba Sounds – Scoba Ui Essentials
2020|Shapeforms - Hit & Punch
2020|SmartSoundFX - Impacts, Hits & Whooshes
2020|SmartSoundFX - Monsters
2020|Sonic Bat - Videogame Foley Essentials Vol. II
2020|Sound Spark LLC - Electric Arcs and Energy
2020|Sound Spark LLC - Whooshes Impacts and Transitions
2020|SoundBits - Just Whoosh 4 - Whoosh Sweeteners
2020|Soundholder - Sack Of Coins
2020|Sounds Great - Metal Elements
2020|Sounds Great - Orc Creature Library
2020|Stefano Cremona - Explosions
2020|Wav Junction Sound Effects - Rocks
2020|Wav Junction Sound Effects - Footsteps
2020|Wav Junction Sound Effects - Zippers, Buckles & Clothing
2020|Federico Soler Fernandez - Effective Trailer Risers
2020|InMotionAudio - Cave Design
2023|344 Audio - Epic Impacts Vol. 1
2023|344 Audio - Organic User Interface
2023|344 Audio - Intense Trailer Elements
2023|BluezoneCorp - Ice Cracking
2023|BluezoneCorp - Forest Textures
2023|BluezoneCorp - Invader - Alien Creature
2023|BluezoneCorp - Detonation - Explosion
2023|CB Sound Design - Dreamcatcher - The Sound of Dreams & Magic
2023|CB Sound Design - Essential Sounds Vol.01 Coins
2023|CB Sound Design - Whoosh And Push
2023|CB Sound Design - Board Games – Gamedesigners Audio Toolkit 01
2023|David Dumais Audio - Magic Sound FX Pack 2
2023|David Dumais Audio - Melee Weapons Sound Effects Pack 1
2023|David Dumais Audio - Monster Sound FX Pack 2
2023|InspectorJ - RPG Orchestral Essentials (Music FX)
2023|InspectorJ - Essentials 04 Chains
2023|Marek Klemczak - Horror Stingers From Hell
2023|RYK-Sounds - Footstep
2023|Rogue Waves - Druid Magic
2023|Shapeforms Audio - Future UI
2023|Sonic Bat - Videogame Foley Essentials Vol. I
2024|Doex Studio - 90s Anime SFX Pack
2026|344 Audio - Elemental Palette Designed Vol. 1
2026|344 Audio - Cinematic Fight Vol. 1
2026|344 Audio - Anime Fight Voices Vol. 1
2026|344 Audio - Anime Fight Voices Vol. 2
2026|344 Audio - Historical Weapons Vol. 2
2026|Alexander Kopeikin - 100 kHz Designed Ice
2026|Alexander Kopeikin - Emotion and Magic
2026|CB_Sounddesign - Applicable Sounds - Organic UI and Building Games SFX
2026|Cinematic Sound Design - Colossal Impacts
2026|Cinematic Sound Design - Hybrid Game & UI Elements
2026|Cinematic Sound Design - Interface & Infographics
2026|Cinematic Sound Design - System & UI Feedback Elements
2026|Cinematic Sound Design - UI Interaction Elements
2026|Cinematic Sound Design - Ultra Transitions & Impacts
2026|Cinematic Sound Design - User Interface
2026|David Dumais Audio - Melee Weapons Sound Effects Pack 2
2026|Epic Stock Media - Elemental Mutation Whooshes and Impacts
2026|Epic Stock Media - Fantasy Game 2 - Sound Kit for Enchanted Realms
2026|Epic Stock Media - HD Game Materials
2026|Epic Stock Media - Humanoid Creatures Vol 4 - Monstrous and Undead Creature Vocalization Sound Sets
2026|Epic Stock Media - Tower Defense Game
2026|Epic Stock Media - Halloween Game - Haunted House and Horror Audio Scare Kit
2026|Epic Stock Media - Anime Game
2026|Federico Soler - Effective Trailer Booms Vol. 2
2026|SoundBits - Vox Bestiae - Source Elements
2026|SoundBits - Vox Hominis - Human Effort Voices
'''
ONE=r'''
2020|Sound Spark LLC - Ocean Ambience 1 Caves, Crevices and Waves
2020|Ivo Vicic - Wind
2020|Justsoundeffects - Forest Ambiences
2020|Rogue Waves - Yacht & Marina
2020|Bluezone - Heaven - Ethereal Ambient Samples
2020|Jake Fielding - Symphony of Steel - Steelwork Ambiences
2020|Pole Position - Winter Forest Stream
2020|Sound of Essen - Tonal Wind
2020|Bluezone - Wilderness - Flowing Water
2020|Sound Sower - Spring Waterfalls
2020|On The Fly Audio - Steam Engines Real & Foley
2020|Jake Fielding - Haunted Metal Vol.3 - Cinematic Tones & Textures
2020|Ivo Vicic - Watermill
2023|BluezoneCorp - Afterlife - Ethereal Ambient Samples
2026|Ivo Vicic - Campfire - Bonfire FX
2026|Ivo Vicic - Church Bells
2026|Epic Stock Media - Strange Game Ambient Loops 3
'''
idx=collections.defaultdict(list)
for fn in glob.glob('listings/*.json'):
    y=os.path.basename(fn)[:4]; l=json.load(open(fn,encoding='utf8'))
    for e in l['entries']:
        if e['usize'] and e['name'].lower().endswith(('.wav','.flac','.aif','.aiff')):
            idx[(y,e['name'].split('/')[0])].append((fn,e))
pick=collections.defaultdict(list); missing=[]; tot=0
def take(y,f,one):
    global tot
    es=idx.get((y,f))
    if not es:
        alt=[k for k in idx if k[1]==f]
        if alt: es=idx[alt[0]]
    if not es: missing.append(f); return
    es=sorted(es,key=lambda t:t[1]['usize'])
    if one: es=[e for e in es if e[1]['usize']<=110e6][:1] or es[:1]
    for fn,e in es: pick[fn].append(e['name']); tot+=e['usize']
for block,one in ((ALL,False),(ONE,True)):
    for line in block.strip().splitlines():
        y,f=line.split('|',1); take(y,f,one)
print('files',sum(len(v) for v in pick.values()),'GB',round(tot/1e9,2),'missing',missing)
os.makedirs('picks',exist_ok=True)
for fn,names in pick.items():
    open('picks/'+os.path.basename(fn).replace('.json','.txt'),'w',encoding='utf8').write('\n'.join(names)+'\n')
