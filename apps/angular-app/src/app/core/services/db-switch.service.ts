// db-switch.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({ providedIn: 'root' })
export class DbSwitchService {
  // Holds current DB version, null initially
  private dbVersionSubject = new BehaviorSubject<string | null>(null);

  // Observable stream for subscribers
  dbVersion$ = this.dbVersionSubject.asObservable();

  // Update DB version and notify subscribers
  setDbVersion(newVersion: string) {
    this.dbVersionSubject.next(newVersion);
  }
}
