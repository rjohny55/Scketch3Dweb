export {};

type Scketch3DwebDesktopUpdateResult = {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  downloaded: boolean;
  checkedAt: string;
  error?: string;
};

declare global {
  interface Window {
    scketch3dwebDesktop?: {
      getVersion: () => Promise<string>;
      checkForUpdates: () => Promise<Scketch3DwebDesktopUpdateResult>;
      installUpdate: () => Promise<Scketch3DwebDesktopUpdateResult>;
    };
  }
}
