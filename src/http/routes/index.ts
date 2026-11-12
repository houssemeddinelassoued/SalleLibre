import { Router } from 'express';
import { TooManyRequestsError, UnauthorizedError } from '../../errors/index.js';
import type { AuthService } from '../../services/auth-service.js';
import type { BookingService } from '../../services/booking-service.js';
import type { RoomService } from '../../services/room-service.js';
import { FailureLimiter } from '../login-limiter.js';
import { authenticate, currentUser, requireRole, validate } from '../middlewares/index.js';
import {
  availabilityQuerySchema,
  bookingBodySchema,
  credentialsSchema,
  idParamsSchema,
  recurringBookingSchema,
  roomBodySchema,
  type AvailabilityQuery,
  type BookingBody,
  type Credentials,
  type IdParams,
  type RecurringBookingBody,
  type RoomBody,
} from '../schemas/index.js';

export interface Services {
  readonly auth: AuthService;
  readonly rooms: RoomService;
  readonly bookings: BookingService;
}

export function buildRouter({ auth, rooms, bookings }: Services): Router {
  const router = Router();

  // Publiques. L'inscription crée toujours un membre, jamais un admin.
  router.post('/auth/register', validate('body', credentialsSchema), async (_req, res) => {
    const { name, password } = res.locals.body as Credentials;
    res.status(201).json(await auth.register(name, password, 'membre'));
  });

  // F2 : après 5 échecs pour un même couple IP + nom, 429 pendant 15 minutes.
  const limiter = new FailureLimiter({ maxFailures: 5, windowMs: 15 * 60 * 1000 });

  router.post('/auth/login', validate('body', credentialsSchema), async (req, res) => {
    const { name, password } = res.locals.body as Credentials;
    const key = `${req.ip}|${name}`;
    if (limiter.isBlocked(key)) throw new TooManyRequestsError();
    try {
      const token = await auth.login(name, password);
      limiter.reset(key);
      res.json({ token });
    } catch (err) {
      if (err instanceof UnauthorizedError) limiter.recordFailure(key);
      throw err;
    }
  });

  // Tout le reste exige un jeton.
  router.use(authenticate(auth));

  router.get('/rooms', async (_req, res) => {
    res.json(await rooms.list());
  });

  router.get('/rooms/available', validate('query', availabilityQuerySchema), async (_req, res) => {
    const { start, end, minCapacity } = res.locals.query as AvailabilityQuery;
    res.json(await rooms.findAvailable({ start, end }, minCapacity));
  });

  router.post('/rooms', requireRole('admin'), validate('body', roomBodySchema), async (_req, res) => {
    res.status(201).json(await rooms.create(currentUser(res), res.locals.body as RoomBody));
  });

  router.put(
    '/rooms/:id',
    requireRole('admin'),
    validate('params', idParamsSchema),
    validate('body', roomBodySchema),
    async (_req, res) => {
      const { id } = res.locals.params as IdParams;
      res.json(await rooms.update(currentUser(res), id, res.locals.body as RoomBody));
    },
  );

  router.delete(
    '/rooms/:id',
    requireRole('admin'),
    validate('params', idParamsSchema),
    async (_req, res) => {
      const { id } = res.locals.params as IdParams;
      await rooms.remove(currentUser(res), id);
      res.status(204).end();
    },
  );

  router.post('/bookings', validate('body', bookingBodySchema), async (_req, res) => {
    const { roomId, start, end, subject } = res.locals.body as BookingBody;
    res.status(201).json(await bookings.book(currentUser(res), roomId, { start, end }, subject));
  });

  router.post('/bookings/recurring', validate('body', recurringBookingSchema), async (_req, res) => {
    const body = res.locals.body as RecurringBookingBody;
    const created = await bookings.bookWeekly(
      currentUser(res),
      body.roomId,
      { start: body.start, end: body.end },
      body.untilDay,
      body.exceptions,
      body.subject,
    );
    res.status(201).json(created);
  });

  router.get('/bookings/mine', async (_req, res) => {
    res.json(await bookings.listMine(currentUser(res)));
  });

  router.delete('/bookings/:id', validate('params', idParamsSchema), async (_req, res) => {
    const { id } = res.locals.params as IdParams;
    await bookings.cancel(currentUser(res), id);
    res.status(204).end();
  });

  return router;
}
