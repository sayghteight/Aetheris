/**
 * Licencia de uso (EULA) de Aetheria.
 *
 * El texto vive en dos ficheros markdown que se empaquetan con la aplicacion
 * y se importan con `?raw`, igual que el registro de cambios: asi el documento
 * que se lee en la aplicacion es exactamente el que esta en el repositorio,
 * sin duplicar contenido ni depender de las traducciones de la interfaz.
 *
 * `EULA_VERSION` identifica la version del documento. Si se publica una
 * version nueva hay que subir este numero: la aplicacion volvera a pedir la
 * aceptacion a quien habia aceptado la version anterior.
 */
import eulaEs from './eula.es.md?raw';
import eulaEn from './eula.en.md?raw';

/** Version del documento de licencia de uso. */
export const EULA_VERSION = '1.0';

export type EulaLanguage = 'es' | 'en';

/** Texto completo de la licencia en cada idioma. */
export const EULA_TEXTS: Record<EulaLanguage, string> = {
  es: eulaEs,
  en: eulaEn,
};

/** Idiomas disponibles de la licencia, en el orden en que se muestran. */
export const EULA_LANGUAGES: { id: EulaLanguage; label: string }[] = [
  { id: 'es', label: 'Español' },
  { id: 'en', label: 'English' },
];
