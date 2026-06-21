import { Alert, Box, Stack } from '@mui/material';
import { useEffect, useRef, useState } from 'react';

const TURNSTILE_SCRIPT_URL =
  'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';
const TURNSTILE_SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;

declare global {
  interface Window {
    turnstile?: {
      render: (
        container: HTMLElement,
        options: {
          sitekey: string;
          theme?: 'light' | 'dark' | 'auto';
          callback: (token: string) => void;
          'expired-callback': () => void;
          'error-callback': () => void;
        },
      ) => string;
      remove: (widgetId: string) => void;
      reset: (widgetId: string) => void;
    };
    turnstileScriptPromise?: Promise<void>;
  }
}

function loadTurnstileScript(): Promise<void> {
  if (window.turnstile) {
    return Promise.resolve();
  }

  if (window.turnstileScriptPromise) {
    return window.turnstileScriptPromise;
  }

  window.turnstileScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = TURNSTILE_SCRIPT_URL;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Unable to load Turnstile'));
    document.head.appendChild(script);
  });

  return window.turnstileScriptPromise;
}

export function TurnstileWidget({
  onTokenChange,
}: {
  onTokenChange: (token: string | null) => void;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const widgetIdRef = useRef<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function renderWidget() {
      if (!TURNSTILE_SITE_KEY) {
        setError('Turnstile site key is not configured.');
        return;
      }

      try {
        await loadTurnstileScript();

        if (cancelled || !containerRef.current || !window.turnstile) {
          return;
        }

        widgetIdRef.current = window.turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          theme: 'light',
          callback: (token) => {
            setError(null);
            onTokenChange(token);
          },
          'expired-callback': () => {
            onTokenChange(null);
          },
          'error-callback': () => {
            onTokenChange(null);
            setError('Verification failed. Please retry the challenge.');
          },
        });
      } catch {
        setError('Unable to load human verification.');
      }
    }

    void renderWidget();

    return () => {
      cancelled = true;

      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
    };
  }, [onTokenChange]);

  return (
    <Stack spacing={1}>
      <Box className="turnstile-box" ref={containerRef} />
      {error ? <Alert severity="error">{error}</Alert> : null}
    </Stack>
  );
}
