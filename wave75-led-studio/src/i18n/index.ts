import { vi, type WaveTranslation } from './vi';
import { en } from './en';

export type Language = 'vi' | 'en';

export const TRANSLATIONS: Record<Language, WaveTranslation> = { vi, en };

