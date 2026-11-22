"""
Улучшение эскалатора спуска в scene.blend (коллекция Escalator).

Заменяет: поручни (сплошная резиновая лента C-профиля по плавной траектории —
горизонталь площадок, скруглённые переходы в наклон, разворотные петли на концах),
глухие стальные балюстрады под поручнями (стеклянные панели со стальной окантовкой),
добавляет алюминиевые входные плиты площадок и рифление ступеней картами нормалей.
Тоннель, рёбра, свет, декинг, тумбы и ступени остаются.

Координаты Blender: x — поперёк эскалатора (ось ленты x = -3.765), y — вдоль
(верх y ≈ -18, низ y ≈ -4.8), z — вверх. Уклон 30°.

Запуск:  blender -b assets/models/scene.blend --python tools/blender/build_escalator.py
"""
import math
import os

import bmesh
import bpy
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__))
_h = {'__name__': 'interior_helpers'}
exec(compile(open(os.path.join(HERE, 'build_train_interior.py')).read(), 'build_train_interior.py', 'exec'), _h)
add_box, make_object, planar_uv, add_bevel, mat = _h['add_box'], _h['make_object'], _h['planar_uv'], _h['add_bevel'], _h['mat']
_m = {'__name__': 'material_helpers'}
exec(compile(open(os.path.join(HERE, 'build_subway.py')).read(), 'build_subway.py', 'exec'), _m)

HANDRAIL_X = (-4.725, -2.800)
STEP_X = (-4.28, -3.25)
Y_BOTTOM, Z_BOTTOM = -4.51, 0.99          # начало наклона поручня внизу (верх поручня)
Y_TOP, Z_TOP = -18.03, 8.82               # конец наклона наверху
Y_END_BOTTOM, Y_END_TOP = -3.25, -19.10   # концы горизонтальных участков (петли)
FILLET = 0.7
LOOP_R = 0.13
GLASS_DROP = 0.07                         # стекло начинается ниже верха поручня
GLASS_HEIGHT = 0.86
NEW_PREFIX = 'EscX_'


def remove_old():
    for name in ('Esc_Handrail',):
        obj = bpy.data.objects.get(name)
        if obj:
            bpy.data.objects.remove(obj, do_unlink=True)
    # Глухие балюстрады под поручнями удаляем, юбки у ступеней оставляем
    bal = bpy.data.objects.get('Esc_Balustrade')
    if bal:
        bm = bmesh.new()
        bm.from_mesh(bal.data)
        kill = [f for f in bm.faces if any(abs(f.calc_center_median().x - hx) < 0.07 for hx in HANDRAIL_X)]
        bmesh.ops.delete(bm, geom=kill, context='FACES')
        bm.to_mesh(bal.data)
        bm.free()
    for obj in [o for o in bpy.data.objects if o.name.startswith(NEW_PREFIX)]:
        bpy.data.objects.remove(obj, do_unlink=True)


# --- Траектория поручня (y, z) -------------------------------------------------------
def arc(cy, cz, r, a0, a1, n):
    return [(cy + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)), cz + r * math.sin(math.radians(a0 + (a1 - a0) * i / n)))
            for i in range(n + 1)]


def fillet(p_prev, p_corner, p_next, r, n=10):
    """Скругление угла ломаной радиусом r (в плоскости yz)."""
    a = Vector((p_prev[0] - p_corner[0], p_prev[1] - p_corner[1])).normalized()
    b = Vector((p_next[0] - p_corner[0], p_next[1] - p_corner[1])).normalized()
    ang = math.acos(max(-1.0, min(1.0, a.dot(b))))
    d = r / math.tan(ang / 2)
    s = Vector(p_corner) + a * d
    e = Vector(p_corner) + b * d
    bis = (a + b).normalized()
    c = Vector(p_corner) + bis * (r / math.sin(ang / 2))
    a0 = math.degrees(math.atan2(s.y - c.y, s.x - c.x))
    a1 = math.degrees(math.atan2(e.y - c.y, e.x - c.x))
    if a1 - a0 > 180:
        a1 -= 360
    if a0 - a1 > 180:
        a1 += 360
    return arc(c.x, c.y, r, a0, a1, n)


