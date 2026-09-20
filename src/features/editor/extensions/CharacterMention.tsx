import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper, NodeViewProps } from '@tiptap/react';
import React from 'react';

interface CharacterMentionAttrs {
  id: string;
  name: string;
  characterType: string;
  briefDescription?: string | null;
  categoryName?: string;
}

// React component to render the character mention with hover tooltip
const CharacterMentionComponent: React.FC<NodeViewProps> = ({ node, selected }) => {
  const attrs = node.attrs as CharacterMentionAttrs;

  const handleMouseEnter = (e: React.MouseEvent) => {
    const rect = (e.target as HTMLElement).getBoundingClientRect();
    window.dispatchEvent(new CustomEvent('mention-hover', {
      detail: {
        entity: attrs,
        rect,
      },
    }));
  };

  const handleMouseLeave = () => {
    window.dispatchEvent(new CustomEvent('mention-leave'));
  };

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    window.dispatchEvent(new CustomEvent('mention-click', {
      detail: {
        entity: attrs,
      },
    }));
  };

  return (
    <NodeViewWrapper
      as="span"
      className={`character-mention ${selected ? 'selected' : ''}`}
      data-id={attrs.id}
      data-name={attrs.name}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onClick={handleClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '2px 8px',
        borderRadius: '4px',
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
        color: '#a78bfa',
        fontWeight: 500,
        cursor: 'pointer',
        border: selected ? '1px solid #8b5cf6' : '1px solid transparent',
        transition: 'background-color 0.15s ease, border-color 0.15s ease',
      }}
    >
      @{attrs.name}
    </NodeViewWrapper>
  );
};

// Tiptap Node extension for character mentions
export const CharacterMention = Node.create({
  name: 'characterMention',

  group: 'inline',

  inline: true,

  atom: true,

  addAttributes() {
    return {
      id: {
        default: null,
      },
      name: {
        default: null,
      },
      characterType: {
        default: 'character',
      },
      briefDescription: {
        default: null,
      },
      categoryName: {
        default: null,
      },
    };
  },

  parseHTML() {
    return [
      {
        tag: 'span[data-character-mention]',
      },
    ];
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'span',
      mergeAttributes(HTMLAttributes, {
        'data-character-mention': '',
        'data-id': HTMLAttributes.id,
        'data-name': HTMLAttributes.name,
        'data-type': HTMLAttributes.characterType,
      }),
      `@${HTMLAttributes.name}`
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CharacterMentionComponent);
  },
});
