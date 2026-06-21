import AddIcon from '@mui/icons-material/Add';
import ArchiveIcon from '@mui/icons-material/Archive';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import LinkIcon from '@mui/icons-material/Link';
import UnarchiveIcon from '@mui/icons-material/Unarchive';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
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
  Typography,
} from '@mui/material';
import { useEffect, useMemo, useRef, useState, lazy, Suspense } from 'react';
import type { FormEvent, ReactElement } from 'react';
import {
  Link as RouterLink,
  Navigate,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useSearchParams,
} from 'react-router-dom';
import {
  archiveLink,
  ApiError,
  createLink,
  getLinks,
  getShortUrl,
  login,
  register,
  resendVerificationEmail,
  unarchiveLink,
  verifyEmail,
  verifyMfaLogin,
} from './api';
import type { ShortLink } from './api';
import { saveUser } from './auth';
import { useAuth } from './auth-context';
import { AuthenticatedShell } from './components/AuthenticatedShell';
import { BrandMark } from './components/BrandMark';
import { EmptyState } from './components/EmptyState';
import { PageHeader } from './components/PageHeader';
import { TurnstileWidget } from './components/TurnstileWidget';
import { ApiKeysPage } from './pages/ApiKeysPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ProfilePage } from './pages/ProfilePage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { theme } from './theme';
import { PRODUCT_NAME } from './constants/product';
import {
  buildUrlWithPendingParam,
  clearPendingUrl,
  normalizePendingUrl,
  PENDING_URL_QUERY_PARAM,
} from './lib/pending-url';
import './App.css';

const DevelopersPage = lazy(() =>
  import('./pages/DevelopersPage').then((module) => ({
    default: module.DevelopersPage,
  })),
);

function ProtectedRoute({ children }: { children: ReactElement }) {
  const location = useLocation();
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <Box className="state-panel" sx={{ minHeight: '100svh' }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to={{ pathname: '/login', search: location.search }}
        replace
        state={{ from: location }}
      />
    );
  }

  if (user && !user.emailVerified) {
    return <Navigate to="/verify-email" replace state={{ from: location }} />;
  }

  return children;
}

function VerifyEmailRoute({ children }: { children: ReactElement }) {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <Box className="state-panel" sx={{ minHeight: '100svh' }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user?.emailVerified) {
    return <Navigate to="/my-links" replace />;
  }

  return children;
}

