import { useEffect } from 'react';
import { useAppSettingsStore } from '../../../store/appSettingsStore';
import { useProjectStore } from '../../../store/projectStore';
import { spellEngine, type SpellLanguage } from './spellEngine';
import { loadSpellDictionaryWords } from './spellPersonalDictionary';

/**
 * Mantiene el motor del corrector al dia con los ajustes de la aplicacion:
 * si esta activo y con que idiomas se comprueba el texto.
 *
 * Los ajustes son de la aplicacion, no de la novela: el corrector se comporta
 * igual en todos los proyectos.
 */
export function useSpellCheckSettings(): void {
  const spellCheckEnabled = useAppSettingsStore((s) => s.settings.spellCheckEnabled);
  const spellCheckLanguages = useAppSettingsStore((s) => s.settings.spellCheckLanguages);
  const spellCheckUseUniverseNames = useAppSettingsStore(
    (s) => s.settings.spellCheckUseUniverseNames
  );
  const isProjectOpen = useProjectStore((s) => s.isOpen);

  useEffect(() => {
    spellEngine.setEnabled(spellCheckEnabled);
    spellEngine.setLanguages(spellCheckLanguages as SpellLanguage[]);
  }, [spellCheckEnabled, spellCheckLanguages]);

  // Las palabras del diccionario personal y los nombres de la novela dependen
  // del proyecto abierto, asi que solo se cargan cuando lo hay.
  useEffect(() => {
    if (!isProjectOpen) return;
    void loadSpellDictionaryWords({ useUniverseNames: spellCheckUseUniverseNames }, true);
  }, [isProjectOpen, spellCheckUseUniverseNames]);
}
