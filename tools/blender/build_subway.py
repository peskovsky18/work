"""
Сборка исходника вагона метро assets/models/subway.blend из черновика subway_blocking.blend.

Переносит в Blender всё, что раньше достраивалось в js/scene3d.js после загрузки GLB:
  * положение, масштаб и разворот створок дверей (стороны A и B);
  * фурнитуру створок (стекло, уплотнитель, ручка), наклейку «Не прислоняться»
    и наружную двухцветную обшивку — всё объединено в один меш на створку;
  * PBR-материалы салона с процедурными текстурами (assets/models/subway_textures).

Запуск: открыть subway_blocking.blend в Blender и выполнить скрипт
(или через blender-mcp execute_code). Результат сохраняется как subway.blend.
Координаты в комментариях даны в пространстве three.js (Y вверх), а в Blender (Z вверх)
переводятся матрицей C: (x, y, z)_three -> (x, -z, y)_blender.
"""
import math
import os

import bmesh
import bpy
from mathutils import Matrix, Vector

PROJECT = os.path.abspath(os.path.join(os.path.dirname(bpy.data.filepath), '..', '..'))
TEX_DIR = os.path.join(PROJECT, 'assets', 'models', 'subway_textures')
OUT_BLEND = os.path.join(PROJECT, 'assets', 'models', 'subway.blend')

C = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))
C_INV = C.inverted()


def to_blender(m_three):
    return C @ m_three @ C_INV


def to_three(m_blender):
    return C_INV @ m_blender @ C


def trs(t=(0, 0, 0), rot_y=0.0, s=(1, 1, 1)):
    return Matrix.Translation(Vector(t)) @ Matrix.Rotation(rot_y, 4, 'Y') @ Matrix.Diagonal((*s, 1))


def srgb(hex_str):
    def ch(c):
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4
    v = int(hex_str, 16)
    return (ch(((v >> 16) & 255) / 255), ch(((v >> 8) & 255) / 255), ch((v & 255) / 255), 1.0)


# ---------------------------------------------------------------------------
# Материалы
# ---------------------------------------------------------------------------
TEX_REL = '//subway_textures/'  # путь к текстурам относительно .blend


def image(name, non_color=False):
    img = bpy.data.images.get(name + '.png') or bpy.data.images.load(os.path.join(TEX_DIR, name + '.png'))
    img.filepath = TEX_REL + name + '.png'
    img.colorspace_settings.name = 'Non-Color' if non_color else 'sRGB'
    return img