function PublicOnlyRoute({ children }: { children: ReactElement }) {
  const location = useLocation();
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <Box className="state-panel" sx={{ minHeight: '100svh' }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (isAuthenticated) {
    if (user && !user.emailVerified) {
      return <Navigate to="/verify-email" replace />;
    }

    return (
      <Navigate
        to={{ pathname: '/my-links', search: location.search }}
        replace
      />
    );
  }

  return children;
}

function RootRedirect() {
  const { isAuthenticated, isLoading, user } = useAuth();

  if (isLoading) {
    return (
      <Box className="state-panel" sx={{ minHeight: '100svh' }}>
        <CircularProgress size={28} />
      </Box>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (user && !user.emailVerified) {
    return <Navigate to="/verify-email" replace />;
  }

  return <Navigate to="/my-links" replace />;
}

function AuthLayout({ mode }: { mode: 'login' | 'register' }) {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { setUser } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mfaToken, setMfaToken] = useState<string | null>(null);
  const [mfaCode, setMfaCode] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const isLogin = mode === 'login';
  const pendingUrl = normalizePendingUrl(searchParams.get(PENDING_URL_QUERY_PARAM) ?? '');
  const passwordResetSuccess = Boolean(
    (location.state as { passwordReset?: boolean } | null)?.passwordReset,
  );

  function completeSignIn(user: NonNullable<Awaited<ReturnType<typeof login>>['user']>) {
    saveUser(user);
    setUser(user);

    if (!user.emailVerified) {
      navigate('/verify-email', { replace: true });
      return;
    }

    navigate(
      pendingUrl
        ? buildUrlWithPendingParam('/my-links', pendingUrl)
        : '/my-links',
      { replace: true },
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const auth = isLogin
        ? await login(email, password, turnstileToken ?? '')
        : await register(email, password, turnstileToken ?? '');

      if (auth.mfaRequired && auth.mfaToken) {
        setMfaToken(auth.mfaToken);
        return;
      }

      if (!auth.user) {
        throw new Error('Unable to complete sign in');
      }

      completeSignIn(auth.user);
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

  async function handleMfaSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!mfaToken) {
      return;
    }

    setError(null);
    setIsSubmitting(true);

    try {
      const auth = await verifyMfaLogin(mfaToken, mfaCode);

      if (!auth.user) {
        throw new Error('Unable to complete sign in');
      }

      completeSignIn(auth.user);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to verify authentication code',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Box className="auth-shell" component="main">
      <Box className="auth-showcase">
        <Stack spacing={2.5} sx={{ maxWidth: 480 }}>
          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
            <BrandMark />
            <Typography sx={{ fontWeight: 800, letterSpacing: '0.06em' }}>
              {PRODUCT_NAME}
            </Typography>
          </Stack>
          <Box>
            <Typography
              component="p"
              sx={{ fontWeight: 800, fontSize: '2.5rem', lineHeight: 1.15 }}
            >
              Short links you can actually manage
            </Typography>
            <Typography sx={{ mt: 1.5, color: 'rgba(255,255,255,0.82)' }}>
              Create memorable links, track what you have shared, and connect
              external systems with API keys — all from one workspace.
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Box className="auth-panel-wrap">
        <Paper className="auth-panel" elevation={0}>
          <Stack spacing={3}>
            <Stack spacing={1}>
              <Typography component="h1" variant="h4">
                {isLogin ? 'Welcome back' : 'Create your account'}
              </Typography>
              <Typography color="text.secondary">
                {isLogin
                  ? 'Sign in to manage your links and API keys.'
                  : 'Get started with memorable short links under your account.'}
              </Typography>
            </Stack>

            {passwordResetSuccess ? (
              <Alert severity="success">
                Your password was reset. Sign in with your new password.
              </Alert>
            ) : null}

            {error ? <Alert severity="error">{error}</Alert> : null}

            {pendingUrl ? (
              <Alert severity="info">
                Please sign in or register to continue
              </Alert>
            ) : null}

            {mfaToken ? (
              <Box component="form" onSubmit={handleMfaSubmit}>
                <Stack spacing={2.25}>
                  <Typography color="text.secondary">
                    Enter the 6-digit code from your authenticator app.
                  </Typography>
                  <TextField
                    autoComplete="one-time-code"
                    autoFocus
                    fullWidth
                    label="Authentication code"
                    onChange={(event) => setMfaCode(event.target.value.trim())}
                    placeholder="123456"
                    required
                    slotProps={{
                      htmlInput: {
                        inputMode: 'numeric',
                        pattern: '[0-9]*',
                        maxLength: 6,
                      },
                    }}
                    value={mfaCode}
                  />
                  <Button
                    disabled={isSubmitting || mfaCode.length !== 6}
                    fullWidth
                    size="large"
                    type="submit"
                    variant="contained"
                  >
                    {isSubmitting ? 'Verifying...' : 'Verify and sign in'}
                  </Button>
                  <Button
                    fullWidth
                    onClick={() => {
                      setMfaToken(null);
                      setMfaCode('');
                      setError(null);
                    }}
                  >
                    Back to sign in
                  </Button>
                </Stack>
              </Box>
            ) : (
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
                  helperText="Use at least 15 characters."
                  label="Password"
                  slotProps={{ htmlInput: { minLength: 15 } }}
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
                  {isSubmitting ? 'Working...' : isLogin ? 'Sign in' : 'Create account'}
                </Button>
              </Stack>
            </Box>
            )}

            {isLogin && !mfaToken ? (
              <Typography color="text.secondary" sx={{ textAlign: 'center' }}>
                <Button component={RouterLink} size="small" to="/forgot-password">
                  Forgot password?
                </Button>
              </Typography>
            ) : null}

            {!mfaToken ? (
            <Typography color="text.secondary" sx={{ textAlign: 'center' }}>
              {isLogin ? 'No account yet?' : 'Already registered?'}{' '}
              <Button
                component={RouterLink}
                size="small"
                to={{
                  pathname: isLogin ? '/register' : '/login',
                  search: location.search,
                }}
              >
                {isLogin ? 'Create one' : 'Sign in'}
              </Button>
            </Typography>
            ) : null}

            {!mfaToken ? (
            <Typography color="text.secondary" sx={{ textAlign: 'center' }}>
              Building an integration?{' '}
              <Button component={RouterLink} size="small" to="/developers">
                View API docs
              </Button>
            </Typography>
            ) : null}

            {!mfaToken ? (
            <Typography color="text.secondary" sx={{ textAlign: 'center' }}>
              <Button component="a" href="/privacy" size="small">
                Privacy
              </Button>
              {' · '}
              <Button component="a" href="/terms" size="small">
                Terms
              </Button>
            </Typography>
            ) : null}
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}

function VerifyEmailPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, setUser } = useAuth();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendCooldownSeconds, setResendCooldownSeconds] = useState(0);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (resendCooldownSeconds <= 0) {
      return;
    }

    const timer = window.setTimeout(() => {
      setResendCooldownSeconds((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => {
      window.clearTimeout(timer);
    };
  }, [resendCooldownSeconds]);

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError(null);
    setIsSubmitting(true);

    try {
      const verifiedUser = await verifyEmail(otp);
      saveUser(verifiedUser);
      setUser(verifiedUser);
      setToast('Email verified');

      const pendingUrl = normalizePendingUrl(
        new URLSearchParams(location.search).get(PENDING_URL_QUERY_PARAM) ?? '',
      );

      navigate(
        pendingUrl
          ? buildUrlWithPendingParam('/my-links', pendingUrl)
          : '/my-links',
        { replace: true },
      );
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to verify email',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleResend() {
    if (resendCooldownSeconds > 0) {
      return;
    }

    setError(null);
    setIsResending(true);

    try {
      await resendVerificationEmail();
      setToast('Verification code sent');
      setResendCooldownSeconds(60);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to resend verification code',
      );
    } finally {
      setIsResending(false);
    }
  }

  return (
    <Box className="auth-shell" component="main">
      <Box className="auth-showcase">
        <Stack spacing={2.5} sx={{ maxWidth: 480 }}>
          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
            <BrandMark />
            <Typography sx={{ fontWeight: 800, letterSpacing: '0.06em' }}>
              {PRODUCT_NAME}
            </Typography>
          </Stack>
          <Box>
            <Typography
              component="p"
              sx={{ fontWeight: 800, fontSize: '2.5rem', lineHeight: 1.15 }}
            >
              Verify your email
            </Typography>
            <Typography sx={{ mt: 1.5, color: 'rgba(255,255,255,0.82)' }}>
              Enter the 6-digit code we sent to your inbox to finish setting up
              your account.
            </Typography>
          </Box>
        </Stack>
      </Box>

      <Box className="auth-panel-wrap">
        <Paper className="auth-panel" elevation={0}>
          <Stack spacing={3}>
            <Stack spacing={1}>
              <Typography component="h1" variant="h4">
                Check your email
              </Typography>
              <Typography color="text.secondary">
                {user?.email
                  ? `We sent a verification code to ${user.email}.`
                  : 'We sent a verification code to your email address.'}
              </Typography>
            </Stack>

            {error ? <Alert severity="error">{error}</Alert> : null}

            <Box component="form" onSubmit={handleVerify}>
              <Stack spacing={2.25}>
                <TextField
                  autoComplete="one-time-code"
                  autoFocus
                  fullWidth
                  label="Verification code"
                  onChange={(event) => setOtp(event.target.value.trim())}
                  placeholder="123456"
                  required
                  slotProps={{
                    htmlInput: {
                      inputMode: 'numeric',
                      pattern: '[0-9]*',
                      maxLength: 6,
                    },
                  }}
                  value={otp}
                />
                <Button
                  disabled={isSubmitting || otp.length !== 6}
                  fullWidth
                  size="large"
                  type="submit"
                  variant="contained"
                >
                  {isSubmitting ? 'Verifying...' : 'Verify email'}
                </Button>
              </Stack>
            </Box>

            <Typography color="text.secondary" sx={{ textAlign: 'center' }}>
              Didn&apos;t get a code?{' '}
              <Button
                disabled={isResending || resendCooldownSeconds > 0}
                onClick={() => void handleResend()}
                size="small"
              >
                {resendCooldownSeconds > 0
                  ? `Resend in ${resendCooldownSeconds}s`
                  : isResending
                    ? 'Sending...'
                    : 'Resend code'}
              </Button>
            </Typography>
          </Stack>
        </Paper>
      </Box>

      <Snackbar
        autoHideDuration={2600}
        message={toast}
        onClose={() => setToast(null)}
        open={Boolean(toast)}
      />
    </Box>
  );
}

function MyLinksPage() {
  const { isAuthenticated } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const pendingQueryUrl = searchParams.get(PENDING_URL_QUERY_PARAM);
  const consumedPendingRef = useRef<string | null>(null);
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
    if (!isAuthenticated) {
      return;
    }

    let mounted = true;

    async function loadLinks() {
      setIsLoading(true);
      setError(null);

      try {
        const nextLinks = await getLinks(isArchivedView);

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
  }, [isArchivedView, isAuthenticated]);

  useEffect(() => {
    if (!isAuthenticated || !pendingQueryUrl) {
      return;
    }

    if (consumedPendingRef.current === pendingQueryUrl) {
      return;
    }

    consumedPendingRef.current = pendingQueryUrl;
    clearPendingUrl();
    setSearchParams({}, { replace: true });

    const pendingUrl = normalizePendingUrl(pendingQueryUrl);

    if (!pendingUrl) {
      return;
    }

    setDuplicateLink(null);
    setError(null);
    setFullUrl(pendingUrl);
    setDialogOpen(true);
  }, [pendingQueryUrl, setSearchParams, isAuthenticated]);

  const linkCountLabel = useMemo(() => {
    if (links.length === 1) {
      return isArchivedView ? '1 archived link' : '1 active link';
    }

    return isArchivedView
      ? `${links.length} archived links`
      : `${links.length} active links`;
  }, [isArchivedView, links.length]);

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

    setIsCreating(true);
    setError(null);
    setDuplicateLink(null);

    try {
      const createdLink = await createLink(fullUrl, shortId);
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
    setError(null);

    try {
      await archiveLink(link.shortId);
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
    setError(null);

    try {
      await unarchiveLink(link.shortId);
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
    <AuthenticatedShell>
      <PageHeader
        actions={
          <>
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
          </>
        }
        description={linkCountLabel}
        title="My links"
      />

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      <Paper className="surface-card" elevation={0}>
        {isLoading ? (
          <Box className="state-panel">
            <CircularProgress size={28} />
            <Typography color="text.secondary">Loading links...</Typography>
          </Box>
        ) : links.length === 0 ? (
          <EmptyState
            action={
              !isArchivedView ? (
                <Button
                  onClick={openCreateDialog}
                  startIcon={<AddIcon />}
                  variant="contained"
                >
                  Create link
                </Button>
              ) : undefined
            }
            description={
              isArchivedView
                ? 'Archived links will appear here when you move them out of active use.'
                : 'Create your first short link to see it listed here.'
            }
            icon={<LinkIcon />}
            title={
              isArchivedView ? 'No archived links' : 'No shortened links yet'
            }
          />
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
                      <Typography className="link-short-url">
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
    </AuthenticatedShell>
  );
}

function NotFoundPage() {
  const { isAuthenticated } = useAuth();

  return (
    <Box className="auth-shell" component="main">
      <Box className="auth-panel-wrap" sx={{ gridColumn: '1 / -1' }}>
        <Paper className="auth-panel" elevation={0}>
          <Stack spacing={3} sx={{ alignItems: 'center', textAlign: 'center' }}>
            <BrandMark />
            <Typography variant="overline" color="text.secondary">
              {PRODUCT_NAME}
            </Typography>
            <Typography component="h1" variant="h4">
              Link not found
            </Typography>
            <Typography color="text.secondary">
              This short link does not exist, has been removed, or is no longer
              active.
            </Typography>
            <Button
              component={RouterLink}
              to={isAuthenticated ? '/my-links' : '/login'}
              variant="contained"
            >
              {isAuthenticated ? 'Back to my links' : 'Go to login'}
            </Button>
          </Stack>
        </Paper>
      </Box>
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
          path="/forgot-password"
          element={
            <PublicOnlyRoute>
              <ForgotPasswordPage />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/reset-password"
          element={
            <PublicOnlyRoute>
              <ResetPasswordPage />
            </PublicOnlyRoute>
          }
        />
        <Route
          path="/verify-email"
          element={
            <VerifyEmailRoute>
              <VerifyEmailPage />
            </VerifyEmailRoute>
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
        <Route
          path="/api-keys"
          element={
            <ProtectedRoute>
              <ApiKeysPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/developers"
          element={
            <Suspense
              fallback={
                <Box className="state-panel" sx={{ minHeight: '100svh' }}>
                  <CircularProgress size={28} />
                  <Typography color="text.secondary">
                    Loading developer docs...
                  </Typography>
                </Box>
              }
            >
              <DevelopersPage />
            </Suspense>
          }
        />
        <Route path="/not-found" element={<NotFoundPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </ThemeProvider>
  );
}

export default App;
