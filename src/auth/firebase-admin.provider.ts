import { Provider } from '@nestjs/common';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export const FIREBASE_AUTH = 'FIREBASE_AUTH';

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

    const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

    if (!serviceAccountJson) {
      throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON is required');
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
