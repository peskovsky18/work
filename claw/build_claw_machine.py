"""
Автомат с клешнёй для нового портфолио: шарики-капсулы вместо игрушек, в прозрачных капсулах лежат работы.

Собирает сцену с нуля и сохраняет claw/claw_machine.blend (+ claw/claw_machine.glb без студии).
Запуск (из корня проекта):
    /Applications/Blender.app/Contents/MacOS/Blender -b --factory-startup --python claw/build_claw_machine.py
С рендером проверочных кадров в claw/renders/:
    ... --python claw/build_claw_machine.py -- --render

Текстуры (печать, экран терминала, карты) сначала: python3 claw/generate_textures.py

Единицы: метры, Z вверх, фронт автомата смотрит в -Y. Низ глухой с печатью, пульт полкой спереди,
справа на пульте терминал оплаты картой. При входе на сайт выбирают одну из трёх карт (категория работ),
карта определяет, какие шары выпадают: у каждой категории своя цветовая семья капсул.
Имена, на которые будет опираться сайт:
    Gantry_Crossbar (едет по Y) -> Claw_Carriage (едет по X) -> Claw_Cable (тянется по Z, origin сверху) + Claw
    Capsule_Project_<slug> — капсулы с работами (свойства work_slug, category)
    Capsule_U_### — капсулы-наполнители (свойство category)
    Card_video / Card_creative / Card_vibecode — карты выбора, Terminal / Terminal_Screen — терминал оплаты
"""
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Euler, Matrix, Vector

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
RENDER = '--render' in ARGS

random.seed(7)

# ---------------------------------------------------------------- размеры
W = 0.86          # ширина корпуса (X)
D = 0.86          # глубина (Y)
P = 0.04          # сечение алюминиевого профиля
Z_PLINTH = 0.10   # верх цоколя
Z_MID = 0.86      # низ средней рамы
Z_DECK = 0.90     # игровое поле
Z_TOP = 1.82      # низ верхней рамы
Z_ROOF = 1.86     # верх рамы
IN = W / 2 - P    # внутренний полупролёт = 0.39
GLASS_T = 0.006
CHUTE = -0.15     # приёмник приза: x,y < CHUTE (передний левый угол)
CHUTE_TOP = Z_DECK + 0.24

WORKS = [  # из js/projects-data.js (пока есть только видео)
    ('swag', 'Свэг', 'assets/images/swag_thumb.jpg', 'video'),
    ('mini-swag', 'Мини свэг', 'assets/images/mini_swag_thumb.jpg', 'video'),
    ('night-tunnel', 'Ночной тоннель', 'assets/images/tunnel_thumb.jpg', 'video'),
    ('industry', 'Индустрия', 'assets/images/industry_thumb.jpg', 'video'),
]
# категория = карта при входе = цветовая семья капсул
CATEGORIES = {
    'video': [('Magenta', '#ff2bd6'), ('Lilac', '#9a6bff'), ('Pink', '#ff5c9d')],
    'creative': [('Orange', '#ff8a3d'), ('Yellow', '#ffd23f'), ('Red', '#f23a4f')],
    'vibecode': [('Mint', '#3ee0b0'), ('Teal', '#19b5b5'), ('Sky', '#4aa8ff')],
}
TEX = os.path.join(HERE, 'textures')


def srgb(h):
    h = h.lstrip('#')
    return tuple((int(h[i:i + 2], 16) / 255) ** 2.2 for i in (0, 2, 4)) + (1.0,)


# ---------------------------------------------------------------- сцена
def reset():
    if bpy.app.background:
        bpy.ops.wm.read_factory_settings(use_empty=True)
    else:
        # в открытом Blender не сбрасываем интерфейс и аддоны, только данные сцены
        sc = bpy.context.scene
        if sc.rigidbody_world:
            bpy.ops.rigidbody.world_remove()
        for o in list(bpy.data.objects):
            bpy.data.objects.remove(o)
        for c in list(bpy.data.collections):
            bpy.data.collections.remove(c)
        for block in (bpy.data.meshes, bpy.data.curves, bpy.data.materials, bpy.data.images, bpy.data.lights,
                      bpy.data.cameras, bpy.data.worlds):
            for d in list(block):
                block.remove(d)
    COLS.clear()
    MATS.clear()


COLS = {}


def col(name, parent=None):
    if name in COLS:
        return COLS[name]
    c = bpy.data.collections.new(name)
    (parent.children if parent else bpy.context.scene.collection.children).link(c)
    COLS[name] = c
    return c


# ---------------------------------------------------------------- материалы
MATS = {}


def principled(name, base='#ffffff', metal=0.0, rough=0.5, transmission=0.0, ior=1.45, coat=0.0,
               emission=None, strength=0.0, alpha=1.0, shadow_transparent=False):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = srgb(base) if isinstance(base, str) else base
    b.inputs['Metallic'].default_value = metal
    b.inputs['Roughness'].default_value = rough
    b.inputs['Transmission Weight'].default_value = transmission
    b.inputs['IOR'].default_value = ior
    b.inputs['Coat Weight'].default_value = coat
    b.inputs['Alpha'].default_value = alpha
    if emission:
        b.inputs['Emission Color'].default_value = srgb(emission)
        b.inputs['Emission Strength'].default_value = strength
    if shadow_transparent:
        # Cycles не пропускает теневые лучи через преломляющее стекло: подменяем на прозрачность только для теней
        out = nt.nodes['Material Output']
        lp = nt.nodes.new('ShaderNodeLightPath')
        tr = nt.nodes.new('ShaderNodeBsdfTransparent')
        mix = nt.nodes.new('ShaderNodeMixShader')
        nt.links.new(lp.outputs['Is Shadow Ray'], mix.inputs[0])
        nt.links.new(b.outputs[0], mix.inputs[1])
        nt.links.new(tr.outputs[0], mix.inputs[2])
        nt.links.new(mix.outputs[0], out.inputs['Surface'])
    MATS[name] = m
    return m


