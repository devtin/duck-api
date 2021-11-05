export default {
  create: {
    description: 'creates user',
    handler: () => (ctx) => {
      ctx.body = 'ñaca'
    }
  },
  read: {
    description: 'reads user',
    get: {
      name: String
    },
    handler: () => async (ctx) => {
      ctx.body = ctx.$pleasure || { done: true }
    }
  }
}
