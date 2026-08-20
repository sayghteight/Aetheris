import { useEffect, useRef, useCallback } from 'react';
import { Editor } from '@tiptap/react';

interface UseCenteredWritingOptions {
  editor: Editor | null;
  enabled: boolean;
  targetPosition: number; // 30, 40, 50, 60
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
}

interface ScrollInfo {
  isUserScrolling: boolean;
  lastScrollTime: number;
}

const USER_SCROLL_TIMEOUT = 150; // ms to wait after user scroll before re-enabling

/**
 * Hook that implements typewriter-style centered writing.
 * When enabled, automatically scrolls the editor to keep the caret
 * at a stable vertical position (e.g., 50% of viewport height).
 */
export function useCenteredWriting({
  editor,
  enabled,
  targetPosition,
  scrollContainerRef,
}: UseCenteredWritingOptions) {
  const isApplyingScroll = useRef(false);
  const scrollInfoRef = useRef<ScrollInfo>({
    isUserScrolling: false,
    lastScrollTime: 0,
  });
  const rafIdRef = useRef<number | null>(null);

  // Calculate the target scroll position to keep caret at targetPosition%
  const calculateScrollTarget = useCallback(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return null;

    const containerHeight = scrollContainer.clientHeight;
    const containerScrollHeight = scrollContainer.scrollHeight;
    const scrollTop = scrollContainer.scrollTop;

    // Get caret rect
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return null;

    const range = selection.getRangeAt(0);
    const caretRect = range.getBoundingClientRect();

    // If caret rect is empty (e.g., no visible cursor), skip
    if (caretRect.width === 0 && caretRect.height === 0) return null;

    const containerRect = scrollContainer.getBoundingClientRect();

    // The caret's position relative to the viewport
    const caretTopInViewport = caretRect.top;

    // The container's top position relative to viewport
    const containerTopInViewport = containerRect.top;

    // The caret's position relative to the container
    const caretTopInContainer = caretTopInViewport - containerTopInViewport + scrollTop;

    // Calculate the desired scrollTop to place caret at targetPosition%
    const targetY = (containerHeight * targetPosition) / 100;
    const desiredScrollTop = caretTopInContainer - targetY;

    // Clamp to valid scroll range
    const maxScroll = containerScrollHeight - containerHeight;
    return Math.max(0, Math.min(maxScroll, desiredScrollTop));
  }, [scrollContainerRef, targetPosition]);

  // Apply centered scroll using smooth scrolling
  const applyCenteredScroll = useCallback(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!enabled || !editor || !scrollContainer) return;

    // Don't interfere with user scrolling
    if (scrollInfoRef.current.isUserScrolling) return;

    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return;

    // Only apply if there's a cursor (not a selection)
    if (!selection.isCollapsed) return;

    const targetScroll = calculateScrollTarget();
    if (targetScroll === null) return;

    const currentScroll = scrollContainer.scrollTop;
    const diff = Math.abs(targetScroll - currentScroll);

    // Only scroll if there's a meaningful difference (>2px threshold)
    if (diff < 2) return;

    isApplyingScroll.current = true;
    scrollContainer.scrollTo({
      top: targetScroll,
      behavior: 'smooth',
    });

    // Reset flag after scroll animation
    setTimeout(() => {
      isApplyingScroll.current = false;
    }, 300);
  }, [enabled, editor, scrollContainerRef, calculateScrollTarget]);

  // Throttled scroll handler to detect user scrolling
  const handleScroll = useCallback(() => {
    if (isApplyingScroll.current) return;

    scrollInfoRef.current.isUserScrolling = true;
    scrollInfoRef.current.lastScrollTime = Date.now();

    // After user stops scrolling for a while, re-enable centered writing
    setTimeout(() => {
      if (
        Date.now() - scrollInfoRef.current.lastScrollTime >=
        USER_SCROLL_TIMEOUT
      ) {
        scrollInfoRef.current.isUserScrolling = false;
      }
    }, USER_SCROLL_TIMEOUT);
  }, []);

  // Set up scroll event listener on the container
  useEffect(() => {
    const scrollContainer = scrollContainerRef.current;
    if (!scrollContainer) return;

    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll);
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [scrollContainerRef, handleScroll]);

  // Handle selection updates to trigger centered scroll
  useEffect(() => {
    if (!editor || !enabled) return;

    const handleSelectionUpdate = () => {
      if (!enabled || scrollInfoRef.current.isUserScrolling) return;

      // Use RAF to batch scroll operations
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }

      rafIdRef.current = requestAnimationFrame(() => {
        applyCenteredScroll();
      });
    };

    editor.on('selectionUpdate', handleSelectionUpdate);

    // Also handle transaction (typing, deleting, etc.)
    const handleTransaction = () => {
      if (!enabled || scrollInfoRef.current.isUserScrolling) return;

      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }

      rafIdRef.current = requestAnimationFrame(() => {
        applyCenteredScroll();
      });
    };

    editor.on('transaction', handleTransaction);

    return () => {
      editor.off('selectionUpdate', handleSelectionUpdate);
      editor.off('transaction', handleTransaction);
      if (rafIdRef.current) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [editor, enabled, applyCenteredScroll]);

  // Handle Enter key and paragraph creation specially
  useEffect(() => {
    if (!editor || !enabled) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && !event.shiftKey) {
        // Small delay to let the cursor move to new line first
        setTimeout(() => {
          if (enabled && !scrollInfoRef.current.isUserScrolling) {
            applyCenteredScroll();
          }
        }, 10);
      }
    };

    const editorDom = editor.view.dom;
    editorDom.addEventListener('keydown', handleKeyDown, { passive: true });

    return () => {
      editorDom.removeEventListener('keydown', handleKeyDown);
    };
  }, [editor, enabled, applyCenteredScroll]);
}
