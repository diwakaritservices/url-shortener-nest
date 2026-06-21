import LoginIcon from '@mui/icons-material/Login';
import MenuIcon from '@mui/icons-material/Menu';
import {
  AppBar,
  Box,
  Button,
  IconButton,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { ApiReferenceReact } from '@scalar/api-reference-react';
import '@scalar/api-reference-react/style.css';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useAuth } from '../auth-context';
import { AuthenticatedShell } from '../components/AuthenticatedShell';
import { BrandMark } from '../components/BrandMark';
import { getOpenApiSpecUrl } from '../lib/developers';
import { PRODUCT_NAME, PRODUCT_TAGLINE } from '../constants/product';

function DevelopersReference({
  compactSidebar,
  inShell = false,
}: {
  compactSidebar: boolean;
  inShell?: boolean;
}) {
  return (
    <Box
      className={inShell ? 'developers-reference developers-reference--in-shell' : 'developers-reference'}
    >
      <ApiReferenceReact
        configuration={{
          url: getOpenApiSpecUrl(),
          metaData: {
            title: `${PRODUCT_NAME} Integration API`,
            description:
              'Create, list, archive, and restore short links from your integrations.',
          },
          hideModels: true,
          showSidebar: !compactSidebar,
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
  );
}

function PublicDevelopersToolbar() {
  const theme = useTheme();
  const isCompact = useMediaQuery(theme.breakpoints.down('sm'));
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);

  return (
    <AppBar elevation={0} position="sticky" color="inherit">
      <Toolbar className="developers-toolbar">
        <Stack
          className="developers-toolbar-brand"
          direction="row"
          spacing={1.25}
          sx={{ alignItems: 'center' }}
        >
          <BrandMark />
          <Box sx={{ minWidth: 0 }}>
            <Typography noWrap variant="subtitle1" sx={{ fontWeight: 800 }}>
              {PRODUCT_NAME}
            </Typography>
            <Typography noWrap variant="caption" color="text.secondary">
              {PRODUCT_TAGLINE}
            </Typography>
          </Box>
        </Stack>

        {isCompact ? (
          <>
            <IconButton
              aria-label="Open navigation menu"
              edge="end"
              onClick={(event) => setMenuAnchor(event.currentTarget)}
            >
              <MenuIcon />
            </IconButton>
            <Menu
              anchorEl={menuAnchor}
              onClose={() => setMenuAnchor(null)}
              open={Boolean(menuAnchor)}
            >
              <MenuItem
                component={RouterLink}
                onClick={() => setMenuAnchor(null)}
                to="/login"
              >
                Sign in
              </MenuItem>
              <MenuItem
                component={RouterLink}
                onClick={() => setMenuAnchor(null)}
                to="/register"
              >
                Create account
              </MenuItem>
            </Menu>
          </>
        ) : (
          <Stack
            className="developers-toolbar-actions"
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center' }}
          >
            <Button
              component={RouterLink}
              startIcon={<LoginIcon fontSize="small" />}
              to="/login"
              variant="contained"
            >
              Sign in
            </Button>
          </Stack>
        )}
      </Toolbar>
    </AppBar>
  );
}

export function DevelopersPage() {
  const { isAuthenticated } = useAuth();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  if (isAuthenticated) {
    return (
      <AuthenticatedShell variant="docs">
        <DevelopersReference compactSidebar={isMobile} inShell />
      </AuthenticatedShell>
    );
  }

  return (
    <Box className="developers-shell" component="main">
      <PublicDevelopersToolbar />
      <DevelopersReference compactSidebar={isMobile} />
    </Box>
  );
}
