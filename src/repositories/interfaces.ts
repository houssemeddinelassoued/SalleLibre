import type { Booking, Room, User } from '../domain/types.js';

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

/** Utilisateur avec son mot de passe haché (jamais renvoyé par l'API). */
export interface StoredUser extends User {
  readonly passwordHash: string;
}

export interface UserRepository {
  findByName(name: string): Promise<StoredUser | undefined>;
  findById(id: string): Promise<StoredUser | undefined>;
  save(user: StoredUser): Promise<void>;
}
