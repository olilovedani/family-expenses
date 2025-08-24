# Family Expenses (React + Vite + Tailwind)

Одностраничное приложение для учёта семейных расходов с локальным сохранением (localStorage), фильтрами и аналитикой (Recharts). Есть экспорт **CSV** и **XLSX** (несколько листов).

## Локальный запуск

```bash
npm install
npm run dev
```

Открой адрес из консоли (обычно `http://localhost:5173`).

## Деплой (Vercel)

1. Загрузить папку в GitHub как репозиторий `family-expenses`.
2. На https://vercel.com → New Project → выбрать репозиторий.
3. Build Command: **`npm run build`**, Output Directory: **`dist`** (по умолчанию Vite).
4. Нажать Deploy — получите ссылку вида `https://family-expenses.vercel.app`.

## Зависимости
- React 18
- Recharts (графики)
- lucide-react (иконки)
- xlsx (экспорт в Excel)
- TailwindCSS (стили)

## Импорт/экспорт
- **CSV** — экспортирует ВСЕ записи из хранилища.
- **XLSX** — экспортирует текущий **отфильтрованный** набор на листе «Расходы» + «По именам», «По категориям», «По месяцам».
