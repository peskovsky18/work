"""
Пересборка станции в scene.blend (коллекция Station).

Заменяет упрощённую геометрию: край платформы (скруглённый бортик и ниша под платформой),
пути (рельсы с профилем, бетонные шпалы с крепежом, щебень с текстурой), колонны
(скруглённые грани, база и капитель), торцевые стены в плитке с арочными порталами,
тоннели глубиной 8 м (обделка с кольцами, кабельный лоток, светильники) и светильники
под сводом. Свод, плитка платформы, мебель, автомат, постеры и вывески остаются.

Координаты Blender: x — вдоль станции, y — поперёк (платформа y < 0, путь y 0..2.4),
z — вверх (верх платформы z = 0).

Запуск:  blender -b assets/models/scene.blend --python tools/blender/build_station.py
"""
import math
import os

import bmesh
import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
_h = {'__name__': 'interior_helpers'}
exec(compile(open(os.path.join(HERE, 'build_train_interior.py')).read(), 'build_train_interior.py', 'exec'), _h)
add_box, add_cylinder, rounded_rect = _h['add_box'], _h['add_cylinder'], _h['rounded_rect']
make_object, planar_uv, add_bevel, boolean_cut, mat = _h['make_object'], _h['planar_uv'], _h['add_bevel'], _h['boolean_cut'], _h['mat']
_m = {'__name__': 'material_helpers'}
exec(compile(open(os.path.join(HERE, 'build_subway.py')).read(), 'build_subway.py', 'exec'), _m)

X_WALL = 23.0                  # торцевые стены станции
X_TUNNEL = 31.0                # глубина тоннелей
RAIL_Y = (0.44, 1.96)
RAIL_TOP = -0.36
SLEEPER_TOP = -0.43
BALLAST_TOP = -0.47
COLUMN_X = [-19.40, -15.00, -10.60, -6.20, -1.80, 2.60, 7.00, 11.40, 15.80, 20.20]
COLUMN_Y = -2.60
LIGHT_LINES_Y = (-2.60, -1.00)
TUNNEL_Y = (-0.35, 2.75)
TUNNEL_SPRING = 1.90           # высота пяты свода тоннеля
TUNNEL_FLOOR = -0.62
REMOVE = ['Platform_Edge', 'Rail', 'Sleeper', 'Ballast', 'Portal_Wall', 'Tunnel_Void', 'Column', 'Column_Cuff',
          'Ceiling_Light_Line']
NEW_PREFIX = ('St_',)


def remove_old():
    for name in REMOVE:
        obj = bpy.data.objects.get(name)
        if obj:
            bpy.data.objects.remove(obj, do_unlink=True)
    for obj in [o for o in bpy.data.objects if o.name.startswith(NEW_PREFIX)]:
        bpy.data.objects.remove(obj, do_unlink=True)


def col(name):
    return bpy.data.collections[name]


def materials():
    """Новые материалы станции (через общий конструктор из build_subway.py)."""
    _m['TEX_DIR'] = os.path.join(HERE, '..', '..', 'assets', 'models', 'station_textures')
    _m['TEX_REL'] = '//station_textures/'
    mk = _m['make_material']
    mk('M_Ballast', rough=1.0, metal=0.0, base_tex='ballast_color', repeat=(1, 1),
       normal_tex='ballast_normal', normal_strength=1.0, rough_tex='ballast_roughness')
    mk('M_Tunnel_Concrete', color='3a3c40', rough=0.92, metal=0.0, normal_tex='ballast_normal',
       normal_strength=0.15, repeat=(1, 1))
    mk('M_Tunnel_Lamp', color='000000', rough=0.5, emission='ffd9a0', emission_strength=3.0)


def tunnel_profile(seg=16):
    """Сечение тоннеля (y, z): пол, стена, полукруглый свод, стена, обратно к полу."""
    y0, y1 = TUNNEL_Y
    cy, r = (y0 + y1) / 2, (y1 - y0) / 2
    pts = [(y0, TUNNEL_FLOOR), (y0, TUNNEL_SPRING)]
    for i in range(1, seg):
        a = math.pi - math.pi * i / seg
        pts.append((cy + r * math.cos(a), TUNNEL_SPRING + r * math.sin(a)))
    pts += [(y1, TUNNEL_SPRING), (y1, TUNNEL_FLOOR)]
    return pts


