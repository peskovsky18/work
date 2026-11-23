"""
Запекание затенения (ambient occlusion) для каждой части сцены в свой атлас.

Для каждой коллекции верхнего уровня (Train, Station, Escalator):
  1. модификаторы объектов-приёмников применяются (иначе оболочки Solidify делят одни UV);
  2. каждому объекту делается второй UV-канал «LM» (Smart UV Project в своём квадрате),
     а затем квадраты раскладываются по атласу пропорционально площади, без перекрытий;
  3. Cycles запекает AO в <часть>_ao.png;
  4. атлас подключается к материалам как Occlusion (glTF occlusionTexture, texCoord 1).
Материалы, общие с другими частями, копируются (у каждой части свой атлас).
Не получают затенение и не затеняют: стекло, светящиеся поверхности, экраны, неон.

Запуск (после всех build_*.py):
  blender -b assets/models/scene.blend --python tools/blender/bake_lighting.py
"""
import math
import os

import bmesh
import bpy
import numpy as np

PARTS = {'Escalator': (1024, 'escalator_textures'), 'Station': (1024, 'station_textures'), 'Train': (1024, 'subway_textures')}
LM = 'LM'
NON_RECEIVER = ('Glass', 'Decal', 'Screen_Video', 'Dest_Display', 'Neon', 'Ceiling_Light', 'Light_Line', 'Lamp', 'Glow',
                'LED', 'Pilot', 'Tunnel_Void', 'Coupled_Interior', 'Poster_Ant', 'Poster_Monkey', 'Poster_Dolphins',
                'Poster_Lion', 'Name_Sign', 'Nav_Sign', 'Esc_Light', 'Cove_Light', 'VM_LED', 'VM_LCD', 'VM_GreenLED')
NON_OCCLUDER = ('Glass', 'Coupled_Interior', 'Tunnel_Void')
AO_DISTANCE = {'Train': 0.6, 'Station': 1.2, 'Escalator': 0.9}
# Почти не видны с маршрута камеры — затенение для них не запекаем (экономия веса GLB)
SKIP_OBJECTS = ('Car_Front_', 'Car_Rear_', 'St_Sleepers', 'St_Rail', 'St_Ballast', 'St_Tunnel_', 'Esc_Truss_Bed',
                'Esc_Rib_Bolt', 'Esc_Brush', 'Esc_Pit')
SKIP_KEYWORDS = ('Bogie', 'Wheels', 'Underframe', 'Coupler', 'HVAC')
PAD_PX = 6


def is_receiver_mat(m):
    return m is not None and not any(k in m.name for k in NON_RECEIVER)


def part_meshes(part):
    return [o for o in bpy.data.collections[part].all_objects if o.type == 'MESH']


def apply_modifiers(obj):
    if not obj.modifiers:
        return
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(obj.evaluated_get(dg), preserve_all_data_layers=True, depsgraph=dg)
    obj.modifiers.clear()
    old = obj.data
    obj.data = me
    if old.users == 0:
        bpy.data.meshes.remove(old)


def isolate_materials(part, receivers):
    """Материалы приёмников, используемые и в других частях, копируются для этой части."""
    others = {m for p in PARTS if p != part for o in part_meshes(p) for m in o.data.materials if m}
    copies = {}
    for obj in receivers:
        for i, m in enumerate(obj.data.materials):
            if m in others:
                if m.name not in copies:
                    copies[m.name] = m.copy()
                    copies[m.name].name = f'{m.name}_{part}'
                obj.data.materials[i] = copies[m.name]


def unwrap_object(obj):
    me = obj.data
    lm = me.uv_layers.get(LM)
    if lm is None:
        while len(me.uv_layers) < 1:
            me.uv_layers.new(name='UVMap')
        lm = me.uv_layers.new(name=LM)
    me.uv_layers.active = lm
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.02, area_weight=0.0,
                             correct_aspect=True, scale_to_bounds=True)
    bpy.ops.object.mode_set(mode='OBJECT')
    me.uv_layers.active = me.uv_layers[0]


