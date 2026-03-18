import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { PlayArrow, Pause, YouTube } from '@mui/icons-material';
import { Box, IconButton, Slider, Typography, Paper, TextField, Button, Alert } from '@mui/material';

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

function loadYouTubeIframeApi(): Promise<void> {
  if (window.YT?.Player) return Promise.resolve();

  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-yt-iframe-api="true"]') as HTMLScriptElement | null;
    if (existing) {
      const started = Date.now();
      const tick = () => {
        if (window.YT?.Player) return resolve();
        if (Date.now() - started > 15000) return reject(new Error('Timed out loading YouTube IFrame API'));
        setTimeout(tick, 50);
      };
      tick();
      return;
    }

    window.onYouTubeIframeAPIReady = () => resolve();
    const tag = document.createElement('script');
    tag.src = 'https://www.youtube.com/iframe_api';
    tag.async = true;
    tag.dataset.ytIframeApi = 'true';
    tag.onerror = () => reject(new Error('Failed to load YouTube IFrame API'));
    document.body.appendChild(tag);
  });
}

function extractYouTubeVideoId(input: string): string | null {
  const value = input.trim();
  if (!value) return null;

  // If user pasted only an ID
  if (/^[a-zA-Z0-9_-]{6,}$/.test(value) && !value.includes('http')) return value;

  try {
    const url = new URL(value);
    if (url.hostname.includes('youtu.be')) {
      const id = url.pathname.replace('/', '').trim();
      return id || null;
    }
    if (url.hostname.includes('youtube.com')) {
      const v = url.searchParams.get('v');
      if (v) return v;
      // Shorts: /shorts/:id
      const parts = url.pathname.split('/').filter(Boolean);
      const shortsIdx = parts.indexOf('shorts');
      if (shortsIdx >= 0 && parts[shortsIdx + 1]) return parts[shortsIdx + 1];
    }
  } catch {
    // ignore
  }

  return null;
}