def vault_end_profile():
    """Контур свода станции у торца (y, z) — снимается с меша Vault_Tiles.

    Точки сортируются по углу вокруг центра сечения: от низа платформенной стены
    через замок свода к низу путевой стены (у путевой стены контур вертикален,
    поэтому сортировка по y дала бы зигзаг).
    """
    vault = bpy.data.objects['Vault_Tiles']
    mw = vault.matrix_world
    pts = [mw @ v.co for v in vault.data.vertices]
    xmin = min(p.x for p in pts)
    uniq = {(round(p.y, 3), round(p.z, 3)) for p in pts if p.x < xmin + 0.02}
    cy, cz = -0.76, 1.6

    def angle(p):
        a = math.degrees(math.atan2(p[1] - cz, p[0] - cy))
        return a + 360 if a < -100 else a

    return sorted(uniq, key=angle, reverse=True)


# --- Платформа -----------------------------------------------------------------
def build_platform_edge():
    """Ниша под платформой и лицевая стенка над путём; бортик платформы со скруглением."""
    poly = [(-0.06, -0.12), (-0.06, -0.24), (-0.40, -0.24), (-0.40, TUNNEL_FLOOR), (-0.60, TUNNEL_FLOOR), (-0.60, -0.12)]
    bm = bmesh.new()
    a = [bm.verts.new((-X_WALL, y, z)) for y, z in poly]
    b = [bm.verts.new((X_WALL, y, z)) for y, z in poly]
    n = len(poly)
    for i in range(n):
        j = (i + 1) % n
        bm.faces.new([a[i], a[j], b[j], b[i]])
    bm.faces.new(list(reversed(a)))
    bm.faces.new(b)
    obj = make_object('St_Platform_Edge', bm, [mat('M_Platform_Edge')], col('Platform'))
    planar_uv(obj)
    add_bevel(obj, 0.01, 1)
    # Скругление переднего ребра бортика (меш снят с сайта — сначала склеиваем вершины)
    curb = bpy.data.objects['Platform_Curb']
    bm = bmesh.new()
    bm.from_mesh(curb.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)
    bm.to_mesh(curb.data)
    bm.free()
    if curb.data.has_custom_normals:
        with bpy.context.temp_override(object=curb, active_object=curb):
            bpy.ops.mesh.customdata_custom_splitnormals_clear()
    if 'Nosing' not in curb.modifiers:
        mod = add_bevel(curb, 0.02, 3)
        mod.name = 'Nosing'


# --- Пути ------------------------------------------------------------------------
def rail_profile():
    return [(-0.036, -0.365), (-0.032, RAIL_TOP), (0.032, RAIL_TOP), (0.036, -0.365), (0.036, -0.393), (0.010, -0.400),
            (0.009, -0.412), (0.075, -0.423), (0.075, SLEEPER_TOP), (-0.075, SLEEPER_TOP), (-0.075, -0.423),
            (-0.009, -0.412), (-0.010, -0.400), (-0.036, -0.393)]


