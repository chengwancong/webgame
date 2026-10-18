import fs from 'fs';

const skills = [];
const categories = {
  melee: 15,
  ranged: 18,
  control: 12,
  support: 10,
  summon: 10,
  aura: 9,
  utility: 5
};

for (const [cat, count] of Object.entries(categories)) {
  for (let i = 0; i < count; i++) {
    skills.push({
      id: `${cat}_${i + 1}`,
      name: `${cat}技能${i + 1}`,
      description: `${cat}类型的第${i + 1}个技能`,
      category: cat,
      unlock: { level: Math.max(1, i * 2) },
      targeting: { type: 'nearest', range: 5 },
      delivery: { method: 'instant' },
      cost: { mana: 10 + i * 5 },
      cooldown: { base: 30 + i * 30 },
      cast: { windup: 5 },
      effects: [{
        type: 'damage',
        damage: { base: 20 + i * 10, scaling: 0.8, type: 'physical' }
      }],
      scaling: { perLevel: { damage: 0.1 }, maxLevel: 5 },
      tags: ['tag1', 'tag2']
    });
  }
}

fs.writeFileSync(
  'g:/webgame/abyss-walker-migration/abyss-walker-rewrite/open-world/apps/web/public/skills-complete-data.json',
  JSON.stringify(skills, null, 2)
);

console.log(`Generated ${skills.length} skills`);
