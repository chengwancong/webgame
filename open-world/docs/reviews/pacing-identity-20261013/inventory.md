# C0 身份参数与规则盘点

## aspect-tf-whirl

原描述：攻击变为原来的90%。旋风的伤害变为原来的160%。旋风分为4段，每段间隔0.5秒，跟随你移动，移动不会打断。旋风可用剑、锤、斧释放。目标周围4格内敌人至少3个且范围技能：伤害增加5%（触发率100%，触发间隔0秒）。旋风技能，命中时：施加破甲 3秒，强度75%，附加伤害0%（触发率100%，触发间隔0秒）。旋风技能，施放时：减伤增加45%，持续2秒，最多1层（触发率100%，触发间隔0秒）。

```json
{
  "statMultipliers": {
    "attack": 0.9
  },
  "conversions": [],
  "overrides": [],
  "patches": [
    {
      "skills": [
        "whirl"
      ],
      "ops": [
        {
          "path": "damage",
          "op": "mul",
          "value": 1.6
        },
        {
          "path": "mechanics.schedule",
          "op": "set",
          "value": {
            "hits": 4,
            "interval": 15,
            "followCaster": true,
            "interruptOnMove": false
          }
        },
        {
          "path": "weapons",
          "op": "set",
          "value": [
            "sword",
            "hammer",
            "axe"
          ]
        }
      ]
    }
  ],
  "rules": [
    {
      "id": "aspect-tf-whirl-crowd-area",
      "name": "风暴回旋 · 5%",
      "description": "目标周围4格内敌人至少3个且范围技能：伤害增加5%（触发率100%，触发间隔0秒）。",
      "source": "aspect-tf-whirl",
      "tier": 1,
      "trigger": "passive",
      "chance": 1,
      "icd": 0,
      "filter": {},
      "when": [
        {
          "kind": "crowd",
          "op": "gte",
          "value": 3,
          "radius": 4
        },
        {
          "kind": "skill",
          "tags": [
            "area"
          ]
        }
      ],
      "action": {
        "type": "amplify",
        "ratio": 0.05,
        "against": []
      },
      "scale": [],
      "vfxKey": "player/ward"
    },
    {
      "id": "aspect-tf-whirl-whirl-armor",
      "name": "风暴回旋 · 0%",
      "description": "旋风技能，命中时：施加破甲 3秒，强度75%，附加伤害0%（触发率100%，触发间隔0秒）。",
      "source": "aspect-tf-whirl",
      "tier": 1,
      "trigger": "hit",
      "chance": 1,
      "icd": 0,
      "filter": {},
      "when": [
        {
          "kind": "skill",
          "skills": [
            "whirl"
          ]
        }
      ],
      "action": {
        "type": "status",
        "ref": "hit",
        "status": "armor_down",
        "duration": 90,
        "strength": 0.75,
        "ratio": 0
      },
      "scale": [],
      "vfxKey": "player/ward"
    },
    {
      "id": "aspect-tf-whirl-whirl-guard",
      "name": "风暴回旋 · 45%",
      "description": "旋风技能，施放时：减伤增加45%，持续2秒，最多1层（触发率100%，触发间隔0秒）。",
      "source": "aspect-tf-whirl",
      "tier": 1,
      "trigger": "cast",
      "chance": 1,
      "icd": 0,
      "filter": {},
      "when": [
        {
          "kind": "skill",
          "skills": [
            "whirl"
          ]
        }
      ],
      "action": {
        "type": "buff",
        "duration": 60,
        "maxStacks": 1,
        "mods": {
          "damageReduction": 0.45
        }
      },
      "scale": [],
      "vfxKey": "player/ward"
    }
  ]
}
```

## aspect-tf-knife

原描述：飞刀、扇刃环绕3秒，轨道半径1.5格，每0.5秒可接触一次，每秒转动4.2弧度。飞刀、扇刃以你为中心。飞刀、扇刃接触半径1格。飞刀、扇刃的命中及持续伤害变为原来的10%。目标处于流血：伤害增加5%（触发率100%，触发间隔0秒）。你周围4格内敌人至少3个：闪避增加15%，最多1层（触发率100%，触发间隔0秒）。

