import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
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
  waitingForRestart = false;
  restartStatus: 'waiting' | 'checking' | 'ready' = 'waiting';

  constructor(
    private fb: FormBuilder,
    private generatorService: GeneratorService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
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
        entity.fields.forEach((field: any) => {
          // Transform backend format to form format
          const formField = field.relation
            ? {
                name: field.name,
                type: field.relation.type, // Use relation type as the field type
                required: field.required,
                unique: field.unique,
                relationTarget: field.relation.target,
                relationInverse: field.relation.inverseSide || '',
                onDelete: 'SET NULL',
                eager: false,
              }
            : field;

          const group = this.createFieldGroup(formField);
          // Configurer les listeners pour les relations existantes
          if (field.relation || isRelationType(formField.type)) {
            this.setupRelationFieldListeners(group);
          }
          this.fields.push(group);
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

  getBasicFieldsIndices(): number[] {
    const indices = this.fields.controls
      .map((ctrl, idx) => ({ ctrl, idx }))
      .filter(({ ctrl }) => !isRelationType(ctrl.get('type')?.value))
      .map(({ idx }) => idx);
    return indices;
  }

  getRelationFieldsIndices(): number[] {
    const indices = this.fields.controls
      .map((ctrl, idx) => ({ ctrl, idx }))
      .filter(({ ctrl }) => isRelationType(ctrl.get('type')?.value))
      .map(({ idx }) => idx);
    return indices;
  }

  addField(): void {
    this.fields.push(this.createFieldGroup());
  }

  addRelation(): void {
    const relationGroup = this.createFieldGroup({
      type: FieldType.MANY_TO_ONE,
      required: false,
    });
    // Pré-remplir relationInverse avec le nom de l'entité actuelle (pluralisé)
    const currentEntityName = this.entityForm.get('name')?.value;
    if (currentEntityName) {
      relationGroup.patchValue({
        relationInverse: this.pluralize(currentEntityName)
      });
    }
    // Écouter les changements pour mettre à jour les champs automatiquement
    this.setupRelationFieldListeners(relationGroup);
    this.fields.push(relationGroup);
    this.cdr.detectChanges();
  }

  private setupRelationFieldListeners(group: FormGroup): void {
    // Quand l'entité cible change, pré-remplir le nom de la relation
    group.get('relationTarget')?.valueChanges.subscribe((targetEntity: string) => {
      if (targetEntity && !group.get('name')?.value) {
        const relationType = group.get('type')?.value;
        group.patchValue({
          name: this.getRelationName(targetEntity, relationType)
        });
      }
    });

    // Quand le type de relation change, mettre à jour le nom si basé sur l'entité cible
    group.get('type')?.valueChanges.subscribe((relationType: FieldType) => {
      const targetEntity = group.get('relationTarget')?.value;
      const currentName = group.get('name')?.value;
      // Mettre à jour seulement si le nom correspond à un pattern auto-généré
      if (targetEntity && this.isAutoGeneratedName(currentName, targetEntity)) {
        group.patchValue({
          name: this.getRelationName(targetEntity, relationType)
        });
      }
    });
  }

  private getRelationName(entityName: string, relationType: FieldType): string {
    const baseName = entityName.charAt(0).toLowerCase() + entityName.slice(1);
    // Pour one-to-one et many-to-one: singulier (employee)
    // Pour one-to-many et many-to-many: pluriel (employees)
    if (relationType === FieldType.ONE_TO_ONE || relationType === FieldType.MANY_TO_ONE) {
      return baseName;
    }
    return this.pluralize(baseName);
  }

  private isAutoGeneratedName(name: string, entityName: string): boolean {
    if (!name) return true;
    const baseName = entityName.charAt(0).toLowerCase() + entityName.slice(1);
    return name === baseName || name === this.pluralize(baseName);
  }

  private pluralize(word: string): string {
    const lowerWord = word.charAt(0).toLowerCase() + word.slice(1);
    // Règles de pluralisation simples
    if (lowerWord.endsWith('y') && !['a', 'e', 'i', 'o', 'u'].includes(lowerWord.charAt(lowerWord.length - 2))) {
      return lowerWord.slice(0, -1) + 'ies';
    }
    if (lowerWord.endsWith('s') || lowerWord.endsWith('x') || lowerWord.endsWith('ch') || lowerWord.endsWith('sh')) {
      return lowerWord + 'es';
    }
    return lowerWord + 's';
  }

  removeField(index: number): void {
    this.fields.removeAt(index);
  }

  onSubmit(): void {
    if (this.entityForm.invalid) {
      this.error = 'Please fill all required fields correctly';
      return;
    }

    // Check for duplicate field names
    const fieldNames = this.fields.controls.map(ctrl => ctrl.get('name')?.value);
    const duplicates = fieldNames.filter((name, index) => fieldNames.indexOf(name) !== index);
    if (duplicates.length > 0) {
      this.error = `Duplicate field names are not allowed: ${[...new Set(duplicates)].join(', ')}`;
      return;
    }

    this.loading = true;
    this.error = null;
    this.success = null;

    // getRawValue() inclut les champs désactivés (name, tableName en mode édition)
    const formValue = this.entityForm.getRawValue();

    // Transform fields to backend format
    const transformedFields = formValue.fields.map((field: any) => {
      const isRelation = isRelationType(field.type);
      console.log('Field transform:', field.name, 'type:', field.type, 'isRelation:', isRelation);
      if (isRelation) {
        // Convert relation field to backend format
        return {
          name: field.name,
          type: 'number', // Relations are stored as foreign keys
          required: field.required,
          relation: {
            type: field.type,
            target: field.relationTarget,
            inverseSide: field.relationInverse || undefined,
          }
        };
      }
      // Regular field
      return {
        name: field.name,
        type: field.type,
        required: field.required,
        unique: field.unique,
        defaultValue: field.defaultValue || undefined,
      };
    });
    console.log('Transformed fields:', JSON.stringify(transformedFields, null, 2));

    const entityDto = {
      name: formValue.name,
      tableName: formValue.tableName,
      fields: transformedFields,
    };

    const operation = this.isEditMode && this.originalEntityName
      ? this.generatorService.updateEntity(this.originalEntityName, entityDto)
      : this.generatorService.generateEntity(entityDto);

    operation.subscribe({
      next: (response) => {
        this.loading = false;
        this.success = response.message;
        const entityName = this.entityForm.get('name')?.value;

        if (this.isEditMode) {
          // Update: pas de redémarrage serveur, rediriger directement
          this.router.navigate(['/generator/view', entityName]);
        } else {
          // Create: le serveur va redémarrer, attendre
          this.startServerPolling();
        }
      },
      error: (error) => {
        this.loading = false;
        this.error = error.error?.message || `Failed to ${this.isEditMode ? 'update' : 'generate'} entity`;
      }
    });
  }

  private startServerPolling(): void {
    this.waitingForRestart = true;
    this.restartStatus = 'waiting';

    // Le serveur redémarre très vite (< 2s), donc au lieu d'essayer de détecter l'état DOWN,
    // on attend un court délai puis on vérifie que le serveur est UP et que l'entité existe
    setTimeout(() => {
      this.restartStatus = 'checking';
      this.verifyEntityExists(0);
    }, 1000); // Attendre 2s pour laisser le temps au serveur de redémarrer
  }

  private verifyEntityExists(attempts: number): void {
    const entityName = this.entityForm.get('name')?.value;

    // Timeout après 10 tentatives (5s supplémentaires)
    if (attempts >= 10) {
      console.warn('Timeout waiting for entity, redirecting anyway');
      this.restartStatus = 'ready';
      this.router.navigate(['/generator/view', entityName]);
      return;
    }

    this.generatorService.getEntity(entityName).subscribe({
      next: (entity) => {
        if (entity) {
          // L'entité existe, le serveur est prêt
          this.restartStatus = 'ready';
          this.router.navigate(['/generator/view', entityName]);
        } else {
          // L'entité n'existe pas encore, réessayer
          setTimeout(() => {
            this.verifyEntityExists(attempts + 1);
          }, 500);
        }
      },
      error: () => {
        // Erreur (serveur pas encore prêt ou entité pas trouvée), réessayer
        setTimeout(() => {
          this.verifyEntityExists(attempts + 1);
        }, 500);
      }
    });
  }

  cancel(): void {
    this.router.navigate(['/generator/list']);
  }

  scrollTo(elementId: string): void {
    const element = document.getElementById(elementId);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}
