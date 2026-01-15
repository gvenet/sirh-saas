import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { GeneratorService } from '../services/generator';
import { FieldType, Field, isRelationType, CreateEntityDto, IncomingRelation } from '../models/field.model';
import { AdminNavbarComponent } from '../../shared/components/admin-navbar/admin-navbar.component';

@Component({
  selector: 'app-entity-view',
  imports: [CommonModule, RouterLink, AdminNavbarComponent],
  templateUrl: './entity-view.html',
  styleUrl: './entity-view.css',
})
export class EntityViewComponent implements OnInit {
  entity: CreateEntityDto | null = null;
  entityName: string = '';
  loading = true;
  error: string | null = null;

  constructor(
    private generatorService: GeneratorService,
    private router: Router,
    private route: ActivatedRoute,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    const name = this.route.snapshot.paramMap.get('name');
    if (name) {
      this.entityName = name;
      this.loadEntity(name);
    } else {
      this.error = 'Nom de l\'entité manquant';
      this.loading = false;
    }
  }

  loadEntity(name: string): void {
    this.loading = true;
    this.error = null;
    console.log('Loading entity:', name);

    this.generatorService.getEntity(name).subscribe({
      next: (entity) => {
        console.log('Entity received:', entity);
        this.entity = entity;
        this.loading = false;
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading entity:', error);
        this.error = `Impossible de charger l'entité: ${error.error?.message || error.message}`;
        this.loading = false;
      }
    });
  }

  isRelationField(type: FieldType): boolean {
    return isRelationType(type);
  }

  getBasicFields(): Field[] {
    return this.entity?.fields.filter(f => !isRelationType(f.type)) || [];
  }

  getRelationFields(): Field[] {
    return this.entity?.fields.filter(f => isRelationType(f.type)) || [];
  }

  getIncomingRelations(): IncomingRelation[] {
    return this.entity?.incomingRelations || [];
  }

  getFieldTypeLabel(type: FieldType | string): string {
    const labels: Record<string, string> = {
      'string': 'Texte',
      'number': 'Nombre',
      'boolean': 'Booléen',
      'date': 'Date',
      'text': 'Texte long',
      'email': 'Email',
      'many-to-one': 'Many-to-One',
      'one-to-many': 'One-to-Many',
      'many-to-many': 'Many-to-Many',
      'one-to-one': 'One-to-One',
    };
    return labels[type] || type;
  }

  editEntity(): void {
    this.router.navigate(['/generator/edit', this.entityName]);
  }

  deleteEntity(): void {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer l'entité "${this.entityName}" ? Cette action est irréversible.`)) {
      return;
    }

    this.generatorService.deleteEntity(this.entityName).subscribe({
      next: () => {
        this.router.navigate(['/generator/list']);
      },
      error: (error) => {
        this.error = `Erreur lors de la suppression: ${error.error?.message || error.message}`;
      }
    });
  }

  goBack(): void {
    this.router.navigate(['/generator/list']);
  }
}
