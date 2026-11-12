import { z } from 'zod';

const isoDate = z.iso.datetime({ offset: true }).transform((s) => new Date(s));

// F3 : toutes les entrées ont une borne de taille (et de nombre pour les listes).
export const credentialsSchema = z.object({
  name: z.string().trim().min(1).max(64),
  password: z.string().min(8).max(128),
});

export const roomBodySchema = z.object({
  name: z.string().trim().min(1).max(100),
  capacity: z.number().int().min(1),
  equipment: z.array(z.string().max(50)).max(20).optional(),
});

export const idParamsSchema = z.object({ id: z.string().min(1) });

export const availabilityQuerySchema = z
  .object({
    start: isoDate,
    end: isoDate,
    minCapacity: z.coerce.number().int().min(1).default(1),
  })
  .refine((q) => q.start < q.end, { message: 'start doit précéder end', path: ['end'] });

export const bookingBodySchema = z
  .object({
    roomId: z.string().min(1),
    start: isoDate,
    end: isoDate,
    subject: z.string().trim().min(1).max(200),
  })
  .refine((b) => b.start < b.end, { message: 'start doit précéder end', path: ['end'] });

export type Credentials = z.infer<typeof credentialsSchema>;
export type RoomBody = z.infer<typeof roomBodySchema>;
export type IdParams = z.infer<typeof idParamsSchema>;
export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;
export type BookingBody = z.infer<typeof bookingBodySchema>;
