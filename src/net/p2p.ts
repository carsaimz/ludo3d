import { joinRoom, Room } from 'trystero/nostr';
import { Color, PlayerInfo } from '../game/rules';

/**
 * Online P2P layer (WebRTC via Trystero/nostr relays, no game server).
 * The host is authoritative: clients send intents, host applies them on the
 * engine and broadcasts lobby/state/event messages.
 */

export type NetMsg =
  | { t: 'hello'; name: string }
  | { t: 'lobby'; seats: ({ name: string; color: Color; kind: 'human' | 'bot' } | null)[]; hostStartable: boolean }
  | { t: 'start'; players: PlayerInfo[]; you: Color }
  | { t: 'intent'; a: 'roll' | 'move'; token?: number }
  | { t: 'ev'; kind: 'roll'; value: number; turn: number; forfeited?: boolean }
  | { t: 'ev'; kind: 'move'; color: Color; token: number; from: number; to: number; captures: { color: Color; token: number }[] }
  | { t: 'ev'; kind: 'turn'; color: Color; extra: boolean }
  | { t: 'state'; snap: unknown }
  | { t: 'over'; ranks: Color[] };

export interface NetHandlers {
  onPeerJoin: (peerId: string) => void;
  onPeerLeave: (peerId: string) => void;
  onMessage: (msg: NetMsg, peerId: string) => void;
  onSelfLeave?: () => void;
}

const ROOM_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function makeRoomCode(len = 5): string {
  let s = '';
  for (let i = 0; i < len; i++) s += ROOM_ALPHABET[Math.floor(Math.random() * ROOM_ALPHABET.length)];
  return s;
}

export class Net {
  private room: Room | null = null;
  private sendFn: ((data: NetMsg, to?: string) => void) | null = null;
  isHost = false;
  selfId = '';
  handlers: NetHandlers;

  constructor(handlers: NetHandlers) {
    this.handlers = handlers;
  }

  get connected(): boolean {
    return this.room !== null;
  }

  host(roomCode: string): Promise<void> {
    return this.enter(roomCode, true);
  }

  join(roomCode: string): Promise<void> {
    return this.enter(roomCode, false);
  }

  private enter(code: string, asHost: boolean): Promise<void> {
    this.leave();
    this.isHost = asHost;
    const room = joinRoom({ appId: 'com.carsaimz.ludo3d' }, `ludo3d-${code}`);
    this.room = room;
    return new Promise((resolve, reject) => {
      // Trystero's payload constraint needs index signatures; wire messages are plain JSON.
      const [send, onMsg] = room.makeAction<Record<string, any>>('m');
      this.sendFn = send as unknown as (data: NetMsg, to?: string) => void;
      let settled = false;
      const timeout = window.setTimeout(() => {
        if (!settled) {
          settled = true;
          if (!asHost) reject(new Error('timeout'));
        }
      }, 12000);

      room.onPeerJoin((peerId) => {
        if (!settled) {
          settled = true;
          clearTimeout(timeout);
          resolve();
        }
        this.handlers.onPeerJoin(peerId);
      });
      room.onPeerLeave((peerId) => this.handlers.onPeerLeave(peerId));
      onMsg((data, peerId) => {
        if (data && typeof data === 'object' && 't' in data) {
          this.handlers.onMessage(data as unknown as NetMsg, peerId);
        }
      });
      // Host "connects" as soon as the room exists.
      if (asHost) {
        window.setTimeout(() => {
          if (!settled) {
            settled = true;
            clearTimeout(timeout);
            resolve();
          }
        }, 400);
      }
    });
  }

  broadcast(msg: NetMsg): void {
    try {
      this.sendFn?.(msg);
    } catch {
      /* peer gone */
    }
  }

  sendTo(peerId: string, msg: NetMsg): void {
    try {
      this.sendFn?.(msg, peerId);
    } catch {
      /* ignore */
    }
  }

  leave(): void {
    if (this.room) {
      try {
        this.room.leave();
      } catch {
        /* ignore */
      }
      this.room = null;
      this.sendFn = null;
    }
  }
}
