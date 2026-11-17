import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ludo3d',
  appName: 'LUDO 3D',
  webDir: 'dist',
  android: {
    allowMixedContent: false
  }
};

export default config;
