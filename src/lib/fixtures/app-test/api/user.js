export default {
  create: {
    description: 'creates user',
    handler (ctx) {
      ctx.body = 'ñaca'
    }
  },
  read: {
    description: 'reads user',
    get: {
      name: String
    },
    async handler (ctx) {
      ctx.body = ctx.$pleasure || { done: true }
    }
  }
}
