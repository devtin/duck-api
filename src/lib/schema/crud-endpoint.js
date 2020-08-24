import { CRUD } from './crud.js'
import { Duckfficer } from 'duck-storage'

const { Schema } = Duckfficer

/**
 * A CRUD representation of an endpoint
 * @typedef {Object} CRUDEndpoint
 * @extends CRUD
 * @property {String} path
 */

export const CRUDEndpoint = new Schema(Object.assign({
  path: String
}, CRUD.schema))