```json
{
  "conversions": [],
  "overrides": [],
  "patches": [
    {
      "scalePeriodicBudget": true,
      "skills": [
        "throwing_knife",
        "fan_of_knives"
      ],
      "ops": [
        {
          "path": "mechanics.projectile.orbit",
          "op": "set",
          "value": {
            "duration": 90,
            "radius": 1.5,
            "interval": 15,
            "speed": 0.14
          }
        },
        {
          "path": "mechanics.targeting",
          "op": "set",
          "value": "self"
        },
        {
          "path": "mechanics.projectile.collisionRadius",
          "op": "set",
          "value": 1
        },
        {
          "path": "damage",
          "op": "mul",
          "value": 0.1
        }
      ]
    }
  ],
  "rules": [
    {
      "id": "aspect-tf-knife-bleeding-hit",
      "name": "环刃 · 5%",
      "description": "目标处于流血：伤害增加5%（触发率100%，触发间隔0秒）。",
      "source": "aspect-tf-knife",
      "tier": 1,
      "trigger": "passive",
      "chance": 1,
      "icd": 0,
      "filter": {},
      "when": [
        {
          "kind": "target_status",
          "statuses": [
            "bleed"
          ]
        }
      ],
      "action": {
        "type": "amplify",
        "ratio": 0.05,
        "against": []
      },
      "scale": [],
      "vfxKey": "player/ward"
    },
    {
      "id": "aspect-tf-knife-crowd-evasion",
      "name": "环刃 · 15%",
      "description": "你周围4格内敌人至少3个：闪避增加15%，最多1层（触发率100%，触发间隔0秒）。",
      "source": "aspect-tf-knife",
      "tier": 1,
      "trigger": "passive",
      "chance": 1,
      "icd": 0,
      "filter": {},
      "when": [
        {
          "kind": "crowd",
          "op": "gte",
          "value": 3,
          "radius": 4
        }
      ],
      "action": {
        "type": "buff",
        "duration": 30,
        "maxStacks": 1,
        "mods": {
          "dodge": 0.15
        }
      },
      "scale": [],
      "vfxKey": "player/ward"
    }
  ]
}
```

## aspect-st-ember

原描述：燃烧可以暴击，使用你暴击率的50%。攻击变为原来的65%。引爆触发间隔1秒。燃烧：伤害增加20%（触发率100%，触发间隔0秒）。目标处于燃烧，直接命中：伤害增加50%（触发率100%，触发间隔0秒）。目标处于燃烧，击杀时：把你施加的燃烧扩散给3格内最多3个敌人（触发率100%，触发间隔0秒）。目标处于燃烧，直接命中，命中时：护盾取现有值与最大生命5%的较高值，至少持续3秒（触发率100%，触发间隔3秒）。

```json
{
  "flags": {
    "dotCrit": true
  },
  "statMultipliers": {
    "attack": 0.65
  },
  "conversions": [],
  "overrides": [
    {
      "target": "atom-detonate",
      "set": {
        "icd": 30
      }
    }
  ],
  "patches": [],
  "rules": [
    {
      "id": "aspect-st-ember-burn",
      "name": "余烬之心 · 20%",
      "description": "燃烧：伤害增加20%（触发率100%，触发间隔0秒）。",
      "source": "aspect-st-ember",
      "tier": 1,
      "trigger": "passive",
      "chance": 1,
      "icd": 0,
      "filter": {
        "statusKinds": [
          "burn"
        ]
      },
      "when": [],
      "action": {
        "type": "amplify",
        "ratio": 0.2,
        "against": []
      },
      "scale": [
        "action.ratio"
      ],
      "vfxKey": "player/ember"
    },
    {
      "id": "aspect-st-ember-burning-hit",
      "name": "余烬之心 · 50%",
      "description": "目标处于燃烧，直接命中：伤害增加50%（触发率100%，触发间隔0秒）。",
      "source": "aspect-st-ember",
      "tier": 1,
      "trigger": "passive",
      "chance": 1,
      "icd": 0,
      "filter": {
        "categories": [
          "direct"
        ]
      },
      "when": [
        {
          "kind": "target_status",
          "statuses": [
            "burn"
          ]
        }
      ],
      "action": {
        "type": "amplify",
        "ratio": 0.5,
        "against": []
      },
      "scale": [],
      "vfxKey": "player/ward"
    },
    {
      "id": "aspect-st-ember-spread",
      "name": "余烬之心 · 3个",
      "description": "目标处于燃烧，击杀时：把你施加的燃烧扩散给3格内最多3个敌人（触发率100%，触发间隔0秒）。",
      "source": "aspect-st-ember",
      "tier": 1,
      "trigger": "kill",
      "chance": 1,
      "icd": 0,
      "filter": {},
      "when": [
        {
          "kind": "target_status",
          "statuses": [
            "burn"
          ]
        }
      ],
      "action": {
        "type": "spread",
        "statuses": [
          "burn"
        ],
        "radius": 3,
        "count": 3
      },
      "scale": [],
      "vfxKey": "player/ward"
    },
    {
      "id": "aspect-st-ember-ember-shield",
      "name": "余烬之心 · 5%",
      "description": "目标处于燃烧，直接命中，命中时：护盾取现有值与最大生命5%的较高值，至少持续3秒（触发率100%，触发间隔3秒）。",
      "source": "aspect-st-ember",
      "tier": 1,
      "trigger": "hit",
      "chance": 1,
      "icd": 90,
      "filter": {
        "categories": [
          "direct"
        ]
      },
      "when": [
        {
          "kind": "target_status",
          "statuses": [
            "burn"
          ]
        }
      ],
      "action": {
        "type": "shield",
        "ratio": 0.05,
        "ref": "maxHp",
        "duration": 90
      },
      "scale": [],
      "vfxKey": "player/ward"
    }
  ]
}
```

