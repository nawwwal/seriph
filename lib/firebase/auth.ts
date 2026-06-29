import { getAuth } from 'firebase/auth';
import { app } from '@/lib/firebase/config';

export const auth = getAuth(app);
