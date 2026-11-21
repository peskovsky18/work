"""
Однократный перенос станции в assets/models/station.blend.

Раньше станция собиралась кодом setupStationEnvironment() в js/scene3d.js и
setupStationCeilingAndArchitecture() в js/subwayExterior.js поверх paris_station.glb
(материалы которого переопределялись в JS). Итоговая сцена была снята с сайта в JSON
(мировые координаты three.js, параметры материалов, текстуры). Свет остаётся в JS.

Запуск: в пустом файле Blender
    run('/путь/к/station.json', helpers)   # helpers — пространство имён build_subway.py
"""
import base64
import json
import os
import struct

import bpy
from mathutils import Vector

# Имена материалов по индексу в JSON (порядок обхода сцены)
MAT_NAMES = [
    'M_Station_Name_Sign', 'M_Ballast', 'M_Rail', 'M_Sleeper',
    'M_Platform_Curb', 'M_Platform_Tactile', 'M_Platform_Dark_Tile', 'M_Platform_Edge',
    'M_Column', 'M_Column_Cuff', 'M_Portal_Wall', 'M_Tunnel_Void', 'M_Tunnel_Void',
    'M_Poster_Housing', 'M_Neon_Cyan', 'M_Poster_Ant', 'M_Poster_Glass', 'M_Neon_Amber', 'M_Poster_Monkey',
    'M_Neon_Aqua', 'M_Poster_Dolphins', 'M_Neon_Coral', 'M_Poster_Lion',
    'M_Ceiling_Light_Line', 'M_Nav_Housing', 'M_Nav_Sign', 'M_Nav_Hanger', 'M_Concourse_Wall',
    'M_Station_Seat_Frame', 'M_Station_Seat_Red', 'M_Vault_Tiles', 'M_VM_Glass',
    'M_VM_Base', 'M_VM_BlackMetal', 'M_VM_BlackPlastic', 'M_VM_Frame', 'M_VM_LED', 'M_VM_Shelf',
    'M_VM_ChipYellow', 'M_VM_SnackRed', 'M_VM_SnackBlue', 'M_VM_SnackBrown', 'M_VM_BottleCyan',
    'M_VM_BottleWater', 'M_VM_CanBlue', 'M_VM_CanRed', 'M_VM_LCD', 'M_VM_Keypad', 'M_VM_GreenLED',
]

TEX_NAMES = {
    'station_tex_0': 'station_name_sign',
    'station_tex_1': 'platform_curb_color', 'station_tex_2': 'platform_curb_normal', 'station_tex_3': 'platform_curb_roughness',
    'station_tex_4': 'platform_tactile_color', 'station_tex_5': 'platform_tactile_normal', 'station_tex_6': 'platform_tactile_roughness',
    'station_tex_7': 'platform_dark_color', 'station_tex_8': 'platform_dark_normal', 'station_tex_9': 'platform_dark_roughness',
    'station_tex_14': 'nav_sign',
}

# Объект -> коллекция. Объекты называются по материалу, кроме именованных частей и автомата.
COLLECTIONS = {
    'Architecture': ['Vault_Tiles', 'Column', 'Column_Cuff', 'Portal_Wall', 'Tunnel_Void', 'Ceiling_Light_Line', 'Concourse_Wall'],
    'Platform': ['Platform_Curb', 'Platform_Tactile', 'Platform_Dark_Tile', 'Platform_Edge'],
    'Track': ['Ballast', 'Rail', 'Sleeper'],
    'Furniture': ['Station_Seat_Frame', 'Station_Seat_Red', 'Vending_Machine'],
    'Signage': ['Station_Name_Sign', 'Nav_Housing', 'Nav_Sign', 'Nav_Hanger'],
    'Posters': ['Poster_Housing', 'Poster_Glass', 'Poster_Ant', 'Poster_Monkey', 'Poster_Dolphins', 'Poster_Lion',
                'Neon_Cyan', 'Neon_Amber', 'Neon_Aqua', 'Neon_Coral'],
}


