const { sanitizeQuery } = require('directus/dist/utils/sanitize-query')
const { v4: uuidv4 } = require('uuid')

module.exports = function registerEndpoint(router, { services, exceptions, database }) {
	const { ItemsService } = services
	const { ServiceUnavailableException, InvalidPayloadException } = exceptions

	router.get('/register-subscriber', async (req, res, next) => {
    if (!req.query.email) {
      next(new InvalidPayloadException('Не указан e-mail'))
    }

    try {
      const subscriber = await database('subscribers')
        .where('email', req.query.email)
        .first()

      if (subscriber) {
        res.json({
          success: false,
          message: 'Этот e-mail уже подписан на рассылку'
        })
      }

      await database('subscribers')
        .insert({
          id: uuidv4(),
          email: req.query.email,
          date_created: new Date()
        })

      res.json({
        success: true,
        message: 'Вы подписались на рассылку'
      })
    } catch (error) {
      next(new ServiceUnavailableException(error.message))
    }
	})

	router.get('/:id/register-like', async (req, res, next) => {
    try {
      const [article] = await database('articles')
        .where('id', req.params.id)
        .update({
          likes_count: database.raw('coalesce(likes_count, 0) + 1')
        }, ['likes_count'])

      res.json({ data: article.likes_count })
    } catch (error) {
      next(new ServiceUnavailableException(error.message))
    }
	})

	router.get('/:id/register-hit', async (req, res, next) => {
    try {
      const [article] = await database('articles')
        .where('id', req.params.id)
        .update({
          likes_count: database.raw('coalesce(likes_count, 0) + 1')
        }, ['likes_count'])

      res.json({ data: article.likes_count })
    } catch (error) {
      next(new ServiceUnavailableException(error.message))
    }
	})

	router.get('/:id/related', async (req, res, next) => {
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

	router.get('/search', async (req, res, next) => {
    const { search, limit = 10, page = 1 } = req.query

    if (typeof search === 'undefined') {
      next(new InvalidPayloadException('search not defined'))
    }

    const q = search.split(' ').join('&')

    try {
      const count = await database('articles')
        .count()
        .whereRaw('make_tsvector(articles.name, articles.content) @@ to_tsquery(?)', q)
        .first()

      const data = await database('articles')
        .select('articles.id')
        .whereRaw('make_tsvector(articles.name, articles.content) @@ to_tsquery(?)', q)
        .orderByRaw('ts_rank(make_tsvector(articles.name, articles.content), to_tsquery(?), 1) DESC', q)
        .limit(limit)
        .offset((page - 1) * limit)

      res.json({
        data: data.map(item => item.id),
        meta: {
          search_count: count.count
        }
      })
    } catch (error) {
      next(new ServiceUnavailableException(error.message))
    }
	})
}
