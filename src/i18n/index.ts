import { vi, type TranslationDict } from './vi';
import { en } from './en';

export type Language = 'vi' | 'en';

export const TRANSLATIONS: Record<Language, TranslationDict> = {
  vi,
  en,
};

