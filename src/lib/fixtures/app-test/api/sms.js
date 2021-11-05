// this will be interpreted by a plugin
// const smsApi = require('some-sms-api')
let myApiLibrary

export default {
  create: {
    description: 'creates sms',
    body: {
      name: String,
      created: Date
    },
    handler: () => (ctx) => {
      ctx.body = ctx.$pleasure
    }
  }
}
