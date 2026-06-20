import AddIcon from '@mui/icons-material/Add';
import ArchiveIcon from '@mui/icons-material/Archive';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import LinkIcon from '@mui/icons-material/Link';
import LogoutIcon from '@mui/icons-material/Logout';
import UnarchiveIcon from '@mui/icons-material/Unarchive';
import {
  Alert,
  AppBar,
  Box,
  Button,
  CircularProgress,
  Container,
  CssBaseline,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ThemeProvider,
  Toolbar,
  Typography,
  createTheme,
} from '@mui/material';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { FormEvent, ReactElement } from 'react';
import {
  Link as RouterLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from 'react-router-dom';
import {
  archiveLink,
  ApiError,
  createLink,
  getLinks,
  getShortUrl,
  login,
  register,
  unarchiveLink,
} from './api';
import type { ShortLink } from './api';
import { clearAuth, getToken, getUser, saveAuth } from './auth';
import './App.css';

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

function TurnstileWidget({
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

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: {
      main: '#1769aa',
    },
    secondary: {
      main: '#2e7d32',
    },
    background: {
      default: '#f6f8fb',
      paper: '#ffffff',
    },
    text: {
      primary: '#172033',
      secondary: '#667085',
    },
  },
  shape: {
    borderRadius: 8,
  },
  typography: {
    fontFamily:
      'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
    h4: {
      fontWeight: 700,
      letterSpacing: 0,
    },
    h5: {
      fontWeight: 700,
      letterSpacing: 0,
    },
    button: {
      fontWeight: 700,
      letterSpacing: 0,
      textTransform: 'none',
    },
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          minHeight: 40,
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: {
          backgroundImage: 'none',
        },
      },
    },
  },
});

function ProtectedRoute({ children }: { children: ReactElement }) {
  const location = useLocation();

  if (!getToken()) {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return children;
}

function PublicOnlyRoute({ children }: { children: ReactElement }) {
  if (getToken()) {
    return <Navigate to="/my-links" replace />;
  }

  return children;
}

function RootRedirect() {
  return <Navigate to={getToken() ? '/my-links' : '/login'} replace />;
}

function AuthLayout({ mode }: { mode: 'login' | 'register' }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isLogin = mode === 'login';

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const auth = isLogin
        ? await login(email, password, turnstileToken ?? '')
        : await register(email, password, turnstileToken ?? '');
      saveAuth(auth);
      navigate('/my-links', { replace: true });
    } catch (caughtError) {
      setTurnstileToken(null);
      setTurnstileResetKey((currentKey) => currentKey + 1);
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to complete request',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Box className="auth-shell">
      <Paper className="auth-panel" elevation={0}>
        <Stack spacing={3}>
          <Stack spacing={1}>
            <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
              <Box className="brand-mark">
                <LinkIcon fontSize="small" />
              </Box>
              <Typography variant="overline" color="text.secondary">
                Link desk
              </Typography>
            </Stack>
            <Typography variant="h4">
              {isLogin ? 'Sign in to your workspace' : 'Create your account'}
            </Typography>
            <Typography color="text.secondary">
              {isLogin
                ? 'Manage your shortened links and create new ones in seconds.'
                : 'Register to start saving memorable short links under your account.'}
            </Typography>
          </Stack>

          {error ? <Alert severity="error">{error}</Alert> : null}

          <Box component="form" onSubmit={handleSubmit}>
            <Stack spacing={2.25}>
              <TextField
                autoComplete="email"
                autoFocus
                fullWidth
                label="Email"
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
              <TextField
                autoComplete={isLogin ? 'current-password' : 'new-password'}
                fullWidth
                helperText="Use at least 6 characters."
                label="Password"
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
              <TurnstileWidget
                key={turnstileResetKey}
                onTokenChange={setTurnstileToken}
              />
              <Button
                disabled={isSubmitting || !turnstileToken}
                fullWidth
                size="large"
                type="submit"
                variant="contained"
              >
                {isSubmitting ? 'Working...' : isLogin ? 'Login' : 'Register'}
              </Button>
            </Stack>
          </Box>

          <Typography color="text.secondary" sx={{ textAlign: 'center' }}>
            {isLogin ? 'No account yet?' : 'Already registered?'}{' '}
            <Button
              component={RouterLink}
              size="small"
              to={isLogin ? '/register' : '/login'}
            >
              {isLogin ? 'Create one' : 'Login'}
            </Button>
          </Typography>
        </Stack>
      </Paper>
    </Box>
  );
}

