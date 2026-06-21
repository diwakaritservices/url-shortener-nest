import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Paper,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  beginMfaSetup,
  changePassword,
  deleteAccount,
  disableMfa,
  enableMfa,
  exportAccountData,
  getProfile,
  updateProfile,
} from '../api';
import { AuthenticatedShell } from '../components/AuthenticatedShell';
import { PageHeader } from '../components/PageHeader';
import { saveUser } from '../auth';
import { useAuth } from '../auth-context';
import { PRODUCT_NAME } from '../constants/product';

export function ProfilePage() {
  const navigate = useNavigate();
  const { user, setUser, logout } = useAuth();
  const [name, setName] = useState(user?.name ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [mfaSetup, setMfaSetup] = useState<{
    secret: string;
    otpauthUrl: string;
  } | null>(null);
  const [mfaEnableCode, setMfaEnableCode] = useState('');
  const [disablePassword, setDisablePassword] = useState('');
  const [disableMfaCode, setDisableMfaCode] = useState('');
  const [isSettingUpMfa, setIsSettingUpMfa] = useState(false);
  const [isEnablingMfa, setIsEnablingMfa] = useState(false);
  const [isDisablingMfa, setIsDisablingMfa] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function loadProfile() {
      setIsLoading(true);
      setError(null);

      try {
        const profile = await getProfile();

        if (mounted) {
          setName(profile.name ?? '');
          setEmail(profile.email);
          saveUser(profile);
          setUser(profile);
        }
      } catch (caughtError) {
        if (mounted) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : 'Unable to load profile',
          );
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void loadProfile();

    return () => {
      mounted = false;
    };
  }, [setUser]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsSaving(true);
    setError(null);

    try {
      const profile = await updateProfile(name);
      setName(profile.name ?? '');
      setEmail(profile.email);
      saveUser(profile);
      setUser(profile);
      setToast('Profile updated');
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to update profile',
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsChangingPassword(true);
    setError(null);

    try {
      await changePassword(currentPassword, newPassword);
      setCurrentPassword('');
      setNewPassword('');
      setToast('Password updated');
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to change password',
      );
    } finally {
      setIsChangingPassword(false);
    }
  }

  async function handleExport() {
    setIsExporting(true);
    setError(null);

    try {
      const exportData = await exportAccountData();
      const blob = new Blob([JSON.stringify(exportData, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = `${PRODUCT_NAME.toLowerCase()}-account-export.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setToast('Account data exported');
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to export account data',
      );
    } finally {
      setIsExporting(false);
    }
  }

  async function handleBeginMfaSetup() {
    setIsSettingUpMfa(true);
    setError(null);

    try {
      const setup = await beginMfaSetup();
      setMfaSetup(setup);
      setMfaEnableCode('');
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to start MFA setup',
      );
    } finally {
      setIsSettingUpMfa(false);
    }
  }

  async function handleEnableMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsEnablingMfa(true);
    setError(null);

    try {
      const profile = await enableMfa(mfaEnableCode);
      saveUser(profile);
      setUser(profile);
      setMfaSetup(null);
      setMfaEnableCode('');
      setToast('Multi-factor authentication enabled');
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to enable MFA',
      );
    } finally {
      setIsEnablingMfa(false);
    }
  }

  async function handleDisableMfa(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsDisablingMfa(true);
    setError(null);

    try {
      const profile = await disableMfa(disablePassword, disableMfaCode);
      saveUser(profile);
      setUser(profile);
      setDisablePassword('');
      setDisableMfaCode('');
      setToast('Multi-factor authentication disabled');
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to disable MFA',
      );
    } finally {
      setIsDisablingMfa(false);
    }
  }

  async function handleDeleteAccount() {
    setIsDeleting(true);
    setError(null);

    try {
      await deleteAccount();
      await logout();
      navigate('/login', { replace: true });
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to delete account',
      );
      setIsDeleting(false);
      setDeleteDialogOpen(false);
    }
  }

  return (
    <AuthenticatedShell>
      <PageHeader
        description={`Update how your name appears in ${PRODUCT_NAME}. Your email address cannot be changed.`}
        title="Profile"
      />

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      <Paper className="surface-card profile-panel" elevation={0}>
        {isLoading ? (
          <Box className="state-panel">
            <CircularProgress size={28} />
            <Typography color="text.secondary">Loading profile...</Typography>
          </Box>
        ) : (
          <Stack spacing={4}>
            <Box component="form" onSubmit={handleSubmit}>
              <Stack spacing={2.5}>
                <Typography component="h2" variant="h6">
                  Profile details
                </Typography>
                <TextField
                  autoFocus
                  fullWidth
                  helperText="This name is shown in your workspace sidebar."
                  label="Name"
                  onChange={(event) => setName(event.target.value)}
                  required
                  value={name}
                />
                <TextField
                  fullWidth
                  helperText="Email is tied to your account and cannot be edited here."
                  label="Email"
                  slotProps={{ htmlInput: { readOnly: true } }}
                  value={email}
                />
                <Box>
                  <Button disabled={isSaving} type="submit" variant="contained">
                    {isSaving ? 'Saving...' : 'Save changes'}
                  </Button>
                </Box>
              </Stack>
            </Box>

            <Box component="form" onSubmit={handlePasswordChange}>
              <Stack spacing={2.5}>
                <Typography component="h2" variant="h6">
                  Change password
                </Typography>
                <TextField
                  autoComplete="current-password"
                  fullWidth
                  label="Current password"
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  required
                  type="password"
                  value={currentPassword}
                />
                <TextField
                  autoComplete="new-password"
                  fullWidth
                  helperText="Use at least 15 characters."
                  label="New password"
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                  type="password"
                  value={newPassword}
                />
                <Box>
                  <Button
                    disabled={isChangingPassword}
                    type="submit"
                    variant="contained"
                  >
                    {isChangingPassword ? 'Updating...' : 'Update password'}
                  </Button>
                </Box>
              </Stack>
            </Box>

            <Stack spacing={2.5}>
              <Typography component="h2" variant="h6">
                Multi-factor authentication
              </Typography>
              <Typography color="text.secondary" variant="body2">
                {user?.mfaEnabled
                  ? 'Your account requires an authenticator app code when signing in.'
                  : 'Add a 6-digit authenticator app code for an extra layer of protection.'}
              </Typography>

              {user?.mfaEnabled ? (
                <Box component="form" onSubmit={handleDisableMfa}>
                  <Stack spacing={2}>
                    <TextField
                      autoComplete="current-password"
                      fullWidth
                      label="Current password"
                      onChange={(event) => setDisablePassword(event.target.value)}
                      required
                      type="password"
                      value={disablePassword}
                    />
                    <TextField
                      fullWidth
                      label="Authenticator code"
                      onChange={(event) =>
                        setDisableMfaCode(event.target.value.trim())
                      }
                      required
                      slotProps={{
                        htmlInput: {
                          inputMode: 'numeric',
                          pattern: '[0-9]*',
                          maxLength: 6,
                        },
                      }}
                      value={disableMfaCode}
                    />
                    <Box>
                      <Button
                        color="warning"
                        disabled={isDisablingMfa}
                        type="submit"
                        variant="outlined"
                      >
                        {isDisablingMfa ? 'Disabling...' : 'Disable MFA'}
                      </Button>
                    </Box>
                  </Stack>
                </Box>
              ) : mfaSetup ? (
                <Box component="form" onSubmit={handleEnableMfa}>
                  <Stack spacing={2}>
                    <Alert severity="info">
                      Add this account to Google Authenticator, 1Password, or
                      another TOTP app using the secret below or the setup link.
                    </Alert>
                    <TextField
                      fullWidth
                      label="Setup secret"
                      slotProps={{ htmlInput: { readOnly: true } }}
                      value={mfaSetup.secret}
                    />
                    <Button
                      component="a"
                      href={mfaSetup.otpauthUrl}
                      rel="noreferrer"
                      target="_blank"
                      variant="outlined"
                    >
                      Open in authenticator app
                    </Button>
                    <TextField
                      autoFocus
                      fullWidth
                      label="Verification code"
                      onChange={(event) =>
                        setMfaEnableCode(event.target.value.trim())
                      }
                      required
                      slotProps={{
                        htmlInput: {
                          inputMode: 'numeric',
                          pattern: '[0-9]*',
                          maxLength: 6,
                        },
                      }}
                      value={mfaEnableCode}
                    />
                    <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                      <Button
                        disabled={isEnablingMfa || mfaEnableCode.length !== 6}
                        type="submit"
                        variant="contained"
                      >
                        {isEnablingMfa ? 'Enabling...' : 'Enable MFA'}
                      </Button>
                      <Button
                        onClick={() => {
                          setMfaSetup(null);
                          setMfaEnableCode('');
                        }}
                      >
                        Cancel
                      </Button>
                    </Stack>
                  </Stack>
                </Box>
              ) : (
                <Button
                  disabled={isSettingUpMfa}
                  onClick={handleBeginMfaSetup}
                  variant="outlined"
                >
                  {isSettingUpMfa ? 'Preparing...' : 'Set up authenticator app'}
                </Button>
              )}
            </Stack>

            <Stack spacing={1.5}>
              <Typography component="h2" variant="h6">
                Data and account
              </Typography>
              <Typography color="text.secondary" variant="body2">
                Export your profile and links, or permanently delete your account
                and associated data.
              </Typography>
              <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
                <Button disabled={isExporting} onClick={handleExport} variant="outlined">
                  {isExporting ? 'Exporting...' : 'Export my data'}
                </Button>
                <Button
                  color="error"
                  disabled={isDeleting}
                  onClick={() => setDeleteDialogOpen(true)}
                  variant="outlined"
                >
                  Delete account
                </Button>
              </Stack>
            </Stack>
          </Stack>
        )}
      </Paper>

      <Dialog onClose={() => setDeleteDialogOpen(false)} open={deleteDialogOpen}>
        <DialogTitle>Delete your account?</DialogTitle>
        <DialogContent>
          <DialogContentText>
            This permanently removes your account, links, and API keys. This
            action cannot be undone.
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button color="error" disabled={isDeleting} onClick={handleDeleteAccount}>
            {isDeleting ? 'Deleting...' : 'Delete account'}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        autoHideDuration={2600}
        message={toast}
        onClose={() => setToast(null)}
        open={Boolean(toast)}
      />
    </AuthenticatedShell>
  );
}