## aspect-st-permafrost

原描述：攻击变为原来的70%。寒蚀冰冻持续2.5秒。碎冰范围变为原来的200%。目标处于冰冻或减速：伤害增加5%（触发率100%，触发间隔0秒）。受击时：对你周围3格敌人造成攻击5%的冰霜伤害，施加冰冻 1.5秒（强度0%）（触发率100%，触发间隔6秒）。

```json
{
  "statMultipliers": {
    "attack": 0.7
  },
  "conversions": [],
  "overrides": [
    {
      "target": "atom-chill",
      "set": {
        "action.onStacks.duration": 75
      }
    },
    {
      "target": "atom-shatter",
      "mul": {
        "action.radius": 2
      }
    }
  ],
  "patches": [],
  "rules": [
    {
      "id": "aspect-st-permafrost-cold-hit",
      "name": "永冻 · 5%",
      "description": "目标处于冰冻或减速：伤害增加5%（触发率100%，触发间隔0秒）。",
      "source": "aspect-st-permafrost",
      "tier": 1,
      "trigger": "passive",
      "chance": 1,
      "icd": 0,
      "filter": {},
      "when": [
        {
          "kind": "target_status",
          "statuses": [
            "freeze",
            "slow"
          ]
        }
      ],
      "action": {
        "type": "amplify",
        "ratio": 0.05,
        "against": []
      },
      "scale": [],
      "vfxKey": "player/ward"
    },
    {
      "id": "aspect-st-permafrost-frost-guard",
      "name": "永冻 · 5%",
      "description": "受击时：对你周围3格敌人造成攻击5%的冰霜伤害，施加冰冻 1.5秒（强度0%）（触发率100%，触发间隔6秒）。",
      "source": "aspect-st-permafrost",
      "tier": 1,
      "trigger": "hurt",
      "chance": 1,
      "icd": 180,
      "filter": {},
      "when": [],
      "action": {
        "type": "nova",
        "ratio": 0.05,
        "radius": 3,
        "damageType": "cold",
        "ref": "attack",
        "at": "self",
        "status": {
          "kind": "freeze",
          "duration": 45,
          "strength": 0,
          "scope": "hit",
          "cleanse": true,
          "breakOnDamage": false,
          "removeWithSource": false
        }
      },
      "scale": [],
      "vfxKey": "player/ward"
    }
  ]
}
```

## aspect-tr-headhunter

原描述：攻击变为原来的40%。击杀精英或首领时：所有技能冷却全部重置（触发率100%，触发间隔0秒）。目标生命至少90%：伤害增加90%（触发率100%，触发间隔0秒）。进入战斗不足3秒：暴击伤害增加5%，最多1层（触发率100%，触发间隔0秒）。击杀精英或首领时：护盾取现有值与最大生命15%的较高值，至少持续3秒（触发率100%，触发间隔0秒）。

