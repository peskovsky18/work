"""
Страницы газеты, которая лежит на кресле в вагоне: креативы и вайбкод-проекты.

Пока это макет: заголовки настоящие, текст обозначен серыми «строками», места
под работы — серые блоки с подписью («Креатив 1», «Проект 1»). Координаты блоков
пишутся в news_layout.json — по нему build_newspaper.py ставит в модель отдельные
плоскости News_Slot_*, на которые сайт позже положит картинки работ.

Газета — таблоид, сложенный пополам: 4 полосы.
    1 — первая полоса (видна, пока газета лежит на кресле)
    2, 3 — разворот (креативы слева, проекты справа)
    4 — последняя полоса (снизу, на кресле)

Запуск (обычный Python с Pillow, не Blender):
    python3 tools/blender/generate_newspaper_textures.py
Шрифты PT Serif и PT Sans (лицензия OFL) берутся из системы macOS.
"""
import json
import os
import random

from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'assets', 'models', 'newspaper_textures')

# Размер полосы в модели (м) и в пикселях макета. Разворот (2|3) — 2048×1390,
# обложка (1|4) рисуется в том же масштабе и уменьшается до 1536×1042.
PAGE_M = (0.28, 0.38)
PW, PH = 1024, 1390
COVER_SCALE = 0.75

FONTS = '/System/Library/Fonts/Supplemental/'
SERIF = (FONTS + 'PTSerif.ttc', 0)
SERIF_BOLD = (FONTS + 'PTSerif.ttc', 3)
SERIF_ITALIC = (FONTS + 'PTSerif.ttc', 1)
NARROW_BOLD = (FONTS + 'PTSans.ttc', 2)
SANS = (FONTS + 'PTSans.ttc', 0)

PAPER = (238, 233, 220)
INK = (27, 26, 24)
TEXT_GREY = (70, 67, 61)
BAR = (112, 107, 98)       # «строки» текста — светлее заголовков, как газетный набор
RULE = (60, 58, 53)
PLACEHOLDER = (214, 208, 195)
PLACEHOLDER_LINE = (176, 170, 158)
AMBER = (245, 166, 35)   # тот же янтарь, что в интерфейсе сайта

MARGIN = 56


def font(spec, size):
    return ImageFont.truetype(spec[0], size, index=spec[1])


