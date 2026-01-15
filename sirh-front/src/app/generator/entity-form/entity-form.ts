import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { GeneratorService } from '../services/generator';
import { FieldType, isRelationType, EntityInfo } from '../models/field.model';
import { AdminNavbarComponent } from '../../shared/components/admin-navbar/admin-navbar.component';

@Component({
  selector: 'app-entity-form',
  imports: [CommonModule, ReactiveFormsModule, RouterLink, AdminNavbarComponent],
  templateUrl: './entity-form.html',
  styleUrl: './entity-form.css',
})
export class EntityFormComponent implements OnInit {
  entityForm: FormGroup;
  fieldTypes = Object.values(FieldType);
  // Types de base (non-relations)
  basicFieldTypes = [
    FieldType.STRING,
    FieldType.NUMBER,
    FieldType.BOOLEAN,
    FieldType.DATE,
    FieldType.TEXT,
    FieldType.EMAIL,
  ];
  // Types de relations
  relationTypes = [
    FieldType.MANY_TO_ONE,
    FieldType.ONE_TO_MANY,
    FieldType.MANY_TO_MANY,
    FieldType.ONE_TO_ONE,
  ];
  // Liste des entités disponibles pour les relations
  availableEntities: EntityInfo[] = [];
  loading = false;
  error: string | null = null;
  success: string | null = null;
  isEditMode = false;
  originalEntityName: string | null = null;

  constructor(
    private fb: FormBuilder,
    private generatorService: GeneratorService,
    private router: Router,
    private route: ActivatedRoute
  ) {
    this.entityForm = this.fb.group({
      name: ['', [Validators.required, Validators.pattern(/^[A-Z][a-zA-Z0-9]*$/)]],
      tableName: ['', [Validators.required, Validators.pattern(/^[a-z_][a-z0-9_]*$/)]],
      fields: this.fb.array([])
    });
  }

  ngOnInit(): void {
    // Charger la liste des entités disponibles pour les relations
    this.loadAvailableEntities();

    const entityName = this.route.snapshot.paramMap.get('name');
    if (entityName) {
      this.isEditMode = true;
      this.originalEntityName = entityName;
      this.loadEntity(entityName);
    }
  }

  loadAvailableEntities(): void {
    this.generatorService.listEntities().subscribe({
      next: (entities) => {
        this.availableEntities = entities;
      },
      error: (error) => {
        console.error('Failed to load entities:', error);
      }
    });
  }

  isRelationField(type: FieldType): boolean {
    return isRelationType(type);
  }

  loadEntity(name: string): void {
    this.loading = true;
    this.generatorService.getEntity(name).subscribe({
      next: (entity) => {
        this.entityForm.patchValue({
          name: entity.name,
          tableName: entity.tableName
        });

        // Désactiver les champs name et tableName en mode édition
        this.entityForm.get('name')?.disable();
        this.entityForm.get('tableName')?.disable();

        // Clear existing fields and add loaded ones
        this.fields.clear();
        entity.fields.forEach(field => {
          this.fields.push(this.createFieldGroup(field));
        });

        this.loading = false;
      },
      error: (error) => {
        this.error = `Failed to load entity: ${error.error?.message || error.message}`;
        this.loading = false;
      }
    });
  }

  private createFieldGroup(field?: any): FormGroup {
    return this.fb.group({
      name: [field?.name || '', [Validators.required, Validators.pattern(/^[a-z][a-zA-Z0-9]*$/)]],
      type: [field?.type || FieldType.STRING, Validators.required],
      required: [field?.required !== false],
      unique: [field?.unique || false],
      defaultValue: [field?.defaultValue || ''],
      // Champs pour les relations
      relationTarget: [field?.relationTarget || ''],
      relationInverse: [field?.relationInverse || ''],
      onDelete: [field?.onDelete || 'SET NULL'],
      eager: [field?.eager || false],
    });
  }

  get fields(): FormArray {
    return this.entityForm.get('fields') as FormArray;
  }

  addField(): void {
    this.fields.push(this.createFieldGroup());
  }

  addRelation(): void {
    const relationGroup = this.createFieldGroup({
      type: FieldType.MANY_TO_ONE,
      required: false,
    });
    this.fields.push(relationGroup);
  }

  removeField(index: number): void {
    this.fields.removeAt(index);
  }

  onSubmit(): void {
    if (this.entityForm.invalid) {
      this.error = 'Please fill all required fields correctly';
      return;
    }

    this.loading = true;
    this.error = null;
    this.success = null;

    // getRawValue() inclut les champs désactivés (name, tableName en mode édition)
    const formValue = this.entityForm.getRawValue();

    const operation = this.isEditMode && this.originalEntityName
      ? this.generatorService.updateEntity(this.originalEntityName, formValue)
      : this.generatorService.generateEntity(formValue);

    operation.subscribe({
      next: (response) => {
        this.loading = false;
        this.success = response.message;

        setTimeout(() => {
          this.router.navigate(['/generator/list']);
        }, 1500);
      },
      error: (error) => {
        this.loading = false;
        this.error = error.error?.message || `Failed to ${this.isEditMode ? 'update' : 'generate'} entity`;
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/generator/list']);
  }
}
