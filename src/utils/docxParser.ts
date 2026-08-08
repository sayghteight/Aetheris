import mammoth from 'mammoth';

/**
 * Custom error types for DOCX import failures.
 * Allows callers to handle specific error cases with user-friendly messages.
 */
export class DocxImportError extends Error {
  constructor(
    message: string,
    public readonly code: 'CORRUPTED' | 'MISSING_XML' | 'INVALID_FORMAT' | 'PARSE_ERROR' | 'UNKNOWN',
    public readonly originalError?: unknown
  ) {
    super(message);
    this.name = 'DocxImportError';
  }
}

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

/**
 * Validates that a file is a valid DOCX by checking its magic bytes.
 * DOCX files are ZIP archives starting with PK\x03\x04.
 */
function validateDocxFile(file: File): void {
  if (!file.name.endsWith('.docx')) {
    throw new DocxImportError(
      'File must have .docx extension',
      'INVALID_FORMAT'
    );
  }

  // File size validations
  if (file.size === 0) {
    throw new DocxImportError(
      'File is empty',
      'CORRUPTED'
    );
  }

  if (file.size < 100) {
    throw new DocxImportError(
      'File is too small to be a valid DOCX',
      'CORRUPTED'
    );
  }
}

export async function parseDocx(file: File): Promise<PartImport[]> {
  // Step 1: Validate the file before attempting to parse
  validateDocxFile(file);

  // Step 2: Read file contents
  let arrayBuffer: ArrayBuffer;
  try {
    arrayBuffer = await file.arrayBuffer();
  } catch (err) {
    throw new DocxImportError(
      'Could not read file contents',
      'UNKNOWN',
      err
    );
  }

  // Step 3: Check for minimum buffer size
  if (arrayBuffer.byteLength < 100) {
    throw new DocxImportError(
      'File appears to be truncated or corrupted',
      'CORRUPTED'
    );
  }

  // Step 4: Convert DOCX to HTML using mammoth
  let html: string;
  try {
    const result = await mammoth.convertToHtml({ arrayBuffer });

    // Check for warnings that might indicate partial success
    if (result.messages && result.messages.length > 0) {
      console.warn('[docxParser] Mammoth warnings:', result.messages);
    }

    html = result.value;
  } catch (err: unknown) {
    // Categorize the error based on its nature
    const errorMessage = err instanceof Error ? err.message : String(err);

    if (errorMessage.includes('ZIP') ||
        errorMessage.includes('archive') ||
        errorMessage.includes('compressed') ||
        errorMessage.includes('PK')) {
      throw new DocxImportError(
        'File is corrupted or not a valid DOCX archive',
        'CORRUPTED',
        err
      );
    }

    if (errorMessage.includes('XML') ||
        errorMessage.includes('document.xml') ||
        errorMessage.includes('content types')) {
      throw new DocxImportError(
        'File is missing required XML parts',
        'MISSING_XML',
        err
      );
    }

    if (errorMessage.includes('parse') ||
        errorMessage.includes('format') ||
        errorMessage.includes('invalid')) {
      throw new DocxImportError(
        'File contains invalid or unsupported content',
        'INVALID_FORMAT',
        err
      );
    }

    throw new DocxImportError(
      `Failed to convert document: ${errorMessage}`,
      'PARSE_ERROR',
      err
    );
  }

  // Step 5: Validate the resulting HTML
  if (!html || html.trim().length === 0) {
    throw new DocxImportError(
      'Document appears to be empty',
      'INVALID_FORMAT'
    );
  }

  // Step 6: Parse HTML into structured data
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');

  // Detect parse errors (DOMParser sets parseError if it fails)
  if (!doc.body || doc.body.childNodes.length === 0) {
    console.error('[docxParser] DOM parse resulted in empty document');
    throw new DocxImportError(
      'Failed to parse document content',
      'PARSE_ERROR'
    );
  }

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

      // Usar outerHTML si ya es bloque HTML (headings, etc), si no envolver en <p>
      const isBlockElement = nodeName === 'DIV';
      const content = isBlockElement
        ? ((node as Element).outerHTML ?? '')
        : ((node as Element).innerHTML ?? node.textContent ?? '');

      // Si el contenido ya empieza con <p> o <h y termina con >, ya tiene estructura de bloque
      const trimmed = content.trim();
      const hasBlockStructure = /^(<p|<h[1-6]|<ul|<ol|<blockquote)/i.test(trimmed);

      if (currentScene) {
        // Acumular contenido — envolver en <p> si no tiene estructura de bloque ya
        currentScene.content += hasBlockStructure ? content : `<p>${content}</p>`;
      } else if (currentChapter) {
        currentScene = { title: text.slice(0, 50), content: hasBlockStructure ? content : `<p>${content}</p>` };
      } else if (currentPart) {
        currentChapter = { title: 'Capítulo 1', scenes: [] };
        currentScene = { title: text.slice(0, 50), content: hasBlockStructure ? content : `<p>${content}</p>` };
      } else {
        currentPart = { title: 'Parte 1', chapters: [] };
        currentChapter = { title: 'Capítulo 1', scenes: [] };
        currentScene = { title: text.slice(0, 50), content: hasBlockStructure ? content : `<p>${content}</p>` };
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
