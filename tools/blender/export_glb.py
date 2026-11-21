"""
Экспорт открытого .blend (subway.blend, station.blend) в одноимённый .glb рядом с ним.
Draco-сжатие геометрии и WebP-текстуры.
"""
import os

import bpy


def run():
    out = os.path.splitext(bpy.data.filepath)[0] + '.glb'
    bpy.ops.export_scene.gltf(
        filepath=out,
        export_format='GLB',
        use_selection=False,
        export_yup=True,
        export_apply=True,
        export_cameras=False,
        export_lights=False,
        export_extras=False,
        export_image_format='WEBP',
        export_image_quality=90,
        export_draco_mesh_compression_enable=True,
        export_draco_mesh_compression_level=6,
        export_draco_position_quantization=14,
        export_draco_normal_quantization=10,
        export_draco_texcoord_quantization=12,
    )
    return out


if __name__ == '__main__':
    print(run())
