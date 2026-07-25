export const editorTheme = {
  ltr: 'ltr',
  rtl: 'rtl',
  placeholder: 'text-slate-600 absolute top-4 left-4 pointer-events-none select-none text-sm',
  paragraph: 'mb-4 text-slate-300 leading-relaxed text-sm focus:outline-none',
  quote: 'border-l-4 border-slate-700 pl-4 italic text-slate-400 mb-4',
  heading: {
    h1: 'text-2xl font-bold text-slate-100 mb-4 mt-6',
    h2: 'text-xl font-bold text-slate-200 mb-3 mt-5',
    h3: 'text-lg font-bold text-slate-250 mb-2 mt-4',
  },
  list: {
    nested: {
      listitem: 'list-none',
    },
    ol: 'list-decimal pl-6 mb-4 text-slate-300',
    ul: 'list-disc pl-6 mb-4 text-slate-300',
    listitem: 'mb-1',
  },
  text: {
    bold: 'font-bold',
    italic: 'italic',
    underline: 'underline',
    strikethrough: 'line-through',
  },
};
export type EditorThemeType = typeof editorTheme;
