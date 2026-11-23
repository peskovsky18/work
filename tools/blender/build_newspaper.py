"""
Газета на кресле в вагоне: креативы и вайбкод-проекты (коллекция Newspaper -> newspaper.glb).

Таблоид, сложенный пополам, лежит на сиденье под экраном 4 (сторона A). Модель состоит
из двух половин, у каждой ось — по сгибу:
    News_Left  — полосы 1 (снаружи) и 2 (внутри); в сложенном виде повёрнута на 180°
                 вокруг сгиба и лежит сверху
    News_Right — полосы 3 (внутри) и 4 (снизу, на кресле)
Сайт раскрывает газету, поворачивая News_Left вокруг сгиба обратно в 0°.

Места под работы — отдельные плоскости News_Slot_F1 (первая полоса), News_Slot_C1..C3
(креативы, полоса 2), News_Slot_P1..P3 (проекты, полоса 3). Пока они показывают серые
блоки с той же текстуры страниц; сайт позже положит на них картинки работ.
Раскладка блоков берётся из newspaper_textures/news_layout.json
(создаёт tools/blender/generate_newspaper_textures.py).

Запуск (на обоих файлах сцены, как и другие build_*.py):
    blender -b assets/models/scene_prebake.blend --python tools/blender/build_newspaper.py
    blender -b assets/models/scene.blend --python tools/blender/build_newspaper.py
Экспорт только газеты:
    blender -b assets/models/scene.blend --python tools/blender/export_glb.py -- Newspaper
"""
import json
import math
import os

import random

import bmesh
import bpy
from mathutils import Vector

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
TEX_DIR = os.path.join(ROOT, 'assets', 'models', 'newspaper_textures')
LAYOUT = json.load(open(os.path.join(TEX_DIR, 'news_layout.json'), encoding='utf-8'))

W, H = LAYOUT['page_m']   # полоса 0.28 × 0.38 м
T = 0.0008                # толщина половины (8 листов газетной бумаги)
GAP = 0.0002              # зазор между сложенными половинами
SLOT_LIFT = 0.0005        # плоскости мест под работы над бумагой
NX, NY = 14, 18           # сетка половины: мелкая, чтобы изгиб по креслу был гладким

# Сиденье стороны A под экраном 4: x 2.46..2.90, ложемент y 0.18..0.44, верх ~0.445 м.
# Газета лежит сгибом к спинке, высота полосы — вдоль вагона, чуть повёрнута «небрежно».
SEAT_POSE = {'location': (2.68, 0.175), 'rotation_z': math.radians(90 + 3)}
SEAT_OBJECTS = ('Interior_Seats_Orange', 'Interior_Seats_Yellow')
CLEARANCE = 0.0012        # бумага над поверхностью сиденья
CRUMPLE = 0.0015          # лёгкая неровность бумаги в положении «на кресле»

COLLECTION = 'Newspaper'


def clear_previous():
    col = bpy.data.collections.get(COLLECTION)
    if col:
        for o in list(col.all_objects):
            data = o.data
            bpy.data.objects.remove(o, do_unlink=True)
            if data is not None and data.users == 0:
                bpy.data.meshes.remove(data)
        bpy.data.collections.remove(col)
    for m in list(bpy.data.materials):
        if m.name.startswith('M_News_') and m.users == 0:
            bpy.data.materials.remove(m)


def paper_material(name, filename):
    mat = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()
    out = nt.nodes.new('ShaderNodeOutputMaterial')
    bsdf = nt.nodes.new('ShaderNodeBsdfPrincipled')
    tex = nt.nodes.new('ShaderNodeTexImage')
    path = os.path.join(TEX_DIR, filename)
    img = bpy.data.images.load(path, check_existing=True)
    img.reload()
    try:
        img.filepath = bpy.path.relpath(path)
    except ValueError:
        pass
    tex.image = img
    nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    bsdf.inputs['Roughness'].default_value = 0.9
    for key in ('Specular IOR Level', 'Specular'):
        if key in bsdf.inputs:
            bsdf.inputs[key].default_value = 0.2
            break
    nt.links.new(bsdf.outputs['BSDF'], out.inputs['Surface'])
    out.location, bsdf.location, tex.location = (300, 0), (0, 0), (-400, 0)
    return mat


