"""
Фотореалистичные текстуры сцены: фотосканы ambientCG (CC0) + процедурная раскладка под сцену.

Фотослой даёт настоящую поверхность материала, а раскладка (швы плит платформы,
плитка свода 7.5×15 см вразбежку со скошенными краями, штрихи шлифовки) строится здесь.
Средняя яркость и шероховатость подгоняются под прежние текстуры, чтобы не менять баланс света.

Исходники (CC0, https://ambientcg.com): Metal012, Rubber004, Gravel043, Concrete034,
Concrete030 — скачать 1K/2K-JPG и распаковать в папку <cc0>/<Имя>_<разрешение>/.

Запуск:  blender -b --factory-startup --python tools/blender/generate_photoreal.py -- <cc0>
"""
import glob
import os
import sys

import bpy
import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
_g = {'__name__': 'gt'}
exec(compile(open(os.path.join(HERE, 'generate_textures.py')).read(), 'generate_textures.py', 'exec'), _g)
load, save, gray, blur = _g['load'], _g['save'], _g['gray'], _g['blur']
normal_from_height, periodic_noise = _g['normal_from_height'], _g['periodic_noise']

PROJECT = os.path.abspath(os.path.join(HERE, '..', '..'))
SUBWAY = os.path.join(PROJECT, 'assets/models/subway_textures')
STATION = os.path.join(PROJECT, 'assets/models/station_textures')


def src(cc0, asset, kind):
    path = glob.glob(os.path.join(cc0, f'{asset}_*', f'*_{kind}.jpg'))[0]
    return load(path)[:, :, :3]


def resize(img, h, w):
    """Уменьшение усреднением блоков (размеры источника кратны целевым)."""
    H, W = img.shape[:2]
    fy, fx = H // h, W // w
    img = img[:h * fy, :w * fx]
    return img.reshape(h, fy, w, fx, -1).mean(axis=(1, 3))


def match_mean(img, target_mean):
    m = img.reshape(-1, img.shape[-1]).mean(0)
    return img * (np.asarray(target_mean) / np.maximum(m, 1e-4))


