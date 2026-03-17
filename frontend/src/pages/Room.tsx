import { useEffect } from 'react';
import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useSocket } from '../context/SocketContext';
import { UserSidebar } from '../components/UserSidebar';
import { VideoPlayer } from '../components/VideoPlayer';
import { Box, Typography, Button, AppBar, Toolbar, Alert } from '@mui/material';
import { Logout } from '@mui/icons-material';

const Room = () => {
    const { roomId } = useParams<{ roomId: string }>();
    const [searchParams] = useSearchParams();
    const username = searchParams.get('username');
    const navigate = useNavigate();
    
    const { joinRoom, leaveRoom, isConnected, connectionError, backendUrl } = useSocket();

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
                    <Typography variant="h6" className="animate-pulse" color="primary">
                        Connecting to server...
                    </Typography>
                    <Typography variant="body2" color="text.secondary" mt={1}>
                        Backend: {backendUrl}
                    </Typography>
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
                    <Button 
                        color="inherit" 
                        startIcon={<Logout />}
                        onClick={() => {
                            leaveRoom();
                            navigate('/');
                        }}
                    >
                        Leave Room
                    </Button>
                </Toolbar>
            </AppBar>

            {/* Main Content Area */}
            <Box display="flex" flex={1} overflow="hidden">
                
                {/* Left Side: Video Player */}
                <Box flex={1} display="flex" alignItems="center" justifyContent="center" p={4} position="relative">
                     <Box width="100%" maxWidth="1200px">
                          <VideoPlayer />
                     </Box>
                </Box>

                {/* Right Side: Sidebar (Participants & Chat) */}
                <Box width={350} borderLeft={1} borderColor="divider" bgcolor="background.paper" display="flex" flexDirection="column">
                    <UserSidebar />
                </Box>
            </Box>
        </Box>
    );
};

export default Room;
