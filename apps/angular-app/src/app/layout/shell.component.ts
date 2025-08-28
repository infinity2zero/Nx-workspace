// apps/angular-app/src/app/layout/shell.component.ts
import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import { Subject, takeUntil } from 'rxjs';
import { ThemeService } from '../core/services/theme.service';
import { AppearancePopoverComponent } from "../shared/components/appearance-popover/appearance-popover.component";
import { TitleBarComponent } from "../core/components/title-bar.component";


@Component({
  selector: 'app-shell',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, FormsModule, AppearancePopoverComponent, TitleBarComponent],
  templateUrl: './shell.component.html',
  styleUrl: './shell.component.scss'
})
export class ShellComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();
  currentModel = 'Select a model to load';
  currentTheme = 'dark';
  showAppearancePopover = false;

  navItems = [
    { icon: 'bi bi-speedometer2', route: 'dashboard', tooltip: 'Dashboard' },
    { icon: 'bi-geo', route: 'geomap', tooltip: 'Geo Map' },
    { icon: 'bi-diagram-3', route: 'dbsettings', tooltip: 'Settings' },
    { icon: 'bi-search', route: 'pathfinder', tooltip: 'Search' }
  ];

  constructor(private themeService: ThemeService) {}

  ngOnInit(): void {
    this.themeService.currentTheme$
      .pipe(takeUntil(this.destroy$))
      .subscribe(theme => {
        this.currentTheme = theme;
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  async toggleAppearance(event: Event): Promise<void> {
    event.stopPropagation();
    this.showAppearancePopover = !this.showAppearancePopover;
  }

  onAppearancePopoverClose(): void {
    this.showAppearancePopover = false;
  }

  onModelSelect(model: string): void {
    this.currentModel = model;
  }

  clearAll(): void {
    console.log('Clear all data');
  }

  openSystemPrompt(): void {
    console.log('Open system prompt');
  }

  duplicate(): void {
    console.log('Duplicate current view');
  }

  openSettings(): void {
    console.log('Open settings');
  }
}
