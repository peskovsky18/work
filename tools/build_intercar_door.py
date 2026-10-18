import bpy
import math

mat_steel = bpy.data.materials.get('Mat_Brushed_Steel')
mat_frame = bpy.data.materials.get('Mat_Titanium_Frame') or mat_steel
mat_rubber = bpy.data.materials.get('Mat_Rubber_Black')
mat_glass = bpy.data.materials.get('Mat_Glass')
mat_chrome = bpy.data.materials.get('Mat_Chrome')
mat_floor = bpy.data.materials.get('Mat_Subway_Floor')
mat_light = bpy.data.materials.get('Mat_Fluorescent_Light')

# Remove old solid bulkhead and simple sheet doors if present
for name in ['Car_Bulkhead_End_Left', 'Car_Bulkhead_End_Right', 'Intercar_Door_Left', 'Intercar_Door_Right']:
    obj = bpy.data.objects.get(name)
    if obj:
        bpy.data.objects.remove(obj, do_unlink=True)

# Also remove any previous generated objects with our naming pattern
for obj in list(bpy.data.objects):
    if any(prefix in obj.name for prefix in [
        'Bulkhead_End_Side', 'Bulkhead_End_Header', 'Intercar_Door_', 'Gangway_', 'Next_Car_'
    ]):
        bpy.data.objects.remove(obj, do_unlink=True)

