import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, FormArray, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { GeneratorService } from '../services/generator';
import { Field, FieldType } from '../models/field.model';

@Component({
  selector: 'app-entity-form',
  imports: [CommonModule, ReactiveFormsModule, RouterLink],
  templateUrl: './entity-form.html',
  styleUrl: './entity-form.css',
})
export class EntityFormComponent implements OnInit {
  entityForm: FormGroup;
  fieldTypes = Object.values(FieldType);
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
    const entityName = this.route.snapshot.paramMap.get('name');
    if (entityName) {
      this.isEditMode = true;
      this.originalEntityName = entityName;
      this.loadEntity(entityName);
    }
  }

  loadEntity(name: string): void {
    this.loading = true;
    this.generatorService.getEntity(name).subscribe({
      next: (entity) => {
        this.entityForm.patchValue({
          name: entity.name,
          tableName: entity.tableName
        });

        // Clear existing fields and add loaded ones
        this.fields.clear();
        entity.fields.forEach(field => {
          this.fields.push(this.fb.group({
            name: [field.name, [Validators.required, Validators.pattern(/^[a-z][a-zA-Z0-9]*$/)]],
            type: [field.type, Validators.required],
            required: [field.required !== false],
            unique: [field.unique || false],
            defaultValue: [field.defaultValue || '']
          }));
        });

        this.loading = false;
      },
      error: (error) => {
        this.error = `Failed to load entity: ${error.error?.message || error.message}`;
        this.loading = false;
      }
    });
  }

  get fields(): FormArray {
    return this.entityForm.get('fields') as FormArray;
  }

  addField(): void {
    const fieldGroup = this.fb.group({
      name: ['', [Validators.required, Validators.pattern(/^[a-z][a-zA-Z0-9]*$/)]],
      type: [FieldType.STRING, Validators.required],
      required: [true],
      unique: [false],
      defaultValue: ['']
    });
    this.fields.push(fieldGroup);
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

    const formValue = this.entityForm.value;

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
