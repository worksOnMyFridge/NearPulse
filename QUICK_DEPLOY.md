# 🚀 Быстрый Деплой

## Проблема
Git показывает ошибку: `error: src refspec main does not match any`

## Решение

### Вариант 1: Командная строка (cmd)

Откройте **cmd.exe** (НЕ PowerShell!) в папке проекта и выполните:

```cmd
cd "c:\Users\la1wo\OneDrive\Рабочий стол\web3\near-analytics-bot"

git pull origin main --rebase

git push origin main
```

---

### Вариант 2: Git Bash

Откройте **Git Bash** в папке проекта:

```bash
git pull origin main --rebase
git push origin main
```

---

### Вариант 3: GitHub Desktop

1. Откройте GitHub Desktop
2. Repository → Pull (Ctrl+Shift+P)
3. Repository → Push (Ctrl+P)

---

## Если есть конфликты

```cmd
# Проверить статус
git status

# Посмотреть конфликты
git diff

# Если нужно сбросить локальные изменения
git reset --hard origin/main

# Затем снова добавить файлы
git add .
git commit -m "feat(scaling): production-grade NFT handling"
git push origin main
```

---

## После успешного push

### Проверка Railway
```bash
# Логи Railway
railway logs --tail

# Или в браузере
https://railway.app
```

### Проверка API
```bash
curl https://your-api.railway.app/api/health

# Должны увидеть version: "2.0.0"
```

### Проверка Vercel
```bash
# В браузере
https://near-pulse.vercel.app
```

---

## Тестирование новых фич

### 1. Cache Stats
```bash
curl https://your-api.railway.app/api/health | jq '.cache'
```

### 2. NFT Counter
```bash
curl https://your-api.railway.app/api/nfts/count/leninjiv23.tg
```

### 3. NFT Pagination
```bash
curl "https://your-api.railway.app/api/nfts/leninjiv23.tg?page=1&limit=50"
```

### 4. Infinite Scroll (Frontend)
1. Откройте https://near-pulse.vercel.app
2. Перейдите на вкладку "🎨 Галерея"
3. Прокрутите вниз - должна идти автоматическая подгрузка

---

## ⚠️ Если ничего не помогает

Сброс и повторный push:

```cmd
# Сохраните изменения в stash
git stash

# Синхронизируйтесь с main
git pull origin main --rebase

# Верните изменения
git stash pop

# Если конфликты - разрешите их

# Добавьте файлы
git add src/services/cacheService.js
git add src/services/nearService.js
git add src/api.js
git add webapp/src/services/api.js
git add webapp/src/components/GalleryScreen.jsx
git add SCALING.md
git add TESTING_SCALING.md
git add SCALING_SUMMARY.md

# Коммит
git commit -m "feat(scaling): production-grade NFT handling for 10k+ items"

# Push
git push origin main
```

---

## 📞 Debugging

### Проверить текущую ветку
```cmd
git branch
```

Должно быть: `* main`

### Проверить remote
```cmd
git remote -v
```

Должно быть:
```
origin  https://github.com/WorksOnMyFridge/NearPulse (fetch)
origin  https://github.com/WorksOnMyFridge/NearPulse (push)
```

### Проверить статус
```cmd
git status
```

---

✨ **После успешного деплоя** смотри `TESTING_SCALING.md` для полного тестирования!
