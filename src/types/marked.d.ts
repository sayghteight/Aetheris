declare module 'marked' {
  export interface MarkedOptions {
    /** Oculta las direcciones de correo (obsoleto en marked 5). */
    mangle?: boolean;
    /** Anade identificadores a los encabezados (obsoleto en marked 5). */
    headerIds?: boolean;
    [key: string]: unknown;
  }
  export function parse(src: string, options?: MarkedOptions): string;
  export const marked: { parse: (src: string, options?: MarkedOptions) => string };
  export default marked;
}
