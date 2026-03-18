import { useEffect, useState } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { UserSidebar } from '../components/UserSidebar';
import { VideoPlayer } from '../components/VideoPlayer';
import { Box, Typography, Button, AppBar, Toolbar, Alert, Drawer, IconButton, useMediaQuery, useTheme, CircularProgress } from '@mui/material';
import { Logout, Menu as MenuIcon } from '@mui/icons-material';

const Room = () => {
    const { roomId } = useParams<{ roomId: string }>();
    const [searchParams] = useSearchParams();
    const username = searchParams.get('username');
    const navigate = useNavigate();
    
    const { joinRoom, leaveRoom, isConnected, connectionError, backendUrl } = useSocket();
    
    const theme = useTheme();
    const isMobile = useMediaQuery(theme.breakpoints.down('md'));
    const [mobileOpen, setMobileOpen] = useState(false);

    const handleDrawerToggle = () => {
        setMobileOpen(!mobileOpen);
    };

    useEffect(() => {
        if (!username || !roomId) {
            navigate('/');
            return;
        }

        joinRoom(roomId, username);
    }, [roomId, username, joinRoom, leaveRoom, navigate]);

    if (!isConnected) {
        return (
            <Box display="flex" minHeight="100vh" alignItems="center" justifyContent="center">
                <Box textAlign="center">
                    <CircularProgress size={48} sx={{ mb: 3 }} />
                    <Typography variant="h6" className="animate-pulse" color="primary">
                        Connecting to server...
                    </Typography>
                    {/* <Typography variant="body2" color="text.secondary" mt={1}>
                        Backend: {backendUrl}
                    </Typography> */}
                    {connectionError && (
                        <Box mt={3} maxWidth={520}>
                            <Alert severity="error">
                                {connectionError}
                            </Alert>
                        </Box>
                    )}
                </Box>
            </Box>
        );
    }

    return (
        <Box display="flex" flexDirection="column" minHeight="100vh">
            {/* Minimal Header */}
            <AppBar position="static" color="transparent" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
                <Toolbar>
                    <Typography variant="h6" component="div" sx={{ flexGrow: 1, fontWeight: 'bold' }}>
                        Watch Party <Typography component="span" color="primary.main">Live</Typography>
                    </Typography>
                    
                    {/* Add Drawer Toggle on Mobile */}
                    {isMobile && (
                        <IconButton
                            color="inherit"
                            aria-label="open drawer"
                            edge="end"
                            onClick={handleDrawerToggle}
                            sx={{ mr: 1, color: 'primary.main' }}
                        >
                            <MenuIcon />
                        </IconButton>
                    )}

                    <Button 
                        color="inherit" 
                        startIcon={<Logout />}
                        onClick={() => {
                            leaveRoom();
                            navigate('/');
                        }}
                    >
                        Leave
                    </Button>
                </Toolbar>
            </AppBar>

            {/* Main Content Area */}
            <Box display="flex" flex={1} overflow="hidden" flexDirection={{ xs: 'column', md: 'row' }}>
                
                {/* Video Player Area */}
                <Box flex={1} display="flex" alignItems="center" justifyContent="center" p={{ xs: 2, md: 4 }} position="relative" overflow="auto">
                     <Box width="100%" maxWidth="1200px">
                          <VideoPlayer />
                     </Box>
                </Box>

                {/* Sidebar (Participants & Chat) */}
                {isMobile ? (
                    <Drawer
                        anchor="right"
                        open={mobileOpen}
                        onClose={handleDrawerToggle}
                        ModalProps={{
                            keepMounted: true, // Better open performance on mobile.
                        }}
                        sx={{
                            display: { xs: 'block', md: 'none' },
                            '& .MuiDrawer-paper': { boxSizing: 'border-box', width: 320 },
                        }}
                    >
                        <UserSidebar />
                    </Drawer>
                ) : (
                    <Box 
                        width={350} 
                        borderLeft={1} 
                        borderColor="divider" 
                        bgcolor="background.paper" 
                        display="flex" 
                        flexDirection="column"
                    >
                        <UserSidebar />
                    </Box>
                )}
            </Box>
        </Box>
    );
};

export default Room;
