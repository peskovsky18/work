"""
Сборка единой сцены assets/models/scene.blend из трёх моделей сайта.

Каждая модель становится коллекцией верхнего уровня:
    Escalator <- escalator_system.blend   (экспорт: escalator_system.glb)
    Station   <- station.blend            (экспорт: station.glb)
    Train     <- subway.blend             (экспорт: subway.glb)
Пути к текстурам относительные (//…_textures/, //../images/), а scene.blend лежит
в той же папке, поэтому они остаются рабочими.

Запуск:  blender -b --factory-startup --python tools/blender/assemble_scene.py
"""
import os

import bpy

MODELS_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..', 'assets', 'models'))
PARTS = [('Escalator', 'escalator_system.blend'), ('Station', 'station.blend'), ('Train', 'subway.blend')]


def append_part(part_name, blend_name):
    path = os.path.join(MODELS_DIR, blend_name)
    with bpy.data.libraries.load(path, link=False) as (src, dst):
        dst.objects = list(src.objects)
        dst.collections = list(src.collections)
    # Внутренние коллекции с именем части (например, Escalator внутри эскалатора) переименовываем
    for col in dst.collections:
        if col and col.name in {p for p, _ in PARTS}:
            col.name = col.name + '_Parts'
    root = bpy.data.collections.new(part_name)
    bpy.context.scene.collection.children.link(root)
    # Коллекции модели переносим внутрь корня части, сохраняя их вложенность
    loaded_cols = [c for c in dst.collections if c]
    child_names = {ch.name for c in loaded_cols for ch in c.children}
    for col in loaded_cols:
        if col.name not in child_names:
            root.children.link(col)
    # Объекты вне коллекций модели — прямо в корень части
    in_cols = {o.name for c in loaded_cols for o in c.all_objects}
    for obj in dst.objects:
        if obj and obj.name not in in_cols:
            root.objects.link(obj)
    return root


def run():
    bpy.ops.wm.read_homefile(use_empty=True)
    bpy.context.preferences.filepaths.use_relative_paths = True
    out = os.path.join(MODELS_DIR, 'scene.blend')
    # Сохраняем заранее, чтобы относительные пути считались от папки моделей
    bpy.ops.wm.save_as_mainfile(filepath=out)
    for part, blend in PARTS:
        root = append_part(part, blend)
        print('PART', part, len(root.all_objects))
    for img in bpy.data.images:
        if img.filepath and not img.filepath.startswith('//'):
            img.filepath = bpy.path.relpath(img.filepath)
    bpy.ops.wm.save_mainfile()
    print('SAVED', out)


if __name__ == '__main__':
    run()
