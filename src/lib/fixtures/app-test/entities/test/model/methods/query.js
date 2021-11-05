module.exports = {
  description: 'a test',
  input: {
    name: String,
    email: String
  },
  events: {
    queried: {
      type: Array
    }
  },
  handler: (di) => {
    return function (...args) {
      if (!this.called) {
        this.called = []
      }
      this.called.push(...args)
      this.$emit('queried', args)
      return args
    }
  }
}
