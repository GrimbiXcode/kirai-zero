import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "ch.kiraizero.app",
  appName: "kirai-zero",
  webDir: "dist",
  // The built assets are bundled into the app; nothing is loaded from a remote
  // server at runtime. `server.url` is intentionally not set.
  server: {
    androidScheme: "https",
  },
};

export default config;
