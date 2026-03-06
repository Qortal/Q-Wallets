import {
  AppBar,
  Box,
  Container,
  Dialog,
  DialogContent,
  DialogTitle,
  Drawer,
  IconButton,
  Link,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListSubheader,
  Toolbar,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import type { Theme } from '@mui/material/styles';
import CloseIcon from '@mui/icons-material/Close';
import { useEffect, useMemo, useContext, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import walletContext, { IContextProps } from './contexts/walletContext';
import { useAuth } from 'qapp-core';
import qort from './assets/qort.png';
import btc from './assets/btc.png';
import ltc from './assets/ltc.png';
import doge from './assets/doge.png';
import dgb from './assets/dgb.png';
import rvn from './assets/rvn.png';
import arrr from './assets/arrr.png';
import { useIframe } from './hooks/useIframeListener';
import { useTranslation } from 'react-i18next';
import packageJson from '../package.json';
import { EMPTY_STRING, TIME_MINUTES_1 } from './common/constants';
import MenuIcon from '@mui/icons-material/Menu';
import { syncAllAddressBooksOnStartup } from './utils/addressBookQDN';
import changelogContent from '../CHANGELOG.md?raw';
import Markdown from 'react-markdown';

export default function AppLayout() {
  useIframe();

  const { t } = useTranslation(['core']);
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const { setWalletState } = useContext(walletContext);
  const { address, avatarUrl, name } = useAuth();
  const [isUsingGateway, setIsUsingGateway] = useState(true);
  const [nodeInfo, setNodeInfo] = useState<any>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [changelogOpen, setChangelogOpen] = useState(false);

  // derive selected from the URL
  const selectedSegment = useMemo(() => {
    const seg = location.pathname.replace(/^\//, EMPTY_STRING);
    return seg || '/';
  }, [location.pathname]);

  async function getNodeInfo() {
    try {
      const nodeInfo = await qortalRequest({
        action: 'GET_NODE_INFO',
      });
      const nodeStatus = await qortalRequest({
        action: 'GET_NODE_STATUS',
      });
      return { ...nodeInfo, ...nodeStatus };
    } catch (error) {
      console.error(error);
    }
  }

  useEffect(() => {
    let isMounted = true;

    const fetchGatewayStatus = async () => {
      try {
        const res = await qortalRequest({
          action: 'IS_USING_PUBLIC_NODE',
        });
        if (isMounted) {
          setIsUsingGateway(res);
        }
      } catch (error) {
        console.error(error);
      }
    };

    fetchGatewayStatus();

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    let nodeInfoTimeoutId: number | NodeJS.Timeout;
    (async () => {
      nodeInfoTimeoutId = setInterval(async () => {
        const infos = await getNodeInfo();
        setNodeInfo(infos);
      }, TIME_MINUTES_1);
      const infos = await getNodeInfo();
      setNodeInfo(infos);
    })();
    return () => {
      clearInterval(nodeInfoTimeoutId);
    };
  }, []);

  useEffect(() => {
    const session: IContextProps = {
      address: address ?? EMPTY_STRING,
      avatar: avatarUrl ?? EMPTY_STRING,
      name: name ?? EMPTY_STRING,
      isAuthenticated: !!address,
      isUsingGateway: isUsingGateway,
      nodeInfo: nodeInfo,
    };
    if (setWalletState) {
      setWalletState(session);
    } else {
      console.error('setWalletState is not available in wallet context');
    }
  }, [address, avatarUrl, isUsingGateway, name, nodeInfo, setWalletState]);

  // Sync address books from QDN on app startup
  useEffect(() => {
    // Only sync if user is authenticated
    if (address && name) {
      syncAllAddressBooksOnStartup(name).catch((err) => {
        console.error('Failed to sync address books on startup:', err);
        // App continues to work with localStorage only
      });
    }
  }, [address, name]);

  type NavHeader = { kind: 'header'; title: string };
  type NavSegment = { segment: string; title: string; icon: React.ReactNode };
  type Navigation = Array<NavHeader | NavSegment>;

  const coinStyle = { width: 24, height: 'auto' } as const;

  const NAVIGATION: Navigation = [
    {
      kind: 'header',
      title: t('core:wallets', { postProcess: 'capitalizeAll' }),
    },
    {
      segment: 'qortal',
      title: t('core:coins.qortal', { postProcess: 'capitalizeFirstChar' }),
      icon: <img src={qort} style={coinStyle} />,
    },
    {
      segment: 'litecoin',
      title: t('core:coins.litecoin', { postProcess: 'capitalizeFirstChar' }),
      icon: <img src={ltc} style={coinStyle} />,
    },
    {
      segment: 'bitcoin',
      title: t('core:coins.bitcoin', { postProcess: 'capitalizeFirstChar' }),
      icon: <img src={btc} style={coinStyle} />,
    },
    {
      segment: 'dogecoin',
      title: t('core:coins.dogecoin', { postProcess: 'capitalizeFirstChar' }),
      icon: <img src={doge} style={coinStyle} />,
    },
    {
      segment: 'digibyte',
      title: t('core:coins.digibyte', { postProcess: 'capitalizeFirstChar' }),
      icon: <img src={dgb} style={coinStyle} />,
    },
    {
      segment: 'ravencoin',
      title: t('core:coins.ravencoin', { postProcess: 'capitalizeFirstChar' }),
      icon: <img src={rvn} style={coinStyle} />,
    },
    {
      segment: 'piratechain',
      title: t('core:coins.piratechain', {
        postProcess: 'capitalizeFirstChar',
      }),
      icon: <img src={arrr} style={coinStyle} />,
    },
  ];

  const drawerWidth = isMobile ? 120 : 140;

  const drawerSx = {
    width: drawerWidth,
    flexShrink: 0,
    '& .MuiDrawer-paper': {
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column',
      overflowX: 'hidden',
      pt: 1,
      width: drawerWidth,
    },
  } as const;

  const handleDrawerToggle = () => {
    setMobileOpen((prev) => !prev);
  };

  const handleNavigate = (segment: string) => {
    navigate(segment === '/' ? '/' : `/${segment}`);
    if (isMobile) {
      setMobileOpen(false);
    }
  };

  const drawerContent = (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', width: drawerWidth }}>
      <List
        disablePadding
        subheader={
          <ListSubheader
            component="div"
            sx={{
              fontSize: 11,
              letterSpacing: 1.2,
              lineHeight: 1.2,
              py: 1.5,
              textAlign: 'center',
            }}
          >
            {t('core:wallets', { postProcess: 'capitalizeAll' })}
          </ListSubheader>
        }
        sx={{ flexGrow: 1 }}
      >
        {NAVIGATION.filter((i): i is NavSegment => (i as any).segment).map((item) => {
          const isSelected =
            selectedSegment === item.segment ||
            (selectedSegment === '/' && item.segment === '/');
          return (
            <ListItem key={item.segment} disablePadding>
              <ListItemButton
                onClick={() => handleNavigate(item.segment)}
                selected={isSelected}
                sx={{
                  py: 2,
                  minHeight: 56,
                  '&.Mui-selected': (theme: Theme) => ({
                    borderRight: `3px solid ${theme.palette.primary.main}`,
                  }),
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <Box sx={{ width: 24, height: 24, display: 'inline-flex' }}>{item.icon}</Box>
                  <Box
                    sx={{
                      fontSize: 11,
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {item.title}
                  </Box>
                </ListItemIcon>
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
      <Box sx={{ mt: 'auto', mb: 1, textAlign: 'center' }}>
        <Typography variant="caption" sx={{ fontSize: 10, color: 'text.secondary' }}>
          v{packageJson.version}
        </Typography>
        <br />
        <Link
          component="button"
          variant="caption"
          onClick={() => setChangelogOpen(true)}
          sx={{ fontSize: 9, cursor: 'pointer' }}
        >
          CHANGELOG
        </Link>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', width: '100%' }}>
      {isMobile && (
        <AppBar position="fixed" color="primary" sx={{ zIndex: (t: Theme) => t.zIndex.drawer + 1 }}>
          <Toolbar sx={{ minHeight: 56 }}>
            <IconButton
              color="inherit"
              edge="start"
              onClick={handleDrawerToggle}
              sx={{ mr: 1 }}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" component="div" noWrap>
              {t('core:wallets', { postProcess: 'capitalizeAll' })}
            </Typography>
          </Toolbar>
        </AppBar>
      )}

      {isMobile ? (
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={handleDrawerToggle}
          ModalProps={{ keepMounted: true }}
          sx={drawerSx}
        >
          {drawerContent}
        </Drawer>
      ) : (
        <Drawer variant="permanent" sx={drawerSx}>
          {drawerContent}
        </Drawer>
      )}

      <Box component="main" sx={{ flexGrow: 1, width: '100%', overflowX: 'auto' }}>
        {isMobile && <Toolbar />}
        <Container maxWidth="xl" sx={{ my: isMobile ? 6 : 8 }}>
          <Outlet />
        </Container>
      </Box>

      <Dialog
        open={changelogOpen}
        onClose={() => setChangelogOpen(false)}
        maxWidth="md"
        fullWidth
        slotProps={{ paper: { sx: { maxHeight: '80vh' } } }}
      >
        <DialogTitle sx={{ textAlign: 'center', position: 'relative' }}>
          CHANGELOG
          <IconButton
            onClick={() => setChangelogOpen(false)}
            size="small"
            sx={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)' }}
          >
            <CloseIcon />
          </IconButton>
        </DialogTitle>
        <DialogContent dividers>
          <Box
            sx={{
              '& h1': { fontSize: '1.5rem', fontWeight: 600, mb: 2, mt: 0 },
              '& h2': { fontSize: '1.2rem', fontWeight: 600, mb: 1, mt: 3, color: 'primary.main' },
              '& h3': { fontSize: '1rem', fontWeight: 600, mb: 1, mt: 2 },
              '& ul': { pl: 2, mb: 1 },
              '& li': { mb: 0.5, fontSize: 14 },
              '& p': { mb: 1, fontSize: 14 },
              '& code': {
                backgroundColor: 'action.hover',
                px: 0.5,
                py: 0.25,
                borderRadius: 0.5,
                fontSize: 13,
              },
            }}
          >
            <Markdown>{changelogContent}</Markdown>
          </Box>
        </DialogContent>
      </Dialog>
    </Box>
  );
}
