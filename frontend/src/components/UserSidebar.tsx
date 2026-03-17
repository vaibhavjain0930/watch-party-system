import React, { useState, useRef, useEffect } from 'react';
import { useSocket, type Role } from '../context/SocketContext';
import { 
    Box, Typography, Tabs, Tab, List, ListItem, ListItemAvatar, 
    ListItemText, Avatar, IconButton, Menu, MenuItem, Divider, 
    TextField, Paper 
} from '@mui/material';
import { 
    MoreVert, Shield, Person, Star, Send as SendIcon, Gavel 
} from '@mui/icons-material';

interface TabPanelProps {
  children?: React.ReactNode;
  index: number;
  value: number;
}

function TabPanel(props: TabPanelProps) {
  const { children, value, index, ...other } = props;
  return (
    <div
      role="tabpanel"
      hidden={value !== index}
      style={{ display: value === index ? 'flex' : 'none', flexDirection: 'column', flex: 1, overflow: 'hidden' }}
      {...other}
    >
      {value === index && children}
    </div>
  );
}

const RoleIcons = {
    Host: <Star sx={{ color: '#eab308' }} />,
    Moderator: <Shield sx={{ color: '#3b82f6' }} />,
    Participant: <Person sx={{ color: '#9ca3af' }} />,
    Viewer: <Person sx={{ color: '#9ca3af' }} />
};

