import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import KeyIcon from '@mui/icons-material/Key';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import type { ApiKeySummary, CreateApiKeyResponse } from '@url-shortener/shared';
import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { createApiKey, getApiKeys, revokeApiKey } from '../api';
import { AuthenticatedShell } from '../components/AuthenticatedShell';
import { EmptyState } from '../components/EmptyState';
import { PageHeader } from '../components/PageHeader';
import { useAuth } from '../auth-context';
import { PRODUCT_NAME } from '../constants/product';

function formatTimestamp(value: string | null): string {
  if (!value) {
    return 'Never';
  }

  return new Date(value).toLocaleString();
}

export function ApiKeysPage() {
  const { isAuthenticated } = useAuth();
  const [apiKeys, setApiKeys] = useState<ApiKeySummary[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [keyName, setKeyName] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [createdKey, setCreatedKey] = useState<CreateApiKeyResponse | null>(
    null,
  );
  const [revokeTarget, setRevokeTarget] = useState<ApiKeySummary | null>(null);
  const [isRevoking, setIsRevoking] = useState(false);

  useEffect(() => {
    if (!isAuthenticated) {
      return;
    }

    let mounted = true;

    async function loadApiKeys() {
      setIsLoading(true);
      setError(null);

      try {
        const nextKeys = await getApiKeys();

        if (mounted) {
          setApiKeys(nextKeys);
        }
      } catch (caughtError) {
        if (mounted) {
          setError(
            caughtError instanceof Error
              ? caughtError.message
              : 'Unable to load API keys',
          );
        }
      } finally {
        if (mounted) {
          setIsLoading(false);
        }
      }
    }

    void loadApiKeys();

    return () => {
      mounted = false;
    };
  }, [isAuthenticated]);

  function openCreateDialog() {
    setKeyName('');
    setCreatedKey(null);
    setError(null);
    setCreateDialogOpen(true);
  }

  function closeCreateDialog() {
    setCreateDialogOpen(false);
    setCreatedKey(null);
    setKeyName('');
  }

  async function handleCreateKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setIsCreating(true);
    setError(null);

    try {
      const response = await createApiKey(keyName);
      setCreatedKey(response);
      setApiKeys((currentKeys) => [response, ...currentKeys]);
      setToast('API key created');
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to create API key',
      );
    } finally {
      setIsCreating(false);
    }
  }

  async function copyCreatedKey() {
    if (!createdKey) {
      return;
    }

    await navigator.clipboard.writeText(createdKey.apiKey);
    setToast('API key copied');
  }

  async function handleRevokeKey() {
    if (!revokeTarget) {
      return;
    }

    setIsRevoking(true);
    setError(null);

    try {
      await revokeApiKey(revokeTarget.id);
      setApiKeys((currentKeys) =>
        currentKeys.filter((key) => key.id !== revokeTarget.id),
      );
      setRevokeTarget(null);
      setToast('API key revoked');
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to revoke API key',
      );
    } finally {
      setIsRevoking(false);
    }
  }

  return (
    <AuthenticatedShell>
      <PageHeader
        actions={
          <Button
            onClick={openCreateDialog}
            size="large"
            startIcon={<AddIcon />}
            variant="contained"
          >
            Create API key
          </Button>
        }
        description={`Create keys for third-party integrations. Keys can access the public ${PRODUCT_NAME} API only.`}
        title="API keys"
      />

      <Alert severity="info" sx={{ mb: 2 }}>
        Use these keys with the integration API documented in the{' '}
        <Typography
          component={RouterLink}
          sx={{ fontWeight: 700 }}
          to="/developers"
        >
          developer docs
        </Typography>
        . Send the key as `X-API-Key` or `Authorization: Bearer &lt;key&gt;`.
      </Alert>

      {error ? (
        <Alert severity="error" sx={{ mb: 2 }}>
          {error}
        </Alert>
      ) : null}

      <Paper className="surface-card" elevation={0}>
        {isLoading ? (
          <Box className="state-panel">
            <CircularProgress size={28} />
            <Typography color="text.secondary">Loading API keys...</Typography>
          </Box>
        ) : apiKeys.length === 0 ? (
          <EmptyState
            action={
              <Button
                onClick={openCreateDialog}
                startIcon={<AddIcon />}
                variant="contained"
              >
                Create API key
              </Button>
            }
            description={`Create a key to connect external systems to ${PRODUCT_NAME}.`}
            icon={<KeyIcon />}
            title="No API keys yet"
          />
        ) : (
          <TableContainer>
              <Table>
                <TableHead>
                  <TableRow>
                    <TableCell>Name</TableCell>
                    <TableCell>Key prefix</TableCell>
                    <TableCell>Created</TableCell>
                    <TableCell>Last used</TableCell>
                    <TableCell align="right">Actions</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {apiKeys.map((apiKey) => (
                    <TableRow key={apiKey.id} hover>
                      <TableCell>
                        <Typography sx={{ fontWeight: 700 }}>
                          {apiKey.name}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography
                          component="code"
                          sx={{ fontFamily: 'monospace' }}
                        >
                          {apiKey.keyPrefix}...
                        </Typography>
                      </TableCell>
                      <TableCell>{formatTimestamp(apiKey.createdAt)}</TableCell>
                      <TableCell>{formatTimestamp(apiKey.lastUsedAt)}</TableCell>
                      <TableCell align="right">
                        <IconButton
                          aria-label={`Revoke ${apiKey.name}`}
                          onClick={() => setRevokeTarget(apiKey)}
                        >
                          <DeleteIcon fontSize="small" />
                        </IconButton>
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
        open={createDialogOpen}
      >
        {createdKey ? (
          <>
            <DialogTitle>Save your API key</DialogTitle>
            <DialogContent>
              <Stack spacing={2.25} sx={{ pt: 1 }}>
                <Alert severity="warning">
                  This is the only time the full key will be shown. Copy it now
                  and store it securely.
                </Alert>
                <TextField
                  fullWidth
                  label="API key"
                  slotProps={{ htmlInput: { readOnly: true } }}
                  value={createdKey.apiKey}
                />
              </Stack>
            </DialogContent>
            <DialogActions>
              <Button
                onClick={() => void copyCreatedKey()}
                startIcon={<ContentCopyIcon fontSize="small" />}
              >
                Copy key
              </Button>
              <Button onClick={closeCreateDialog} variant="contained">
                Done
              </Button>
            </DialogActions>
          </>
        ) : (
          <Box component="form" onSubmit={handleCreateKey}>
            <DialogTitle>Create an API key</DialogTitle>
            <DialogContent>
              <Stack spacing={2.25} sx={{ pt: 1 }}>
                <TextField
                  autoFocus
                  fullWidth
                  helperText="Optional label to help you identify this key later."
                  label="Key name"
                  onChange={(event) => setKeyName(event.target.value)}
                  placeholder="Production integration"
                  value={keyName}
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
        )}
      </Dialog>

      <Dialog
        fullWidth
        maxWidth="xs"
        onClose={() => setRevokeTarget(null)}
        open={Boolean(revokeTarget)}
      >
        <DialogTitle>Revoke API key?</DialogTitle>
        <DialogContent>
          <Typography color="text.secondary">
            {revokeTarget
              ? `Integrations using "${revokeTarget.name}" (${revokeTarget.keyPrefix}...) will stop working immediately.`
              : null}
          </Typography>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRevokeTarget(null)}>Cancel</Button>
          <Button
            color="error"
            disabled={isRevoking}
            onClick={() => void handleRevokeKey()}
            variant="contained"
          >
            {isRevoking ? 'Revoking...' : 'Revoke key'}
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
