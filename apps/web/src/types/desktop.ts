export interface DesktopInfo {
  platform: string;
  version: string;
  projectsDirectory: string;
  nextProjectsDirectory: string;
}
export interface DesktopBootstrap {
  info: DesktopInfo;
  clientState: Record<string, string>;
  invitation?: string;
}
export interface DesktopBridge {
  bootstrap: () => Promise<DesktopBootstrap>;
  saveClientState: (values: Record<string, string>) => Promise<void>;
  chooseProjectsDirectory: () => Promise<DesktopInfo | null>;
  openProjectsDirectory: () => Promise<void>;
  onBeforeClose: (callback: () => Promise<void>) => () => void;
  onInvitation: (callback: (text: string) => void) => () => void;
}
declare global {
  interface Window {
    talwegDesktop?: DesktopBridge;
    talwegDesktopInfo?: DesktopInfo;
  }
}
