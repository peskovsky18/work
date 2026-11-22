"""
Генерация бесшовных PBR-текстур для вагона и платформы (запуск внутри Blender, нужен numpy).

Шум строится через FFT, поэтому он периодический и текстуры тайлятся без швов.
Средние цвет и шероховатость берутся из прежних текстур, чтобы общий вид сцены
не менялся, а добавлялись детали: штрихи шлифованной стали, рельеф резинового пола,
«апельсиновая корка» стеклопластика сидений, швы и микрорельеф плитки платформы.

Запуск: run(project_dir) — перезаписывает PNG в assets/models/*_textures/.
"""
import os

import bpy
import numpy as np


def periodic_noise(h, w, ax=1.0, ay=1.0, falloff=1.6, lo=0.0, seed=0):
    """Бесшовный шум: белый шум, отфильтрованный в частотной области (ax, ay — растяжение по осям)."""
    rng = np.random.default_rng(seed)
    white = rng.standard_normal((h, w))
    fy = np.fft.fftfreq(h)[:, None] * h
    fx = np.fft.fftfreq(w)[None, :] * w
    r = np.sqrt((fx * ax) ** 2 + (fy * ay) ** 2)
    amp = 1.0 / np.power(1.0 + r, falloff)
    if lo > 0:
        amp *= 1.0 - np.exp(-(r / lo) ** 2)
    out = np.real(np.fft.ifft2(np.fft.fft2(white) * amp))
    out -= out.mean()
    return out / (np.abs(out).max() + 1e-8)


def blur(img, radius):
    """Периодическое размытие (гаусс в частотной области)."""
    h, w = img.shape
    fy = np.fft.fftfreq(h)[:, None]
    fx = np.fft.fftfreq(w)[None, :]
    g = np.exp(-2 * (np.pi * radius) ** 2 * (fx ** 2 + fy ** 2))
    return np.real(np.fft.ifft2(np.fft.fft2(img) * g))


def normal_from_height(height, strength):
    dx = (np.roll(height, -1, axis=1) - np.roll(height, 1, axis=1)) * 0.5
    dy = (np.roll(height, -1, axis=0) - np.roll(height, 1, axis=0)) * 0.5
    n = np.stack([-dx * strength, -dy * strength, np.ones_like(height)], axis=-1)
    n /= np.linalg.norm(n, axis=-1, keepdims=True)
    return n * 0.5 + 0.5


def load(path):
    img = bpy.data.images.load(path, check_existing=False)
    w, h = img.size
    px = np.array(img.pixels[:], dtype=np.float32).reshape(h, w, 4)
    bpy.data.images.remove(img)
    return px


def save(path, rgb, srgb):
    """rgb: (h, w, 3) в 0..1, строки снизу вверх (порядок Blender)."""
    h, w = rgb.shape[:2]
    img = bpy.data.images.new('_gen_' + os.path.basename(path), w, h, alpha=False)
    img.colorspace_settings.name = 'sRGB' if srgb else 'Non-Color'
    px = np.ones((h, w, 4), dtype=np.float32)
    px[:, :, :3] = np.clip(rgb, 0, 1)
    img.pixels.foreach_set(px.ravel())
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()
    bpy.data.images.remove(img)


def gray(v):
    return np.repeat(v[:, :, None], 3, axis=2)


def steel(tex):
    """Шлифованная нержавеющая сталь: продольные штрихи, лёгкие пятна, вариация блеска."""
    h, w = 512, 1024
    old_col = load(f'{tex}/wall_steel_color.png')[:, :, :3].reshape(-1, 3).mean(0)
    old_rough = load(f'{tex}/wall_steel_roughness.png')[:, :, 1].mean()
    fine = periodic_noise(h, w, ax=40.0, ay=0.6, falloff=1.2, seed=1)      # тонкие штрихи вдоль U
    streak = periodic_noise(h, w, ax=25.0, ay=1.0, falloff=1.6, seed=2)    # более широкие полосы шлифовки
    mottle = periodic_noise(h, w, ax=1.0, ay=1.0, falloff=2.4, seed=3)     # крупные пятна
    color = old_col[None, None, :] * (1.0 + 0.035 * fine[..., None] + 0.03 * streak[..., None] + 0.025 * mottle[..., None])
    rough = old_rough * (1.0 + 0.22 * streak + 0.18 * mottle + 0.08 * fine)
    save(f'{tex}/wall_steel_color.png', color, True)
    save(f'{tex}/wall_steel_roughness.png', gray(rough), False)
    save(f'{tex}/wall_steel_normal.png', normal_from_height(0.6 * fine + 0.25 * streak, 2.2), False)