```json
{
  "statMultipliers": {
    "attack": 0.4
  },
  "conversions": [],
  "overrides": [],
  "patches": [],
  "rules": [
    {
      "id": "aspect-tr-headhunter:26",
      "name": "猎首 · 触发率100%",
      "description": "击杀精英或首领时：所有技能冷却全部重置（触发率100%，触发间隔0秒）。",
      "source": "aspect-tr-headhunter",
      "tier": 1,
      "trigger": "kill_elite",
      "chance": 1,
      "icd": 0,
      "filter": {},
      "when": [],
      "action": {
        "type": "cooldown",
        "mode": "all",
        "reset": true
      },
      "scale": [],
      "vfxKey": "player/whirl"
    },
    {
      "id": "aspect-tr-headhunter-healthy-hit",
      "name": "猎首 · 90%",
      "description": "目标生命至少90%：伤害增加90%（触发率100%，触发间隔0秒）。",
      "source": "aspect-tr-headhunter",
      "tier": 1,
      "trigger": "passive",
      "chance": 1,
      "icd": 0,
      "filter": {},
      "when": [
        {
          "kind": "target_hp",
          "op": "gte",
          "value": 0.9
        }
      ],
      "action": {
        "type": "amplify",
        "ratio": 0.9,
        "against": []
      },
      "scale": [],
      "vfxKey": "player/ward"
    },
    {
      "id": "aspect-tr-headhunter-opening-critical",
      "name": "猎首 · 5%",
      "description": "进入战斗不足3秒：暴击伤害增加5%，最多1层（触发率100%，触发间隔0秒）。",
      "source": "aspect-tr-headhunter",
      "tier": 1,
      "trigger": "passive",
      "chance": 1,
      "icd": 0,
      "filter": {},
      "when": [
        {
          "kind": "combat_time",
          "op": "lt",
          "value": 3
        }
      ],
      "action": {
        "type": "buff",
        "duration": 30,
        "maxStacks": 1,
        "mods": {
          "critMultiplier": 0.05
        }
      },
      "scale": [],
      "vfxKey": "player/ward"
    },
    {
      "id": "aspect-tr-headhunter-elite-shield",
      "name": "猎首 · 15%",
      "description": "击杀精英或首领时：护盾取现有值与最大生命15%的较高值，至少持续3秒（触发率100%，触发间隔0秒）。",
      "source": "aspect-tr-headhunter",
      "tier": 1,
      "trigger": "kill_elite",
      "chance": 1,
      "icd": 0,
      "filter": {},
      "when": [],
      "action": {
        "type": "shield",
        "ratio": 0.15,
        "ref": "maxHp",
        "duration": 90
      },
      "scale": [],
      "vfxKey": "player/ward"
    }
  ]
}
```

## aspect-tr-tempo

原描述：攻击变为原来的330%。每6秒：伤害增加30%，必定暴击，作用于下一次施法，持续6秒，最多1层（触发率100%，触发间隔0秒）。节拍强化就绪时，每6秒：冷却恢复速度增加5%，持续3秒，最多1层（触发率100%，触发间隔0秒）。每累计消耗50点法力时：护盾取现有值与最大生命5%的较高值，至少持续3秒（触发率100%，触发间隔0秒）。

```json
{
  "statMultipliers": {
    "attack": 3.3
  },
  "conversions": [],
  "overrides": [],
  "patches": [],
  "rules": [
    {
      "id": "aspect-tr-tempo:30",
      "name": "节拍 · 30%",
      "description": "每6秒：伤害增加30%，必定暴击，作用于下一次施法，持续6秒，最多1层（触发率100%，触发间隔0秒）。",
      "source": "aspect-tr-tempo",
      "tier": 1,
      "trigger": "interval",
      "chance": 1,
      "icd": 0,
      "every": 180,
      "filter": {},
      "when": [],
      "action": {
        "type": "buff",
        "duration": 180,
        "maxStacks": 1,
        "mods": {
          "damageMult": 0.3
        },
        "consume": "nextCast",
        "flags": {
          "forceCrit": true
        }
      },
      "scale": [],
      "vfxKey": "player/whirl"
    },
    {
      "id": "aspect-tr-tempo-tempo-recovery",
      "name": "节拍 · 5%",
      "description": "节拍强化就绪时，每6秒：冷却恢复速度增加5%，持续3秒，最多1层（触发率100%，触发间隔0秒）。",
      "source": "aspect-tr-tempo",
      "tier": 1,
      "trigger": "interval",
      "chance": 1,
      "icd": 0,
      "every": 180,
      "filter": {},
      "when": [
        {
          "kind": "self_state",
          "state": "buff",
          "id": "aspect-tr-tempo:30"
        }
      ],
      "action": {
        "type": "buff",
        "duration": 90,
        "maxStacks": 1,
        "mods": {
          "cooldownRecovery": 0.05
        }
      },
      "scale": [],
      "vfxKey": "player/ward"
    },
    {
      "id": "aspect-tr-tempo-mana-shield",
      "name": "节拍 · 5%",
      "description": "每累计消耗50点法力时：护盾取现有值与最大生命5%的较高值，至少持续3秒（触发率100%，触发间隔0秒）。",
      "source": "aspect-tr-tempo",
      "tier": 1,
      "trigger": "mana_spent",
      "chance": 1,
      "icd": 0,
      "every": 50,
      "filter": {},
      "when": [],
      "action": {
        "type": "shield",
        "ratio": 0.05,
        "ref": "maxHp",
        "duration": 90
      },
      "scale": [],
      "vfxKey": "player/ward"
    }
  ]
}
```

