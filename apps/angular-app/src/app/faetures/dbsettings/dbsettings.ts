import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { HttpClient, HttpClientModule } from '@angular/common/http';
import { NgbModal } from '@ng-bootstrap/ng-bootstrap';
import {ToastrService } from 'ngx-toastr';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DbSwitchService } from '../../core/services/db-switch.service';

interface DatabaseInfo {
  name: string;
  path: string;
  size: number;
  created: Date;
  isActive: boolean;
  isDeletable: boolean;
  siteCount?: number;
  linkCount?: number;
}

@Component({
  selector: 'app-settings',
  imports: [CommonModule,FormsModule, HttpClientModule],
  templateUrl: './dbsettings.html',
  styleUrls: ['./dbsettings.scss']
})
export class DbSettings implements OnInit {
  @ViewChild('fileInput') fileInput!: ElementRef<HTMLInputElement>;
  @ViewChild('confirmModal') confirmModal!: any;

  databases: DatabaseInfo[] = [];
  loading = false;
  uploading = false;
  selectedFiles: File[] = [];
  newDbName = '';
  deleteTarget = '';

  // Form validation
  sitesFile: File | null = null;
  linksFile: File | null = null;
  
  constructor(
    private http: HttpClient,
    private modal: NgbModal,
    private toastr: ToastrService,
    private dbSwitchService: DbSwitchService
  ) {}

  ngOnInit() {
    this.loadDatabases();
  }

  async loadDatabases() {
    this.loading = true;
    try {
      this.databases = await this.http.get<DatabaseInfo[]>('/api/dbsettings/databases').toPromise() || [];
    } catch (error) {
      this.toastr.error('Failed to load databases', 'Error');
    } finally {
      this.loading = false;
    }
  }

  onFilesSelected(event: Event) {
    const target = event.target as HTMLInputElement;
    if (target.files) {
      const files = Array.from(target.files);
      
      // Validate files
      const sitesFile = files.find(f => f.name.toLowerCase().includes('sites'));
      const linksFile = files.find(f => f.name.toLowerCase().includes('links'));

      if (!sitesFile && !linksFile) {
        this.toastr.error('Please select sites.json and/or links.json files', 'Invalid Files');
        return;
      }

      this.sitesFile = sitesFile || null;
      this.linksFile = linksFile || null;
      this.selectedFiles = files;
    }
  }

  async uploadAndCreateDatabase() {
    if (!this.newDbName.trim()) {
      this.toastr.error('Please enter a database name', 'Validation Error');
      return;
    }

    if (this.selectedFiles.length === 0) {
      this.toastr.error('Please select JSON files to upload', 'Validation Error');
      return;
    }

    this.uploading = true;
    try {
      const formData = new FormData();
      formData.append('dbName', this.newDbName.trim());
      
      this.selectedFiles.forEach(file => {
        formData.append('files', file);
      });

      const response = await this.http.post<{success: boolean; message: string}>(
        '/api/dbsettings/database/create', 
        formData
      ).toPromise();

      if (response?.success) {
        this.toastr.success(response.message, 'Success');
        this.resetForm();
        await this.loadDatabases();
      } else {
        this.toastr.error(response?.message || 'Failed to create database', 'Error');
      }
    } catch (error: any) {
      this.toastr.error(error?.error?.message || 'Failed to upload files', 'Error');
    } finally {
      this.uploading = false;
    }
  }

  async switchDatabase(dbName: string) {
    this.loading = true;
    try {
      const response = await this.http.post<{success: boolean; message: string}>(
        `/api/dbsettings/database/switch/${dbName}`, 
        {}
      ).toPromise();

      if (response?.success) {
        this.toastr.success(response.message, 'Success');
        await this.loadDatabases();
        this.http.post('/api/tiles/clear-cache',{}).subscribe((res:any)=>{
          this.toastr.success(res.message, 'Cache Cleared');
            this.dbSwitchService.setDbVersion(dbName);
        });
      } else {
        this.toastr.error(response?.message || 'Failed to switch database', 'Error');
      }
    } catch (error) {
      this.toastr.error('Failed to switch database', 'Error');
    } finally {
      this.loading = false;
    }
  }

  confirmDelete(dbName: string) {
    this.deleteTarget = dbName;
    this.modal.open(this.confirmModal);
  }

  async deleteDatabase() {
    if (!this.deleteTarget) return;

    try {
      const response = await this.http.delete<{success: boolean; message: string}>(
        `/api/dbsettings/database/${this.deleteTarget}`
      ).toPromise();

      if (response?.success) {
        this.toastr.success(response.message, 'Success');
        await this.loadDatabases();
      } else {
        this.toastr.error(response?.message || 'Failed to delete database', 'Error');
      }
    } catch (error) {
      this.toastr.error('Failed to delete database', 'Error');
    }

    this.deleteTarget = '';
    this.modal.dismissAll();
  }

  resetForm() {
    this.newDbName = '';
    this.selectedFiles = [];
    this.sitesFile = null;
    this.linksFile = null;
    if (this.fileInput) {
      this.fileInput.nativeElement.value = '';
    }
  }

  formatFileSize(bytes: number): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  formatDate(date: string | Date): string {
    return new Date(date).toLocaleDateString() + ' ' + new Date(date).toLocaleTimeString();
  }
}
