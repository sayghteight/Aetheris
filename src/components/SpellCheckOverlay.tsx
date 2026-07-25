import React, { useState, useRef } from 'react';
import { MisspelledWord } from '../hooks/useSpellCheck';

interface SpellCheckOverlayProps {
  text: string;
  misspelledWords: MisspelledWord[];
  getSuggestions: (word: string) => string[];
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
}

export const SpellCheckOverlay: React.FC<SpellCheckOverlayProps> = ({
  text,
  misspelledWords,
  getSuggestions,
  fontSize,
  lineHeight,
  fontFamily,
}) => {
  const [selectedWord, setSelectedWord] = useState<MisspelledWord | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [popupPosition, setPopupPosition] = useState({ x: 0, y: 0 });
  const overlayRef = useRef<HTMLDivElement>(null);

  // Build text with underlines for misspelled words
  const renderTextWithUnderlines = () => {
    if (misspelledWords.length === 0) {
      return <span>{text}</span>;
    }

    const parts: React.ReactNode[] = [];
    let lastIndex = 0;

    // Sort misspelled words by index
    const sorted = [...misspelledWords].sort((a, b) => a.index - b.index);

    sorted.forEach((misspelled, i) => {
      // Add text before misspelled word
      if (misspelled.index > lastIndex) {
        parts.push(
          <span key={`text-${i}`}>{text.slice(lastIndex, misspelled.index)}</span>
        );
      }

      // Find the end of this word in the original text
      const wordEnd = text.indexOf(misspelled.word, misspelled.index) + misspelled.word.length;

      // Add misspelled word with underline
      parts.push(
        <span
          key={`misspelled-${i}`}
          className="relative inline border-b-2 border-red-500 cursor-pointer hover:bg-red-500/20 transition-colors"
          onContextMenu={(e) => {
            e.preventDefault();
            handleWordClick(misspelled, e);
          }}
          onClick={(e) => handleWordClick(misspelled, e)}
        >
          {misspelled.word}
        </span>
      );

      lastIndex = wordEnd;
    });

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push(<span key="text-end">{text.slice(lastIndex)}</span>);
    }

    return parts;
  };

  const handleWordClick = (misspelled: MisspelledWord, e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    const overlayRect = overlayRef.current?.getBoundingClientRect();

    if (overlayRect) {
      setPopupPosition({
        x: rect.left - overlayRect.left + rect.width / 2,
        y: rect.bottom - overlayRect.top + 4,
      });
    }

    setSelectedWord(misspelled);
    const s = getSuggestions(misspelled.word);
    setSuggestions(s);
  };

  const handleApplyCorrection = (correction: string) => {
    if (selectedWord) {
      // Dispatch a custom event that the editor can listen to
      const event = new CustomEvent('apply-correction', {
        detail: {
          original: selectedWord.word,
          correction,
        },
      });
      window.dispatchEvent(event);
    }
    setSelectedWord(null);
    setSuggestions([]);
  };

  const handleAddToDictionary = () => {
    if (selectedWord) {
      const event = new CustomEvent('add-to-dictionary', {
        detail: {
          word: selectedWord.word,
        },
      });
      window.dispatchEvent(event);
    }
    setSelectedWord(null);
    setSuggestions([]);
  };

  return (
    <div
      ref={overlayRef}
      className="absolute inset-0 pointer-events-none overflow-hidden"
      style={{
        fontSize: `${fontSize}px`,
        lineHeight: lineHeight,
        fontFamily: fontFamily === 'serif'
          ? 'Georgia, serif'
          : fontFamily === 'mono'
            ? 'monospace'
            : fontFamily === 'system'
              ? 'system-ui'
              : 'Inter, ui-sans-serif, system-ui, sans-serif',
      }}
    >
      <div className="p-4 whitespace-pre-wrap break-words pointer-events-auto text-transparent caret-white">
        {renderTextWithUnderlines()}
      </div>

      {/* Suggestions Popup */}
      {selectedWord && (
        <div
          className="absolute z-50 bg-slate-800 border border-slate-600 rounded-lg shadow-xl overflow-hidden min-w-[160px] max-w-[280px]"
          style={{
            left: `${popupPosition.x}px`,
            top: `${popupPosition.y}px`,
            transform: 'translateX(-50%)',
          }}
        >
          <div className="px-3 py-2 bg-slate-700 border-b border-slate-600">
            <span className="text-xs text-slate-300">Sugerencias para "{selectedWord.word}"</span>
          </div>

          {suggestions.length > 0 ? (
            <ul className="py-1">
              {suggestions.map((suggestion, i) => (
                <li key={i}>
                  <button
                    className="w-full px-3 py-1.5 text-left text-sm text-slate-200 hover:bg-violet-600 hover:text-white transition-colors"
                    onClick={() => handleApplyCorrection(suggestion)}
                  >
                    {suggestion}
                  </button>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-3 py-2 text-sm text-slate-400 italic">
              Sin sugerencias
            </div>
          )}

          <div className="border-t border-slate-600 py-1">
            <button
              className="w-full px-3 py-1.5 text-left text-sm text-slate-400 hover:bg-slate-700 hover:text-slate-200 transition-colors"
              onClick={handleAddToDictionary}
            >
              + Añadir al diccionario
            </button>
          </div>

          <button
            className="w-full px-3 py-1.5 text-xs text-slate-500 hover:text-slate-300 transition-colors border-t border-slate-700"
            onClick={() => {
              setSelectedWord(null);
              setSuggestions([]);
            }}
          >
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
};
