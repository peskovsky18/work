"""
Текстуры автомата: печать на нижнем корпусе, экран терминала оплаты, карта.
Запуск: python3 claw/generate_textures.py  -> claw/textures/*.png
"""
import math
import os
import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'textures')
os.makedirs(OUT, exist_ok=True)
FONT_BLACK = '/System/Library/Fonts/Supplemental/Arial Black.ttf'
FONT_BOLD = '/System/Library/Fonts/Supplemental/Arial Bold.ttf'
SS = 2  # суперсэмплинг для сглаживания

CAPS = ['#ff5c9d', '#3ee0b0', '#9a6bff', '#ffd23f', '#4aa8ff', '#ff8a3d', '#f23a4f']


def font(path, size):
    return ImageFont.truetype(path, size * SS)


def hexrgb(h):
    h = h.lstrip('#')
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def gradient(w, h, c0, c1, c2=None):
    a, b = np.array(hexrgb(c0), float), np.array(hexrgb(c1), float)
    c = np.array(hexrgb(c2), float) if c2 else b
    xs, ys = np.meshgrid(np.arange(w) / w, np.arange(h) / h)
    t = (xs * 0.35 + ys * 0.65)[..., None]
    lo = a + (b - a) * np.clip(t / 0.6, 0, 1)
    hi = b + (c - b) * np.clip((t - 0.6) / 0.4, 0, 1)
    return Image.fromarray(np.where(t < 0.6, lo, hi).astype(np.uint8), 'RGB')


