"""
Фаски на коробчатой геометрии станции, чтобы рёбра ловили блики.

Меши, снятые с сайта, хранят каждую грань с отдельными вершинами, поэтому сначала
вершины склеиваются, затем добавляется модификатор Bevel (применяется при экспорте GLB).
Запуск в открытом station.blend: run()
"""
import bmesh
import bpy

BEVEL_OBJECTS = {
    'Column': 0.018,
    'Column_Cuff': 0.008,
    'Concourse_Wall': 0.012,
}


def run():
    done = []
    for name, width in BEVEL_OBJECTS.items():
        obj = bpy.data.objects.get(name)
        if obj is None:
            continue
        me = obj.data
        bm = bmesh.new()
        bm.from_mesh(me)
        bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0005)
        bmesh.ops.dissolve_limit(bm, angle_limit=0.01, verts=bm.verts, edges=bm.edges)
        bm.to_mesh(me)
        bm.free()
        if me.has_custom_normals:
            with bpy.context.temp_override(object=obj, active_object=obj):
                bpy.ops.mesh.customdata_custom_splitnormals_clear()
        for p in me.polygons:
            p.use_smooth = False
        mod = obj.modifiers.get('Bevel') or obj.modifiers.new('Bevel', 'BEVEL')
        mod.width = width
        mod.segments = 2
        mod.limit_method = 'ANGLE'
        mod.harden_normals = True
        done.append((name, len(me.vertices)))
    bpy.ops.wm.save_mainfile()
    return done