def floor(tex):
    """Резиновое покрытие пола: мелкий рельеф, рельеф крошки, вариация блеска (цвет прежний)."""
    col = load(f'{tex}/floor_color.png')[:, :, :3]
    # Пол тайлится 8×2 по вагону: рельефу и блеску хватает 512 px (карта нормалей с шумом тяжёлая)
    while col.shape[0] > 512:
        col = col.reshape(col.shape[0] // 2, 2, col.shape[1] // 2, 2, 3).mean(axis=(1, 3))
    h, w = col.shape[:2]
    old_rough = load(f'{tex}/floor_roughness.png')[:, :, 1].mean()
    lum = col.mean(axis=2)
    specks = np.clip((lum - lum.mean()) / (lum.std() * 4 + 1e-6), -1, 1)   # светлая крошка
    grain = periodic_noise(h, w, falloff=1.1, seed=11)
    wear = periodic_noise(h, w, falloff=2.6, seed=12)
    height = 0.55 * grain + 0.6 * blur(specks, 1.2)
    rough = old_rough * (1.0 + 0.25 * wear - 0.35 * np.clip(specks, 0, 1) + 0.08 * grain)
    save(f'{tex}/floor_normal.png', normal_from_height(height, 1.6), False)
    save(f'{tex}/floor_roughness.png', gray(rough), False)


def fiberglass(tex):
    """«Апельсиновая корка» лакированного стеклопластика сидений."""
    n = periodic_noise(256, 256, falloff=2.0, lo=3.0, seed=21)
    save(f'{tex}/fiberglass_normal.png', normal_from_height(n, 3.0), False)


def platform(tex, prefix, seed):
    """Плитка платформы: швы из тёмных линий цвета, микрорельеф камня, вариация блеска."""
    col = load(f'{tex}/{prefix}_color.png')[:, :, :3]
    h, w = col.shape[:2]
    old_rough = load(f'{tex}/{prefix}_roughness.png')[:, :, 1].mean()
    lum = col.mean(axis=2)
    lum_n = (lum - lum.min()) / (lum.max() - lum.min() + 1e-6)
    grout = np.clip((np.percentile(lum_n, 6) - lum_n) * 12, 0, 1)        # самые тёмные линии — швы
    stone = periodic_noise(h, w, falloff=1.3, seed=seed)
    patches = periodic_noise(h, w, falloff=2.5, seed=seed + 1)
    height = -1.0 * blur(grout, 1.5) + 0.12 * stone
    rough = old_rough * (1.0 + 0.2 * patches + 0.06 * stone) + 0.25 * blur(grout, 1.0)
    save(f'{tex}/{prefix}_normal.png', normal_from_height(height, 3.5), False)
    save(f'{tex}/{prefix}_roughness.png', gray(rough), False)


def worley(h, w, cells, seed):
    """Бесшовный ячеистый шум: расстояние до ближайшей и второй точки, номер ячейки."""
    rng = np.random.default_rng(seed)
    pts = rng.random((cells, cells, 2))
    yy, xx = np.mgrid[0:h, 0:w]
    gy, gx = yy * cells / h, xx * cells / w
    cy, cx = np.floor(gy).astype(int), np.floor(gx).astype(int)
    d1 = np.full((h, w), 9.0)
    d2 = np.full((h, w), 9.0)
    cid = np.zeros((h, w), dtype=np.int64)
    for dy in (-1, 0, 1):
        for dx in (-1, 0, 1):
            ny, nx = (cy + dy) % cells, (cx + dx) % cells
            p = pts[ny, nx]
            px = cx + dx + p[..., 0]
            py = cy + dy + p[..., 1]
            d = np.hypot(gx - px, gy - py)
            closer = d < d1
            d2 = np.where(closer, d1, np.minimum(d2, d))
            cid = np.where(closer, ny * cells + nx, cid)
            d1 = np.where(closer, d, d1)
    return d1, d2, cid


def ballast(tex):
    """Щебень: камни разного оттенка с тёмными промежутками (цвет, нормали, шероховатость)."""
    h = w = 256                                            # виден издалека — 256 px хватает
    d1, d2, cid = worley(h, w, 22, 51)
    rng = np.random.default_rng(52)
    tone = rng.uniform(0.55, 1.15, 22 * 22)[cid]
    warm = rng.uniform(-0.04, 0.04, 22 * 22)[cid]
    edge = np.clip((d2 - d1) * 3.0, 0, 1)                 # 0 на стыке камней
    height = np.sqrt(edge) + 0.15 * periodic_noise(h, w, falloff=1.2, seed=53)
    base = np.array([0.30, 0.29, 0.27])
    grit = 0.08 * periodic_noise(h, w, falloff=1.0, seed=54)
    color = base[None, None, :] * (tone[..., None] + grit[..., None]) * (0.35 + 0.65 * np.sqrt(edge)[..., None])
    color[..., 0] += warm * 0.3
    save(f'{tex}/ballast_color.png', color, True)
    save(f'{tex}/ballast_normal.png', normal_from_height(height, 3.0), False)
    save(f'{tex}/ballast_roughness.png', gray(0.85 + 0.1 * (1 - edge)), False)


def escalator_cleats(tex):
    """Рифление проступи и подступенка: рельеф из яркости готовых текстур (тёмные полосы — канавки)."""
    for name, strength in (('esc_step_tread', 4.0), ('esc_step_riser', 3.0)):
        col = load(f'{tex}/{name}.png')[:, :, :3]
        lum = col.mean(axis=2)
        lum = (lum - lum.min()) / (lum.max() - lum.min() + 1e-6)
        height = blur(lum, 0.8)
        save(f'{tex}/{name}_normal.png', normal_from_height(height, strength), False)


def run(project_dir):
    subway = os.path.join(project_dir, 'assets/models/subway_textures')
    station = os.path.join(project_dir, 'assets/models/station_textures')
    steel(subway)
    floor(subway)
    fiberglass(subway)
    platform(station, 'platform_dark', 31)
    platform(station, 'platform_curb', 41)
    ballast(station)
    return 'ok'
