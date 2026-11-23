"""
Современный эскалатор в две ленты (коллекция Escalator в scene.blend / scene_prebake.blend).

Коллекция Escalator пересобирается целиком: тоннель из светлых панелей с LED-линиями в своде,
две ленты ступеней (левая — подъём, правая — спуск), стеклянные балюстрады со стальными
зажимами, резиновые поручни с разворотными петлями, средний и боковые декинги, входные
плиты с жёлтыми гребёнками, светлый портал со светящейся рамкой и табло «ВЫХОД В ГОРОД»,
светящаяся торцевая панель наверху. Чёрные щёки портала (Concourse_Wall) удаляются.

Координаты Blender: x — поперёк (ось тоннеля x ≈ -3.77), y — вдоль (платформа y > -4.86,
тоннель уходит в -y), z — вверх. Уклон 30°, высота подъёма H ≈ 7.63 м.

Запуск (оба файла, затем запекание, наложения и экспорт):
  blender -b assets/models/scene_prebake.blend --python tools/blender/build_escalator.py
  blender -b assets/models/scene.blend --python tools/blender/build_escalator.py
  blender -b assets/models/scene.blend --python tools/blender/bake_lighting.py -- Escalator Station
  blender -b assets/models/scene.blend --python tools/blender/fix_overlaps.py -- fix
  blender -b assets/models/scene.blend --python tools/blender/export_glb.py
"""
import math
import os

import bmesh
import bpy
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
_h = {'__name__': 'interior_helpers'}
exec(compile(open(os.path.join(HERE, 'build_train_interior.py')).read(), 'build_train_interior.py', 'exec'), _h)
add_box, make_object, planar_uv, add_cylinder = _h['add_box'], _h['make_object'], _h['planar_uv'], _h['add_cylinder']
_m = {'__name__': 'material_helpers'}
exec(compile(open(os.path.join(HERE, 'build_subway.py')).read(), 'build_subway.py', 'exec'), _m)
_g = {'__name__': 'texture_helpers'}
exec(compile(open(os.path.join(HERE, 'generate_textures.py')).read(), 'generate_textures.py', 'exec'), _g)

TEX_DIR = os.path.normpath(os.path.join(HERE, '..', '..', 'assets', 'models', 'escalator_textures'))

# --- Раскладка (метры) --------------------------------------------------------------
LANES = (-4.605, -2.925)            # оси лент: левая — подъём, правая — спуск
STEP_HALF = 0.50                    # полуширина ступени
SKIRT = 0.515                       # юбка балюстрады от оси ленты
GLASS = 0.6225                      # плоскость стекла от оси ленты
BASE_OUT = 0.645                    # внешняя грань цоколя балюстрады
WALL_X = (-5.72, -1.82)             # стены тоннеля
TC_X = (WALL_X[0] + WALL_X[1]) / 2  # ось свода
SPRING, R_VAULT = 1.15, 1.95        # пята свода над линией ступеней, радиус свода
Z_BASE = 0.015                      # ступени нижней площадки над полом платформы
DECK = 0.20                         # декинг над линией ступеней
TAN30 = math.tan(math.radians(30))
Y_WP_BOT, Y_WP_TOP = -5.37, -18.585  # рабочие точки (переломы линии ступеней)
H = (Y_WP_BOT - Y_WP_TOP) * TAN30
R_BOT, R_TOP = 1.0, 1.5             # радиусы переходов линии ступеней
STEP = 0.40
N_STEPS = 38
Y_NOSE0 = -4.30                     # кромка первой ступени у нижней гребёнки
HR_H = 0.98                         # верх поручня над линией ступеней
HR_R_BOT, HR_R_TOP = 1.6, 2.0       # радиусы переходов поручня
LOOP_R = 0.43                       # радиус петли поручня на тумбе
Y_NEWEL_BOT, Y_NEWEL_TOP = -3.30, -20.50
Y_BASE_BOT, Y_BASE_TOP = -3.38, -20.43
Y_PORTAL = -4.86                    # плоскость фасада портала
Y_END = -21.0                       # торцевая стена наверху
HOLE = (-6.0, -1.5, 3.2)            # проём в стене станции: x0, x1, верх
GLASS_DROP = 0.072                  # верх стекла под поручнем
GLASS_BOT = 0.23                    # низ стекла над линией ступеней (внутри зажима)

# Точки переходов линии ступеней
_dB = R_BOT * math.tan(math.radians(15))
_dT = R_TOP * math.tan(math.radians(15))
Y_A = Y_WP_BOT + _dB                       # конец горизонтали внизу
Y_B = Y_WP_BOT - _dB * math.cos(math.radians(30))
Y_C = Y_WP_TOP + _dT * math.cos(math.radians(30))
Y_D = Y_WP_TOP - _dT                       # начало горизонтали наверху


