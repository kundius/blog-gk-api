const expressPlayground = require('graphql-playground-middleware-express').default

module.exports = function registerEndpoint(router) {
	router.get('/', expressPlayground({ endpoint: '/graphql' }))
}
