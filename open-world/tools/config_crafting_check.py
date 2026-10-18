"""制作配置的结构与引用校验；导出和只读校验共用。"""
def validate_crafting_config(exported):
    data = exported.get('crafting.json')
    if data is None:
        return
    materials = {row['id']: row for row in data['materials']}
    recipes = {row['id']: row for row in data['recipes']}
    patterns = {row['id']: row for row in data['patterns']}
    for key in ['materials', 'recipes', 'patterns', 'codex']:
        if len({row['id'] for row in data[key]}) != len(data[key]):
            raise ValueError('制作配置编号重复：' + key)
    if len(materials) < 34 or len(patterns) < 324:
        raise ValueError('制作内容数量不足')
    for recipe in recipes.values():
        for material, count in recipe['baseCost']['materials'].items():
            if material not in materials or not isinstance(count, int) or count <= 0:
                raise ValueError('配方材料无效：' + recipe['id'] + '/' + material)
        output = recipe['output']
        if output['kind'] == 'material' and output['id'] not in materials:
            raise ValueError('配方产物材料不存在：' + recipe['id'])
        if output.get('pattern') and output['pattern'] not in patterns:
            raise ValueError('配方图样不存在：' + recipe['id'])
    for island in {row.get('island') for row in data['materials'] if row.get('island')}:
        rows = [row for row in recipes.values() if row.get('island') == island]
        for category, minimum in [('gear', 2), ('accessory', 1), ('resist', 1), ('essence', 1)]:
            if sum(row['category'] == category for row in rows) < minimum:
                raise ValueError('岛屿配方不足：' + island + '/' + category)
    for facility in ['forge', 'jewel', 'alchemy', 'enchant']:
        if sorted(row['level'] for row in data['facilities'] if row['id'] == facility) != list(range(1, 7)):
            raise ValueError('设施等级不完整：' + facility)
    overrides = data['rules'][0]['value'].get('facilityGoldByIsland', [])
    islands = {row.get('island') for row in data['materials'] if row.get('island')}
    if len({(row['island'], row['level']) for row in overrides}) != len(overrides):
        raise ValueError('设施金币覆盖重复')
    for row in overrides:
        if row['island'] not in islands or row['level'] not in range(2, 7) or type(row['gold']) is not int or row['gold'] <= 0:
            raise ValueError('设施金币覆盖无效')
    if sorted(row['level'] for row in data['masterwork']) != list(range(1, 6)):
        raise ValueError('精工等级不完整')
    nodes = [row for row in exported['world.json']['objects'] if row['kind'] == 'gather']
    if len(nodes) != 150:
        raise ValueError('采集点须有150个')
    for node in nodes:
        if node.get('material') not in materials or materials[node['material']].get('island') != node['region']:
            raise ValueError('采集点材料不在本岛：' + node['id'])
        if materials[node['material']]['kind'] not in ['ore', 'plant'] or materials[node['material']]['tier'] != 'T1':
            raise ValueError('采集点只能产出本岛采集材料：' + node['id'])
    if 'drops' in exported['crafting-public.json']:
        raise ValueError('公开制作包不得携带掉率')
