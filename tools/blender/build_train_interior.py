"""
Пересборка салона вагона чистой геометрией (коллекция Train/Interior в scene.blend).

Удаляет старую «коробочную» геометрию салона (|x| < 5.78) и строит заново:
борта с проёмами дверей и окон, галтель и потолок, торцевые стены, пол с порогами,
плинтусы с решётками, формованные сиденья, поручни, светильник, рамки экранов.
Двери (Door_*), экраны (Screen_N_Display), торцевые двери и межвагонные переходы
остаются как есть. Координаты Blender: x — вдоль вагона, y — поперёк
(0 — борт A у платформы, 2.40 — борт B), z — вверх. Размеры совпадают с прежней
моделью, чтобы не сломать камеру, Free Room и раскладку экранов.

Запуск:  blender -b assets/models/scene.blend --python tools/blender/build_train_interior.py
"""
import math

import bmesh
import bpy
from mathutils import Vector

# --- Раскладка вагона (метры) ---------------------------------------------------
X_END = 5.80                 # внутренние плоскости торцевых стен
W = 2.40                     # ширина салона
H_WALL = 1.98                # высота вертикальной части борта
H_CEIL = 2.29                # высота потолка
COVE = 0.30                  # вынос галтели от борта
T_WALL = 0.04                # толщина борта
DOORS = [(-4.375, -3.155), (3.155, 4.375)]
DOOR_TOP = 1.98
WINDOWS = [(-2.155, -1.085), (1.085, 2.155)]
WIN_Z = (0.941, 1.789)
WIN_R = 0.07
SCREENS_X = [-2.675, -0.565, 0.515, 2.675]
SCREEN_Z, SCREEN_W, SCREEN_H = 1.40, 0.70, 0.39
SEAT_XS = [-5.83, -5.37, -2.90, -2.44, -1.98, -1.52, -1.06, -0.60, 0.16, 0.62, 1.08, 1.54, 2.00, 2.46, 4.93, 5.39]
SEAT_W = 0.44
PLINTHS = [(-5.85, -4.91), (-2.92, 2.92), (4.91, 5.85)]
POLES_X = [-4.37, -3.14, -0.16, 0.12, 3.10, 4.33]
POLE_Y = [0.48, 1.88]
HANGERS_X = [-5.10, -3.13, -1.05, 1.05, 3.10, 5.10]
RAIL_Z = 1.95
INTERCAR_OPENING = (0.735, 1.665, 2.085)   # y0, y1, верх проёма в торце
LIGHT_Y = (1.06, 1.34)

KEEP_ABS_X = 5.78            # части старых мешей за этой границей (торцы, переходы) сохраняются
REBUILD_FULLY = ['Subway_Wall_BrushedSteel_Merged', 'Subway_Ceiling', 'Subway_Seats_Orange_Merged',
                 'Subway_Seats_Yellow_Merged', 'Subway_Seat_Plinths_Merged', 'Subway_Vent_Grilles_Merged']
REBUILD_INNER = ['Subway_Floor_Merged', 'Subway_Ceiling_Lights_Merged', 'Subway_Chrome_Poles_Merged',
                 'Subway_Rubber_Gaskets_Merged', 'Subway_Titanium_Frames_Merged', 'Subway_Static_Window_Glass_Merged']


def mat(name):
    m = bpy.data.materials.get(name)
    if m is None:
        raise KeyError(name)
    return m


