import { useTheme } from '../hooks/useTheme'

const THEME_CONFIG = {
  ocean:   { label: '🌊 Ocean',   name: 'Deep Ocean' },
  purple:  { label: '🌌 Purple',  name: 'Cosmic Purple' },
  emerald: { label: '🌿 Emerald', name: 'Emerald Night' },
}

export function ThemeSwitcher() {
  const { theme, setTheme } = useTheme()

  return (
    <div style={{
      display: 'flex',
      gap: '8px',
      padding: '4px',
      background: 'var(--bg-card)',
      border: '1px solid var(--border-card)',
      borderRadius: 'var(--radius-pill)',
      backdropFilter: 'blur(10px)',
    }}>
      {Object.entries(THEME_CONFIG).map(([key, cfg]) => (
        <button
          key={key}
          onClick={() => setTheme(key)}
          style={{
            padding: '6px 14px',
            borderRadius: 'var(--radius-pill)',
            border: 'none',
            cursor: 'pointer',
            fontSize: '12px',
            fontFamily: 'var(--font-main)',
            fontWeight: 500,
            transition: 'all 0.2s',
            background: theme === key ? 'var(--accent-gradient)' : 'transparent',
            color: theme === key ? '#fff' : 'var(--text-tertiary)',
          }}
        >
          {cfg.label}
        </button>
      ))}
    </div>
  )
}