import { Injectable } from '@nestjs/common';
import argon2, { type HashOptions } from 'argon2';
import { randomBytes } from 'node:crypto';

const ARGON2_OPTIONS: HashOptions = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};

@Injectable()
export class PasswordService {
  private readonly dummyHashPromise: Promise<string>;

  constructor() {
    this.dummyHashPromise = argon2.hash(randomBytes(32).toString('hex'), ARGON2_OPTIONS);
  }

  async hash(password: string): Promise<string> {
    return argon2.hash(password, ARGON2_OPTIONS);
  }

  async verify(password: string, passwordHash: string): Promise<boolean> {
    try {
      return await argon2.verify(passwordHash, password);
    } catch {
      return false;
    }
  }

  async verifyOrDummy(password: string, passwordHash: string | null): Promise<boolean> {
    const hash = passwordHash ?? (await this.dummyHashPromise);
    const valid = await this.verify(password, hash);
    return passwordHash ? valid : false;
  }
}
