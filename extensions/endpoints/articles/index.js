const { sanitizeQuery } = require('directus/dist/utils/sanitize-query')

module.exports = function registerEndpoint(router, { services, exceptions, database }) {
	const { ItemsService } = services
	const { ServiceUnavailableException } = exceptions

	router.get('/related/:id', async (req, res, next) => {
		const articlesService = new ItemsService('articles', { schema: req.schema, accountability: req.accountability })

    const sanitizedQuery = sanitizeQuery(
      {
        fields: req.query.fields || '*',
        ...req.query
      },
      req.accountability || null
    )

    try {
      const mainData = await database('articles')
        .join('categories', 'articles.category', 'categories.id')
        .join('sections', 'categories.section', 'sections.id')
        .select(
          { articleId: 'articles.id' },
          { categoryId: 'categories.id' },
          { sectionId: 'sections.id' }
        )
        .where('articles.id', req.params.id)
        .first()

      const relatedIds = await database('articles')
        .join('categories', 'articles.category', 'categories.id')
        .join('sections', 'categories.section', 'sections.id')
        .select('articles.id')
        .where('sections.id', mainData.sectionId)
        .limit(sanitizedQuery.limit)
        .orderByRaw('random()')

      const relatedArticles = await articlesService
        .readByQuery({
          ...sanitizedQuery,
          filter: {
            ...sanitizedQuery.filter,
            id: {
              _in: relatedIds.map(item => item.id)
            }
          }
        })

      res.json({
        data: relatedArticles
      })
    } catch (error) {
      next(new ServiceUnavailableException(error.message))
    }
	})
}