def add_face(bm, uv, verts, uvs, mat_index, normal_z=None, normal=None):
    """Грань с нужной стороной лицевой; UV привязаны к вершинам, поэтому разворот их не путает."""
    f = bm.faces.new(verts)
    f.material_index = mat_index
    f.normal_update()
    want = normal if normal is not None else (0, 0, normal_z)
    if f.normal.dot(want) < 0:
        f.normal_flip()
    by_vert = dict(zip(verts, uvs))
    for loop in f.loops:
        loop[uv].uv = by_vert[loop.vert]
    return f


def build_half(name, side, mats, col):
    """side = -1: левая половина (полосы 2 сверху, 1 снизу); +1: правая (3 сверху, 4 снизу)."""
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    xs = [side * W * i / NX for i in range(NX + 1)]
    ys = [-H / 2 + H * j / NY for j in range(NY + 1)]

    def uv_top(x, y):
        v = (y + H / 2) / H
        return ((x + W) / W * 0.5, v) if side < 0 else (0.5 + x / W * 0.5, v)

    def uv_bottom(x, y):
        v = (y + H / 2) / H
        return (-x / W * 0.5, v) if side < 0 else (0.5 + 0.5 * (W - x) / W, v)

    for z, uvf, nz, mi in ((0.0, uv_top, 1, 0), (-T, uv_bottom, -1, 1)):
        grid = [[bm.verts.new((x, y, z)) for y in ys] for x in xs]
        for i in range(NX):
            for j in range(NY):
                quad = [grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]]
                add_face(bm, uv, quad, [uvf(v.co.x, v.co.y) for v in quad], mi, normal_z=nz)

    # Кромки: обрез бумаги (тот же цвет бумаги — угол поля первой полосы)
    edge_uv = (0.004, 0.004)
    x_out = side * W
    corners = [(0, -H / 2), (x_out, -H / 2), (x_out, H / 2), (0, H / 2)]
    for k in range(4):
        (ax, ay), (bx, by) = corners[k], corners[(k + 1) % 4]
        quad = [bm.verts.new((ax, ay, 0)), bm.verts.new((bx, by, 0)), bm.verts.new((bx, by, -T)), bm.verts.new((ax, ay, -T))]
        mx, my = (ax + bx) / 2, (ay + by) / 2
        out_dir = (mx - x_out / 2, my, 0)
        add_face(bm, uv, quad, [edge_uv] * 4, 1, normal=out_dir)

    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for m in mats:
        me.materials.append(m)
    obj = bpy.data.objects.new(name, me)
    col.objects.link(obj)
    return obj


def build_slot(key, box, halves, mats, col):
    """Плоскость места под работу в координатах своей половины, UV — тот же участок страницы."""
    page = box['page']
    x0n, y0n, x1n, y1n = box['x0'], box['y0'], box['x1'], box['y1']
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    if page == 2:      # левая половина, сверху
        parent, mi, nz = halves['left'], 0, 1
        pos = lambda xn, yn: (-W + xn * W, H / 2 - yn * H, SLOT_LIFT)
        tex = lambda xn, yn: (0.5 * xn, 1 - yn)
    elif page == 3:    # правая половина, сверху
        parent, mi, nz = halves['right'], 0, 1
        pos = lambda xn, yn: (xn * W, H / 2 - yn * H, SLOT_LIFT)
        tex = lambda xn, yn: (0.5 + 0.5 * xn, 1 - yn)
    elif page == 1:    # левая половина, снизу (первая полоса)
        parent, mi, nz = halves['left'], 1, -1
        pos = lambda xn, yn: (-xn * W, H / 2 - yn * H, -T - SLOT_LIFT)
        tex = lambda xn, yn: (0.5 * xn, 1 - yn)
    else:
        raise ValueError(f'нет полосы {page} для места {key}')
    # Сетка, а не один квадрат: место под работу изгибается вместе с бумагой (см. add_drape)
    n = 6
    grid = [[(x0n + (x1n - x0n) * i / n, y0n + (y1n - y0n) * j / n) for j in range(n + 1)] for i in range(n + 1)]
    vg = [[bm.verts.new(pos(xn, yn)) for xn, yn in row] for row in grid]
    for i in range(n):
        for j in range(n):
            quad = [vg[i][j], vg[i + 1][j], vg[i + 1][j + 1], vg[i][j + 1]]
            uvs = [tex(*grid[a][b]) for a, b in ((i, j), (i + 1, j), (i + 1, j + 1), (i, j + 1))]
            add_face(bm, uv, quad, uvs, 0, normal_z=nz)
    me = bpy.data.meshes.new(f'News_Slot_{key}')
    bm.to_mesh(me)
    bm.free()
    me.materials.append(mats[mi])
    obj = bpy.data.objects.new(f'News_Slot_{key}', me)
    col.objects.link(obj)
    obj.parent = parent
    obj['news_page'] = page
    return obj


