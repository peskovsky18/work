"""
Текстуры автомата: печать на нижнем корпусе, экран терминала оплаты, карта.
Запуск: python3 claw/generate_textures.py  -> claw/textures/*.png
"""
import math
import os
import random

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
    img = Image.new('RGB', (w, h))
    px = img.load()
    a, b = hexrgb(c0), hexrgb(c1)
    c = hexrgb(c2) if c2 else b
    for y in range(h):
        for x in range(w):
            t = (x / w * 0.35 + y / h * 0.65)
            if t < 0.6:
                k = t / 0.6
                col = tuple(int(a[i] + (b[i] - a[i]) * k) for i in range(3))
            else:
                k = (t - 0.6) / 0.4
                col = tuple(int(b[i] + (c[i] - b[i]) * k) for i in range(3))
            px[x, y] = col
    return img


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
    for _ in range(n):
        x, y, s = rnd.randint(0, w), rnd.randint(0, h), rnd.randint(3, 9) * SS
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


def print_front():
    w = h = 1024 * SS
    img = gradient(w, h, '#2a0a5e', '#7a1bd6', '#ff2bd6')
    d = ImageDraw.Draw(img)
    stars(d, w, h, 40, 3)
    # верхнюю четверть закрывает пульт, слева внизу дверца приза: текст по центру-справа
    text_box = (int(w * 0.22), int(h * 0.30), int(w * 0.98), int(h * 0.74))
    scatter(d, w, h, 34, 50 * SS, 105 * SS, keep_out=[text_box], seed=11)
    cx = int(w * 0.6)
    shadow_text(img, (cx, int(h * 0.42)), 'ВЫТАЩИ', font(FONT_BLACK, 112), '#ffffff', '#ffb000', 12 * SS)
    shadow_text(img, (cx, int(h * 0.55)), 'ПРОЕКТ', font(FONT_BLACK, 112), '#ffd23f', '#ff2bd6', 12 * SS)
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((cx - 270 * SS, int(h * 0.635), cx + 270 * SS, int(h * 0.705)), radius=30 * SS,
                        fill='#1b0b3a')
    d.text((cx, int(h * 0.67)), 'PESKOVSKII · PORTFOLIO', font=font(FONT_BOLD, 34), fill='#ffb000', anchor='mm')
    save(img, 'print_front.png')


def print_side():
    w = h = 1024 * SS
    img = gradient(w, h, '#2a0a5e', '#5a1aff', '#ff2bd6')
    d = ImageDraw.Draw(img)
    stars(d, w, h, 50, 5)
    band = (0, int(h * 0.40), w, int(h * 0.60))
    scatter(d, w, h, 40, 45 * SS, 95 * SS, keep_out=[band], seed=23)
    d.rectangle(band, fill='#1b0b3a')
    for i, c in enumerate(['#ff2bd6', '#8a3bff', '#2f6bff', '#ff4fa3'] * 40):
        x = i * 28 * SS
        d.ellipse((x, band[1] + 10 * SS, x + 10 * SS, band[1] + 20 * SS), fill=c)
        d.ellipse((x, band[3] - 20 * SS, x + 10 * SS, band[3] - 10 * SS), fill=c)
    shadow_text(img, (w // 2, h // 2), 'PLAY', font(FONT_BLACK, 150), '#ffd23f', '#ff2bd6', 10 * SS)
    save(img, 'print_side.png')


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


if __name__ == '__main__':
    print_front()
    print_side()
    terminal_screen()
    for c in CARDS:
        card(c)
