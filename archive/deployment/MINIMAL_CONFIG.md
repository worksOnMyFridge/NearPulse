# 🎯 МИНИМАЛЬНАЯ КОНФИГУРАЦИЯ - Последняя попытка

## ЧТО ИЗМЕНЕНО:

### `vercel.json` - МАКСИМАЛЬНО УПРОЩЕНО
```json
{
  "buildCommand": "cd webapp && npm run build",
  "outputDirectory": "webapp/dist",
  "installCommand": "npm install && cd webapp && npm install"
}
```

**БЕЗ:**
- ❌ builds
- ❌ routes
- ❌ rewrites
- ❌ functions config

**Vercel автоматически:**
- ✅ Найдет `api/*.js` и создаст serverless functions
- ✅ Отдаст `webapp/dist` как статику
- ✅ Настроит роутинг сам

---

## 🚀 ДЕПЛОЙ:

```bash
cd "c:\Users\la1wo\OneDrive\Рабочий стол\web3\near-analytics-bot"
git add -A
git commit -m "fix: Minimal Vercel config - let Vercel auto-detect"
git push origin master
```

**ВАЖНО:** `git add -A` добавит ВСЕ файлы, включая `api/`!

---

## ✅ ПРОВЕРКА:

После деплоя (2-3 минуты):

1. https://near-pulse.vercel.app/api/test
2. https://near-pulse.vercel.app/api/health
3. https://near-pulse.vercel.app/

---

## 🔍 ЕСЛИ ВСЁ ЕЩЁ НЕ РАБОТАЕТ:

### Вариант 1: Проверьте что api/ закоммичена

Откройте Git Bash:
```bash
cd "c:\Users\la1wo\OneDrive\Рабочий стол\web3\near-analytics-bot"
git ls-tree HEAD api/
```

Должно показать:
```
100644 blob abc123... api/index.js
100644 blob def456... api/test.js
```

Если пусто:
```bash
git add api/
git commit -m "fix: Add api folder"
git push origin master
```

---

### Вариант 2: Vercel Dashboard → Settings

1. Зайдите на vercel.com
2. Откройте проект NearPulse
3. Settings → General
4. **Root Directory:** оставьте ПУСТЫМ (или `.`)
5. **Framework Preset:** Other
6. **Build Command:** `cd webapp && npm run build`
7. **Output Directory:** `webapp/dist`
8. **Install Command:** `npm install && cd webapp && npm install`
9. Нажмите **Save**
10. Redeploy

---

### Вариант 3: Создайте проект заново

Если ничего не помогает:

1. Vercel Dashboard → Delete Project
2. Заново: Import Git Repository
3. Выберите ваш репозиторий
4. Root Directory: оставьте пустым
5. Build Command: `cd webapp && npm run build`
6. Output Directory: `webapp/dist`
7. Deploy

---

## 💡 ПОЧЕМУ ЭТО ДОЛЖНО СРАБОТАТЬ:

Vercel по умолчанию распознает:
- `api/` папка → Serverless Functions
- Build output → Статика

Любые кастомные routes/builds могут конфликтовать.
Минимальная конфигурация = меньше точек отказа!

---

## 📊 ЧТО ПОКАЗАТЬ:

Если всё ещё ошибка - покажите:

1. Скриншот Vercel → Deployments → Build Logs (целиком)
2. Скриншот Vercel → Functions (есть ли там api/test и api/index?)
3. Вывод команды: `git ls-tree HEAD api/`

Тогда я точно найду проблему! 🎯
