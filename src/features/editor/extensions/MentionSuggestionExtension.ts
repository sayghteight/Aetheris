import { Extension } from '@tiptap/core';
import { Plugin, PluginKey } from '@tiptap/pm/state';

export interface MentionSuggestionItem {
  id: string;
  name: string;
  characterType: string;
  briefDescription?: string | null;
  categoryName?: string;
}

export interface MentionOptions {
  suggestion: {
    char: string;
    pluginKey: PluginKey;
    items: (query: string) => MentionSuggestionItem[];
    command: (props: { editor: any; range: any; item: MentionSuggestionItem }) => void;
  };
}

export const MentionExtension = Extension.create<MentionOptions>({
  name: 'mention',

  addOptions() {
    return {
      suggestion: {
        char: '@',
        pluginKey: new PluginKey('mention'),
        items: () => [],
        command: ({ editor, range, item }) => {
          editor
            .chain()
            .focus()
            .deleteRange(range)
            .insertContent([
              {
                type: 'characterMention',
                attrs: {
                  id: item.id,
                  name: item.name,
                  characterType: item.characterType,
                  briefDescription: item.briefDescription,
                  categoryName: item.categoryName,
                },
              },
              { type: 'text', text: ' ' },
            ])
            .run();
        },
      },
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    const suggestionPluginKey = options.suggestion.pluginKey;

    return [
      new Plugin({
        key: suggestionPluginKey,
        props: {
          handleTextInput: (view, from, _to, text) => {
            if (text !== options.suggestion.char) {
              return false;
            }

            // Dispatch event to show suggestion popup
            const coords = view.coordsAtPos(from);
            window.dispatchEvent(
              new CustomEvent('mention-suggest-start', {
                detail: {
                  position: from,
                  coords: { left: coords.left, top: coords.bottom },
                  query: '',
                },
              })
            );

            return false;
          },
        },
      }),
    ];
  },
});

export default MentionExtension;
