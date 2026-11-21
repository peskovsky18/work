"""
Однократный перенос эскалатора спуска (прелоадер) в assets/models/escalator_system.blend.

Раньше эскалатор и его тоннель строились кодом createInstantEscalator() в js/subwayExterior.js.
Сцена снята с сайта в JSON и собирается тем же импортёром, что и станция (import_station.py).
Заполняющий свет тоннеля остаётся в JS.

Запуск: run('/путь/к/escalator.json', helpers, import_station_namespace)
"""

MAT_NAMES = [
    'M_Esc_Arch_Tiles', 'M_Esc_Rib', 'M_Esc_Rib_Bolt', 'M_Esc_Cove_Housing', 'M_Esc_Cove_Light', 'M_Esc_Light',
    'M_Esc_Portal_Surround', 'M_Esc_Glow_Panel', 'M_Esc_Glow_Panel', 'M_Esc_Archivolt', 'M_Esc_Comb_Plate',
    'M_Esc_Truss_Bed', 'M_Esc_Balustrade', 'M_Esc_Deck', 'M_Esc_Chrome_Trim', 'M_Esc_LED_Cove', 'M_Esc_Handrail',
    'M_Esc_Brush', 'M_Esc_Tread', 'M_Esc_Riser', 'M_Esc_Pedestal', 'M_Esc_Safety_Yellow', 'M_Esc_Stop_Red',
    'M_Esc_Pilot_Green', 'M_Esc_Pilot_Red',
]

TEX_NAMES = {
    'esc_tex_0': 'esc_arch_color', 'esc_tex_1': 'esc_arch_normal', 'esc_tex_2': 'esc_arch_roughness',
    'esc_tex_3': 'esc_balustrade_steel', 'esc_tex_4': 'esc_step_tread', 'esc_tex_5': 'esc_step_riser',
}

COLLECTIONS = {
    'Tunnel': ['Esc_Arch_Tiles', 'Esc_Rib', 'Esc_Rib_Bolt', 'Esc_Cove_Housing', 'Esc_Cove_Light', 'Esc_Light',
               'Esc_Portal_Surround', 'Esc_Glow_Panel', 'Esc_Archivolt'],
    'Escalator': ['Esc_Balustrade', 'Esc_Deck', 'Esc_Chrome_Trim', 'Esc_LED_Cove', 'Esc_Handrail', 'Esc_Brush',
                  'Esc_Tread', 'Esc_Riser', 'Esc_Truss_Bed', 'Esc_Comb_Plate'],
    'Controls': ['Esc_Pedestal', 'Esc_Safety_Yellow', 'Esc_Stop_Red', 'Esc_Pilot_Green', 'Esc_Pilot_Red'],
}


def run(json_path, helpers, importer):
    return importer['run'](json_path, helpers, MAT_NAMES, TEX_NAMES, COLLECTIONS)