def seat_height(x, y, seats, depsgraph):
    """Высота сиденья под точкой (x, y) — луч сверху по сиденьям с модификаторами."""
    best = None
    for seat in seats:
        inv = seat.matrix_world.inverted()
        origin = inv @ Vector((x, y, 1.5))
        direction = (inv.to_3x3() @ Vector((0, 0, -1))).normalized()
        hit, loc, _n, _i = seat.ray_cast(origin, direction, depsgraph=depsgraph)
        if hit:
            z = (seat.matrix_world @ loc).z
            best = z if best is None else max(best, z)
    return best


def add_drape(objs, root):
    """Ключ формы Drape: газета прогибается по сиденью. Базовая форма плоская — в ней газету
    читают; на кресле сайт включает Drape. Все слои сдвигаются одинаково по вертикали в каждой
    точке, поэтому половины и места под работы не протыкают друг друга."""
    depsgraph = bpy.context.evaluated_depsgraph_get()
    seats = [bpy.data.objects[n].evaluated_get(depsgraph) for n in SEAT_OBJECTS if n in bpy.data.objects]
    rnd = random.Random(7)
    phase = [rnd.uniform(0, math.tau) for _ in range(4)]

    cx, cy = root.location.x, root.location.y
    h_ref = seat_height(cx + 0.0, cy + W / 2, seats, depsgraph)
    # Плоская газета нижней стороной на высоте центра сиденья
    root.location.z = h_ref + CLEARANCE + T
    bpy.context.view_layer.update()

    report = []
    for obj in objs:
        mw = obj.matrix_world.copy()
        inv3 = mw.inverted().to_3x3()
        obj.shape_key_add(name='Basis', from_mix=False)
        key = obj.shape_key_add(name='Drape', from_mix=False)
        worst = 0.0
        for v, kv in zip(obj.data.vertices, key.data):
            w = mw @ v.co
            h = seat_height(w.x, w.y, seats, depsgraph)
            if h is None:
                h = h_ref
            # Неровность бумаги: несколько пологих волн, у сгиба её почти нет
            lx, ly = (root.matrix_world.inverted() @ w).xy
            crumple = CRUMPLE * (math.sin(lx * 31 + phase[0]) * math.sin(ly * 23 + phase[1]) * 0.6
                                 + math.sin(lx * 13 + ly * 17 + phase[2]) * 0.4) * min(1.0, abs(lx) / 0.06)
            dz = (h - h_ref) + max(0.0, crumple)
            worst = max(worst, abs(h - h_ref))
            kv.co = v.co + inv3 @ Vector((0, 0, dz))
        key.value = 1.0   # в файле и в GLB газета по умолчанию лежит на кресле
        report.append((obj.name, round(worst * 1000, 1)))
    return report


def run():
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    clear_previous()
    col = bpy.data.collections.new(COLLECTION)
    bpy.context.scene.collection.children.link(col)

    mats = [paper_material('M_News_Spread', LAYOUT['textures']['spread']),
            paper_material('M_News_Cover', LAYOUT['textures']['cover'])]

    root = bpy.data.objects.new('Newspaper', None)
    root.empty_display_type = 'PLAIN_AXES'
    root.empty_display_size = 0.05
    col.objects.link(root)
    root.location = (*SEAT_POSE['location'], 0.45)
    root.rotation_euler = (0, 0, SEAT_POSE['rotation_z'])

    left = build_half('News_Left', -1, mats, col)
    right = build_half('News_Right', 1, mats, col)
    for half in (left, right):
        half.parent = root
    # Сложенная газета: левая половина перевёрнута через сгиб и лежит на правой
    left.location = (0, 0, GAP)
    left.rotation_euler = (0, math.pi, 0)

    halves = {'left': left, 'right': right}
    slots = [build_slot(k, box, halves, mats, col) for k, box in LAYOUT['slots'].items()]

    bpy.context.view_layer.update()
    drape = add_drape([left, right] + slots, root)
    bpy.ops.wm.save_mainfile()
    return {'objects': len(col.objects), 'slots': [s.name for s in slots],
            'root_z': round(root.location.z, 4), 'drape_mm': drape}


if __name__ == '__main__':
    print('NEWSPAPER', run())
