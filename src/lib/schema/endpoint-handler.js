import { Access } from './access.js'
import { isNotNullObj } from '../is-not-null-obj'
import { Duckfficer } from 'duck-storage'

const { Schema, Transformers } = Duckfficer


Transformers.Input = {
  settings: {
    autoCast: true
  },
  cast (v) {
    if (isNotNullObj(v)) {
      return Schema.ensureSchema(v)
    }
    return v
  },
  validate (v) {
    if (typeof v !== 'boolean' && !(v instanceof Schema)) {
      this.throwError(`Invalid schema or boolean at path ${this.fullPath}`, { value:v, field: this })
    }
  }
}

Transformers.Output = (() => {
  const allKeysAreNumbers = obj => {
    if (isNotNullObj(obj)) {
      return Object.keys(obj).reduce((valid, key) => {
        return valid && /^\d+$/.test(key)
      }, true)
    }
  }

  return {
    settings: {
      autoCast: true
    },
    cast (v) {
      if (!(v instanceof Schema) && allKeysAreNumbers(v)) {
        return v
      }

      if (isNotNullObj(v) && !(v instanceof Schema) && v.schema) {
        return {
          200: v
        }
      }

      return v ? {
        200: {
          schema: isNotNullObj(v) ? Schema.ensureSchema(v) : {}
        }
      } : false
    },
    validate (v) {
      if (v && !allKeysAreNumbers(v)) {
        this.throwError(`Invalid output at path ${this.fullPath}`, { value:v, field: this })
      }
    }
  }
})()

/**
 * @typedef {Object} EndpointHandler
 * @property {Function} handler
 * @property {Access} [access] - Schema for the url get query
 * @property {Schema} [get] - Schema for the url get query
 * @property {Schema} [body] - Schema for the post body object (not available for get endpoints)
 */

export const EndpointHandler = new Schema({
  access: Access,
  handler: Function,
  example: {
    type: String,
    required: false
  },
  summary: {
    type: String,
    required: false
  },
  description: String,
  errors: {
    type: Object,
    required: false,
    mapSchema: [Schema, Object],
  },
  events: {
    type: Object,
    required: false,
    mapSchema: [Schema, Object],
  },
  // schemas will be parse with ({ state: { ctx, level } })
  get: {
    type: 'Input',
    default: true
  },
  body: {
    type: 'Input',
    default: true
  },
  output: {
    type: 'Output',
    default: true
  }
}, {
  cast (v) {
    if (typeof v === 'function') {
      return {
        handler: v
      }
    }
    return v
  },
  validate (v) {
    if (v && v.output) {
      Object.keys(v.output).forEach(v => {
        if (!/^[\d]+$/.test(v)) {
          this.throwError(`path output.${v}:  ${v} should be a number`, {field: this.schemaAtPath('output')})
        }
      })
    }
  }
})