def led_material():
    """Светодиодные ленты: точки пурпурный/фиолетовый/синий/розовый по мировой позиции, как у автомата на фото."""
    m = bpy.data.materials.new('LED_Strip')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Strength'].default_value = 4.0
    geo = nt.nodes.new('ShaderNodeNewGeometry')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    add = nt.nodes.new('ShaderNodeMath')
    add.operation = 'ADD'
    add2 = nt.nodes.new('ShaderNodeMath')
    add2.operation = 'ADD'
    mul = nt.nodes.new('ShaderNodeMath')
    mul.operation = 'MULTIPLY'
    mul.inputs[1].default_value = 22.0   # ~4.5 см на цикл из четырёх цветов
    fr = nt.nodes.new('ShaderNodeMath')
    fr.operation = 'FRACT'
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    cr = ramp.color_ramp
    cr.interpolation = 'CONSTANT'
    stops = [(0.0, '#ff2bd6'), (0.25, '#8a3bff'), (0.5, '#2f6bff'), (0.75, '#ff4fa3')]
    cr.elements[0].position, cr.elements[0].color = stops[0][0], srgb(stops[0][1])
    cr.elements[1].position, cr.elements[1].color = stops[1][0], srgb(stops[1][1])
    for pos, c in stops[2:]:
        e = cr.elements.new(pos)
        e.color = srgb(c)
    nt.links.new(geo.outputs['Position'], sep.inputs[0])
    nt.links.new(sep.outputs['X'], add.inputs[0])
    nt.links.new(sep.outputs['Y'], add.inputs[1])
    nt.links.new(add.outputs[0], add2.inputs[0])
    nt.links.new(sep.outputs['Z'], add2.inputs[1])
    nt.links.new(add2.outputs[0], mul.inputs[0])
    nt.links.new(mul.outputs[0], fr.inputs[0])
    nt.links.new(fr.outputs[0], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], em.inputs['Color'])
    nt.links.new(em.outputs[0], out.inputs['Surface'])
    MATS['LED_Strip'] = m
    return m


def print_material():
    """Яркая печать на боках пульта (как наклейки на автомате с фото)."""
    m = bpy.data.materials.new('Print_Panel')
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    b.inputs['Roughness'].default_value = 0.35
    b.inputs['Coat Weight'].default_value = 0.6
    tc = nt.nodes.new('ShaderNodeTexCoord')
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 5.0
    noise.inputs['Detail'].default_value = 3.0
    noise.inputs['Distortion'].default_value = 1.5
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    cr = ramp.color_ramp
    cr.interpolation = 'CONSTANT'
    cols = ['#2a0a5e', '#ff2bd6', '#ffb000', '#1fd1ff', '#ff4b2b', '#5a1aff']
    cr.elements[0].color = srgb(cols[0])
    cr.elements[1].position = 1.0
    cr.elements[1].color = srgb(cols[-1])
    for i, c in enumerate(cols[1:-1], 1):
        e = cr.elements.new(i / (len(cols) - 1) * 0.9 + 0.02)
        e.color = srgb(c)
    nt.links.new(tc.outputs['Object'], noise.inputs['Vector'])
    nt.links.new(noise.outputs['Fac'], ramp.inputs['Fac'])
    nt.links.new(ramp.outputs['Color'], b.inputs['Base Color'])
    MATS['Print_Panel'] = m
    return m


def image_material(name, path, emission=1.1, rough=0.3, coat=0.5):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    b = nt.nodes['Principled BSDF']
    b.inputs['Roughness'].default_value = rough
    b.inputs['Coat Weight'].default_value = coat
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = bpy.data.images.load(path if os.path.isabs(path) else os.path.join(ROOT, path), check_existing=True)
    nt.links.new(tex.outputs['Color'], b.inputs['Base Color'])
    # лёгкое свечение, чтобы постер читался через пластик
    nt.links.new(tex.outputs['Color'], b.inputs['Emission Color'])
    b.inputs['Emission Strength'].default_value = emission
    MATS[name] = m
    return m, tex.image


def build_materials():
    principled('Aluminum', '#c9ccd1', metal=1.0, rough=0.28)
    principled('Chrome', '#e8eaee', metal=1.0, rough=0.08)
    principled('Graphite', '#1b1d22', rough=0.45, coat=0.3)
    principled('Graphite_Matte', '#111216', rough=0.8)
    principled('Glass', '#f4f8ff', rough=0.02, transmission=1.0, ior=1.5, shadow_transparent=True)
    principled('Acrylic', '#eef6ff', rough=0.04, transmission=1.0, ior=1.49, shadow_transparent=True)
    principled('Smoked_Acrylic', '#3a3f4a', rough=0.08, transmission=0.85, ior=1.49, shadow_transparent=True)
    principled('Deck', '#f2f2f4', rough=0.25, coat=0.4)
    principled('Carriage_Blue', '#1f6fe0', rough=0.35, coat=0.5)
    principled('Rubber', '#0c0c0e', rough=0.7)
    principled('Joystick_Red', '#e01b24', rough=0.2, coat=1.0)
    principled('Button_Amber', '#ff9a00', rough=0.25, coat=1.0, emission='#ff9a00', strength=0.5)
    principled('Amber_Trim', '#ffb000', rough=0.3, coat=0.6)
    principled('Ceiling_Light', '#ffffff', emission='#fff4e6', strength=6.0)
    principled('Marquee_Panel', '#2a0a5e', rough=0.4, emission='#5a1aff', strength=1.6)
    principled('Marquee_Text', '#ffffff', emission='#fff1d6', strength=8.0)
    principled('Floor', '#26282d', rough=0.32)
    principled('Gold', '#e6b34a', metal=1.0, rough=0.25)
    principled('Card_Back', '#15161a', rough=0.35, coat=0.6)
    principled('Gloss_Black', '#08090b', rough=0.45, coat=0.25)
    principled('LED_Green', '#2bff88', emission='#2bff88', strength=6.0)
    image_material('Print_Front', os.path.join(TEX, 'print_front.png'), emission=0.15, rough=0.35, coat=0.8)
    image_material('Print_Side', os.path.join(TEX, 'print_side.png'), emission=0.15, rough=0.35, coat=0.8)
    image_material('Terminal_Screen', os.path.join(TEX, 'terminal_screen.png'), emission=4.0, rough=0.1, coat=1.0)
    for slug in CATEGORIES:
        image_material(f'Card_{slug}', os.path.join(TEX, f'card_{slug}.png'), emission=0.2, rough=0.3, coat=1.0)
    led_material()
    print_material()
    # пластик капсул
    principled('Cap_White', '#f5f3ee', rough=0.18, coat=1.0)
    # тонкий прозрачный пластик: блик + прозрачность (двойная оболочка со стеклом давала зеркало и прятала постер)
    clear = principled('Cap_Clear', '#ffffff', rough=0.04, coat=1.0, alpha=0.14)
    clear.surface_render_method = 'BLENDED'
    # копия для нижней половины: отдельный материал = отдельная часть меша, капсула раскрывается на сайте
    principled('Cap_Clear_Bottom', '#ffffff', rough=0.04, coat=1.0, alpha=0.14).surface_render_method = 'BLENDED'
    for name, hexc in CAP_COLORS:
        principled(f'Cap_{name}', hexc, rough=0.2, coat=1.0)


CAP_COLORS = [c for fam in CATEGORIES.values() for c in fam]


# ---------------------------------------------------------------- геометрия
def link(obj, collection):
    collection.objects.link(obj)
    return obj


def mesh_obj(name, bm, mat, collection, smooth_angle=35):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    if smooth_angle:
        me.shade_smooth()
        me.set_sharp_from_angle(angle=math.radians(smooth_angle))
    if mat:
        mats = mat if isinstance(mat, (list, tuple)) else [mat]
        for m in mats:
            me.materials.append(MATS[m] if isinstance(m, str) else m)
    return link(bpy.data.objects.new(name, me), collection)