def build_track():
    track = col('Track')
    bm = bmesh.new()
    for yc in RAIL_Y:
        prof = [(yc + y, z) for y, z in rail_profile()]
        a = [bm.verts.new((-X_TUNNEL, y, z)) for y, z in prof]
        b = [bm.verts.new((X_TUNNEL, y, z)) for y, z in prof]
        n = len(prof)
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new([a[i], a[j], b[j], b[i]])
        bm.faces.new(list(reversed(a)))
        bm.faces.new(b)
    rails = make_object('St_Rails', bm, [mat('M_Rail')], track, smooth=True)
    rails.data.set_sharp_from_angle(angle=math.radians(40))
    planar_uv(rails)

    sl = bmesh.new()
    clips = bmesh.new()
    x = -X_TUNNEL + 0.35
    while x < X_TUNNEL:
        add_box(sl, x - 0.13, x + 0.13, 0.10, 2.30, SLEEPER_TOP - 0.10, SLEEPER_TOP)
        for yc in (RAIL_Y if abs(x) < X_WALL else ()):          # крепёж только в пределах станции
            for side in (-1, 1):
                cy = yc + side * 0.095
                add_box(clips, x - 0.045, x + 0.045, cy - 0.025, cy + 0.025, SLEEPER_TOP, SLEEPER_TOP + 0.022)
        x += 0.70
    sleepers = make_object('St_Sleepers', sl, [mat('M_Sleeper')], track)
    planar_uv(sleepers)
    add_bevel(sleepers, 0.015, 1)
    c = make_object('St_Rail_Clips', clips, [mat('M_Bogie')], track)
    planar_uv(c)

    bal = bmesh.new()
    add_box(bal, -X_TUNNEL, X_TUNNEL, -0.40, 3.00, TUNNEL_FLOOR, BALLAST_TOP)
    ballast = make_object('St_Ballast', bal, [mat('M_Ballast')], track)
    planar_uv(ballast, 0.9, 0.9)


# --- Колонны и светильники ----------------------------------------------------------
def build_columns():
    arch = col('Architecture')
    shafts = bmesh.new()
    cuffs = bmesh.new()
    add_prism = _h['add_prism']

    def column_prism(bm, x, half, r, z0, z1):
        # контур в плоскости XY, вытянутый по Z
        pts = rounded_rect(x - half, x + half, COLUMN_Y - half, COLUMN_Y + half, r, seg=4)
        a = [bm.verts.new((px, py, z0)) for px, py in pts]
        b = [bm.verts.new((px, py, z1)) for px, py in pts]
        n = len(pts)
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new([a[i], a[j], b[j], b[i]])
        bm.faces.new(list(reversed(a)))
        bm.faces.new(b)

    for x in COLUMN_X:
        column_prism(shafts, x, 0.24, 0.06, 0.32, 4.22)
        column_prism(cuffs, x, 0.28, 0.07, 0.0, 0.32)            # база из нержавейки
        column_prism(cuffs, x, 0.29, 0.07, 0.0, 0.02)            # плинтус
        column_prism(cuffs, x, 0.27, 0.07, 4.22, 4.30)           # капитель
        column_prism(cuffs, x, 0.31, 0.08, 4.30, 4.45)
    s = make_object('St_Columns', shafts, [mat('M_Column')], arch, smooth=True)
    s.data.set_sharp_from_angle(angle=math.radians(50))
    planar_uv(s)
    c = make_object('St_Column_Cuffs', cuffs, [mat('M_Column_Cuff')], arch, smooth=True)
    c.data.set_sharp_from_angle(angle=math.radians(50))
    planar_uv(c)


def build_luminaires():
    arch = col('Architecture')
    housing = bmesh.new()
    diff = bmesh.new()
    rods = bmesh.new()
    prof = vault_end_profile()

    def vault_z(y):
        for (y0, z0), (y1, z1) in zip(prof, prof[1:]):
            if y0 <= y <= y1 and y1 > y0:
                return z0 + (y - y0) / (y1 - y0) * (z1 - z0)
        return 4.6

    edges = [-X_WALL + 0.6] + [x + 0.45 for x in COLUMN_X] + [X_WALL - 0.6]
    for yl in LIGHT_LINES_Y:
        top = vault_z(yl)
        for i in range(len(COLUMN_X) + 1):
            x0 = edges[i] if i == 0 else COLUMN_X[i - 1] + 0.45
            x1 = COLUMN_X[i] - 0.45 if i < len(COLUMN_X) else edges[-1]
            if x1 - x0 < 1.0:
                continue
            add_box(housing, x0, x1, yl - 0.11, yl + 0.11, 4.30, 4.38)
            vs = [diff.verts.new(p) for p in [(x0 + 0.04, yl - 0.08, 4.298), (x1 - 0.04, yl - 0.08, 4.298),
                                              (x1 - 0.04, yl + 0.08, 4.298), (x0 + 0.04, yl + 0.08, 4.298)]]
            diff.faces.new(list(reversed(vs)))
            for rx in (x0 + 0.4, x1 - 0.4):
                add_cylinder(rods, (rx, yl, 4.38), (rx, yl, top + 0.05), 0.008, 8)
    h = make_object('St_Luminaire_Housings', housing, [mat('M_Nav_Housing')], arch)
    planar_uv(h)
    add_bevel(h, 0.01, 2)
    d = make_object('St_Luminaire_Diffusers', diff, [mat('M_Ceiling_Light_Line')], arch, recalc=False)
    planar_uv(d)
    r = make_object('St_Luminaire_Rods', rods, [mat('M_Nav_Hanger')], arch, smooth=True)
    planar_uv(r)


