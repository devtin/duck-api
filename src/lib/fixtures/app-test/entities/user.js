export default {
  model: {
    schema: {
      name: String
    },
    methods: {
      // POST => /user/:id/clean
      clean: {
        description: 'cleans user',
        handler: () => (doc) => {
          return `Just cleaned ${ doc._id } / ${ doc.name }`
        }
      },
      touch: {
        description: 'touches user',
        handler: () => (doc, { ctx, entity }) => {
          return ctx.$pleasure.dbDriver.updateEntry(entity.name, doc._id, {
            accessed: Date.now()
          })
        }
      }
    }
  },
  access: {
    create (/*ctx*/) {
      // compute output access
      return true
    }
  },
  methods: {
    // /user.find-papo
    // default enable by post
    findPapo: {
      description: 'reads papo',
      handler: () => (ctx) => {
        ctx.body = 'hey-yo sandy qué pasó guasap?'
      }
    }
  }
}
