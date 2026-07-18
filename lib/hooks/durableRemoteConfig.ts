import { fetchAndActivate, getRemoteConfig, getValue, isSupported, setCustomSignals } from 'firebase/remote-config';
import { app } from '@/lib/firebase/config';

type RemoteConfigDeps = { isSupported: () => Promise<boolean>; get: () => any; signal: (config: any, values: Record<string, string>) => Promise<void>; activate: (config: any) => Promise<unknown>; value: (config: any) => { asBoolean: () => boolean }; };
const remote: RemoteConfigDeps = { isSupported, get: () => getRemoteConfig(app), signal: setCustomSignals, activate: fetchAndActivate, value: (config) => getValue(config, 'durable_import_enabled') };
export async function readDurableEnabled(userId: string, deps: RemoteConfigDeps = remote) { try { if (!await deps.isSupported()) return false; const config = deps.get(); await deps.signal(config, { seriph_user_id: userId }); await deps.activate(config); return deps.value(config).asBoolean(); } catch { return false; } }

