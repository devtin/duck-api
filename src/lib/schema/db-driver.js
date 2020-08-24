import { Duckfficer } from 'duck-storage'

const { Schema } = Duckfficer

export const DBDriver = new Schema({
  init: Function,
  create: Function,
  read: Function,
  update: Function,
  delete: Function,
  list: Function
})
