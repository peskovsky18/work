"""
Пересборка кузова состава (главный вагон и два прицепных) чистой геометрией.

Кузов — единый гладкий профиль со скруглёнными плечами крыши, ливрея Alstom
нарезана по высоте (белый низ, кант, голубой верх, тёмный пояс, крыша).
Проёмы дверей (главный вагон) и окон со скруглёнными углами вырезаются булевыми
операциями и совпадают с салоном. Добавлены стёкла с уплотнителями, торцы с проёмами
переходов, климатические блоки, подвагонное оборудование и тележки.
Остаются как есть: Door_*, табло над дверями, ручки, сцепки, гармошки переходов,
салоны прицепных вагонов (видны сквозь окна).

Запуск:  blender -b assets/models/scene.blend --python tools/blender/build_train_exterior.py
"""
import math
import os

import bmesh
import bpy

# Общие помощники геометрии из сборщика салона
_helpers = {'__name__': 'interior_helpers'}
exec(compile(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'build_train_interior.py')).read(),
             'build_train_interior.py', 'exec'), _helpers)
add_box, add_cylinder, rounded_rect = _helpers['add_box'], _helpers['add_cylinder'], _helpers['rounded_rect']
add_prism, add_ring_prism, make_object = _helpers['add_prism'], _helpers['add_ring_prism'], _helpers['make_object']
planar_uv, add_bevel, boolean_cut, mat = _helpers['planar_uv'], _helpers['add_bevel'], _helpers['boolean_cut'], _helpers['mat']

Y_OUT = -0.05            # наружная поверхность борта A (борт B симметричен: W_OUT - y)
W_OUT = 2.40
SKIN = 0.012
BANDS = [(0.94, 'M_Livery_White'), (0.96, 'M_Livery_Pin'), (2.22, 'M_Livery_Blue'), (2.30, 'M_Ext_Trim'), (9.0, 'M_Ext_Roof')]
GANGWAY = (0.735, 1.665, 2.085)
WHEEL_R = 0.24

CARS = {
    'Car_Main': dict(
        x0=-6.08, x1=6.08,
        doors_cut=[(-4.375, -3.155), (3.155, 4.375)], door_top=1.98,
        windows=[(-2.155, -1.085, 0.941, 1.789), (1.085, 2.155, 0.941, 1.789)], sides=('A', 'B'),
        drawn_doors=[], hvac=[(-3.75, -1.45), (1.45, 3.75)], bogies=[-3.9, 3.9], gangway_ends=(True, True)),
    'Car_Front': dict(
        x0=7.28, x1=24.5, doors_cut=[], door_top=1.98,
        windows=[(12.79, 13.99, 0.96, 1.77), (17.79, 18.99, 0.96, 1.77)], sides=('A',),
        drawn_doors=[(10.30, 11.48), (15.30, 16.48), (20.30, 21.48)],
        hvac=[(9.54, 11.84), (14.74, 17.04), (19.94, 22.24)], bogies=[10.69, 21.09], gangway_ends=(True, False)),
}
# Хвостовой вагон — зеркало переднего
_f = CARS['Car_Front']
CARS['Car_Rear'] = dict(
    x0=-_f['x1'], x1=-_f['x0'], doors_cut=[], door_top=1.98,
    windows=[(-b, -a, z0, z1) for a, b, z0, z1 in _f['windows']], sides=('A',),
    drawn_doors=[(-b, -a) for a, b in _f['drawn_doors']],
    hvac=[(-b, -a) for a, b in _f['hvac']], bogies=[-x for x in _f['bogies']], gangway_ends=(False, True))

REBUILD = ['Livery_White', 'Livery_Blue', 'Livery_Pin', 'Ext_Trim', 'Ext_Roof', 'Ext_End', 'Ext_Glass',
           'Ext_HVAC', 'Underframe', 'Bogie']


