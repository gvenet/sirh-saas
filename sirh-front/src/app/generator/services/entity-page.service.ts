import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { EntityPage, CreateEntityPageDto, PageField, CreatePageFieldDto, PageType } from '../models/entity-page.model';

@Injectable({
  providedIn: 'root'
})
export class EntityPageService {
  private http = inject(HttpClient);
  private readonly apiUrl = 'http://localhost:3000/entity-pages';

  // Pages
  getAll(): Observable<EntityPage[]> {
    return this.http.get<EntityPage[]>(this.apiUrl);
  }

  getByEntity(entityName: string): Observable<EntityPage[]> {
    return this.http.get<EntityPage[]>(`${this.apiUrl}?entityName=${entityName}`);
  }

  getDefaultPage(entityName: string, pageType: PageType): Observable<EntityPage | null> {
    return this.http.get<EntityPage | null>(`${this.apiUrl}/default/${entityName}/${pageType}`);
  }

  getOne(id: string): Observable<EntityPage> {
    return this.http.get<EntityPage>(`${this.apiUrl}/${id}`);
  }

  create(dto: CreateEntityPageDto): Observable<EntityPage> {
    return this.http.post<EntityPage>(this.apiUrl, dto);
  }

  update(id: string, dto: Partial<CreateEntityPageDto>): Observable<EntityPage> {
    return this.http.put<EntityPage>(`${this.apiUrl}/${id}`, dto);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/${id}`);
  }

  // Fields
  addField(pageId: string, dto: CreatePageFieldDto): Observable<PageField> {
    return this.http.post<PageField>(`${this.apiUrl}/${pageId}/fields`, dto);
  }

  updateField(fieldId: string, dto: Partial<CreatePageFieldDto>): Observable<PageField> {
    return this.http.put<PageField>(`${this.apiUrl}/fields/${fieldId}`, dto);
  }

  deleteField(fieldId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/fields/${fieldId}`);
  }

  reorderFields(pageId: string, fieldIds: string[]): Observable<void> {
    return this.http.put<void>(`${this.apiUrl}/${pageId}/fields/reorder`, { fieldIds });
  }
}
