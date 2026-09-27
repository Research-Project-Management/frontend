import { IntegrationProvider } from '../types/integration.types';

export interface OAuthPopupResult {
  success: boolean;
  cancelled?: boolean;
  error?: string;
}

export async function openOAuthPopup(
  provider: IntegrationProvider,
  authUrl: string,
): Promise<OAuthPopupResult> {
  const width = 600;
  const height = 700;
  const left = window.screenX + (window.outerWidth - width) / 2;
  const top = window.screenY + (window.outerHeight - height) / 2;

  const popup = window.open(
    authUrl,
    `oauth_${provider}`,
    `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,status=no,toolbar=no`,
  );

  // If popup blocked by browser, fallback to standard redirect
  if (!popup || popup.closed || typeof popup.closed === 'undefined') {
    window.location.href = authUrl;
    return { success: false };
  }

  return new Promise((resolve) => {
    let checkInterval: any = null;

    const cleanup = () => {
      if (checkInterval) clearInterval(checkInterval);
      window.removeEventListener('message', handleMessage);
    };

    const handleMessage = (event: MessageEvent) => {
      // Validate origin and message payload
      if (event.data?.type === 'OAUTH_SUCCESS' && event.data?.provider === provider) {
        cleanup();
        try {
          popup.close();
        } catch {
          // ignore
        }
        resolve({ success: true });
      }
    };

    window.addEventListener('message', handleMessage);

    // Watch for user manually closing the popup without finishing
    checkInterval = setInterval(() => {
      if (popup.closed) {
        cleanup();
        resolve({ success: false, cancelled: true });
      }
    }, 600);
  });
}
