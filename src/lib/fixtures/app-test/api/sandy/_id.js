export default {
  read: {
    description: 'reads sandy by id',
    handler (ctx) {
      ctx.body = `hi id ${ ctx.params.id }`
    }
  },
  delete: {
    description: 'deletes sandy by id',
    get: false,
    handler (ctx) {
      throw new Error(`Pow! ${ ctx.params.id }`)
    }
  }
}
