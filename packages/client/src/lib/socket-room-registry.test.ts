import { describe, expect, it } from 'vitest';
import { SocketRoomRegistry } from './socket-room-registry';

describe('SocketRoomRegistry', () => {
  it('does not place credentials into the Socket.IO send buffer while disconnected', () => {
    const emitted: unknown[] = [];
    const socket = {
      connected: false,
      emit: (_event: string, payload: unknown) => { emitted.push(payload); },
      disconnect: () => undefined,
    };
    const registry = new SocketRoomRegistry(scanId => ({
      scanId,
      token: 'must-not-be-buffered',
    }));

    registry.join(socket, 'scan-pending');

    expect(emitted).toEqual([]);
    expect(registry.roomIds()).toEqual(['scan-pending']);
  });

  it('stores only scan IDs and rebuilds credentials on reconnect', () => {
    let token = 'old-token';
    const emitted: unknown[] = [];
    const registry = new SocketRoomRegistry(scanId => ({ scanId, identityToken: token }));
    const socket = {
      emit: (_event: string, payload: unknown, ack?: (result: { ok: boolean }) => void) => {
        emitted.push(payload);
        ack?.({ ok: true });
      },
      disconnect: () => {},
    };

    registry.join(socket, 'scan-1');
    token = 'new-token';
    registry.rejoin(socket);

    expect(emitted).toEqual([
      { scanId: 'scan-1', identityToken: 'old-token' },
      { scanId: 'scan-1', identityToken: 'new-token' },
    ]);
  });

  it('tracks a room only after authorization succeeds and clears all rooms on sign-out', () => {
    const events: unknown[][] = [];
    let disconnected = false;
    const registry = new SocketRoomRegistry(scanId => ({ scanId }));
    const deniedSocket = {
      emit: (_event: string, _payload: unknown, ack?: (result: { ok: boolean }) => void) => ack?.({ ok: false }),
      disconnect: () => {},
    };
    registry.join(deniedSocket, 'denied');
    expect(registry.roomIds()).toEqual([]);

    const socket = {
      emit: (...args: unknown[]) => {
        events.push(args);
        const ack = args[2] as ((result: { ok: boolean }) => void) | undefined;
        ack?.({ ok: true });
      },
      disconnect: () => { disconnected = true; },
    };
    registry.join(socket, 'allowed');
    registry.clear(socket);

    expect(events).toContainEqual(['scan:leave', 'allowed']);
    expect(registry.roomIds()).toEqual([]);
    expect(disconnected).toBe(true);
  });

  it('ignores a successful join acknowledgement that arrives after clear', () => {
    let acknowledge: ((result: { ok: boolean }) => void) | undefined;
    const socket = {
      emit: (_event: string, _payload: unknown, callback?: (result: { ok: boolean }) => void) => {
        acknowledge = callback;
      },
      disconnect: () => undefined,
    };
    const registry = new SocketRoomRegistry(scanId => ({ scanId }));

    registry.join(socket, 'scan-delayed');
    registry.clear(socket);
    acknowledge?.({ ok: true });

    expect(registry.roomIds()).toEqual([]);
  });
});
