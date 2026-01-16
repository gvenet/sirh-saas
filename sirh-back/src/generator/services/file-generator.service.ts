import { Injectable, Logger } from '@nestjs/common';
import { FieldDto, FieldType, isRelationType } from '../dto/field.dto';

export interface GeneratedFile {
  path: string;
  content: string;
}

@Injectable()
export class FileGeneratorService {
  private readonly logger = new Logger(FileGeneratorService.name);

  generateEntityFile(
    entityName: string,
    tableName: string,
    fields: FieldDto[],
  ): string {
    this.logger.warn('generateEntityFile');

    const normalFields = fields.filter(f => !isRelationType(f.type));
    const relationFields = fields.filter(f => isRelationType(f.type));

    const typeOrmImports = ['Entity', 'PrimaryGeneratedColumn', 'Column', 'CreateDateColumn', 'UpdateDateColumn'];

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

    const relatedEntitiesImports = relationFields
      .filter(f => f.relationTarget)
      .map(f => {
        const targetModule = f.relationTarget!.toLowerCase();
        return `import { ${f.relationTarget} } from '../${targetModule}/${targetModule}.entity';`;
      })
      .filter((value, index, self) => self.indexOf(value) === index)
      .join('\n');

    return `import { ${typeOrmImports.join(', ')} } from 'typeorm';
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

  generateDtoFiles(
    entityName: string,
    fields: FieldDto[],
  ): { createDto: string; updateDto: string } {
    this.logger.warn('generateDtoFiles');
    const moduleName = entityName.toLowerCase();

    const normalFields = fields.filter(f => !isRelationType(f.type));
    const relationFields = fields.filter(f => isRelationType(f.type));

    const hasDateField = normalFields.some((field) => field.type === FieldType.DATE);
    const hasRelations = relationFields.length > 0;

    const transformImport = hasDateField || hasRelations
      ? "import { Type } from 'class-transformer';\n"
      : '';

    const validatorImports = ['IsString', 'IsNumber', 'IsBoolean', 'IsDate', 'IsEmail', 'IsOptional'];
    if (hasRelations) {
      validatorImports.push('IsUUID', 'IsArray');
    }

    const createDto = `import { ${validatorImports.join(', ')} } from 'class-validator';
${transformImport}
export class Create${entityName}Dto {
${normalFields.map((field) => this.generateDtoField(field, false)).join('\n')}
${relationFields.length > 0 ? '\n' + relationFields.map((field) => this.generateRelationDtoField(field)).join('\n') : ''}
}
`;

    const updateDto = `import { PartialType } from '@nestjs/mapped-types';
import { Create${entityName}Dto } from './create-${moduleName}.dto';

export class Update${entityName}Dto extends PartialType(Create${entityName}Dto) {}
`;

    return { createDto, updateDto };
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

    if (field.type === FieldType.MANY_TO_ONE || field.type === FieldType.ONE_TO_ONE) {
      return `${optional}  @IsUUID()
  ${field.name}Id?: string;`;
    }

    if (field.type === FieldType.ONE_TO_MANY || field.type === FieldType.MANY_TO_MANY) {
      return `${optional}  @IsArray()
  @IsUUID('4', { each: true })
  ${field.name}Ids?: string[];`;
    }

    return '';
  }

  generateServiceFile(
    entityName: string,
    moduleName: string,
    fields?: FieldDto[],
  ): string {
    this.logger.warn('generateServiceFile');
    const relationFields = fields?.filter(f => isRelationType(f.type)) || [];
    const relationNames = relationFields.map(f => `'${f.name}'`).join(', ');
    const hasRelations = relationFields.length > 0;

    return `import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ${entityName} } from './${moduleName}.entity';
import { Create${entityName}Dto } from './create-${moduleName}.dto';
import { Update${entityName}Dto } from './update-${moduleName}.dto';

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
  }

  generateControllerFile(
    entityName: string,
    moduleName: string,
  ): string {
    this.logger.warn('generateControllerFile');
    return `import {
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
import { Create${entityName}Dto } from './create-${moduleName}.dto';
import { Update${entityName}Dto } from './update-${moduleName}.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';

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
  }

  generateModuleFile(
    entityName: string,
    moduleName: string,
  ): string {
    this.logger.warn('generateModuleFile');
    return `import { Module } from '@nestjs/common';
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
  }

  getColumnType(fieldType: FieldType): string {
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

  getTypeScriptType(fieldType: FieldType): string {
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
}
