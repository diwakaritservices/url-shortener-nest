import CodeIcon from '@mui/icons-material/Code';
import KeyIcon from '@mui/icons-material/Key';
import LinkIcon from '@mui/icons-material/Link';
import LogoutIcon from '@mui/icons-material/Logout';
import MenuIcon from '@mui/icons-material/Menu';
import PersonIcon from '@mui/icons-material/Person';
import {
  BottomNavigation,
  BottomNavigationAction,
  Box,
  Button,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { Link as RouterLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth-context';
import { BrandMark } from './BrandMark';
import { PRODUCT_NAME, PRODUCT_TAGLINE } from '../constants/product';

const NAV_ITEMS = [
  { label: 'Links', path: '/my-links', icon: LinkIcon },
  { label: 'API keys', path: '/api-keys', icon: KeyIcon },
  { label: 'Developers', path: '/developers', icon: CodeIcon },
  { label: 'Profile', path: '/profile', icon: PersonIcon },
] as const;

interface AuthenticatedShellProps {
  children: ReactNode;
  /** Full-bleed layout for embedded docs (no content padding, flex height). */
  variant?: 'default' | 'docs';
}

function isNavActive(path: string, pathname: string): boolean {
  if (path === '/developers') {
    return pathname.startsWith('/developers');
  }

  return pathname === path;
}

function SidebarNav({
  onNavigate,
  compact = false,
}: {
  onNavigate?: () => void;
  compact?: boolean;
}) {
  const location = useLocation();

  return (
    <List disablePadding sx={{ px: compact ? 0 : 1.5, py: compact ? 0 : 1 }}>
      {NAV_ITEMS.map(({ label, path, icon: Icon }) => {
        const isActive = isNavActive(path, location.pathname);

        return (
          <ListItemButton
            className={isActive ? 'nav-item nav-item-active' : 'nav-item'}
            component={RouterLink}
            key={path}
            onClick={onNavigate}
            to={path}
            sx={compact ? { borderRadius: 2, minHeight: 48 } : undefined}
          >
            <ListItemIcon sx={{ minWidth: compact ? 40 : 36 }}>
              <Icon fontSize="small" />
            </ListItemIcon>
            <ListItemText
              primary={label}
              slotProps={{
                primary: { sx: { fontWeight: isActive ? 700 : 600 } },
              }}
            />
          </ListItemButton>
        );
      })}
    </List>
  );
}

function MobileBottomNav() {
  const location = useLocation();

  const currentValue = NAV_ITEMS.find(({ path }) =>
    isNavActive(path, location.pathname),
  )?.path;

  return (
    <Box
      className="mobile-bottom-nav"
      component="nav"
      sx={{
        display: { xs: 'block', md: 'none' },
      }}
    >
      <BottomNavigation showLabels value={currentValue ?? false}>
        {NAV_ITEMS.map(({ label, path, icon: Icon }) => {
          const isActive = isNavActive(path, location.pathname);

          return (
            <BottomNavigationAction
              className={
                isActive
                  ? 'bottom-nav-item bottom-nav-item-active'
                  : 'bottom-nav-item'
              }
              component={RouterLink}
              icon={<Icon />}
              key={path}
              label={label}
              to={path}
              value={path}
            />
          );
        })}
      </BottomNavigation>
    </Box>
  );
}

function getMobileTitle(pathname: string): string {
  const match = NAV_ITEMS.find(({ path }) => isNavActive(path, pathname));
  return match?.label ?? PRODUCT_NAME;
}

export function AuthenticatedShell({
  children,
  variant = 'default',
}: AuthenticatedShellProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));
  const isDocs = variant === 'docs';
  const [drawerOpen, setDrawerOpen] = useState(false);
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    navigate('/login', { replace: true });
  }

  function closeDrawer() {
    setDrawerOpen(false);
  }

  const sidebar = (
    <Stack className="sidebar-inner" spacing={0}>
      <Stack className="sidebar-brand" direction="row" spacing={1.25}>
        <RouterLink aria-label={`${PRODUCT_NAME} home`} to="/my-links">
          <BrandMark />
        </RouterLink>
        <Box sx={{ minWidth: 0 }}>
          <Typography noWrap sx={{ fontWeight: 800, lineHeight: 1.2 }}>
            {PRODUCT_NAME}
          </Typography>
          <Typography color="text.secondary" noWrap variant="caption">
            {PRODUCT_TAGLINE}
          </Typography>
        </Box>
      </Stack>

      {!isMobile ? (
        <Box sx={{ flex: 1, py: 1 }}>
          <SidebarNav />
        </Box>
      ) : null}

      <Box className="sidebar-footer">
        <Typography
          noWrap
          sx={{ fontSize: '0.875rem', fontWeight: 700, mb: 0.25, px: 0.5 }}
          title={user?.name ?? user?.email ?? undefined}
        >
          {user?.name ?? 'Your profile'}
        </Typography>
        <Typography
          color="text.secondary"
          noWrap
          sx={{ fontSize: '0.8125rem', mb: 1.25, px: 0.5 }}
          title={user?.email}
        >
          {user?.email}
        </Typography>
        <Button
          color="inherit"
          fullWidth
          onClick={handleLogout}
          startIcon={<LogoutIcon fontSize="small" />}
          sx={{ justifyContent: 'flex-start', color: 'text.secondary' }}
        >
          Sign out
        </Button>
      </Box>
    </Stack>
  );

  const mobileDrawer = (
    <Drawer
      ModalProps={{ keepMounted: true }}
      onClose={closeDrawer}
      open={drawerOpen}
      sx={{
        display: { xs: 'block', md: 'none' },
        '& .MuiDrawer-paper': {
          width: 'min(100vw, 300px)',
          maxWidth: '100%',
          height: '100%',
          maxHeight: '100dvh',
          overflow: 'hidden',
        },
      }}
    >
      <Stack className="mobile-drawer">
        <Stack
          className="mobile-drawer-header"
          direction="row"
          spacing={1}
          sx={{ alignItems: 'center', justifyContent: 'space-between' }}
        >
          <Typography sx={{ fontWeight: 800 }}>Menu</Typography>
          <IconButton aria-label="Close menu" edge="end" onClick={closeDrawer}>
            <MenuIcon />
          </IconButton>
        </Stack>

        <Box className="mobile-drawer-nav">
          <SidebarNav compact onNavigate={closeDrawer} />
        </Box>

        <Box className="mobile-drawer-footer">
          <Typography
            noWrap
            sx={{ fontSize: '0.875rem', fontWeight: 700, mb: 0.25 }}
            title={user?.name ?? user?.email ?? undefined}
          >
            {user?.name ?? 'Your profile'}
          </Typography>
          <Typography
            color="text.secondary"
            sx={{
              fontSize: '0.8125rem',
              mb: 1.5,
              overflowWrap: 'anywhere',
              wordBreak: 'break-word',
            }}
            title={user?.email}
          >
            {user?.email}
          </Typography>
          <Button
            color="inherit"
            fullWidth
            onClick={() => {
              closeDrawer();
              handleLogout();
            }}
            startIcon={<LogoutIcon fontSize="small" />}
            sx={{ justifyContent: 'flex-start', color: 'text.secondary' }}
          >
            Sign out
          </Button>
        </Box>
      </Stack>
    </Drawer>
  );

  return (
    <Box
      className={
        isDocs ? 'app-shell app-shell--docs' : 'app-shell app-shell--with-mobile-nav'
      }
    >
      {!isMobile ? (
        <Box className="app-sidebar" component="aside">
          {sidebar}
        </Box>
      ) : null}

      <Box className="app-main" component="main">
        {isMobile ? (
          <Stack
            className="mobile-topbar"
            direction="row"
            spacing={1}
            sx={{ alignItems: 'center' }}
          >
            <IconButton
              aria-label="Open menu"
              edge="start"
              onClick={() => setDrawerOpen(true)}
            >
              <MenuIcon />
            </IconButton>
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography noWrap sx={{ fontWeight: 800 }}>
                {getMobileTitle(location.pathname)}
              </Typography>
            </Box>
          </Stack>
        ) : null}

        <Box
          className={
            isDocs ? 'app-content app-content--docs' : 'app-content'
          }
        >
          {children}
        </Box>
      </Box>

      {isMobile && !drawerOpen ? <MobileBottomNav /> : null}
      {isMobile ? mobileDrawer : null}
    </Box>
  );
}
