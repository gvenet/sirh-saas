import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { GeneratorService } from '../services/generator';
import { EntityInfo } from '../models/field.model';
import { AdminNavbarComponent } from '../../shared/components/admin-navbar/admin-navbar.component';

@Component({
  selector: 'app-entity-list',
  imports: [CommonModule, RouterLink, AdminNavbarComponent],
  templateUrl: './entity-list.html',
  styleUrl: './entity-list.css',
  standalone: true,
})
export class EntityListComponent implements OnInit {
  entities: EntityInfo[] = [];
  loading = true;
  error: string | null = null;

  constructor(
    private generatorService: GeneratorService,
    private router: Router,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadEntities();
  }

  loadEntities(): void {
    console.log('loadEntities called');
    this.loading = true;
    this.error = null;

    this.generatorService.listEntities().subscribe({
      next: (entities) => {
        console.log('Entities received:', entities);
        console.log('Entities count:', entities.length);
        this.entities = entities;
        this.loading = false;
        console.log('Component state - loading:', this.loading, 'entities:', this.entities);
        this.cdr.detectChanges();
      },
      error: (error) => {
        console.error('Error loading entities:', error);
        this.error = 'Failed to load entities';
        this.loading = false;
        this.cdr.detectChanges();
      }
    });
  }

  deleteEntity(entityName: string): void {
    if (!confirm(`Are you sure you want to delete entity "${entityName}"? This action cannot be undone.`)) {
      return;
    }

    this.generatorService.deleteEntity(entityName).subscribe({
      next: () => {
        this.loadEntities();
      },
      error: (error) => {
        this.error = `Failed to delete entity: ${error.error?.message || error.message}`;
      }
    });
  }

  editEntity(entityName: string): void {
    this.router.navigate(['/generator/edit', entityName]);
  }

  createNewEntity(): void {
    this.router.navigate(['/generator']);
  }

  trackByName(_index: number, entity: EntityInfo): string {
    return entity.name;
  }
}