def remove_old():
    for car, spec in CARS.items():
        for part in REBUILD:
            obj = bpy.data.objects.get(f'{car}_{part}')
            if obj:
                bpy.data.objects.remove(obj, do_unlink=True)
        # Уплотнители окон удаляем, гармошки переходов (за торцами кузова) оставляем
        rubber = bpy.data.objects.get(f'{car}_Ext_Rubber')
        if rubber:
            keep_out = (spec['x0'] + 0.03, spec['x1'] - 0.03)
            bm = bmesh.new()
            bm.from_mesh(rubber.data)
            kill = [f for f in bm.faces if keep_out[0] < f.calc_center_median().x < keep_out[1]]
            bmesh.ops.delete(bm, geom=kill, context='FACES')
            bm.to_mesh(rubber.data)
            bm.free()
            if not rubber.data.polygons:
                bpy.data.objects.remove(rubber, do_unlink=True)
    old = bpy.data.collections.get('Body')
    if old:
        for o in list(old.all_objects):
            bpy.data.objects.remove(o, do_unlink=True)
        bpy.data.collections.remove(old)


def profile():
    """Наружный профиль кузова (y, z): борт A снизу вверх, плечо, свод крыши, борт B вниз."""
    side = [(Y_OUT, -0.04), (Y_OUT, 0.94), (Y_OUT, 0.96), (Y_OUT, 2.22), (Y_OUT, 2.28)]
    cy, cz, r = Y_OUT + 0.30, 2.28, 0.30
    for i in range(1, 9):
        a = math.pi - (math.pi / 2) * i / 8
        side.append((cy + r * math.cos(a), cz + r * math.sin(a)))
    crown = [(0.60, 2.612), (0.90, 2.628), (1.20, 2.634)]
    half = side + crown
    other = [(W_OUT - y, z) for y, z in reversed(half[:-1])]
    return half + other


def assign_bands(obj):
    names = [n for _, n in BANDS]
    obj.data.materials.clear()
    for n in names:
        obj.data.materials.append(mat(n))
    for p in obj.data.polygons:
        z = p.center.z
        p.material_index = next(i for i, (lim, _) in enumerate(BANDS) if z < lim)


def evaluated_copy(obj):
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(obj.evaluated_get(dg))
    obj.modifiers.clear()
    old = obj.data
    obj.data = me
    bpy.data.meshes.remove(old)


def build_body(car, spec, col):
    prof = profile()
    bm = bmesh.new()
    rows = [[bm.verts.new((x, y, z)) for y, z in prof] for x in (spec['x0'], spec['x1'])]
    for i in range(len(prof) - 1):
        bm.faces.new([rows[0][i], rows[0][i + 1], rows[1][i + 1], rows[1][i]])
    body = make_object(f'{car}_Body', bm, [mat('M_Livery_Blue')], col, recalc=False)
    # Нормали наружу и оболочка внутрь на толщину обшивки
    body.data.flip_normals() if body.data.polygons[0].normal.y > 0 else None
    sol = body.modifiers.new('Skin', 'SOLIDIFY')
    sol.thickness = SKIN
    sol.offset = -1.0
    sol.use_even_offset = True
    evaluated_copy(body)

    cut = bmesh.new()
    for d0, d1 in spec['doors_cut']:
        add_box(cut, d0, d1, Y_OUT - 0.1, Y_OUT + 0.1, -0.2, spec['door_top'])
        add_box(cut, d0, d1, W_OUT - Y_OUT - 0.1, W_OUT - Y_OUT + 0.1, -0.2, spec['door_top'])
    for side in spec['sides']:
        yc = Y_OUT if side == 'A' else W_OUT - Y_OUT
        for w0, w1, z0, z1 in spec['windows']:
            add_prism(cut, rounded_rect(w0, w1, z0, z1, 0.07), yc - 0.1, yc + 0.1)
    for d0, d1 in spec['drawn_doors']:
        for wx0, wx1 in ((d0 + 0.195, d0 + 0.435), (d0 + 0.745, d0 + 0.985)):
            add_prism(cut, rounded_rect(wx0, wx1, 0.90, 1.78, 0.05), Y_OUT - 0.1, Y_OUT + 0.1)
    if cut.faces:
        boolean_cut(body, cut)
    else:
        cut.free()
    assign_bands(body)
    planar_uv(body)
    for p in body.data.polygons:
        p.use_smooth = True
    mod = body.modifiers.new('Smooth', 'SMOOTH_BY_ANGLE') if hasattr(bpy.types, 'SmoothByAngleModifier') else None
    if mod is None:
        body.data.set_sharp_from_angle(angle=math.radians(35)) if hasattr(body.data, 'set_sharp_from_angle') else None
    return body


