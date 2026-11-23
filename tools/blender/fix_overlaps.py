"""
Поиск и устранение наложенных поверхностей (z-fighting) в экспортируемых коллекциях.

Наложение — две грани разных объектов в одной плоскости и с одной ориентацией: в браузере
они мерцают, текстуры «просвечивают» друг сквозь друга. Накладная деталь (меньший объект пары:
рассеиватель на корпусе светильника, уплотнитель на стене, табло в рамке) отодвигается наружу
по нормали на несколько миллиметров. UV не меняются, поэтому запечённый свет остаётся верным.
Точные дубликаты граней внутри одного объекта удаляются.

Проверка без изменений (поверхности ближе 1 мм):
  blender -b assets/models/scene.blend --python tools/blender/fix_overlaps.py -- check
Исправление (сохраняет файл):
  blender -b assets/models/scene.blend --python tools/blender/fix_overlaps.py -- fix
Только пары, где есть объект из указанных коллекций (остальные части не трогаются,
повторный запуск по уже исправленным частям сдвинул бы их ещё на несколько миллиметров):
  blender -b assets/models/scene.blend --python tools/blender/fix_overlaps.py -- fix Escalator
Делается и для scene_prebake.blend, затем экспорт (export_glb.py).
"""
import json
import sys

import bmesh
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

TOL = 0.004                 # при исправлении наложением считаются поверхности ближе 4 мм
CHECK_TOL = 0.001           # после исправления не должно остаться поверхностей ближе 1 мм
GAP_CAR = 0.002             # зазор после исправления в вагоне (камера близко)
GAP_STATION = 0.003         # зазор на станции и эскалаторе (камера дальше)
MAX_SHIFT = 0.004           # ни одна вершина не сдвигается дальше 4 мм за запуск
# Детали, которые лежат поверх соседних (при наложении сдвигаются они)
OVERLAY_HINTS = ('Diffuser', 'Display', 'Grilles', 'Gasket', 'Portals', 'Seals', 'Jamb', 'Archivolt',
                 'Sill', 'Stop_Red', 'Safety_Yellow', 'Light_Housing', 'Esc_Deck',
                 'St_End_Wall')  # плитка в проёме арки поверх бетона тоннеля
# Объекты, сдвигаемые целиком: торцы облицовки тоннеля (их создаёт Solidify, вершинами
# их не сдвинуть) уходят на 3 мм вглубь тоннеля, за плитку торцевой стены станции
SHIFT_OBJECTS = {'St_Tunnel_Lining_West': (-0.003, 0, 0), 'St_Tunnel_Lining_East': (0.003, 0, 0)}
COLLECTIONS = ('Escalator', 'Station', 'Train')


def export_objects():
    objs = []
    for top in COLLECTIONS:
        col = bpy.data.collections.get(top)
        if col:
            objs += [o for o in col.all_objects if o.type == 'MESH' and not o.hide_render]
    return list(dict.fromkeys(objs))


def world_bmesh(obj, evaluated):
    bm = bmesh.new()
    if evaluated:
        dg = bpy.context.evaluated_depsgraph_get()
        eo = obj.evaluated_get(dg)
        me = eo.to_mesh()
        bm.from_mesh(me)
        eo.to_mesh_clear()
    else:
        bm.from_mesh(obj.data)
    bm.transform(obj.matrix_world)
    bm.faces.ensure_lookup_table()
    return bm


def face_points(f):
    c = f.calc_center_median()
    return [c] + [c.lerp(v.co, 0.7) for v in f.verts][:4]


def overlapping_faces(bm_a, bvh_b, tol=TOL):
    """Грани bm_a, лежащие на поверхности bvh_b (та же плоскость и ориентация):
    список (индекс, зазор), зазор — насколько грань впереди поверхности по своей нормали."""
    found = []
    for f in bm_a.faces:
        if f.calc_area() < 1e-6:
            continue
        # нижние грани под полом и путями смотрят вниз, камера их не видит
        if f.normal.z < -0.9 and f.calc_center_median().z < 0:
            continue
        seps = []
        for p in face_points(f):
            loc, hn, _, _ = bvh_b.find_nearest(p, tol)
            if loc is None:
                continue
            sep = (p - loc).dot(f.normal)
            if hn.dot(f.normal) > 0.95 and abs(sep) < tol:
                seps.append(sep)
        if len(seps) >= 3:
            found.append((f.index, min(seps)))
    return found


def total_area(bm):
    return sum(f.calc_area() for f in bm.faces) or 1e-9


def find_pairs(objs, tol=TOL):
    """Пары объектов с наложением: (накладка, основа, площадь наложения)."""
    info = {}
    for o in objs:
        bm = world_bmesh(o, True)
        if not bm.verts:
            bm.free()
            continue
        lo = Vector([min(v.co[i] for v in bm.verts) for i in range(3)])
        hi = Vector([max(v.co[i] for v in bm.verts) for i in range(3)])
        info[o.name] = (bm, BVHTree.FromBMesh(bm), lo, hi, total_area(bm))
    pairs = []
    names = list(info)
    for i, a in enumerate(names):
        bm_a, bvh_a, lo_a, hi_a, area_a = info[a]
        for b in names[i + 1:]:
            bm_b, bvh_b, lo_b, hi_b, area_b = info[b]
            if any(hi_a[k] + tol < lo_b[k] or hi_b[k] + tol < lo_a[k] for k in range(3)):
                continue
            ov_a = sum(bm_a.faces[j].calc_area() for j, _ in overlapping_faces(bm_a, bvh_b, tol))
            ov_b = sum(bm_b.faces[j].calc_area() for j, _ in overlapping_faces(bm_b, bvh_a, tol))
            if not ov_a and not ov_b:
                continue
            hint_a, hint_b = any(h in a for h in OVERLAY_HINTS), any(h in b for h in OVERLAY_HINTS)
            if hint_a != hint_b:
                a_on_top = hint_a
            else:
                # накладка — объект, у которого наложение занимает большую долю поверхности
                a_on_top = ov_a / area_a >= ov_b / area_b
            pairs.append((a, b, round(max(ov_a, ov_b), 4)) if a_on_top else (b, a, round(max(ov_a, ov_b), 4)))
    for bm, *_ in info.values():
        bm.free()
    return pairs


