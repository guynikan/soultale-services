import { readFileSync } from 'fs';
import { resolve } from 'path';
import { Provider } from '@nestjs/common';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export const FIREBASE_AUTH = 'FIREBASE_AUTH';

function loadServiceAccountJson(): string | null {
  const inline = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  if (inline) return inline;

  const filePath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH?.trim();
  if (!filePath) return null;

  const absolute = resolve(process.cwd(), filePath);
  return readFileSync(absolute, 'utf8');
}

export const FirebaseAdminProvider: Provider = {
  provide: FIREBASE_AUTH,
  useFactory: () => {
    if (process.env.NODE_ENV === 'test') {
      return {
        verifyIdToken: async () => {
          throw new Error('Invalid token');
        },
      };
    }

    let serviceAccountJson: string | null = null;
    try {
      serviceAccountJson = loadServiceAccountJson();
    } catch {
      serviceAccountJson = null;
    }

    if (!serviceAccountJson) {
      return {
        verifyIdToken: async () => {
          throw new Error(
            'Firebase Admin: set FIREBASE_SERVICE_ACCOUNT_JSON or FIREBASE_SERVICE_ACCOUNT_PATH',
          );
        },
      };
    }

    const parsed = JSON.parse(serviceAccountJson) as {
      project_id: string;
      client_email: string;
      private_key: string;
    };

    const app = getApps()[0] ?? initializeApp({
      credential: cert({
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
        privateKey: parsed.private_key.replace(/\\n/g, '\n'),
      }),
    });

    return getAuth(app);
  },
};
