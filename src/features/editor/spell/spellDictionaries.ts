/**
 * Datos de los diccionarios Hunspell.
 *
 * Se importan aqui, y no en el motor, para que Vite los coloque en un chunk
 * aparte: los ~1,4 MB de diccionarios solo se descargan y se analizan si el
 * corrector llega a activarse.
 *
 * Los ficheros vienen del paquete npm `dictionary-es` / `dictionary-en`, que
 * son ESM de Node y no se pueden usar en el navegador. Aqui se leen como
 * texto con `?raw`, que es justo lo que espera el motor Hunspell.
 * Ver `dictionaries/LICENSE.md` para las licencias y el procedimiento de
 * actualizacion.
 */
import enAff from './dictionaries/en.aff?raw';
import enDic from './dictionaries/en.dic?raw';
import esAff from './dictionaries/es.aff?raw';
import esDic from './dictionaries/es.dic?raw';

export interface HunspellDictionary {
  /** Contenido del fichero `.aff`: reglas de afijos y banderas. */
  aff: string;
  /** Contenido del fichero `.dic`: lista de palabras. */
  dic: string;
}

export const DICTIONARIES: Record<string, HunspellDictionary> = {
  en: { aff: enAff, dic: enDic },
  es: { aff: esAff, dic: esDic },
};

/** Idiomas disponibles para el corrector. */
export const AVAILABLE_LANGUAGES = Object.keys(DICTIONARIES);
