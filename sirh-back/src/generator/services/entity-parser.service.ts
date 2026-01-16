import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class EntityParserService {
  private readonly logger = new Logger(EntityParserService.name);
  private readonly entitiesPath = path.join(process.cwd(), 'src', 'entities');

  async listEntities(): Promise<Array<{ name: string; moduleName: string; path: string }>> {
    this.logger.warn('listEntities');
    const entities: Array<{ name: string; moduleName: string; path: string }> = [];

    if (!fs.existsSync(this.entitiesPath)) {
      return entities;
    }

    const folders = fs.readdirSync(this.entitiesPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const folder of folders) {
      const entityFilePath = path.join(this.entitiesPath, folder, `${folder}.entity.ts`);
      if (fs.existsSync(entityFilePath)) {
        entities.push({
          name: this.capitalize(folder),
          moduleName: folder,
          path: path.join(this.entitiesPath, folder),
        });
      }
    }

    return entities;
  }

  async getEntitySchema(name: string): Promise<{
    name: string;
    tableName: string;
    fields: any[];
    moduleName: string;
    incomingRelations: any[];
  }> {
    this.logger.warn('getEntitySchema');
    const moduleName = name.toLowerCase();
    const entityPath = path.join(this.entitiesPath, moduleName);
    const entityFilePath = path.join(entityPath, `${moduleName}.entity.ts`);

    if (!fs.existsSync(entityFilePath)) {
      throw new Error(`Entity ${name} not found`);
    }

    const entityContent = fs.readFileSync(entityFilePath, 'utf-8');
    const fields = this.parseEntityFields(entityContent);
    const tableName = this.extractTableName(entityContent);

    const incomingRelations = await this.findIncomingRelations(name);

    const outgoingTargets = fields
      .filter(f => ['many-to-one', 'one-to-many', 'many-to-many', 'one-to-one'].includes(f.type))
      .map(f => f.relationTarget);

    const filteredIncoming = incomingRelations.filter(
      rel => !outgoingTargets.includes(rel.sourceEntity)
    );

    return {
      name,
      tableName,
      fields,
      moduleName,
      incomingRelations: filteredIncoming,
    };
  }

  private async findIncomingRelations(targetEntityName: string): Promise<Array<{
    sourceEntity: string;
    fieldName: string;
    relationType: string;
    inverseProperty: string;
  }>> {
    this.logger.warn('findIncomingRelations');
    const incomingRelations: Array<{
      sourceEntity: string;
      fieldName: string;
      relationType: string;
      inverseProperty: string;
    }> = [];

    const entities = await this.listEntities();

    for (const entity of entities) {
      if (entity.name === targetEntityName) continue;

      const entityFilePath = path.join(entity.path, `${entity.moduleName}.entity.ts`);
      if (!fs.existsSync(entityFilePath)) continue;

      const content = fs.readFileSync(entityFilePath, 'utf-8');

      // ManyToOne
      const manyToOneRegex = new RegExp(
        `@ManyToOne\\(\\(\\)\\s*=>\\s*${targetEntityName}[^)]*\\)[\\s\\S]*?@JoinColumn\\([^)]*\\)\\s+(\\w+):\\s*${targetEntityName};`,
        'g'
      );
      let match;
      while ((match = manyToOneRegex.exec(content)) !== null) {
        incomingRelations.push({
          sourceEntity: entity.name,
          fieldName: match[1],
          relationType: 'many-to-one',
          inverseProperty: this.extractInverseProperty(content, match[1], 'ManyToOne'),
        });
      }

      // OneToMany
      const oneToManyRegex = new RegExp(
        `@OneToMany\\(\\(\\)\\s*=>\\s*${targetEntityName}[^)]*\\)\\s+(\\w+):\\s*${targetEntityName}\\[\\];`,
        'g'
      );
      while ((match = oneToManyRegex.exec(content)) !== null) {
        incomingRelations.push({
          sourceEntity: entity.name,
          fieldName: match[1],
          relationType: 'one-to-many',
          inverseProperty: this.extractInverseProperty(content, match[1], 'OneToMany'),
        });
      }

      // ManyToMany avec JoinTable
      const manyToManyWithJoinTableRegex = new RegExp(
        `@ManyToMany\\(\\(\\)\\s*=>\\s*${targetEntityName}[^)]*\\)\\s*@JoinTable\\([^)]*\\)\\s*(\\w+):\\s*${targetEntityName}\\[\\];`,
        'g'
      );
      while ((match = manyToManyWithJoinTableRegex.exec(content)) !== null) {
        incomingRelations.push({
          sourceEntity: entity.name,
          fieldName: match[1],
          relationType: 'many-to-many',
          inverseProperty: this.extractInverseProperty(content, match[1], 'ManyToMany'),
        });
      }

      // ManyToMany sans JoinTable
      const manyToManyWithoutJoinTableRegex = new RegExp(
        `@ManyToMany\\(\\(\\)\\s*=>\\s*${targetEntityName},[^)]*\\)\\s*(\\w+):\\s*${targetEntityName}\\[\\];`,
        'g'
      );
      while ((match = manyToManyWithoutJoinTableRegex.exec(content)) !== null) {
        incomingRelations.push({
          sourceEntity: entity.name,
          fieldName: match[1],
          relationType: 'many-to-many',
          inverseProperty: this.extractInverseProperty(content, match[1], 'ManyToMany'),
        });
      }

      // OneToOne
      const oneToOneRegex = new RegExp(
        `@OneToOne\\(\\(\\)\\s*=>\\s*${targetEntityName}[^)]*\\)[\\s\\S]*?(?:@JoinColumn\\([^)]*\\))?\\s*(\\w+):\\s*${targetEntityName};`,
        'g'
      );
      while ((match = oneToOneRegex.exec(content)) !== null) {
        incomingRelations.push({
          sourceEntity: entity.name,
          fieldName: match[1],
          relationType: 'one-to-one',
          inverseProperty: this.extractInverseProperty(content, match[1], 'OneToOne'),
        });
      }
    }

    return incomingRelations;
  }

  private extractInverseProperty(content: string, fieldName: string, relationType: string): string {
    const regex = new RegExp(
      `@${relationType}\\(\\(\\)\\s*=>\\s*\\w+,\\s*\\w+\\s*=>\\s*\\w+\\.(\\w+)`,
      'g'
    );
    const matches = [...content.matchAll(regex)];
    for (const match of matches) {
      if (content.indexOf(match[0]) < content.indexOf(`${fieldName}:`)) {
        const nextFieldMatch = content.substring(content.indexOf(match[0])).match(/(\w+):\s*\w+/);
        if (nextFieldMatch && nextFieldMatch[1] === fieldName) {
          return match[1];
        }
      }
    }
    return '';
  }

  parseEntityFields(entityContent: string): any[] {
    this.logger.warn('parseEntityFields');
    const fields: Array<{
      name: string;
      type: string;
      required: boolean;
      unique: boolean;
      defaultValue?: string;
      relationTarget?: string;
      relationInverse?: string;
      onDelete?: string;
    }> = [];

    // Parse les colonnes normales
    const columnRegex = /@Column\((.*?)\)\s+(\w+):\s*(\w+);/gs;
    let match;

    while ((match = columnRegex.exec(entityContent)) !== null) {
      const options = match[1];
      const fieldName = match[2];

      const typeMatch = options.match(/type:\s*'(\w+)'/);
      const nullableMatch = options.match(/nullable:\s*(true|false)/);
      const uniqueMatch = options.match(/unique:\s*(true|false)/);
      const defaultMatch = options.match(/default:\s*'([^']+)'/);

      const type = this.mapDbTypeToFieldType(typeMatch ? typeMatch[1] : 'varchar');

      fields.push({
        name: fieldName,
        type,
        required: !(nullableMatch && nullableMatch[1] === 'true'),
        unique: uniqueMatch ? uniqueMatch[1] === 'true' : false,
        defaultValue: defaultMatch ? defaultMatch[1] : undefined,
      });
    }

    // Parse ManyToOne
    const manyToOneRegex = /@ManyToOne\(\(\)\s*=>\s*(\w+),\s*\w+\s*=>\s*\w+\.(\w+)(?:,\s*\{[^}]*onDelete:\s*'(\w+)'[^}]*\})?\)[\s\S]*?@JoinColumn\([^)]*\)\s+(\w+):\s*\w+;/g;
    while ((match = manyToOneRegex.exec(entityContent)) !== null) {
      fields.push({
        name: match[4],
        type: 'many-to-one',
        required: true,
        unique: false,
        relationTarget: match[1],
        relationInverse: match[2],
        onDelete: match[3],
      });
    }

    // Parse OneToMany
    const oneToManyRegex = /@OneToMany\(\(\)\s*=>\s*(\w+),\s*\w+\s*=>\s*\w+\.(\w+)[^)]*\)\s+(\w+):\s*\w+\[\];/g;
    while ((match = oneToManyRegex.exec(entityContent)) !== null) {
      fields.push({
        name: match[3],
        type: 'one-to-many',
        required: false,
        unique: false,
        relationTarget: match[1],
        relationInverse: match[2],
      });
    }

    // Parse ManyToMany
    const manyToManyRegex = /@ManyToMany\(\(\)\s*=>\s*(\w+)[^)]*\)[\s\S]*?@JoinTable\([^)]*\)\s+(\w+):\s*\w+\[\];/g;
    while ((match = manyToManyRegex.exec(entityContent)) !== null) {
      fields.push({
        name: match[2],
        type: 'many-to-many',
        required: false,
        unique: false,
        relationTarget: match[1],
      });
    }

    // Parse OneToOne
    const oneToOneRegex = /@OneToOne\(\(\)\s*=>\s*(\w+)(?:,\s*\{[^}]*onDelete:\s*'(\w+)'[^}]*\})?\)[\s\S]*?@JoinColumn\([^)]*\)\s+(\w+):\s*\w+;/g;
    while ((match = oneToOneRegex.exec(entityContent)) !== null) {
      fields.push({
        name: match[3],
        type: 'one-to-one',
        required: true,
        unique: false,
        relationTarget: match[1],
        onDelete: match[2],
      });
    }

    return fields;
  }

  extractTableName(entityContent: string): string {
    const match = entityContent.match(/@Entity\('([^']+)'\)/);
    return match ? match[1] : '';
  }

  private mapDbTypeToFieldType(dbType: string): string {
    const typeMap: Record<string, string> = {
      'varchar': 'string',
      'text': 'text',
      'int': 'number',
      'boolean': 'boolean',
      'timestamp': 'date',
    };
    return typeMap[dbType] || 'string';
  }

  capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
