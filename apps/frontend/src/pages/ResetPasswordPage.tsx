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
import { Link as RouterLink, useNavigate, useSearchParams } from 'react-router-dom';
import { resetPassword } from '../api';
import { BrandMark } from '../components/BrandMark';
import { TurnstileWidget } from '../components/TurnstileWidget';
import { PRODUCT_NAME } from '../constants/product';

export function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState(searchParams.get('email') ?? '');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [turnstileResetKey, setTurnstileResetKey] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await resetPassword(email, otp, newPassword, turnstileToken ?? '');
      navigate('/login', {
        replace: true,
        state: { passwordReset: true },
      });
    } catch (caughtError) {
      setTurnstileToken(null);
      setTurnstileResetKey((currentKey) => currentKey + 1);
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'Unable to reset password',
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
                Reset password
              </Typography>
              <Typography color="text.secondary">
                Enter the 6-digit code from your email and choose a new
                password.
              </Typography>
            </Stack>

            {error ? <Alert severity="error">{error}</Alert> : null}

            <Box component="form" onSubmit={handleSubmit}>
              <Stack spacing={2.25}>
                <TextField
                  autoComplete="email"
                  fullWidth
                  label="Email"
                  onChange={(event) => setEmail(event.target.value)}
                  required
                  type="email"
                  value={email}
                />
                <TextField
                  autoComplete="one-time-code"
                  autoFocus={Boolean(email)}
                  fullWidth
                  label="Reset code"
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
                <TextField
                  autoComplete="new-password"
                  fullWidth
                  helperText="Use at least 15 characters."
                  label="New password"
                  onChange={(event) => setNewPassword(event.target.value)}
                  required
                  slotProps={{ htmlInput: { minLength: 15 } }}
                  type="password"
                  value={newPassword}
                />
                <TurnstileWidget
                  key={turnstileResetKey}
                  onTokenChange={setTurnstileToken}
                />
                <Button
                  disabled={
                    isSubmitting ||
                    !turnstileToken ||
                    otp.length !== 6 ||
                    newPassword.length < 15
                  }
                  fullWidth
                  size="large"
                  type="submit"
                  variant="contained"
                >
                  {isSubmitting ? 'Resetting...' : 'Reset password'}
                </Button>
              </Stack>
            </Box>

            <Typography color="text.secondary" sx={{ textAlign: 'center' }}>
              Need a new code?{' '}
              <Button component={RouterLink} size="small" to="/forgot-password">
                Request again
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