def box(name, size, loc, mat, collection, bevel=0.004, segs=3):
    """Коробка с фаской: size — полные размеры, loc — центр."""
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    if bevel > 0:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=min(bevel, min(size) * 0.45), segments=segs,
                        profile=0.5, affect='EDGES', clamp_overlap=True)
    o = mesh_obj(name, bm, mat, collection)
    o.location = loc
    return o


def box_span(name, lo, hi, mat, collection, bevel=0.004, segs=3):
    size = [h - l for l, h in zip(lo, hi)]
    loc = [(l + h) / 2 for l, h in zip(lo, hi)]
    return box(name, size, loc, mat, collection, bevel, segs)


def cylinder(name, r, h, loc, mat, collection, segs=32, bevel=0.0, r_top=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segs, radius1=r,
                          radius2=r if r_top is None else r_top, depth=h)
    if bevel:
        rim = [e for e in bm.edges if not e.is_manifold or len(e.link_faces) == 2 and
               abs(e.link_faces[0].normal.dot(e.link_faces[1].normal)) < 0.5]
        bmesh.ops.bevel(bm, geom=rim, offset=bevel, segments=3, profile=0.5, affect='EDGES', clamp_overlap=True)
    o = mesh_obj(name, bm, mat, collection)
    o.location = loc
    return o


def sphere(name, r, loc, mat, collection, segs=32, rings=16):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs, v_segments=rings, radius=r)
    o = mesh_obj(name, bm, mat, collection, smooth_angle=0)
    o.data.shade_smooth()
    o.location = loc
    return o


def curve_obj(name, points, bevel, mat, collection, closed=False, kind='POLY', res=6):
    cu = bpy.data.curves.new(name, 'CURVE')
    cu.dimensions = '3D'
    cu.bevel_depth = bevel
    cu.bevel_resolution = 3
    cu.resolution_u = res
    cu.use_fill_caps = True
    if kind == 'BEZIER':
        sp = cu.splines.new('BEZIER')
        sp.bezier_points.add(len(points) - 1)
        for bp, p in zip(sp.bezier_points, points):
            bp.co = p
            bp.handle_left_type = bp.handle_right_type = 'AUTO'
    else:
        sp = cu.splines.new('POLY')
        sp.points.add(len(points) - 1)
        for pt, p in zip(sp.points, points):
            pt.co = (*p, 1.0)
    sp.use_cyclic_u = closed
    cu.materials.append(MATS[mat])
    return link(bpy.data.objects.new(name, cu), collection)


def image_plane(name, w, h, mat, collection, loc=(0, 0, 0), rot=(0, 0, 0)):
    """Плоскость w x h в локальной XY (смотрит в +Z) с UV 0..1."""
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5)
    uv = bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
        for lp in f.loops:
            lp[uv].uv = (lp.vert.co.x + 0.5, lp.vert.co.y + 0.5)
    for v in bm.verts:
        v.co = Vector((v.co.x * w, v.co.y * h, 0))
    o = mesh_obj(name, bm, mat, collection, smooth_angle=0)
    o.location, o.rotation_euler = loc, rot
    return o


