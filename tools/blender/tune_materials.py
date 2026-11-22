"""
Подстройка шероховатости материалов под освещение с картами окружения.

Без окружения глянец почти не был виден, поэтому шероховатость стен и пола держали
низкой (0.08–0.14). С отражениями окружения такие поверхности становятся зеркалами,
поэтому множители шероховатости (узел Math «Multiply» после карты roughness) подняты.
Применяется и к копиям материалов, сделанным при запекании (суффиксы _Train и т. п.).

Запуск:  blender -b assets/models/scene.blend --python tools/blender/tune_materials.py
"""
import bpy

ROUGHNESS_FACTOR = {
    'M_Wall_Steel': 1.0,          # было 0.28 → итог ≈ 0.29, сатинированная сталь
    'M_Floor': 0.75,              # было 0.35
    'M_Seat_Plinth': 0.75,
    'M_Platform_Dark_Tile': 0.85,
    'M_Platform_Curb': 0.7,
    'M_Platform_Tactile': 0.8,
}


def run():
    changed = []
    for mat in bpy.data.materials:
        base = mat.name.split('.')[0]
        key = next((k for k in ROUGHNESS_FACTOR if base == k or base.startswith(k + '_')), None)
        if key is None or not mat.use_nodes:
            continue
        bsdf = next((n for n in mat.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
        link = bsdf.inputs['Roughness'].links[0] if bsdf and bsdf.inputs['Roughness'].links else None
        if link and link.from_node.type == 'MATH' and link.from_node.operation == 'MULTIPLY':
            link.from_node.inputs[1].default_value = ROUGHNESS_FACTOR[key]
            changed.append(mat.name)
        elif bsdf:
            bsdf.inputs['Roughness'].default_value = ROUGHNESS_FACTOR[key] * 0.4
            changed.append(mat.name + ' (const)')
    bpy.ops.wm.save_mainfile()
    return changed


if __name__ == '__main__':
    print('TUNED', run())
