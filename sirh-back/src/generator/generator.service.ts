import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { CreateEntityDto } from './dto/create-entity.dto';
import { FieldDto, FieldType, isRelationType } from './dto/field.dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class GeneratorService {
  private readonly srcPath = path.join(process.cwd(), 'src');

  constructor(private readonly dataSource: DataSource) {}

  async generateEntity(createEntityDto: CreateEntityDto) {
    const { name, tableName, fields } = createEntityDto;
    const entityName = this.capitalize(name);
    const moduleName = name.toLowerCase();

    // Créer le dossier du module
    const modulePath = path.join(this.srcPath, moduleName);
    if (!fs.existsSync(modulePath)) {
      fs.mkdirSync(modulePath, { recursive: true });
    }

    // Créer le dossier dto
    const dtoPath = path.join(modulePath, 'dto');
    if (!fs.existsSync(dtoPath)) {
      fs.mkdirSync(dtoPath, { recursive: true });
    }

    // Générer tous les fichiers
    await this.generateEntityFile(modulePath, entityName, tableName, fields);
    await this.generateDtoFiles(modulePath, entityName, fields);
    await this.generateServiceFile(modulePath, entityName, moduleName, fields);
    await this.generateControllerFile(modulePath, entityName, moduleName);
    await this.generateModuleFile(modulePath, entityName, moduleName);

    // Ajouter les relations inverses sur les entités cibles
    await this.addInverseRelationsToTargetEntities(entityName, fields);

    // Mettre à jour app.module.ts
    await this.updateAppModule(entityName, moduleName);

    return {
      message: `Entity ${entityName} generated successfully`,
      path: modulePath,
      files: [
        `${moduleName}.entity.ts`,
        `dto/create-${moduleName}.dto.ts`,
        `dto/update-${moduleName}.dto.ts`,
        `${moduleName}.service.ts`,
        `${moduleName}.controller.ts`,
        `${moduleName}.module.ts`,
      ],
    };
  }

  private async generateEntityFile(
    modulePath: string,
    entityName: string,
    tableName: string,
    fields: FieldDto[],
  ) {
    // Séparer les champs normaux des relations
    const normalFields = fields.filter(f => !isRelationType(f.type));
    const relationFields = fields.filter(f => isRelationType(f.type));

    // Construire les imports TypeORM nécessaires
    const typeOrmImports = ['Entity', 'PrimaryGeneratedColumn', 'Column', 'CreateDateColumn', 'UpdateDateColumn'];

    // Ajouter les imports de relations si nécessaire
    const relationTypes = new Set<string>();
    relationFields.forEach(f => {
      if (f.type === FieldType.MANY_TO_ONE) {
        relationTypes.add('ManyToOne');
        relationTypes.add('JoinColumn');
      } else if (f.type === FieldType.ONE_TO_MANY) {
        relationTypes.add('OneToMany');
      } else if (f.type === FieldType.MANY_TO_MANY) {
        relationTypes.add('ManyToMany');
        relationTypes.add('JoinTable');
      } else if (f.type === FieldType.ONE_TO_ONE) {
        relationTypes.add('OneToOne');
        relationTypes.add('JoinColumn');
      }
    });

    typeOrmImports.push(...relationTypes);

    // Construire les imports d'entités liées
    const relatedEntitiesImports = relationFields
      .filter(f => f.relationTarget)
      .map(f => {
        const targetModule = f.relationTarget!.toLowerCase();
        return `import { ${f.relationTarget} } from '../${targetModule}/${targetModule}.entity';`;
      })
      .filter((value, index, self) => self.indexOf(value) === index) // Remove duplicates
      .join('\n');

    const content = `import { ${typeOrmImports.join(', ')} } from 'typeorm';
    ${relatedEntitiesImports ? relatedEntitiesImports + '\n' : ''}
    @Entity('${tableName}')
    export class ${entityName} {
      @PrimaryGeneratedColumn('uuid')
      id: string;

    ${normalFields.map((field) => this.generateFieldColumn(field)).join('\n\n')}
    ${relationFields.length > 0 ? '\n' + relationFields.map((field) => this.generateRelationField(field, entityName, tableName)).join('\n\n') : ''}
        
      @CreateDateColumn()
      createdAt: Date;
        
      @UpdateDateColumn()
      updatedAt: Date;
    }
    `;

    fs.writeFileSync(
      path.join(modulePath, `${entityName.toLowerCase()}.entity.ts`),
      content,
    );
  }

  private generateFieldColumn(field: FieldDto): string {
    const columnType = this.getColumnType(field.type);
    const options: string[] = [];

    options.push(`type: '${columnType}'`);
    if (field.unique) options.push('unique: true');
    if (!field.required) options.push('nullable: true');
    if (field.defaultValue) options.push(`default: '${field.defaultValue}'`);

    const optionsStr = options.length > 0 ? `{ ${options.join(', ')} }` : '';

    return `  @Column(${optionsStr})
  ${field.name}: ${this.getTypeScriptType(field.type)};`;
  }

  private generateRelationField(field: FieldDto, currentEntityName: string, tableName?: string): string {
    const target = field.relationTarget || 'Entity';
    const inverse = field.relationInverse || currentEntityName.toLowerCase() + 's';
    const onDelete = field.onDelete || 'SET NULL';
    const eager = field.eager ? ', { eager: true }' : '';
    // Utiliser le nom de la table pour la table de jonction (ex: employees_skills)
    const tablePrefix = tableName || currentEntityName.toLowerCase();

    switch (field.type) {
      case FieldType.MANY_TO_ONE:
        return `  @ManyToOne(() => ${target}, ${target.toLowerCase()} => ${target.toLowerCase()}.${inverse}${field.onDelete ? `, { onDelete: '${onDelete}' }` : ''})
  @JoinColumn({ name: '${field.name}_id' })
  ${field.name}: ${target};`;

      case FieldType.ONE_TO_MANY:
        return `  @OneToMany(() => ${target}, ${target.toLowerCase()} => ${target.toLowerCase()}.${field.relationInverse || currentEntityName.toLowerCase()}${eager})
  ${field.name}: ${target}[];`;

      case FieldType.MANY_TO_MANY:
        return `  @ManyToMany(() => ${target}${eager})
  @JoinTable({ name: '${tablePrefix}_${field.name}' })
  ${field.name}: ${target}[];`;

      case FieldType.ONE_TO_ONE:
        return `  @OneToOne(() => ${target}${field.onDelete ? `, { onDelete: '${onDelete}' }` : ''})
  @JoinColumn({ name: '${field.name}_id' })
  ${field.name}: ${target};`;

      default:
        return '';
    }
  }

  private async generateDtoFiles(
    modulePath: string,
    entityName: string,
    fields: FieldDto[],
  ) {
    const moduleName = entityName.toLowerCase();

    // Séparer les champs normaux des relations
    const normalFields = fields.filter(f => !isRelationType(f.type));
    const relationFields = fields.filter(f => isRelationType(f.type));

    // Create DTO
    const hasDateField = normalFields.some((field) => field.type === FieldType.DATE);
    const hasRelations = relationFields.length > 0;

    const transformImport = hasDateField || hasRelations
      ? "import { Type } from 'class-transformer';\n"
      : '';

    const validatorImports = ['IsString', 'IsNumber', 'IsBoolean', 'IsDate', 'IsEmail', 'IsOptional'];
    if (hasRelations) {
      validatorImports.push('IsUUID', 'IsArray');
    }

    const createDtoContent = `import { ${validatorImports.join(', ')} } from 'class-validator';
${transformImport}
export class Create${entityName}Dto {
${normalFields.map((field) => this.generateDtoField(field, false)).join('\n')}
${relationFields.length > 0 ? '\n' + relationFields.map((field) => this.generateRelationDtoField(field)).join('\n') : ''}
}
`;

    // Update DTO
    const updateDtoContent = `import { PartialType } from '@nestjs/mapped-types';
import { Create${entityName}Dto } from './create-${moduleName}.dto';

export class Update${entityName}Dto extends PartialType(Create${entityName}Dto) {}
`;

    fs.writeFileSync(
      path.join(modulePath, `dto/create-${moduleName}.dto.ts`),
      createDtoContent,
    );
    fs.writeFileSync(
      path.join(modulePath, `dto/update-${moduleName}.dto.ts`),
      updateDtoContent,
    );
  }

  private generateDtoField(field: FieldDto, isUpdate: boolean): string {
    const decorator = this.getDtoDecorator(field.type);
    const optional = !field.required || isUpdate ? '  @IsOptional()' : '';
    const typeTransform =
      field.type === FieldType.DATE ? '  @Type(() => Date)\n' : '';

    return `${optional ? optional + '\n' : ''}${typeTransform}  ${decorator}
  ${field.name}: ${this.getTypeScriptType(field.type)};`;
  }

  private generateRelationDtoField(field: FieldDto): string {
    const optional = !field.required ? '  @IsOptional()\n' : '';

    // Pour ManyToOne et OneToOne, on attend un ID (UUID)
    if (field.type === FieldType.MANY_TO_ONE || field.type === FieldType.ONE_TO_ONE) {
      return `${optional}  @IsUUID()
  ${field.name}Id?: string;`;
    }

    // Pour OneToMany et ManyToMany, on attend un tableau d'IDs
    if (field.type === FieldType.ONE_TO_MANY || field.type === FieldType.MANY_TO_MANY) {
      return `${optional}  @IsArray()
  @IsUUID('4', { each: true })
  ${field.name}Ids?: string[];`;
    }

    return '';
  }

  private async generateServiceFile(
    modulePath: string,
    entityName: string,
    moduleName: string,
    fields?: FieldDto[],
  ) {
    // Extraire les noms des relations pour le chargement automatique
    const relationFields = fields?.filter(f => isRelationType(f.type)) || [];
    const relationNames = relationFields.map(f => `'${f.name}'`).join(', ');
    const hasRelations = relationFields.length > 0;

    const content = `import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ${entityName} } from './${moduleName}.entity';
import { Create${entityName}Dto } from './dto/create-${moduleName}.dto';
import { Update${entityName}Dto } from './dto/update-${moduleName}.dto';

@Injectable()
export class ${entityName}Service {
  constructor(
    @InjectRepository(${entityName})
    private ${moduleName}Repository: Repository<${entityName}>,
  ) {}

  async create(create${entityName}Dto: Create${entityName}Dto): Promise<${entityName}> {
    const ${moduleName} = this.${moduleName}Repository.create(create${entityName}Dto);
    return this.${moduleName}Repository.save(${moduleName});
  }

  async findAll(): Promise<${entityName}[]> {
    return this.${moduleName}Repository.find(${hasRelations ? `{ relations: [${relationNames}] }` : ''});
  }

  async findOne(id: string): Promise<${entityName}> {
    const ${moduleName} = await this.${moduleName}Repository.findOne({
      where: { id },${hasRelations ? `\n      relations: [${relationNames}],` : ''}
    });
    if (!${moduleName}) {
      throw new NotFoundException(\`${entityName} with ID \${id} not found\`);
    }
    return ${moduleName};
  }

  async update(id: string, update${entityName}Dto: Update${entityName}Dto): Promise<${entityName}> {
    await this.findOne(id);
    await this.${moduleName}Repository.update(id, update${entityName}Dto);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const ${moduleName} = await this.findOne(id);
    await this.${moduleName}Repository.remove(${moduleName});
  }
}
`;

    fs.writeFileSync(path.join(modulePath, `${moduleName}.service.ts`), content);
  }

  private async generateControllerFile(
    modulePath: string,
    entityName: string,
    moduleName: string,
  ) {
    const content = `import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  UseGuards,
} from '@nestjs/common';
import { ${entityName}Service } from './${moduleName}.service';
import { Create${entityName}Dto } from './dto/create-${moduleName}.dto';
import { Update${entityName}Dto } from './dto/update-${moduleName}.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@Controller('${moduleName}')
@UseGuards(JwtAuthGuard)
export class ${entityName}Controller {
  constructor(private readonly ${moduleName}Service: ${entityName}Service) {}

  @Post()
  create(@Body() create${entityName}Dto: Create${entityName}Dto) {
    return this.${moduleName}Service.create(create${entityName}Dto);
  }

  @Get()
  findAll() {
    return this.${moduleName}Service.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.${moduleName}Service.findOne(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() update${entityName}Dto: Update${entityName}Dto) {
    return this.${moduleName}Service.update(id, update${entityName}Dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.${moduleName}Service.remove(id);
  }
}
`;

    fs.writeFileSync(
      path.join(modulePath, `${moduleName}.controller.ts`),
      content,
    );
  }

  private async generateModuleFile(
    modulePath: string,
    entityName: string,
    moduleName: string,
  ) {
    const content = `import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ${entityName}Service } from './${moduleName}.service';
import { ${entityName}Controller } from './${moduleName}.controller';
import { ${entityName} } from './${moduleName}.entity';

@Module({
  imports: [TypeOrmModule.forFeature([${entityName}])],
  controllers: [${entityName}Controller],
  providers: [${entityName}Service],
  exports: [${entityName}Service],
})
export class ${entityName}Module {}
`;

    fs.writeFileSync(path.join(modulePath, `${moduleName}.module.ts`), content);
  }

  private getColumnType(fieldType: FieldType): string {
    const typeMap = {
      [FieldType.STRING]: 'varchar',
      [FieldType.EMAIL]: 'varchar',
      [FieldType.TEXT]: 'text',
      [FieldType.NUMBER]: 'int',
      [FieldType.BOOLEAN]: 'boolean',
      [FieldType.DATE]: 'timestamp',
    };
    return typeMap[fieldType] || 'varchar';
  }

  private getTypeScriptType(fieldType: FieldType): string {
    const typeMap = {
      [FieldType.STRING]: 'string',
      [FieldType.EMAIL]: 'string',
      [FieldType.TEXT]: 'string',
      [FieldType.NUMBER]: 'number',
      [FieldType.BOOLEAN]: 'boolean',
      [FieldType.DATE]: 'Date',
    };
    return typeMap[fieldType] || 'string';
  }

  private getDtoDecorator(fieldType: FieldType): string {
    const decoratorMap = {
      [FieldType.STRING]: '@IsString()',
      [FieldType.EMAIL]: '@IsEmail()',
      [FieldType.TEXT]: '@IsString()',
      [FieldType.NUMBER]: '@IsNumber()',
      [FieldType.BOOLEAN]: '@IsBoolean()',
      [FieldType.DATE]: '@IsDate()',
    };
    return decoratorMap[fieldType] || '@IsString()';
  }

  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  /**
   * Ajoute les relations inverses sur les entités cibles
   */
  private async addInverseRelationsToTargetEntities(
    sourceEntityName: string,
    fields: FieldDto[],
  ): Promise<void> {
    const relationFields = fields.filter(f => isRelationType(f.type) && f.relationTarget);

    for (const field of relationFields) {
      const targetEntityName = field.relationTarget!;
      const targetModuleName = targetEntityName.toLowerCase();
      const targetEntityPath = path.join(this.srcPath, targetModuleName, `${targetModuleName}.entity.ts`);

      if (!fs.existsSync(targetEntityPath)) {
        console.warn(`Target entity ${targetEntityName} not found, skipping inverse relation`);
        continue;
      }

      let targetContent = fs.readFileSync(targetEntityPath, 'utf-8');

      // Vérifier si la relation inverse existe déjà
      const inversePropertyName = field.relationInverse || sourceEntityName.toLowerCase() + 's';
      if (targetContent.includes(`${inversePropertyName}:`)) {
        console.log(`Inverse relation ${inversePropertyName} already exists in ${targetEntityName}`);
        continue;
      }

      // Déterminer le type de relation inverse
      const inverseRelation = this.getInverseRelationCode(
        field,
        sourceEntityName,
        targetEntityName,
        inversePropertyName,
      );

      if (!inverseRelation) continue;

      // Ajouter l'import de l'entité source si nécessaire
      const sourceImport = `import { ${sourceEntityName} } from '../${sourceEntityName.toLowerCase()}/${sourceEntityName.toLowerCase()}.entity';`;
      if (!targetContent.includes(sourceImport)) {
        // Ajouter après les imports existants
        const lastImportMatch = targetContent.match(/import .* from .*;\n/g);
        if (lastImportMatch) {
          const lastImport = lastImportMatch[lastImportMatch.length - 1];
          targetContent = targetContent.replace(lastImport, lastImport + sourceImport + '\n');
        }
      }

      // Ajouter les imports TypeORM nécessaires pour la relation inverse
      targetContent = this.addTypeOrmImportIfNeeded(targetContent, inverseRelation.typeOrmImport);

      // Ajouter la relation inverse avant @CreateDateColumn ou à la fin de la classe
      const createDateMatch = targetContent.match(/(\s*)@CreateDateColumn\(\)/);
      if (createDateMatch) {
        targetContent = targetContent.replace(
          createDateMatch[0],
          `${inverseRelation.code}\n\n${createDateMatch[0]}`,
        );
      } else {
        // Ajouter avant la dernière accolade fermante
        const lastBraceIndex = targetContent.lastIndexOf('}');
        targetContent = targetContent.slice(0, lastBraceIndex) +
          `${inverseRelation.code}\n` +
          targetContent.slice(lastBraceIndex);
      }

      fs.writeFileSync(targetEntityPath, targetContent);
      console.log(`Added inverse relation ${inversePropertyName} to ${targetEntityName}`);
    }
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
        // ManyToOne inverse = OneToMany
        return {
          code: `  @OneToMany(() => ${sourceEntityName}, ${sourceVar} => ${sourceVar}.${fieldName})
  ${inversePropertyName}: ${sourceEntityName}[];`,
          typeOrmImport: 'OneToMany',
        };

      case FieldType.ONE_TO_MANY:
        // OneToMany inverse = ManyToOne
        return {
          code: `  @ManyToOne(() => ${sourceEntityName}, ${sourceVar} => ${sourceVar}.${fieldName})
  @JoinColumn({ name: '${inversePropertyName}_id' })
  ${inversePropertyName}: ${sourceEntityName};`,
          typeOrmImport: 'ManyToOne',
        };

      case FieldType.MANY_TO_MANY:
        // ManyToMany inverse = ManyToMany (sans JoinTable)
        return {
          code: `  @ManyToMany(() => ${sourceEntityName}, ${sourceVar} => ${sourceVar}.${fieldName})
  ${inversePropertyName}: ${sourceEntityName}[];`,
          typeOrmImport: 'ManyToMany',
        };

      case FieldType.ONE_TO_ONE:
        // OneToOne inverse = OneToOne (sans JoinColumn)
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
    // Trouver la ligne d'import typeorm
    const typeOrmImportMatch = content.match(/import \{ ([^}]+) \} from 'typeorm';/);

    if (typeOrmImportMatch) {
      const currentImports = typeOrmImportMatch[1];

      // Vérifier si l'import existe déjà
      if (currentImports.includes(importName)) {
        return content;
      }

      // Ajouter l'import
      const newImports = currentImports + ', ' + importName;
      return content.replace(typeOrmImportMatch[0], `import { ${newImports} } from 'typeorm';`);
    }

    return content;
  }

  private async updateAppModule(
    entityName: string,
    moduleName: string,
  ): Promise<void> {
    const appModulePath = path.join(this.srcPath, 'app.module.ts');

    if (!fs.existsSync(appModulePath)) {
      console.warn('app.module.ts not found, skipping auto-import');
      return;
    }

    let content = fs.readFileSync(appModulePath, 'utf-8');

    // Vérifier si le module est déjà importé
    const importStatement = `import { ${entityName}Module } from './${moduleName}/${moduleName}.module';`;
    if (content.includes(`${entityName}Module`)) {
      console.log(`${entityName}Module already exists in app.module.ts`);
      return;
    }

    // Ajouter l'import après les autres imports
    const lastImportIndex = content.lastIndexOf('import ');
    const endOfLastImport = content.indexOf(';', lastImportIndex) + 1;
    const beforeImports = content.substring(0, endOfLastImport);
    const afterImports = content.substring(endOfLastImport);

    content = `${beforeImports}\n${importStatement}${afterImports}`;

    // Trouver le dernier élément du tableau imports avant le ]
    // On cherche spécifiquement le @Module decorator
    const moduleDecoratorMatch = content.match(/@Module\(\{[\s\S]*?imports:\s*\[([\s\S]*?)\]/);

    if (moduleDecoratorMatch) {
      const importsArray = moduleDecoratorMatch[1];
      // Trouver la dernière ligne non-vide avant le ]
      const lines = importsArray.split('\n').filter(line => line.trim());
      const lastLine = lines[lines.length - 1];

      // Ajouter une virgule si nécessaire
      let newImportsArray = importsArray;
      if (lastLine && !lastLine.trim().endsWith(',')) {
        newImportsArray = importsArray.replace(lastLine, lastLine.trim() + ',');
      }

      // Ajouter le nouveau module
      newImportsArray += `\n    ${entityName}Module,`;

      content = content.replace(
        moduleDecoratorMatch[0],
        moduleDecoratorMatch[0].replace(importsArray, newImportsArray),
      );
    }

    fs.writeFileSync(appModulePath, content);
    console.log(`${entityName}Module added to app.module.ts`);
  }

  async listEntities() {
    const entities: Array<{ name: string; moduleName: string; path: string }> = [];
    const srcPath = this.srcPath;

    if (!fs.existsSync(srcPath)) {
      return entities;
    }

    const folders = fs.readdirSync(srcPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);

    for (const folder of folders) {
      const entityFilePath = path.join(srcPath, folder, `${folder}.entity.ts`);
      if (fs.existsSync(entityFilePath)) {
        entities.push({
          name: this.capitalize(folder),
          moduleName: folder,
          path: path.join(srcPath, folder),
        });
      }
    }

    return entities;
  }

  async getEntitySchema(name: string) {
    const moduleName = name.toLowerCase();
    const entityPath = path.join(this.srcPath, moduleName);
    const entityFilePath = path.join(entityPath, `${moduleName}.entity.ts`);

    if (!fs.existsSync(entityFilePath)) {
      throw new Error(`Entity ${name} not found`);
    }

    // Lire le fichier entity pour extraire les informations
    const entityContent = fs.readFileSync(entityFilePath, 'utf-8');
    const fields = this.parseEntityFields(entityContent);
    const tableName = this.extractTableName(entityContent);

    // Trouver les relations inverses (entités qui pointent vers celle-ci)
    const incomingRelations = await this.findIncomingRelations(name);

    // Filtrer les relations entrantes qui sont déjà des relations sortantes
    // (éviter la duplication pour les relations bidirectionnelles)
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

  /**
   * Trouve toutes les entités qui ont une relation vers l'entité spécifiée
   */
  private async findIncomingRelations(targetEntityName: string): Promise<Array<{
    sourceEntity: string;
    fieldName: string;
    relationType: string;
    inverseProperty: string;
  }>> {
    const incomingRelations: Array<{
      sourceEntity: string;
      fieldName: string;
      relationType: string;
      inverseProperty: string;
    }> = [];

    // Lister toutes les entités
    const entities = await this.listEntities();

    for (const entity of entities) {
      if (entity.name === targetEntityName) continue;

      const entityFilePath = path.join(entity.path, `${entity.moduleName}.entity.ts`);
      if (!fs.existsSync(entityFilePath)) continue;

      const content = fs.readFileSync(entityFilePath, 'utf-8');

      // Chercher les relations qui pointent vers targetEntityName
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

      // ManyToMany - toutes les relations ManyToMany pointant vers targetEntityName
      // Pattern 1: @ManyToMany(() => Target) suivi de @JoinTable puis fieldName
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

      // Pattern 2: @ManyToMany(() => Target, ...) sans @JoinTable (côté inverse)
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
    // Chercher le pattern: @RelationType(() => Target, target => target.inverseProperty)
    const regex = new RegExp(
      `@${relationType}\\(\\(\\)\\s*=>\\s*\\w+,\\s*\\w+\\s*=>\\s*\\w+\\.(\\w+)`,
      'g'
    );
    const matches = [...content.matchAll(regex)];
    // Trouver celui qui correspond au champ
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

  private parseEntityFields(entityContent: string): any[] {
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

      // Parse options
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

    // Parse les relations ManyToOne
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

    // Parse les relations OneToMany
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

    // Parse les relations ManyToMany
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

    // Parse les relations OneToOne
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

  private extractTableName(entityContent: string): string {
    const match = entityContent.match(/@Entity\('([^']+)'\)/);
    return match ? match[1] : '';
  }

  private mapDbTypeToFieldType(dbType: string): string {
    const typeMap = {
      'varchar': 'string',
      'text': 'text',
      'int': 'number',
      'boolean': 'boolean',
      'timestamp': 'date',
    };
    return typeMap[dbType] || 'string';
  }

  async updateEntity(name: string, updateEntityDto: CreateEntityDto) {
    // Récupérer les anciennes relations avant suppression
    const oldSchema = await this.getEntitySchema(name);
    const oldRelations = oldSchema.fields.filter(f => isRelationType(f.type as FieldType));

    // Supprimer l'ancienne entité (sans supprimer la table en base pour conserver les données)
    await this.deleteEntity(name, false, false);

    // Recréer avec les nouvelles données
    const result = await this.generateEntity(updateEntityDto);

    // Nettoyer les relations inverses orphelines
    const newRelations = updateEntityDto.fields.filter(f => isRelationType(f.type));
    await this.cleanupOrphanedInverseRelations(name, oldRelations, newRelations);

    // Supprimer les tables de jonction ManyToMany qui n'existent plus
    await this.cleanupOrphanedJunctionTables(oldSchema.tableName, oldRelations, newRelations);

    return result;
  }

  /**
   * Supprime les tables de jonction ManyToMany qui n'existent plus après une mise à jour
   */
  private async cleanupOrphanedJunctionTables(
    tableName: string,
    oldRelations: any[],
    newRelations: FieldDto[],
  ): Promise<void> {
    const oldManyToMany = oldRelations.filter(r => r.type === 'many-to-many');
    const newManyToMany = newRelations.filter(r => r.type === FieldType.MANY_TO_MANY);

    for (const oldRel of oldManyToMany) {
      // Vérifier si cette relation ManyToMany existe encore
      const stillExists = newManyToMany.some(
        newRel => newRel.name === oldRel.name && newRel.relationTarget === oldRel.relationTarget
      );

      if (!stillExists) {
        // Cette relation ManyToMany a été supprimée, supprimer la table de jonction
        const junctionTableName = `${tableName}_${oldRel.name}`;
        await this.dropJunctionTable(junctionTableName);
      }
    }
  }

  /**
   * Supprime une table de jonction de la base de données
   */
  private async dropJunctionTable(tableName: string): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();
      await queryRunner.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
      console.log(`Dropped junction table: ${tableName}`);
    } catch (e) {
      console.warn(`Failed to drop junction table ${tableName}: ${e.message}`);
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Supprime les relations inverses qui n'existent plus après une mise à jour
   */
  private async cleanupOrphanedInverseRelations(
    sourceEntityName: string,
    oldRelations: any[],
    newRelations: FieldDto[],
  ): Promise<void> {
    for (const oldRel of oldRelations) {
      // Vérifier si cette relation existe encore dans les nouvelles relations
      const stillExists = newRelations.some(
        newRel =>
          newRel.name === oldRel.name &&
          newRel.relationTarget === oldRel.relationTarget
      );

      if (!stillExists && oldRel.relationTarget) {
        // Cette relation a été supprimée, nettoyer la relation inverse
        await this.removeInverseRelationFromTargetEntity(
          sourceEntityName,
          oldRel.relationTarget,
          oldRel.relationInverse || sourceEntityName.toLowerCase() + 's',
        );
      }
    }
  }

  /**
   * Supprime une relation inverse d'une entité cible
   */
  private async removeInverseRelationFromTargetEntity(
    sourceEntityName: string,
    targetEntityName: string,
    inversePropertyName: string,
  ): Promise<void> {
    const targetModuleName = targetEntityName.toLowerCase();
    const targetEntityPath = path.join(this.srcPath, targetModuleName, `${targetModuleName}.entity.ts`);

    if (!fs.existsSync(targetEntityPath)) {
      return;
    }

    let content = fs.readFileSync(targetEntityPath, 'utf-8');

    // Supprimer l'import de l'entité source si elle n'est plus utilisée ailleurs
    const sourceImport = `import { ${sourceEntityName} } from '../${sourceEntityName.toLowerCase()}/${sourceEntityName.toLowerCase()}.entity';\n`;

    // Patterns pour trouver et supprimer la relation inverse
    // Pattern pour @ManyToMany, @OneToMany, @ManyToOne, @OneToOne
    const relationPatterns = [
      // ManyToMany sans JoinTable (relation inverse)
      new RegExp(`\\s*@ManyToMany\\(\\(\\)\\s*=>\\s*${sourceEntityName}[^)]*\\)\\s*\\n?\\s*${inversePropertyName}:\\s*${sourceEntityName}\\[\\];`, 'g'),
      // OneToMany
      new RegExp(`\\s*@OneToMany\\(\\(\\)\\s*=>\\s*${sourceEntityName}[^)]*\\)\\s*\\n?\\s*${inversePropertyName}:\\s*${sourceEntityName}\\[\\];`, 'g'),
      // ManyToOne avec JoinColumn
      new RegExp(`\\s*@ManyToOne\\(\\(\\)\\s*=>\\s*${sourceEntityName}[^)]*\\)\\s*\\n?\\s*@JoinColumn\\([^)]*\\)\\s*\\n?\\s*${inversePropertyName}:\\s*${sourceEntityName};`, 'g'),
      // OneToOne sans JoinColumn (relation inverse)
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
      // Vérifier si l'entité source est encore utilisée ailleurs dans le fichier
      const sourceEntityUsage = new RegExp(`${sourceEntityName}(?![a-zA-Z])`, 'g');
      const matches = content.match(sourceEntityUsage);

      // Si seulement l'import reste (1 match), supprimer l'import
      if (!matches || matches.length <= 1) {
        content = content.replace(sourceImport, '');

        // Nettoyer les imports TypeORM inutilisés
        content = this.cleanupUnusedTypeOrmImports(content);
      }

      fs.writeFileSync(targetEntityPath, content);
      console.log(`Removed inverse relation ${inversePropertyName} from ${targetEntityName}`);
    }
  }

  /**
   * Nettoie les imports TypeORM qui ne sont plus utilisés
   */
  private cleanupUnusedTypeOrmImports(content: string): string {
    const typeOrmImportMatch = content.match(/import \{ ([^}]+) \} from 'typeorm';/);
    if (!typeOrmImportMatch) return content;

    const imports = typeOrmImportMatch[1].split(',').map(i => i.trim());
    const usedImports = imports.filter(imp => {
      // Vérifier si l'import est utilisé ailleurs dans le fichier (pas dans la ligne d'import)
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

  async deleteEntity(name: string, removeFromAppModule: boolean = true, dropTable: boolean = true) {
    const moduleName = name.toLowerCase();
    const entityPath = path.join(this.srcPath, moduleName);

    if (!fs.existsSync(entityPath)) {
      throw new Error(`Entity ${name} not found`);
    }

    // Récupérer le nom de la table et les relations avant de supprimer les fichiers
    let tableName: string | null = null;
    let relationTables: string[] = [];

    try {
      const schema = await this.getEntitySchema(name);
      tableName = schema.tableName;

      // Récupérer les tables de jonction ManyToMany (utilise tableName, pas moduleName)
      const manyToManyRelations = schema.fields.filter(f => f.type === 'many-to-many');
      relationTables = manyToManyRelations.map(rel => `${schema.tableName}_${rel.name}`);
    } catch (e) {
      console.warn(`Could not get entity schema: ${e.message}`);
    }

    // Supprimer le dossier de l'entité
    fs.rmSync(entityPath, { recursive: true, force: true });

    // Retirer du app.module.ts si demandé
    if (removeFromAppModule) {
      await this.removeFromAppModule(this.capitalize(name), moduleName);
    }

    // Supprimer la table et les tables de jonction en base
    if (dropTable && tableName) {
      await this.dropTableFromDatabase(tableName, relationTables);
    }

    return {
      message: `Entity ${name} deleted successfully`,
    };
  }

  /**
   * Supprime une table et ses tables de jonction de la base de données
   */
  private async dropTableFromDatabase(tableName: string, relationTables: string[]): Promise<void> {
    const queryRunner = this.dataSource.createQueryRunner();

    try {
      await queryRunner.connect();

      // Supprimer d'abord les tables de jonction (pour éviter les contraintes FK)
      for (const relationTable of relationTables) {
        try {
          await queryRunner.query(`DROP TABLE IF EXISTS "${relationTable}" CASCADE`);
          console.log(`Dropped junction table: ${relationTable}`);
        } catch (e) {
          console.warn(`Failed to drop junction table ${relationTable}: ${e.message}`);
        }
      }

      // Supprimer la table principale
      try {
        await queryRunner.query(`DROP TABLE IF EXISTS "${tableName}" CASCADE`);
        console.log(`Dropped table: ${tableName}`);
      } catch (e) {
        console.warn(`Failed to drop table ${tableName}: ${e.message}`);
      }
    } finally {
      await queryRunner.release();
    }
  }

  private async removeFromAppModule(
    entityName: string,
    moduleName: string,
  ): Promise<void> {
    const appModulePath = path.join(this.srcPath, 'app.module.ts');

    if (!fs.existsSync(appModulePath)) {
      return;
    }

    let content = fs.readFileSync(appModulePath, 'utf-8');

    // Retirer l'import
    const importStatement = `import { ${entityName}Module } from './${moduleName}/${moduleName}.module';`;
    content = content.replace(importStatement + '\n', '');

    // Retirer du tableau imports
    const moduleReference = `${entityName}Module,`;
    content = content.replace(new RegExp(`\\s*${moduleReference}\\s*`, 'g'), '\n');

    fs.writeFileSync(appModulePath, content);
    console.log(`${entityName}Module removed from app.module.ts`);
  }
}
