import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { EntityPageService } from '../../generator/services/entity-page.service';
import { EntityPage, PageField, FieldDisplayType, PageType } from '../../generator/models/entity-page.model';

@Component({
  selector: 'app-dynamic-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './dynamic-page.component.html',
  styleUrl: './dynamic-page.component.css',
})
export class DynamicPageComponent implements OnInit {
  // Page configuration
  page: EntityPage | null = null;
  pageId: string = '';
  entityId: string | null = null;

  // Data
  entityData: Record<string, unknown> = {};
  relatedData: Record<string, unknown[]> = {};

  // State
  loading = true;
  saving = false;
  error: string | null = null;
  isEditMode = false;

  // Enums for template
  FieldDisplayType = FieldDisplayType;
  PageType = PageType;

  private apiBaseUrl = 'http://localhost:3000';

  constructor(
    private entityPageService: EntityPageService,
    private http: HttpClient,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    // Get page ID from route
    const pageId = this.route.snapshot.paramMap.get('pageId');
    const entityId = this.route.snapshot.paramMap.get('entityId');

    if (pageId) {
      this.pageId = pageId;
      this.entityId = entityId;
      this.loadPage(pageId);
    } else {
      this.error = 'ID de page manquant';
      this.loading = false;
    }
  }

  loadPage(pageId: string): void {
    this.loading = true;
    this.error = null;

    this.entityPageService.getOne(pageId).subscribe({
      next: (page) => {
        this.page = page;
        this.isEditMode = page.pageType === PageType.EDIT;

        if (this.entityId) {
          this.loadEntityData(page.entityName, this.entityId);
        } else {
          // New entity mode
          this.initEmptyData(page);
          this.loading = false;
          this.cdr.detectChanges();
        }
      },
      error: (error) => {
        this.error = `Erreur lors du chargement de la page: ${error.error?.message || error.message}`;
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadEntityData(entityName: string, entityId: string): void {
    const endpoint = `${this.apiBaseUrl}/${entityName.toLowerCase()}/${entityId}`;

    this.http.get<Record<string, unknown>>(endpoint).subscribe({
      next: (data) => {
        this.entityData = data;
        this.loadRelatedData();
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.error = `Erreur lors du chargement des données: ${error.error?.message || error.message}`;
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadRelatedData(): void {
    if (!this.page) return;

    // Load related data for table/list fields
    const relationFields = this.page.fields.filter(
      f => f.displayType === FieldDisplayType.TABLE || f.displayType === FieldDisplayType.LIST
    );

    relationFields.forEach(field => {
      const relatedArray = this.entityData[field.fieldName];
      if (Array.isArray(relatedArray)) {
        this.relatedData[field.fieldName] = relatedArray;
      }
    });
  }

  initEmptyData(page: EntityPage): void {
    this.entityData = {};
    page.fields.forEach(field => {
      if (field.displayType === FieldDisplayType.BOOLEAN) {
        this.entityData[field.fieldName] = false;
      } else if (field.displayType === FieldDisplayType.NUMBER) {
        this.entityData[field.fieldName] = null;
      } else if (field.displayType === FieldDisplayType.TABLE || field.displayType === FieldDisplayType.LIST) {
        this.entityData[field.fieldName] = [];
      } else {
        this.entityData[field.fieldName] = '';
      }
    });
  }

  getFieldValue(field: PageField): unknown {
    if (field.fieldPath) {
      // Navigate nested path
      return this.getNestedValue(this.entityData, field.fieldPath);
    }
    return this.entityData[field.fieldName];
  }

  setFieldValue(field: PageField, value: unknown): void {
    if (field.fieldPath) {
      this.setNestedValue(this.entityData, field.fieldPath, value);
    } else {
      this.entityData[field.fieldName] = value;
    }
  }

  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    return path.split('.').reduce((acc: unknown, key: string) => {
      if (acc && typeof acc === 'object') {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);
  }

  private setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const keys = path.split('.');
    const lastKey = keys.pop()!;
    const target = keys.reduce((acc: unknown, key: string) => {
      if (acc && typeof acc === 'object') {
        return (acc as Record<string, unknown>)[key];
      }
      return undefined;
    }, obj);

    if (target && typeof target === 'object') {
      (target as Record<string, unknown>)[lastKey] = value;
    }
  }

  getRelatedItems(field: PageField): unknown[] {
    return this.relatedData[field.fieldName] || [];
  }

  save(): void {
    if (!this.page || !this.isEditMode) return;

    this.saving = true;
    const endpoint = this.entityId
      ? `${this.apiBaseUrl}/${this.page.entityName.toLowerCase()}/${this.entityId}`
      : `${this.apiBaseUrl}/${this.page.entityName.toLowerCase()}`;

    const request = this.entityId
      ? this.http.patch(endpoint, this.entityData)
      : this.http.post(endpoint, this.entityData);

    request.subscribe({
      next: (result) => {
        this.saving = false;
        if (!this.entityId && result && typeof result === 'object' && 'id' in result) {
          // Navigate to view the new entity
          this.router.navigate(['/entity', this.page!.entityName.toLowerCase(), (result as { id: string }).id]);
        }
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.error = `Erreur lors de la sauvegarde: ${error.error?.message || error.message}`;
        this.saving = false;
        this.cdr.detectChanges();
      }
    });
  }

  cancel(): void {
    window.history.back();
  }

  // Helper methods for template
  getSortedFields(): PageField[] {
    if (!this.page) return [];
    return [...this.page.fields].sort((a, b) => a.order - b.order);
  }

  getVisibleFields(): PageField[] {
    return this.getSortedFields().filter(f => f.visible !== false && f.displayType !== FieldDisplayType.HIDDEN);
  }

  getFieldsBySection(): Map<string, PageField[]> {
    const sections = new Map<string, PageField[]>();
    const defaultSection = 'Informations';

    this.getVisibleFields().forEach(field => {
      const section = field.section || defaultSection;
      if (!sections.has(section)) {
        sections.set(section, []);
      }
      sections.get(section)!.push(field);
    });

    return sections;
  }

  getColSpanClass(field: PageField): string {
    return `col-span-${field.colSpan || 6}`;
  }

  isReadOnly(field: PageField): boolean {
    if (this.page?.pageType === PageType.VIEW) return true;
    return field.readOnly === true;
  }

  formatDate(value: unknown): string {
    if (!value) return '';
    const date = new Date(value as string);
    return date.toLocaleDateString('fr-FR');
  }

  formatDateTime(value: unknown): string {
    if (!value) return '';
    const date = new Date(value as string);
    return date.toLocaleString('fr-FR');
  }

  formatBoolean(value: unknown): string {
    return value ? 'Oui' : 'Non';
  }
}