# --- Торцы и тоннели ----------------------------------------------------------------
def build_end_walls():
    arch = col('Architecture')
    vault = vault_end_profile()
    outline = [(vault[0][0], TUNNEL_FLOOR)] + vault + [(vault[-1][0], TUNNEL_FLOOR)]
    # убираем дубли по y на путевой стене (там вертикаль)
    clean = []
    for p in outline:
        if not clean or (abs(p[0] - clean[-1][0]) > 1e-4 or abs(p[1] - clean[-1][1]) > 1e-4):
            clean.append(p)
    for sign in (-1, 1):
        xa, xb = sign * X_WALL, sign * (X_WALL + 0.25)
        bm = bmesh.new()
        a = [bm.verts.new((xa, y, z)) for y, z in clean]
        b = [bm.verts.new((xb, y, z)) for y, z in clean]
        n = len(clean)
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new([a[i], a[j], b[j], b[i]])
        bm.faces.new(a)
        bm.faces.new(list(reversed(b)))
        obj = make_object(f'St_End_Wall_{"East" if sign > 0 else "West"}', bm, [mat('M_Vault_Tiles')], arch)
        cut = bmesh.new()
        prof = tunnel_profile()
        ca = [cut.verts.new((min(xa, xb) - 0.1, y, z if z > TUNNEL_FLOOR + 0.01 else TUNNEL_FLOOR - 0.2)) for y, z in prof]
        cb = [cut.verts.new((max(xa, xb) + 0.1, y, z if z > TUNNEL_FLOOR + 0.01 else TUNNEL_FLOOR - 0.2)) for y, z in prof]
        m = len(prof)
        for i in range(m):
            j = (i + 1) % m
            cut.faces.new([ca[i], ca[j], cb[j], cb[i]])
        cut.faces.new(list(reversed(ca)))
        cut.faces.new(cb)
        boolean_cut(obj, cut)
        planar_uv(obj, 2.4, 1.85)
        add_bevel(obj, 0.01, 1)
        # Обрамление портала: тёмное кольцо вокруг арки
        ring = bmesh.new()
        inner = prof
        outer = [(y + (-0.18 if y < 1.2 else 0.18) if z < TUNNEL_SPRING + 0.01 else 1.2 + (y - 1.2) * 1.12,
                  z if z < TUNNEL_SPRING + 0.01 else TUNNEL_SPRING + (z - TUNNEL_SPRING) * 1.12) for y, z in inner]
        xr = sign * (X_WALL - 0.03)
        oa = [ring.verts.new((xr, y, z)) for y, z in outer]
        ob = [ring.verts.new((xa, y, z)) for y, z in outer]
        ia = [ring.verts.new((xr, y, z)) for y, z in inner]
        ib = [ring.verts.new((xa, y, z)) for y, z in inner]
        for i in range(m - 1):
            j = i + 1
            ring.faces.new([oa[i], oa[j], ia[j], ia[i]])
            ring.faces.new([oa[i], ob[i], ob[j], oa[j]])
            ring.faces.new([ia[j], ib[j], ib[i], ia[i]])
        r = make_object(f'St_Portal_Ring_{"East" if sign > 0 else "West"}', ring, [mat('M_Portal_Wall')], arch)
        planar_uv(r)