## aspect-df-burst

原描述：护盾破裂时：对你周围3格敌人造成本次护盾的历史最高值140%的物理伤害（触发率100%，触发间隔0秒）。格挡时：对你周围3格敌人造成格挡抵消的护甲减免前伤害5%的物理伤害（触发率100%，触发间隔0秒）。持盾时：受到伤害减少20%（触发率100%，触发间隔0秒）。

```json
{
  "conversions": [],
  "overrides": [],
  "patches": [],
  "rules": [
    {
      "id": "aspect-df-burst:37",
      "name": "爆盾 · 140%",
      "description": "护盾破裂时：对你周围3格敌人造成本次护盾的历史最高值140%的物理伤害（触发率100%，触发间隔0秒）。",
      "source": "aspect-df-burst",
      "tier": 1,
      "trigger": "shield_break",
      "chance": 1,
      "icd": 0,
      "filter": {},
      "when": [],
      "action": {
        "type": "nova",
        "ratio": 1.4,
        "radius": 3,
        "damageType": "physical",
        "ref": "shield",
        "at": "self"
      },
      "scale": [
        "action.ratio"
      ],
      "vfxKey": "player/whirl"
    },
    {
      "id": "aspect-df-burst-block-counter",
      "name": "爆盾 · 5%",
      "description": "格挡时：对你周围3格敌人造成格挡抵消的护甲减免前伤害5%的物理伤害（触发率100%，触发间隔0秒）。",
      "source": "aspect-df-burst",
      "tier": 1,
      "trigger": "block",
      "chance": 1,
      "icd": 0,
      "filter": {},
      "when": [],
      "action": {
        "type": "nova",
        "ratio": 0.05,
        "radius": 3,
        "damageType": "physical",
        "ref": "hit",
        "at": "self"
      },
      "scale": [],
      "vfxKey": "player/ward"
    },
    {
      "id": "aspect-df-burst-shield-guard",
      "name": "爆盾 · 20%",
      "description": "持盾时：受到伤害减少20%（触发率100%，触发间隔0秒）。",
      "source": "aspect-df-burst",
      "tier": 1,
      "trigger": "passive",
      "chance": 1,
      "icd": 0,
      "filter": {},
      "when": [
        {
          "kind": "self_state",
          "state": "shield"
        }
      ],
      "action": {
        "type": "reduce",
        "ratio": 0.2
      },
      "scale": [],
      "vfxKey": "player/ward"
    }
  ]
}
```

## aspect-mv-tailwind

原描述：攻击变为原来的300%。移速加成的50%转为伤害加成，永久与临时移速分别计算。位移后：伤害增加5%，必定暴击，作用于下一次直接命中，持续3秒，最多1层（触发率100%，触发间隔0秒）。连续移动超过0秒时：闪避增加5%，最多1层（触发率100%，触发间隔0秒）。

```json
{
  "statMultipliers": {
    "attack": 3
  },
  "conversions": [
    {
      "fromStat": "speedBonus",
      "toStat": "damageAdd",
      "ratio": 0.5
    }
  ],
  "overrides": [],
  "patches": [],
  "rules": [
    {
      "id": "aspect-mv-tailwind-dash-strike",
      "name": "追风之力 · 5%",
      "description": "位移后：伤害增加5%，必定暴击，作用于下一次直接命中，持续3秒，最多1层（触发率100%，触发间隔0秒）。",
      "source": "aspect-mv-tailwind",
      "tier": 1,
      "trigger": "dash",
      "chance": 1,
      "icd": 0,
      "filter": {},
      "when": [],
      "action": {
        "type": "buff",
        "duration": 90,
        "maxStacks": 1,
        "mods": {
          "damageMult": 0.05
        },
        "consume": "nextHit",
        "flags": {
          "forceCrit": true
        }
      },
      "scale": [],
      "vfxKey": "player/ward"
    },
    {
      "id": "aspect-mv-tailwind-moving-evasion",
      "name": "追风之力 · 5%",
      "description": "连续移动超过0秒时：闪避增加5%，最多1层（触发率100%，触发间隔0秒）。",
      "source": "aspect-mv-tailwind",
      "tier": 1,
      "trigger": "passive",
      "chance": 1,
      "icd": 0,
      "filter": {},
      "when": [
        {
          "kind": "self_state",
          "state": "moving",
          "value": 0
        }
      ],
      "action": {
        "type": "buff",
        "duration": 30,
        "maxStacks": 1,
        "mods": {
          "dodge": 0.05
        }
      },
      "scale": [],
      "vfxKey": "player/ward"
    }
  ]
}
```

