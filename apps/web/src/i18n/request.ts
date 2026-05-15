import { getRequestConfig } from 'next-intl/server';

import { isLocale } from '@tikflow/i18n';
import enMessages from '@tikflow/i18n/messages/en.json';

import { routing } from './routing.js';

const messagesByLocale = {
  en: enMessages,
} as const;

export default getRequestConfig(async ({ requestLocale }) => {
  const requested = await requestLocale;
  const locale = requested && isLocale(requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: messagesByLocale[locale],
  };
});
