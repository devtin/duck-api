export default {
  read: {
    description: 'reads sandy\'s friends',
    handler (ctx) {
      ctx.body = `yo friends!`
    }
  }
}
