// ─── Core Domain Types ─────────────────────────────────────────────────────────

export type EntryType =
  | 'character'
  | 'location'
  | 'faction'
  | 'kingdom'
  | 'creature'
  | 'item'
  | 'event'
  | 'concept'
  | 'other';

export type LayoutType = '1-col' | '2-col' | '3-col';

export type BlockType =
  | 'rich-text'
  | 'image'
  | 'gallery'
  | 'list'
  | 'quote'
  | 'key-info'
  | 'table'
  | 'divider'
  | 'related-links'
  | 'entry-reference';

// ─── Category ─────────────────────────────────────────────────────────────────

export interface UniverseCategory {
  id: string;
  name: string;
  description?: string;
  icon?: string;
  color?: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// ─── Entry Type ───────────────────────────────────────────────────────────────

export interface UniverseEntryType {
  id: EntryType;
  nameEs: string;
  nameEn: string;
  icon: string;
  color: string;
}

// ─── Entry ─────────────────────────────────────────────────────────────────────

export interface UniverseEntry {
  id: string;
  categoryId: string;
  entryType: EntryType;
  name: string;
  briefDescription?: string;
  icon?: string;
  coverImageId?: string;
  layout: LayoutType;
  isFeatured: boolean;
  tags: string[];
  metadata: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

// ─── Block Content Types ───────────────────────────────────────────────────────

export interface RichTextBlockContent {
  type: 'rich-text';
  html: string;
}

export interface ImageBlockContent {
  type: 'image';
  assetId: string;
  caption?: string;
  alt?: string;
  size?: 'small' | 'medium' | 'large';
}

export interface GalleryBlockContent {
  type: 'gallery';
  assetIds: string[];
  layout: 'grid' | 'masonry' | 'carousel';
  caption?: string;
}

export interface ListBlockContent {
  type: 'list';
  style: 'bullet' | 'numbered' | 'checklist';
  items: ListItem[];
}

export interface ListItem {
  id: string;
  text: string;
  checked?: boolean;
}

export interface QuoteBlockContent {
  type: 'quote';
  text: string;
  attribution?: string;
  source?: string;
}

export interface KeyInfoBlockContent {
  type: 'key-info';
  fields: KeyInfoField[];
}

export interface KeyInfoField {
  label: string;
  value: string;
  icon?: string;
}

export interface TableBlockContent {
  type: 'table';
  headers: string[];
  rows: string[][];
}

export interface DividerBlockContent {
  type: 'divider';
  style?: 'line' | 'dots' | 'ornament';
}

export interface RelatedLinksBlockContent {
  type: 'related-links';
  links: RelatedLink[];
}

export interface RelatedLink {
  entryId?: string;
  url?: string;
  label: string;
}

export interface EntryReferenceBlockContent {
  type: 'entry-reference';
  entryId: string;
  displayMode: 'card' | 'inline' | 'badge';
  note?: string;
}

export type BlockContent =
  | RichTextBlockContent
  | ImageBlockContent
  | GalleryBlockContent
  | ListBlockContent
  | QuoteBlockContent
  | KeyInfoBlockContent
  | TableBlockContent
  | DividerBlockContent
  | RelatedLinksBlockContent
  | EntryReferenceBlockContent;

// ─── Block ─────────────────────────────────────────────────────────────────────

export interface UniverseBlock {
  id: string;
  entryId: string;
  columnIndex: 0 | 1 | 2;
  blockOrder: number;
  blockType: BlockType;
  content: BlockContent;
  createdAt: string;
  updatedAt: string;
}

// ─── Relation ─────────────────────────────────────────────────────────────────

export interface UniverseRelation {
  id: string;
  sourceEntryId: string;
  targetEntryId: string;
  relationType: string;
  description?: string;
  createdAt: string;
}

// ─── Complete Universe Data ────────────────────────────────────────────────────

export interface UniverseData {
  categories: UniverseCategory[];
  entryTypes: UniverseEntryType[];
  entries: UniverseEntry[];
  blocks: UniverseBlock[];
  relations: UniverseRelation[];
}

export interface UniverseEntryWithBlocks {
  entry: UniverseEntry;
  blocks: UniverseBlock[];
  relations: UniverseRelation[];
}

// ─── UI State Types ───────────────────────────────────────────────────────────

export interface EntryWizardData {
  name: string;
  type: EntryType;
  description: string;
  icon?: string;
  coverImageId?: string;
  categoryId: string;
}

export interface BlockEditorState {
  selectedBlockId: string | null;
  selectedColumn: 0 | 1 | 2;
  isDragging: boolean;
  draggedBlockId: string | null;
}

export interface UniverseViewState {
  mode: 'index' | 'category' | 'entry';
  selectedCategoryId: string | null;
  selectedEntryId: string | null;
  editMode: boolean;
  searchQuery: string;
  filterType: EntryType | 'all';
}

// ─── Helper Functions ───────────────────────────────────────────────────────────

export function createDefaultBlock(
  entryId: string,
  blockType: BlockType,
  columnIndex: 0 | 1 | 2,
  order: number
): UniverseBlock {
  const now = new Date().toISOString();
  let content: BlockContent;

  switch (blockType) {
    case 'rich-text':
      content = { type: 'rich-text', html: '' };
      break;
    case 'image':
      content = { type: 'image', assetId: '' };
      break;
    case 'gallery':
      content = { type: 'gallery', assetIds: [], layout: 'grid' };
      break;
    case 'list':
      content = { type: 'list', style: 'bullet', items: [] };
      break;
    case 'quote':
      content = { type: 'quote', text: '', attribution: '' };
      break;
    case 'key-info':
      content = { type: 'key-info', fields: [] };
      break;
    case 'table':
      content = { type: 'table', headers: [], rows: [] };
      break;
    case 'divider':
      content = { type: 'divider', style: 'line' };
      break;
    case 'related-links':
      content = { type: 'related-links', links: [] };
      break;
    case 'entry-reference':
      content = { type: 'entry-reference', entryId: '', displayMode: 'card' };
      break;
    default:
      content = { type: 'rich-text', html: '' };
  }

  return {
    id: crypto.randomUUID(),
    entryId,
    columnIndex,
    blockOrder: order,
    blockType,
    content,
    createdAt: now,
    updatedAt: now,
  };
}

export function getEntryTypeColor(type: EntryType): string {
  const colors: Record<EntryType, string> = {
    character: '#e879f9',
    location: '#4ade80',
    faction: '#f59e0b',
    kingdom: '#a78bfa',
    creature: '#f87171',
    item: '#38bdf8',
    event: '#fbbf24',
    concept: '#94a3b8',
    other: '#6ee7b7',
  };
  return colors[type];
}

export function getEntryTypeIcon(type: EntryType): string {
  const icons: Record<EntryType, string> = {
    character: 'user',
    location: 'map-pin',
    faction: 'users',
    kingdom: 'crown',
    creature: 'paw-print',
    item: 'gem',
    event: 'calendar',
    concept: 'lightbulb',
    other: 'file-text',
  };
  return icons[type];
}
