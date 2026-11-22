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

Вся сцена — один файл Blender: `assets/models/scene.blend`. Коллекции верхнего уровня экспортируются в отдельные GLB, чтобы сайт грузил их по очереди (эскалатор первым, тогда спуск стартует быстро):

| Коллекция | Экспорт | Что внутри |
|---|---|---|
| `Escalator` | `escalator_system.glb` | эскалатор спуска и его тоннель |
| `Station` | `station.glb` | станция: свод, платформа, пути, постеры, автомат |
| `Train` | `subway.glb` | вагон: салон (`Train/Interior`), двери, экраны, кузов и прицепные вагоны |

Экспорт (Draco-геометрия, WebP-текстуры):

```bash
/Applications/Blender.app/Contents/MacOS/Blender -b assets/models/scene.blend --python tools/blender/export_glb.py
```

Пересборка частей сцены — скрипты в [`tools/blender/`](tools/blender/): `build_train_interior.py` (салон), `build_train_exterior.py` (кузов и прицепные вагоны), `build_station.py` (станция), `build_escalator.py` (поручни, балюстрады, площадки), текстуры — `generate_textures.py`. Освещение: `tune_materials.py` (шероховатость под отражения) и `bake_lighting.py` (запекание мягких теней в атласы). Запекание применяет модификаторы, поэтому правки геометрии делаются в `assets/models/scene_prebake.blend`, затем он копируется в `scene.blend`, запекается и экспортируется. Имена `Door_*` и `Screen_N_Display` использует код сайта, их нельзя переименовывать.

В JS остаются свет, анимация дверей, видео на экранах, камера и прокрутка.

## Локальный запуск

```bash
python3 dev_server.py
```

Сайт откроется на http://localhost:3000 (без кэширования).
