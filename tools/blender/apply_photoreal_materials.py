"""
Подключение новых фотореалистичных карт к материалам (запускать на scene_prebake.blend и scene.blend).

- Плитка свода и торцов (M_Vault_Tiles): карты vault_tiles_* вместо старой плитки с синими швами.
- Тоннели и шпалы (M_Tunnel_Concrete, M_Sleeper и их копии): бетон Concrete030.
Остальные материалы используют прежние файлы текстур, которые перезаписал generate_photoreal.py.

Запуск:  blender -b assets/models/scene.blend --python tools/blender/apply_photoreal_materials.py
"""
import os

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
_m = {'__name__': 'material_helpers'}
exec(compile(open(os.path.join(HERE, 'build_subway.py')).read(), 'build_subway.py', 'exec'), _m)
_m['TEX_DIR'] = os.path.join(HERE, '..', '..', 'assets', 'models', 'station_textures')
_m['TEX_REL'] = '//station_textures/'


def repoint(old_stem, new_name):
    for img in bpy.data.images:
        if img.name.startswith(old_stem):
            img.filepath = '//station_textures/' + new_name + '.png'
            img.reload()
            img.name = new_name + '.png'


def run():
    repoint('paris_metro_tiles_blue_grout', 'vault_tiles_color')
    repoint('paris_metro_tiles_normal', 'vault_tiles_normal')
    done = []
    for mat in list(bpy.data.materials):
        base = mat.name.split('.')[0]
        if base.startswith('M_Tunnel_Concrete'):
            _m['make_material'](mat.name, rough=1.0, base_tex='concrete_color', repeat=(1, 1),
                                normal_tex='concrete_normal', normal_strength=1.0, rough_tex='concrete_roughness')
            done.append(mat.name)
        elif base.startswith('M_Sleeper'):
            _m['make_material'](mat.name, rough=1.0, base_tex='concrete_color', repeat=(0.5, 0.5),
                                normal_tex='concrete_normal', normal_strength=1.0, rough_tex='concrete_roughness')
            done.append(mat.name)
    bpy.ops.wm.save_mainfile()
    return done


if __name__ == '__main__':
    print('APPLIED', run())