def build_ends(car, spec, col):
    """Торцы кузова по профилю, с проёмом перехода на стороне сцепки."""
    prof = profile()                      # контур замыкается низом борта B → низ борта A
    for idx, (x_face, has_gangway) in enumerate(((spec['x0'], spec['gangway_ends'][0]), (spec['x1'], spec['gangway_ends'][1]))):
        inward = 1 if idx == 0 else -1
        xa, xb = x_face, x_face + inward * 0.03
        bm = bmesh.new()
        a = [bm.verts.new((xa, y, z)) for y, z in prof]
        b = [bm.verts.new((xb, y, z)) for y, z in prof]
        n = len(prof)
        for i in range(n):
            j = (i + 1) % n
            bm.faces.new([a[i], a[j], b[j], b[i]])
        bm.faces.new(a)
        bm.faces.new(list(reversed(b)))
        obj = make_object(f'{car}_End_{idx}', bm, [mat('M_Ext_End')], col)
        if has_gangway:
            y0, y1, top = GANGWAY
            cut = bmesh.new()
            add_box(cut, min(xa, xb) - 0.05, max(xa, xb) + 0.05, y0, y1, -0.2, top)
            boolean_cut(obj, cut)
        planar_uv(obj)
        add_bevel(obj, 0.01, 2)


def build_glazing(car, spec, col):
    glass = bmesh.new()
    rubber = bmesh.new()

    def window(x0, x1, z0, z1, r, yc, outward):
        edge = rounded_rect(x0, x1, z0, z1, r)
        vs = [glass.verts.new((x, yc - outward * 0.006, z)) for x, z in edge]
        glass.faces.new(vs)
        outer = rounded_rect(x0 - 0.022, x1 + 0.022, z0 - 0.022, z1 + 0.022, r + 0.022)
        inner = rounded_rect(x0 + 0.01, x1 - 0.01, z0 + 0.01, z1 - 0.01, max(r - 0.01, 0.005))
        ya, yb = sorted((yc + outward * 0.006, yc - outward * 0.004))
        add_ring_prism(rubber, outer, inner, ya, yb)

    for side in spec['sides']:
        yc, outward = (Y_OUT, -1) if side == 'A' else (W_OUT - Y_OUT, 1)
        for w0, w1, z0, z1 in spec['windows']:
            window(w0, w1, z0, z1, 0.07, yc, outward)
    for d0, d1 in spec['drawn_doors']:
        for wx0, wx1 in ((d0 + 0.195, d0 + 0.435), (d0 + 0.745, d0 + 0.985)):
            window(wx0, wx1, 0.90, 1.78, 0.05, Y_OUT, -1)
    if glass.faces:
        g = make_object(f'{car}_Glass', glass, [mat('M_Ext_Glass')], col, recalc=False)
        planar_uv(g)
        r = make_object(f'{car}_Gaskets', rubber, [mat('M_Ext_Rubber')], col, smooth=True)
        planar_uv(r)
    else:
        glass.free()
        rubber.free()


def build_drawn_doors(car, spec, col):
    """Прицепные вагоны: створки обозначены резиновым контуром и стыком посередине."""
    if not spec['drawn_doors']:
        return
    bm = bmesh.new()
    y0, y1 = Y_OUT - 0.004, Y_OUT + 0.002
    for d0, d1 in spec['drawn_doors']:
        mid = (d0 + d1) / 2
        add_box(bm, d0 - 0.012, d0, y0, y1, -0.02, 1.98)
        add_box(bm, d1, d1 + 0.012, y0, y1, -0.02, 1.98)
        add_box(bm, d0 - 0.012, d1 + 0.012, y0, y1, 1.98, 1.992)
        add_box(bm, mid - 0.006, mid + 0.006, y0, y1, -0.02, 1.98)
    obj = make_object(f'{car}_Door_Seals', bm, [mat('M_Ext_Rubber')], col)
    planar_uv(obj)


