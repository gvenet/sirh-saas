import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { CreateEntityDto, GeneratorResponse, EntityInfo } from '../models/field.model';

@Injectable({
  providedIn: 'root',
})
export class GeneratorService {
  private apiUrl = 'http://localhost:3000/generator';

  constructor(private http: HttpClient) {}

  generateEntity(entityDto: CreateEntityDto): Observable<GeneratorResponse> {
    return this.http.post<GeneratorResponse>(`${this.apiUrl}/entity`, entityDto);
  }

  listEntities(): Observable<EntityInfo[]> {
    console.log(`${this.apiUrl}/entities`);
    return this.http.get<EntityInfo[]>(`${this.apiUrl}/entities`);
  }

  getEntity(name: string): Observable<CreateEntityDto> {
    return this.http.get<CreateEntityDto>(`${this.apiUrl}/entity/${name}`);
  }

  updateEntity(name: string, entityDto: CreateEntityDto): Observable<GeneratorResponse> {
    return this.http.put<GeneratorResponse>(`${this.apiUrl}/entity/${name}`, entityDto);
  }

  deleteEntity(name: string): Observable<{message: string}> {
    return this.http.delete<{message: string}>(`${this.apiUrl}/entity/${name}`);
  }
}