def decode(b64, fmt):
    raw = base64.b64decode(b64)
    return struct.unpack('<%d%s' % (len(raw) // 4, fmt), raw)


def build_material(name, m, tex_names, make_material):
    if name in bpy.data.materials:
        return bpy.data.materials[name]
    g = m.get
    tex = lambda k: tex_names[g(k)['id']] if g(k) else None  # noqa: E731
    rep = lambda k: tuple(g(k)['repeat']) if g(k) else (1, 1)  # noqa: E731
    if m['type'] == 'MeshBasicMaterial':
        # Неосвещаемый материал: чёрная база + эмиссия цвета
        return make_material(name, color=(0, 0, 0), rough=1.0, emission=tuple(m['color']), emission_strength=1.0,
                             double_sided=m['side'] == 2)
    emissive = g('emissive') if g('emissive') and any(g('emissive')) else None
    return make_material(
        name, color=tuple(m['color']), rough=g('roughness'), metal=g('metalness'),
        base_tex=tex('map'), repeat=rep('map') if g('map') else rep('normalMap'),
        normal_tex=tex('normalMap'), normal_strength=g('normalScale') or 1.0, normal_repeat=rep('normalMap'),
        rough_tex=tex('roughnessMap'),
        emission=tuple(emissive) if emissive else None,
        emission_strength=g('emissiveIntensity') if emissive else 0.0,
        emission_tex=bool(g('emissiveMap')),
        alpha=m['opacity'] if m['transparent'] else 1.0,
        double_sided=m['side'] == 2,
        coat=g('clearcoat') or 0.0, coat_rough=g('clearcoatRoughness') or 0.03,
    )


def run(json_path, helpers, mat_names=None, tex_map=None, collections=None):
    """mat_names/tex_map/collections по умолчанию — таблицы станции; эскалатор передаёт свои."""
    mat_names = mat_names or MAT_NAMES
    tex_map = tex_map or TEX_NAMES
    collections = collections or COLLECTIONS
    make_material, C = helpers['make_material'], helpers['C']
    data = json.load(open(json_path))

    tex_names = {}
    for t in data['textures']:
        name = tex_map.get(t['id'], t['id'])
        with open(os.path.join(helpers['TEX_DIR'], name + '.png'), 'wb') as f:
            f.write(base64.b64decode(t['png']))
        tex_names[t['id']] = name

    mats = [build_material(mat_names[i], m, tex_names, make_material) for i, m in enumerate(data['materials'])]

    # Группировка: автомат — один объект со многими материалами, остальное — по материалу
    buckets = {}
    for mesh in data['meshes']:
        hint = mesh['hint'] or ''
        mat = mats[mesh['material']]
        group = 'Vending_Machine' if hint.startswith('Vending_Machine') else mat.name[2:]
        if group.startswith('VM_'):
            group = 'Vending_Machine'
        b = buckets.setdefault(group, {'v': [], 'n': [], 'uv': [], 'f': [], 'fm': [], 'mats': []})
        if mat.name not in b['mats']:
            b['mats'].append(mat.name)
        slot = b['mats'].index(mat.name)
        back = data['materials'][mesh['material']]['side'] == 1
        pos = decode(mesh['position'], 'f')
        nrm = decode(mesh['normal'], 'f') if mesh['normal'] else None
        uv = decode(mesh['uv'], 'f') if mesh['uv'] else None
        idx = decode(mesh['index'], 'I')
        base = len(b['v'])
        for i in range(0, len(pos), 3):
            b['v'].append(tuple(C @ Vector((pos[i], pos[i + 1], pos[i + 2]))))
            if nrm:
                n = C @ Vector((nrm[i], nrm[i + 1], nrm[i + 2]))
                b['n'].append(tuple(-n if back else n))
            b['uv'].append((uv[i // 3 * 2], uv[i // 3 * 2 + 1]) if uv else (0.0, 0.0))
        for i in range(0, len(idx), 3):
            tri = (base + idx[i], base + idx[i + 1], base + idx[i + 2])
            b['f'].append((tri[0], tri[2], tri[1]) if back else tri)
            b['fm'].append(slot)

    root = bpy.context.scene.collection
    col_of = {obj: col for col, objs in collections.items() for obj in objs}
    created = []
    for group, b in sorted(buckets.items()):
        col_name = col_of.get(group, 'Misc')
        col = bpy.data.collections.get(col_name) or bpy.data.collections.new(col_name)
        if col.name not in root.children:
            root.children.link(col)
        me = bpy.data.meshes.new(group)
        me.from_pydata(b['v'], [], b['f'])
        uv_layer = me.uv_layers.new(name='UVMap')
        for loop in me.loops:
            uv_layer.data[loop.index].uv = b['uv'][loop.vertex_index]
        for name in b['mats']:
            me.materials.append(bpy.data.materials[name])
        me.polygons.foreach_set('material_index', b['fm'])
        if len(b['n']) == len(b['v']):
            me.normals_split_custom_set_from_vertices(b['n'])
        me.validate(clean_customdata=False)
        obj = bpy.data.objects.new(group, me)
        col.objects.link(obj)
        created.append(group)
    return created, data['lights']