def prism_x(name, profile, x0, x1, mat, collection, bevel=0.008):
    """Призма: профиль (y, z) против часовой, вытянут по X от x0 до x1."""
    bm = bmesh.new()
    a = [bm.verts.new((x0, y, z)) for y, z in profile]
    b = [bm.verts.new((x1, y, z)) for y, z in profile]
    bm.faces.new(list(reversed(a)))
    bm.faces.new(b)
    n = len(profile)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new((a[i], a[j], b[j], b[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if bevel:
        bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=3, profile=0.5, affect='EDGES',
                        clamp_overlap=True)
    return mesh_obj(name, bm, mat, collection)


def rounded_card(name, w, h, t, r, front_mat, back_mat, collection):
    """Банковская карта: скруглённый прямоугольник, лицевая сторона (+Z) с UV под текстуру."""
    bm = bmesh.new()
    pts = []
    for cx, cy, a0 in ((w / 2 - r, h / 2 - r, 0), (-w / 2 + r, h / 2 - r, 90), (-w / 2 + r, -h / 2 + r, 180),
                       (w / 2 - r, -h / 2 + r, 270)):
        for k in range(7):
            a = math.radians(a0 + k * 15)
            pts.append((cx + r * math.cos(a), cy + r * math.sin(a)))
    top = bm.faces.new([bm.verts.new((x, y, t / 2)) for x, y in pts])
    bot = bm.faces.new([bm.verts.new((x, y, -t / 2)) for x, y in reversed(pts)])
    tv, bv = top.verts, list(reversed(bot.verts))
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        f = bm.faces.new((bv[i], bv[j], tv[j], tv[i]))
        f.material_index = 1
    bot.material_index = 1
    uv = bm.loops.layers.uv.new('UVMap')
    for f in bm.faces:
        for lp in f.loops:
            lp[uv].uv = (lp.vert.co.x / w + 0.5, lp.vert.co.y / h + 0.5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_obj(name, bm, [front_mat, back_mat], collection, smooth_angle=50)


def parent_keep(child, parent):
    bpy.context.view_layer.update()   # у новых объектов matrix_world ещё не посчитан
    child.parent = parent
    child.matrix_parent_inverse = parent.matrix_world.inverted()


# ---------------------------------------------------------------- корпус
def build_cabinet(c):
    h = W / 2
    # цоколь
    box_span('Plinth', (-h + 0.006, -h + 0.006, 0.02), (h - 0.006, h - 0.006, Z_PLINTH), 'Graphite', c, bevel=0.01)
    for sx in (-1, 1):
        for sy in (-1, 1):
            cylinder(f'Foot_{sx}{sy}', 0.025, 0.02, (sx * (h - 0.06), sy * (h - 0.06), 0.01), 'Rubber', c, bevel=0.003)
    # глухой нижний корпус: каркас внутри, снаружи печать между профилями
    box_span('Lower_Body', (-IN, -IN, Z_PLINTH), (IN, IN, Z_MID), 'Graphite_Matte', c, bevel=0)
    zc, ph = (Z_PLINTH + P + Z_MID) / 2, Z_MID - Z_PLINTH - P
    po = h - 0.008
    image_plane('Print_Front', 2 * IN, ph, 'Print_Front', c, (0, -po, zc), (math.pi / 2, 0, 0))
    image_plane('Print_Right', 2 * IN, ph, 'Print_Side', c, (po, 0, zc), (math.pi / 2, 0, math.pi / 2))
    image_plane('Print_Back', 2 * IN, ph, 'Print_Side', c, (0, po, zc), (math.pi / 2, 0, math.pi))
    image_plane('Print_Left', 2 * IN, ph, 'Print_Side', c, (-po, 0, zc), (math.pi / 2, 0, -math.pi / 2))
    # дверца выдачи приза под приёмником (слева внизу на фронте)
    dx = (-IN + CHUTE) / 2
    dz0, dz1 = 0.2, 0.42
    box_span('Prize_Door_Housing', (dx - 0.105, -h - 0.012, dz0), (dx + 0.105, -po, dz1), 'Graphite', c, bevel=0.008)
    box_span('Prize_Door_Flap', (dx - 0.085, -h - 0.017, dz0 + 0.02), (dx + 0.085, -h - 0.011, dz1 - 0.03),
             'Smoked_Acrylic', c, bevel=0.003)
    cylinder('Prize_Door_Hinge', 0.006, 0.18, (dx, -h - 0.018, dz1 - 0.028), 'Chrome', c).rotation_euler = (
        0, math.pi / 2, 0)
    # метки для сайта: над приёмником (куда клешня несёт шар) и перед дверцей (откуда шар выкатывается)
    for name, loc in (('Mark_Chute', ((-IN + CHUTE) / 2, (-IN + CHUTE) / 2, CHUTE_TOP + 0.3)),
                      ('Mark_PrizeDoor', (dx, -h - 0.04, (dz0 + dz1) / 2))):
        e = bpy.data.objects.new(name, None)
        e.empty_display_size = 0.05
        e.location = loc
        c.objects.link(e)
    box_span('Prize_Door_Label', (dx - 0.06, -h - 0.014, dz1 - 0.022), (dx + 0.06, -h - 0.011, dz1 - 0.008),
             'Amber_Trim', c, bevel=0.002)

    # вертикальные профили
    for sx in (-1, 1):
        for sy in (-1, 1):
            x, y = sx * (h - P / 2), sy * (h - P / 2)
            box(f'Post_{"R" if sx > 0 else "L"}{"B" if sy > 0 else "F"}', (P, P, Z_ROOF - Z_PLINTH),
                (x, y, (Z_ROOF + Z_PLINTH) / 2), 'Aluminum', c, bevel=0.006)
    # горизонтальные профили: низ, середина, верх
    for tag, z0, z1 in (('Low', Z_PLINTH, Z_PLINTH + P), ('Mid', Z_MID, Z_DECK), ('Top', Z_TOP, Z_ROOF)):
        for sy, nm in ((-1, 'F'), (1, 'B')):
            box(f'Rail_{tag}_{nm}', (W - 2 * P, P, z1 - z0), (0, sy * (h - P / 2), (z0 + z1) / 2), 'Aluminum', c,
                bevel=0.005)
        for sx, nm in ((-1, 'L'), (1, 'R')):
            box(f'Rail_{tag}_{nm}', (P, D - 2 * P, z1 - z0), (sx * (h - P / 2), 0, (z0 + z1) / 2), 'Aluminum', c,
                bevel=0.005)

    # стёкла + светодиоды по периметру каждого стекла с внешней стороны
    leds = col('LED', c)
    sides = {'F': (0, -1), 'B': (0, 1), 'L': (-1, 0), 'R': (1, 0)}
    for tier, z0, z1 in (('Lower', Z_PLINTH + P, Z_MID), ('Upper', Z_DECK, Z_TOP)):
        for nm, (sx, sy) in sides.items():
            along_x = sx == 0
            off = h - P / 2
            if along_x:
                lo = (-IN, sy * off - GLASS_T / 2, z0)
                hi = (IN, sy * off + GLASS_T / 2, z1)
            else:
                lo = (sx * off - GLASS_T / 2, -IN, z0)
                hi = (sx * off + GLASS_T / 2, IN, z1)
            if tier == 'Upper':
                box_span(f'Glass_{tier}_{nm}', lo, hi, 'Glass', c, bevel=0.0015, segs=1)
            # светодиодная рамка
            t, wd, ins = 0.003, 0.007, 0.006
            o = off + P / 2 + 0.0005  # чуть снаружи профиля, на внешней плоскости
            if along_x:
                y0, y1 = (sy * o, sy * o + sy * t)
                y0, y1 = min(y0, y1), max(y0, y1)
                strips = [((-IN + ins, y0, z0 + ins), (IN - ins, y1, z0 + ins + wd)),
                          ((-IN + ins, y0, z1 - ins - wd), (IN - ins, y1, z1 - ins)),
                          ((-IN + ins, y0, z0 + ins), (-IN + ins + wd, y1, z1 - ins)),
                          ((IN - ins - wd, y0, z0 + ins), (IN - ins, y1, z1 - ins))]
            else:
                x0, x1 = (sx * o, sx * o + sx * t)
                x0, x1 = min(x0, x1), max(x0, x1)
                strips = [((x0, -IN + ins, z0 + ins), (x1, IN - ins, z0 + ins + wd)),
                          ((x0, -IN + ins, z1 - ins - wd), (x1, IN - ins, z1 - ins)),
                          ((x0, -IN + ins, z0 + ins), (x1, -IN + ins + wd, z1 - ins)),
                          ((x0, IN - ins - wd, z0 + ins), (x1, IN - ins, z1 - ins))]
            for i, (a, b) in enumerate(strips):
                box_span(f'LED_{tier}_{nm}_{i}', a, b, 'LED_Strip', leds, bevel=0.001, segs=1)
    # LED по фронту цоколя
    box_span('LED_Plinth_F', (-h + 0.03, -h + 0.002, 0.075), (h - 0.03, -h + 0.008, 0.08), 'LED_Strip', leds,
             bevel=0.001, segs=1)

    # игровое поле с проёмом под приёмник
    zt = Z_DECK - 0.015
    box_span('Deck_A', (CHUTE, -IN, zt), (IN, IN, Z_DECK), 'Deck', c, bevel=0.002)
    box_span('Deck_B', (-IN, CHUTE, zt), (CHUTE, IN, Z_DECK), 'Deck', c, bevel=0.002)

    # приёмник: прозрачные стенки над полем и шахта вниз до дверцы
    t = 0.006
    box_span('Chute_Wall_X', (CHUTE - t, -IN, Z_DECK), (CHUTE, CHUTE, CHUTE_TOP), 'Acrylic', c, bevel=0.0015, segs=1)
    box_span('Chute_Wall_Y', (-IN, CHUTE - t, Z_DECK), (CHUTE, CHUTE, CHUTE_TOP), 'Acrylic', c, bevel=0.0015, segs=1)
    box_span('Chute_Rim_X', (CHUTE - t - 0.003, -IN, CHUTE_TOP), (CHUTE + 0.003, CHUTE + 0.003, CHUTE_TOP + 0.012),
             'Amber_Trim', c, bevel=0.003)
    box_span('Chute_Rim_Y', (-IN, CHUTE - t - 0.003, CHUTE_TOP), (CHUTE + 0.003, CHUTE + 0.003, CHUTE_TOP + 0.012),
             'Amber_Trim', c, bevel=0.003)

    # крыша, подсветка внутри, вывеска
    box_span('Roof', (-h, -h, Z_ROOF), (h, h, Z_ROOF + 0.016), 'Graphite', c, bevel=0.004)
    box_span('Ceiling_Light', (-IN + 0.02, -IN + 0.02, Z_ROOF - 0.006), (IN - 0.02, IN - 0.02, Z_ROOF - 0.001),
             'Ceiling_Light', c, bevel=0.0)
    mz0, mz1 = Z_ROOF + 0.016, Z_ROOF + 0.25
    box_span('Marquee_Box', (-h, -h, mz0), (h, -h + 0.14, mz1), 'Graphite', c, bevel=0.01)
    box_span('Marquee_Panel', (-h + 0.025, -h - 0.002, mz0 + 0.025), (h - 0.025, -h + 0.02, mz1 - 0.025),
             'Marquee_Panel', c, bevel=0.004)
    box_span('LED_Marquee', (-h + 0.012, -h - 0.004, mz0 + 0.012), (h - 0.012, -h + 0.0, mz0 + 0.017), 'LED_Strip',
             leds, bevel=0.001, segs=1)
    box_span('LED_Marquee_Top', (-h + 0.012, -h - 0.004, mz1 - 0.017), (h - 0.012, -h + 0.0, mz1 - 0.012),
             'LED_Strip', leds, bevel=0.001, segs=1)
    cu = bpy.data.curves.new('Marquee_Text', 'FONT')
    cu.body = 'PESKOVSKII'
    cu.align_x = 'CENTER'
    cu.align_y = 'CENTER'
    cu.size = 0.105
    cu.space_character = 1.08
    cu.extrude = 0.004
    cu.bevel_depth = 0.0012
    cu.materials.append(MATS['Marquee_Text'])
    txt = link(bpy.data.objects.new('Marquee_Text', cu), c)
    txt.location = (0, -h - 0.008, (mz0 + mz1) / 2)
    txt.rotation_euler = (math.pi / 2, 0, 0)


# ---------------------------------------------------------------- портал с клешнёй
def build_gantry(c):
    zr = Z_TOP - 0.035
    for sx, nm in ((-1, 'L'), (1, 'R')):
        box_span(f'Gantry_Rail_{nm}', (sx * 0.365 - 0.012, -IN, zr - 0.012), (sx * 0.365 + 0.012, IN, zr + 0.012),
                 'Aluminum', c, bevel=0.003)
    yc = 0.0     # позиция поперечины (сайт двигает по Y)
    xc = -0.03   # позиция каретки (сайт двигает по X)
    zc = zr - 0.03
    cross = box_span('Gantry_Crossbar', (-0.365, yc - 0.022, zc - 0.014), (0.365, yc + 0.022, zc + 0.014),
                     'Aluminum', c, bevel=0.004)
    for sx in (-1, 1):
        o = box_span(f'Gantry_Truck_{"R" if sx > 0 else "L"}', (sx * 0.365 - 0.02, yc - 0.04, zc + 0.008),
                     (sx * 0.365 + 0.02, yc + 0.04, zr - 0.012), 'Graphite', c, bevel=0.004)
        parent_keep(o, cross)
    zk = zc - 0.06
    car = box_span('Claw_Carriage', (xc - 0.065, yc - 0.055, zk - 0.04), (xc + 0.065, yc + 0.055, zk + 0.04),
                   'Carriage_Blue', c, bevel=0.012)
    parent_keep(car, cross)
    mot = cylinder('Claw_Motor', 0.022, 0.05, (xc + 0.04, yc + 0.06, zk), 'Chrome', c, bevel=0.003)
    mot.rotation_euler = (math.pi / 2, 0, 0)
    parent_keep(mot, car)
    lens = cylinder('Claw_Carriage_Eye', 0.012, 0.006, (xc - 0.03, yc - 0.056, zk + 0.01), 'Graphite_Matte', c)
    lens.rotation_euler = (math.pi / 2, 0, 0)
    parent_keep(lens, car)
    for sx in (-1, 1):
        wheel = cylinder(f'Claw_Wheel_{sx}', 0.012, 0.01, (xc + sx * 0.045, yc, zc - 0.022), 'Rubber', c)
        wheel.rotation_euler = (math.pi / 2, 0, 0)
        parent_keep(wheel, car)

    # трос: origin сверху, длину на сайте меняем масштабом по Z
    z_top = zk - 0.04
    z_hub = 1.43
    L = z_top - z_hub
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=12, radius1=0.0025, radius2=0.0025, depth=L)
    bmesh.ops.translate(bm, verts=bm.verts, vec=(0, 0, -L / 2))
    cable = mesh_obj('Claw_Cable', bm, 'Chrome', c, smooth_angle=60)
    cable.location = (xc, yc, z_top)
    parent_keep(cable, car)
    # витой провод питания рядом с тросом, как на фото
    pts = []
    turns, rr = 16, 0.011
    n = turns * 14
    for i in range(n + 1):
        a = i / n * turns * 2 * math.pi
        z = z_top - 0.01 - (L - 0.03) * i / n
        pts.append((xc + 0.018 + rr * math.cos(a), yc + rr * math.sin(a), z))
    top = Vector((xc + 0.018, yc, z_top - 0.01))   # origin сверху: на сайте провод тянется вместе с тросом
    coil = curve_obj('Claw_Coil', [Vector(p) - top for p in pts], 0.0022, 'Rubber', c, res=1)
    coil.location = top
    parent_keep(coil, car)

    # клешня
    claw = cylinder('Claw', 0.028, 0.05, (xc, yc, z_hub - 0.025), 'Chrome', c, bevel=0.004)
    parent_keep(claw, car)
    cap = cylinder('Claw_Cap', 0.012, 0.02, (xc, yc, z_hub + 0.008), 'Chrome', c, r_top=0.006)
    parent_keep(cap, claw)
    plate = cylinder('Claw_Plate', 0.042, 0.01, (xc, yc, z_hub - 0.055), 'Graphite', c, bevel=0.003)
    parent_keep(plate, claw)
    zb = z_hub - 0.06
    for i in range(3):
        a = math.radians(90 + i * 120)
        ca, sa = math.cos(a), math.sin(a)
        prof = [(0.03, 0.0), (0.058, -0.02), (0.08, -0.07), (0.074, -0.12), (0.05, -0.155), (0.036, -0.158)]
        pts = [Vector((xc + r * ca, yc + r * sa, zb + z)) for r, z in prof]
        # origin лапы в шарнире: на сайте лапа сжимается поворотом вокруг касательной оси
        prong = curve_obj(f'Claw_Prong_{i}', [p - pts[0] for p in pts], 0.0055, 'Chrome', c, kind='BEZIER', res=10)
        prong.location = pts[0]
        parent_keep(prong, claw)
        knuckle = sphere(f'Claw_Knuckle_{i}', 0.009, pts[0], 'Graphite', c, segs=16, rings=8)
        parent_keep(knuckle, claw)
        tip = sphere(f'Claw_Tip_{i}', 0.0075, pts[-1], 'Rubber', c, segs=16, rings=8)
        parent_keep(tip, prong)
    return dict(x=xc, y=yc)


# ---------------------------------------------------------------- пульт
CONSOLE = dict(y_front=-0.62, z_front_top=0.875, z_front_bot=0.80, z_back_top=0.93, z_back_bot=0.62)


def console_top(x, v):
    """Матрица точки на наклонной крышке пульта: v=0 передний край, 1 задний (у стекла)."""
    h = W / 2
    yf, yb = CONSOLE['y_front'], -h
    zf, zb = CONSOLE['z_front_top'], CONSOLE['z_back_top']
    tilt = math.atan2(zb - zf, yb - yf)
    p = Vector((x, yf + (yb - yf) * v, zf + (zb - zf) * v))
    return Matrix.Translation(p) @ Euler((tilt, 0, 0)).to_matrix().to_4x4()


def on(obj, mtx):
    obj.matrix_basis = mtx @ obj.matrix_basis
    return obj


def build_controls(c):
    h = W / 2
    k = CONSOLE
    yf = k['y_front']
    prof = [(-h, k['z_back_bot']), (-h, k['z_back_top']), (yf, k['z_front_top']), (yf, k['z_front_bot'])]
    prism_x('Console_Body', prof, -h, h, 'Graphite', c, bevel=0.01)
    # накладки: передняя печатная полоса и алюминиевая кромка
    box_span('Console_Trim', (-h + 0.01, yf - 0.006, k['z_front_top'] - 0.012), (h - 0.01, yf + 0.004,
             k['z_front_top'] + 0.002), 'Aluminum', c, bevel=0.003)
    box_span('LED_Console_Front', (-h + 0.02, yf - 0.004, k['z_front_bot'] + 0.012), (h - 0.02, yf + 0.002,
             k['z_front_bot'] + 0.018), 'LED_Strip', COLS['LED'], bevel=0.001, segs=1)
    deck = box('Console_Deck', (W - 0.05, 0.16, 0.004), (0, 0, 0.0), 'Graphite_Matte', c, bevel=0.002)
    on(deck, console_top(0, 0.5))

    # джойстик
    m = console_top(-0.24, 0.52)
    on(cylinder('Joystick_Base', 0.038, 0.008, (0, 0, 0.004), 'Chrome', c, bevel=0.002), m)
    on(cylinder('Joystick_Boot', 0.024, 0.03, (0, 0, 0.022), 'Rubber', c, r_top=0.01), m)
    on(cylinder('Joystick_Shaft', 0.0055, 0.1, (0, 0, 0.08), 'Chrome', c), m)
    on(sphere('Joystick_Ball', 0.025, (0, 0, 0.14), 'Joystick_Red', c), m)
    # большая кнопка «взять»
    m = console_top(-0.075, 0.5)
    on(cylinder('Button_Ring', 0.036, 0.012, (0, 0, 0.006), 'Chrome', c, bevel=0.003), m)
    on(cylinder('Button', 0.029, 0.016, (0, 0, 0.014), 'Button_Amber', c, bevel=0.007), m)

    # терминал оплаты картой: стойка с наклонённым назад экраном
    tw, td, th = 0.13, 0.055, 0.2
    base = console_top(0.3, 0.55)
    on(box('Terminal_Pedestal', (0.1, 0.06, 0.03), (0, 0, 0.01), 'Aluminum', c, bevel=0.006), base)
    mt = Matrix.Translation(base.to_translation() + Vector((0, 0, 0.022))) @ Euler((-0.22, 0, 0)).to_matrix().to_4x4()
    term = on(box('Terminal', (tw, td, th), (0, 0, th / 2), 'Gloss_Black', c, bevel=0.012), mt)
    sw, sh = 0.096, 0.12
    # экран стоит на 2.5 мм перед рамкой, рамка на 1.5 мм перед корпусом: без общих плоскостей (иначе мерцает)
    on(image_plane('Terminal_Screen', sw, sh, 'Terminal_Screen', c, (0, -td / 2 - 0.004, th - 0.016 - sh / 2),
                   (math.pi / 2, 0, 0)), mt)
    on(box('Terminal_Bezel', (sw + 0.01, 0.002, sh + 0.01), (0, -td / 2 - 0.0005, th - 0.016 - sh / 2),
           'Graphite_Matte', c, bevel=0.002), mt)
    on(box('Terminal_Slot', (0.085, 0.004, 0.007), (0, -td / 2 - 0.0015, 0.03), 'Graphite_Matte', c, bevel=0.002), mt)
    for i, mat in enumerate(['LED_Green', 'Button_Amber', 'Button_Amber', 'LED_Green']):
        on(sphere(f'Terminal_LED_{i}', 0.0032, (-0.024 + i * 0.016, -td / 2 - 0.0005, 0.05), mat, c, 12, 6), mt)
    term['role'] = 'card_payment'


def build_cards(c):
    """Три карты выбора при входе (карта = категория работ) стоят веером в подставке на пульте."""
    cw, chh, t = 0.0856, 0.054, 0.0008
    stand = console_top(0.11, 0.42)
    on(box('Card_Stand', (0.21, 0.05, 0.012), (0, 0.004, 0.006), 'Aluminum', c, bevel=0.004), stand)
    tilt = math.atan2(CONSOLE['z_back_top'] - CONSOLE['z_front_top'], -W / 2 - CONSOLE['y_front'])
    lean = math.radians(16)   # наклон карт назад от вертикали
    for i, slug in enumerate(CATEGORIES):
        o = rounded_card(f'Card_{slug}', cw, chh, t, 0.0032, f'Card_{slug}', 'Card_Back', c)
        chip = box(f'Card_{slug}_Chip', (0.011, 0.0085, 0.0006), (-0.029, -0.002, t / 2 + 0.0002), 'Gold', c,
                   bevel=0.0012, segs=2)
        chip.parent = o
        o['category'] = slug
        a = i - 1
        # следующая карта правее и ближе: у каждой видно левую часть с названием
        o.location = (a * 0.056, 0.012 - i * 0.011, 0.012 + chh / 2 * math.cos(lean) + i * 0.004)
        o.rotation_euler = (math.pi / 2 - lean - tilt, math.radians(a * 4), math.radians(-a * 3))
        on(o, stand)


# ---------------------------------------------------------------- капсулы
R_SIZES = (0.060, 0.066)


def capsule_mesh(name, r, mats, clear=False):
    """Шарик-капсула: верх и низ по материалам 0/1, поясок-шов материал 2."""
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=28, v_segments=14, radius=r)
    for f in bm.faces:
        f.material_index = 0 if f.calc_center_median().z > 0 else 1
    band = bmesh.ops.create_cone(bm, cap_ends=False, segments=28, radius1=r * 1.025, radius2=r * 1.025,
                                 depth=r * 0.2)
    for f in {f for v in band['verts'] for f in v.link_faces}:
        f.material_index = 2
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    me.shade_smooth()
    for m in mats:
        me.materials.append(MATS[m])
    return me


def simulate(regions, colliders, frames=260):
    """Физика: роняем прокси-шары в коробки-коллайдеры и возвращаем, где они улеглись."""
    sc = bpy.context.scene
    tmp = bpy.data.collections.new('_sim')
    sc.collection.children.link(tmp)
    bpy.ops.rigidbody.world_add()
    rbw = sc.rigidbody_world
    rbw.substeps_per_frame = 20
    rbw.solver_iterations = 20
    rbw.point_cache.frame_start = 1
    rbw.point_cache.frame_end = frames + 5
    sc.frame_start, sc.frame_end = 1, frames + 5

    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    walls = []
    for i, (lo, hi) in enumerate(colliders):
        o = box_span(f'_col{i}', lo, hi, None, tmp, bevel=0)
        walls.append(o)
        o.select_set(True)
    bpy.context.view_layer.objects.active = walls[0]
    bpy.ops.rigidbody.objects_add(type='PASSIVE')
    for o in walls:
        o.rigid_body.collision_shape = 'BOX'
        o.rigid_body.friction = 0.6
        o.rigid_body.collision_margin = 0.0
        o.select_set(False)

    balls = []
    for key, pos, r in regions:
        bm = bmesh.new()
        bmesh.ops.create_icosphere(bm, subdivisions=2, radius=r)
        me = bpy.data.meshes.new('_ball')
        bm.to_mesh(me)
        bm.free()
        o = link(bpy.data.objects.new('_ball', me), tmp)
        o.location = pos
        o.select_set(True)
        balls.append((key, o, r))
    bpy.context.view_layer.objects.active = balls[0][1]
    bpy.ops.rigidbody.objects_add(type='ACTIVE')
    for _, o, r in balls:
        rb = o.rigid_body
        rb.collision_shape = 'SPHERE'
        rb.mass = 0.02
        rb.friction = 0.45
        rb.restitution = 0.25
        rb.linear_damping = 0.15
        rb.angular_damping = 0.4
        rb.collision_margin = 0.0
        o.select_set(False)

    for f in range(1, frames + 1):
        sc.frame_set(f)
    dg = bpy.context.evaluated_depsgraph_get()
    result = [(key, o.evaluated_get(dg).matrix_world.copy(), r) for key, o, r in balls]

    bpy.ops.rigidbody.world_remove()
    for o in list(tmp.objects):
        me = o.data
        bpy.data.objects.remove(o)
        bpy.data.meshes.remove(me)
    bpy.data.collections.remove(tmp)
    sc.frame_set(1)
    return result


def spawn_grid(z0, layers, avoid_chute=True, step=0.15):
    pts = []
    n = int((2 * IN - 0.14) / step) + 1
    off = -(n - 1) * step / 2
    for k in range(layers):
        for i in range(n):
            for j in range(n):
                x = off + i * step + random.uniform(-0.012, 0.012) + (0.03 if k % 2 else 0)
                y = off + j * step + random.uniform(-0.012, 0.012) + (0.03 if k % 2 else 0)
                x = max(-IN + 0.07, min(IN - 0.07, x))
                y = max(-IN + 0.07, min(IN - 0.07, y))
                if avoid_chute and x < CHUTE + 0.075 and y < CHUTE + 0.075:
                    continue
                pts.append(Vector((x, y, z0 + k * step)))
    return pts


def build_capsules(c_upper, c_proj):
    wall = 0.2
    inner = h_in = (W / 2 - P / 2) - GLASS_T / 2   # внутренняя плоскость стекла
    chute_block = ((-IN - 0.05, -IN - 0.05, 0), (CHUTE, CHUTE, 2.5))

    def walls(z0, z1):
        return [((-inner - wall, -inner - wall, z0), (-inner, inner + wall, z1)),
                ((inner, -inner - wall, z0), (inner + wall, inner + wall, z1)),
                ((-inner - wall, -inner - wall, z0), (inner + wall, -inner, z1)),
                ((-inner - wall, inner, z0), (inner + wall, inner + wall, z1))]

    # верх: слой капсул на игровом поле, капсулы с работами падают последними, сверху
    upper_pts = spawn_grid(Z_DECK + 0.1, 3)
    regions = [(('U', i), p, random.choice(R_SIZES)) for i, p in enumerate(upper_pts)]
    proj_spots = [(0.02, -0.22), (0.24, -0.06), (-0.22, 0.08), (0.06, 0.2)]
    zp = Z_DECK + 0.1 + 3 * 0.15 + 0.05
    for i, (x, y) in enumerate(proj_spots):
        regions.append((('P', i), Vector((x, y, zp + i * 0.02)), 0.07))
    cols = walls(0, 2.5) + [((-1, -1, Z_DECK - 0.2), (1, 1, Z_DECK)), chute_block]
    upper = simulate(regions, cols)

    # общие меши: цвет x размер
    meshes = {}
    for name, _ in CAP_COLORS:
        for r in R_SIZES:
            meshes[(name, r)] = capsule_mesh(f'Capsule_{name}_{int(r * 1000)}', r, [f'Cap_{name}', 'Cap_White', 'Cap_White'])

    def place(key, mtx, r, collection):
        tier, i = key
        cat = random.choice(list(CATEGORIES))
        name = random.choice(CATEGORIES[cat])[0]
        o = link(bpy.data.objects.new(f'Capsule_{tier}_{i:03d}', meshes[(name, r)]), collection)
        o.matrix_world = mtx
        o['category'] = cat
        return o

    proj = {}
    for key, m, r in upper:
        if key[0] == 'P':
            proj[key[1]] = m
        else:
            place(key, m, r, c_upper)

    for i, (slug, title, img, cat) in enumerate(WORKS):
        m = proj[i]
        loc = m.to_translation()
        me = capsule_mesh(f'Capsule_Project_{slug}', 0.07, ['Cap_Clear', 'Cap_Clear_Bottom', f'Cap_{CATEGORIES[cat][i % 3][0]}'], clear=True)
        o = link(bpy.data.objects.new(f'Capsule_Project_{slug}', me), c_proj)
        o.location = loc
        # постер внутри смотрит вперёд, с лёгким наклоном
        o.rotation_euler = Euler((math.radians(90 + random.uniform(-25, 10)), random.uniform(-0.3, 0.3),
                                  random.uniform(-0.5, 0.5)))
        o['work_slug'] = slug
        o['work_title'] = title
        o['category'] = cat
        mat, image = image_material(f'Poster_{slug}', img)
        aspect = image.size[0] / image.size[1]
        cw = 0.112
        chh = cw / aspect
        bm = bmesh.new()
        bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=0.5)
        uv = bm.loops.layers.uv.new('UVMap')
        for f in bm.faces:
            for lp in f.loops:
                lp[uv].uv = (lp.vert.co.x + 0.5, lp.vert.co.y + 0.5)
        for v in bm.verts:
            v.co = Vector((v.co.x * cw, v.co.y * chh, 0))
        bmesh.ops.solidify(bm, geom=list(bm.faces), thickness=0.0012)
        card = mesh_obj(f'Poster_{slug}', bm, mat, c_proj, smooth_angle=30)
        card.parent = o
        card['work_slug'] = slug


