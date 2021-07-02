const { sanitizeQuery } = require('directus/dist/utils/sanitize-query')
const gravatar = require('gravatar')

module.exports = function registerEndpoint(router, { services, exceptions, database }) {
  const { ItemsService } = services
  const { ServiceUnavailableException } = exceptions

  router.post('/create', async (req, res, next) => {
    const commentsService = new ItemsService('comments', { schema: req.schema, accountability: req.accountability })

    const query = req.query?.query || {}
    const sanitizedQuery = sanitizeQuery(
      {
        fields: query.fields || '*',
        ...query
      },
      req.accountability || null
    )

    try {
      const commentId = await commentsService.createOne({
        content: req.query.content || req.body.content,
        raw: req.query.content || req.body.content,
        author_name: req.query.author_name || req.body.author_name,
        author_email: req.query.author_email || req.body.author_email,
        parent: req.query.parent_id || req.body.parent_id,
        thread: [{
          item: req.query.thread_id || req.body.thread_id,
          collection: req.query.thread_type || req.body.thread_type
        }]
      })
  
      const [comment] = await commentsService.readByQuery({
        ...sanitizedQuery,
        filter: {
          ...sanitizedQuery.filter,
          id: {
            _eq: commentId
          }
        }
      })

      res.json({
        data: comment
      })
    } catch (error) {
      next(new ServiceUnavailableException(error.message))
    }
  })
  
  router.get('/:id/gravatar', async (req, res, next) => {
    const commentsService = new ItemsService('comments', { schema: req.schema })
  
    const comment = await commentsService.readOne(req.params.id)

    res.json({
      data: gravatar.url(comment.author_email, { d: 'robohash' })
    })
  })
}
