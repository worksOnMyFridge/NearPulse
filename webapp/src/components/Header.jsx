import { useTheme } from '../hooks/useTheme';
import { ThemeSwitcher } from './ThemeSwitcher';

const THEME_GLOW = {
  ocean:   'rgba(0, 102, 255, 0.3)',
  purple:  'rgba(123, 47, 190, 0.35)',
  emerald: 'rgba(0, 176, 155, 0.25)',
};

const TABS = [
  { key: 'overview',      label: 'Обзор',       icon: '⊙' },
  { key: 'transactions',  label: 'Транзакции',   icon: '↕' },
  { key: 'analytics',     label: 'Аналитика',    icon: '📊' },
  { key: 'gallery',       label: 'NFT',          icon: '🖼' },
];

export default function Header({ address, currentScreen, onScreenChange }) {
  const { theme } = useTheme();

  return (
    <div style={{
      position: 'sticky',
      top: 0,
      zIndex: 10,
      background: 'var(--bg-primary)',
      borderBottom: '1px solid var(--border-primary)',
      backdropFilter: 'blur(20px)',
    }}>
      {/* Glow effect */}
      <div style={{
        position: 'absolute',
        top: -40,
        left: '50%',
        transform: 'translateX(-50%)',
        width: 300,
        height: 120,
        borderRadius: '50%',
        background: `radial-gradient(ellipse, ${THEME_GLOW[theme] || THEME_GLOW.ocean} 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Top row */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 16px 10px',
        position: 'relative',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: 10,
            background: 'var(--accent-gradient)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 700,
            fontSize: 14,
            color: '#fff',
            flexShrink: 0,
          }}>NP</div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 16, color: 'var(--text-primary)', lineHeight: 1.2 }}>
              NearPulse
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-tertiary)', letterSpacing: '0.03em' }}>
              Wallet Intelligence
            </div>
          </div>
        </div>

        {/* Theme switcher */}
        <ThemeSwitcher />
      </div>

      {/* Wallet address */}
      {address && (
        <div style={{ padding: '0 16px 10px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--bg-card)',
            border: '1px solid var(--border-primary)',
            borderRadius: 100,
            padding: '5px 12px 5px 8px',
            backdropFilter: 'blur(10px)',
          }}>
            <div style={{
              width: 20,
              height: 20,
              borderRadius: '50%',
              background: 'var(--accent-gradient)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 10,
            }}>◎</div>
            <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-primary)' }}>
              {address}
            </span>
            <span style={{ fontSize: 11, color: 'var(--color-positive)' }}>●</span>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div style={{
        display: 'flex',
        borderTop: '1px solid var(--border-primary)',
      }}>
        {TABS.map(tab => {
          const active = currentScreen === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => onScreenChange(tab.key)}
              style={{
                flex: 1,
                padding: '10px 4px',
                border: 'none',
                background: 'transparent',
                cursor: 'pointer',
                fontSize: 12,
                fontWeight: active ? 600 : 400,
                color: active ? 'var(--text-accent)' : 'var(--text-tertiary)',
                fontFamily: 'var(--font-main)',
                position: 'relative',
                transition: 'all 0.2s',
              }}
            >
              {tab.label}
              {active && (
                <div style={{
                  position: 'absolute',
                  bottom: 0,
                  left: '20%',
                  right: '20%',
                  height: 2,
                  borderRadius: 2,
                  background: 'var(--accent-gradient)',
                }} />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}