# ---------------------------------------------------------------- студия и рендер
def look_at(obj, target):
    d = Vector(target) - obj.location
    obj.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


def build_studio(c):
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=12)
    mesh_obj('Studio_Floor', bm, 'Floor', c, smooth_angle=0)
    # циклорама сзади
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=1, y_segments=1, size=6)
    wall = mesh_obj('Studio_Wall', bm, 'Floor', c, smooth_angle=0)
    wall.location = (0, 3.5, 3)
    wall.rotation_euler = (math.pi / 2, 0, 0)

    def area(name, loc, target, power, size, color=(1, 1, 1)):
        li = bpy.data.lights.new(name, 'AREA')
        li.energy = power
        li.size = size
        li.color = color
        o = link(bpy.data.objects.new(name, li), c)
        o.location = loc
        o.visible_camera = False
        look_at(o, target)
        return o

    for o in (area('Key', (-2.2, -2.4, 3.0), (0, 0, 1.0), 900, 2.0, (1.0, 0.95, 0.9)),
              area('Fill', (2.6, -1.6, 1.6), (0, 0, 1.0), 260, 2.5, (0.85, 0.9, 1.0))):
        o.visible_glossy = False   # иначе софтбоксы белыми листами отражаются в стёклах
    area('Rim', (0.8, 2.8, 2.6), (0, 0, 1.2), 500, 1.5, (0.9, 0.7, 1.0)).visible_transmission = False
    li = bpy.data.lights.new('Inside', 'AREA')
    li.energy = 60
    li.size = 0.7
    o = link(bpy.data.objects.new('Inside', li), c)
    o.location = (0, 0, Z_ROOF - 0.02)

    world = bpy.data.worlds.new('World')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.018, 0.018, 0.024, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0
    bpy.context.scene.world = world

    def cam(name, loc, target, lens):
        cd = bpy.data.cameras.new(name)
        cd.lens = lens
        o = link(bpy.data.objects.new(name, cd), c)
        o.location = loc
        look_at(o, target)
        return o

    hero = cam('Cam_Hero', (-1.75, -2.75, 1.55), (0.08, 0, 1.02), 38)
    cam('Cam_Front', (0.0, -3.2, 1.25), (0.08, 0, 1.08), 40)
    cam('Cam_Close', (-0.32, -1.05, 1.58), (0.0, 0.0, 1.12), 32)
    cam('Cam_Console', (0.62, -1.55, 1.28), (0.12, -0.6, 0.98), 42)
    bpy.context.scene.camera = hero