def z0(y):
    """Высота линии кромок ступеней над полом платформы."""
    if y >= Y_A:
        return Z_BASE
    if y >= Y_B:
        return Z_BASE + R_BOT - math.sqrt(max(R_BOT ** 2 - (y - Y_A) ** 2, 0))
    if y >= Y_C:
        return Z_BASE + (Y_WP_BOT - y) * TAN30
    if y >= Y_D:
        return Z_BASE + H - R_TOP + math.sqrt(max(R_TOP ** 2 - (y - Y_D) ** 2, 0))
    return Z_BASE + H


def y_samples(y_hi, y_lo, arc_n=12, max_len=1.0):
    """Отсчёты по y от y_hi к y_lo: густо на переходах, не реже max_len на прямых."""
    pts = {y_hi, y_lo}
    for s, e in ((Y_A, Y_B), (Y_C, Y_D)):
        for i in range(arc_n + 1):
            y = s + (e - s) * i / arc_n
            if y_lo < y < y_hi:
                pts.add(y)
    pts = sorted(pts, reverse=True)
    out = [pts[0]]
    for y in pts[1:]:
        prev = out[-1]
        n = max(1, math.ceil((prev - y) / max_len - 1e-6))
        out += [prev - (prev - y) * i / n for i in range(1, n + 1)]
    return out


def sweep_line(bm, profile, ys, closed=True, caps=True, mi=0):
    """Профиль (x, dz) вдоль линии ступеней: вершина (x, y, z0(y) + dz)."""
    rings = [[bm.verts.new((x, y, z0(y) + dz)) for x, dz in profile] for y in ys]
    m = len(profile)
    for i in range(len(rings) - 1):
        for j in range(m if closed else m - 1):
            k = (j + 1) % m
            bm.faces.new([rings[i][j], rings[i][k], rings[i + 1][k], rings[i + 1][j]]).material_index = mi
    if closed and caps:
        bm.faces.new(rings[0]).material_index = mi
        bm.faces.new(list(reversed(rings[-1]))).material_index = mi
    return rings


def side(c, s, prof):
    """Профиль (d, dz) с выносом d от оси ленты c на сторону s (+1 вправо, -1 влево)."""
    return [(c + s * d, dz) for d, dz in prof]


def face(bm, verts, want, mi=0):
    """Грань с нормалью в сторону want."""
    f = bm.faces.new(verts)
    f.normal_update()
    if f.normal.dot(Vector(want)) < 0:
        f.normal_flip()
    f.material_index = mi
    return f


# --- Траектория поручня -----------------------------------------------------------------
def arc(cy, cz, r, a0, a1, n):
    return [(cy + r * math.cos(math.radians(a0 + (a1 - a0) * i / n)), cz + r * math.sin(math.radians(a0 + (a1 - a0) * i / n)))
            for i in range(n + 1)]


def fillet(p_prev, p_corner, p_next, r, n=16):
    a = Vector((p_prev[0] - p_corner[0], p_prev[1] - p_corner[1])).normalized()
    b = Vector((p_next[0] - p_corner[0], p_next[1] - p_corner[1])).normalized()
    ang = math.acos(max(-1.0, min(1.0, a.dot(b))))
    d = r / math.tan(ang / 2)
    s = Vector(p_corner) + a * d
    e = Vector(p_corner) + b * d
    c = Vector(p_corner) + (a + b).normalized() * (r / math.sin(ang / 2))
    a0 = math.degrees(math.atan2(s.y - c.y, s.x - c.x))
    a1 = math.degrees(math.atan2(e.y - c.y, e.x - c.x))
    if a1 - a0 > 180:
        a1 -= 360
    if a0 - a1 > 180:
        a1 += 360
    return arc(c.x, c.y, r, a0, a1, n)


def dedupe(path):
    out = []
    for p in path:
        if not out or (Vector(p) - Vector(out[-1])).length > 1e-4:
            out.append(p)
    return out


ZB_HR, ZT_HR = Z_BASE + HR_H, Z_BASE + H + HR_H
CY_B, CY_T = Y_NEWEL_BOT - LOOP_R, Y_NEWEL_TOP + LOOP_R


def handrail_main():
    """Верх поручня между петлями (y растёт от верхней тумбы к нижней)."""
    top_end, bot_end = (CY_T, ZT_HR), (CY_B, ZB_HR)
    ct, cb = (Y_WP_TOP, ZT_HR), (Y_WP_BOT, ZB_HR)
    return dedupe([top_end] + fillet(top_end, ct, cb, HR_R_TOP) + fillet(ct, cb, bot_end, HR_R_BOT) + [bot_end])


def handrail_path(tails=True):
    path = arc(CY_T, ZT_HR - LOOP_R, LOOP_R, -90, -270, 16) + handrail_main() + arc(CY_B, ZB_HR - LOOP_R, LOOP_R, 90, -90, 16)
    if tails:
        path = [(CY_T + 0.25, ZT_HR - 2 * LOOP_R)] + path + [(CY_B - 0.25, ZB_HR - 2 * LOOP_R)]
    return dedupe(path)


def path_normals(path):
    out = []
    n = len(path)
    for i in range(n):
        t = (Vector(path[min(i + 1, n - 1)]) - Vector(path[max(i - 1, 0)])).normalized()
        out.append(Vector((-t.y, t.x)))
    return out


