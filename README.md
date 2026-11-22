# Александр Песковский — портфолио

Сайт-портфолио в виде поездки на метро: спуск по эскалатору, вагон с экранами, на которых идут работы, и контакты на конечной станции.

👉 **https://peskovsky18.github.io/work/**

Обычные HTML, CSS и JS без сборки. Three.js и GSAP лежат в `js/vendor`, сайт публикуется GitHub Pages из ветки `main`.

## Работы

Все работы описаны в [`js/projects-data.js`](js/projects-data.js). По ним создаются этапы прокрутки, видео на экранах вагона, ссылки вида `…/work/#swag` и полноэкранный просмотр.

```js
{
  slug: 'swag',                               // адрес этапа: …/work/#swag
  title: 'Свэг',
  category: 'Видео',
  badge: 'Shot on iPhone',                    // необязательно
  preview: 'assets/videos/preview_swag.mp4',  // короткий зацикленный ролик для экрана в вагоне
  full: 'assets/videos/swag_full.mp4',        // полная версия, null — без кнопки «Смотреть полностью»
  poster: 'assets/images/swag_thumb.jpg',     // необязательно
  year: '', role: '', client: ''              // показываются в плеере, если заполнены
}
```

В вагоне 4 экрана, поэтому работ тоже 4. Видео кладутся в `assets/videos/`. Для веба подходит MP4 (H.264) с `faststart`, чтобы воспроизведение начиналось до полной загрузки.

## 3D-модели

Вся геометрия и материалы сцены задаются в Blender, сайт загружает экспорт в GLB:

| Исходник | Экспорт | Что внутри |
|---|---|---|
| `assets/models/subway.blend` | `subway.glb` | салон, двери, кузов и два прицепных вагона |
| `assets/models/station.blend` | `station.glb` | станция: свод, платформа, пути, постеры, автомат |
| `assets/models/escalator_system.blend` | `escalator_system.glb` | эскалатор спуска |

После правок в Blender запустите в открытом файле [`tools/blender/export_glb.py`](tools/blender/export_glb.py). Он сохранит рядом `.glb` со сжатием Draco и текстурами WebP.

В JS остаются свет, анимация дверей, видео на экранах, камера и прокрутка.

## Локальный запуск

```bash
python3 dev_server.py
```

Сайт откроется на http://localhost:3000 (без кэширования).