def make_material(name, color='ffffff', rough=0.5, metal=0.0, base_tex=None, repeat=(1, 1),
                  normal_tex=None, normal_strength=1.0, normal_repeat=None, rough_tex=None,
                  emission=None, emission_strength=0.0, emission_tex=False, alpha=1.0, alpha_tex=False,
                  double_sided=True, coat=0.0, coat_rough=0.03):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    out.location = (600, 0)
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    bsdf.location = (250, 0)
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    # Цвет: hex в sRGB (как в three.js-коде) или кортеж линейных RGB
    bsdf.inputs['Base Color'].default_value = srgb(color) if isinstance(color, str) else (*color[:3], 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    bsdf.inputs['Alpha'].default_value = alpha
    if coat:
        bsdf.inputs['Coat Weight'].default_value = coat
        bsdf.inputs['Coat Roughness'].default_value = coat_rough

    uv = nt.nodes.new('ShaderNodeTexCoord')
    uv.location = (-1000, 0)

    def tex_node(img_name, rep, non_color, y):
        mapping = nt.nodes.new('ShaderNodeMapping')
        mapping.location = (-800, y)
        mapping.inputs['Scale'].default_value = (rep[0], rep[1], 1)
        nt.links.new(uv.outputs['UV'], mapping.inputs['Vector'])
        node = nt.nodes.new('ShaderNodeTexImage')
        node.location = (-550, y)
        node.image = image(img_name, non_color)
        node.extension = 'REPEAT'
        nt.links.new(mapping.outputs['Vector'], node.inputs['Vector'])
        return node

    base_node = None
    if base_tex:
        base_node = tex_node(base_tex, repeat, False, 300)
        nt.links.new(base_node.outputs['Color'], bsdf.inputs['Base Color'])
        if alpha_tex:
            if alpha < 1.0:
                mul = nt.nodes.new('ShaderNodeMath')
                mul.operation = 'MULTIPLY'
                mul.inputs[1].default_value = alpha
                nt.links.new(base_node.outputs['Alpha'], mul.inputs[0])
                nt.links.new(mul.outputs['Value'], bsdf.inputs['Alpha'])
            else:
                nt.links.new(base_node.outputs['Alpha'], bsdf.inputs['Alpha'])
    if rough_tex:
        r_node = tex_node(rough_tex, repeat, True, 0)
        sep = nt.nodes.new('ShaderNodeSeparateColor')
        sep.location = (-250, 0)
        nt.links.new(r_node.outputs['Color'], sep.inputs['Color'])
        mul = nt.nodes.new('ShaderNodeMath')
        mul.operation = 'MULTIPLY'
        mul.location = (-50, 0)
        mul.inputs[1].default_value = rough
        nt.links.new(sep.outputs['Green'], mul.inputs[0])
        nt.links.new(mul.outputs['Value'], bsdf.inputs['Roughness'])
    if normal_tex:
        n_node = tex_node(normal_tex, normal_repeat or repeat, True, -300)
        nmap = nt.nodes.new('ShaderNodeNormalMap')
        nmap.location = (-250, -300)
        nmap.inputs['Strength'].default_value = normal_strength
        nt.links.new(n_node.outputs['Color'], nmap.inputs['Color'])
        nt.links.new(nmap.outputs['Normal'], bsdf.inputs['Normal'])
    if emission:
        emission_rgba = srgb(emission) if isinstance(emission, str) else (*emission[:3], 1.0)
        bsdf.inputs['Emission Color'].default_value = emission_rgba
        bsdf.inputs['Emission Strength'].default_value = emission_strength
        if emission_tex and base_node:
            if emission_rgba[:3] == (1.0, 1.0, 1.0):
                nt.links.new(base_node.outputs['Color'], bsdf.inputs['Emission Color'])
            else:
                mix = nt.nodes.new('ShaderNodeMix')
                mix.data_type = 'RGBA'
                mix.blend_type = 'MULTIPLY'
                mix.location = (0, 250)
                mix.inputs['Factor'].default_value = 1.0
                nt.links.new(base_node.outputs['Color'], mix.inputs[6])
                mix.inputs[7].default_value = emission_rgba
                nt.links.new(mix.outputs[2], bsdf.inputs['Emission Color'])

    mat.use_backface_culling = not double_sided
    if alpha < 1.0 or alpha_tex:
        mat.surface_render_method = 'BLENDED'
    else:
        mat.surface_render_method = 'DITHERED'
    return mat


def build_materials():
    m = {}
    m['steel'] = make_material('M_Wall_Steel', rough=0.28, metal=0.85, base_tex='wall_steel_color', repeat=(4, 2),
                               normal_tex='wall_steel_normal', normal_strength=0.55, rough_tex='wall_steel_roughness')
    m['floor'] = make_material('M_Floor', rough=0.35, metal=0.18, base_tex='floor_color', repeat=(8, 2),
                               normal_tex='floor_normal', normal_strength=0.65, rough_tex='floor_roughness')
    m['plinth'] = make_material('M_Seat_Plinth', rough=0.35, metal=0.22, base_tex='floor_color', repeat=(8, 2),
                                normal_tex='floor_normal', normal_strength=0.40, rough_tex='floor_roughness')
    m['ceiling'] = make_material('M_Ceiling', color='dce0e7', rough=0.42, metal=0.25,
                                 normal_tex='wall_steel_normal', normal_strength=0.20, repeat=(4, 2))
    m['light'] = make_material('M_Ceiling_Light', rough=0.18, base_tex='ceiling_light_color',
                               emission='ffc882', emission_strength=2.8, emission_tex=True, double_sided=False)
    m['vent'] = make_material('M_Vent_Grille', rough=0.42, metal=0.80, base_tex='vent_grille_color', repeat=(2, 1))
    m['chrome'] = make_material('M_Chrome', color='dde1e8', rough=0.14, metal=0.96, double_sided=False)
    m['handle'] = make_material('M_Door_Handle', color='dce0e6', rough=0.20, metal=0.95, double_sided=False)
    m['titanium'] = make_material('M_Seat_Frame', color='2d323e', rough=0.32, metal=0.88, double_sided=False)
    m['rubber'] = make_material('M_Rubber', color='18181b', rough=0.88, metal=0.05, double_sided=False)
    m['glass'] = make_material('M_Glass', color='cde8fc', rough=0.04, metal=0.10, alpha=0.16)
    m['seat_yellow'] = make_material('M_Seat_Yellow', color='fba804', rough=0.15, normal_tex='fiberglass_normal',
                                     normal_strength=0.20, repeat=(4, 4), coat=1.0, double_sided=False)
    m['seat_orange'] = make_material('M_Seat_Orange', color='e94d0a', rough=0.15, normal_tex='fiberglass_normal',
                                     normal_strength=0.20, repeat=(4, 4), coat=1.0, double_sided=False)
    m['screen_video'] = make_material('M_Screen_Video', color='050607', rough=0.15, metal=0.05)
    m['screen_idle'] = make_material('M_Screen_Idle', color='0b0d10', rough=0.12, metal=0.10)
    m['decal'] = make_material('M_Decal_NoLean', color='000000', rough=0.9, base_tex='decal_no_lean',
                               emission='ffffff', emission_strength=1.0, emission_tex=True, alpha=0.95, alpha_tex=True)
    m['ext_white'] = make_material('M_Door_Ext_White', color='f4f6fa', rough=0.22, metal=0.08, coat=0.80,
                                   coat_rough=0.06, double_sided=False)
    m['ext_blue'] = make_material('M_Door_Ext_Blue', color='2ca0e6', rough=0.20, metal=0.12, coat=0.85,
                                  coat_rough=0.06, double_sided=False)
    m['ext_pin'] = make_material('M_Door_Ext_Pin', color='141822', rough=0.35, metal=0.80, double_sided=False)
    return m


def set_material(obj, mat):
    obj.data.materials.clear()
    obj.data.materials.append(mat)


# ---------------------------------------------------------------------------
# Двери
# ---------------------------------------------------------------------------
DOOR_SCALE = (0.635, 1.98, 0.038)  # three.js: ширина, высота, толщина створки
# Сторона A (платформа, z = +0.026) и сторона B (тоннель, z = -2.426, развернута на 180°).
# Для стороны B створки поменяны местами, чтобы ручки после разворота оставались у притвора.
DOORS = {
    'Door_Left_Photo':     ((-3.460, 0.99, 0.026), 0.0),
    'Door_Right_Photo':    ((-4.070, 0.99, 0.026), 0.0),
    'Door_Left_Photo_D2':  ((4.070, 0.99, 0.026), 0.0),
    'Door_Right_Photo_D2': ((3.460, 0.99, 0.026), 0.0),
    'Door_Left_Photo_D3':  ((-4.070, 0.99, -2.426), math.pi),
    'Door_Right_Photo_D3': ((-3.460, 0.99, -2.426), math.pi),
    'Door_Left_Photo_D4':  ((3.460, 0.99, -2.426), math.pi),
    'Door_Right_Photo_D4': ((4.070, 0.99, -2.426), math.pi),
}


def add_quad(name, mat, m_three_world, w, h, uv=True):
    """Прямоугольник w x h в плоскости XY (нормаль +Z) с мировой матрицей three.js."""
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    corners = [(-w / 2, -h / 2), (w / 2, -h / 2), (w / 2, h / 2), (-w / 2, h / 2)]
    verts = [bm.verts.new(C @ (m_three_world @ Vector((x, y, 0)))) for x, y in corners]
    face = bm.faces.new(verts)
    if uv:
        layer = bm.loops.layers.uv.new('UVMap')
        for loop, (u, v) in zip(face.loops, [(0, 0), (1, 0), (1, 1), (0, 1)]):
            loop[layer].uv = (u, v)
    bm.to_mesh(mesh)
    bm.free()
    mesh.materials.append(mat)
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def rect_minus_hole(x0, x1, y0, y1, hole):
    """Прямоугольник за вычетом выреза: до 4 прямоугольников (низ, верх, лево, право)."""
    hx0, hx1, hy0, hy1 = hole
    cy0, cy1 = max(y0, hy0), min(y1, hy1)
    if cy0 >= cy1 or hx0 >= x1 or hx1 <= x0:
        return [(x0, x1, y0, y1)]
    out = []
    if y0 < cy0:
        out.append((x0, x1, y0, cy0))
    if cy1 < y1:
        out.append((x0, x1, cy1, y1))
    if x0 < hx0:
        out.append((x0, hx0, cy0, cy1))
    if hx1 < x1:
        out.append((hx1, x1, cy0, cy1))
    return out


def build_door(name, pos, rot_y, mats):
    door = bpy.data.objects[name]
    children = list(door.children)
    # Локальные трансформации детей в пространстве three.js (до перестановки двери)
    door_bl_old = door.matrix_world.copy()
    child_local_three = {c.name: to_three(door_bl_old.inverted() @ c.matrix_world) for c in children}

    door_three = trs(pos, rot_y, DOOR_SCALE)
    door.matrix_world = to_blender(door_three)
    set_material(door, mats['steel'])

    parts = []
    for c in children:
        if 'Handle' in c.name:
            is_left = 'Left' in c.name
            local = trs((-0.3833 if is_left else 0.3833, -0.12, -0.45), 0.0, (0.075, 0.0909, 0.35))
            set_material(c, mats['handle'])
        else:
            local = child_local_three[c.name]
            set_material(c, mats['glass'] if 'Glass' in c.name else mats['rubber'])
        c.parent = None
        c.matrix_world = to_blender(door_three @ local)
        parts.append(c)

    # Остальные элементы задаются в «неотмасштабированной» системе створки
    door_unscaled = trs(pos, rot_y)
    # Наклейка «Не прислоняться»: внутренняя сторона стекла, текст читается из салона
    parts.append(add_quad(name + '_Decal', mats['decal'], door_unscaled @ trs((0, 0.38, -0.016), math.pi), 0.24, 0.06))
    # Наружная обшивка Alstom: белый низ, тёмный кант, голубой верх с вырезом под стекло.
    # Границы створки: x ±0.3175, y ±0.99; стекло с уплотнителем: x ±0.145, y -0.171..0.751.
    # Линия раздела (y = -0.04, 0.95 м от пола) совпадает с ливреей кузова.
    z = 0.021
    hw, split = 0.3175, -0.04
    hole = (-0.145, 0.145, -0.171, 0.751)
    bands = [('white', -0.99, split - 0.01), ('pin', split - 0.01, split + 0.01), ('blue', split + 0.01, 0.99)]
    i = 0
    for kind, y0, y1 in bands:
        for x0, x1, ry0, ry1 in rect_minus_hole(-hw, hw, y0, y1, hole):
            m = door_unscaled @ trs(((x0 + x1) / 2, (ry0 + ry1) / 2, z))
            parts.append(add_quad(f'{name}_Skin{i}', mats['ext_' + kind], m, x1 - x0, ry1 - ry0))
            i += 1

    # Объединяем створку в один объект и применяем масштаб/поворот (позиция остаётся в origin)
    bpy.ops.object.select_all(action='DESELECT')
    for p in parts:
        p.select_set(True)
    door.select_set(True)
    bpy.context.view_layer.objects.active = door
    bpy.ops.object.join()
    bpy.ops.object.transform_apply(location=False, rotation=True, scale=True)
    return door


# ---------------------------------------------------------------------------
# Сборка
# ---------------------------------------------------------------------------
def run():
    mats = build_materials()

    for name, (pos, rot_y) in DOORS.items():
        build_door(name, pos, rot_y, mats)

    assign = {
        'Subway_Wall_BrushedSteel_Merged': 'steel',
        'Subway_Floor_Merged': 'floor',
        'Subway_Seat_Plinths_Merged': 'plinth',
        'Subway_Ceiling': 'ceiling',
        'Subway_Ceiling_Lights_Merged': 'light',
        'Subway_Vent_Grilles_Merged': 'vent',
        'Subway_Chrome_Poles_Merged': 'chrome',
        'Subway_Titanium_Frames_Merged': 'titanium',
        'Subway_Rubber_Gaskets_Merged': 'rubber',
        'Subway_Static_Window_Glass_Merged': 'glass',
        'Subway_Seats_Yellow_Merged': 'seat_yellow',
        'Subway_Seats_Orange_Merged': 'seat_orange',
    }
    for obj_name, key in assign.items():
        set_material(bpy.data.objects[obj_name], mats[key])
    for i in range(1, 9):
        set_material(bpy.data.objects[f'Screen_{i}_Display'], mats['screen_video' if i <= 4 else 'screen_idle'])

    # Коллекции
    groups = {
        'Car_Shell': ['Subway_Wall_BrushedSteel_Merged', 'Subway_Floor_Merged', 'Subway_Ceiling',
                      'Subway_Vent_Grilles_Merged', 'Subway_Rubber_Gaskets_Merged', 'Subway_Static_Window_Glass_Merged',
                      'Subway_Titanium_Frames_Merged'],
        'Seats': ['Subway_Seats_Yellow_Merged', 'Subway_Seats_Orange_Merged', 'Subway_Seat_Plinths_Merged'],
        'Poles': ['Subway_Chrome_Poles_Merged'],
        'Lighting': ['Subway_Ceiling_Lights_Merged'],
        'Doors': list(DOORS),
        'Screens': [f'Screen_{i}_Display' for i in range(1, 9)],
    }
    root = bpy.context.scene.collection
    for col_name, names in groups.items():
        col = bpy.data.collections.get(col_name) or bpy.data.collections.new(col_name)
        if col.name not in root.children:
            root.children.link(col)
        for n in names:
            obj = bpy.data.objects[n]
            for c in list(obj.users_collection):
                c.objects.unlink(obj)
            col.objects.link(obj)

    # Удаляем старые материалы черновика
    for mat in list(bpy.data.materials):
        if mat.users == 0:
            bpy.data.materials.remove(mat)

    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND, relative_remap=True)
    return OUT_BLEND


if __name__ == '__main__':
    print(run())
