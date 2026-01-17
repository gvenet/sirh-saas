import app from '@adonisjs/core/services/app'
import { readFile, writeFile } from 'node:fs/promises'
import logger from '@adonisjs/core/services/logger'

export default class RoutesService {
  private toPascalCase(str: string): string {
    return str
      .split(/[-_]/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join('')
  }

  /**
   * Add routes for an entity
   */
  async addRoutes(modelName: string, fileName: string) {
    const routesPath = app.makePath('start/routes.ts')
    let content = await readFile(routesPath, 'utf-8')

    const importStatement = `const ${modelName}Controller = () => import('#controllers/${fileName}_controller')\n`
    const routeGroup = `
// ${modelName} routes
router.group(() => {
  router.get('/', [${modelName}Controller, 'index'])
  router.get('/:id', [${modelName}Controller, 'show'])
  router.post('/', [${modelName}Controller, 'store'])
  router.put('/:id', [${modelName}Controller, 'update'])
  router.delete('/:id', [${modelName}Controller, 'destroy'])
}).prefix('/${fileName}s')
`

    // Add import after the router import
    if (!content.includes(importStatement)) {
      content = content.replace(
        "import router from '@adonisjs/core/services/router'",
        `import router from '@adonisjs/core/services/router'\n${importStatement}`
      )
    }

    // Add routes at the end
    if (!content.includes(`// ${modelName} routes`)) {
      content += routeGroup
    }

    await writeFile(routesPath, content)
    logger.info({ modelName, fileName }, 'Routes added')
  }

  /**
   * Remove routes for an entity
   */
  async removeRoutes(fileName: string) {
    const routesPath = app.makePath('start/routes.ts')
    let content = await readFile(routesPath, 'utf-8')

    const modelName = this.toPascalCase(fileName)

    // Remove import
    const importRegex = new RegExp(
      `const ${modelName}Controller = \\(\\) => import\\('#controllers/${fileName}_controller'\\)\\n`,
      'g'
    )
    content = content.replace(importRegex, '')

    // Remove route group
    const routeRegex = new RegExp(
      `\\n// ${modelName} routes[\\s\\S]*?\\.prefix\\('/${fileName}s'\\)\\n`,
      'g'
    )
    content = content.replace(routeRegex, '')

    await writeFile(routesPath, content)
    logger.info({ fileName }, 'Routes removed')
  }
}
