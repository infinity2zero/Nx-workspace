// apps/angular-app/src/app/services/electron.service.ts

import { Injectable } from '@angular/core';

declare global {
  interface Window {
    electronAPI: {
      platform: string;
      minimizeWindow: () => void;
      maximizeWindow: () => void;
      unmaximizeWindow: () => void;
      closeWindow: () => void;
      onWindowMaximized: (callback: () => void) => void;
      onWindowUnmaximized: (callback: () => void) => void;
    };
  }
}

@Injectable({
  providedIn: 'root'
})
export class ElectronService {
  get isElectron(): boolean {
    return !!(window && window.electronAPI);
  }

  get platform(): string {
    return this.isElectron ? window.electronAPI.platform : 'web';
  }

  minimizeWindow() {
    if (this.isElectron) {
      window.electronAPI.minimizeWindow();
    }
  }

  maximizeWindow() {
    if (this.isElectron) {
      window.electronAPI.maximizeWindow();
    }
  }

  unmaximizeWindow() {
    if (this.isElectron) {
      window.electronAPI.unmaximizeWindow();
    }
  }

  closeWindow() {
    if (this.isElectron) {
      window.electronAPI.closeWindow();
    }
  }

  onWindowMaximized(callback: () => void) {
    if (this.isElectron) {
      window.electronAPI.onWindowMaximized(callback);
    }
  }

  onWindowUnmaximized(callback: () => void) {
    if (this.isElectron) {
      window.electronAPI.onWindowUnmaximized(callback);
    }
  }
}
