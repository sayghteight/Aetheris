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
}

/** Cabecera de version: `## [0.1.9] — November 5, 2026`. */
const SECTION_HEADER = /^##\s+\[?(\d+\.\d+\.\d+)\]?\s*(?:[—–-]\s*(.+?))?\s*$/;

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
      sections.push({ ...current, body: lines.join('\n').trim() });
    }
    current = null;
    lines = [];
  };

  for (const line of markdown.split('\n')) {
    const match = SECTION_HEADER.exec(line);
    if (match) {
      flush();
      current = { version: match[1], date: (match[2] ?? '').trim(), body: '' };
      continue;
    }
    if (current) lines.push(line);
  }
  flush();

  return sections;
}

/** Todas las versiones publicadas, de la mas reciente a la mas antigua. */
export const CHANGELOG_SECTIONS: ChangelogSection[] = parseChangelog(changelogMarkdown);

/** Seccion del changelog de una version concreta. */
export function changelogForVersion(version: string): ChangelogSection | undefined {
  return CHANGELOG_SECTIONS.find((section) => section.version === version);
}
