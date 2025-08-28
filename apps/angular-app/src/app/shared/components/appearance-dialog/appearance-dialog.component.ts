// apps/angular-app/src/app/shared/components/appearance-dialog/appearance-dialog.component.ts
import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NgbActiveModal } from '@ng-bootstrap/ng-bootstrap';
import { Subject, takeUntil } from 'rxjs';
import { ThemeService, AppearanceSettings, Theme } from '../../../core/services/theme.service';

// Add proper typing for the options
interface FontWeightOption {
  value: 'light' | 'normal' | 'medium' | 'semibold';
  label: string;
}

interface MessageStyleOption {
  value: 'block' | 'bubble';
  label: string;
}

@Component({
  selector: 'app-appearance-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './appearance-dialog.component.html',
  styleUrl: './appearance-dialog.component.scss'
})
export class AppearanceDialogComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  
  settings: AppearanceSettings = {
    theme: 'dark',
    fontSize: 14,
    fontWeight: 'normal',
    messageStyle: 'block',
    compactMode: false
  };

  themes: Theme[] = [];
  
  // Properly typed arrays
  fontWeights: FontWeightOption[] = [
    { value: 'light', label: 'Light' },
    { value: 'normal', label: 'Normal' },
    { value: 'medium', label: 'Medium' },
    { value: 'semibold', label: 'Semibold' }
  ] as const;

  messageStyles: MessageStyleOption[] = [
    { value: 'block', label: 'Block' },
    { value: 'bubble', label: 'Bubble' }
  ] as const;

  constructor(
    public activeModal: NgbActiveModal,
    private themeService: ThemeService
  ) {
    this.themes = this.themeService.themes;
  }

  ngOnInit(): void {
    this.themeService.appearanceSettings$
      .pipe(takeUntil(this.destroy$))
      .subscribe(settings => {
        this.settings = { ...settings };
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  onThemeChange(): void {
    this.themeService.setTheme(this.settings.theme);
  }

  onFontSizeChange(): void {
    this.themeService.updateAppearanceSettings({ fontSize: this.settings.fontSize });
  }

  onFontWeightChange(): void {
    this.themeService.updateAppearanceSettings({ fontWeight: this.settings.fontWeight });
  }

  onMessageStyleChange(): void {
    this.themeService.updateAppearanceSettings({ messageStyle: this.settings.messageStyle });
  }

  onCompactModeChange(): void {
    this.themeService.updateAppearanceSettings({ compactMode: this.settings.compactMode });
  }

  // Method to handle font weight button clicks with proper typing
  setFontWeight(weight: 'light' | 'normal' | 'medium' | 'semibold'): void {
    this.settings.fontWeight = weight;
    this.onFontWeightChange();
  }

  // Method to handle message style button clicks with proper typing
  setMessageStyle(style: 'block' | 'bubble'): void {
    this.settings.messageStyle = style;
    this.onMessageStyleChange();
  }

  resetToDefaults(): void {
    const defaults: AppearanceSettings = {
      theme: 'dark',
      fontSize: 14,
      fontWeight: 'normal',
      messageStyle: 'block',
      compactMode: false
    };
    this.settings = { ...defaults };
    this.themeService.updateAppearanceSettings(defaults);
  }

  close(): void {
    this.activeModal.close();
  }
}
