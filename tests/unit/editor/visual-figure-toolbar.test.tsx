import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup } from '@testing-library/react';
import React from 'react';
import {
  VisualFigureToolbar,
  type VisualFigureToolbarProps,
} from '@/features/editor/ui/features/editor/VisualFigureToolbar';

describe('VisualFigureToolbar Component (Overleaf Parity)', () => {
  const defaultProps: VisualFigureToolbarProps = {
    position: { top: 120, left: 250 },
    src: 'figures/model-architecture.png',
    width: '0.8\\linewidth',
    caption: 'Overview of neural model',
    label: 'fig:model',
    isCentering: true,
    isStarred: false,
    projectImageFiles: ['figures/model-architecture.png', 'results/chart.pdf'],
    onChangeWidth: vi.fn(),
    onChangeImage: vi.fn(),
    onUpdateMetadata: vi.fn(),
    onToggleCentering: vi.fn(),
    onToggleStarred: vi.fn(),
    onDeleteFigure: vi.fn(),
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    cleanup();
    vi.clearAllMocks();
  });

  it('renders toolbar with role, coordinate styles, filename badge and action buttons', () => {
    render(<VisualFigureToolbar {...defaultProps} />);

    const toolbar = screen.getByRole('toolbar', { name: /figure floating toolbar/i });
    expect(toolbar).toBeInTheDocument();
    expect(toolbar.style.top).toBe('120px');
    expect(toolbar.style.left).toBe('250px');

    // Filename badge
    expect(screen.getByText('model-architecture.png')).toBeInTheDocument();

    // Centering and Starred buttons
    expect(screen.getByRole('button', { name: /toggle centering/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /toggle two-column span/i })).toBeInTheDocument();

    // Delete and Close
    expect(screen.getByRole('button', { name: /delete figure/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /close toolbar/i })).toBeInTheDocument();
  });

  it('triggers onChangeWidth when width preset buttons are clicked', () => {
    render(<VisualFigureToolbar {...defaultProps} />);

    // 50%
    const btn50 = screen.getByRole('button', { name: /width 50%/i });
    fireEvent.click(btn50);
    expect(defaultProps.onChangeWidth).toHaveBeenCalledWith('0.5\\linewidth');

    // 100%
    const btn100 = screen.getByRole('button', { name: /width 100%/i });
    fireEvent.click(btn100);
    expect(defaultProps.onChangeWidth).toHaveBeenCalledWith('1.0\\linewidth');

    // Full text width
    const btnFull = screen.getByRole('button', { name: /width full/i });
    fireEvent.click(btnFull);
    expect(defaultProps.onChangeWidth).toHaveBeenCalledWith('\\textwidth');
  });

  it('triggers onToggleCentering and onToggleStarred', () => {
    render(<VisualFigureToolbar {...defaultProps} />);

    const centerBtn = screen.getByRole('button', { name: /toggle centering/i });
    fireEvent.click(centerBtn);
    expect(defaultProps.onToggleCentering).toHaveBeenCalledTimes(1);

    const spanBtn = screen.getByRole('button', { name: /toggle two-column span/i });
    fireEvent.click(spanBtn);
    expect(defaultProps.onToggleStarred).toHaveBeenCalledTimes(1);
  });

  it('opens metadata drawer and updates caption and label', () => {
    render(<VisualFigureToolbar {...defaultProps} />);

    const settingsBtn = screen.getByRole('button', { name: /edit figure caption and label/i });
    fireEvent.click(settingsBtn);

    const captionInput = screen.getByRole('textbox', { name: /figure caption input/i });
    const labelInput = screen.getByRole('textbox', { name: /figure label input/i });

    expect(captionInput).toHaveValue('Overview of neural model');
    expect(labelInput).toHaveValue('fig:model');

    fireEvent.change(captionInput, { target: { value: 'Updated system architecture' } });
    fireEvent.change(labelInput, { target: { value: 'fig:arch_v2' } });

    const applyBtn = screen.getByRole('button', { name: /save metadata/i });
    fireEvent.click(applyBtn);

    expect(defaultProps.onUpdateMetadata).toHaveBeenCalledWith(
      'Updated system architecture',
      'fig:arch_v2'
    );
  });

  it('opens image picker drawer, lists project images, and updates image source', () => {
    render(<VisualFigureToolbar {...defaultProps} />);

    const assetBadge = screen.getByRole('button', { name: /image asset:/i });
    fireEvent.click(assetBadge);

    // Click project image button
    const projectImgBtn = screen.getByText('chart.pdf');
    fireEvent.click(projectImgBtn);

    expect(defaultProps.onChangeImage).toHaveBeenCalledWith('results/chart.pdf');
  });

  it('allows manual text input of image path in image picker drawer', () => {
    render(<VisualFigureToolbar {...defaultProps} />);

    const assetBadge = screen.getByRole('button', { name: /image asset:/i });
    fireEvent.click(assetBadge);

    const pathInput = screen.getByRole('textbox', { name: /image source path input/i });
    fireEvent.change(pathInput, { target: { value: 'assets/new-diagram.png' } });

    const setBtn = screen.getByRole('button', { name: /apply image path/i });
    fireEvent.click(setBtn);

    expect(defaultProps.onChangeImage).toHaveBeenCalledWith('assets/new-diagram.png');
  });

  it('triggers onDeleteFigure and onClose', () => {
    render(<VisualFigureToolbar {...defaultProps} />);

    const deleteBtn = screen.getByRole('button', { name: /delete figure/i });
    fireEvent.click(deleteBtn);
    expect(defaultProps.onDeleteFigure).toHaveBeenCalledTimes(1);

    const closeBtn = screen.getByRole('button', { name: /close toolbar/i });
    fireEvent.click(closeBtn);
    expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
  });
});