def world_area(obj):
    sx, sy, sz = obj.matrix_world.to_scale()
    s = (abs(sx * sy) + abs(sy * sz) + abs(sx * sz)) / 3
    return sum(p.area for p in obj.data.polygons) * s


def shelf_pack(sides):
    """Раскладка квадратов (стороны в долях атласа) по полкам; True, если поместились."""
    order = sorted(range(len(sides)), key=lambda i: -sides[i])
    x = y = shelf_h = 0.0
    pos = [None] * len(sides)
    for i in order:
        s = sides[i]
        if x + s > 1.0:
            x, y, shelf_h = 0.0, y + shelf_h, 0.0
        if y + s > 1.0:
            return None
        pos[i] = (x, y)
        x += s
        shelf_h = max(shelf_h, s)
    return pos


def pack_atlas(receivers, size):
    areas = [max(world_area(o), 1e-4) for o in receivers]
    base = [math.sqrt(a) for a in areas]
    lo, hi = 0.0, 1.0 / max(base)
    best = None
    for _ in range(40):
        k = (lo + hi) / 2
        sides = [max(b * k, 8 / size) for b in base]
        pos = shelf_pack(sides)
        if pos:
            lo, best = k, (sides, pos)
        else:
            hi = k
    sides, pos = best
    pad = PAD_PX / size
    for obj, s, (px, py) in zip(receivers, sides, pos):
        lm = obj.data.uv_layers[LM]
        uv = np.zeros(len(lm.data) * 2, dtype=np.float32)
        lm.data.foreach_get('uv', uv)
        inner = max(s - 2 * pad, s * 0.5)
        uv = uv * inner
        uv[0::2] += px + (s - inner) / 2
        uv[1::2] += py + (s - inner) / 2
        lm.data.foreach_set('uv', uv)
    return lo


def ensure_output_group():
    name = 'glTF Material Output'
    group = bpy.data.node_groups.get(name)
    if group is None:
        group = bpy.data.node_groups.new(name, 'ShaderNodeTree')
        group.interface.new_socket('Occlusion', in_out='INPUT', socket_type='NodeSocketFloat')
    return group


def prepare_materials(receivers, img):
    mats = {m for o in receivers for m in o.data.materials if m}
    for m in mats:
        nt = m.node_tree
        for n in [n for n in nt.nodes if n.name.startswith('LM_')]:
            nt.nodes.remove(n)
        uvn = nt.nodes.new('ShaderNodeUVMap')
        uvn.name = 'LM_UV'
        uvn.uv_map = LM
        uvn.location = (-1100, -900)
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.name = 'LM_Image'
        tex.image = img
        tex.location = (-900, -900)
        nt.links.new(uvn.outputs['UV'], tex.inputs['Vector'])
        nt.nodes.active = tex
    return mats


def connect_occlusion(mats, group):
    for m in mats:
        nt = m.node_tree
        tex = nt.nodes['LM_Image']
        if not is_receiver_mat(m):
            for n in [n for n in nt.nodes if n.name.startswith('LM_')]:
                nt.nodes.remove(n)
            continue
        sep = nt.nodes.new('ShaderNodeSeparateColor')
        sep.name = 'LM_Separate'
        sep.location = (-600, -900)
        out = nt.nodes.new('ShaderNodeGroup')
        out.name = 'LM_glTF_Output'
        out.node_tree = group
        out.location = (600, -700)
        nt.links.new(tex.outputs['Color'], sep.inputs['Color'])
        nt.links.new(sep.outputs['Red'], out.inputs['Occlusion'])


def soften(img, radius=1.0):
    """Лёгкое размытие шума запекания (в пределах полей атласа)."""
    w, h = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    v = px[:, :, 0]
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.fftfreq(w)[None, :]
    g = np.exp(-2 * (np.pi * radius) ** 2 * (fx ** 2 + fy ** 2))
    v = np.real(np.fft.ifft2(np.fft.fft2(v) * g))
    px[:, :, 0] = px[:, :, 1] = px[:, :, 2] = np.clip(v, 0, 1)
    img.pixels.foreach_set(px.ravel())


