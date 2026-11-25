import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from '@/i18n/locales/en.json';
import km from '@/i18n/locales/km.json';
const STORAGE_KEY = 'sams_language';
export function getStoredLanguage() {
    const saved = localStorage.getItem(STORAGE_KEY);
    return saved === 'km' ? 'km' : 'en';
}
export function applyDocumentLanguage(lang) {
    document.documentElement.lang = lang;
    localStorage.setItem(STORAGE_KEY, lang);
}
const initialLang = getStoredLanguage();
i18n.use(initReactI18next).init({
    resources: {
        en: { translation: en },
        km: { translation: km },
    },
    lng: initialLang,
    fallbackLng: 'en',
    interpolation: {
        escapeValue: false,
    },
});
applyDocumentLanguage(initialLang);
i18n.on('languageChanged', (lng) => {
    applyDocumentLanguage(lng === 'km' ? 'km' : 'en');
});
export default i18n;