def build_intercar_end(x_pos, sign_x, suffix):
    # sign_x: +1 for front (+X), -1 for rear (-X)
    # Doorway opening: Y in [0.76, 1.64] (centered at 1.20, width 0.88), Z in [0.00, 2.06]
    
    # 1. Bulkhead Side A (Y in [-0.04, 0.76])
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    bA = bpy.context.active_object
    bA.name = f'Bulkhead_End_SideA_{suffix}'
    bA.dimensions = (0.08, 0.80, 2.27)
    bA.location = (x_pos, 0.36, 1.135)
    bA.data.materials.append(mat_steel)
    
    # 2. Bulkhead Side B (Y in [1.64, 2.44])
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    bB = bpy.context.active_object
    bB.name = f'Bulkhead_End_SideB_{suffix}'
    bB.dimensions = (0.08, 0.80, 2.27)
    bB.location = (x_pos, 2.04, 1.135)
    bB.data.materials.append(mat_steel)
    
    # 3. Bulkhead Header Lintel (Y in [0.76, 1.64], Z in [2.06, 2.27])
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    bTop = bpy.context.active_object
    bTop.name = f'Bulkhead_End_Header_{suffix}'
    bTop.dimensions = (0.08, 0.88, 0.21)
    bTop.location = (x_pos, 1.20, 2.165)
    bTop.data.materials.append(mat_steel)
    
    # 4. Doorway Outer Frame
    # Left post
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    frL = bpy.context.active_object
    frL.name = f'Intercar_Door_Frame_PostL_{suffix}'
    frL.dimensions = (0.09, 0.05, 2.06)
    frL.location = (x_pos, 0.76, 1.03)
    frL.data.materials.append(mat_frame)
    
    # Right post
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    frR = bpy.context.active_object
    frR.name = f'Intercar_Door_Frame_PostR_{suffix}'
    frR.dimensions = (0.09, 0.05, 2.06)
    frR.location = (x_pos, 1.64, 1.03)
    frR.data.materials.append(mat_frame)
    
    # Lintel
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    frT = bpy.context.active_object
    frT.name = f'Intercar_Door_Frame_Top_{suffix}'
    frT.dimensions = (0.09, 0.93, 0.05)
    frT.location = (x_pos, 1.20, 2.06)
    frT.data.materials.append(mat_frame)
    
    # Threshold treadplate
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    thresh = bpy.context.active_object
    thresh.name = f'Intercar_Door_Threshold_{suffix}'
    thresh.dimensions = (0.16, 0.93, 0.02)
    thresh.location = (x_pos, 1.20, 0.01)
    thresh.data.materials.append(mat_chrome)
    
    # 5. Door Leaf (Stainless Steel Subway Door)
    # Lower solid panel (Z in [0.02, 0.92])
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    doorBot = bpy.context.active_object
    doorBot.name = f'Intercar_Door_Panel_Bottom_{suffix}'
    doorBot.dimensions = (0.04, 0.83, 0.90)
    doorBot.location = (x_pos - sign_x * 0.01, 1.20, 0.47)
    doorBot.data.materials.append(mat_steel)
    
    # Upper solid panel (Z in [1.82, 2.04])
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    doorTop = bpy.context.active_object
    doorTop.name = f'Intercar_Door_Panel_Top_{suffix}'
    doorTop.dimensions = (0.04, 0.83, 0.22)
    doorTop.location = (x_pos - sign_x * 0.01, 1.20, 1.93)
    doorTop.data.materials.append(mat_steel)
    
    # Side stiles of the door (left and right of the glass)
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    stileL = bpy.context.active_object
    stileL.name = f'Intercar_Door_Stile_L_{suffix}'
    stileL.dimensions = (0.04, 0.26, 0.90)
    stileL.location = (x_pos - sign_x * 0.01, 0.915, 1.37)
    stileL.data.materials.append(mat_steel)
    
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    stileR = bpy.context.active_object
    stileR.name = f'Intercar_Door_Stile_R_{suffix}'
    stileR.dimensions = (0.04, 0.26, 0.90)
    stileR.location = (x_pos - sign_x * 0.01, 1.485, 1.37)
    stileR.data.materials.append(mat_steel)
    
    # Observation Glass Window (Z in [0.93, 1.81], Y in [1.05, 1.35], width 0.30, height 0.88)
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    glass = bpy.context.active_object
    glass.name = f'Intercar_Door_Glass_{suffix}'
    glass.dimensions = (0.01, 0.30, 0.88)
    glass.location = (x_pos - sign_x * 0.01, 1.20, 1.37)
    glass.data.materials.append(mat_glass)
    
    # Black Rubber Window Gasket
    # Top & bottom gasket trim
    for gz in [0.925, 1.815]:
        bpy.ops.mesh.primitive_cube_add(size=1.0)
        g = bpy.context.active_object
        g.name = f'Intercar_Door_Gasket_H_{suffix}_{gz:.2f}'
        g.dimensions = (0.042, 0.32, 0.02)
        g.location = (x_pos - sign_x * 0.01, 1.20, gz)
        g.data.materials.append(mat_rubber)
    for gy in [1.045, 1.355]:
        bpy.ops.mesh.primitive_cube_add(size=1.0)
        g = bpy.context.active_object
        g.name = f'Intercar_Door_Gasket_V_{suffix}_{gy:.2f}'
        g.dimensions = (0.042, 0.02, 0.88)
        g.location = (x_pos - sign_x * 0.01, gy, 1.37)
        g.data.materials.append(mat_rubber)
        
    # Vertical Polished Chrome Push / Grab Bar Handle
    bpy.ops.mesh.primitive_cylinder_add(radius=0.016, depth=0.60, vertices=16)
    handle = bpy.context.active_object
    handle.name = f'Intercar_Door_Handle_Bar_{suffix}'
    handle.location = (x_pos - sign_x * 0.065, 1.48, 1.15)
    handle.data.materials.append(mat_chrome)
    
    # Handle brackets
    for bz in [0.88, 1.42]:
        bpy.ops.mesh.primitive_cylinder_add(radius=0.012, depth=0.05, vertices=12)
        brk = bpy.context.active_object
        brk.name = f'Intercar_Door_Handle_Bracket_{suffix}_{bz:.2f}'
        brk.rotation_euler = (0, math.pi / 2, 0)
        brk.location = (x_pos - sign_x * 0.04, 1.48, bz)
        brk.data.materials.append(mat_chrome)
        
    # Door Header Sign ("СЛЕДУЮЩИЙ ВАГОН" indicator)
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    sign = bpy.context.active_object
    sign.name = f'Intercar_Door_Sign_Indicator_{suffix}'
    sign.dimensions = (0.015, 0.44, 0.08)
    sign.location = (x_pos - sign_x * 0.035, 1.20, 1.95)
    sign.data.materials.append(mat_light)
    
    # 6. Accordion Gangway Bellows (Сильфон / Гармошка перехода)
    # Extends outward from the bulkhead into the intercar space
    num_folds = 7
    fold_depth = 0.16
    for f_idx in range(num_folds):
        fold_x = x_pos + sign_x * (0.12 + f_idx * fold_depth)
        
        # Top bellow rib
        bpy.ops.mesh.primitive_cube_add(size=1.0)
        ribT = bpy.context.active_object
        ribT.name = f'Gangway_Bellow_Top_{suffix}_{f_idx}'
        ribT.dimensions = (0.07, 1.04, 0.08)
        ribT.location = (fold_x, 1.20, 2.14)
        ribT.data.materials.append(mat_rubber)
        
        # Left bellow rib
        bpy.ops.mesh.primitive_cube_add(size=1.0)
        ribL = bpy.context.active_object
        ribL.name = f'Gangway_Bellow_SideL_{suffix}_{f_idx}'
        ribL.dimensions = (0.07, 0.08, 2.14)
        ribL.location = (fold_x, 0.70, 1.07)
        ribL.data.materials.append(mat_rubber)
        
        # Right bellow rib
        bpy.ops.mesh.primitive_cube_add(size=1.0)
        ribR = bpy.context.active_object
        ribR.name = f'Gangway_Bellow_SideR_{suffix}_{f_idx}'
        ribR.dimensions = (0.07, 0.08, 2.14)
        ribR.location = (fold_x, 1.70, 1.07)
        ribR.data.materials.append(mat_rubber)
        
    # Gangway Floor Bridge Plate (Шарнирный мостик перехода)
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    bridge = bpy.context.active_object
    bridge.name = f'Gangway_Floor_Plate_{suffix}'
    bridge.dimensions = (1.20, 0.88, 0.02)
    bridge.location = (x_pos + sign_x * 0.65, 1.20, 0.01)
    bridge.data.materials.append(mat_frame)
    
    # 7. Next Carriage Interior (Видимый интерьер второго вагона за переходом)
    next_x = x_pos + sign_x * 1.35
    # Next car portal frame
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    nxtP = bpy.context.active_object
    nxtP.name = f'Next_Car_Portal_{suffix}'
    nxtP.dimensions = (0.10, 1.10, 2.16)
    nxtP.location = (next_x, 1.20, 1.08)
    nxtP.data.materials.append(mat_steel)
    
    # Next car floor
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    nxtF = bpy.context.active_object
    nxtF.name = f'Next_Car_Floor_{suffix}'
    nxtF.dimensions = (1.50, 2.40, 0.04)
    nxtF.location = (next_x + sign_x * 0.75, 1.20, -0.02)
    nxtF.data.materials.append(mat_floor)
    
    # Next car ceiling light
    bpy.ops.mesh.primitive_cube_add(size=1.0)
    nxtL = bpy.context.active_object
    nxtL.name = f'Next_Car_Ceiling_Light_{suffix}'
    nxtL.dimensions = (1.20, 0.35, 0.06)
    nxtL.location = (next_x + sign_x * 0.70, 1.20, 2.22)
    nxtL.data.materials.append(mat_light)

# Build front intercar door (+X = 5.84, leading into Car 02)
build_intercar_end(5.84, 1, 'Front')

# Build rear intercar door (-X = -5.84, leading into Car 00)
build_intercar_end(-5.84, -1, 'Rear')

print('Intercar gangway transition doors constructed successfully!')
bpy.ops.wm.save_mainfile()

# Export updated GLB
bpy.ops.export_scene.gltf(
    filepath='assets/models/subway.glb',
    export_format='GLB',
    use_selection=False,
    export_apply=True
)
print('Exported updated subway.glb successfully!')