# --- Удаление старой геометрии ------------------------------------------------
def drop_inner_islands(obj):
    """Удаляет связные части меша, центр которых внутри салона (|x| < KEEP_ABS_X)."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    bm.verts.ensure_lookup_table()
    seen, kill = set(), []
    for v in bm.verts:
        if v in seen:
            continue
        stack, comp = [v], []
        seen.add(v)
        while stack:
            x = stack.pop()
            comp.append(x)
            for f in x.link_faces:
                for y in f.verts:
                    if y not in seen:
                        seen.add(y)
                        stack.append(y)
        xs = [c.co.x for c in comp]
        if abs((min(xs) + max(xs)) / 2) < KEEP_ABS_X:
            kill.extend(comp)
    bmesh.ops.delete(bm, geom=list(set(kill)), context='VERTS')
    bm.to_mesh(obj.data)
    bm.free()
    return len(obj.data.vertices)


def remove_old():
    for name in REBUILD_FULLY:
        obj = bpy.data.objects.get(name)
        if obj:
            bpy.data.objects.remove(obj, do_unlink=True)
    for name in REBUILD_INNER:
        obj = bpy.data.objects.get(name)
        if obj and drop_inner_islands(obj) == 0:
            bpy.data.objects.remove(obj, do_unlink=True)
    old = bpy.data.collections.get('Interior')
    if old:
        for o in list(old.all_objects):
            bpy.data.objects.remove(o, do_unlink=True)
        bpy.data.collections.remove(old)


# --- Построение ---------------------------------------------------------------
def collection():
    col = bpy.data.collections.new('Interior')
    bpy.data.collections['Train'].children.link(col)
    return col


def make_object(name, bm, materials, col, smooth=False, recalc=True):
    me = bpy.data.meshes.new(name)
    if recalc:
        bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.normal_update()
    bm.to_mesh(me)
    bm.free()
    for m in materials:
        me.materials.append(m)
    for p in me.polygons:
        p.use_smooth = smooth
    obj = bpy.data.objects.new(name, me)
    col.objects.link(obj)
    return obj


def add_box(bm, x0, x1, y0, y1, z0, z1, mi=0):
    vs = [bm.verts.new(v) for v in [(x0, y0, z0), (x1, y0, z0), (x1, y1, z0), (x0, y1, z0),
                                     (x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)]]
    faces = [(0, 3, 2, 1), (4, 5, 6, 7), (0, 1, 5, 4), (1, 2, 6, 5), (2, 3, 7, 6), (3, 0, 4, 7)]
    for f in faces:
        bm.faces.new([vs[i] for i in f]).material_index = mi


def add_cylinder(bm, p0, p1, r, segs=20, mi=0):
    """Цилиндр между точками p0 и p1 (с торцами)."""
    p0, p1 = Vector(p0), Vector(p1)
    axis = (p1 - p0).normalized()
    ref = Vector((1, 0, 0)) if abs(axis.x) < 0.9 else Vector((0, 1, 0))
    u = axis.cross(ref).normalized()
    v = axis.cross(u)
    ring0, ring1 = [], []
    for i in range(segs):
        a = 2 * math.pi * i / segs
        d = u * math.cos(a) * r + v * math.sin(a) * r
        ring0.append(bm.verts.new(p0 + d))
        ring1.append(bm.verts.new(p1 + d))
    for i in range(segs):
        j = (i + 1) % segs
        bm.faces.new([ring0[i], ring0[j], ring1[j], ring1[i]]).material_index = mi
    bm.faces.new(list(reversed(ring0))).material_index = mi
    bm.faces.new(ring1).material_index = mi


def rounded_rect(x0, x1, z0, z1, r, seg=6):
    pts = []
    corners = [(x1 - r, z1 - r, 0), (x0 + r, z1 - r, 90), (x0 + r, z0 + r, 180), (x1 - r, z0 + r, 270)]
    for cx, cz, a0 in corners:
        for i in range(seg + 1):
            a = math.radians(a0 + 90 * i / seg)
            pts.append((cx + r * math.cos(a), cz + r * math.sin(a)))
    return pts


def add_prism(bm, pts_xz, y0, y1, mi=0):
    """Призма из контура в плоскости XZ, вытянутая по Y."""
    a = [bm.verts.new((x, y0, z)) for x, z in pts_xz]
    b = [bm.verts.new((x, y1, z)) for x, z in pts_xz]
    n = len(pts_xz)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new([a[i], a[j], b[j], b[i]]).material_index = mi
    bm.faces.new(list(reversed(a))).material_index = mi
    bm.faces.new(b).material_index = mi


def add_ring_prism(bm, outer, inner, y0, y1, mi=0):
    """Рамка (контур с отверстием), вытянутая по Y. outer/inner — одинаковое число точек."""
    n = len(outer)
    oa = [bm.verts.new((x, y0, z)) for x, z in outer]
    ob = [bm.verts.new((x, y1, z)) for x, z in outer]
    ia = [bm.verts.new((x, y0, z)) for x, z in inner]
    ib = [bm.verts.new((x, y1, z)) for x, z in inner]
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new([oa[i], oa[j], ob[j], ob[i]]).material_index = mi
        bm.faces.new([ib[i], ib[j], ia[j], ia[i]]).material_index = mi
        bm.faces.new([oa[j], oa[i], ia[i], ia[j]]).material_index = mi
        bm.faces.new([ob[i], ob[j], ib[j], ib[i]]).material_index = mi


def mirror_y(points_yz):
    return [(W - y, z) for y, z in points_yz]


def planar_uv(obj, su=1.0, sv=1.0, ox=0.0, oy=0.0):
    """Плоская проекция UV по доминирующей оси нормали грани: u = a / su, v = b / sv."""
    me = obj.data
    uv = me.uv_layers.get('UVMap') or me.uv_layers.new(name='UVMap')
    for p in me.polygons:
        n = p.normal
        ax = max(range(3), key=lambda i: abs(n[i]))
        for li in p.loop_indices:
            co = me.vertices[me.loops[li].vertex_index].co
            a, b = {0: (co.y, co.z), 1: (co.x, co.z), 2: (co.x, co.y)}[ax]
            uv.data[li].uv = ((a + ox) / su, (b + oy) / sv)


def add_bevel(obj, width, segments=2, angle=30):
    mod = obj.modifiers.new('Bevel', 'BEVEL')
    mod.width = width
    mod.segments = segments
    mod.limit_method = 'ANGLE'
    mod.angle_limit = math.radians(angle)
    mod.harden_normals = True
    return mod


def boolean_cut(obj, cutter_bm):
    cutter = bpy.data.objects.new('_cutter', bpy.data.meshes.new('_cutter'))
    bmesh.ops.recalc_face_normals(cutter_bm, faces=cutter_bm.faces)   # иначе EXACT игнорирует вывернутый резак
    cutter_bm.to_mesh(cutter.data)
    cutter_bm.free()
    bpy.context.scene.collection.objects.link(cutter)
    mod = obj.modifiers.new('Cut', 'BOOLEAN')
    mod.operation = 'DIFFERENCE'
    mod.solver = 'EXACT'
    mod.object = cutter
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(obj.evaluated_get(dg))
    obj.modifiers.remove(mod)
    old = obj.data
    obj.data = me
    bpy.data.meshes.remove(old)
    bpy.data.objects.remove(cutter, do_unlink=True)


# --- Части салона -------------------------------------------------------------
def build_walls(col):
    """Борта с проёмами дверей и окон (сталь)."""
    for side, (y0, y1) in (('A', (-T_WALL, 0.0)), ('B', (W, W + T_WALL))):
        bm = bmesh.new()
        add_box(bm, -X_END, X_END, y0, y1, 0.0, H_WALL)
        obj = make_object(f'Interior_Wall_{side}', bm, [mat('M_Wall_Steel')], col)
        cut = bmesh.new()
        for d0, d1 in DOORS:
            add_box(cut, d0, d1, y0 - 0.05, y1 + 0.05, -0.1, DOOR_TOP)
        for w0, w1 in WINDOWS:
            add_prism(cut, rounded_rect(w0, w1, WIN_Z[0], WIN_Z[1], WIN_R), y0 - 0.05, y1 + 0.05)
        boolean_cut(obj, cut)
        planar_uv(obj, 4.0, 2.0)
        add_bevel(obj, 0.006, 2)


def cove_profile(seg=10):
    """Профиль галтели и потолка (y, z) от борта A до борта B."""
    pts = [(0.0, H_WALL)]
    for i in range(1, seg + 1):
        a = math.pi / 2 * i / seg
        pts.append((COVE * (1 - math.cos(a)), H_WALL + (H_CEIL - H_WALL) * math.sin(a)))
    right = list(reversed(mirror_y(pts)))
    return pts + right


def build_ceiling(col):
    """Галтель и потолок — один гладкий профиль, вытянутый вдоль вагона."""
    prof = cove_profile()
    bm = bmesh.new()
    xs = [-X_END, X_END]
    rows = [[bm.verts.new((x, y, z)) for y, z in prof] for x in xs]
    for i in range(len(prof) - 1):
        bm.faces.new([rows[0][i], rows[0][i + 1], rows[1][i + 1], rows[1][i]])
    obj = make_object('Interior_Ceiling', bm, [mat('M_Ceiling')], col, smooth=True, recalc=False)
    mod = obj.modifiers.new('Thickness', 'SOLIDIFY')
    mod.thickness = 0.025
    mod.offset = 1.0
    planar_uv(obj, 4.0, 2.0)


def build_bulkheads(col):
    """Торцевые стены по профилю салона с проёмом межвагонной двери."""
    prof = [(0.0, 0.0)] + cove_profile() + [(W, 0.0)]
    pts_yz = prof
    for sign in (-1, 1):
        x_in, x_out = sign * X_END, sign * (X_END + 0.03)
        bm = bmesh.new()
        a = [bm.verts.new((x_in, y, z)) for y, z in pts_yz]
        b = [bm.verts.new((x_out, y, z)) for y, z in pts_yz]
        n = len(pts_yz)
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new([a[i], a[j], b[j], b[i]])
        bm.faces.new(a if sign > 0 else list(reversed(a)))
        bm.faces.new(list(reversed(b)) if sign > 0 else b)
        obj = make_object(f'Interior_Bulkhead_{"Front" if sign > 0 else "Rear"}', bm, [mat('M_Wall_Steel')], col)
        cut = bmesh.new()
        y0, y1, top = INTERCAR_OPENING
        add_box(cut, min(x_in, x_out) - 0.05, max(x_in, x_out) + 0.05, y0, y1, -0.1, top)
        boolean_cut(obj, cut)
        planar_uv(obj, 4.0, 2.0)
        add_bevel(obj, 0.005, 2)


def build_door_portals(col):
    """Дверные порталы: стойки и притолока с фаской, выступают в салон."""
    bm = bmesh.new()
    for d0, d1 in DOORS:
        for y_in, y_out in ((0.0, 0.05), (W, W - 0.05)):
            ya, yb = sorted((y_in - (T_WALL if y_in == 0 else -T_WALL), y_out))
            add_box(bm, d0 - 0.07, d0, ya, yb, 0.0, DOOR_TOP + 0.07)
            add_box(bm, d1, d1 + 0.07, ya, yb, 0.0, DOOR_TOP + 0.07)
            add_box(bm, d0 - 0.07, d1 + 0.07, ya, yb, DOOR_TOP, DOOR_TOP + 0.07)
    obj = make_object('Interior_Door_Portals', bm, [mat('M_Seat_Frame')], col)
    planar_uv(obj)
    add_bevel(obj, 0.01, 3)


def build_windows(col):
    """Стекло и резиновые уплотнители окон со скруглёнными углами."""
    glass = bmesh.new()
    rubber = bmesh.new()
    for w0, w1 in WINDOWS:
        inner = rounded_rect(w0 + 0.012, w1 - 0.012, WIN_Z[0] + 0.012, WIN_Z[1] - 0.012, WIN_R - 0.012)
        outer = rounded_rect(w0 - 0.025, w1 + 0.025, WIN_Z[0] - 0.025, WIN_Z[1] + 0.025, WIN_R + 0.025)
        edge = rounded_rect(w0, w1, WIN_Z[0], WIN_Z[1], WIN_R)
        for side in ('A', 'B'):
            if side == 'A':
                yg, ya, yb = -0.02, -T_WALL, 0.012
            else:
                yg, ya, yb = W + 0.02, W - 0.012, W + T_WALL
            vs = [glass.verts.new((x, yg, z)) for x, z in edge]
            glass.faces.new(vs)
            add_ring_prism(rubber, outer, inner, ya, yb)
    g = make_object('Interior_Window_Glass', glass, [mat('M_Glass')], col, recalc=False)
    planar_uv(g)
    r = make_object('Interior_Window_Gaskets', rubber, [mat('M_Rubber')], col, smooth=True)
    planar_uv(r)
    add_bevel(r, 0.004, 2, angle=40)


def build_floor(col):
    bm = bmesh.new()
    add_box(bm, -X_END, X_END, 0.0, W, -0.04, 0.0)
    obj = make_object('Interior_Floor', bm, [mat('M_Floor')], col)
    planar_uv(obj, 11.8, 2.4)
    # Алюминиевые пороги в дверных проёмах
    th = bmesh.new()
    for d0, d1 in DOORS:
        add_box(th, d0, d1, -T_WALL, 0.10, 0.0, 0.006)
        add_box(th, d0, d1, W - 0.10, W + T_WALL, 0.0, 0.006)
    t = make_object('Interior_Door_Thresholds', th, [mat('M_Door_Handle')], col)
    planar_uv(t)
    add_bevel(t, 0.003, 1)


def build_plinths(col):
    bm = bmesh.new()
    vents = bmesh.new()
    for x0, x1 in PLINTHS:
        for ya, yb, yv in ((0.0, 0.36, 0.362), (W - 0.36, W, W - 0.362)):
            add_box(bm, x0 + 0.01, x1 - 0.01, ya, yb, 0.0, 0.40)
            # решётки вентиляции на лицевой стороне плинтуса
            length = x1 - x0
            count = max(1, int(length // 1.1))
            span = 0.62
            gap = (length - count * span) / (count + 1)
            for k in range(count):
                vx0 = x0 + gap + k * (span + gap)
                vs = [vents.verts.new(p) for p in [(vx0, yv, 0.08), (vx0 + span, yv, 0.08), (vx0 + span, yv, 0.24), (vx0, yv, 0.24)]]
                f = vents.faces.new(vs if yv < 1 else list(reversed(vs)))
    obj = make_object('Interior_Seat_Plinths', bm, [mat('M_Seat_Plinth')], col)
    planar_uv(obj, 11.8, 2.4)
    add_bevel(obj, 0.012, 2)
    v = make_object('Interior_Vent_Grilles', vents, [mat('M_Vent_Grille')], col, recalc=False)
    planar_uv(v, 0.62, 0.16)


def seat_profile():
    """Профиль формованного сиденья (y от борта, z) — спинка, изгиб, ложемент, передняя кромка."""
    return [(0.055, 0.93), (0.065, 0.80), (0.080, 0.62), (0.100, 0.52), (0.130, 0.465),
            (0.180, 0.440), (0.300, 0.435), (0.400, 0.445), (0.440, 0.440), (0.460, 0.415)]


def build_seats(col):
    """Отдельные формованные сиденья с ложементом, цвета чередуются как раньше."""
    prof = seat_profile()
    xs_steps = 8
    colors = {'M_Seat_Orange': bmesh.new(), 'M_Seat_Yellow': bmesh.new()}
    for i, sx in enumerate(SEAT_XS):
        for side in ('A', 'B'):
            # чередование цветов совпадает с прежней раскладкой
            orange = (i % 2 == 0) == (side == 'A')
            bm = colors['M_Seat_Orange' if orange else 'M_Seat_Yellow']
            grid = []
            for k in range(xs_steps + 1):
                t = k / xs_steps
                x = sx + 0.01 + (SEAT_W - 0.02) * t
                dip = -0.014 * math.sin(math.pi * t)          # ложемент: прогиб к центру сиденья
                row = []
                for j, (py, pz) in enumerate(prof):
                    zz = pz + (dip if 3 <= j <= 8 else dip * 0.4)
                    yy = py + (0.006 * math.sin(math.pi * t) if j <= 3 else 0.0)  # спинка слегка охватывает
                    y = yy if side == 'A' else W - yy
                    row.append(bm.verts.new((x, y, zz)))
                grid.append(row)
            for k in range(xs_steps):
                for j in range(len(prof) - 1):
                    quad = [grid[k][j], grid[k][j + 1], grid[k + 1][j + 1], grid[k + 1][j]]
                    bm.faces.new(quad if side == 'A' else list(reversed(quad)))
    for name, bm in colors.items():
        obj = make_object(f'Interior_Seats_{name.split("_")[-1]}', bm, [mat(name)], col, smooth=True, recalc=False)
        planar_uv(obj, 1.76, 1.76)
        sol = obj.modifiers.new('Shell', 'SOLIDIFY')
        sol.thickness = 0.016
        sol.offset = -1.0
        bev = obj.modifiers.new('Edges', 'BEVEL')
        bev.width = 0.006
        bev.segments = 2
        bev.limit_method = 'ANGLE'
        bev.angle_limit = math.radians(60)


def build_poles(col):
    bm = bmesh.new()
    for y in POLE_Y:
        for x in POLES_X:
            add_cylinder(bm, (x, y, 0.004), (x, y, RAIL_Z), 0.018, 24)
            add_cylinder(bm, (x, y, 0.0), (x, y, 0.012), 0.034, 24)          # фланец на полу
            add_cylinder(bm, (x, y, RAIL_Z - 0.03), (x, y, RAIL_Z + 0.03), 0.024, 24)  # муфта
        add_cylinder(bm, (-X_END + 0.06, y, RAIL_Z), (X_END - 0.06, y, RAIL_Z), 0.016, 20)
        for x in HANGERS_X:
            add_cylinder(bm, (x, y, RAIL_Z), (x, y, H_CEIL), 0.011, 16)
            add_cylinder(bm, (x, y, H_CEIL - 0.012), (x, y, H_CEIL), 0.03, 20)  # фланец на потолке
        for x in (-X_END, X_END):                                              # крепления к торцам
            add_cylinder(bm, (x, y, RAIL_Z), (x - math.copysign(0.07, x), y, RAIL_Z), 0.026, 20)
    obj = make_object('Interior_Poles', bm, [mat('M_Chrome')], col, smooth=True)
    planar_uv(obj)


def build_light(col):
    """Утопленный светильник по оси вагона: корпус с фаской и рассеиватель."""
    y0, y1 = LIGHT_Y
    housing = bmesh.new()
    add_box(housing, -X_END + 0.1, X_END - 0.1, y0, y1, H_CEIL - 0.045, H_CEIL)
    h = make_object('Interior_Light_Housing', housing, [mat('M_Seat_Frame')], col)
    planar_uv(h)
    add_bevel(h, 0.008, 2)
    diff = bmesh.new()
    x0, x1 = -X_END + 0.14, X_END - 0.14
    vs = [diff.verts.new(p) for p in [(x0, y0 + 0.03, H_CEIL - 0.047), (x1, y0 + 0.03, H_CEIL - 0.047),
                                      (x1, y1 - 0.03, H_CEIL - 0.047), (x0, y1 - 0.03, H_CEIL - 0.047)]]
    diff.faces.new(list(reversed(vs)))
    d = make_object('Interior_Light_Diffuser', diff, [mat('M_Ceiling_Light')], col, recalc=False)
    planar_uv(d, x1 - x0, y1 - y0 - 0.06, ox=-x0, oy=-(y0 + 0.03))


def build_screen_housings(col):
    bm = bmesh.new()
    pad = 0.035
    for x in SCREENS_X:
        x0, x1 = x - SCREEN_W / 2, x + SCREEN_W / 2
        z0, z1 = SCREEN_Z - SCREEN_H / 2, SCREEN_Z + SCREEN_H / 2
        outer = rounded_rect(x0 - pad, x1 + pad, z0 - pad, z1 + pad, 0.03, seg=3)
        inner = rounded_rect(x0, x1, z0, z1, 0.006, seg=3)
        add_ring_prism(bm, outer, inner, 0.0, 0.024)
        add_ring_prism(bm, outer, inner, W - 0.024, W)
        add_box(bm, x0, x1, 0.0, 0.004, z0, z1)              # задняя стенка за экраном
        add_box(bm, x0, x1, W - 0.004, W, z0, z1)
    obj = make_object('Interior_Screen_Housings', bm, [mat('M_Screen_Idle')], col)
    planar_uv(obj)
    add_bevel(obj, 0.004, 2, angle=40)


def build_trims(col):
    """Молдинги: стык борта и галтели, подоконный отлив."""
    bm = bmesh.new()
    for ya, yb in ((0.0, 0.018), (W - 0.018, W)):
        add_box(bm, -X_END, X_END, ya, yb, H_WALL - 0.02, H_WALL + 0.01)
        for w0, w1 in WINDOWS:
            add_box(bm, w0 - 0.05, w1 + 0.05, ya, yb + (0.03 if ya == 0 else 0), WIN_Z[0] - 0.05, WIN_Z[0] - 0.03)
    obj = make_object('Interior_Trims', bm, [mat('M_Seat_Frame')], col)
    planar_uv(obj)
    add_bevel(obj, 0.004, 2)


def run():
    remove_old()
    col = collection()
    build_walls(col)
    build_ceiling(col)
    build_bulkheads(col)
    build_door_portals(col)
    build_windows(col)
    build_floor(col)
    build_plinths(col)
    build_seats(col)
    build_poles(col)
    build_light(col)
    build_screen_housings(col)
    build_trims(col)
    bpy.ops.wm.save_mainfile()
    return sorted((o.name, len(o.data.polygons)) for o in col.objects)


if __name__ == '__main__':
    print('BUILT', run())