def sweep(bm, x, path, profile, mi=0):
    """Протяжка профиля (u — по x, v — по нормали к пути в плоскости yz)."""
    rings = []
    for (y, z), nrm in zip(path, path_normals(path)):
        rings.append([bm.verts.new((x + u, y + nrm.x * v, z + nrm.y * v)) for u, v in profile])
    m = len(profile)
    for i in range(len(path) - 1):
        for j in range(m):
            k = (j + 1) % m
            bm.faces.new([rings[i][j], rings[i][k], rings[i + 1][k], rings[i + 1][j]]).material_index = mi
    bm.faces.new(list(reversed(rings[0]))).material_index = mi
    bm.faces.new(rings[-1]).material_index = mi


def handrail_profile():
    """C-профиль резинового поручня 80×35 мм."""
    w, h = 0.040, 0.035
    top = [(w * math.cos(math.radians(a)), -h * 0.45 + h * 0.45 * math.sin(math.radians(a))) for a in range(0, 181, 15)]
    lips = [(-w, -h), (-w + 0.008, -h), (-w + 0.008, -h + 0.008), (w - 0.008, -h + 0.008), (w - 0.008, -h), (w, -h)]
    return top + lips


def glass_xs():
    return [c + s * GLASS for c in LANES for s in (-1, 1)]


