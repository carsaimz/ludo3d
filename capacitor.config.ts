import type { CapacitorConfig } from '@capacitor/cli';

/**
 * LUDO 3D - Capacitor configuration
 *
 * Beta build: no release keystore is configured yet, so the Android app uses
 * the beta application id and is signed with the debug keystore produced by
 * the CI pipeline (installable, auto-updates disabled).
 *
 * When a release keystore is added later (see README > "Release signing"),
 * switch appId to 'com.ludo3d' and appName to 'LUDO 3D'.
 */
const config: CapacitorConfig = {
  appId: 'com.carsaimz.ludo3d.beta',
  appName: 'LUDO 3D Beta',
  webDir: 'dist',
  android: {
    allowMixedContent: false,
    backgroundColor: '#0b1524'
  }
};

export default config;
