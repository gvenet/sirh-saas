import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { CdkDragDrop, DragDropModule, moveItemInArray } from '@angular/cdk/drag-drop';
import { EntityPageService } from '../services/entity-page.service';
import { GeneratorService } from '../services/generator';
import { EntityPage, PageField, FieldDisplayType, CreatePageFieldDto } from '../models/entity-page.model';
import { isRelationType } from '../models/field.model';
import { AdminNavbarComponent } from '../../shared/components/admin-navbar/admin-navbar.component';

interface AvailableField {
  name: string;
  type: string;
  isRelation: boolean;
  relationTarget?: string;
  relationType?: string;
}

@Component({
  selector: 'app-page-editor',
  imports: [CommonModule, FormsModule, DragDropModule, AdminNavbarComponent],
  templateUrl: './page-editor.html',
  styleUrl: './page-editor.css',
})
export class PageEditorComponent implements OnInit {
  page: EntityPage | null = null;
  pageId: string = '';
  loading = true;
  saving = false;
  error: string | null = null;

  // Champs disponibles (non encore ajoutés à la page)
  availableFields: AvailableField[] = [];
  // Champs configurés sur la page
  configuredFields: PageField[] = [];

  // Modal de configuration d'un champ
  showFieldModal = false;
  editingField: PageField | null = null;
  fieldForm: Partial<CreatePageFieldDto> = {};
  FieldDisplayType = FieldDisplayType;

  // Colonnes disponibles (grille 12 colonnes)
  colSpanOptions = [
    { value: 3, label: '1/4' },
    { value: 4, label: '1/3' },
    { value: 6, label: '1/2' },
    { value: 8, label: '2/3' },
    { value: 12, label: 'Pleine largeur' }
  ];

