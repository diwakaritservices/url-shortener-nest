import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { forgotPassword } from '../api';
import { BrandMark } from '../components/BrandMark';
import { TurnstileWidget } from '../components/TurnstileWidget';
import { PRODUCT_NAME } from '../constants/product';

export function ForgotPasswordPage() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await forgotPassword(email, turnstileToken ?? '');
      navigate(`/reset-password?email=${encodeURIComponent(email)}`, {
        replace: true,
      });
    } catch (caughtError) {
      setTurnstileToken(null);
      setTurnstileResetKey((currentKey) => currentKey + 1);
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to send reset code',
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Box className="auth-shell" component="main">
      <Box className="auth-panel-wrap" sx={{ gridColumn: '1 / -1' }}>
        <Paper className="auth-panel" elevation={0}>
          <Stack spacing={3}>
            <Stack spacing={1} sx={{ alignItems: 'center', textAlign: 'center' }}>
              <BrandMark />
              <Typography component="h1" variant="h4">
                Forgot password
              </Typography>
              <Typography color="text.secondary">
                Enter your account email and we will send a reset code if an
                account exists.
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
                  {isSubmitting ? 'Sending...' : 'Send reset code'}
                </Button>
              </Stack>
            </Box>

            <Typography color="text.secondary" sx={{ textAlign: 'center' }}>
              Remembered your password?{' '}
              <Button component={RouterLink} size="small" to="/login">
                Back to sign in
              </Button>
            </Typography>
            <Typography color="text.secondary" sx={{ textAlign: 'center' }}>
              {PRODUCT_NAME}
            </Typography>
          </Stack>
        </Paper>
      </Box>
    </Box>
  );
}
