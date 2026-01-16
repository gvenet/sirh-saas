import EntityPage, { PageType } from '#models/entity_page'
import PageField, { FieldDisplayType } from '#models/page_field'
import type { FieldDefinition } from './generator/generator_service.js'

export default class EntityPageService {
  /**
   * Generate default pages for an entity (only if they don't exist)
   */
  async generateDefaultPages(entityName: string, fields: FieldDefinition[]) {
    // Check if default pages already exist
    const existingPages = await EntityPage.query()
      .where('entityName', entityName)
      .where('isDefault', true)

    // If default pages exist, skip creation
    if (existingPages.length > 0) {
      return {
        listPage: existingPages.find((p) => p.pageType === PageType.LIST),
        viewPage: existingPages.find((p) => p.pageType === PageType.VIEW),
        editPage: existingPages.find((p) => p.pageType === PageType.EDIT),
      }
    }

    // Create LIST page
    const listPage = await EntityPage.create({
      entityName,
      pageType: PageType.LIST,
      name: `${entityName} List`,
      description: `Default list view for ${entityName}`,
      isDefault: true,
      order: 0,
      active: true,
    })

    // Create VIEW page
    const viewPage = await EntityPage.create({
      entityName,
      pageType: PageType.VIEW,
      name: `${entityName} View`,
      description: `Default view for ${entityName}`,
      isDefault: true,
      order: 0,
      active: true,
    })

    // Create EDIT page
    const editPage = await EntityPage.create({
      entityName,
      pageType: PageType.EDIT,
      name: `${entityName} Edit`,
      description: `Default edit form for ${entityName}`,
      isDefault: true,
      order: 0,
      active: true,
    })

    // Create fields for each page
    for (const page of [listPage, viewPage, editPage]) {
      await this.createDefaultFields(page, fields)
    }

    return { listPage, viewPage, editPage }
  }

  /**
   * Create default fields for a page
   */
  private async createDefaultFields(page: EntityPage, fields: FieldDefinition[]) {
    let order = 0

    for (const field of fields) {
      // Skip relation fields for list pages
      if (page.pageType === PageType.LIST && field.relation?.type !== 'many-to-one') {
        if (field.relation) continue
      }

      const displayType = this.getDisplayType(field, page.pageType)
      const fieldName = field.relation?.type === 'many-to-one' ? `${field.name}Id` : field.name

      await PageField.create({
        entityPageId: page.id,
        fieldName,
        displayType,
        label: this.formatLabel(field.name),
        order: order++,
        colSpan: page.pageType === PageType.LIST ? 12 : 6,
        visible: true,
        readOnly: page.pageType === PageType.VIEW,
      })
    }
  }

  /**
   * Get display type based on field type and page type
   */
  private getDisplayType(field: FieldDefinition, pageType: PageType): FieldDisplayType {
    if (field.relation?.type === 'many-to-one') {
      return FieldDisplayType.SELECT
    }

    switch (field.type) {
      case 'string':
        return FieldDisplayType.TEXT
      case 'text':
        return FieldDisplayType.TEXTAREA
      case 'number':
      case 'integer':
      case 'float':
        return FieldDisplayType.NUMBER
      case 'boolean':
        return FieldDisplayType.BOOLEAN
      case 'date':
        return FieldDisplayType.DATE
      case 'datetime':
        return FieldDisplayType.DATETIME
      default:
        return FieldDisplayType.TEXT
    }
  }

  /**
   * Format field name as label
   */
  private formatLabel(name: string): string {
    return name
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (str) => str.toUpperCase())
      .trim()
  }

  /**
   * Get pages for an entity
   */
  async getPagesForEntity(entityName: string) {
    return EntityPage.query()
      .where('entityName', entityName)
      .where('active', true)
      .preload('fields', (query) => query.orderBy('order', 'asc'))
      .orderBy('order', 'asc')
  }

  /**
   * Get a specific page with fields
   */
  async getPage(id: number) {
    return EntityPage.query()
      .where('id', id)
      .preload('fields', (query) => query.orderBy('order', 'asc'))
      .firstOrFail()
  }

  /**
   * Update a page
   */
  async updatePage(id: number, data: Partial<EntityPage>) {
    const page = await EntityPage.findOrFail(id)
    page.merge(data)
    await page.save()
    return page
  }

  /**
   * Update fields for a page
   */
  async updateFields(pageId: number, fields: Partial<PageField>[]) {
    const page = await EntityPage.findOrFail(pageId)

    // Delete existing fields
    await PageField.query().where('entityPageId', pageId).delete()

    // Create new fields
    for (const fieldData of fields) {
      await PageField.create({
        ...fieldData,
        entityPageId: page.id,
      })
    }

    return this.getPage(pageId)
  }

  /**
   * Remove all pages for an entity
   */
  async removeByEntity(entityName: string) {
    await EntityPage.query().where('entityName', entityName).delete()
  }
}