## 四项诊断

[
  {
    "bd": "bulwark",
    "scene": "single",
    "seconds": 76.43333333333334,
    "shields": {
      "gain": 8,
      "break": 0,
      "expire": 16
    },
    "firstThreeHits": [
      {
        "tick": 13,
        "amount": 34443,
        "category": "direct",
        "skill": "ground_slam",
        "target": "boss"
      },
      {
        "tick": 18,
        "amount": 26243,
        "category": "direct",
        "skill": "rampage",
        "target": "boss"
      },
      {
        "tick": 45,
        "amount": 6253,
        "category": "derived",
        "skill": "player/counter_strike",
        "target": "boss"
      }
    ],
    "rules": {
      "shield_gain": {
        "count": 8,
        "damage": 0
      },
      "atom-focus": {
        "count": 1,
        "damage": 0,
        "activations": 1,
        "activeFrames": 2262
      },
      "aspect-df-burst-shield-guard": {
        "count": 9,
        "damage": 0
      },
      "atom-bulwark": {
        "count": 25,
        "damage": 0,
        "activations": 1,
        "activeFrames": 2249
      },
      "stat-thorns": {
        "count": 25,
        "damage": 156325
      },
      "aspect-df-burst-block-counter": {
        "count": 5,
        "damage": 5
      },
      "shield_expire": {
        "count": 16,
        "damage": 0
      },
      "innate-heavy-quake": {
        "count": 1,
        "damage": 0
      }
    },
    "shieldSources": {
      "skills": [
        "ward"
      ],
      "rules": [
        "atom-bulwark"
      ],
      "effects": []
    }
  },
  {
    "bd": "bulwark",
    "scene": "clear",
    "seconds": 0.6,
    "shields": {
      "gain": 0,
      "break": 0,
      "expire": 0
    },
    "firstThreeHits": [
      {
        "tick": 13,
        "amount": 34443,
        "category": "direct",
        "skill": "ground_slam",
        "target": "pack-0"
      },
      {
        "tick": 13,
        "amount": 34443,
        "category": "direct",
        "skill": "ground_slam",
        "target": "pack-1"
      },
      {
        "tick": 13,
        "amount": 34443,
        "category": "direct",
        "skill": "ground_slam",
        "target": "pack-2"
      }
    ],
    "rules": {
      "innate-heavy-quake": {
        "count": 4,
        "damage": 139755
      }
    },
    "shieldSources": {
      "skills": [
        "ward"
      ],
      "rules": [
        "atom-bulwark"
      ],
      "effects": []
    }
  },
  {
    "bd": "bulwark",
    "scene": "survival",
    "seconds": 10.7,
    "shields": {
      "gain": 2,
      "break": 1,
      "expire": 2
    },
    "firstThreeHits": [
      {
        "tick": 13,
        "amount": 34443,
        "category": "direct",
        "skill": "ground_slam",
        "target": "pressure-0"
      },
      {
        "tick": 13,
        "amount": 34443,
        "category": "direct",
        "skill": "ground_slam",
        "target": "pressure-1"
      },
      {
        "tick": 13,
        "amount": 34443,
        "category": "direct",
        "skill": "ground_slam",
        "target": "pressure-2"
      }
    ],
    "rules": {
      "shield_gain": {
        "count": 2,
        "damage": 0
      },
      "atom-focus": {
        "count": 1,
        "damage": 0,
        "activations": 1,
        "activeFrames": 291
      },
      "aspect-df-burst-shield-guard": {
        "count": 9,
        "damage": 0
      },
      "atom-bulwark": {
        "count": 4,
        "damage": 0,
        "activations": 1,
        "activeFrames": 271
      },
      "stat-thorns": {
        "count": 11,
        "damage": 67741
      },
      "shield_expire": {
        "count": 2,
        "damage": 0
      },
      "aspect-df-burst-block-counter": {
        "count": 1,
        "damage": 87
      },
      "shield_break": {
        "count": 1,
        "damage": 0
      },
      "aspect-df-burst:37": {
        "count": 1,
        "damage": 135963
      }
    },
    "shieldSources": {
      "skills": [
        "ward"
      ],
      "rules": [
        "atom-bulwark"
      ],
      "effects": []
    }
  },
  {
    "bd": "bulwark",
    "scene": "elite",
    "seconds": 6.6,
    "shields": {
      "gain": 1,
      "break": 0,
      "expire": 0
    },
    "firstThreeHits": [
      {
        "tick": 13,
        "amount": 34443,
        "category": "direct",
        "skill": "ground_slam",
        "target": "elite"
      },
      {
        "tick": 18,
        "amount": 26243,
        "category": "direct",
        "skill": "rampage",
        "target": "elite"
      },
      {
        "tick": 46,
        "amount": 6253,
        "category": "derived",
        "skill": "player/counter_strike",
        "target": "elite"
      }
    ],
    "rules": {
      "shield_gain": {
        "count": 1,
        "damage": 0
      },
      "atom-focus": {
        "count": 1,
        "damage": 0,
        "activations": 1,
        "activeFrames": 167
      },
      "aspect-df-burst-shield-guard": {
        "count": 2,
        "damage": 0
      },
      "atom-bulwark": {
        "count": 2,
        "damage": 0,
        "activations": 1,
        "activeFrames": 153
      },
      "stat-thorns": {
        "count": 2,
        "damage": 12506
      },
      "aspect-df-burst-block-counter": {
        "count": 1,
        "damage": 1
      },
      "innate-heavy-quake": {
        "count": 1,
        "damage": 0
      }
    },
    "shieldSources": {
      "skills": [
        "ward"
      ],
      "rules": [
        "atom-bulwark"
      ],
      "effects": []
    }
  },
  {
    "bd": "bulwark",
    "scene": "safety",
    "seconds": 60,
    "shields": {
      "gain": 14,
      "break": 0,
      "expire": 14
    },
    "firstThreeHits": [
      {
        "tick": 13,
        "amount": 34443,
        "category": "direct",
        "skill": "ground_slam",
        "target": "route-0"
      },
      {
        "tick": 13,
        "amount": 34443,
        "category": "direct",
        "skill": "ground_slam",
        "target": "route-2"
      },
      {
        "tick": 18,
        "amount": 26243,
        "category": "direct",
        "skill": "rampage",
        "target": "route-0"
      }
    ],
    "rules": {
      "shield_gain": {
        "count": 14,
        "damage": 0
      },
      "atom-focus": {
        "count": 7,
        "damage": 0,
        "activations": 7,
        "activeFrames": 1297
      },
      "aspect-df-burst-shield-guard": {
        "count": 45,
        "damage": 0
      },
      "atom-bulwark": {
        "count": 20,
        "damage": 0,
        "activations": 2,
        "activeFrames": 1746
      },
      "stat-thorns": {
        "count": 59,
        "damage": 368927
      },
      "aspect-df-burst-block-counter": {
        "count": 15,
        "damage": 60
      },
      "shield_expire": {
        "count": 14,
        "damage": 0
      }
    },
    "shieldSources": {
      "skills": [
        "ward"
      ],
      "rules": [
        "atom-bulwark"
      ],
      "effects": []
    }
  },
  {
    "bd": "echo",
    "scene": "survival",
    "seconds": 4.7,
    "shields": {
      "gain": 2,
      "break": 2,
      "expire": 0
    },
    "firstThreeHits": [
      {
        "tick": 4,
        "amount": 70024,
        "category": "direct",
        "skill": "arcane_missile",
        "target": "pressure-1"
      },
      {
        "tick": 12,
        "amount": 20007,
        "category": "periodic",
        "skill": "gravity_well",
        "target": "pressure-0"
      },
      {
        "tick": 12,
        "amount": 22408,
        "category": "periodic",
        "skill": "gravity_well",
        "target": "pressure-1"
      }
    ],
    "rules": {
      "atom-time-sand": {
        "count": 1,
        "damage": 0
      },
      "innate-wand-shock": {
        "count": 35,
        "damage": 0
      },
      "aspect-tr-tempo-mana-shield": {
        "count": 3,
        "damage": 0
      },
      "shield_gain": {
        "count": 2,
        "damage": 0
      },
      "shield_break": {
        "count": 2,
        "damage": 0
      }
    },
    "shieldSources": {
      "skills": [],
      "rules": [
        "aspect-tr-tempo-mana-shield"
      ],
      "effects": []
    }
  },
  {
    "bd": "echo",
    "scene": "elite",
    "seconds": 1.4,
    "shields": {
      "gain": 1,
      "break": 0,
      "expire": 0
    },
    "firstThreeHits": [
      {
        "tick": 6,
        "amount": 70024,
        "category": "direct",
        "skill": "arcane_missile",
        "target": "elite"
      },
      {
        "tick": 12,
        "amount": 22408,
        "category": "periodic",
        "skill": "gravity_well",
        "target": "elite"
      },
      {
        "tick": 16,
        "amount": 78427,
        "category": "direct",
        "skill": "arcane_missile",
        "target": "elite"
      }
    ],
    "rules": {
      "atom-time-sand": {
        "count": 1,
        "damage": 0
      },
      "innate-wand-shock": {
        "count": 5,
        "damage": 0
      },
      "aspect-tr-tempo-mana-shield": {
        "count": 2,
        "damage": 0
      },
      "shield_gain": {
        "count": 1,
        "damage": 0
      }
    },
    "shieldSources": {
      "skills": [],
      "rules": [
        "aspect-tr-tempo-mana-shield"
      ],
      "effects": []
    }
  },
  {
    "bd": "opening",
    "scene": "survival",
    "seconds": 7.7,
    "shields": {
      "gain": 0,
      "break": 0,
      "expire": 0
    },
    "firstThreeHits": [
      {
        "tick": 9,
        "amount": 709306,
        "category": "direct",
        "skill": "execute",
        "target": "pressure-1"
      },
      {
        "tick": 84,
        "amount": 709306,
        "category": "direct",
        "skill": "execute",
        "target": "pressure-2"
      },
      {
        "tick": 159,
        "amount": 698560,
        "category": "direct",
        "skill": "execute",
        "target": "pressure-2"
      }
    ],
    "rules": {
      "aspect-tr-headhunter-opening-critical": {
        "count": 1,
        "damage": 0,
        "activations": 1,
        "activeFrames": 90
      },
      "atom-opening": {
        "count": 6,
        "damage": 0,
        "activations": 4,
        "activeFrames": 87,
        "uses": 2
      },
      "aspect-tr-headhunter-healthy-hit": {
        "count": 6,
        "damage": 0
      },
      "atom-focus": {
        "count": 1,
        "damage": 0,
        "activations": 1,
        "activeFrames": 201
      },
      "innate-sword-qi": {
        "count": 1,
        "damage": 1239597
      }
    },
    "shieldSources": {
      "skills": [],
      "rules": [
        "aspect-tr-headhunter-elite-shield"
      ],
      "effects": []
    }
  },
  {
    "bd": "opening",
    "scene": "elite",
    "seconds": 0.3,
    "shields": {
      "gain": 1,
      "break": 0,
      "expire": 0
    },
    "firstThreeHits": [
      {
        "tick": 9,
        "amount": 253333,
        "category": "direct",
        "skill": "execute",
        "target": "elite"
      }
    ],
    "rules": {
      "aspect-tr-headhunter-opening-critical": {
        "count": 1,
        "damage": 0,
        "activations": 1,
        "activeFrames": 9
      },
      "atom-opening": {
        "count": 2,
        "damage": 0,
        "activations": 1,
        "activeFrames": 9,
        "uses": 1
      },
      "aspect-tr-headhunter-healthy-hit": {
        "count": 1,
        "damage": 0
      },
      "aspect-tr-headhunter:26": {
        "count": 1,
        "damage": 0
      },
      "aspect-tr-headhunter-elite-shield": {
        "count": 1,
        "damage": 0
      },
      "shield_gain": {
        "count": 1,
        "damage": 0
      }
    },
    "shieldSources": {
      "skills": [],
      "rules": [
        "aspect-tr-headhunter-elite-shield"
      ],
      "effects": []
    }
  }
]

