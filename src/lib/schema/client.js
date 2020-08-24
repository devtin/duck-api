import { Duckfficer } from 'duck-storage'
import { Method } from './method'

const { Schema } = Duckfficer

export const Client = new Schema({
  name: String,
  methods: {
    type: Object,
    mapSchema: Method,
    default () {
      return {}
    }
  }
})
