import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { app } from '@/lib/firebase/config';

export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

