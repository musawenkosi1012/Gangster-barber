import { Clerk } from '@clerk/nextjs/server';

declare global {
  interface CustomJwtSessionClaims {
    metadata: {
      role?: 'admin' | 'barber' | 'barber_admin' | 'it_admin' | 'owner' | 'customer';
    };
  }
}

export {};
