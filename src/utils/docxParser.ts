import mammoth from 'mammoth';

export interface SceneImport {
  title: string;
  content: string; // HTML
}

export interface ChapterImport {
  title: string;
  scenes: SceneImport[];
}

export interface PartImport {
  title: string;
  chapters: ChapterImport[];
}

export async function parseDocx(file: File): Promise<PartImport[]> {
  const arrayBuffer = await file.arrayBuffer();
  const { value: html } = await mammoth.convertToHtml({ arrayBuffer });

  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  const parts: PartImport[] = [];
  let currentPart: PartImport | null = null;
  let currentChapter: ChapterImport | null = null;
  let currentScene: SceneImport | null = null;

  const body = doc.body;

  for (let i = 0; i < body.childNodes.length; i++) {
    const node = body.childNodes[i];
    const nodeName = node.nodeName.toUpperCase();
    const isHeading = nodeName === 'H1' || nodeName === 'H2' || nodeName === 'H3' || nodeName === 'H4' || nodeName === 'H5' || nodeName === 'H6';
    const isElement = node.nodeType === Node.ELEMENT_NODE;
    const isText = node.nodeType === Node.TEXT_NODE;
    const text = node.textContent?.trim() ?? '';

    // Saltar nodos vacíos o solo espacios
    if (!isHeading && isText && !text) continue;

    if (nodeName === 'H1') {
      // Guardar escena, capítulo y parte anteriores
      if (currentScene && currentChapter) {
        currentChapter.scenes.push(currentScene);
        currentScene = null;
      }
      if (currentChapter && currentPart) {
        currentPart.chapters.push(currentChapter);
        currentChapter = null;
      }
      if (currentPart) {
        parts.push(currentPart);
      }
      // Nueva parte
      currentPart = { title: text || 'Parte 1', chapters: [] };
      currentChapter = null;
      currentScene = null;
    } else if (nodeName === 'H2') {
      // Guardar escena y capítulo anterior
      if (currentScene && currentChapter) {
        currentChapter.scenes.push(currentScene);
        currentScene = null;
      }
      if (currentChapter && currentPart) {
        currentPart.chapters.push(currentChapter);
      }
      // Nuevo capítulo
      currentChapter = { title: text || 'Capítulo 1', scenes: [] };
      currentScene = null;
    } else if (['H3', 'H4', 'H5', 'H6'].includes(nodeName)) {
      // Guardar escena anterior si existe
      if (currentScene && currentChapter) {
        currentChapter.scenes.push(currentScene);
      }
      // Nueva escena - el título del heading es el título de la escena
      // El contenido inicial es el propio heading
      currentScene = {
        title: text.slice(0, 50) || 'Escena sin título',
        content: (node as Element).outerHTML ?? '',
      };
    } else if (isElement && (nodeName === 'P' || nodeName === 'DIV' || text)) {
      // Párrafos y contenido de texto van al contenido de la escena actual
      if (!text) continue;

      const content = (node as Element).innerHTML ?? node.textContent ?? '';

      if (currentScene) {
        // Acumular contenido en la escena actual
        currentScene.content += '\n' + content;
      } else if (currentChapter) {
        // No hay escena abierta, crear una con este contenido
        currentScene = { title: text.slice(0, 50), content };
      } else if (currentPart) {
        // No hay capítulo, crear uno con esta escena
        currentChapter = { title: 'Capítulo 1', scenes: [] };
        currentScene = { title: text.slice(0, 50), content };
      } else {
        // No hay nada, crear estructura base
        currentPart = { title: 'Parte 1', chapters: [] };
        currentChapter = { title: 'Capítulo 1', scenes: [] };
        currentScene = { title: text.slice(0, 50), content };
      }
    }
  }

  // Cerrar última escena, capítulo y parte
  if (currentScene && currentChapter) {
    currentChapter.scenes.push(currentScene);
  }
  if (currentChapter && currentPart) {
    currentPart.chapters.push(currentChapter);
  }
  if (currentPart) {
    parts.push(currentPart);
  }

  // Si no se creó nada, crear estructura mínima
  if (parts.length === 0) {
    parts.push({ title: 'Parte 1', chapters: [{ title: 'Capítulo 1', scenes: [] }] });
  }

  return parts;
}
