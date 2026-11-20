/**
 * Registro de cambios de la aplicacion.
 *
 * El texto se importa desde el propio `CHANGELOG.md` del repositorio, que se
 * empaqueta con la aplicacion. Antes se sacaba de `git log` en tiempo de
 * ejecucion, lo que solo funcionaba en la maquina de desarrollo: el comando
 * de Rust ejecutaba git en la ruta del repositorio incrustada en el binario,
 * que no existe en el equipo del usuario. Ahora los cambios que se ven junto
 * al numero de version son los mismos que se publican, en todas las
 * plataformas y tanto en desarrollo como en la version distribuida.
 */
import changelogMarkdown from '../../CHANGELOG.md?raw';

export interface ChangelogSection {
  /** Version sin la "v": "0.1.9". */
  version: string;
  /** Fecha u otra informacion de la cabecera: "November 5, 2026". */
  date: string;
  /** Markdown de la seccion. */
  body: string;
  /**
   * Si la version documenta cambios reales. Las versiones antiguas que solo
   * remiten al historial de GitHub no cuentan: no tienen nada que leer aqui.
   */
  hasChanges: boolean;
}

/** Cabecera de version: `## [0.1.9] — November 5, 2026`. */
const SECTION_HEADER = /^##\s+\[?(\d+\.\d+\.\d+)\]?\s*(?:[—–-]\s*(.+?))?\s*$/;

/**
 * Una seccion documenta cambios si tiene al menos una lista o un subtitulo.
 * Las secciones que solo son un enlace al historial ("ver las versiones
 * publicadas") se consideran sin cambios: no aportan nada al panel.
 */
function detectChanges(body: string): boolean {
  return /^\s*[-*+]\s+\S/m.test(body) || /^#{3,6}\s+\S/m.test(body);
}

/**
 * Divide el changelog en sus secciones de version, de la mas reciente a la
 * mas antigua (el archivo esta escrito en ese orden).
 */
export function parseChangelog(markdown: string): ChangelogSection[] {
  const sections: ChangelogSection[] = [];
  let current: ChangelogSection | null = null;
  let lines: string[] = [];

  const flush = (): void => {
    if (current) {
      const body = lines.join('\n').trim();
      sections.push({ ...current, body, hasChanges: detectChanges(body) });
    }
    current = null;
    lines = [];
  };

  for (const line of markdown.split('\n')) {
    const match = SECTION_HEADER.exec(line);
    if (match) {
      flush();
      current = { version: match[1], date: (match[2] ?? '').trim(), body: '', hasChanges: false };
      continue;
    }
    if (current) lines.push(line);
  }
  flush();

  return sections;
}

/** Todas las versiones publicadas, de la mas reciente a la mas antigua. */
export const CHANGELOG_SECTIONS: ChangelogSection[] = parseChangelog(changelogMarkdown);

/**
 * Solo las versiones con cambios documentados. Es la lista que se muestra en
 * el selector: una version sin changelog no aparece, y el historial completo
 * se consulta en GitHub con el boton del panel.
 */
export const DOCUMENTED_SECTIONS: ChangelogSection[] = CHANGELOG_SECTIONS.filter(
  (section) => section.hasChanges
);
