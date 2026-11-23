"""Экспорт автомата в GLB для сайта (без студии): Blender -b claw/claw_machine.blend --python claw/export_glb.py"""
import os

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
vl = bpy.context.view_layer
for lc in vl.layer_collection.children:
    lc.exclude = lc.collection.name != 'ClawMachine'
# студийный пол и стена нужны только для рендеров: на сайте свой пол, и они с ним мерцают
for ob in list(bpy.data.objects):
    if ob.name.startswith('Studio_'):
        bpy.data.objects.remove(ob)  # .blend не сохраняем, удаляем только в этом запуске
bpy.ops.export_scene.gltf(filepath=os.path.join(HERE, 'claw_machine.glb'), export_format='GLB', export_yup=True,
                          export_apply=True, export_cameras=False, export_lights=False, export_extras=True,
                          export_image_format='WEBP', export_image_quality=82,
                          export_draco_mesh_compression_enable=True, export_draco_mesh_compression_level=6)
print('exported', os.path.getsize(os.path.join(HERE, 'claw_machine.glb')) // 1024, 'KB')
