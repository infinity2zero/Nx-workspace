import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';
import { NxWelcome } from './nx-welcome';
import { ShellComponent } from "./layout/shell.component";
import { TitleBarComponent } from "./core/components/title-bar.component";
import { CommonModule, NgIf } from '@angular/common';

@Component({
  imports: [NxWelcome, RouterModule, ShellComponent, TitleBarComponent, NgIf, CommonModule],
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  protected title = 'angular-app';
}
