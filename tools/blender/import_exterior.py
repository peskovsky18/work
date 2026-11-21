"""
Однократный перенос наружного кузова состава в assets/models/subway.blend.

Раньше кузов (ливрея Alstom, крыша, окна, двери, торцы, тележки и два прицепных вагона)
строился кодом setupSubwayExterior() в js/subwayExterior.js. Геометрия была снята из
работающей сцены сайта в JSON (мировые координаты three.js, параметры материалов, canvas-текстуры).
Этот скрипт создаёт из JSON объекты Blender, объединяя меши по вагону и материалу.

Запуск в открытом subway.blend:  run('/путь/к/exterior.json')
"""
import base64
import json
import os
import struct

import bpy
from mathutils import Vector

# Имена материалов по ключу (sRGB hex, roughness, сторона). side: 0 Front, 1 Back, 2 Double
MAT_NAMES = {
    ('22262d', 0.32): 'M_Ext_Roof',
    ('1b1e24', 0.40): 'M_Ext_HVAC',
    ('f4f6fa', 0.22): 'M_Livery_White',
    ('141822', 0.35): 'M_Livery_Pin',
    ('2ca0e6', 0.20): 'M_Livery_Blue',
    ('161820', 0.45): 'M_Ext_Trim',
    ('111317', 0.85): 'M_Ext_Rubber',
    ('cde8fc', 0.04): 'M_Ext_Glass',
    ('111317', 0.35): 'M_Dest_Bezel',
    ('ffffff', 0.20): 'M_Dest_Display',
    ('181a1f', 0.55): 'M_Door_Jamb',
    ('b4bac5', 0.28): 'M_Door_Sill',
    ('22262d', 0.35): 'M_Ext_End',
    ('2b2f38', 0.40): 'M_Coupler',
    ('121418', 0.85): 'M_Underframe',
    ('dce0e6', 0.15): 'M_Ext_Handle',
    ('1f232b', 0.60): 'M_Coupled_Interior',
    ('ffeedd', 0.18): 'M_Coupled_Lamp',
    ('de7928', 0.70): 'M_Coupled_Seats',
    ('1a1c22', 0.65): 'M_Bogie',
}


def lin_to_hex(rgb):
    def ch(c):
        c = max(0.0, min(1.0, c))
        s = c * 12.92 if c <= 0.0031308 else 1.055 * c ** (1 / 2.4) - 0.055
        return round(s * 255)
    return '%02x%02x%02x' % tuple(ch(c) for c in rgb)


def decode(b64, fmt):
    raw = base64.b64decode(b64)
    n = len(raw) // 4
    return struct.unpack('<%d%s' % (n, fmt), raw)


def run(json_path, helpers):
    """helpers: пространство имён build_subway.py (make_material, C, TEX_DIR)."""
    make_material, C = helpers['make_material'], helpers['C']
    tex_dir = helpers['TEX_DIR']
    data = json.load(open(json_path))

    # Текстуры (маршрутное табло)
    tex_names = {}
    for t in data['textures']:
        name = 'destination_display' if len(data['textures']) == 1 else t['id']
        with open(os.path.join(tex_dir, name + '.png'), 'wb') as f:
            f.write(base64.b64decode(t['png']))
        tex_names[t['id']] = name

    # Материалы: дедупликация одинаковых параметров
    mats = []
    for m in data['materials']:
        hex_c = lin_to_hex(m['color'])
        name = MAT_NAMES.get((hex_c, round(m['roughness'], 2)), 'M_Ext_' + hex_c)
        if name in bpy.data.materials:
            mats.append(bpy.data.materials[name])
            continue
        emissive = m['emissive'] if m['emissive'] and any(m['emissive']) else None
        mats.append(make_material(
            name, color=tuple(m['color']), rough=m['roughness'], metal=m['metalness'],
            base_tex=tex_names[m['map']['id']] if m['map'] else None,
            repeat=tuple(m['map']['repeat']) if m['map'] else (1, 1),
            emission=tuple(emissive) if emissive else None,
            emission_strength=m['emissiveIntensity'] if emissive else 0.0,
            emission_tex=bool(m['emissiveMap']),
            alpha=m['opacity'] if m['transparent'] else 1.0,
            double_sided=m['side'] == 2,
            coat=m['clearcoat'], coat_rough=m['clearcoatRoughness'],
        ))

    # Меши -> объекты, сгруппированные по вагону и материалу
    buckets = {}
    for mesh in data['meshes']:
        pos = decode(mesh['position'], 'f')
        nrm = decode(mesh['normal'], 'f') if mesh['normal'] else None
        uv = decode(mesh['uv'], 'f') if mesh['uv'] else None
        idx = decode(mesh['index'], 'I')
        mat = mats[mesh['material']]
        back = data['materials'][mesh['material']]['side'] == 1
        xs = pos[0::3]
        cx = (min(xs) + max(xs)) / 2
        car = 'Car_Main' if abs(cx) < 8.8 else ('Car_Front' if cx > 0 else 'Car_Rear')
        b = buckets.setdefault((car, mat.name), {'v': [], 'n': [], 'uv': [], 'f': []})
        base = len(b['v'])
        for i in range(0, len(pos), 3):
            p = C @ Vector((pos[i], pos[i + 1], pos[i + 2]))
            b['v'].append(tuple(p))
            if nrm:
                n = C @ Vector((nrm[i], nrm[i + 1], nrm[i + 2]))
                b['n'].append(tuple(-n if back else n))
            b['uv'].append((uv[i // 3 * 2], uv[i // 3 * 2 + 1]) if uv else (0.0, 0.0))
        for i in range(0, len(idx), 3):
            tri = (base + idx[i], base + idx[i + 1], base + idx[i + 2])
            b['f'].append((tri[0], tri[2], tri[1]) if back else tri)

    root = bpy.context.scene.collection
    parent_col = bpy.data.collections.get('Exterior') or bpy.data.collections.new('Exterior')
    if parent_col.name not in root.children:
        root.children.link(parent_col)
    created = []
    for (car, mat_name), b in sorted(buckets.items()):
        col_name = 'Exterior_' + car
        col = bpy.data.collections.get(col_name) or bpy.data.collections.new(col_name)
        if col.name not in parent_col.children:
            parent_col.children.link(col)
        obj_name = f'{car}_{mat_name[2:]}'
        me = bpy.data.meshes.new(obj_name)
        me.from_pydata(b['v'], [], b['f'])
        uv_layer = me.uv_layers.new(name='UVMap')
        for loop in me.loops:
            uv_layer.data[loop.index].uv = b['uv'][loop.vertex_index]
        me.validate(clean_customdata=False)
        if len(b['n']) == len(b['v']):
            me.normals_split_custom_set_from_vertices(b['n'])
        me.materials.append(bpy.data.materials[mat_name])
        obj = bpy.data.objects.new(obj_name, me)
        col.objects.link(obj)
        created.append(obj_name)
    return created
