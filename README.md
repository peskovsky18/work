# 🎬 Александр Песковский — Разнорабочий в медиа

Минималистичный черно-белый сайт-портфолио на фоне тетради в клетку.
Фокус на работах: карусель проектов, просмотр видео/фото и всего две кнопки связи (Email и Instagram).

---

## ⚡️ Быстрый просмотр

Откройте файл **`index.html`** в любом браузере (двойной клик на Mac).

---

## ✏️ Как редактировать контент

Все данные о проектах и ссылки на почту / Instagram находятся в файле:  
📂 **[`js/projects-data.js`](js/projects-data.js)**

### 1. Контакты:
```javascript
const PROFILE_DATA = {
  name: "Александр Песковский",
  role: "Разнорабочий в медиа",
  contacts: {
    email: "peskovsky18@gmail.com",
    instagram: "https://instagram.com/peskovsky18"
  }
};
```

### 2. Проекты в карусели:
В массиве `PROJECTS` можно менять, добавлять или удалять работы:
```javascript
{
  id: 1,
  title: "Название проекта",
  category: "video", // "video" | "photo" | "montage" | "web"
  categoryLabel: "Видео",
  year: "2024",
  client: "Заказчик",
  role: "Ваша роль",
  description: "Емкое описание без лишней воды.",
  tools: ["BMPCC 6K", "DaVinci Resolve"],
  mediaType: "youtube", // "youtube" | "image" | "web"
  mediaUrl: "https://www.youtube-nocookie.com/embed/ID_РОЛИКА",
  thumbnail: "https://ссылка-на-превью.jpg"
}
```

---

## 🌐 Сайт онлайн:
👉 **[https://peskovsky18.github.io/work/](https://peskovsky18.github.io/work/)**
