interface JoinResult {
  ok: boolean;
}

interface SocketAdapter {
  connected?: boolean;
  emit(event: string, payload: unknown, acknowledge?: (result: JoinResult) => void): unknown;
  disconnect(): unknown;
}

type JoinPayloadFactory = (scanId: string) => Record<string, string>;

export class SocketRoomRegistry {
  private readonly rooms = new Set<string>();
  private generation = 0;

  constructor(private readonly payloadForScan: JoinPayloadFactory) {}

  join(socket: SocketAdapter, scanId: string): void {
    if (socket.connected === false) {
      this.rooms.add(scanId);
      return;
    }
    const generation = this.generation;
    socket.emit('scan:join', this.payloadForScan(scanId), result => {
      if (generation === this.generation && result.ok) this.rooms.add(scanId);
    });
  }

  leave(socket: SocketAdapter, scanId: string): void {
    this.rooms.delete(scanId);
    socket.emit('scan:leave', scanId);
  }

  rejoin(socket: SocketAdapter): void {
    const generation = this.generation;
    for (const scanId of this.rooms) {
      socket.emit('scan:join', this.payloadForScan(scanId), result => {
        if (generation === this.generation && !result.ok) this.rooms.delete(scanId);
      });
    }
  }

  clear(socket: SocketAdapter): void {
    this.generation += 1;
    for (const scanId of this.rooms) socket.emit('scan:leave', scanId);
    this.rooms.clear();
    socket.disconnect();
  }

  roomIds(): string[] {
    return [...this.rooms];
  }
}
