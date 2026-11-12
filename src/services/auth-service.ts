import { randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import type { Role, User } from '../domain/types.js';
import { ConflictError, UnauthorizedError, ValidationError } from '../errors/index.js';
import type { UserRepository } from '../repositories/interfaces.js';
import { hashPassword, verifyPassword } from './password.js';

export interface AuthConfig {
  readonly jwtSecret: string;
  /** Durée de vie du jeton, en secondes. */
  readonly tokenTtlSeconds: number;
}

export class AuthService {
  constructor(
    private readonly users: UserRepository,
    private readonly config: AuthConfig,
  ) {}

  async register(name: string, password: string, role: Role = 'membre'): Promise<User> {
    if (name.trim() === '' || password.length < 8) {
      throw new ValidationError('Nom requis et mot de passe de 8 caractères minimum');
    }
    if (await this.users.findByName(name)) {
      throw new ConflictError('Ce nom d’utilisateur existe déjà');
    }
    const user: User = { id: randomUUID(), name, role };
    await this.users.save({ ...user, passwordHash: hashPassword(password) });
    return user;
  }

  /** Renvoie un JWT. Même erreur pour un nom inconnu ou un mauvais mot de passe. */
  async login(name: string, password: string): Promise<string> {
    const stored = await this.users.findByName(name);
    if (!stored || !verifyPassword(password, stored.passwordHash)) {
      throw new UnauthorizedError('Identifiants invalides');
    }
    return jwt.sign({ role: stored.role, name: stored.name }, this.config.jwtSecret, {
      subject: stored.id,
      expiresIn: this.config.tokenTtlSeconds,
    });
  }

  async verify(token: string): Promise<User> {
    let subject: string | undefined;
    try {
      subject = jwt.verify(token, this.config.jwtSecret).sub as string | undefined;
    } catch {
      throw new UnauthorizedError('Jeton invalide ou expiré');
    }
    const stored = subject ? await this.users.findById(subject) : undefined;
    if (!stored) throw new UnauthorizedError('Jeton invalide ou expiré');
    return { id: stored.id, name: stored.name, role: stored.role };
  }
}
