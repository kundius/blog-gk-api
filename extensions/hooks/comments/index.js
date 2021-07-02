const sanitizeHtml = require('sanitize-html')

module.exports = function registerHook({ database, services }) {
  const { ItemsService } = services
  return {
    'items.create.before': async function (input, context) {
      if (context.collection !== 'comments') return input
      input.content = sanitizeHtml(input.raw)
      return input
    },
    'items.create': async function (context) {
      if (context.collection !== 'comments') return

      await database(context.payload.thread[0].collection)
        .where('id', context.payload.thread[0].item)
        .increment('comments_count', 1)
    },
    'items.delete.before': async function (context) {
      if (context.collection !== 'comments') return

      const commentsService = new ItemsService('comments', {
        schema: context.schema,
        accountability: context.accountability
      })

      for (const id of context.item) {
        const [comment] = await commentsService.readByQuery({
          fields: ['id', 'thread.collection', 'thread.item'],
          filter: {
            id: {
              _eq: id
            }
          }
        })

        await database(comment.thread[0].collection)
          .where('id', comment.thread[0].item)
          .decrement('comments_count', 1)
      }
    }
  }
}
