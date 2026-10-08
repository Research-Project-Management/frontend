import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import {
  VisualSelectionBubbleMenu,
  type VisualSelectionBubbleMenuProps,
  type BlockType,
} from '@/features/editor/ui/features/editor/VisualSelectionBubbleMenu';

describe('VisualSelectionBubbleMenu Component', () => {
  const defaultProps: VisualSelectionBubbleMenuProps = {
    position: { top: 150, left: 300 },
    activeFormats: {
      bold: false,
      italic: false,
      underline: false,
      strike: false,
      code: false,
      blockType: 'p',
    },
    onFormat: vi.fn(),
    onBlockTypeChange: vi.fn(),
    onConvertToMath: vi.fn(),
    onConvertToCitation: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders toolbar with proper role, accessibility label and coordinates', () => {
    render(<VisualSelectionBubbleMenu {...defaultProps} />);

    const toolbar = screen.getByRole('toolbar', { name: /selection bubble menu/i });
    expect(toolbar).toBeInTheDocument();
    expect(toolbar.style.top).toBe('150px');
    expect(toolbar.style.left).toBe('300px');
  });

  it('prevents default on mousedown to preserve browser text selection', () => {
    render(<VisualSelectionBubbleMenu {...defaultProps} />);

    const toolbar = screen.getByRole('toolbar', { name: /selection bubble menu/i });
    const event = new MouseEvent('mousedown', { bubbles: true, cancelable: true });
    toolbar.dispatchEvent(event);

    expect(event.defaultPrevented).toBe(true);
  });

  it('triggers onFormat with bold, italic, underline, strike, and code', () => {
    render(<VisualSelectionBubbleMenu {...defaultProps} />);

    // Bold
    const boldBtn = screen.getByRole('button', { name: /format bold/i });
    fireEvent.click(boldBtn);
    expect(defaultProps.onFormat).toHaveBeenCalledWith('bold');

    // Italic
    const italicBtn = screen.getByRole('button', { name: /format italic/i });
    fireEvent.click(italicBtn);
    expect(defaultProps.onFormat).toHaveBeenCalledWith('italic');

    // Underline
    const underlineBtn = screen.getByRole('button', { name: /format underline/i });
    fireEvent.click(underlineBtn);
    expect(defaultProps.onFormat).toHaveBeenCalledWith('underline');

    // Strikethrough
    const strikeBtn = screen.getByRole('button', { name: /format strikethrough/i });
    fireEvent.click(strikeBtn);
    expect(defaultProps.onFormat).toHaveBeenCalledWith('strike');

    // Code
    const codeBtn = screen.getByRole('button', { name: /format inline code/i });
    fireEvent.click(codeBtn);
    expect(defaultProps.onFormat).toHaveBeenCalledWith('code');
  });

  it('triggers academic actions for Math formula and Citation', () => {
    render(<VisualSelectionBubbleMenu {...defaultProps} />);

    const mathBtn = screen.getByRole('button', { name: /convert to math formula/i });
    fireEvent.click(mathBtn);
    expect(defaultProps.onConvertToMath).toHaveBeenCalledTimes(1);

    const citeBtn = screen.getByRole('button', { name: /insert citation/i });
    fireEvent.click(citeBtn);
    expect(defaultProps.onConvertToCitation).toHaveBeenCalledTimes(1);
  });

  it('shows active formatting styling when bold and code are active', () => {
    render(
      <VisualSelectionBubbleMenu
        {...defaultProps}
        activeFormats={{
          ...defaultProps.activeFormats,
          bold: true,
          code: true,
        }}
      />
    );

    const boldBtn = screen.getByRole('button', { name: /format bold/i });
    expect(boldBtn.className).toContain('bg-primary/15');

    const codeBtn = screen.getByRole('button', { name: /format inline code/i });
    expect(codeBtn.className).toContain('bg-primary/15');

    const italicBtn = screen.getByRole('button', { name: /format italic/i });
    expect(italicBtn.className).not.toContain('bg-primary/15');
  });

  it('opens block type dropdown and triggers onBlockTypeChange', () => {
    render(<VisualSelectionBubbleMenu {...defaultProps} />);

    // Current block style button
    const blockDropdownBtn = screen.getByRole('button', { name: /block style: text/i });
    expect(blockDropdownBtn).toBeInTheDocument();

    // Click to open dropdown
    fireEvent.click(blockDropdownBtn);

    const dropdownMenu = screen.getByRole('menu', { name: /block style options/i });
    expect(dropdownMenu).toBeInTheDocument();

    // Select Section (H1)
    const sectionOption = screen.getByRole('menuitem', { name: /^section$/i });
    fireEvent.click(sectionOption);

    expect(defaultProps.onBlockTypeChange).toHaveBeenCalledWith('h1');
    expect(screen.queryByRole('menu', { name: /block style options/i })).not.toBeInTheDocument();
  });

  it('displays correct label when blockType is subsection (h2)', () => {
    render(
      <VisualSelectionBubbleMenu
        {...defaultProps}
        activeFormats={{
          ...defaultProps.activeFormats,
          blockType: 'h2',
        }}
      />
    );

    const blockDropdownBtn = screen.getByRole('button', { name: /block style: subsection/i });
    expect(blockDropdownBtn).toBeInTheDocument();
  });
});
