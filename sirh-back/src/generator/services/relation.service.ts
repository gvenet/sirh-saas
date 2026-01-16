import { Injectable, Logger } from '@nestjs/common';
import { FieldDto, FieldType, isRelationType } from '../dto/field.dto';
import { DatabaseSchemaService } from './database-schema.service';
import { FileToWrite } from './file-writer.service';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class RelationService {
  private readonly logger = new Logger(RelationService.name);
  private readonly entitiesPath = path.join(process.cwd(), 'src', 'entities');

  constructor(
    private readonly databaseSchemaService: DatabaseSchemaService,
  ) {}

  /**
   * Collecte les fichiers à modifier pour les relations inverses (sans écrire)
   */
  async collectInverseRelationFiles(
    sourceEntityName: string,
    fields: FieldDto[],
  ): Promise<FileToWrite[]> {
    this.logger.warn('collectInverseRelationFiles');
    const filesToWrite: FileToWrite[] = [];
    const relationFields = fields.filter(f => isRelationType(f.type) && f.relationTarget);

    for (const field of relationFields) {
      const targetEntityName = field.relationTarget!;
      const targetModuleName = targetEntityName.toLowerCase();
      const targetEntityPath = path.join(this.entitiesPath, targetModuleName, `${targetModuleName}.entity.ts`);

      if (!fs.existsSync(targetEntityPath)) {
        this.logger.warn(`Target entity ${targetEntityName} not found, skipping inverse relation`);
        continue;
      }

      let targetContent = fs.readFileSync(targetEntityPath, 'utf-8');

      const inversePropertyName = field.relationInverse || sourceEntityName.toLowerCase() + 's';
      if (targetContent.includes(`${inversePropertyName}:`)) {
        this.logger.log(`Inverse relation ${inversePropertyName} already exists in ${targetEntityName}`);
        continue;
      }

      const inverseRelation = this.getInverseRelationCode(
        field,
        sourceEntityName,
        targetEntityName,
        inversePropertyName,
      );

      if (!inverseRelation) continue;

      const sourceImport = `import { ${sourceEntityName} } from '../${sourceEntityName.toLowerCase()}/${sourceEntityName.toLowerCase()}.entity';`;
      if (!targetContent.includes(sourceImport)) {
        const lastImportMatch = targetContent.match(/import .* from .*;\n/g);
        if (lastImportMatch) {
          const lastImport = lastImportMatch[lastImportMatch.length - 1];
          targetContent = targetContent.replace(lastImport, lastImport + sourceImport + '\n');
        }
      }

      targetContent = this.addTypeOrmImportIfNeeded(targetContent, inverseRelation.typeOrmImport);

      const createDateMatch = targetContent.match(/(\s*)@CreateDateColumn\(\)/);
      if (createDateMatch) {
        targetContent = targetContent.replace(
          createDateMatch[0],
          `${inverseRelation.code}\n\n${createDateMatch[0]}`,
        );
      } else {
        const lastBraceIndex = targetContent.lastIndexOf('}');
        targetContent = targetContent.slice(0, lastBraceIndex) +
          `${inverseRelation.code}\n` +
          targetContent.slice(lastBraceIndex);
      }

      filesToWrite.push({ path: targetEntityPath, content: targetContent });
      this.logger.log(`Prepared inverse relation ${inversePropertyName} for ${targetEntityName}`);
    }

    return filesToWrite;
  }

  /**
   * Collecte les fichiers à modifier lors de la suppression d'une entité (sans écrire)
   */
  async collectCleanupFiles(
    deletedEntityName: string,
    fields: any[],
    listEntitiesFn: () => Promise<Array<{ name: string; moduleName: string; path: string }>>,
  ): Promise<FileToWrite[]> {
    this.logger.warn('collectCleanupFiles');
    const filesToWrite: FileToWrite[] = [];

    // 1. Nettoyer les relations inverses
    const relationFields = fields.filter((f: any) =>
      ['many-to-one', 'one-to-many', 'many-to-many', 'one-to-one'].includes(f.type) && f.relationTarget
    );

    for (const rel of relationFields) {
      const inversePropertyName = rel.relationInverse || deletedEntityName.toLowerCase() + 's';
      const cleanedContent = this.prepareRemoveInverseRelation(
        deletedEntityName,
        rel.relationTarget,
        inversePropertyName,
      );
      if (cleanedContent) {
        filesToWrite.push(cleanedContent);
      }
    }

    // 2. Nettoyer les références dans toutes les autres entités
    const entities = await listEntitiesFn();

    for (const entity of entities) {
      if (entity.name === deletedEntityName) continue;

      const entityFilePath = path.join(entity.path, `${entity.moduleName}.entity.ts`);
      if (!fs.existsSync(entityFilePath)) continue;

      // Vérifier si ce fichier n'a pas déjà été modifié
      const alreadyModified = filesToWrite.find(f => f.path === entityFilePath);
      let content = alreadyModified ? alreadyModified.content : fs.readFileSync(entityFilePath, 'utf-8');
      let modified = !!alreadyModified;

      const importRegex = new RegExp(
        `import \\{ ${deletedEntityName} \\} from '\\.\\./${deletedEntityName.toLowerCase()}/${deletedEntityName.toLowerCase()}\\.entity';\\n?`,
        'g'
      );
      if (importRegex.test(content)) {
        content = content.replace(importRegex, '');
        modified = true;
      }

      const relationPatterns = [
        new RegExp(
          `\\s*@ManyToOne\\(\\(\\)\\s*=>\\s*${deletedEntityName}[^)]*\\)\\s*\\n?\\s*@JoinColumn\\([^)]*\\)\\s*\\n?\\s*\\w+:\\s*${deletedEntityName};`,
          'g'
        ),
        new RegExp(
          `\\s*@OneToMany\\(\\(\\)\\s*=>\\s*${deletedEntityName}[^)]*\\)\\s*\\n?\\s*\\w+:\\s*${deletedEntityName}\\[\\];`,
          'g'
        ),
        new RegExp(
          `\\s*@ManyToMany\\(\\(\\)\\s*=>\\s*${deletedEntityName}[^)]*\\)\\s*\\n?\\s*@JoinTable\\([^)]*\\)\\s*\\n?\\s*\\w+:\\s*${deletedEntityName}\\[\\];`,
          'g'
        ),
        new RegExp(
          `\\s*@ManyToMany\\(\\(\\)\\s*=>\\s*${deletedEntityName}[^)]*\\)\\s*\\n?\\s*\\w+:\\s*${deletedEntityName}\\[\\];`,
          'g'
        ),
        new RegExp(
          `\\s*@OneToOne\\(\\(\\)\\s*=>\\s*${deletedEntityName}[^)]*\\)\\s*\\n?\\s*@JoinColumn\\([^)]*\\)\\s*\\n?\\s*\\w+:\\s*${deletedEntityName};`,
          'g'
        ),
        new RegExp(
          `\\s*@OneToOne\\(\\(\\)\\s*=>\\s*${deletedEntityName}[^)]*\\)\\s*\\n?\\s*\\w+:\\s*${deletedEntityName};`,
          'g'
        ),
      ];

      for (const pattern of relationPatterns) {
        if (pattern.test(content)) {
          content = content.replace(pattern, '');
          modified = true;
        }
      }

      if (modified) {
        content = this.cleanupUnusedTypeOrmImports(content);
        content = content.replace(/\n{3,}/g, '\n\n');

        // Mettre à jour ou ajouter le fichier
        const existingIndex = filesToWrite.findIndex(f => f.path === entityFilePath);
        if (existingIndex >= 0) {
          filesToWrite[existingIndex].content = content;
        } else {
          filesToWrite.push({ path: entityFilePath, content });
        }
        this.logger.log(`Prepared cleanup for ${entity.name}`);
      }
    }

    return filesToWrite;
  }

  /**
   * Prépare le contenu nettoyé d'une relation inverse (sans écrire)
   */
  private prepareRemoveInverseRelation(
    sourceEntityName: string,
    targetEntityName: string,
    inversePropertyName: string,
  ): FileToWrite | null {
    const targetModuleName = targetEntityName.toLowerCase();
    const targetEntityPath = path.join(this.entitiesPath, targetModuleName, `${targetModuleName}.entity.ts`);

    if (!fs.existsSync(targetEntityPath)) {
      return null;
    }

    let content = fs.readFileSync(targetEntityPath, 'utf-8');

    const sourceImport = `import { ${sourceEntityName} } from '../${sourceEntityName.toLowerCase()}/${sourceEntityName.toLowerCase()}.entity';\n`;

    const relationPatterns = [
      new RegExp(`\\s*@ManyToMany\\(\\(\\)\\s*=>\\s*${sourceEntityName}[^)]*\\)\\s*\\n?\\s*${inversePropertyName}:\\s*${sourceEntityName}\\[\\];`, 'g'),
      new RegExp(`\\s*@OneToMany\\(\\(\\)\\s*=>\\s*${sourceEntityName}[^)]*\\)\\s*\\n?\\s*${inversePropertyName}:\\s*${sourceEntityName}\\[\\];`, 'g'),
      new RegExp(`\\s*@ManyToOne\\(\\(\\)\\s*=>\\s*${sourceEntityName}[^)]*\\)\\s*\\n?\\s*@JoinColumn\\([^)]*\\)\\s*\\n?\\s*${inversePropertyName}:\\s*${sourceEntityName};`, 'g'),
      new RegExp(`\\s*@OneToOne\\(\\(\\)\\s*=>\\s*${sourceEntityName}[^)]*\\)\\s*\\n?\\s*${inversePropertyName}:\\s*${sourceEntityName};`, 'g'),
    ];

    let modified = false;
    for (const pattern of relationPatterns) {
      if (pattern.test(content)) {
        content = content.replace(pattern, '');
        modified = true;
        break;
      }
    }

    if (modified) {
      const sourceEntityUsage = new RegExp(`${sourceEntityName}(?![a-zA-Z])`, 'g');
      const matches = content.match(sourceEntityUsage);

      if (!matches || matches.length <= 1) {
        content = content.replace(sourceImport, '');
        content = this.cleanupUnusedTypeOrmImports(content);
      }

      return { path: targetEntityPath, content };
    }

    return null;
  }

  private getInverseRelationCode(
    field: FieldDto,
    sourceEntityName: string,
    targetEntityName: string,
    inversePropertyName: string,
  ): { code: string; typeOrmImport: string } | null {
    const sourceVar = sourceEntityName.toLowerCase();
    const fieldName = field.name;

    switch (field.type) {
      case FieldType.MANY_TO_ONE:
        return {
          code: `  @OneToMany(() => ${sourceEntityName}, ${sourceVar} => ${sourceVar}.${fieldName})
  ${inversePropertyName}: ${sourceEntityName}[];`,
          typeOrmImport: 'OneToMany',
        };

      case FieldType.ONE_TO_MANY:
        return {
          code: `  @ManyToOne(() => ${sourceEntityName}, ${sourceVar} => ${sourceVar}.${fieldName})
  @JoinColumn({ name: '${inversePropertyName}_id' })
  ${inversePropertyName}: ${sourceEntityName};`,
          typeOrmImport: 'ManyToOne',
        };

      case FieldType.MANY_TO_MANY:
        return {
          code: `  @ManyToMany(() => ${sourceEntityName}, ${sourceVar} => ${sourceVar}.${fieldName})
  ${inversePropertyName}: ${sourceEntityName}[];`,
          typeOrmImport: 'ManyToMany',
        };

      case FieldType.ONE_TO_ONE:
        return {
          code: `  @OneToOne(() => ${sourceEntityName}, ${sourceVar} => ${sourceVar}.${fieldName})
  ${inversePropertyName}: ${sourceEntityName};`,
          typeOrmImport: 'OneToOne',
        };

      default:
        return null;
    }
  }

  private addTypeOrmImportIfNeeded(content: string, importName: string): string {
    const typeOrmImportMatch = content.match(/import \{ ([^}]+) \} from 'typeorm';/);

    if (typeOrmImportMatch) {
      const currentImports = typeOrmImportMatch[1];

      if (currentImports.includes(importName)) {
        return content;
      }

      const newImports = currentImports + ', ' + importName;
      return content.replace(typeOrmImportMatch[0], `import { ${newImports} } from 'typeorm';`);
    }

    return content;
  }

  cleanupUnusedTypeOrmImports(content: string): string {
    const typeOrmImportMatch = content.match(/import \{ ([^}]+) \} from 'typeorm';/);
    if (!typeOrmImportMatch) return content;

    const imports = typeOrmImportMatch[1].split(',').map(i => i.trim());
    const usedImports = imports.filter(imp => {
      const restOfContent = content.replace(typeOrmImportMatch[0], '');
      return restOfContent.includes(`@${imp}`) || restOfContent.includes(imp + '(');
    });

    if (usedImports.length === 0) {
      return content.replace(typeOrmImportMatch[0] + '\n', '');
    }

    if (usedImports.length < imports.length) {
      return content.replace(
        typeOrmImportMatch[0],
        `import { ${usedImports.join(', ')} } from 'typeorm';`
      );
    }

    return content;
  }

  async cleanupRemovedColumns(
    tableName: string,
    oldFields: any[],
    newFields: FieldDto[],
  ): Promise<void> {
    this.logger.warn('cleanupRemovedColumns');

    const newFieldNames = new Set(newFields.map(f => f.name));
    const newRelationFkNames = new Set(
      newFields
        .filter(f => f.type === FieldType.MANY_TO_ONE || f.type === FieldType.ONE_TO_ONE)
        .map(f => `${f.name}_id`)
    );

    for (const oldField of oldFields) {
      if (!['many-to-one', 'one-to-many', 'many-to-many', 'one-to-one'].includes(oldField.type)) {
        if (!newFieldNames.has(oldField.name)) {
          await this.databaseSchemaService.dropColumn(tableName, oldField.name);
        }
      }

      if (oldField.type === 'many-to-one' || oldField.type === 'one-to-one') {
        const fkColumnName = `${oldField.name}_id`;
        if (!newRelationFkNames.has(fkColumnName) && !newFieldNames.has(oldField.name)) {
          await this.databaseSchemaService.dropColumn(tableName, fkColumnName);
        }
      }
    }
  }

  async cleanupOrphanedJunctionTables(
    tableName: string,
    oldRelations: any[],
    newRelations: FieldDto[],
  ): Promise<void> {
    this.logger.warn('cleanupOrphanedJunctionTables');
    const oldManyToMany = oldRelations.filter(r => r.type === 'many-to-many');
    const newManyToMany = newRelations.filter(r => r.type === FieldType.MANY_TO_MANY);

    for (const oldRel of oldManyToMany) {
      const stillExists = newManyToMany.some(
        newRel => newRel.name === oldRel.name && newRel.relationTarget === oldRel.relationTarget
      );

      if (!stillExists) {
        const junctionTableName = `${tableName}_${oldRel.name}`;
        await this.databaseSchemaService.dropJunctionTable(junctionTableName);
      }
    }
  }

  async cleanupOrphanedInverseRelations(
    sourceEntityName: string,
    oldRelations: any[],
    newRelations: FieldDto[],
  ): Promise<void> {
    this.logger.warn('cleanupOrphanedInverseRelations');
    // Cette méthode reste pour la compatibilité mais les fichiers sont déjà gérés par collectCleanupFiles
    // Elle ne fait plus d'écriture directe
  }
}