def setup_render():
    sc = bpy.context.scene
    sc.render.engine = 'CYCLES'
    prefs = bpy.context.preferences.addons['cycles'].preferences
    try:
        prefs.compute_device_type = 'METAL'
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        sc.cycles.device = 'GPU'
    except Exception as e:  # noqa
        print('GPU unavailable:', e)
    sc.cycles.samples = 160
    sc.cycles.use_denoising = True
    sc.cycles.max_bounces = 16
    sc.cycles.transmission_bounces = 16
    sc.cycles.transparent_max_bounces = 24
    sc.cycles.glossy_bounces = 6
    sc.cycles.caustics_reflective = False
    sc.cycles.caustics_refractive = False
    sc.render.resolution_x = 1080
    sc.render.resolution_y = 1440
    sc.render.film_transparent = False
    sc.view_settings.view_transform = 'AgX'
    sc.view_settings.look = 'AgX - Medium High Contrast'
    if '--fast' in ARGS:
        sc.cycles.samples = 24
        sc.render.resolution_percentage = 50


def render_all():
    sc = bpy.context.scene
    out = os.path.join(HERE, 'renders')
    os.makedirs(out, exist_ok=True)
    shots = [('Cam_Hero', 1080, 1440), ('Cam_Front', 1080, 1440), ('Cam_Close', 1440, 1080),
             ('Cam_Console', 1440, 1080)]
    only = [a for a in ARGS if a.startswith('Cam_')]
    for name, w, h in shots:
        if only and name not in only:
            continue
        sc.camera = bpy.data.objects[name]
        sc.render.resolution_x, sc.render.resolution_y = w, h
        sc.render.filepath = os.path.join(out, name.replace('Cam_', '').lower() + '.png')
        bpy.ops.render.render(write_still=True)
        print('rendered', sc.render.filepath)