def paper(w, h, seed):
    """Газетная бумага: ровный тон с едва заметным зерном."""
    img = Image.new('RGB', (w, h), PAPER)
    rnd = random.Random(seed)
    px = img.load()
    for _ in range(w * h // 40):
        x, y = rnd.randrange(w), rnd.randrange(h)
        d = rnd.choice((-7, -5, 4))
        r, g, b = px[x, y]
        px[x, y] = (r + d, g + d, b + d)
    return img


def text_lines(d, box, rnd, line_h=26, bar_h=8, indent_every=7):
    """Серые «строки» вместо текста: издали читаются как набор, вблизи видно, что это макет."""
    x0, y0, x1, y1 = box
    y = y0
    n = 0
    while y + bar_h <= y1:
        x = x0 + (34 if n % indent_every == 0 else 0)
        last = n % indent_every == indent_every - 1
        right = x0 + (x1 - x0) * (rnd.uniform(0.35, 0.8) if last else 1.0)
        while x < right - 24:
            w = min(rnd.randint(26, 104), int(right - x))
            d.rectangle((x, y, x + w, y + bar_h), fill=BAR)
            x += w + 11
        y += line_h
        n += 1


def columns(d, box, count, rnd, gap=28, **kw):
    x0, y0, x1, y1 = box
    cw = (x1 - x0 - gap * (count - 1)) / count
    for i in range(count):
        cx = x0 + i * (cw + gap)
        text_lines(d, (cx, y0, cx + cw, y1), rnd, **kw)
        if i:
            d.line((cx - gap / 2, y0, cx - gap / 2, y1), fill=PLACEHOLDER_LINE, width=2)


def placeholder(d, box, label, note):
    """Место под работу: серый блок с диагоналями и подписью."""
    x0, y0, x1, y1 = box
    d.rectangle(box, fill=PLACEHOLDER, outline=RULE, width=3)
    d.line((x0, y0, x1, y1), fill=PLACEHOLDER_LINE, width=3)
    d.line((x0, y1, x1, y0), fill=PLACEHOLDER_LINE, width=3)
    size = max(30, min(64, int((x1 - x0) / 7)))
    f = font(NARROW_BOLD, size)
    fn = font(SANS, max(18, size // 2))
    cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
    for text, fnt, dy, col in ((label, f, -size * 0.35, INK), (note, fn, size * 0.55, TEXT_GREY)):
        tw = d.textlength(text, font=fnt)
        tb = fnt.getbbox(text)
        pad = 10
        ty = cy + dy - (tb[3] - tb[1]) / 2 - tb[1]
        d.rectangle((cx - tw / 2 - pad, ty + tb[1] - pad / 2, cx + tw / 2 + pad, ty + tb[3] + pad / 2), fill=PLACEHOLDER)
        d.text((cx - tw / 2, ty), text, font=fnt, fill=col)


def running_head(d, number, title, right_side):
    f = font(SANS, 24)
    y = 46
    left, right = (f'{number}', title) if not right_side else (title, f'{number}')
    d.text((MARGIN, y), left, font=f, fill=INK)
    tw = d.textlength(right, font=f)
    d.text((PW - MARGIN - tw, y), right, font=f, fill=INK)
    d.line((MARGIN, y + 40, PW - MARGIN, y + 40), fill=RULE, width=3)


def section_title(d, text, sub, y=110):
    f = font(NARROW_BOLD, 104)
    d.text((MARGIN - 4, y), text, font=f, fill=INK)
    d.rectangle((MARGIN, y + 132, MARGIN + 120, y + 142), fill=AMBER)
    d.text((MARGIN + 140, y + 120), sub, font=font(SERIF_ITALIC, 30), fill=TEXT_GREY)


def caption(d, x, y, w, title, rnd, lines=2):
    d.text((x, y), title, font=font(NARROW_BOLD, 34), fill=INK)
    text_lines(d, (x, y + 52, x + w, y + 52 + lines * 26), rnd, indent_every=99)


def norm(page, box):
    """Блок в долях полосы: x — слева направо, y — сверху вниз."""
    x0, y0, x1, y1 = box
    return {'page': page, 'x0': x0 / PW, 'y0': y0 / PH, 'x1': x1 / PW, 'y1': y1 / PH}


def page_cover(slots):
    img = paper(PW, PH, 1)
    d = ImageDraw.Draw(img)
    rnd = random.Random(11)
    # Шапка
    d.rectangle((MARGIN, 48, PW - MARGIN, 236), fill=AMBER)
    f = font(SERIF_BOLD, 132)
    t = 'Песковский'
    tw = d.textlength(t, font=f)
    d.text(((PW - tw) / 2, 60), t, font=f, fill=INK)
    d.line((MARGIN, 262, PW - MARGIN, 262), fill=RULE, width=2)
    fs = font(SANS, 26)
    d.text((MARGIN, 272), 'Креативы и вайбкод-проекты', font=fs, fill=INK)
    t = 'Выпуск № 1 · 2026'
    d.text((PW - MARGIN - d.textlength(t, font=fs), 272), t, font=fs, fill=INK)
    d.line((MARGIN, 314, PW - MARGIN, 314), fill=RULE, width=2)
    # Заголовок номера
    d.text((MARGIN - 4, 336), 'Новые работы на развороте', font=font(NARROW_BOLD, 82), fill=INK)
    # Главная работа номера
    box = (MARGIN, 456, PW - MARGIN, 960)
    placeholder(d, box, 'Главная работа', 'место для картинки')
    slots['F1'] = norm(1, box)
    caption(d, MARGIN, 978, PW - 2 * MARGIN, 'Подпись к главной работе', rnd, lines=1)
    columns(d, (MARGIN, 1080, PW - MARGIN, PH - 70), 3, rnd)
    d.text((MARGIN, PH - 56), 'Креативы — с. 2   ·   Проекты — с. 3', font=font(SANS, 24), fill=INK)
    return img


def page_creatives(slots):
    img = paper(PW, PH, 2)
    d = ImageDraw.Draw(img)
    rnd = random.Random(22)
    running_head(d, 2, 'Креативы', right_side=False)
    section_title(d, 'Креативы', 'реклама, визуалы, идеи')
    box = (MARGIN, 290, PW - MARGIN, 760)
    placeholder(d, box, 'Креатив 1', 'место для картинки')
    slots['C1'] = norm(2, box)
    caption(d, MARGIN, 776, PW - 2 * MARGIN, 'Креатив 1', rnd)
    half = (PW - 2 * MARGIN - 32) // 2
    for i, x in enumerate((MARGIN, MARGIN + half + 32)):
        box = (x, 900, x + half, 1170)
        name = f'Креатив {i + 2}'
        placeholder(d, box, name, 'место для картинки')
        slots[f'C{i + 2}'] = norm(2, box)
        caption(d, x, 1186, half, name, rnd)
    return img


def page_projects(slots):
    img = paper(PW, PH, 3)
    d = ImageDraw.Draw(img)
    rnd = random.Random(33)
    running_head(d, 3, 'Вайбкод-проекты', right_side=True)
    section_title(d, 'Вайбкод-проекты', 'сайты и приложения')
    for i in range(3):
        y = 300 + i * 345
        box = (MARGIN, y, MARGIN + 420, y + 280)
        name = f'Проект {i + 1}'
        placeholder(d, box, name, 'скриншот')
        slots[f'P{i + 1}'] = norm(3, box)
        tx = MARGIN + 450
        d.text((tx, y - 6), name, font=font(NARROW_BOLD, 54), fill=INK)
        text_lines(d, (tx, y + 78, PW - MARGIN, y + 78 + 5 * 26), rnd, indent_every=99)
        d.text((tx, y + 226), 'Открыть проект: ссылка', font=font(SERIF_ITALIC, 28), fill=INK)
        if i < 2:
            d.line((MARGIN, y + 312, PW - MARGIN, y + 312), fill=PLACEHOLDER_LINE, width=2)
    return img


def page_back():
    img = paper(PW, PH, 4)
    d = ImageDraw.Draw(img)
    rnd = random.Random(44)
    running_head(d, 4, 'Песковский', right_side=True)
    columns(d, (MARGIN, 120, PW - MARGIN, 900), 3, rnd)
    d.rectangle((MARGIN, 940, PW - MARGIN, PH - 70), outline=RULE, width=3)
    t = 'Продолжение следует'
    f = font(NARROW_BOLD, 72)
    d.text(((PW - d.textlength(t, font=f)) / 2, 1080), t, font=f, fill=INK)
    t = 'Новые работы — в следующем выпуске'
    f = font(SERIF_ITALIC, 32)
    d.text(((PW - d.textlength(t, font=f)) / 2, 1180), t, font=f, fill=TEXT_GREY)
    return img


def run():
    os.makedirs(OUT, exist_ok=True)
    slots = {}
    p1, p2, p3, p4 = page_cover(slots), page_creatives(slots), page_projects(slots), page_back()

    spread = Image.new('RGB', (PW * 2, PH))
    spread.paste(p2, (0, 0))
    spread.paste(p3, (PW, 0))
    spread.save(os.path.join(OUT, 'news_spread.png'), optimize=True)

    cover = Image.new('RGB', (PW * 2, PH))
    cover.paste(p1, (0, 0))
    cover.paste(p4, (PW, 0))
    cover = cover.resize((int(PW * 2 * COVER_SCALE), int(PH * COVER_SCALE)), Image.LANCZOS)
    cover.save(os.path.join(OUT, 'news_cover.png'), optimize=True)

    layout = {
        'page_m': PAGE_M,
        'textures': {'spread': 'news_spread.png', 'cover': 'news_cover.png'},
        'pages': {'1': 'cover-left', '2': 'spread-left', '3': 'spread-right', '4': 'cover-right'},
        'slots': slots,
    }
    with open(os.path.join(OUT, 'news_layout.json'), 'w', encoding='utf-8') as fh:
        json.dump(layout, fh, ensure_ascii=False, indent=2)
    print('newspaper textures:', OUT, 'slots:', ', '.join(slots))


if __name__ == '__main__':
    run()
