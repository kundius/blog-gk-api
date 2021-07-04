const slugify = require('slugify')

const slugifyParams = {
  remove: /[*+~,.()'"\?!:@]/g
}

module.exports = function registerHook({ database, services }) {
  const { ItemsService } = services
  return {
    'items.create.before': async function (input, context) {
      if (context.collection !== 'articles') return input
      
      if (!input.alias) {
        input.alias = slugify(input.name.toLowerCase(), slugifyParams)
      }

      return input
    },
    'items.update.before': async function (input, context) {
      if (context.collection !== 'articles') return input

      if (typeof input.alias !== 'undefined' && !input.alias) {
        let name = input.name
        if (!name) {
          const article = await database(context.collection)
            .select('name')
            .where('id', context.item[0])
            .first()
          name = article.name
        }
        input.alias = slugify(name.toLowerCase(), slugifyParams)
      }

      return input
    },
  }
}