export const VideoPlayer = () => {
  const { videoState, playVideo, pauseVideo, seekVideo, changeVideo, currentUser } = useSocket();
  const containerId = useMemo(() => `yt-player-${Math.random().toString(36).slice(2)}`, []);
  const playerRef = useRef<any>(null);
  const applyingRemoteRef = useRef(false);

  const [localUrl, setLocalUrl] = useState('');
  const [playerReady, setPlayerReady] = useState(false);
  const [playerError, setPlayerError] = useState<string | null>(null);

  // local state so we don't stutter while dragging
  const [isSeeking, setIsSeeking] = useState(false);
  const [played, setPlayed] = useState(0);

  const isControlAllowed = currentUser?.role === 'Host' || currentUser?.role === 'Moderator';

  // Init YT player
  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        await loadYouTubeIframeApi();
        if (cancelled) return;

        const YT = window.YT!;
        playerRef.current = new YT.Player(containerId, {
          width: '100%',
          height: '100%',
          videoId: videoState.videoId || 'dQw4w9WgXcQ',
          playerVars: {
            modestbranding: 1,
            rel: 0,
            controls: 0,
            disablekb: 1
          },
          events: {
            onReady: () => {
              if (cancelled) return;
              setPlayerReady(true);
              setPlayerError(null);
            },
            onError: (e: any) => {
              if (cancelled) return;
              setPlayerError(`YouTube error code: ${e?.data ?? 'unknown'}`);
              setPlayerReady(false);
            }
          }
        });
      } catch (e: any) {
        if (cancelled) return;
        setPlayerError(e?.message || String(e));
        setPlayerReady(false);
      }
    })();

    return () => {
      cancelled = true;
      try {
        playerRef.current?.destroy?.();
      } catch {
        // ignore
      }
      playerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [containerId]);

  // Update local progress
  useEffect(() => {
    if (!playerReady || !playerRef.current) return;
    const interval = window.setInterval(() => {
      const player = playerRef.current;
      if (!player || applyingRemoteRef.current) return;
      const duration = typeof player.getDuration === 'function' ? player.getDuration() : 0;
      const current = typeof player.getCurrentTime === 'function' ? player.getCurrentTime() : 0;
      if (!isSeeking && duration > 0) {
        setPlayed(Math.min(1, Math.max(0, current / duration)));
      }
    }, 500);
    return () => window.clearInterval(interval);
  }, [playerReady, isSeeking]);

  // Apply server sync_state to player (source of truth)
  useEffect(() => {
    const player = playerRef.current;
    if (!playerReady || !player) return;

    applyingRemoteRef.current = true;
    const done = () => {
      // small delay to avoid re-entrancy while YT transitions state
      window.setTimeout(() => {
        applyingRemoteRef.current = false;
      }, 150);
    };

    try {
      const currentVideoId = typeof player.getVideoData === 'function' ? player.getVideoData()?.video_id : undefined;
      const needsVideoChange = videoState.videoId && currentVideoId && currentVideoId !== videoState.videoId;

      if (needsVideoChange) {
        if (videoState.playState === 'playing') {
          player.loadVideoById(videoState.videoId, videoState.currentTime || 0);
        } else {
          player.cueVideoById(videoState.videoId, videoState.currentTime || 0);
        }
        done();
        return;
      }

      // Seek if drift is high
      const t = typeof player.getCurrentTime === 'function' ? player.getCurrentTime() : 0;
      if (Math.abs((t || 0) - (videoState.currentTime || 0)) > 1) {
        if (typeof player.seekTo === 'function') player.seekTo(videoState.currentTime || 0, true);
      }

      // Play/pause
      if (videoState.playState === 'playing') {
        if (typeof player.playVideo === 'function') player.playVideo();
      } else {
        if (typeof player.pauseVideo === 'function') player.pauseVideo();
      }
    } finally {
      done();
    }
  }, [playerReady, videoState.videoId, videoState.playState, videoState.currentTime, videoState.lastUpdateTime]);

  const emitPlay = () => {
    if (!isControlAllowed || !playerReady || !playerRef.current) return;
    const t = typeof playerRef.current.getCurrentTime === 'function' ? playerRef.current.getCurrentTime() : 0;
    seekVideo(t); // keep event shapes as spec: seek {time}, then play {}
    playVideo();
  };

  const emitPause = () => {
    if (!isControlAllowed || !playerReady || !playerRef.current) return;
    const t = typeof playerRef.current.getCurrentTime === 'function' ? playerRef.current.getCurrentTime() : 0;
    seekVideo(t);
    pauseVideo();
  };

  const handleSeekChange = (_: Event | React.SyntheticEvent, newValue: number | number[]) => {
    if (!isControlAllowed) return;
    setPlayed(newValue as number);
  };

  const handleSeekMouseUp = (_: Event | React.SyntheticEvent, newValue: number | number[]) => {
    if (!isControlAllowed || !playerReady || !playerRef.current) return;
    setIsSeeking(false);
    const duration = typeof playerRef.current.getDuration === 'function' ? playerRef.current.getDuration() : 0;
    const timeToSeekTo = (newValue as number) * duration;
    seekVideo(timeToSeekTo);
  };

  const handleSeekMouseDown = () => {
    if (!isControlAllowed) return;
    setIsSeeking(true);
  };

  const handleUrlChangeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isControlAllowed) return;

    const videoId = extractYouTubeVideoId(localUrl) || localUrl.trim();
    if (!videoId) return;
    changeVideo(videoId);
    setLocalUrl('');
  };

  return (
    <Box width="100%" display="flex" flexDirection="column" alignItems="center">
      {/* Main Video Wrapper */}
      <Paper
        elevation={12}
        sx={{
          width: '100%',
          aspectRatio: '16/9',
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 4,
          bgcolor: 'black',
          border: 1,
          borderColor: 'divider',
          '&:hover .video-controls': { opacity: 1 }
        }}
      >
        <Box
          id={containerId}
          sx={{
            position: 'absolute',
            inset: 0,
            '& iframe': { width: '100%', height: '100%' }
          }}
        />

        {/* Player errors */}
        {playerError && (
          <Box position="absolute" top={16} left={16} right={16}>
            <Alert severity="error">{playerError}</Alert>
          </Box>
        )}

        {/* Custom Overlay Controls */}
        <Box
          className="video-controls"
          sx={{
            position: 'absolute',
            bottom: 0,
            left: 0,
            right: 0,
            p: 3,
            background: 'linear-gradient(to top, rgba(0,0,0,0.9), transparent)',
            opacity: isControlAllowed ? 0 : 1,
            transition: 'opacity 0.3s'
          }}
        >
          {/* Seek Bar */}
          {isControlAllowed && (
            <Slider
              size="small"
              min={0}
              max={1}
              step={0.001}
              value={played}
              onChange={handleSeekChange}
              onChangeCommitted={handleSeekMouseUp}
              onMouseDown={handleSeekMouseDown}
              sx={{ color: 'primary.main', py: 1 }}
              disabled={!playerReady}
            />
          )}

          <Box display="flex" alignItems="center" justifyContent="space-between" mt={1}>
            <Box display="flex" alignItems="center" gap={2}>
              {isControlAllowed ? (
                <IconButton
                  onClick={() => (videoState.playState === 'playing' ? emitPause() : emitPlay())}
                  color="inherit"
                  sx={{ '&:hover': { color: 'primary.main' } }}
                  disabled={!playerReady}
                >
                  {videoState.playState === 'playing' ? <Pause fontSize="large" /> : <PlayArrow fontSize="large" />}
                </IconButton>
              ) : (
                <IconButton disabled color="inherit">
                  {videoState.playState === 'playing' ? (
                    <Pause fontSize="large" sx={{ opacity: 0.5 }} />
                  ) : (
                    <PlayArrow fontSize="large" sx={{ opacity: 0.5 }} />
                  )}
                </IconButton>
              )}

              <Typography variant="caption" color="text.secondary">
                {videoState.playState === 'playing' ? 'Live Sync' : 'Paused By Host'}
              </Typography>
            </Box>

            {!isControlAllowed && (
              <Typography
                variant="overline"
                color="primary"
                fontWeight="bold"
                sx={{ bgcolor: 'primary.dark', px: 2, py: 0.5, borderRadius: 2 }}
              >
                Viewing Party Mode
              </Typography>
            )}
          </Box>
        </Box>
      </Paper>

      {/* Video Change UI - Admins Only */}
      {isControlAllowed && (
        <Paper elevation={4} sx={{ width: '100%', maxWidth: 700, p: 2, mt: 4, borderRadius: 3 }}>
          <Box component="form" onSubmit={handleUrlChangeSubmit} display="flex" flexDirection={{ xs: 'column', sm: 'row' }} gap={2}>
            <TextField
              fullWidth
              size="small"
              placeholder="Paste YouTube URL or video ID to change video..."
              value={localUrl}
              onChange={(e) => setLocalUrl(e.target.value)}
              required
            />
            <Button
              type="submit"
              variant="contained"
              color="primary"
              startIcon={<YouTube />}
              sx={{ whiteSpace: 'nowrap', px: 3 }}
            >
              Change Video
            </Button>
          </Box>
        </Paper>
      )}
    </Box>
  );
};