def handrail_path():
    """Верх ленты: петля сверху, горизонталь, наклон, горизонталь, петля снизу."""
    top_corner = (Y_TOP, Z_TOP)
    bot_corner = (Y_BOTTOM, Z_BOTTOM)
    top_end = (Y_END_TOP, Z_TOP)
    bot_end = (Y_END_BOTTOM, Z_BOTTOM)
    # верхняя петля: лента выходит из-под балюстрады и огибает барабан
    path = arc(Y_END_TOP, Z_TOP - LOOP_R, LOOP_R, -90, -270, 12)
    path += fillet(top_end, top_corner, bot_corner, FILLET)
    path += fillet(top_corner, bot_corner, bot_end, FILLET)
    path += arc(Y_END_BOTTOM, Z_BOTTOM - LOOP_R, LOOP_R, 90, -90, 12)
    clean = []
    for p in path:
        if not clean or (Vector(p) - Vector(clean[-1])).length > 1e-4:
            clean.append(p)
    return clean


def sweep(bm, x, path, profile, closed_path=False):
    """Протяжка профиля (u — поперёк по x, v — по нормали к пути в плоскости yz)."""
    rings = []
    n = len(path)
    for i, (y, z) in enumerate(path):
        p_prev = Vector(path[max(i - 1, 0)])
        p_next = Vector(path[min(i + 1, n - 1)])
        t = (p_next - p_prev).normalized()
        nrm = Vector((-t.y, t.x))                     # нормаль в плоскости yz (налево от хода)
        ring = [bm.verts.new((x + u, y + nrm.x * v, z + nrm.y * v)) for u, v in profile]
        rings.append(ring)
    m = len(profile)
    for i in range(n - 1):
        for j in range(m):
            k = (j + 1) % m
            bm.faces.new([rings[i][j], rings[i][k], rings[i + 1][k], rings[i + 1][j]])
    bm.faces.new(list(reversed(rings[0])))
    bm.faces.new(rings[-1])


def handrail_profile():
    """C-профиль резинового поручня (ширина 0.08, высота 0.035), скруглённые кромки."""
    w, h = 0.040, 0.035
    # верх скруглён, низ с губами C-профиля
    top = [(w * math.cos(math.radians(a)), -h * 0.45 + h * 0.45 * math.sin(math.radians(a))) for a in range(0, 181, 15)]
    lips = [(-w, -h), (-w + 0.008, -h), (-w + 0.008, -h + 0.008), (w - 0.008, -h + 0.008), (w - 0.008, -h), (w, -h)]
    return top + lips


def build_handrails(col):
    bm = bmesh.new()
    path = handrail_path()
    for x in HANDRAIL_X:
        sweep(bm, x, path, handrail_profile())
    obj = make_object(NEW_PREFIX + 'Handrails', bm, [mat('M_Esc_Handrail')], col, smooth=True)
    obj.data.set_sharp_from_angle(angle=math.radians(50))
    planar_uv(obj)


