import type { HttpContext } from '@adonisjs/core/http'
import EntityPageService from '#services/entity_page_service'
import { inject } from '@adonisjs/core'
import PageField from '#models/page_field'


@inject()
export default class EntityPageController {
  constructor(private entityPageService: EntityPageService) {}

  /**
   * Get all pages for an entity
   */
  async index({ params, response }: HttpContext) {
    const pages = await this.entityPageService.getPagesForEntity(params.entityName)
    return response.json(pages)
  }

  /**
   * Get a specific page
   */
  async show({ params, response }: HttpContext) {
    const page = await this.entityPageService.getPage(params.id)
    return response.json(page)
  }

  /**
   * Update a page
   */
  async update({ params, request, response }: HttpContext) {
    const data = request.body()
    const page = await this.entityPageService.updatePage(params.id, data)
    return response.json(page)
  }

  /**
   * Update fields for a page
   */
  async updateFields({ params, request, response }: HttpContext) {
    const { fields } = request.body()
    const page = await this.entityPageService.updateFields(params.id, fields)
    return response.json(page)
  }

  /**
   * Add a field to a page
   */
  async addField({ params, request, response }: HttpContext) {
    const data = request.body()
    const field = await PageField.create({
      ...data,
      entityPageId: Number(params.pageId),
    })
    return response.json(field)
  }

  /**
   * Update a single field
   */
  async updateField({ params, request, response }: HttpContext) {
    const data = request.body()
    const field = await PageField.findOrFail(params.fieldId)
    field.merge(data)
    await field.save()
    return response.json(field)
  }

  /**
   * Delete a field
   */
  async deleteField({ params, response }: HttpContext) {
    const field = await PageField.findOrFail(params.fieldId)
    await field.delete()
    return response.json({ message: 'Field deleted' })
  }

  /**
   * Reorder fields
   */
  async reorderFields({ params, request, response }: HttpContext) {
    const { fieldIds } = request.body()
    for (let i = 0; i < fieldIds.length; i++) {
      await PageField.query().where('id', fieldIds[i]).update({ order: i })
    }
    const page = await this.entityPageService.getPage(params.pageId)
    return response.json(page)
  }
}
