// apps/angular-app/src/app/shared/components/appearance-popover/appearance-popover.component.ts
import { Component, OnInit, OnDestroy, ElementRef, Input, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subject, takeUntil } from 'rxjs';
import { ThemeService, AppearanceSettings, Theme } from '../../../core/services/theme.service';

interface FontWeightOption {
  value: 'light' | 'normal' | 'medium' | 'semibold';
  label: string;
}

interface MessageStyleOption {
  value: 'block' | 'bubble';
  label: string;
}

@Component({
  selector: 'app-appearance-popover',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './appearance-popover.component.html',
  styleUrl: './appearance-popover.component.scss'
})
export class AppearancePopoverComponent implements OnInit, OnDestroy {
  @Input() onClose!: () => void;
  
  private destroy$ = new Subject<void>();
  
  settings: AppearanceSettings = {
    theme: 'dark',
    fontSize: 14,
    fontWeight: 'normal',
    messageStyle: 'block',
    compactMode: false
  };

  themes: Theme[] = [];
  
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
    private elementRef: ElementRef,
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

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: Event): void {
    if (!this.elementRef.nativeElement.contains(event.target as Node)) {
      this.close();
    }
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

  setFontWeight(weight: 'light' | 'normal' | 'medium' | 'semibold'): void {
    this.settings.fontWeight = weight;
    this.onFontWeightChange();
  }

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
    this.onClose();
  }
}
