import { EndpointHandler } from './endpoint-handler.js'
import { Duckfficer } from 'duck-storage'

const { Schema } = Duckfficer

const OptionalEndpoint = {
  type: EndpointHandler,
  required: false
}

/**
 * An object representing all CRUD operations including listing and optional hook for any request.
 * @typedef {Object} CRUD
 * @property {EndpointHandler} [*] - Traps any kind of requests
 * @property {EndpointHandler} [create] - Traps post request
 * @property {EndpointHandler} [read] - Traps get requests to an /:id
 * @property {EndpointHandler} [update] - Traps patch requests
 * @property {EndpointHandler} [delete] - Traps delete requests
 * @property {EndpointHandler} [list] - Traps get requests to an entity with optional filters
 */

export const CRUD = new Schema({
  '*': OptionalEndpoint,
  all: OptionalEndpoint,
  create: OptionalEndpoint,
  read: OptionalEndpoint,
  update: OptionalEndpoint,
  delete: OptionalEndpoint,
  list: OptionalEndpoint,
}, {
  validate (v) {
    if (v['*'] && v.all) {
      this.throwError(`Provide either '*' or 'all' not both in property ${ this.fullPath }`, { value: v })
    }

    if (!v || Object.keys(v).length === 0) {
      this.throwError(`At least one method (all, create, read, update or delete) is required in property ${ this.fullPath }`, { value: v })
    }
  }
})
