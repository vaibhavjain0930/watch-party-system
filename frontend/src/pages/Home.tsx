import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Box, Container, Paper, Typography, TextField, Button, Divider } from '@mui/material';
import { PlayArrow, Link as LinkIcon, GroupAdd } from '@mui/icons-material';

const Home = () => {
  const [username, setUsername] = useState('');
  const [roomId, setRoomId] = useState('');
  const navigate = useNavigate();

  const handleCreateRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) return alert('Please enter a username');
    
    // Generate a random 6 character room code
    const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    navigate(`/room/${newRoomId}?username=${encodeURIComponent(username)}`);
  };

  const handleJoinRoom = (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !roomId.trim()) return alert('Please enter both username and room code');
    navigate(`/room/${roomId.toUpperCase()}?username=${encodeURIComponent(username)}`);
  };

  return (
    <Container maxWidth="xs" sx={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Paper elevation={12} sx={{ p: 4, width: '100%', borderRadius: 3 }}>
        
        <Box textAlign="center" mb={4}>
          <Box 
            sx={{ 
              display: 'inline-flex', 
              p: 2, 
              borderRadius: '50%', 
              backgroundColor: 'primary.dark',
              mb: 2 
            }}
          >
            <PlayArrow fontSize="large" color="primary" sx={{ color: '#fff' }} />
          </Box>
          <Typography variant="h4" fontWeight="bold" gutterBottom>
            Watch Party
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Sync and watch YouTube videos together
          </Typography>
        </Box>

        <Box display="flex" flexDirection="column" gap={3}>
          <TextField
            fullWidth
            label="Display Name"
            variant="outlined"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            inputProps={{ maxLength: 20 }}
          />

          <Divider />

          <Button
            fullWidth
            variant="contained"
            color="primary"
            size="large"
            startIcon={<GroupAdd />}
            onClick={handleCreateRoom}
          >
            Create New Room
          </Button>

          <Divider>
            <Typography variant="caption" color="text.secondary">OR JOIN EXISTING</Typography>
          </Divider>

          <Box display="flex" gap={1}>
            <TextField
              sx={{ flex: 1 }}
              label="Room Code"
              variant="outlined"
              size="small"
              value={roomId}
              onChange={(e) => setRoomId(e.target.value)}
              inputProps={{ maxLength: 6, style: { textTransform: 'uppercase', fontFamily: 'monospace' } }}
            />
            <Button
              variant="outlined"
              color="inherit"
              startIcon={<LinkIcon />}
              onClick={handleJoinRoom}
            >
              Join
            </Button>
          </Box>
        </Box>

      </Paper>
    </Container>
  );
};

export default Home;
