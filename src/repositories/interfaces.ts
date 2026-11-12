import type { Booking, Room, User, WaitlistEntry } from '../domain/types.js';

export interface RoomRepository {
  findAll(): Promise<Room[]>;
  findById(id: string): Promise<Room | undefined>;
  save(room: Room): Promise<void>;
  /** Renvoie false si la salle n'existe pas. */
  delete(id: string): Promise<boolean>;
}

export interface BookingRepository {
  findByRoom(roomId: string): Promise<Booking[]>;
  findByOwner(ownerId: string): Promise<Booking[]>;
  findById(id: string): Promise<Booking | undefined>;
  save(booking: Booking): Promise<void>;
  /** Renvoie false si la réservation n'existe pas. */
  delete(id: string): Promise<boolean>;
}

export interface WaitlistRepository {
  /** Dans l'ordre d'insertion. */
  findByRoom(roomId: string): Promise<WaitlistEntry[]>;
  findByOwner(ownerId: string): Promise<WaitlistEntry[]>;
  findById(id: string): Promise<WaitlistEntry | undefined>;
  save(entry: WaitlistEntry): Promise<void>;
  /** Renvoie false si l'entrée n'existe pas. */
  delete(id: string): Promise<boolean>;
}

/** Utilisateur avec son mot de passe haché (jamais renvoyé par l'API). */
export interface StoredUser extends User {
  readonly passwordHash: string;
}

export interface UserRepository {
  findByName(name: string): Promise<StoredUser | undefined>;
  findById(id: string): Promise<StoredUser | undefined>;
  save(user: StoredUser): Promise<void>;
}
