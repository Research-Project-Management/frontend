import React from 'react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor } from '@testing-library/react';
import { EditingModeDropdown } from '@/features/editor/ui/shell/topbar/EditingModeDropdown';
import { CommentCard } from '@/features/editor/ui/features/sidebar/review/subcomponents/ReviewComments';
import { EditorToolbar } from '@/features/editor/ui/features/editor/EditorToolbar';
import { FigureWizardModal } from '@/features/editor/ui/modals/FigureWizardModal';
import { useSettingsStore } from '@/features/editor/store/settings.store';
import { editorCommandBus } from '@/features/editor/coordinators/command-bus';
import { TooltipProvider } from '@/shared/components/ui/tooltip';

const mockMutateUpdate = vi.fn();
const mockMutateResolve = vi.fn();
const mockMutateDelete = vi.fn();
const mockMutateDeleteReply = vi.fn();

vi.mock('@/features/editor/ui/hooks/use-comment', () => ({
  useResolveComment: () => ({ mutate: mockMutateResolve, isPending: false }),
  useDeleteComment: () => ({ mutate: mockMutateDelete, isPending: false }),
  useDeleteReply: () => ({ mutate: mockMutateDeleteReply, isPending: false }),
  useAddReply: () => ({ mutate: vi.fn(), isPending: false }),
  useCreateComment: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateComment: () => ({ mutate: mockMutateUpdate, isPending: false }),
}));

vi.mock('@/features/editor/ui/hooks/use-storage', () => ({
  useEditorStorage: () => ({
    files: [
      { id: 'img-1', filename: 'figure1.png', url: '/figure1.png', isFolder: false, mimeType: 'image/png' },
    ],
    isLoading: false,
    uploadFile: vi.fn().mockResolvedValue({ id: 'img-1', filename: 'figure1.png' }),
  }),
}));

describe('Overleaf 1:1 Parity: Editing Modes, Comment Editing, Omega Button & Figure Wizard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useSettingsStore.setState({
      reviewMode: false,
      isLocked: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it('EditingModeDropdown supports 3 modes: Editing, Reviewing, and Viewing (Read-only)', async () => {
    render(
      <TooltipProvider>
        <EditingModeDropdown />
      </TooltipProvider>
    );

    // Initial state: Editing
    expect(screen.getByRole('button', { name: /editing mode: editing/i })).toBeDefined();

    // Open dropdown via pointerDown (Radix UI convention)
    const trigger = screen.getByRole('button', { name: /editing mode: editing/i });
    fireEvent.pointerDown(trigger);

    // Select Viewing (Read-only)
    const viewingOption = await screen.findByText('Viewing');
    fireEvent.click(viewingOption);

    expect(useSettingsStore.getState().isLocked).toBe(true);
    expect(useSettingsStore.getState().reviewMode).toBe(false);

    // Reopen and select Reviewing
    fireEvent.pointerDown(trigger);
    const reviewingOption = await screen.findByText('Reviewing');
    fireEvent.click(reviewingOption);

    expect(useSettingsStore.getState().isLocked).toBe(false);
    expect(useSettingsStore.getState().reviewMode).toBe(true);

    // Reopen and select Editing
    fireEvent.pointerDown(trigger);
    const editingOption = await screen.findByText('Editing');
    fireEvent.click(editingOption);

    expect(useSettingsStore.getState().isLocked).toBe(false);
    expect(useSettingsStore.getState().reviewMode).toBe(false);
  });

  it('CommentCard allows comment author to edit comment and save changes', async () => {
    const mockComment: any = {
      id: 'comment-101',
      page: 'page-1',
      content: 'Original comment text',
      status: 'open',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      author: { id: 'user-me', name: 'Author Me' },
      replies: [],
    };

    render(
      <TooltipProvider>
        <CommentCard
          comment={mockComment}
          pageId="page-1"
          currentUserId="user-me"
        />
      </TooltipProvider>
    );

    expect(screen.getByText('Original comment text')).toBeDefined();

    // Open comment options menu via pointerDown
    const moreBtn = screen.getByLabelText('Comment options');
    fireEvent.pointerDown(moreBtn);

    // Click "Edit comment"
    const editBtn = await screen.findByText('Edit comment');
    fireEvent.click(editBtn);

    // Textarea should appear with original content
    const textarea = screen.getByDisplayValue('Original comment text');
    expect(textarea).toBeDefined();

    // Change text and click Save
    fireEvent.change(textarea, { target: { value: 'Updated comment text by author' } });
    const saveBtn = screen.getByRole('button', { name: 'Save' });
    fireEvent.click(saveBtn);

    expect(mockMutateUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        pageId: 'page-1',
        commentId: 'comment-101',
        content: 'Updated comment text by author',
      }),
      expect.any(Object)
    );
  });

  it('EditorToolbar includes the Omega (Ω) Symbol button and opens symbol palette', () => {
    const dispatchSpy = vi.spyOn(editorCommandBus, 'dispatch');

    render(
      <TooltipProvider>
        <EditorToolbar />
      </TooltipProvider>
    );

    const omegaBtn = screen.getByRole('button', { name: /Insert Symbol \(Ω\)/i });
    expect(omegaBtn).toBeDefined();

    fireEvent.click(omegaBtn);

    expect(dispatchSpy).toHaveBeenCalledWith({
      type: 'dialog:open',
      dialog: 'symbol-palette',
    });
  });

  it('FigureWizardModal allows typing custom image path, relative path, or URL', () => {
    const onInsert = vi.fn();
    render(
      <FigureWizardModal
        open={true}
        onOpenChange={vi.fn()}
        parentPageId="page-1"
        onInsert={onInsert}
      />
    );

    const customInput = screen.getByPlaceholderText(/figures\/chart\.pdf, or https/i);
    expect(customInput).toBeDefined();

    fireEvent.change(customInput, { target: { value: 'figures/custom_diagram.pdf' } });

    // Live preview should show \includegraphics with custom path
    expect(screen.getByText(/figures\/custom_diagram\.pdf/i)).toBeDefined();
  });
});