def curves_to_mesh(collections):
    dg = bpy.context.evaluated_depsgraph_get()
    for c in collections:
        for o in list(c.all_objects):
            if o.type not in ('CURVE', 'FONT'):
                continue
            me = bpy.data.meshes.new_from_object(o.evaluated_get(dg))
            me.name = o.name
            new = bpy.data.objects.new(o.name + '_m', me)
            for coll in o.users_collection:
                coll.objects.link(new)
            new.matrix_world = o.matrix_world.copy()
            parent, kids = o.parent, list(o.children)
            name = o.name
            bpy.data.objects.remove(o)
            new.name = name
            if parent:
                new.parent = parent
                new.matrix_parent_inverse = Matrix.Identity(4)
                new.matrix_world = new.matrix_world  # уже в мире
            for k in kids:
                k.parent = new


def export_glb(root_col):
    view_layer = bpy.context.view_layer
    for lc in view_layer.layer_collection.children:
        lc.exclude = lc.collection != root_col
    bpy.ops.export_scene.gltf(filepath=os.path.join(HERE, 'claw_machine.glb'), export_format='GLB',
                              export_yup=True, export_apply=True, export_cameras=False, export_lights=False,
                              export_extras=True, export_image_format='WEBP', export_image_quality=82,
                              use_active_collection=False)
    for lc in view_layer.layer_collection.children:
        lc.exclude = False


def main():
    reset()
    build_materials()
    machine = col('ClawMachine')
    build_cabinet(col('Cabinet', machine))
    build_gantry(col('Gantry', machine))
    build_controls(col('Controls', machine))
    caps = col('Capsules', machine)
    build_capsules(col('Capsules_Upper', caps), col('Capsules_Projects', caps))
    build_cards(col('Cards', machine))
    build_studio(col('Studio'))
    setup_render()
    bpy.ops.file.pack_all()
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(HERE, 'claw_machine.blend'))
    if RENDER:
        render_all()
    if not bpy.app.background:
        show_in_viewport()


def show_in_viewport():
    for window in bpy.context.window_manager.windows:
        for area in window.screen.areas:
            if area.type != 'VIEW_3D':
                continue
            space = area.spaces.active
            space.shading.type = 'MATERIAL'
            space.overlay.show_relationship_lines = False
            space.region_3d.view_perspective = 'CAMERA'
            area.tag_redraw()


if __name__ == '__main__':
    main()
