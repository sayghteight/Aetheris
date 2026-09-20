import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewWrapper } from '@tiptap/react';
import React from 'react';

// React component to render the character mention
const CharacterMentionComponent: React.FC<{ node: any; selected: boolean }> = ({ node, selected }) => {
  return (
    <NodeViewWrapper
      as="span"
      className={`character-mention ${selected ? 'selected' : ''}`}
      data-id={node.attrs.id}
      data-name={node.attrs.name}
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
      }}
    >
      @{node.attrs.name}
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
    return ['span', mergeAttributes(HTMLAttributes, { 'data-character-mention': '' }), `@${HTMLAttributes.name}`];
  },

  addNodeView() {
    return ReactNodeViewRenderer(CharacterMentionComponent);
  },
});