def capsule(d, cx, cy, r, color, angle):
    """Капсула: цветной верх, белый низ, шов и блик."""
    box = (cx - r, cy - r, cx + r, cy + r)
    d.ellipse(box, fill='#f5f3ee', outline='#1b0b3a', width=max(2, r // 14))
    d.pieslice(box, angle + 180, angle + 360, fill=color, outline='#1b0b3a', width=max(2, r // 14))
    a = math.radians(angle)
    dx, dy = math.cos(a) * r, math.sin(a) * r
    d.line((cx - dx, cy - dy, cx + dx, cy + dy), fill='#1b0b3a', width=max(3, r // 8))
    hr = r * 0.22
    hx, hy = cx - r * 0.38, cy - r * 0.42
    d.ellipse((hx - hr, hy - hr * 0.6, hx + hr, hy + hr * 0.6), fill=(255, 255, 255))


def scatter(d, w, h, count, rmin, rmax, keep_out=(), seed=1):
    rnd = random.Random(seed)
    placed = []
    tries = 0
    while len(placed) < count and tries < 5000:
        tries += 1
        r = rnd.randint(rmin, rmax)
        x, y = rnd.randint(-r // 2, w + r // 2), rnd.randint(-r // 2, h + r // 2)
        if any((x - px) ** 2 + (y - py) ** 2 < (r + pr + 6 * SS) ** 2 for px, py, pr in placed):
            continue
        if any(x0 - r < x < x1 + r and y0 - r < y < y1 + r for x0, y0, x1, y1 in keep_out):
            continue
        placed.append((x, y, r))
        capsule(d, x, y, r, rnd.choice(CAPS), rnd.randint(0, 360))


def stars(d, w, h, n, seed):
    rnd = random.Random(seed)
    k = max(1.0, min(w, h) / (1024 * SS))   # на крупных текстурах звёзды крупнее
    for _ in range(n):
        x, y, s = rnd.randint(0, w), rnd.randint(0, h), int(rnd.randint(3, 9) * SS * k)
        d.polygon([(x, y - s), (x + s * 0.3, y - s * 0.3), (x + s, y), (x + s * 0.3, y + s * 0.3), (x, y + s),
                   (x - s * 0.3, y + s * 0.3), (x - s, y), (x - s * 0.3, y - s * 0.3)], fill='#ffe9a8')


def shadow_text(img, xy, text, fnt, fill, shadow, offset, anchor='mm'):
    d = ImageDraw.Draw(img)
    x, y = xy
    for i in range(offset, 0, -SS):
        d.text((x + i, y + i), text, font=fnt, fill=shadow, anchor=anchor)
    d.text((x, y), text, font=fnt, fill=fill, anchor=anchor, stroke_width=3 * SS, stroke_fill='#1b0b3a')


def save(img, name):
    img = img.resize((img.width // SS, img.height // SS), Image.LANCZOS)
    img.save(os.path.join(OUT, name))
    print('saved', name, img.size)


# ---------------------------------------------------------------- пиксель-арт плакаты нижнего корпуса
# рисуем в низком разрешении (1 «пиксель» = 8 px текстуры) и увеличиваем без сглаживания: пиксели чёткие
PX = 8
VW, VH = 256, 236                 # панель 0.78 x 0.72 м
PRINT_W, PRINT_H = VW * PX, VH * PX
INK = '#140726'
BAYER = np.array([[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]) / 16.0


def dither_bg(colors, seed=0):
    """Вертикальный градиент по палитре с упорядоченным дизерингом, как в старых играх."""
    pal = np.array([hexrgb(c) for c in colors], np.uint8)
    ys, xs = np.mgrid[0:VH, 0:VW]
    t = (ys / (VH - 1) * 0.8 + xs / (VW - 1) * 0.2) * (len(colors) - 1)
    base = np.floor(t).astype(int)
    frac = t - base
    step = frac > BAYER[ys % 4, xs % 4]
    idx = np.clip(base + step, 0, len(colors) - 1)
    return Image.fromarray(pal[idx], 'RGB')


def px_ball(d, cx, cy, r, color, flip=False):
    """Пиксельный шар-капсула: цветной верх, белый низ, тёмный контур и шов, блик."""
    box = (cx - r, cy - r, cx + r, cy + r)
    d.ellipse(box, fill='#f5f3ee', outline=INK)
    a0, a1 = (0, 180) if flip else (180, 360)
    d.pieslice(box, a0, a1, fill=color, outline=INK)
    d.line((cx - r, cy, cx + r, cy), fill=INK)
    hy = cy + (r // 2 if flip else -r // 2)
    d.rectangle((cx - r // 2, hy - 1, cx - r // 2 + max(1, r // 4), hy), fill='#ffffff')


def px_star(d, x, y, big, color='#ffe9a8'):
    d.point((x, y), fill=color)
    for k in range(1, 3 if big else 2):
        for dx, dy in ((k, 0), (-k, 0), (0, k), (0, -k)):
            d.point((x + dx, y + dy), fill=color)


def px_text(img, xy, text, size, fill, shadow, outline=INK):
    """Пиксельная надпись: шрифт без сглаживания, тёмная обводка в 1 пиксель и сдвинутая тень."""
    d = ImageDraw.Draw(img)
    d.fontmode = '1'
    f = ImageFont.truetype(FONT_BLACK, size)
    x, y = xy
    for dx in (-1, 0, 1, 2, 3):
        for dy in (-1, 0, 1, 2, 3):
            if (dx, dy) != (0, 0):
                d.text((x + dx, y + dy), text, font=f, fill=outline, anchor='mm')
    d.text((x + 2, y + 2), text, font=f, fill=shadow, anchor='mm')
    d.text((x, y), text, font=f, fill=fill, anchor='mm')


def px_claw(d, cx, top, ball_color):
    """Пиксельная клешня держит шар: каретка, трос, ступица, три лапы."""
    d.rectangle((cx - 12, top, cx + 12, top + 8), fill='#2f6bff', outline=INK)
    d.rectangle((cx - 9, top + 2, cx - 6, top + 5), fill=INK)
    d.line((cx, top + 9, cx, top + 26), fill='#c9ccd1', width=2)
    d.rectangle((cx - 6, top + 26, cx + 6, top + 32), fill='#c9ccd1', outline=INK)
    by = top + 50
    px_ball(d, cx, by, 13, ball_color)
    for sgn in (-1, 1):
        pts = [(cx + sgn * 5, top + 32), (cx + sgn * 15, top + 38), (cx + sgn * 18, by), (cx + sgn * 12, by + 12)]
        d.line(pts, fill=INK, width=4)
        d.line(pts, fill='#e8eaee', width=2)
    d.line((cx, top + 32, cx, top + 37), fill='#e8eaee', width=2)


def scatter_px(d, count, rmin, rmax, keep_out, seed, area=(0, 0, VW, VH)):
    rnd = random.Random(seed)
    placed = []
    tries = 0
    x0, y0, x1, y1 = area
    while len(placed) < count and tries < 4000:
        tries += 1
        r = rnd.randint(rmin, rmax)
        x, y = rnd.randint(x0, x1), rnd.randint(y0, y1)
        if any((x - px) ** 2 + (y - py) ** 2 < (r + pr + 3) ** 2 for px, py, pr in placed):
            continue
        if any(a - r < x < c + r and b - r < y < e + r for a, b, c, e in keep_out):
            continue
        placed.append((x, y, r))
        px_ball(d, x, y, r, rnd.choice(CAPS), flip=rnd.random() < 0.3)


def save_px(img, name):
    img.resize((VW * PX, VH * PX), Image.NEAREST).save(os.path.join(OUT, name))
    print('saved', name, (VW * PX, VH * PX))


def print_front():
    """Спереди: верхнюю треть закрывает пульт, слева внизу дверца приза. «МОИ ПРОЕКТЫ» справа, шары вокруг."""
    img = dither_bg(['#12062a', '#24095a', '#3d0f8e', '#6a16c4', '#a01ccf'])
    d = ImageDraw.Draw(img)
    rnd = random.Random(4)
    for _ in range(40):
        px_star(d, rnd.randint(0, VW), rnd.randint(70, VH), rnd.random() < 0.3)
    cx = 168
    text = (cx - 80, 90, cx + 80, 150)
    door = (0, 136, 84, VH)
    scatter_px(d, 28, 6, 12, [text, door], seed=11, area=(0, 78, VW, VH))
    px_text(img, (cx, 106), 'МОИ', 28, '#ffffff', '#ff2bd6')
    px_text(img, (cx, 134), 'ПРОЕКТЫ', 25, '#ffd23f', '#ff2bd6')
    save_px(img, 'print_front.png')


def print_side():
    """Бока и зад: пиксельная клешня с шаром, большое PLAY, полоса огоньков и шары."""
    img = dither_bg(['#12062a', '#1d0a52', '#2a1a9a', '#5a1aff', '#c21cc4'])
    d = ImageDraw.Draw(img)
    rnd = random.Random(8)
    for _ in range(46):
        px_star(d, rnd.randint(0, VW), rnd.randint(0, VH), rnd.random() < 0.3)
    band = (0, 112, VW, 162)
    claw = (98, 0, 158, 100)
    scatter_px(d, 26, 6, 13, [band, claw], seed=23)
    px_claw(d, VW // 2, 10, '#ff2bd6')
    d.rectangle(band, fill=INK)
    for i in range(0, VW, 8):
        c = ['#ff2bd6', '#8a3bff', '#2f6bff', '#ff4fa3'][(i // 8) % 4]
        d.rectangle((i + 2, band[1] + 3, i + 4, band[1] + 5), fill=c)
        d.rectangle((i + 2, band[3] - 5, i + 4, band[3] - 3), fill=c)
    px_text(img, (VW // 2, (band[1] + band[3]) // 2), 'PLAY', 36, '#ffd23f', '#ff2bd6')
    save_px(img, 'print_side.png')


def contactless(d, cx, cy, s, color, width):
    for i in range(4):
        r = s * (0.35 + i * 0.22)
        d.arc((cx - r, cy - r, cx + r, cy + r), -42, 42, fill=color, width=width)


def terminal_screen():
    w, h = 512 * SS, 640 * SS
    img = Image.new('RGB', (w, h), '#07080b')
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((24 * SS, 24 * SS, w - 24 * SS, h - 24 * SS), radius=28 * SS, outline='#2a2d36',
                        width=4 * SS)
    contactless(d, w // 2 - 60 * SS, int(h * 0.36), 150 * SS, '#ffb000', 16 * SS)
    d.text((w // 2, int(h * 0.66)), 'ОПЛАТА', font=font(FONT_BLACK, 58), fill='#ffffff', anchor='mm')
    d.text((w // 2, int(h * 0.75)), 'КАРТОЙ', font=font(FONT_BLACK, 58), fill='#ffffff', anchor='mm')
    d.text((w // 2, int(h * 0.86)), 'приложите карту', font=font(FONT_BOLD, 32), fill='#ffb000', anchor='mm')
    save(img, 'terminal_screen.png')


CARDS = [  # выбор при входе на сайт: категория работ = карта
    dict(slug='video', title='ВИДЕО', sub='видеоработы', num='0001', colors=('#2a0a5e', '#8a3bff', '#ff2bd6'),
         ink='#ffffff', accent='#ffd23f'),
    dict(slug='creative', title='КРЕАТИВ', sub='креативные и продюсерские проекты', num='0002',
         colors=('#3a1606', '#ff8a3d', '#ffd23f'), ink='#ffffff', accent='#1b0b3a'),
    dict(slug='vibecode', title='ВАЙБКОД', sub='вайбкод-проекты', num='0003', colors=('#04161a', '#0f6b6b', '#3ee0b0'),
         ink='#e9fff8', accent='#3ee0b0'),
]


def card(c):
    w, h = 1024 * SS, 646 * SS
    img = gradient(w, h, *c['colors'])
    d = ImageDraw.Draw(img)
    rnd = random.Random(c['num'])
    if c['slug'] == 'vibecode':  # строчки кода
        f = font(FONT_BOLD, 18)
        for i in range(26):
            y = 20 * SS + i * 24 * SS
            x = 520 * SS + rnd.randint(0, 6) * 20 * SS
            d.text((x, y), rnd.choice(['const', 'await', '<div>', 'return', '=>', 'vibe()', '{ }', 'npm run']),
                   font=f, fill=(62, 224, 176, 70))
    else:
        for _ in range(12):  # капсулы-узор
            r = rnd.randint(70, 170) * SS
            x, y = rnd.randint(0, w), rnd.randint(0, h)
            d.ellipse((x - r, y - r, x + r, y + r), outline=(255, 255, 255), width=2 * SS)
    img = img.filter(ImageFilter.GaussianBlur(0.8))
    d = ImageDraw.Draw(img)
    d.text((70 * SS, 70 * SS), 'PORTFOLIO PASS', font=font(FONT_BOLD, 28), fill=c['ink'], anchor='lm')
    d.text((70 * SS, 165 * SS), c['title'], font=font(FONT_BLACK, 86), fill=c['ink'], anchor='lm',
           stroke_width=2 * SS, stroke_fill='#1b0b3a')
    d.text((72 * SS, 245 * SS), c['sub'], font=font(FONT_BOLD, 30), fill=c['ink'], anchor='lm')
    contactless(d, w - 150 * SS, 110 * SS, 70 * SS, c['ink'], 8 * SS)
    d.text((70 * SS, 445 * SS), '••••  ••••  ••••  ' + c['num'], font=font(FONT_BOLD, 50), fill=c['ink'],
           anchor='lm')
    d.text((70 * SS, 555 * SS), 'A. PESKOVSKII', font=font(FONT_BOLD, 38), fill=c['ink'], anchor='lm')
    d.text((w - 70 * SS, 555 * SS), 'PLAY ONE', font=font(FONT_BLACK, 38), fill=c['accent'], anchor='rm')
    save(img, f"card_{c['slug']}.png")


DECK_W, DECK_H = 0.81, 0.16      # крышка пульта, м
DECK_PX = 2560                   # пикселей на метр


def console_deck():
    """Печать на крышке пульта: стрелки вокруг джойстика, подписи под кнопкой, картами и терминалом, динамик."""
    w, h = int(DECK_W * DECK_PX) * SS, int(DECK_H * DECK_PX) * SS
    img = gradient(w, h, '#121319', '#191a22', '#101116')
    d = ImageDraw.Draw(img)

    def px(x, y):  # метры в системе крышки (x вправо, y к стеклу) -> пиксели
        return (x + DECK_W / 2) / DECK_W * w, (1 - (y + DECK_H / 2) / DECK_H) * h

    m = DECK_PX * SS
    # тонкая рамка и мелкая сетка
    d.rounded_rectangle((6 * SS, 6 * SS, w - 6 * SS, h - 6 * SS), radius=14 * SS, outline='#ffb000', width=3 * SS)
    for gx in range(0, w, 18 * SS):
        for gy in range(0, h, 18 * SS):
            d.point((gx, gy), fill='#262833')
    # джойстик: кольцо со стрелками
    jx, jy = px(-0.24, 0.004)
    for r, col_ in ((0.058, '#2a2d38'), (0.05, '#14151b')):
        d.ellipse((jx - r * m, jy - r * m, jx + r * m, jy + r * m), fill=col_)
    d.ellipse((jx - 0.058 * m, jy - 0.058 * m, jx + 0.058 * m, jy + 0.058 * m), outline='#ff2bd6', width=3 * SS)
    for k in range(4):
        a = math.radians(90 * k)
        ca, sa = math.cos(a), -math.sin(a)
        tip = (jx + ca * 0.054 * m, jy + sa * 0.054 * m)
        bl = (jx + ca * 0.043 * m - sa * 0.008 * m, jy + sa * 0.043 * m + ca * 0.008 * m)
        br = (jx + ca * 0.043 * m + sa * 0.008 * m, jy + sa * 0.043 * m - ca * 0.008 * m)
        d.polygon([tip, bl, br], fill='#ffd23f')
    lbl = font(FONT_BLACK, 26)
    d.text(px(-0.16, -0.06), 'ДВИГАЙ', font=lbl, fill='#9aa0b4', anchor='lm')
    # кнопка: кольцо и подпись
    bx, by = px(-0.075, 0.0)
    d.ellipse((bx - 0.046 * m, by - 0.046 * m, bx + 0.046 * m, by + 0.046 * m), outline='#ffb000', width=4 * SS)
    d.text(px(-0.075, -0.062), 'ВЗЯТЬ', font=lbl, fill='#ffb000', anchor='mm')
    # карты и терминал
    d.text(px(0.11, -0.064), 'ВЫБЕРИ КАРТУ', font=font(FONT_BLACK, 22), fill='#9aa0b4', anchor='mm')
    d.text(px(0.30, -0.058), 'ОПЛАТА', font=lbl, fill='#3ee0b0', anchor='mm')
    tx, ty = px(0.30, 0.012)
    d.rounded_rectangle((tx - 0.058 * m, ty - 0.038 * m, tx + 0.058 * m, ty + 0.038 * m), radius=10 * SS,
                        outline='#3ee0b0', width=3 * SS)
    # динамик слева: сетка отверстий в круге
    sx, sy = px(-0.355, 0.0)
    d.ellipse((sx - 0.04 * m, sy - 0.04 * m, sx + 0.04 * m, sy + 0.04 * m), fill='#0b0c10', outline='#2e313d',
              width=3 * SS)
    step = 0.0065 * m
    for i in range(-6, 7):
        for j in range(-6, 7):
            x, y = sx + i * step + (step / 2 if j % 2 else 0), sy + j * step * 0.87
            if (x - sx) ** 2 + (y - sy) ** 2 < (0.034 * m) ** 2:
                d.ellipse((x - 0.0019 * m, y - 0.0019 * m, x + 0.0019 * m, y + 0.0019 * m), fill='#30333f')
    save(img, 'console_deck.png')


MARQUEE_W, MARQUEE_H = 0.79, 0.17


def marquee():
    """Подсвеченная панель вывески: градиент, лучи от центра, искры. Само имя — объёмные буквы перед ней."""
    w, h = 2048 * SS, int(2048 * MARQUEE_H / MARQUEE_W) * SS
    img = gradient(w, h, '#3a0a8e', '#8a1bff', '#ff2bd6').convert('RGBA')
    rays = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(rays)
    cx, cy = w / 2, h / 2
    for k in range(36):
        a0, a1 = math.radians(k * 10), math.radians(k * 10 + 4)
        R = w
        d.polygon([(cx, cy), (cx + R * math.cos(a0), cy + R * math.sin(a0)), (cx + R * math.cos(a1), cy + R * math.sin(a1))],
                  fill=(255, 255, 255, 26))
    img = Image.alpha_composite(img, rays)
    # мягкое свечение за буквами
    glow = Image.new('RGBA', (w, h), (0, 0, 0, 0))
    ImageDraw.Draw(glow).rounded_rectangle((w * 0.12, h * 0.22, w * 0.88, h * 0.78), radius=h * 0.3,
                                           fill=(255, 230, 255, 120))
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(h * 0.12)))
    d = ImageDraw.Draw(img)
    stars(d, w, h, 26, 9)
    # кайма
    d.rectangle((0, 0, w - 1, h - 1), outline='#1b0b3a', width=10 * SS)
    save(img.convert('RGB'), 'marquee.png')


if __name__ == '__main__':
    print_front()
    print_side()
    console_deck()
    marquee()
    terminal_screen()
    for c in CARDS:
        card(c)
