import { Duckfficer } from 'duck-storage'

const { Schema } = Duckfficer

export const Method = new Schema({
  access: {
    type: Function,
    required: false
  },
  verb: {
    type: String,
    enum: ['post', 'get', 'patch', 'delete'],
    default: 'post'
  },
  handler: Function,
  description: String,
  input: {
    type: [Schema, Object, Boolean],
    default: false
  },
  output: {
    type: [Schema, Object, Boolean],
    default: false
  },
  events: {
    type: Object,
    required: false,
    mapSchema: [Schema, Object]
  },
  errors: {
    type: Object,
    required: false,
    mapSchema: [Schema, Object]
  }
}, {
  cast (v) {
    if (typeof v === 'function') {
      return {
        handler: v
      }
    }
    return v
  }
})
