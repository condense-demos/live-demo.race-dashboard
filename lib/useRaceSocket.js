'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const WS_URL = process.env.NEXT_PUBLIC_RELAY_WEBSOCKET_URL;
// The relay-service exposes its HTTP fallback endpoints (/leaderboard,
// /state) on the same host/port as the WebSocket — see PROTOCOL.md in
// race-backend.
const HTTP_URL = WS_URL ? WS_URL.replace(/^ws/, 'http') : null;

const POLL_MS = 1000;
const MAX_RECONNECT_DELAY_MS = 10000;
const RETRIES_BEFORE_POLLING = 3;

/**
 * Connects to relay-service over WebSocket, falls back to HTTP polling of
 * /leaderboard + /state after a few failed reconnect attempts (booth WiFi is
 * not reliable), and switches back to WebSocket transparently once it
 * reconnects.
 */
export function useRaceSocket() {
  const [vehicles, setVehicles] = useState({}); // session_id -> vehicle.state payload
  const [leaderboard, setLeaderboard] = useState(null);
  const [connection, setConnection] = useState('connecting'); // connecting | open | polling

  const retriesRef = useRef(0);
  const pollTimerRef = useRef(null);
  const wsRef = useRef(null);
  const stoppedRef = useRef(false);

  const applyVehicleState = useCallback((payload) => {
    setVehicles((prev) => ({ ...prev, [payload.session_id]: payload }));
  }, []);

  const applyLeaderboard = useCallback((payload) => {
    setLeaderboard(payload);
    if (payload?.race_status === 'idle') setVehicles({});
  }, []);

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const startPolling = useCallback(() => {
    if (pollTimerRef.current || !HTTP_URL) return;
    setConnection('polling');
    pollTimerRef.current = setInterval(async () => {
      try {
        const [lbRes, stateRes] = await Promise.all([
          fetch(`${HTTP_URL}/leaderboard`),
          fetch(`${HTTP_URL}/state`),
        ]);
        if (lbRes.ok) applyLeaderboard(await lbRes.json());
        if (stateRes.ok) {
          const states = await stateRes.json();
          setVehicles(Object.fromEntries(states.map((s) => [s.session_id, s])));
        }
      } catch {
        // Stay quiet and keep polling — this is the degraded path already.
      }
    }, POLL_MS);
  }, [applyLeaderboard]);

  useEffect(() => {
    if (!WS_URL) {
      console.warn('NEXT_PUBLIC_RELAY_WEBSOCKET_URL is not set — falling back to polling');
      startPolling();
      return () => stopPolling();
    }

    stoppedRef.current = false;

    const connect = () => {
      if (stoppedRef.current) return;
      const ws = new WebSocket(WS_URL);
      wsRef.current = ws;

      ws.onopen = () => {
        retriesRef.current = 0;
        stopPolling();
        setConnection('open');
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'vehicle_state') applyVehicleState(msg.payload);
          else if (msg.type === 'leaderboard') applyLeaderboard(msg.payload);
          else if (msg.type === 'sync') {
            setVehicles(Object.fromEntries((msg.payload.vehicles || []).map((s) => [s.session_id, s])));
            if (msg.payload.leaderboard) applyLeaderboard(msg.payload.leaderboard);
          }
        } catch {
          // ignore malformed frames
        }
      };

      ws.onclose = () => {
        if (stoppedRef.current) return;
        setConnection('connecting');
        const delay = Math.min(1000 * 2 ** retriesRef.current, MAX_RECONNECT_DELAY_MS);
        retriesRef.current += 1;
        if (retriesRef.current >= RETRIES_BEFORE_POLLING) startPolling();
        setTimeout(connect, delay);
      };

      ws.onerror = () => ws.close();
    };

    connect();

    return () => {
      stoppedRef.current = true;
      wsRef.current?.close();
      stopPolling();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { vehicles, leaderboard, connection };
}
