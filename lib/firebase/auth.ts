import { getAuth } from 'firebase/auth';
import { app } from '@/lib/firebase/app';

export const auth = getAuth(app);