export const UserSidebar = () => {
    const { participants, messages, currentUser, assignRole, transferHost, kickParticipant, roomId, sendMessage } = useSocket();
    const [tabValue, setTabValue] = useState(0);
    const [chatInput, setChatInput] = useState('');
    const chatEndRef = useRef<HTMLDivElement>(null);
    
    // For Host Action Menu
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null);

    const isAdmin = currentUser?.role === 'Host';

    useEffect(() => {
        // Auto-scroll chat
        if (tabValue === 1 && chatEndRef.current) {
            chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [messages, tabValue]);

    const handleMenuOpen = (event: React.MouseEvent<HTMLElement>, userId: string) => {
        setAnchorEl(event.currentTarget);
        setSelectedUserId(userId);
    };

    const handleMenuClose = () => {
        setAnchorEl(null);
        setSelectedUserId(null);
    };

    const handleAssignRole = (role: Role) => {
        if (selectedUserId) assignRole(selectedUserId, role);
        handleMenuClose();
    };

    const handleKick = () => {
        if (selectedUserId) kickParticipant(selectedUserId);
        handleMenuClose();
    };

    const handleTransferHost = () => {
        if (selectedUserId) transferHost(selectedUserId);
        handleMenuClose();
    };

    const handleChatSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (!chatInput.trim()) return;
        sendMessage(chatInput);
        setChatInput('');
    };

    return (
        <Box display="flex" flexDirection="column" height="100%">
            {/* Header Info */}
            <Box p={2} borderBottom={1} borderColor="divider" bgcolor="rgba(255,255,255,0.02)">
                <Typography variant="body2" color="text.secondary" gutterBottom>
                    Room Code
                </Typography>
                <Typography variant="h5" color="primary" sx={{ fontFamily: 'monospace', letterSpacing: 2 }}>
                    {roomId}
                </Typography>
            </Box>

            {/* Tabs */}
            <Tabs 
                value={tabValue} 
                onChange={(_, newValue) => setTabValue(newValue)}
                variant="fullWidth"
                sx={{ borderBottom: 1, borderColor: 'divider' }}
            >
                <Tab label={`Users (${participants.length})`} />
                <Tab label="Chat" />
            </Tabs>

            {/* Participants Tab */}
            <TabPanel value={tabValue} index={0}>
                <List sx={{ flex: 1, overflowY: 'auto', p: 0 }}>
                    {participants.map((p) => (
                        <ListItem
                            key={p.id}
                            secondaryAction={
                                isAdmin && p.id !== currentUser?.id ? (
                                    <IconButton edge="end" onClick={(e) => handleMenuOpen(e, p.id)}>
                                        <MoreVert />
                                    </IconButton>
                                ) : null
                            }
                            sx={{ borderBottom: 1, borderColor: 'divider' }}
                        >
                            <ListItemAvatar>
                                <Avatar sx={{ bgcolor: 'rgba(255,255,255,0.05)', border: 1, borderColor: 'divider' }}>
                                    {RoleIcons[p.role]}
                                </Avatar>
                            </ListItemAvatar>
                            <ListItemText
                                primary={
                                    <Box display="flex" alignItems="center" gap={1}>
                                        <Typography variant="body2" fontWeight={500}>{p.username}</Typography>
                                        {p.id === currentUser?.id && (
                                            <Typography variant="caption" sx={{ bgcolor: 'primary.dark', px: 1, borderRadius: 1, fontSize: '0.65rem' }}>
                                                YOU
                                            </Typography>
                                        )}
                                    </Box>
                                }
                                secondary={<Typography variant="caption" color="text.secondary">{p.role}</Typography>}
                            />
                        </ListItem>
                    ))}
                </List>

                <Menu anchorEl={anchorEl} open={Boolean(anchorEl)} onClose={handleMenuClose}>
                    <MenuItem disabled sx={{ opacity: 1, fontSize: '0.75rem', fontWeight: 'bold' }}>Change Role</MenuItem>
                    {(['Moderator', 'Participant', 'Viewer'] as Role[]).map((r) => (
                        <MenuItem key={r} onClick={() => handleAssignRole(r)}>
                            Make {r}
                        </MenuItem>
                    ))}
                    <Divider />
                    <MenuItem onClick={handleTransferHost}>
                        Transfer Host
                    </MenuItem>
                    <MenuItem onClick={handleKick} sx={{ color: 'error.main' }}>
                        <Gavel fontSize="small" sx={{ mr: 1 }} />
                        Kick User
                    </MenuItem>
                </Menu>
            </TabPanel>

            {/* Chat Tab */}
            <TabPanel value={tabValue} index={1}>
                {/* Message List */}
                <Box flex={1} overflow="auto" p={2} display="flex" flexDirection="column" gap={1}>
                    {messages.length === 0 ? (
                        <Typography variant="body2" color="text.secondary" textAlign="center" mt={4}>
                            No messages yet. Say hi!
                        </Typography>
                    ) : (
                        messages.map((msg, idx) => {
                            const isMe = msg.userId === currentUser?.id;
                            return (
                                <Box key={idx} display="flex" flexDirection="column" alignItems={isMe ? 'flex-end' : 'flex-start'} mb={1}>
                                    <Typography variant="caption" color="text.secondary" sx={{ ml: 1, mr: 1, mb: 0.5 }}>
                                        {msg.username}
                                    </Typography>
                                    <Paper 
                                        elevation={0}
                                        sx={{ 
                                            p: 1.5, 
                                            maxWidth: '85%', 
                                            bgcolor: isMe ? 'primary.main' : 'rgba(255,255,255,0.05)',
                                            color: isMe ? 'primary.contrastText' : 'text.primary',
                                            borderRadius: 2,
                                            borderTopRightRadius: isMe ? 4 : 16,
                                            borderTopLeftRadius: isMe ? 16 : 4
                                        }}
                                    >
                                        <Typography variant="body2" sx={{ wordBreak: 'break-word' }}>
                                            {msg.message}
                                        </Typography>
                                    </Paper>
                                </Box>
                            );
                        })
                    )}
                    <div ref={chatEndRef} />
                </Box>

                {/* Chat Input */}
                <Box component="form" onSubmit={handleChatSubmit} p={2} borderTop={1} borderColor="divider" bgcolor="background.paper">
                    <TextField
                        fullWidth
                        size="small"
                        placeholder="Type a message..."
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        autoComplete="off"
                        InputProps={{
                            endAdornment: (
                                <IconButton type="submit" color="primary" disabled={!chatInput.trim()}>
                                    <SendIcon />
                                </IconButton>
                            )
                        }}
                    />
                </Box>
            </TabPanel>

        </Box>
    );
};
