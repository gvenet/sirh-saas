import { Injectable } from '@nestjs/common';
import { CreateEntityDto } from './dto/create-entity.dto';
import { FieldDto, FieldType } from './dto/field.dto';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class GeneratorService {
  private readonly srcPath = path.join(process.cwd(), 'src');

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
    await this.generateServiceFile(modulePath, entityName, moduleName);
    await this.generateControllerFile(modulePath, entityName, moduleName);
    await this.generateModuleFile(modulePath, entityName, moduleName);

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
    const content = `import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('${tableName}')
export class ${entityName} {
  @PrimaryGeneratedColumn('uuid')
  id: string;

${fields.map((field) => this.generateFieldColumn(field)).join('\n\n')}

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

  private async generateDtoFiles(
    modulePath: string,
    entityName: string,
    fields: FieldDto[],
  ) {
    const moduleName = entityName.toLowerCase();

    // Create DTO
    const hasDateField = fields.some((field) => field.type === FieldType.DATE);
    const transformImport = hasDateField
      ? "import { Type } from 'class-transformer';\n"
      : '';

    const createDtoContent = `import { IsString, IsNumber, IsBoolean, IsDate, IsEmail, IsOptional } from 'class-validator';
${transformImport}
export class Create${entityName}Dto {
${fields.map((field) => this.generateDtoField(field, false)).join('\n')}
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

  private async generateServiceFile(
    modulePath: string,
    entityName: string,
    moduleName: string,
  ) {
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
    return this.${moduleName}Repository.find();
  }

  async findOne(id: string): Promise<${entityName}> {
    const ${moduleName} = await this.${moduleName}Repository.findOne({ where: { id } });
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

    return {
      name,
      tableName,
      fields,
      moduleName,
    };
  }

  private parseEntityFields(entityContent: string): any[] {
    const fields: Array<{
      name: any;
      type: string;
      required: boolean;
      unique: boolean;
      defaultValue: any;
    }> = [];
    const columnRegex = /@Column\((.*?)\)\s+(\w+):\s*(\w+);/gs;
    let match;

    while ((match = columnRegex.exec(entityContent)) !== null) {
      const options = match[1];
      const fieldName = match[2];
      const fieldTypeTs = match[3];

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
    // Supprimer l'ancienne entité
    await this.deleteEntity(name, false);

    // Recréer avec les nouvelles données
    return this.generateEntity(updateEntityDto);
  }

  async deleteEntity(name: string, removeFromAppModule: boolean = true) {
    const moduleName = name.toLowerCase();
    const entityPath = path.join(this.srcPath, moduleName);

    if (!fs.existsSync(entityPath)) {
      throw new Error(`Entity ${name} not found`);
    }

    // Supprimer le dossier de l'entité
    fs.rmSync(entityPath, { recursive: true, force: true });

    // Retirer du app.module.ts si demandé
    if (removeFromAppModule) {
      await this.removeFromAppModule(this.capitalize(name), moduleName);
    }

    return {
      message: `Entity ${name} deleted successfully`,
    };
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
