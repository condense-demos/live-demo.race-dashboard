'use client';

import { useEffect, useState } from 'react';
import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useRaceSocket } from '../lib/useRaceSocket';

const LANE_COLORS = ['#f97316', '#22d3ee', '#a78bfa', '#4ade80', '#f472b6', '#facc15', '#60a5fa', '#fb7185'];
// Purely a visual scale for the track — how far a vehicle can travel across
// the lane before it's considered "at the finish line" on screen.
const TRACK_MAX_DISTANCE = 1000;

function displayName(entity) {
  return entity.player_name || entity.session_id.slice(0, 8);
}

function useCountdown(status, endsAt) {
  const [seconds, setSeconds] = useState(null);
  useEffect(() => {
    if (status !== 'running' || !endsAt) {
      setSeconds(null);
      return undefined;
    }
    const tick = () => setSeconds(Math.max(0, Math.round((new Date(endsAt).getTime() - Date.now()) / 1000)));
    tick();
    const id = setInterval(tick, 250);
    return () => clearInterval(id);
  }, [status, endsAt]);
  return seconds;
}

export default function DashboardPage() {
  const { vehicles, leaderboard, connection } = useRaceSocket();

  const status = leaderboard?.race_status || 'idle';
  const rankings = leaderboard?.rankings || [];
  const countdown = useCountdown(status, leaderboard?.race_ends_at);
  const winner = status === 'ended' ? rankings[0] : null;

  const lanes = Object.values(vehicles).sort((a, b) => (a.session_id > b.session_id ? 1 : -1));

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8 flex flex-col gap-8">
      <header className="flex items-start justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Live Race</h1>
        <div className="text-right">
          {status === 'idle' && <p className="text-xl text-slate-400">Scan the QR code to start racing</p>}
          {status === 'running' && <p className="text-5xl font-mono tabular-nums">{countdown}s</p>}
          {status === 'ended' && (
            <p className="text-2xl font-bold text-amber-400">
              Race over — winner: {winner ? displayName(winner) : '—'}
            </p>
          )}
          <p className="mt-1 text-xs text-slate-600">
            {connection === 'open' ? 'live' : connection === 'polling' ? 'reconnecting (polling)' : 'connecting…'}
          </p>
        </div>
      </header>

      <section className="flex flex-col gap-3">
        {lanes.length === 0 && (
          <p className="text-sm text-slate-600">No active racers yet — scan the QR code to join.</p>
        )}
        {lanes.map((vehicle, i) => {
          const pct = Math.min(100, (vehicle.distance / TRACK_MAX_DISTANCE) * 100);
          return (
            <div key={vehicle.session_id} className="flex items-center gap-3">
              <span className="w-28 shrink-0 truncate text-sm text-slate-400">{displayName(vehicle)}</span>
              <div className="relative h-8 flex-1 overflow-hidden rounded-full bg-slate-800">
                <div className="absolute inset-y-0 left-0 bg-slate-700/60" style={{ width: `${pct}%` }} />
                <div
                  className="absolute top-1/2 -translate-y-1/2 text-2xl transition-all duration-200 ease-linear"
                  style={{ left: `calc(${pct}% - 16px)`, color: LANE_COLORS[i % LANE_COLORS.length] }}
                >
                  🏎️
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="h-64">
        <h2 className="mb-2 text-lg font-semibold">Leaderboard</h2>
        {rankings.length === 0 ? (
          <p className="text-sm text-slate-600">No results yet this race.</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              layout="vertical"
              data={rankings.map((r) => ({ name: displayName(r), distance: r.distance }))}
              margin={{ left: 24 }}
            >
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="name" width={120} stroke="#94a3b8" />
              <Tooltip
                contentStyle={{ background: '#1e293b', border: 'none', borderRadius: 8 }}
                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
              />
              <Bar dataKey="distance" radius={[0, 8, 8, 0]}>
                {rankings.map((_, i) => (
                  <Cell key={i} fill={LANE_COLORS[i % LANE_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>
    </main>
  );
}
