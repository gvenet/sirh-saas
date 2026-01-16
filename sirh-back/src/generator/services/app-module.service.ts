import { Injectable, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';

@Injectable()
export class AppModuleService {
  private readonly logger = new Logger(AppModuleService.name);
  private readonly srcPath = path.join(process.cwd(), 'src');

  async updateAppModule(
    entityName: string,
    moduleName: string,
  ): Promise<void> {
    this.logger.warn('updateAppModule');
    const appModulePath = path.join(this.srcPath, 'app.module.ts');

    if (!fs.existsSync(appModulePath)) {
      this.logger.warn('app.module.ts not found, skipping auto-import');
      return;
    }

    let content = fs.readFileSync(appModulePath, 'utf-8');

    const importStatement = `import { ${entityName}Module } from './entities/${moduleName}/${moduleName}.module';`;
    if (content.includes(`${entityName}Module`)) {
      this.logger.log(`${entityName}Module already exists in app.module.ts`);
      return;
    }

    // Ajouter l'import après les autres imports
    const lastImportIndex = content.lastIndexOf('import ');
    const endOfLastImport = content.indexOf(';', lastImportIndex) + 1;
    const beforeImports = content.substring(0, endOfLastImport);
    const afterImports = content.substring(endOfLastImport);

    content = `${beforeImports}\n${importStatement}${afterImports}`;

    // Trouver le tableau imports principal du @Module decorator
    const moduleMatch = content.match(/@Module\(\{[\s\S]*?imports:\s*\[([\s\S]*?)\],\s*(controllers|providers):/);

    if (moduleMatch) {
      // Compter les crochets pour trouver la fin du tableau imports principal
      const moduleStart = content.indexOf('@Module({');
      const importsStart = content.indexOf('imports:', moduleStart);
      const bracketStart = content.indexOf('[', importsStart);

      let depth = 1;
      let bracketEnd = bracketStart + 1;
      while (depth > 0 && bracketEnd < content.length) {
        if (content[bracketEnd] === '[') depth++;
        if (content[bracketEnd] === ']') depth--;
        bracketEnd++;
      }
      bracketEnd--;

      const actualImportsArray = content.substring(bracketStart + 1, bracketEnd);

      // Trouver la dernière ligne non-vide avant le ]
      const lines = actualImportsArray.split('\n').filter(line => line.trim());
      const lastLine = lines[lines.length - 1];

      // Ajouter une virgule si nécessaire
      let newImportsArray = actualImportsArray;
      if (lastLine && !lastLine.trim().endsWith(',')) {
        newImportsArray = actualImportsArray.replace(lastLine, lastLine.trim() + ',');
      }

      // Ajouter le nouveau module
      newImportsArray += `\n    ${entityName}Module,`;

      // Remplacer le contenu du tableau imports
      const newContent = content.substring(0, bracketStart + 1) + newImportsArray + content.substring(bracketEnd);
      content = newContent;
    }

    fs.writeFileSync(appModulePath, content);
    this.logger.log(`${entityName}Module added to app.module.ts`);
  }

  async removeFromAppModule(
    entityName: string,
    moduleName: string,
  ): Promise<void> {
    this.logger.warn('removeFromAppModule');
    const appModulePath = path.join(this.srcPath, 'app.module.ts');

    if (!fs.existsSync(appModulePath)) {
      return;
    }

    let content = fs.readFileSync(appModulePath, 'utf-8');

    // Retirer l'import
    const importStatement = `import { ${entityName}Module } from './entities/${moduleName}/${moduleName}.module';`;
    content = content.replace(importStatement + '\n', '');

    // Retirer du tableau imports
    const moduleReference = `${entityName}Module,`;
    content = content.replace(new RegExp(`\\s*${moduleReference}\\s*`, 'g'), '\n');

    fs.writeFileSync(appModulePath, content);
    this.logger.log(`${entityName}Module removed from app.module.ts`);
  }
}
