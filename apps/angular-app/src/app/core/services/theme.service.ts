// apps/angular-app/src/app/core/services/theme.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

export interface Theme {
  name: string;
  displayName: string;
  colors: {
    primary: string;
    secondary: string;
    background: string;
    surface: string;
    text: string;
    textSecondary: string;
    border: string;
    accent: string;
    success: string;
    warning: string;
    danger: string;
    info: string;
  }
}

export interface AppearanceSettings {
  theme: string;
  fontSize: number;
  fontWeight: 'light' | 'normal' | 'medium' | 'semibold';
  messageStyle: 'block' | 'bubble';
  compactMode: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private currentThemeSubject = new BehaviorSubject<string>('dark');
  private appearanceSettingsSubject = new BehaviorSubject<AppearanceSettings>({
    theme: 'dark',
    fontSize: 14,
    fontWeight: 'normal',
    messageStyle: 'block',
    compactMode: false
  });

  currentTheme$ = this.currentThemeSubject.asObservable();
  appearanceSettings$ = this.appearanceSettingsSubject.asObservable();

  readonly themes: Theme[] = [
    {
      name: 'dark',
      displayName: 'Dark',
      colors: {
        primary: '#0d6efd',
        secondary: '#6c757d',
        background: '#1e1e1e',
        surface: '#2d2d2d',
        text: '#ffffff',
        textSecondary: '#cccccc',
        border: '#404040',
        accent: '#0d6efd',
        success: '#198754',
        warning: '#ffc107',
        danger: '#dc3545',
        info: '#0dcaf0'
      }
    },
    {
      name: 'light',
      displayName: 'Light',
      colors: {
        primary: '#0d6efd',
        secondary: '#6c757d',
        background: '#ffffff',
        surface: '#f8f9fa',
        text: '#212529',
        textSecondary: '#6c757d',
        border: '#dee2e6',
        accent: '#0d6efd',
        success: '#198754',
        warning: '#ffc107',
        danger: '#dc3545',
        info: '#0dcaf0'
      }
    },
    {
      name: 'blue',
      displayName: 'Blue Dark',
      colors: {
        primary: '#4dabf7',
        secondary: '#6c757d',
        background: '#0c1821',
        surface: '#1a2b3d',
        text: '#e3f2fd',
        textSecondary: '#b3d9ff',
        border: '#2d4a66',
        accent: '#4dabf7',
        success: '#51cf66',
        warning: '#ffd43b',
        danger: '#ff6b6b',
        info: '#74c0fc'
      }
    },
    {
      name: 'purple',
      displayName: 'Purple Dark',
      colors: {
        primary: '#9775fa',
        secondary: '#6c757d',
        background: '#1a1625',
        surface: '#2b213a',
        text: '#f3f0ff',
        textSecondary: '#d0bfff',
        border: '#453559',
        accent: '#9775fa',
        success: '#51cf66',
        warning: '#ffd43b',
        danger: '#ff6b6b',
        info: '#74c0fc'
      }
    }
  ];

  constructor() {
    this.loadSettings();
    this.applyTheme(this.currentThemeSubject.value);
  }

  setTheme(themeName: string): void {
    const theme = this.themes.find(t => t.name === themeName);
    if (theme) {
      this.currentThemeSubject.next(themeName);
      this.applyTheme(themeName);
      this.updateAppearanceSettings({ theme: themeName });
    }
  }

  updateAppearanceSettings(settings: Partial<AppearanceSettings>): void {
    const currentSettings = this.appearanceSettingsSubject.value;
    const newSettings = { ...currentSettings, ...settings };
    this.appearanceSettingsSubject.next(newSettings);
    this.saveSettings(newSettings);
    this.applyAppearanceSettings(newSettings);
  }

  private applyTheme(themeName: string): void {
    const theme = this.themes.find(t => t.name === themeName);
    if (!theme) return;

    const root = document.documentElement;
    Object.entries(theme.colors).forEach(([key, value]) => {
      root.style.setProperty(`--app-${key}`, value);
    });

    // Update Bootstrap variables
    root.style.setProperty('--bs-primary', theme.colors.primary);
    root.style.setProperty('--bs-secondary', theme.colors.secondary);
    root.style.setProperty('--bs-success', theme.colors.success);
    root.style.setProperty('--bs-warning', theme.colors.warning);
    root.style.setProperty('--bs-danger', theme.colors.danger);
    root.style.setProperty('--bs-info', theme.colors.info);
    root.style.setProperty('--bs-body-bg', theme.colors.background);
    root.style.setProperty('--bs-body-color', theme.colors.text);
  }

  private applyAppearanceSettings(settings: AppearanceSettings): void {
    const root = document.documentElement;
    root.style.setProperty('--app-font-size', `${settings.fontSize}px`);
    root.style.setProperty('--app-font-weight', this.getFontWeightValue(settings.fontWeight));
    root.classList.toggle('compact-mode', settings.compactMode);
  }

  private getFontWeightValue(weight: string): string {
    const weights = {
      light: '300',
      normal: '400',
      medium: '500',
      semibold: '600'
    };
    return weights[weight as keyof typeof weights] || '400';
  }

  private saveSettings(settings: AppearanceSettings): void {
    localStorage.setItem('appearance-settings', JSON.stringify(settings));
  }

  private loadSettings(): void {
    const saved = localStorage.getItem('appearance-settings');
    if (saved) {
      try {
        const settings = JSON.parse(saved);
        this.appearanceSettingsSubject.next(settings);
        this.currentThemeSubject.next(settings.theme);
      } catch (e) {
        console.warn('Failed to load appearance settings');
      }
    }
  }
}
