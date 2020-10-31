import { CRUD } from './crud.js'
import startCase from 'lodash/startCase.js'
import { Access } from './access.js'
import { isNotNullObj } from '../is-not-null-obj'
import { Duckfficer, Duck } from 'duck-storage'
import { Method } from './method'

const { Schema } = Duckfficer

const CRUDAccess = new Schema({
  create: Access,
  read: Access,
  update: Access,
  delete: Access,
  list: Access,
}, {
  cast (access) {
    if (
      access
      && typeof access === 'object'
      && !Array.isArray(access)
      && !access.hasOwnProperty('create')
      && !access.hasOwnProperty('read')
      && !access.hasOwnProperty('update')
      && !access.hasOwnProperty('delete')
      && !access.hasOwnProperty('list')
    ) {
      return {
        create: access,
        read: access,
        update: access,
        delete: access,
        list: access,
      }
    }
    return access
  }
})

const Model = new Schema({
    type: Object
}, {
  validate (v) {
    if (!(v instanceof Duck)) {
      this.throwError('Invalid model', {field: this, value: v})
    }
  },
  cast (v) {
    if (isNotNullObj(v) && !(v instanceof Duck) && Object.keys(v).length > 0 && v.schema) {
      const schema = Schema.ensureSchema(v.schema)
      return new Duck({ schema })
    }
    return v
  }
})

/**
 * @typedef {Object} Entity
 * @property {String} file
 * @property {String} path - URL path of the entity
 * @property {Schema|Object} schema
 * @property {Object} methods
 */
export const Entity = new Schema({
  file: String,
  path: String,
  name: String,
  duckModel: Model,
  access: CRUDAccess,
  methods: {
    type: Object,
    mapSchema: Method,
    required: false
  }
}, {
  cast (v) {
    if (v && v.file && !v.path) {
      v.path = (`/` + v.file.replace(/\.js$/, '')).replace(/\/_/g, '/:').replace(/\/index$/, '').replace(/^\/+/, '/')
    }
    if (v && v.path && !v.name) {
      v.name = startCase(v.path.split('/').filter(Boolean)[0]).replace(/[\s]+/, '')
    }
    return v
  }
})
