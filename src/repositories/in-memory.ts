import type { Booking, Room, WaitlistEntry } from '../domain/types.js';
import type {
  BookingRepository,
  RoomRepository,
  StoredUser,
  UserRepository,
  WaitlistRepository,
} from './interfaces.js';

export class InMemoryRoomRepository implements RoomRepository {
  private readonly rooms = new Map<string, Room>();

  async findAll(): Promise<Room[]> {
    return [...this.rooms.values()];
  }

  async findById(id: string): Promise<Room | undefined> {
    return this.rooms.get(id);
  }

  async save(room: Room): Promise<void> {
    this.rooms.set(room.id, room);
  }

  async delete(id: string): Promise<boolean> {
    return this.rooms.delete(id);
  }
}

export class InMemoryBookingRepository implements BookingRepository {
  private readonly bookings = new Map<string, Booking>();

  async findByRoom(roomId: string): Promise<Booking[]> {
    return [...this.bookings.values()].filter((b) => b.roomId === roomId);
  }

  async findByOwner(ownerId: string): Promise<Booking[]> {
    return [...this.bookings.values()].filter((b) => b.ownerId === ownerId);
  }

  async findById(id: string): Promise<Booking | undefined> {
    return this.bookings.get(id);
  }

  async save(booking: Booking): Promise<void> {
    this.bookings.set(booking.id, booking);
  }

  async delete(id: string): Promise<boolean> {
    return this.bookings.delete(id);
  }
}

export class InMemoryWaitlistRepository implements WaitlistRepository {
  private readonly entries = new Map<string, WaitlistEntry>();

  async findByRoom(roomId: string): Promise<WaitlistEntry[]> {
    return [...this.entries.values()].filter((e) => e.roomId === roomId);
  }

  async findByOwner(ownerId: string): Promise<WaitlistEntry[]> {
    return [...this.entries.values()].filter((e) => e.ownerId === ownerId);
  }

  async findById(id: string): Promise<WaitlistEntry | undefined> {
    return this.entries.get(id);
  }

  async save(entry: WaitlistEntry): Promise<void> {
    this.entries.set(entry.id, entry);
  }

  async delete(id: string): Promise<boolean> {
    return this.entries.delete(id);
  }
}

export class InMemoryUserRepository implements UserRepository {
  private readonly users = new Map<string, StoredUser>();

  async findByName(name: string): Promise<StoredUser | undefined> {
    return [...this.users.values()].find((u) => u.name === name);
  }

  async findById(id: string): Promise<StoredUser | undefined> {
    return this.users.get(id);
  }

  async save(user: StoredUser): Promise<void> {
    this.users.set(user.id, user);
  }
}
