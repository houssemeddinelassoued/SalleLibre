import express, { type Express } from 'express';
import { InMemoryBookingRepository, InMemoryRoomRepository, InMemoryUserRepository } from './repositories/in-memory.js';
import { buildDocsRouter } from './http/docs.js';
import { errorHandler } from './http/middlewares/index.js';
import { buildRouter, type Services } from './http/routes/index.js';
import { AuthService, type AuthConfig } from './services/auth-service.js';
import { BookingService } from './services/booking-service.js';
import { RoomService } from './services/room-service.js';

/** Assemble les dépendances (stockage en mémoire). `now` sert aux tests. */
export function buildServices(config: AuthConfig, now?: () => Date): Services {
  const users = new InMemoryUserRepository();
  const rooms = new InMemoryRoomRepository();
  const bookings = new InMemoryBookingRepository();
  return {
    auth: new AuthService(users, config),
    rooms: new RoomService(rooms, bookings),
    bookings: new BookingService(rooms, bookings, now),
  };
}

export function createApp(services: Services): Express {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json());
  app.use(buildDocsRouter());
  app.use('/api', buildRouter(services));
  app.use((_req, res) => {
    res.status(404).json({ message: 'Route introuvable' });
  });
  app.use(errorHandler);
  return app;
}
