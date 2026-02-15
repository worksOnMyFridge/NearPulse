#!/usr/bin/env python3
"""
Скрипт для замены команды /transactions на упрощённую версию
"""

import re

print("🔄 Замена команды /transactions...")

# Читаем файлы
with open('src/index.js', 'r', encoding='utf-8') as f:
    content = f.read()

with open('new_transactions_command.js', 'r', encoding='utf-8') as f:
    new_command = f.read()
    # Убираем первую строку с комментарием
    new_command = '\n'.join(new_command.split('\n')[2:])

# Находим старую команду через regex
pattern = r"bot\.command\('transactions',.*?^\}\);"
match = re.search(pattern, content, re.DOTALL | re.MULTILINE)

if not match:
    print("❌ Не найдена команда /transactions")
    exit(1)

# Заменяем
new_content = content[:match.start()] + new_command.strip() + content[match.end():]

# Сохраняем
with open('src/index.js', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("✅ Команда успешно заменена!")
print("📊 Новая команда:")
print("  - 5 последних транзакций")
print("  - Красивые эмодзи: 📥 📤 🔥")
print("  - Время: dayjs")
print("  - USD цены")
print("")
print("🚀 Теперь: git add src/index.js && git commit && git push")
