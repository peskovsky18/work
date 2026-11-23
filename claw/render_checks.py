"""Проверочные кадры из сохранённой сцены: Blender -b claw/claw_machine.blend --python claw/render_checks.py [-- --fast Cam_Close]"""
import os
import sys

import bpy

ARGS = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
HERE = os.path.dirname(os.path.abspath(__file__))
sc = bpy.context.scene
prefs = bpy.context.preferences.addons['cycles'].preferences
prefs.compute_device_type = 'METAL'
prefs.get_devices()
for d in prefs.devices:
    d.use = True
sc.cycles.device = 'GPU'
if '--fast' in ARGS:
    sc.cycles.samples = 32
    sc.render.resolution_percentage = 50
os.makedirs(os.path.join(HERE, 'renders'), exist_ok=True)
only = [a for a in ARGS if a.startswith('Cam_')]
for name, w, h in (('Cam_Hero', 1080, 1440), ('Cam_Front', 1080, 1440), ('Cam_Close', 1440, 1080), ('Cam_Console', 1440, 1080)):
    if only and name not in only:
        continue
    sc.camera = bpy.data.objects[name]
    sc.render.resolution_x, sc.render.resolution_y = w, h
    sc.render.filepath = os.path.join(HERE, 'renders', name[4:].lower() + '.png')
    bpy.ops.render.render(write_still=True)
    print('rendered', sc.render.filepath)
