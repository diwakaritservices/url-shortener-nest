import KeyIcon from '@mui/icons-material/Key';
import LinkIcon from '@mui/icons-material/Link';
import LoginIcon from '@mui/icons-material/Login';
import {
  AppBar,
  Box,
  Button,
  Stack,
  Toolbar,
  Typography,
} from '@mui/material';
import { ApiReferenceReact } from '@scalar/api-reference-react';
import '@scalar/api-reference-react/style.css';
import { Link as RouterLink } from 'react-router-dom';
import { getToken } from '../auth';
import { getOpenApiSpecUrl } from '../lib/developers';
import { PRODUCT_NAME, PRODUCT_TAGLINE } from '../constants/product';

export function DevelopersPage() {
  const isAuthenticated = Boolean(getToken());

  return (
    <Box className="developers-shell">
      <AppBar elevation={0} position="sticky" color="inherit">
        <Toolbar className="developers-toolbar">
          <Stack direction="row" spacing={1.25} sx={{ alignItems: 'center' }}>
            <Box className="brand-mark">
              <LinkIcon fontSize="small" />
            </Box>
            <Box>
              <Typography variant="subtitle1" sx={{ fontWeight: 800 }}>
                {PRODUCT_NAME}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                {PRODUCT_TAGLINE}
              </Typography>
            </Box>
          </Stack>

          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            {isAuthenticated ? (
              <>
                <Button
                  component={RouterLink}
                  startIcon={<LinkIcon fontSize="small" />}
                  to="/my-links"
                >
                  My links
                </Button>
                <Button
                  component={RouterLink}
                  startIcon={<KeyIcon fontSize="small" />}
                  to="/api-keys"
                  variant="contained"
                >
                  API keys
                </Button>
              </>
            ) : (
              <Button
                component={RouterLink}
                startIcon={<LoginIcon fontSize="small" />}
                to="/login"
                variant="contained"
              >
                Sign in
              </Button>
            )}
          </Stack>
        </Toolbar>
      </AppBar>

      <Box className="developers-reference">
        <ApiReferenceReact
          configuration={{
            url: getOpenApiSpecUrl(),
            metaData: {
              title: 'Linkable Integration API',
              description:
                'Create, list, archive, and restore short links from your integrations.',
            },
            hideModels: true,
            showSidebar: true,
            theme: 'default',
            customCss: `
              .light-mode {
                --scalar-background-1: #f6f8fb;
                --scalar-background-2: #ffffff;
                --scalar-background-3: #eef2f7;
                --scalar-border-color: #dce3ec;
                --scalar-color-accent: #1769aa;
              }
            `,
          }}
        />
      </Box>
    </Box>
  );
}