  constructor(
    private entityPageService: EntityPageService,
    private generatorService: GeneratorService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.pageId = id;
      this.loadPage(id);
    } else {
      this.error = 'ID de page manquant';
      this.loading = false;
    }
  }

  loadPage(id: string): void {
    this.loading = true;
    this.error = null;

    this.entityPageService.getOne(id).subscribe({
      next: (page) => {
        this.page = page;
        this.configuredFields = [...page.fields].sort((a, b) => a.order - b.order);
        this.loadEntityFields(page.entityName);
      },
      error: (error) => {
        this.error = `Erreur lors du chargement: ${error.error?.message || error.message}`;
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  loadEntityFields(entityName: string): void {
    this.generatorService.getEntity(entityName).subscribe({
      next: (entity) => {
        // Récupérer tous les champs de l'entité
        const allFields: AvailableField[] = entity.fields.map(f => ({
          name: f.name,
          type: f.type,
          isRelation: isRelationType(f.type),
          relationTarget: f.relationTarget,
          relationType: f.type
        }));

        // Filtrer les champs déjà configurés
        const configuredFieldNames = this.configuredFields.map(cf => cf.fieldName);
        this.availableFields = allFields.filter(f => !configuredFieldNames.includes(f.name));

        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.error = `Erreur lors du chargement de l'entité: ${error.error?.message || error.message}`;
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  // Drag and drop
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dropInConfigured(event: CdkDragDrop<any>): void {
    if (event.previousContainer === event.container) {
      // Réordonner dans la même liste
      moveItemInArray(this.configuredFields, event.previousIndex, event.currentIndex);
      this.updateFieldsOrder();
    } else {
      // Ajouter un nouveau champ depuis les disponibles
      const availableField = this.availableFields[event.previousIndex];
      this.addFieldToPage(availableField, event.currentIndex);
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  dropInAvailable(event: CdkDragDrop<any>): void {
    if (event.previousContainer !== event.container) {
      // Retirer un champ de la page
      const field = this.configuredFields[event.previousIndex];
      this.removeFieldFromPage(field);
    }
  }

  addFieldToPage(availableField: AvailableField, index: number): void {
    if (!this.page) return;

    const displayType = this.getDefaultDisplayType(availableField);
    const dto: CreatePageFieldDto = {
      fieldName: availableField.name,
      fieldPath: availableField.isRelation ? availableField.name : undefined,
      displayType: displayType,
      label: this.formatLabel(availableField.name),
      order: index,
      colSpan: 6,
      readOnly: this.page.pageType === 'view'
    };

    this.entityPageService.addField(this.page.id, dto).subscribe({
      next: (field) => {
        // Ajouter à la position correcte
        this.configuredFields.splice(index, 0, field);
        // Retirer des disponibles
        this.availableFields = this.availableFields.filter(f => f.name !== availableField.name);
        // Mettre à jour l'ordre
        this.updateFieldsOrder();
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.error = `Erreur lors de l'ajout du champ: ${error.error?.message || error.message}`;
      }
    });
  }

  removeFieldFromPage(field: PageField): void {
    this.entityPageService.deleteField(field.id).subscribe({
      next: () => {
        // Retirer de la liste configurée
        this.configuredFields = this.configuredFields.filter(f => f.id !== field.id);
        // Remettre dans les disponibles
        this.availableFields.push({
          name: field.fieldName,
          type: 'string', // Type par défaut, sera rechargé
          isRelation: !!field.fieldPath,
          relationTarget: undefined,
          relationType: undefined
        });
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.error = `Erreur lors de la suppression: ${error.error?.message || error.message}`;
      }
    });
  }

  updateFieldsOrder(): void {
    if (!this.page) return;

    const fieldIds = this.configuredFields.map(f => f.id);
    this.entityPageService.reorderFields(this.page.id, fieldIds).subscribe({
      next: () => {
        // Mettre à jour l'ordre local
        this.configuredFields.forEach((field, index) => {
          field.order = index;
        });
      },
      error: (error) => {
        this.error = `Erreur lors de la réorganisation: ${error.error?.message || error.message}`;
      }
    });
  }

  // Configuration d'un champ
  openFieldConfig(field: PageField): void {
    this.editingField = field;
    this.fieldForm = {
      label: field.label,
      displayType: field.displayType,
      colSpan: field.colSpan,
      readOnly: field.readOnly
    };
    this.showFieldModal = true;
  }

  closeFieldModal(): void {
    this.showFieldModal = false;
    this.editingField = null;
    this.fieldForm = {};
  }

  saveFieldConfig(): void {
    if (!this.editingField) return;

    this.entityPageService.updateField(this.editingField.id, this.fieldForm).subscribe({
      next: (updatedField) => {
        // Mettre à jour le champ dans la liste
        const index = this.configuredFields.findIndex(f => f.id === this.editingField!.id);
        if (index !== -1) {
          this.configuredFields[index] = updatedField;
        }
        this.closeFieldModal();
        this.cdr.detectChanges();
      },
      error: (error) => {
        this.error = `Erreur lors de la mise à jour: ${error.error?.message || error.message}`;
      }
    });
  }

  // Helpers
  getDefaultDisplayType(field: AvailableField): FieldDisplayType {
    if (field.isRelation) {
      if (field.relationType === 'one-to-many' || field.relationType === 'many-to-many') {
        return FieldDisplayType.TABLE;
      }
      return FieldDisplayType.SELECT;
    }

    const typeMap: Record<string, FieldDisplayType> = {
      'string': FieldDisplayType.TEXT,
      'text': FieldDisplayType.TEXTAREA,
      'number': FieldDisplayType.NUMBER,
      'boolean': FieldDisplayType.BOOLEAN,
      'date': FieldDisplayType.DATE,
      'email': FieldDisplayType.TEXT
    };

    return typeMap[field.type] || FieldDisplayType.TEXT;
  }

  formatLabel(fieldName: string): string {
    return fieldName
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, str => str.toUpperCase())
      .trim();
  }

  getDisplayTypeLabel(type: FieldDisplayType): string {
    const labels: Record<FieldDisplayType, string> = {
      [FieldDisplayType.TEXT]: 'Texte',
      [FieldDisplayType.TEXTAREA]: 'Texte long',
      [FieldDisplayType.NUMBER]: 'Nombre',
      [FieldDisplayType.DATE]: 'Date',
      [FieldDisplayType.DATETIME]: 'Date/Heure',
      [FieldDisplayType.BOOLEAN]: 'Booléen',
      [FieldDisplayType.SELECT]: 'Liste déroulante',
      [FieldDisplayType.AUTOCOMPLETE]: 'Autocomplete',
      [FieldDisplayType.LIST]: 'Liste',
      [FieldDisplayType.TABLE]: 'Tableau',
      [FieldDisplayType.HIDDEN]: 'Masqué'
    };
    return labels[type] || type;
  }

  getColSpanLabel(colSpan: number): string {
    const option = this.colSpanOptions.find(o => o.value === colSpan);
    return option ? option.label : `${colSpan}/12`;
  }

  goBack(): void {
    if (this.page) {
      this.router.navigate(['/generator/view', this.page.entityName]);
    } else {
      this.router.navigate(['/generator/list']);
    }
  }
}