def blend_normals(a, b, k=1.0):
    """Сложение двух карт нормалей (whiteout): a, b в 0..1."""
    na, nb = a * 2 - 1, b * 2 - 1
    n = np.stack([na[..., 0] + k * nb[..., 0], na[..., 1] + k * nb[..., 1], na[..., 2] * nb[..., 2]], axis=-1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return n * 0.5 + 0.5


def steel(cc0):
    """Стены и двери вагона: пятна и неравномерный блеск Metal012 + свои штрихи шлифовки."""
    old_col = load(f'{SUBWAY}/wall_steel_color.png')[:, :, :3].reshape(-1, 3).mean(0)
    old_r = load(f'{SUBWAY}/wall_steel_roughness.png')[:, :, 1].mean()
    col = resize(src(cc0, 'Metal012', 'Color'), 512, 1024)          # сжатие 2:1 вытягивает пятна вдоль шлифовки
    lum = col.mean(axis=2, keepdims=True)
    col = lum * 0.85 + col * 0.15                                   # почти без оттенка — нержавейка
    streak = periodic_noise(512, 1024, ax=40.0, ay=0.6, falloff=1.2, seed=1)
    col = match_mean(col * (1 + 0.03 * streak[..., None]), old_col)
    rough = resize(src(cc0, 'Metal012', 'Roughness'), 512, 1024)[..., 0]
    rough = old_r * (0.75 + 0.5 * (rough / rough.mean()) * 0.5 + 0.08 * streak)
    save(f'{SUBWAY}/wall_steel_color.png', col, True)
    save(f'{SUBWAY}/wall_steel_roughness.png', gray(rough), False)


def car_floor(cc0):
    """Пол вагона: резиновое покрытие Rubber004 (цвет 1024, рельеф и блеск 512)."""
    old_col = load(f'{SUBWAY}/floor_color.png')[:, :, :3]
    old_mean = old_col.reshape(-1, 3).mean(0)
    old_r = load(f'{SUBWAY}/floor_roughness.png')[:, :, 1].mean()
    col = src(cc0, 'Rubber004', 'Color')
    # светлая крошка прежней текстуры сохраняется как вкрапления
    specks = np.clip((old_col.mean(axis=2) - np.median(old_col)) * 4, 0, 1)[..., None]
    col = match_mean(col, old_mean) * (1 - 0.6 * specks) + specks * 0.6 * np.array([0.55, 0.55, 0.53])
    save(f'{SUBWAY}/floor_color.png', col, True)
    nrm = resize(src(cc0, 'Rubber004', 'NormalGL'), 512, 512)
    save(f'{SUBWAY}/floor_normal.png', nrm, False)
    rough = resize(src(cc0, 'Rubber004', 'Roughness'), 512, 512)[..., 0]
    save(f'{SUBWAY}/floor_roughness.png', gray(old_r * rough / rough.mean()), False)


def grout_mask(prefix):
    """Швы из прежней текстуры платформы (самые тёмные линии)."""
    col = load(f'{STATION}/{prefix}_color.png')[:, :, :3]
    lum = col.mean(axis=2)
    lum_n = (lum - lum.min()) / (lum.max() - lum.min() + 1e-6)
    return np.clip((np.percentile(lum_n, 6) - lum_n) * 12, 0, 1), col


def platform(cc0, prefix, asset, darken):
    """Плиты платформы: фотофактура камня + прежняя раскладка швов."""
    grout, old_col = grout_mask(prefix)
    h, w = grout.shape
    old_mean = old_col.reshape(-1, 3).mean(0)
    old_r = load(f'{STATION}/{prefix}_roughness.png')[:, :, 1].mean()
    stone = resize(src(cc0, asset, 'Color'), h, w)
    stone = match_mean(stone, old_mean * darken)
    g = blur(grout, 1.0)[..., None]
    col = stone * (1 - 0.55 * g)
    save(f'{STATION}/{prefix}_color.png', col, True)
    nrm_photo = resize(src(cc0, asset, 'NormalGL'), h, w)
    nrm_grout = normal_from_height(-blur(grout, 1.5), 3.5)
    save(f'{STATION}/{prefix}_normal.png', blend_normals(nrm_grout, nrm_photo, 0.8), False)
    rough = resize(src(cc0, asset, 'Roughness'), h, w)[..., 0]
    rough = old_r * (0.6 + 0.4 * rough / rough.mean()) + 0.3 * blur(grout, 1.0)
    save(f'{STATION}/{prefix}_roughness.png', gray(rough), False)


def concrete(cc0):
    """Бетон тоннелей и шпал (Concrete030), 512 px."""
    save(f'{STATION}/concrete_color.png', resize(src(cc0, 'Concrete030', 'Color'), 512, 512), True)
    save(f'{STATION}/concrete_normal.png', resize(src(cc0, 'Concrete030', 'NormalGL'), 512, 512), False)
    save(f'{STATION}/concrete_roughness.png', resize(src(cc0, 'Concrete030', 'Roughness'), 512, 512), False)


def vault_tiles(cc0, size=1024, cols=16, rows=25):
    """Плитка свода: 7.5×15 см вразбежку, скошенные края, светлые швы, неровная глазурь."""
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    th, tw = size / rows, size / cols
    row = np.floor(yy / th)
    xo = xx + (row % 2) * tw / 2                                       # раскладка вразбежку
    col_i = np.floor(xo / tw) % cols
    fy = yy - row * th
    fx = xo - np.floor(xo / tw) * tw
    d = np.minimum(np.minimum(fx, tw - fx), np.minimum(fy, th - fy))   # расстояние до края плитки, px
    grout_w, bevel_w = 1.6, 5.0
    height = np.clip((d - grout_w) / bevel_w, 0, 1)
    height = height * height * (3 - 2 * height)                        # скругление фаски
    tile = (d > grout_w).astype(np.float32)
    rng = np.random.default_rng(7)
    tid = (row.astype(int) * cols + col_i.astype(int)) % (rows * cols)
    tone = rng.uniform(-0.025, 0.025, rows * cols)[tid]
    glaze = periodic_noise(size, size, falloff=1.4, seed=9)              # неровность глазури
    wave = periodic_noise(size, size, falloff=2.2, seed=8)              # лёгкая волна глазури
    white = np.array([0.93, 0.93, 0.91])
    grout_c = np.array([0.74, 0.73, 0.70])
    base = white[None, None, :] * (1 + tone[..., None] + 0.01 * glaze[..., None])
    color = base * tile[..., None] + grout_c[None, None, :] * (1 - tile[..., None])
    color *= (0.94 + 0.06 * height)[..., None]                          # фаска чуть темнее
    save(f'{STATION}/vault_tiles_color.png', color, True)
    save(f'{STATION}/vault_tiles_normal.png', normal_from_height(height * 0.9 + 0.02 * wave * tile, 2.2), False)


def run(cc0):
    steel(cc0)
    car_floor(cc0)
    platform(cc0, 'platform_dark', 'Gravel043', 0.85)
    platform(cc0, 'platform_curb', 'Concrete034', 1.0)
    concrete(cc0)
    vault_tiles(cc0)
    return 'ok'


if __name__ == '__main__':
    argv = sys.argv[sys.argv.index('--') + 1:]
    print('PHOTOREAL', run(argv[0]))