# --- Текстура панелей тоннеля -------------------------------------------------------------
def panel_textures():
    """Светлые эмалированные панели 1.2 × 0.65 м со швами: тайл 2 × 2 панели (2.4 × 1.3 м)."""
    h, w = 512, 1024
    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    pu, pv = w / 2.4, h / 1.3                       # пикселей на метр
    hw_, hh_ = w // 2, h // 2
    du = np.minimum(xx % hw_, hw_ - xx % hw_) / pu  # расстояние до шва, м
    dv = np.minimum(yy % hh_, hh_ - yy % hh_) / pv
    d = np.minimum(du, dv)
    groove = np.clip(1 - d / 0.005, 0, 1) ** 0.6     # шов 10 мм
    edge = np.clip(1 - d / 0.014, 0, 1) ** 2         # скруглённая кромка панели
    rng = np.random.default_rng(11)
    tint = rng.uniform(-0.025, 0.025, (2, 2))[(yy // hh_).astype(int), (xx // hw_).astype(int)]
    noise = _g['periodic_noise'](h, w, falloff=1.5, seed=7) * 0.018
    base = np.array([0.90, 0.895, 0.88])
    col = base[None, None, :] * (1 + tint + noise)[:, :, None]
    col *= (1 - 0.42 * groove - 0.04 * edge)[:, :, None]
    _g['save'](os.path.join(TEX_DIR, 'esc_panel.png'), col, True)
    height = _g['blur'](-(groove + 0.5 * edge), 0.7)
    _g['save'](os.path.join(TEX_DIR, 'esc_panel_normal.png'), _g['normal_from_height'](height, 3.0), False)


def step_textures():
    """Светлые алюминиевые ступени из прежних тёмных текстур: жёлтая окантовка остаётся, рифление светлеет."""
    for name, lift, gain in (('esc_step_tread', 0.14, 2.1), ('esc_step_riser', 0.12, 2.9)):
        col = _g['load'](os.path.join(TEX_DIR, name + '.png'))[:, :, :3]
        lum = col.mean(axis=2)
        yellow = np.clip((col[:, :, 0] - col[:, :, 2] - 0.12) / 0.15, 0, 1)[:, :, None]
        alu = np.clip(lift + lum * gain, 0, 0.82)[:, :, None] * np.array([0.97, 0.985, 1.0])[None, None, :]
        _g['save'](os.path.join(TEX_DIR, name + '_alu.png'), alu * (1 - yellow) + col * yellow, True)


def materials():
    _m['TEX_DIR'] = TEX_DIR
    _m['TEX_REL'] = '//escalator_textures/'
    for img in [i for i in bpy.data.images if i.name.startswith(('esc_panel', 'esc_step_tread_alu', 'esc_step_riser_alu'))]:
        bpy.data.images.remove(img)
    mm = _m['make_material']
    return {
        'panel': mm('M_EscM_Panel', 'ffffff', 0.40, 0.0, base_tex='esc_panel', normal_tex='esc_panel_normal', normal_strength=0.8),
        'steel': mm('M_EscM_Steel', 'ffffff', 0.30, 1.0, base_tex='esc_balustrade_steel'),
        'deck': mm('M_EscM_Deck', 'f2f2f2', 0.36, 1.0, base_tex='esc_balustrade_steel'),
        'chrome': mm('M_EscM_Chrome', 'e4e7ea', 0.14, 1.0),
        'glass': mm('M_EscM_Glass', 'e6f0f4', 0.04, 0.0, alpha=0.16),
        'handrail': mm('M_EscM_Handrail', '151515', 0.42, 0.0),
        'tread': mm('M_EscM_Tread', 'ffffff', 0.50, 0.6, base_tex='esc_step_tread_alu', normal_tex='esc_step_tread_normal', normal_strength=1.2),
        'riser': mm('M_EscM_Riser', 'ffffff', 0.50, 0.6, base_tex='esc_step_riser_alu', normal_tex='esc_step_riser_normal'),
        'comb': mm('M_EscM_Comb', 'f2b705', 0.45, 0.0),
        'plate': mm('M_EscM_FloorPlate', 'b4b8bc', 0.38, 0.85, normal_tex='esc_step_riser_normal', normal_strength=0.8),
        'pit': mm('M_EscM_Pit', '1c1d1f', 0.85, 0.0),
        'led': mm('M_EscM_LED', 'ffffff', 0.5, 0.0, emission='e6f2ff', emission_strength=4.0),
        'glow': mm('M_EscM_Glow_Panel', 'ffffff', 0.5, 0.0, emission='fff3df', emission_strength=3.5),
        'sign': mm('M_EscM_Sign', '16202c', 0.30, 0.0),
        'sign_text': mm('M_EscM_Sign_LED_Text', 'ffffff', 0.5, 0.0, emission='ffffff', emission_strength=3.0),
        'stop': mm('M_EscM_Stop_Red', 'c41425', 0.30, 0.0),
        'green': mm('M_EscM_Indicator_Green_LED', '30ff70', 0.4, 0.0, emission='30ff70', emission_strength=3.0),
        'red': mm('M_EscM_Indicator_Red_LED', 'ff3a30', 0.4, 0.0, emission='ff3a30', emission_strength=3.0),
    }


# --- Удаление старого -----------------------------------------------------------------------
def remove_old():
    esc = bpy.data.collections['Escalator']
    for o in list(esc.all_objects):
        bpy.data.objects.remove(o, do_unlink=True)
    cw = bpy.data.objects.get('Concourse_Wall')
    if cw:
        bpy.data.objects.remove(cw, do_unlink=True)
    for me in [m for m in bpy.data.meshes if m.users == 0]:
        bpy.data.meshes.remove(me)
    for c in ('Tunnel', 'Escalator_Parts', 'Controls'):
        if c not in bpy.data.collections:
            esc.children.link(bpy.data.collections.new(c))
    return {c: bpy.data.collections[c] for c in ('Tunnel', 'Escalator_Parts', 'Controls')}


# --- Ступени, площадки ------------------------------------------------------------------------
def build_steps(col, M):
    tread, riser = bmesh.new(), bmesh.new()
    uv_t, uv_r = tread.loops.layers.uv.new('UVMap'), riser.loops.layers.uv.new('UVMap')
    for c in LANES:
        x0, x1 = c - STEP_HALF, c + STEP_HALF
        for k in range(N_STEPS):
            yn = Y_NOSE0 - STEP * k
            yb, z = yn - STEP, z0(yn)
            f = tread.faces.new([tread.verts.new(p) for p in ((x0, yb, z), (x1, yb, z), (x1, yn, z), (x0, yn, z))])
            for loop, uv in zip(f.loops, ((0, 0), (1, 0), (1, 1), (0, 1))):
                loop[uv_t].uv = uv
            zl = z0(yn + STEP)
            if k and z - zl > 0.003:
                f = riser.faces.new([riser.verts.new(p) for p in ((x0, yn, zl), (x0, yn, z), (x1, yn, z), (x1, yn, zl))])
                for loop, uv in zip(f.loops, ((0, 0), (0, 1), (1, 1), (1, 0))):
                    loop[uv_r].uv = uv
    make_object('Esc_Steps_Tread', tread, [M['tread']], col, recalc=False)
    make_object('Esc_Steps_Riser', riser, [M['riser']], col, recalc=False)
    # Дно под ступенями (видно в зазорах у юбок)
    pit = bmesh.new()
    for c in LANES:
        sweep_line(pit, [(c + SKIRT, -0.25), (c - SKIRT, -0.25)], y_samples(Y_NOSE0, Y_NOSE0 - STEP * N_STEPS), closed=False)
    o = make_object('Esc_Pit', pit, [M['pit']], col, recalc=False)
    planar_uv(o)


def build_landings(col, M):
    plate, comb = bmesh.new(), bmesh.new()
    y_last = Y_NOSE0 - STEP * N_STEPS          # задний край последней ступени наверху
    for c in LANES:
        x0, x1 = c - SKIRT, c + SKIRT
        # низ: плита -4.20 … -3.38, гребёнка -4.30 … -4.20 с зубьями над ступенью
        add_box(plate, x0, x1, -4.20, Y_BASE_BOT, Z_BASE - 0.02, Z_BASE + 0.015)
        add_box(comb, x0, x1, Y_NOSE0, -4.20, Z_BASE - 0.02, Z_BASE + 0.011)
        zt = Z_BASE + H
        add_box(plate, x0, x1, Y_BASE_TOP, y_last - 0.10, zt - 0.02, zt + 0.015)
        add_box(comb, x0, x1, y_last - 0.10, y_last, zt - 0.02, zt + 0.011)
        n = 22
        for i in range(n):
            tx = x0 + 0.03 + (x1 - x0 - 0.06) * (i + 0.5) / n
            add_box(comb, tx - 0.008, tx + 0.008, Y_NOSE0 - 0.045, Y_NOSE0 + 0.002, Z_BASE + 0.002, Z_BASE + 0.009)
            add_box(comb, tx - 0.008, tx + 0.008, y_last - 0.002, y_last + 0.045, zt + 0.002, zt + 0.009)
    o = make_object('Esc_Landing_Plates', plate, [M['plate']], col)
    planar_uv(o, 0.5, 0.5)
    o = make_object('Esc_Comb_Plate', comb, [M['comb']], col)
    planar_uv(o)


# --- Балюстрады, декинги, поручни -------------------------------------------------------------
def build_balustrades(col, M):
    ys_base = y_samples(Y_BASE_BOT, Y_BASE_TOP)
    base = bmesh.new()
    prof = [(SKIRT, -0.30), (BASE_OUT, -0.30), (BASE_OUT, DECK), (0.60, DECK), (SKIRT, 0.12)]
    for c in LANES:
        for s in (-1, 1):
            sweep_line(base, side(c, s, prof), ys_base)
    o = make_object('Esc_Balustrade_Base', base, [M['steel']], col)
    planar_uv(o, 1.0, 1.0)

    decks = bmesh.new()
    mid0, mid1 = LANES[0] + BASE_OUT, LANES[1] - BASE_OUT
    sweep_line(decks, [(mid0, -0.30), (mid1, -0.30), (mid1, DECK), (mid0, DECK)], ys_base)
    ys_tun = y_samples(Y_PORTAL, Y_BASE_TOP)
    for x0, x1 in ((WALL_X[0] + 0.005, LANES[0] - BASE_OUT), (LANES[1] + BASE_OUT, WALL_X[1] - 0.005)):
        sweep_line(decks, [(x0, -0.30), (x1, -0.30), (x1, DECK), (x0, DECK)], ys_tun)
    o = make_object('Esc_Decks', decks, [M['deck']], col)
    planar_uv(o, 1.0, 1.0)

    clamp = bmesh.new()
    for x in glass_xs():
        sweep_line(clamp, [(x - 0.0245, 0.18), (x + 0.0255, 0.18), (x + 0.0255, 0.25), (x - 0.0245, 0.25)], ys_base)
    o = make_object('Esc_Glass_Clamp', clamp, [M['chrome']], col)
    planar_uv(o)

    # Стекло: верх под направляющей поручня, низ в зажиме, полукруглые торцы у тумб
    glass = bmesh.new()
    r_g = LOOP_R - GLASS_DROP
    czt, czb = ZT_HR - LOOP_R, ZB_HR - LOOP_R
    cols = []
    for i in range(13):
        a = math.radians(175 - 85 * i / 12)
        y, s = CY_T + r_g * math.cos(a), r_g * math.sin(a)
        cols.append((y, max(z0(y) + GLASS_BOT, czt - s), czt + s))
    main = handrail_main()
    for (y, z), n in list(zip(main, path_normals(main)))[1:-1]:
        yo, zo = y - n.x * GLASS_DROP, z - n.y * GLASS_DROP
        cols.append((yo, z0(yo) + GLASS_BOT, zo))
    for i in range(13):
        a = math.radians(90 - 85 * i / 12)
        y, s = CY_B + r_g * math.cos(a), r_g * math.sin(a)
        cols.append((y, max(z0(y) + GLASS_BOT, czb - s), czb + s))
    for x in glass_xs():
        bot = [glass.verts.new((x, y, zb)) for y, zb, _ in cols]
        top = [glass.verts.new((x, y, zt)) for y, _, zt in cols]
        for i in range(len(cols) - 1):
            glass.faces.new([bot[i], bot[i + 1], top[i + 1], top[i]])
    o = make_object('Esc_Balustrade_Glass', glass, [M['glass']], col, recalc=False)
    planar_uv(o)

    rails, guide = bmesh.new(), bmesh.new()
    for x in glass_xs():
        sweep(rails, x, handrail_path(), handrail_profile())
        sweep(guide, x, handrail_path(False), [(-0.011, -0.074), (0.011, -0.074), (0.011, -0.036), (-0.011, -0.036)])
    o = make_object('Esc_Handrails', rails, [M['handrail']], col, smooth=True)
    o.data.set_sharp_from_angle(angle=math.radians(50))
    planar_uv(o)
    o = make_object('Esc_Handrail_Guide', guide, [M['chrome']], col)
    planar_uv(o)


def build_controls(col, M):
    stop, green, red = bmesh.new(), bmesh.new(), bmesh.new()
    # Кнопки «Стоп»: на среднем декинге и на внешних цоколях у входа
    zt = z0(-3.6) + DECK
    add_cylinder(stop, (TC_X + 0.005, -3.62, zt - 0.005), (TC_X + 0.005, -3.62, zt + 0.018), 0.03, 20)
    for x, d in ((LANES[0] - BASE_OUT, -1), (LANES[1] + BASE_OUT, 1)):
        add_cylinder(stop, (x - d * 0.004, -3.62, Z_BASE + 0.11), (x + d * 0.016, -3.62, Z_BASE + 0.11), 0.022, 20)
    o = make_object('Esc_Stop_Red', stop, [M['stop']], col)
    planar_uv(o)
    # Табло направления на торцах цоколей: зелёное — вход на подъём, красное — спуск
    for c, bm in ((LANES[0], green), (LANES[1], red)):
        for s in (-1, 1):
            xc = c + s * (SKIRT + BASE_OUT) / 2
            y = Y_BASE_BOT + 0.003
            face(bm, [bm.verts.new(p) for p in ((xc - 0.04, y, Z_BASE + 0.07), (xc + 0.04, y, Z_BASE + 0.07),
                                                 (xc + 0.04, y, Z_BASE + 0.15), (xc - 0.04, y, Z_BASE + 0.15))], (0, 1, 0))
    make_object('Esc_Indicator_Up', green, [M['green']], col, recalc=False)
    make_object('Esc_Indicator_Down', red, [M['red']], col, recalc=False)


# --- Тоннель ------------------------------------------------------------------------------
def section(z_bottom=-0.05, arc_n=28):
    """Сечение тоннеля (x, dz): левая стена вверх, свод, правая стена вниз."""
    pts = [(WALL_X[0], z_bottom), (WALL_X[0], 0.40), (WALL_X[0], 0.80), (WALL_X[0], SPRING)]
    for i in range(1, arc_n):
        a = math.radians(180 - 180 * i / arc_n)
        pts.append((TC_X + R_VAULT * math.cos(a), SPRING + R_VAULT * math.sin(a)))
    pts += [(WALL_X[1], SPRING), (WALL_X[1], 0.80), (WALL_X[1], 0.40), (WALL_X[1], z_bottom)]
    return pts


def build_tunnel(col, M):
    ys = y_samples(Y_PORTAL, Y_END, arc_n=12, max_len=0.6)
    prof = section()
    per = [0.0]
    for a, b in zip(prof, prof[1:]):
        per.append(per[-1] + math.dist(a, b))
    along = [0.0]
    for a, b in zip(ys, ys[1:]):
        along.append(along[-1] + math.hypot(a - b, z0(a) - z0(b)))
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new('UVMap')
    rings = sweep_line(bm, prof, ys, closed=False)
    lookup = {}
    for i, ring in enumerate(rings):
        for j, v in enumerate(ring):
            lookup[v] = (along[i] / 2.4, per[j] / 1.3)
    for f in bm.faces:
        for loop in f.loops:
            loop[uv].uv = lookup[loop.vert]
    make_object('Esc_Tunnel_Lining', bm, [M['panel']], col, smooth=True, recalc=False)

    # LED: две линии в своде, карнизы у декинга, линии в юбках, средний декинг
    led = bmesh.new()
    ys_led = y_samples(Y_PORTAL - 0.05, Y_END + 0.05, max_len=1.0)
    for sgn in (-1, 1):
        phi = math.radians(35)
        d = Vector((sgn * math.sin(phi), math.cos(phi)))
        p = Vector((TC_X, SPRING)) + d * R_VAULT
        t = Vector((d.y, -d.x))
        pts = [p + t * -0.03 - d * 0.003, p + t * 0.03 - d * 0.003, p + t * 0.03 - d * 0.012, p + t * -0.03 - d * 0.012]
        sweep_line(led, [(q.x, q.y) for q in pts], ys_led)
    ys_cove = y_samples(Y_PORTAL - 0.05, Y_BASE_TOP + 0.05)
    for x0, x1 in ((WALL_X[0] + 0.010, WALL_X[0] + 0.025), (WALL_X[1] - 0.025, WALL_X[1] - 0.010)):
        sweep_line(led, [(x0, DECK - 0.002), (x1, DECK - 0.002), (x1, DECK + 0.03), (x0, DECK + 0.03)], ys_cove)
    ys_skirt = y_samples(Y_BASE_BOT - 0.02, Y_BASE_TOP + 0.02)
    for c in LANES:
        for s in (-1, 1):
            sweep_line(led, side(c, s, [(0.5095, 0.09), (0.5135, 0.09), (0.5135, 0.108), (0.5095, 0.108)]), ys_skirt)
    mid = (LANES[0] + LANES[1]) / 2
    sweep_line(led, [(mid - 0.015, DECK - 0.002), (mid + 0.015, DECK - 0.002), (mid + 0.015, DECK + 0.008),
                     (mid - 0.015, DECK + 0.008)], y_samples(Y_BASE_BOT - 0.35, Y_BASE_TOP + 0.05))
    make_object('Esc_LED_Lines', led, [M['led']], col)

    # Пол верхней площадки и торцевая стена со светящейся панелью
    top = bmesh.new()
    zt = Z_BASE + H
    face(top, [top.verts.new(p) for p in ((WALL_X[0], Y_END, zt), (WALL_X[1], Y_END, zt),
                                          (WALL_X[1], Y_BASE_TOP, zt), (WALL_X[0], Y_BASE_TOP, zt))], (0, 0, 1))
    o = make_object('Esc_Top_Floor', top, [M['plate']], col, recalc=False)
    planar_uv(o, 0.5, 0.5)
    wall = bmesh.new()
    face(wall, [wall.verts.new((x, Y_END, zt + dz)) for x, dz in section(-0.05)], (0, 1, 0))
    o = make_object('Esc_End_Wall', wall, [M['panel']], col, recalc=False)
    planar_uv(o, 2.4, 1.3)
    glow = bmesh.new()
    y = Y_END + 0.01
    face(glow, [glow.verts.new(p) for p in ((-5.05, y, zt + 0.55), (-2.49, y, zt + 0.55), (-2.49, y, zt + 2.35),
                                            (-5.05, y, zt + 2.35))], (0, 1, 0))
    make_object('Esc_Glow_Panel', glow, [M['glow']], col, recalc=False)


# --- Портал --------------------------------------------------------------------------------
def vault_bvh():
    obj = bpy.data.objects['Vault_Tiles']
    dg = bpy.context.evaluated_depsgraph_get()
    eo = obj.evaluated_get(dg)
    me = eo.to_mesh()
    bm = bmesh.new()
    bm.from_mesh(me)
    eo.to_mesh_clear()
    bm.transform(obj.matrix_world)
    bvh = BVHTree.FromBMesh(bm)
    bm.free()

    def vault_y(x, z):
        loc, _, _, _ = bvh.ray_cast(Vector((x, 0.0, z)), Vector((0, -1, 0)), 6.0)
        return loc.y if loc else -4.82
    return vault_y


def build_portal(col, M):
    vault_y = vault_bvh()
    x0, x1, ztop = HOLE
    ox0, ox1, oz = x0 - 0.03, x1 + 0.03, ztop + 0.03
    cz = Z_BASE + SPRING
    # Фасад: прямоугольник проёма станции минус сечение тоннеля
    c = Vector((TC_X, cz))
    angs = {180 - 180 * i / 32 for i in range(33)}
    for cx_ in (ox0, ox1):
        angs.add(math.degrees(math.atan2(oz - cz, cx_ - TC_X)))
    inner, outer = [], []
    for z in (0.0, 0.3, 0.6, 0.9):
        inner.append((WALL_X[0], z)); outer.append((ox0, z))
    for a in sorted(angs, reverse=True):
        r = math.radians(a)
        p = c + Vector((math.cos(r), math.sin(r))) * R_VAULT
        d = p - c
        ts = [(ox0 - c.x) / d.x if d.x < -1e-9 else 1e9, (ox1 - c.x) / d.x if d.x > 1e-9 else 1e9,
              (oz - c.y) / d.y if d.y > 1e-9 else 1e9]
        q = c + d * min(ts)
        inner.append((p.x, p.y)); outer.append((q.x, q.y))
    for z in (0.9, 0.6, 0.3, 0.0):
        inner.append((WALL_X[1], z)); outer.append((ox1, z))
    fac = bmesh.new()
    vi = [fac.verts.new((x, Y_PORTAL, z)) for x, z in inner]
    vo = [fac.verts.new((x, Y_PORTAL, z)) for x, z in outer]
    for i in range(len(inner) - 1):
        if (Vector(inner[i]) - Vector(inner[i + 1])).length < 1e-6:
            continue
        face(fac, [vi[i], vi[i + 1], vo[i + 1], vo[i]], (0, 1, 0))
    bmesh.ops.remove_doubles(fac, verts=fac.verts, dist=1e-5)
    o = make_object('Esc_Portal_Facade', fac, [M['panel']], col, recalc=False)
    planar_uv(o, 2.4, 1.3)

    # Светящаяся рамка вокруг проёма
    ring = bmesh.new()
    y = Y_PORTAL + 0.003
    def ring_pts(off):
        pts = [(WALL_X[0] - off, Z_BASE + DECK), (WALL_X[0] - off, cz)]
        for i in range(1, 32):
            a = math.radians(180 - 180 * i / 32)
            pts.append((TC_X + (R_VAULT + off) * math.cos(a), cz + (R_VAULT + off) * math.sin(a)))
        return pts + [(WALL_X[1] + off, cz), (WALL_X[1] + off, Z_BASE + DECK)]
    a_pts, b_pts = ring_pts(0.025), ring_pts(0.050)
    va = [ring.verts.new((x, y, z)) for x, z in a_pts]
    vb = [ring.verts.new((x, y, z)) for x, z in b_pts]
    for i in range(len(a_pts) - 1):
        face(ring, [va[i], va[i + 1], vb[i + 1], vb[i]], (0, 1, 0))
    make_object('Esc_Portal_LED', ring, [M['led']], col, recalc=False)

    # Откосы проёма от фасада до плитки станции и стальной наличник поверх плитки
    trim = bmesh.new()
    off = 0.012
    zs = [ztop * i / 32 for i in range(33)]
    for x, xin, want in ((x0, x0 - 0.005, (1, 0, 0)), (x1, x1 + 0.005, (-1, 0, 0))):
        for za, zb in zip(zs, zs[1:]):
            ya, yb = vault_y(xin, za) + off, vault_y(xin, zb) + off
            face(trim, [trim.verts.new(p) for p in ((x, Y_PORTAL, za), (x, Y_PORTAL, zb), (x, yb, zb), (x, ya, za))], want)
    xs = [x0 + (x1 - x0) * i / 18 for i in range(19)]
    for xa, xb in zip(xs, xs[1:]):
        ya, yb = vault_y(xa, ztop + 0.005) + off, vault_y(xb, ztop + 0.005) + off
        face(trim, [trim.verts.new(p) for p in ((xa, Y_PORTAL, ztop), (xb, Y_PORTAL, ztop), (xb, yb, ztop), (xa, ya, ztop))],
             (0, 0, -1))
    lip = 0.06
    for xa, xb in ((x0 - lip, x0), (x1, x1 + lip)):
        for za, zb in list(zip(zs, zs[1:])) + [(ztop, ztop + lip)]:
            pts = [(xa, za), (xb, za), (xb, zb), (xa, zb)]
            face(trim, [trim.verts.new((x, vault_y(x, z) + off, z)) for x, z in pts], (0, 1, 0))
    xs = [x0 + (x1 - x0) * i / 18 for i in range(19)]
    for xa, xb in zip(xs, xs[1:]):
        pts = [(xa, ztop), (xb, ztop), (xb, ztop + lip), (xa, ztop + lip)]
        face(trim, [trim.verts.new((x, vault_y(x, z) + off, z)) for x, z in pts], (0, 1, 0))
    o = make_object('Esc_Portal_Trim', trim, [M['steel']], col, recalc=False)
    planar_uv(o)

    # Табло «ВЫХОД В ГОРОД» над порталом
    sz0, sz1 = 3.42, 3.86
    sx0, sx1 = -5.20, -2.34
    front = max(vault_y(x, z) for x in (sx0, TC_X, sx1) for z in (sz0, sz1)) + 0.22
    box = bmesh.new()
    add_box(box, sx0, sx1, -4.95, front, sz0, sz1, 0)
    bmesh.ops.recalc_face_normals(box, faces=box.faces)
    f_front = next(f for f in box.faces if f.calc_center_median().y > front - 1e-4)
    res = bmesh.ops.inset_individual(box, faces=[f_front], thickness=0.03, depth=-0.008)
    for f in res['faces']:
        f.material_index = 0
    f_front.material_index = 1
    o = make_object('Esc_Sign_Box', box, [M['steel'], M['sign']], col, recalc=False)
    planar_uv(o)

    cu = bpy.data.curves.new('_sign_text', 'FONT')
    cu.body = 'ВЫХОД В ГОРОД'
    cu.align_x, cu.align_y = 'CENTER', 'CENTER'
    cu.size = 0.21
    cu.extrude = 0.0015
    cu.resolution_u = 3
    cu.space_character = 1.08
    tob = bpy.data.objects.new('_sign_text', cu)
    col.objects.link(tob)
    tob.location = ((sx0 + sx1) / 2, front - 0.008 + 0.0025, (sz0 + sz1) / 2)
    tob.rotation_euler = (math.pi / 2, 0, math.pi)
    bpy.context.view_layer.update()
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(tob.evaluated_get(dg))
    me.transform(tob.matrix_world)
    bpy.data.objects.remove(tob, do_unlink=True)
    bpy.data.curves.remove(cu)
    me.name = 'Esc_Sign_LED_Text'
    me.materials.clear()
    me.materials.append(M['sign_text'])
    txt = bpy.data.objects.new('Esc_Sign_LED_Text', me)
    col.objects.link(txt)
    planar_uv(txt)
    return {'sign_front': round(front, 3), 'text_verts': len(me.vertices)}


def run():
    if not os.path.exists(os.path.join(TEX_DIR, 'esc_panel.png')) or os.environ.get('REGEN_TEX'):
        panel_textures()
        step_textures()
    cols = remove_old()
    M = materials()
    build_steps(cols['Escalator_Parts'], M)
    build_landings(cols['Escalator_Parts'], M)
    build_balustrades(cols['Escalator_Parts'], M)
    build_controls(cols['Controls'], M)
    build_tunnel(cols['Tunnel'], M)
    info = build_portal(cols['Tunnel'], M)
    bpy.ops.wm.save_mainfile()
    objs = bpy.data.collections['Escalator'].all_objects
    info['objects'] = sorted((o.name, len(o.data.polygons)) for o in objs)
    info['faces'] = sum(len(o.data.polygons) for o in objs)
    return info


if __name__ == '__main__':
    print('BUILT', run())
