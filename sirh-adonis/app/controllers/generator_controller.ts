import type { HttpContext } from '@adonisjs/core/http'
import GeneratorService from '#services/generator/generator_service'
import { inject } from '@adonisjs/core'

@inject()
export default class GeneratorController {
  constructor(private generatorService: GeneratorService) {}

  /**
   * List all generated entities
   */
  async listEntities({ response }: HttpContext) {
    const entities = await this.generatorService.listEntities()
    return response.json(entities)
  }

  /**
   * Generate a new entity
   */
  async generateEntity({ request, response }: HttpContext) {
    const { name, tableName, fields } = request.body()

    if (!name || !fields || !Array.isArray(fields)) {
      return response.status(400).json({
        error: 'name and fields are required',
      })
    }

    const result = await this.generatorService.generateEntity({
      name,
      tableName: tableName || name.toLowerCase() + 's',
      fields,
    })

    return response.status(201).json(result)
  }

  /**
   * Delete an entity
   */
  async deleteEntity({ params, request, response }: HttpContext) {
    const { dropTable = true, removeFromAppModule = true } = request.qs()

    const result = await this.generatorService.deleteEntity(
      params.name,
      dropTable === 'true' || dropTable === true
    )

    return response.json(result)
  }
}