function MyLinksPage() {
  const navigate = useNavigate();
  const token = getToken();
  const user = getUser();
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [fullUrl, setFullUrl] = useState('');
  const [shortId, setShortId] = useState('');
  const [duplicateLink, setDuplicateLink] = useState<ShortLink | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [isArchivedView, setIsArchivedView] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadLinks() {
      if (!token) {
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const nextLinks = await getLinks(token, isArchivedView);

        if (mounted) {
          setLinks(nextLinks);
        }
      } catch (caughtError) {
        if (mounted) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : 'Unable to load links',
          );
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void loadLinks();

    return () => {
      mounted = false;
    };
  }, [isArchivedView, token]);

  const linkCountLabel = useMemo(() => {
    if (links.length === 1) {
      return isArchivedView ? '1 archived link' : '1 active link';
    }

    return isArchivedView
      ? `${links.length} archived links`
      : `${links.length} active links`;
  }, [isArchivedView, links.length]);

  function handleLogout() {
    clearAuth();
    navigate('/login', { replace: true });
  }

  function openCreateDialog() {
    setDuplicateLink(null);
    setError(null);
    setDialogOpen(true);
  }

  function closeCreateDialog() {
    setDuplicateLink(null);
    setDialogOpen(false);
  }

  async function handleCreateLink(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!token) {
      return;
    }

    setIsCreating(true);
    setError(null);
    setDuplicateLink(null);

    try {
      const createdLink = await createLink(token, fullUrl, shortId);
      if (!isArchivedView) {
        setLinks((currentLinks) => [createdLink, ...currentLinks]);
      }
      setFullUrl('');
      setShortId('');
      setDialogOpen(false);
      setToast('Short link created');
    } catch (caughtError) {
      if (caughtError instanceof ApiError && caughtError.existingUrl) {
        setDuplicateLink(caughtError.existingUrl);
        return;
      }

      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to create link',
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function copyLink(link: ShortLink) {
    const shortUrl = getShortUrl(link.shortId);

    await navigator.clipboard.writeText(shortUrl);
    setToast('Copied short link');
  }

  async function handleArchive(link: ShortLink) {
    if (!token) {
      return;
    }

    setError(null);

    try {
      await archiveLink(token, link.shortId);
      setLinks((currentLinks) =>
        currentLinks.filter((currentLink) => currentLink.id !== link.id),
      );
      setToast('Link archived');
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to archive link',
      );
    }
  }

  async function handleUnarchive(link: ShortLink) {
    if (!token) {
      return;
    }

    setError(null);

    try {
      await unarchiveLink(token, link.shortId);
      setLinks((currentLinks) =>
        currentLinks.filter((currentLink) => currentLink.id !== link.id),
      );
      setToast('Link restored');
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to restore link',
      );
    }
  }

  return (
    <Box className="app-shell">
      <AppBar elevation={0} position="sticky" color="inherit">
        <Toolbar className="toolbar">
          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
            <Box className="brand-mark">
              <LinkIcon fontSize="small" />
            </Box>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                Link desk
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {user?.email}
              </Typography>
            </Box>
          </Stack>
          <Button
            color="inherit"
            onClick={handleLogout}
            startIcon={<LogoutIcon />}
          >
            Logout
          </Button>
        </Toolbar>
      </AppBar>

      <Container maxWidth="lg" className="content">
        <Stack spacing={3}>
          <Paper className="dashboard-header" elevation={0}>
            <Stack
              direction={{ xs: 'column', sm: 'row' }}
              spacing={2}
              sx={{ justifyContent: 'space-between' }}
            >
              <Box>
                <Typography variant="h4">My links</Typography>
                <Typography color="text.secondary">{linkCountLabel}</Typography>
              </Box>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <ToggleButtonGroup
                  color="primary"
                  exclusive
                  onChange={(_, value: 'active' | 'archived' | null) => {
                    if (value) {
                      setIsArchivedView(value === 'archived');
                    }
                  }}
                  size="small"
                  value={isArchivedView ? 'archived' : 'active'}
                >
                  <ToggleButton value="active">Active</ToggleButton>
                  <ToggleButton value="archived">Archived</ToggleButton>
                </ToggleButtonGroup>
                <Button
                  onClick={openCreateDialog}
                  size="large"
                  startIcon={<AddIcon />}
                  variant="contained"
                >
                  Create link
                </Button>
              </Stack>
            </Stack>
          </Paper>

          {error ? <Alert severity="error">{error}</Alert> : null}

          <Paper elevation={0} className="links-panel">
            {isLoading ? (
              <Box className="state-panel">
                <CircularProgress size={28} />
                <Typography color="text.secondary">Loading links...</Typography>
              </Box>
            ) : links.length === 0 ? (
              <Box className="state-panel">
                <LinkIcon color="primary" />
                <Typography variant="h6">
                  {isArchivedView
                    ? 'No archived links'
                    : 'No shortened links yet'}
                </Typography>
                <Typography color="text.secondary">
                  {isArchivedView
                    ? 'Archived links will appear here when you move them out of active use.'
                    : 'Create your first short link to see it listed here.'}
                </Typography>
                {!isArchivedView ? (
                  <Button
                    onClick={openCreateDialog}
                    startIcon={<AddIcon />}
                    variant="contained"
                  >
                    Create link
                  </Button>
                ) : null}
              </Box>
            ) : (
              <TableContainer>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Short link</TableCell>
                      <TableCell>Destination</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {links.map((link) => (
                      <TableRow key={link.id} hover>
                        <TableCell>
                          <Typography sx={{ fontWeight: 700 }}>
                            {getShortUrl(link.shortId)}
                          </Typography>
                          <Typography color="text.secondary" variant="caption">
                            {link.shortId}
                          </Typography>
                        </TableCell>
                        <TableCell className="destination-cell">
                          <Typography noWrap>{link.fullUrl}</Typography>
                        </TableCell>
                        <TableCell align="right">
                          <IconButton
                            aria-label={`Copy ${link.shortId}`}
                            onClick={() => void copyLink(link)}
                          >
                            <ContentCopyIcon fontSize="small" />
                          </IconButton>
                          {isArchivedView ? (
                            <IconButton
                              aria-label={`Restore ${link.shortId}`}
                              onClick={() => void handleUnarchive(link)}
                            >
                              <UnarchiveIcon fontSize="small" />
                            </IconButton>
                          ) : (
                            <IconButton
                              aria-label={`Archive ${link.shortId}`}
                              onClick={() => void handleArchive(link)}
                            >
                              <ArchiveIcon fontSize="small" />
                            </IconButton>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </TableContainer>
            )}
          </Paper>
        </Stack>
      </Container>

      <Dialog
        fullWidth
        maxWidth="sm"
        onClose={closeCreateDialog}
        open={dialogOpen}
      >
        <Box component="form" onSubmit={handleCreateLink}>
          <DialogTitle>Create a short link</DialogTitle>
          <DialogContent>
            <Stack spacing={2.25} sx={{ pt: 1 }}>
              {duplicateLink ? (
                <Alert
                  action={
                    <Button
                      color="inherit"
                      onClick={() => void copyLink(duplicateLink)}
                      size="small"
                      startIcon={<ContentCopyIcon fontSize="small" />}
                    >
                      Copy
                    </Button>
                  }
                  severity="warning"
                >
                  <Stack spacing={0.5}>
                    <Typography sx={{ fontWeight: 700 }}>
                      This URL has already been shortened.
                    </Typography>
                    <Typography
                      sx={{ overflowWrap: 'anywhere' }}
                      variant="body2"
                    >
                      {getShortUrl(duplicateLink.shortId)}
                    </Typography>
                  </Stack>
                </Alert>
              ) : null}
              <TextField
                autoFocus
                fullWidth
                label="Full URL"
                onChange={(event) => {
                  setDuplicateLink(null);
                  setFullUrl(event.target.value);
                }}
                placeholder="https://example.com/article"
                required
                type="url"
                value={fullUrl}
              />
              <TextField
                fullWidth
                helperText="Optional. Use 3-64 letters, numbers, dashes, or underscores."
                label="Custom short ID"
                onChange={(event) => {
                  setDuplicateLink(null);
                  setShortId(event.target.value);
                }}
                placeholder="launch-notes"
                value={shortId}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={closeCreateDialog}>Cancel</Button>
            <Button disabled={isCreating} type="submit" variant="contained">
              {isCreating ? 'Creating...' : 'Create'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Snackbar
        autoHideDuration={2600}
        onClose={() => setToast(null)}
        open={Boolean(toast)}
        message={toast}
      />
    </Box>
  );
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Routes>
        <Route path="/" element={<RootRedirect />} />
        <Route
          path="/login"
          element={
            <PublicOnlyRoute>
              <AuthLayout mode="login" />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicOnlyRoute>
              <AuthLayout mode="register" />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/my-links"
          element={
            <ProtectedRoute>
              <MyLinksPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </ThemeProvider>
  );
}

export default App;
