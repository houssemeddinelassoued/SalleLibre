import type { Slot } from '../domain/types.js';
import { ValidationError } from '../errors/index.js';

/** Règle commune aux services : un créneau [début, fin[ doit finir après son début. */
export function assertSlotOrder(slot: Slot): void {
  if (slot.start >= slot.end) throw new ValidationError('Le début doit précéder la fin');
}
