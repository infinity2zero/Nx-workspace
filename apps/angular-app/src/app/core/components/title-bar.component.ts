import { Component, OnInit } from '@angular/core';
import { ElectronService } from '../services/electron.service';
import { CommonModule } from '@angular/common';


@Component({
  selector: 'app-title-bar',
  imports: [CommonModule],
  templateUrl: './title-bar.component.html',
  styleUrl: './title-bar.component.scss',
})
export class TitleBarComponent implements OnInit {
  isMac = false;
  isMaximized = false;
  apiOnline = false;
  connectedSites = 0;

  constructor(private electronService: ElectronService) {}

  ngOnInit() {
    this.isMac = this.electronService.platform === 'darwin';
    this.checkApiStatus();
    this.loadSiteCount();
    
    // Only listen for window state changes on Windows/Linux
    if (!this.isMac) {
      this.electronService.onWindowMaximized(() => {
        this.isMaximized = true;
      });
      
      this.electronService.onWindowUnmaximized(() => {
        this.isMaximized = false;
      });
    }

    // Periodic status updates
    // setInterval(() => this.checkApiStatus(), 30000);
    // setInterval(() => this.loadSiteCount(), 60000);
  }

  // ⭐ Window controls - Windows/Linux ONLY
  minimizeWindow() {
    if (!this.isMac) {
      this.electronService.minimizeWindow();
    }
  }

  toggleMaximize() {
    if (!this.isMac) {
      if (this.isMaximized) {
        this.electronService.unmaximizeWindow();
      } else {
        this.electronService.maximizeWindow();
      }
    }
  }

  closeWindow() {
    if (!this.isMac) {
      this.electronService.closeWindow();
    }
  }

  showMenu(menu: string) {
    // Implement menu logic
    console.log(`Show ${menu} menu`);
    // You can show contextual menus or navigate to different views
    switch (menu) {
      case 'file':
        // Show file operations menu
        break;
      case 'view':
        // Show view options
        break;
      case 'network':
        // Show network management options
        break;
      case 'tools':
        // Show network tools
        break;
      case 'help':
        // Show help menu
        break;
    }
  }

  async checkApiStatus() {
    try {
      const response = await fetch(`/api/health`);
      this.apiOnline = response.ok;
    } catch {
      this.apiOnline = false;
    }
  }

  async loadSiteCount() {
    try {
      const response = await fetch('/api/sites/stats');
      if (response.ok) {
        const data = await response.json();
        this.connectedSites = data.totalSites || 0;
      }
    } catch {
      this.connectedSites = 0;
    }
  }
}
