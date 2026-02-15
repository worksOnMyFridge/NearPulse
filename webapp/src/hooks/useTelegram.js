import WebApp from '@twa-dev/sdk';

export function useTelegram() {
  const tg = WebApp;

  const startParam = tg.initDataUnsafe?.start_param;
  const urlParams = new URLSearchParams(window.location.search);
  const address = startParam || urlParams.get('address') || '';

  const initData = tg.initData;
  const user = tg.initDataUnsafe?.user;

  const isInTelegram = !!tg.initData;

  return { tg, address, initData, user, isInTelegram };
}