- 爆盾：技能/装备护盾存在，但低压场景难以打破，短战斗常先清场；生存会耗尽。格挡补盾让来源绑定身份，保留破裂与过期区分。
- 节拍：从 conditionClock.start 起满180帧才首次触发；短战斗/技能耗尽前不能消费强化。新增默认false的startReady，仅节拍打开。
- 被动计数：stepEffects上升沿与effectBuffs每帧上下文计数混用，需要统一激活次数与覆盖帧，并单列consume使用次数。
- 先手：前3次真实命中见上方记录；只记录实际发生的命中，死亡后不补造。

## 偏差场景与独立旋钮

|构筑|最大偏差场景|独立旋钮/必补|
|---|---|---|
|burn|精英|燃烧命中增伤；清怪扩散独立|
|freeze|安全|寒蚀冰冻时长；碎冰范围控制清怪|
|mobile|精英|攻击主旋钮；必补位移落点新星以补清怪|
|quake|精英|旋风倍率；群敌增伤控制清怪|
|arrows|单体|接触预算主旋钮；流血且周围群敌限定清怪|
|echo|精英|节拍倍率；冷却恢复及护盾补生存|
|bulwark|清怪|攻击主旋钮；反击只打攻击者、格挡护盾补安全|
|opening|精英|高生命增伤；必补击杀返还最长冷却控制清怪|
