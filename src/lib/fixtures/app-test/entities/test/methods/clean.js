module.exports = {
  verb: 'get',
  description: 'a test',
  access (ctx) {
    switch (ctx.$pleasure.get.level) {
      case 1:
        return true

      case 2:
        return ['name']

      default:
        return false
    }
  },
  input: {
    level: {
      type: Number,
      required: false
    }
  },
  handler: () => ({ level }) => {
    if (!level) {
      return
    }

    if (level === 1) {
      return { name: 'Martin', email: 'tin@devtin.io' }
    }

    return { name: 'Martin' }
  }
}