def build_tunnels():
    arch = col('Architecture')
    prof = tunnel_profile()
    for sign in (-1, 1):
        side = 'East' if sign > 0 else 'West'
        x0, x1 = sign * X_WALL, sign * X_TUNNEL
        lining = bmesh.new()
        rows = [[lining.verts.new((x, y, z)) for y, z in prof] for x in (x0, x1)]
        for i in range(len(prof) - 1):
            q = [rows[0][i], rows[0][i + 1], rows[1][i + 1], rows[1][i]]
            lining.faces.new(q if sign > 0 else list(reversed(q)))
        lin = make_object(f'St_Tunnel_Lining_{side}', lining, [mat('M_Tunnel_Concrete')], arch, smooth=True, recalc=False)
        lin.data.set_sharp_from_angle(angle=math.radians(40))
        sol = lin.modifiers.new('Thickness', 'SOLIDIFY')
        sol.thickness = 0.15
        planar_uv(lin, 1.2, 1.2)

        rings = bmesh.new()
        lamps = bmesh.new()
        tray = bmesh.new()
        cy = (TUNNEL_Y[0] + TUNNEL_Y[1]) / 2
        k = 1
        while abs(sign * X_WALL + sign * 1.5 * k) < X_TUNNEL - 0.2:
            xr = sign * X_WALL + sign * 1.5 * k
            inner = [(cy + (y - cy) * 0.975, z if z < TUNNEL_SPRING else TUNNEL_SPRING + (z - TUNNEL_SPRING) * 0.975) for y, z in prof]
            a = [rings.verts.new((xr - 0.06, y, z)) for y, z in prof]
            b = [rings.verts.new((xr + 0.06, y, z)) for y, z in prof]
            ia = [rings.verts.new((xr - 0.06, y, z)) for y, z in inner]
            ib = [rings.verts.new((xr + 0.06, y, z)) for y, z in inner]
            for i in range(len(prof) - 1):
                j = i + 1
                rings.faces.new([ia[i], ia[j], ib[j], ib[i]])
                rings.faces.new([a[i], ia[i], ia[j], a[j]])
                rings.faces.new([b[j], ib[j], ib[i], b[i]])
            if k % 2 == 0:
                add_box(lamps, xr - 0.08, xr + 0.08, TUNNEL_Y[1] - 0.06, TUNNEL_Y[1] - 0.01, 2.05, 2.11)
            k += 1
        add_box(tray, min(x0, x1), max(x0, x1), TUNNEL_Y[0] + 0.02, TUNNEL_Y[0] + 0.16, 1.10, 1.16)
        rg = make_object(f'St_Tunnel_Rings_{side}', rings, [mat('M_Tunnel_Concrete')], arch)
        planar_uv(rg)
        lp = make_object(f'St_Tunnel_Lamps_{side}', lamps, [mat('M_Tunnel_Lamp')], arch)
        planar_uv(lp)
        tr = make_object(f'St_Tunnel_Cable_Tray_{side}', tray, [mat('M_Bogie')], arch)
        planar_uv(tr)
        # Тёмный торец тоннеля
        cap = bmesh.new()
        vs = [cap.verts.new((x1, y, z)) for y, z in prof]
        cap.faces.new(vs if sign < 0 else list(reversed(vs)))
        cp = make_object(f'St_Tunnel_End_{side}', cap, [mat('M_Tunnel_Void')], arch, recalc=False)
        planar_uv(cp)


def decimate_seats():
    seats = bpy.data.objects.get('Station_Seat_Red')
    if seats and 'Decimate' not in seats.modifiers:
        mod = seats.modifiers.new('Decimate', 'DECIMATE')
        mod.ratio = 0.5


def run():
    remove_old()
    decimate_seats()
    materials()
    build_platform_edge()
    build_track()
    build_columns()
    build_luminaires()
    build_end_walls()
    build_tunnels()
    bpy.ops.wm.save_mainfile()
    return sorted((o.name, len(o.data.polygons)) for o in bpy.data.objects if o.name.startswith(NEW_PREFIX))


if __name__ == '__main__':
    print('BUILT', run())
