import { describe, it, expect, vi, beforeEach } from 'vitest';
import { chatService } from '@/features/chat/services/chat.service';
import { apiPost } from '@/shared/lib/api';

vi.mock('@/shared/lib/api', () => ({
  apiGet: vi.fn(),
  apiPost: vi.fn(),
  apiPut: vi.fn(),
  apiDelete: vi.fn(),
}));

describe('Chat Attachment & File Upload Unit Tests', () => {
  const mockedApiPost = vi.mocked(apiPost);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('File Size Limits', () => {
    it('rejects image files exceeding 20MB limit', async () => {
      const overLimitSize = 21 * 1024 * 1024; // 21MB
      const bigImage = new File([''], 'huge_diagram.png', {
        type: 'image/png',
      });
      Object.defineProperty(bigImage, 'size', { value: overLimitSize });

      await expect(
        chatService.uploadChatFile('conv-1', bigImage),
      ).rejects.toThrow(/vượt quá dung lượng tối đa 20MB/);
    });

    it('rejects general files exceeding 50MB limit', async () => {
      const overLimitSize = 51 * 1024 * 1024; // 51MB
      const bigFile = new File([''], 'massive_archive.zip', {
        type: 'application/zip',
      });
      Object.defineProperty(bigFile, 'size', { value: overLimitSize });

      await expect(
        chatService.uploadChatFile('conv-1', bigFile),
      ).rejects.toThrow(/vượt quá dung lượng tối đa 50MB/);
    });
  });

  describe('R2 Presigned Upload Flow', () => {
    it('executes presign, uploads directly to R2, and completes attachment', async () => {
      const validFile = new File(['dataset content'], 'research.pdf', {
        type: 'application/pdf',
      });
      Object.defineProperty(validFile, 'size', { value: 1024 * 100 });

      // Mock presign response
      mockedApiPost.mockImplementation(async (path: string) => {
        if (path.includes('/attachments/presign')) {
          return {
            uploadUrl: 'https://r2.cloudflarestorage.com/upload-put-url',
            storageKey: 'chat/conv-1/2026/11/abc-research.pdf',
            filename: 'research.pdf',
            sizeBytes: 1024 * 100,
            mimeType: 'application/pdf',
            maxSizeBytes: 50 * 1024 * 1024,
            expiresIn: 900,
            type: 'file',
          };
        }
        if (path.includes('/attachments/complete')) {
          return {
            id: 'att-123',
            name: 'research.pdf',
            url: 'https://cdn.flux.local/chat/conv-1/2026/11/abc-research.pdf',
            storageKey: 'chat/conv-1/2026/11/abc-research.pdf',
            size: 1024 * 100,
            mimeType: 'application/pdf',
            type: 'file',
          };
        }
        return {};
      });

      // Mock uploadToPresignedUrl
      const uploadSpy = vi
        .spyOn(chatService, 'uploadToPresignedUrl')
        .mockResolvedValue(undefined);

      const progressCallback = vi.fn();
      const result = await chatService.uploadChatFile(
        'conv-1',
        validFile,
        progressCallback,
      );

      expect(mockedApiPost).toHaveBeenCalledWith(
        '/api/chat/conversations/conv-1/attachments/presign',
        expect.objectContaining({
          filename: 'research.pdf',
          sizeBytes: 1024 * 100,
          mimeType: 'application/pdf',
        }),
      );

      expect(uploadSpy).toHaveBeenCalledWith(
        'https://r2.cloudflarestorage.com/upload-put-url',
        validFile,
        'application/pdf',
        progressCallback,
      );

      expect(mockedApiPost).toHaveBeenCalledWith(
        '/api/chat/conversations/conv-1/attachments/complete',
        expect.objectContaining({
          storageKey: 'chat/conv-1/2026/11/abc-research.pdf',
          filename: 'research.pdf',
        }),
      );

      expect(result.id).toBe('att-123');
      expect(result.name).toBe('research.pdf');
      expect(result.type).toBe('file');
    });

    it('falls back to direct multipart upload if presigned flow fails', async () => {
      const validImage = new File(['image bytes'], 'figure1.png', {
        type: 'image/png',
      });
      Object.defineProperty(validImage, 'size', { value: 1024 * 50 });

      // Mock presign failure
      vi.spyOn(chatService, 'presignAttachment').mockRejectedValue(
        new Error('Presign endpoint offline'),
      );

      const fallbackMock = vi
        .spyOn(chatService, 'uploadAttachmentDirect')
        .mockResolvedValue({
          id: 'att-fallback',
          name: 'figure1.png',
          url: '/api/chat/attachments/stream?key=chat/conv-1/figure1.png',
          size: 1024 * 50,
          mimeType: 'image/png',
          type: 'image',
        });

      const result = await chatService.uploadChatFile('conv-1', validImage);

      expect(fallbackMock).toHaveBeenCalledWith('conv-1', expect.any(FormData));
      expect(result.id).toBe('att-fallback');
      expect(result.type).toBe('image');
    });
  });
});