def build_hvac(car, spec, col):
    units = bmesh.new()
    fans = bmesh.new()
    grilles = bmesh.new()
    for x0, x1 in spec['hvac']:
        add_box(units, x0, x1, 0.50, 1.90, 2.55, 2.77)
        for fx in (x0 + (x1 - x0) * 0.3, x0 + (x1 - x0) * 0.7):
            add_cylinder(fans, (fx, 1.2, 2.765), (fx, 1.2, 2.785), 0.30, 24)
        for gy, flip in ((0.499, False), (1.901, True)):
            vs = [grilles.verts.new(p) for p in [(x0 + 0.15, gy, 2.59), (x1 - 0.15, gy, 2.59), (x1 - 0.15, gy, 2.73), (x0 + 0.15, gy, 2.73)]]
            grilles.faces.new(list(reversed(vs)) if flip else vs)
    u = make_object(f'{car}_HVAC', units, [mat('M_Ext_HVAC')], col)
    planar_uv(u)
    add_bevel(u, 0.045, 3)
    f = make_object(f'{car}_HVAC_Fans', fans, [mat('M_Bogie')], col, smooth=True)
    planar_uv(f)
    g = make_object(f'{car}_HVAC_Grilles', grilles, [mat('M_Vent_Grille')], col, recalc=False)
    planar_uv(g, 0.6, 0.15)


def build_underframe(car, spec, col):
    bm = bmesh.new()
    x0, x1 = spec['x0'] + 0.25, spec['x1'] - 0.25
    add_box(bm, x0, x1, 0.12, 2.28, -0.16, -0.04)                 # хребтовая балка
    bogies = sorted(spec['bogies'])
    spans = [(x0, bogies[0] - 1.45)] + [(bogies[i] + 1.45, bogies[i + 1] - 1.45) for i in range(len(bogies) - 1)] + [(bogies[-1] + 1.45, x1)]
    for s0, s1 in spans:
        if s1 - s0 < 0.6:
            continue
        n = max(1, int((s1 - s0) // 1.6))
        w = (s1 - s0) / n
        for k in range(n):                                          # ящики оборудования
            bx0, bx1 = s0 + k * w + 0.08, s0 + (k + 1) * w - 0.08
            add_box(bm, bx0, bx1, 0.18, 0.62, -0.40, -0.16)
            add_box(bm, bx0, bx1, 1.78, 2.22, -0.40, -0.16)
    obj = make_object(f'{car}_Underframe', bm, [mat('M_Underframe')], col)
    planar_uv(obj)
    add_bevel(obj, 0.015, 2)


def build_bogies(car, spec, col):
    frame = bmesh.new()
    wheels = bmesh.new()
    for bx in spec['bogies']:
        for ya, yb in ((0.28, 0.38), (2.02, 2.12)):
            add_box(frame, bx - 1.2, bx + 1.2, ya, yb, -0.36, -0.20)          # боковины рамы
            for ax in (bx - 0.85, bx + 0.85):
                add_box(frame, ax - 0.13, ax + 0.13, ya - 0.02, yb + 0.02, -0.40, -0.24)   # буксы
                add_cylinder(frame, (ax, (ya + yb) / 2, -0.20), (ax, (ya + yb) / 2, -0.08), 0.055, 12)  # пружины
        add_box(frame, bx - 0.18, bx + 0.18, 0.38, 2.02, -0.34, -0.22)        # шкворневая балка
        for ax in (bx - 0.85, bx + 0.85):
            add_cylinder(wheels, (ax, 0.40, -0.32), (ax, 2.00, -0.32), 0.045, 16)          # ось
            for y0, y1, fy in ((0.40, 0.48, 0.48), (1.92, 2.00, 1.92)):
                add_cylinder(wheels, (ax, y0, -0.32), (ax, y1, -0.32), WHEEL_R, 24)       # колесо
                add_cylinder(wheels, (ax, fy - 0.008, -0.32), (ax, fy + 0.008, -0.32), WHEEL_R + 0.025, 24)  # реборда
    f = make_object(f'{car}_Bogie_Frames', frame, [mat('M_Bogie')], col)
    planar_uv(f)
    add_bevel(f, 0.01, 1)
    w = make_object(f'{car}_Wheels', wheels, [mat('M_Bogie')], col, smooth=True)
    planar_uv(w)


def run():
    remove_old()
    col = bpy.data.collections.new('Body')
    bpy.data.collections['Exterior'].children.link(col)
    for car, spec in CARS.items():
        build_body(car, spec, col)
        build_ends(car, spec, col)
        build_glazing(car, spec, col)
        build_drawn_doors(car, spec, col)
        build_hvac(car, spec, col)
        build_underframe(car, spec, col)
        build_bogies(car, spec, col)
    bpy.ops.wm.save_mainfile()
    return sorted((o.name, len(o.data.polygons)) for o in col.objects)


if __name__ == '__main__':
    print('BUILT', run())