def move_faces(obj, other, gap, front):
    """Сдвигает грани obj, лежащие на поверхности other: front=True — вперёд по нормали до зазора gap,
    front=False — назад, за поверхность other. Правится исходный меш (UV не меняются)."""
    bm_other = world_bmesh(other, True)
    bvh_other = BVHTree.FromBMesh(bm_other)
    bm_other.free()
    bm = world_bmesh(obj, False)
    shifts = {}
    for j, sep in overlapping_faces(bm, bvh_other):
        need = (gap - sep) if front else -(gap + sep)
        if (front and need <= 0) or (not front and need >= 0):
            continue
        f = bm.faces[j]
        for v in f.verts:
            # почти параллельные нормали соседних граней (скругления) не складываются, берётся больший сдвиг
            entries = shifts.setdefault(v.index, [])
            for e in entries:
                if e[0].dot(f.normal) > 0.9:
                    if abs(need) > abs(e[1]):
                        e[1] = need
                    break
            else:
                entries.append([f.normal.copy(), need])
    bm.free()
    if not shifts:
        return 0
    to_local = obj.matrix_world.inverted().to_3x3()
    done = _moved.setdefault(obj.name, {})
    count = 0
    for vi, entries in shifts.items():
        shift = sum((n * d for n, d in entries), Vector())
        total = done.get(vi, Vector()) + shift
        if total.length > MAX_SHIFT:
            total = total.normalized() * MAX_SHIFT
            shift = total - done.get(vi, Vector())
        if shift.length < 1e-6:
            continue
        done[vi] = total
        obj.data.vertices[vi].co += to_local @ shift
        count += 1
    obj.data.update()
    return count


_moved = {}   # суммарный сдвиг вершин за запуск: {объект: {вершина: вектор}}


def offset_overlay(overlay, base):
    """Накладка выходит вперёд над основой, грани основы, лежащие на накладке, уходят за неё."""
    gap = GAP_CAR if overlay.name.startswith(('Interior_', 'Car_', 'Door_', 'Subway_', 'Screen_')) else GAP_STATION
    n = move_faces(overlay, base, gap, True)
    bpy.context.view_layer.update()
    return n + move_faces(base, overlay, gap, False)


def remove_duplicate_faces(obj):
    """Удаляет точные дубликаты граней (одинаковые вершины)."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    seen, dup = set(), []
    for f in bm.faces:
        key = tuple(sorted(tuple(round(c, 4) for c in v.co) for v in f.verts))
        if key in seen:
            dup.append(f)
        else:
            seen.add(key)
    if dup:
        bmesh.ops.delete(bm, geom=dup, context='FACES_ONLY')
        bm.to_mesh(obj.data)
        obj.data.update()
    bm.free()
    return len(dup)


def run(mode, only=()):
    objs = export_objects()
    if only:
        keep = {o.name for c in only for o in bpy.data.collections[c].all_objects}
        _find = find_pairs

        def find_pairs_only(objs, tol=TOL):
            return [p for p in _find(objs, tol) if p[0] in keep or p[1] in keep]
        globals()['find_pairs'] = find_pairs_only
    pairs = find_pairs(objs, TOL if mode == 'fix' else CHECK_TOL)
    report = {'pairs': [list(p) for p in sorted(pairs, key=lambda p: -p[2])]}
    if mode == 'fix':
        moved, dups = {}, {}
        for name, shift in SHIFT_OBJECTS.items():
            o = bpy.data.objects.get(name)
            if only and name not in keep:
                continue
            if o and not o.get('overlap_shifted'):
                o.location += Vector(shift)
                o['overlap_shifted'] = True
        bpy.context.view_layer.update()
        # Несколько проходов: сдвиг одной детали может открыть наложение с соседней
        for _ in range(2):
            changed = 0
            for small, big, _ in find_pairs(objs, TOL):
                n = offset_overlay(bpy.data.objects[small], bpy.data.objects[big])
                if n:
                    key = f'{small} ← {big}'
                    moved[key] = moved.get(key, 0) + n
                    changed += 1
            bpy.context.view_layer.update()
            if not changed:
                break
        for o in objs:
            n = remove_duplicate_faces(o)
            if n:
                dups[o.name] = n
        bpy.context.view_layer.update()
        report['moved_faces'] = moved
        report['duplicate_faces_removed'] = dups
        report['left'] = [list(p) for p in find_pairs(objs, CHECK_TOL)]
        bpy.ops.wm.save_mainfile()
    return report


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else ['check']
    print('OVERLAPS ' + json.dumps(run(argv[0], argv[1:]), ensure_ascii=False))
