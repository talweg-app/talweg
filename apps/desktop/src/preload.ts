import { contextBridge, ipcRenderer } from "electron";
import type { DesktopBridge } from "../../web/src/types/desktop.js";
let invitationListener: ((text: string) => void) | undefined;
const pendingInvitations: string[] = [];
ipcRenderer.on("desktop:invitation", (_event: Electron.IpcRendererEvent, text: string) => {
  if (invitationListener) invitationListener(text);
  else pendingInvitations.push(text);
});
const bridge: DesktopBridge = {
  bootstrap: () => ipcRenderer.invoke("desktop:bootstrap"),
  saveClientState: (values) =>
    ipcRenderer.invoke("desktop:save-preferences", values),
  chooseProjectsDirectory: () => ipcRenderer.invoke("desktop:choose-projects"),
  openProjectsDirectory: () => ipcRenderer.invoke("desktop:open-projects"),
  onInvitation: (callback) => {
    invitationListener = callback;
    for (const text of pendingInvitations.splice(0)) callback(text);
    return () => { invitationListener = undefined; };
  },
  onBeforeClose: (callback) => {
    const listener = () => {
      void callback().then(
        () => ipcRenderer.invoke("desktop:close-ready", null),
        () => ipcRenderer.invoke("desktop:close-ready", "save"),
      );
    };
    ipcRenderer.on("desktop:before-close", listener);
    return () => {
      ipcRenderer.removeListener("desktop:before-close", listener);
    };
  },
};
ipcRenderer.on("desktop:open-settings", () =>
  window.dispatchEvent(new Event("talweg:open-settings")),
);
contextBridge.exposeInMainWorld("talwegDesktop", bridge);
