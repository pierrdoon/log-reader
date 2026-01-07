# Тесты для Log Reader

Этот каталог содержит тесты для приложения Log Reader.

## Структура тестов

- `setup.ts` - Настройка тестового окружения
- `ssh-manager.test.ts` - Тесты для SSH менеджера
- `components/Sidebar.test.tsx` - Тесты для компонента Sidebar
- `components/LogViewer.test.tsx` - Тесты для компонента LogViewer
- `utils.test.ts` - Тесты для утилитарных функций

## Запуск тестов

```bash
# Запуск тестов в watch режиме
npm run test

# Запуск тестов с UI
npm run test:ui

# Запуск тестов один раз
npm run test:run

# Запуск тестов с покрытием кода
npm run test:coverage
```

## Написание новых тестов

При написании новых тестов следуйте этим правилам:

1. Используйте `describe` для группировки связанных тестов
2. Используйте `it` или `test` для отдельных тестов
3. Используйте `beforeEach` и `afterEach` для настройки и очистки
4. Мокайте внешние зависимости (window.api, ssh2 и т.д.)
5. Используйте `waitFor` для асинхронных операций в React компонентах

## Пример теста

```typescript
import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'

describe('MyComponent', () => {
  it('должен отображать текст', () => {
    render(<MyComponent />)
    expect(screen.getByText('Hello')).toBeInTheDocument()
  })
})
```

