"""
Экспорт сцены в GLB для сайта (Draco-геометрия, WebP-текстуры).

scene.blend: каждая коллекция верхнего уровня уходит в свой файл, чтобы сайт
мог грузить их по очереди (эскалатор первым, чтобы спуск стартовал быстро):
    Escalator -> escalator_system.glb, Station -> station.glb, Train -> subway.glb
Любой другой .blend экспортируется целиком в одноимённый .glb рядом с ним.

Запуск:  blender -b assets/models/scene.blend --python tools/blender/export_glb.py
"""
import os

import bpy

PART_FILES = {'Escalator': 'escalator_system.glb', 'Station': 'station.glb', 'Train': 'subway.glb'}

OPTIONS = dict(
    export_format='GLB',
    export_yup=True,
    export_apply=True,
    export_cameras=False,
    export_lights=False,
    export_extras=False,
    export_image_format='WEBP',
    export_image_quality=82,
    export_draco_mesh_compression_enable=True,
    export_draco_mesh_compression_level=6,
    export_draco_position_quantization=14,
    export_draco_normal_quantization=10,
    export_draco_texcoord_quantization=12,
)


def find_layer_collection(layer_col, name):
    if layer_col.collection.name == name:
        return layer_col
    for child in layer_col.children:
        found = find_layer_collection(child, name)
        if found:
            return found
    return None


def run():
    folder = os.path.dirname(bpy.data.filepath)
    top = {c.name for c in bpy.context.scene.collection.children}
    if not set(PART_FILES) <= top:
        out = os.path.splitext(bpy.data.filepath)[0] + '.glb'
        bpy.ops.export_scene.gltf(filepath=out, use_selection=False, **OPTIONS)
        return [out]
    outs = []
    view_layer = bpy.context.view_layer
    for part, filename in PART_FILES.items():
        view_layer.active_layer_collection = find_layer_collection(view_layer.layer_collection, part)
        out = os.path.join(folder, filename)
        bpy.ops.export_scene.gltf(filepath=out, use_active_collection=True,
                                  use_active_collection_with_nested=True, **OPTIONS)
        outs.append(out)
    return outs


if __name__ == '__main__':
    print('EXPORTED', run())