def build_glass(col):
    """Стеклянные панели балюстрады между поручнем и декингом + стальная окантовка снизу."""
    _m['TEX_DIR'] = os.path.join(HERE, '..', '..', 'assets', 'models', 'escalator_textures')
    _m['TEX_REL'] = '//escalator_textures/'
    _m['make_material']('M_Esc_Glass', color='e8f2f8', rough=0.05, metal=0.0, alpha=0.18)
    path = handrail_path()
    # только участок между петлями
    body = [p for p in path if Y_END_TOP + 0.05 < p[0] < Y_END_BOTTOM - 0.05 and p[1] > Z_BOTTOM - 0.03]
    upper = [(y, z - GLASS_DROP) for y, z in body]
    lower = [(y, z - GLASS_DROP - GLASS_HEIGHT) for y, z in body]
    glass = bmesh.new()
    frame = bmesh.new()
    for x in HANDRAIL_X:
        top = [glass.verts.new((x, y, z)) for y, z in upper]
        bot = [glass.verts.new((x, y, z)) for y, z in lower]
        for i in range(len(body) - 1):
            glass.faces.new([bot[i], bot[i + 1], top[i + 1], top[i]])
        # нижняя окантовка: стальной профиль 4×6 см вдоль низа стекла
        sweep(frame, x, [(y, z + 0.03) for y, z in lower], [(-0.02, -0.03), (0.02, -0.03), (0.02, 0.03), (-0.02, 0.03)])
    g = make_object(NEW_PREFIX + 'Balustrade_Glass', glass, [mat('M_Esc_Glass')], col, recalc=False)
    planar_uv(g)
    f = make_object(NEW_PREFIX + 'Balustrade_Frame', frame, [mat('M_Esc_Chrome_Trim')], col)
    planar_uv(f)


def build_landing_plates(col):
    bm = bmesh.new()
    add_box(bm, STEP_X[0] - 0.05, STEP_X[1] + 0.05, -4.36, -3.30, 0.0, 0.012)       # нижняя площадка
    add_box(bm, STEP_X[0] - 0.05, STEP_X[1] + 0.05, -19.40, -18.04, 7.62, 7.632)    # верхняя площадка
    obj = make_object(NEW_PREFIX + 'Landing_Plates', bm, [mat('M_Esc_Tread')], col)
    planar_uv(obj, 1.03, 1.03)
    add_bevel(obj, 0.004, 1)


def add_normal_map(material, image_name, strength):
    """Добавляет карту нормалей к готовому материалу (с тем же маппингом, что у цвета)."""
    nt = material.node_tree
    bsdf = next(n for n in nt.nodes if n.type == 'BSDF_PRINCIPLED')
    for n in [n for n in nt.nodes if n.name.startswith('Cleat')]:
        nt.nodes.remove(n)
    base = next((n for n in nt.nodes if n.type == 'TEX_IMAGE' and n.outputs['Color'].links
                 and any(l.to_socket == bsdf.inputs['Base Color'] for l in n.outputs['Color'].links)), None)
    img = bpy.data.images.load(os.path.join(HERE, '..', '..', 'assets', 'models', 'escalator_textures', image_name + '.png'),
                               check_existing=True)
    img.filepath = '//escalator_textures/' + image_name + '.png'
    img.colorspace_settings.name = 'Non-Color'
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.name = 'Cleat_Normal_Tex'
    tex.image = img
    nmap = nt.nodes.new('ShaderNodeNormalMap')
    nmap.name = 'Cleat_Normal_Map'
    nmap.inputs['Strength'].default_value = strength
    if base and base.inputs['Vector'].links:
        nt.links.new(base.inputs['Vector'].links[0].from_socket, tex.inputs['Vector'])
    nt.links.new(tex.outputs['Color'], nmap.inputs['Color'])
    nt.links.new(nmap.outputs['Normal'], bsdf.inputs['Normal'])


def run():
    remove_old()
    col = bpy.data.collections['Escalator_Parts']
    build_handrails(col)
    build_glass(col)
    build_landing_plates(col)
    add_normal_map(mat('M_Esc_Tread'), 'esc_step_tread_normal', 1.2)
    add_normal_map(mat('M_Esc_Riser'), 'esc_step_riser_normal', 1.0)
    bpy.ops.wm.save_mainfile()
    return sorted((o.name, len(o.data.polygons)) for o in bpy.data.objects if o.name.startswith(NEW_PREFIX))


if __name__ == '__main__':
    print('BUILT', run())
