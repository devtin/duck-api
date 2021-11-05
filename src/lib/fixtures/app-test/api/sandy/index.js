export default {
  read: {
    description: 'retrieves sandies',
    get: {
      q: {
        type: String,
        required: false,
        cast (v) {
          if (typeof v === 'number') {
            return v.toString()
          }
          return v
        }
      }
    },
    handler: () => (ctx) => {
      ctx.body = `Amazing ${ ctx.$pleasure.get.q || '' }`
    }
  }
}