def setup_cycles(samples, distance):
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.samples = samples
    scene.cycles.use_denoising = False
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        prefs.compute_device_type = 'METAL'
        prefs.get_devices()
        for d in prefs.devices:
            d.use = True
        scene.cycles.device = 'GPU'
    except Exception:
        scene.cycles.device = 'CPU'
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.light_settings.distance = distance


def bake_part(part, size, tex_folder, samples=256):
    meshes = part_meshes(part)
    skipped = [o for o in meshes if o.name.startswith(SKIP_OBJECTS) or any(k in o.name for k in SKIP_KEYWORDS)]
    receivers = [o for o in meshes if o not in skipped and any(is_receiver_mat(m) for m in o.data.materials)]
    # Пропущенные объекты не должны делить материалы с приёмниками (у них нет канала LM)
    receiver_mats = {m for o in receivers for m in o.data.materials if m}
    no_ao = {}
    for o in skipped:
        for i, m in enumerate(o.data.materials):
            if m in receiver_mats:
                if m.name not in no_ao:
                    no_ao[m.name] = m.copy()
                    no_ao[m.name].name = f'{m.name}_NoAO'
                o.data.materials[i] = no_ao[m.name]
    for o in receivers:
        if o.data.users > 1:
            o.data = o.data.copy()
        apply_modifiers(o)
    isolate_materials(part, receivers)
    for o in receivers:
        unwrap_object(o)
    density = pack_atlas(receivers, size)

    name = f'{part.lower()}_ao'
    img = bpy.data.images.get(name + '.png') or bpy.data.images.new(name + '.png', size, size, alpha=False)
    if tuple(img.size) != (size, size):
        img.scale(size, size)
    img.colorspace_settings.name = 'Non-Color'
    img.filepath_raw = f'//{tex_folder}/{name}.png'
    img.file_format = 'PNG'
    mats = prepare_materials(receivers, img)

    # Затеняют только объекты этой части; стекло и т. п. скрыты
    hidden = [o for o in bpy.context.scene.objects if o.type == 'MESH' and (
        o not in meshes or all(any(k in (m.name if m else '') for k in NON_OCCLUDER) for m in o.data.materials))]
    for o in hidden:
        o.hide_render = True
    setup_cycles(samples, AO_DISTANCE[part])
    bpy.ops.object.select_all(action='DESELECT')
    for o in receivers:
        o.select_set(True)
        o.data.uv_layers.active = o.data.uv_layers[LM]          # Cycles запекает в активный UV-канал
    bpy.context.view_layer.objects.active = receivers[0]
    bpy.ops.object.bake(type='AO', margin=PAD_PX, margin_type='EXTEND', use_clear=True, target='IMAGE_TEXTURES')
    for o in receivers:
        first = o.data.uv_layers[0]
        o.data.uv_layers.active = first
        first.active_render = True                             # TEXCOORD_0 — текстурные UV
    for o in hidden:
        o.hide_render = False
    soften(img)
    img.save()
    connect_occlusion(mats, ensure_output_group())
    bpy.ops.wm.save_mainfile()
    return {'part': part, 'receivers': len(receivers), 'density_px_per_m': round(density * size, 1)}


def run(parts=None):
    if bpy.context.object and bpy.context.object.mode != 'OBJECT':
        bpy.ops.object.mode_set(mode='OBJECT')
    out = []
    for part, (size, folder) in PARTS.items():
        if parts and part not in parts:
            continue
        out.append(bake_part(part, size, folder))
    bpy.context.scene.render.engine = 'BLENDER_EEVEE'
    bpy.ops.wm.save_mainfile()
    return out


if __name__ == '__main__':
    import sys
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    print('BAKED', run(argv or None))
