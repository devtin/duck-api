import { Duckfficer } from 'duck-storage'

const { Schema, Transformers } = Duckfficer

const primitiveValues = [Number, BigInt, String, Object, Array, Boolean, Date]
const scalableValues = [Number, BigInt, Date]

export const QuerySchema = new Schema({
  // comparison
  $eq: primitiveValues,
  $ne: primitiveValues,
  $lte: scalableValues,
  $gte: scalableValues,
  $gt: scalableValues,
  $lt: scalableValues,
  $in: Array,
  $nin: Array,
  // logical
  $and: {
    type: Array,
    arraySchema: 'Query'
  },
  $not: {
    type: Array,
    arraySchema: 'Query'
  },
  $nor: {
    type: Array,
    arraySchema: 'Query'
  },
  $or: {
    type: Array,
    arraySchema: 'Query'
  },
  // element query
  $exists: Boolean,
  $type: {
    type: Function
  }
})

export const Query = {
  settings: {
    autoCast: true
  },
  isOperator (o) {
    return Object.keys(o).filter(item => /^\$/.test(item)).length > 0
  },
  cast (v) {
    if (v !== undefined && !/^\$/.test(this.name) && (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean')) {
      return { $eq: v }
    }
    return v
  },
  parse (v) {
    if (!Query.isOperator(v)) {
      if (Object.keys(v).length === 0) {
        return v
      }

      return new Schema({ type: Object, mapSchema: 'Query' }, {
        name: this.name,
        parent: this instanceof Schema ? this : undefined
      }).parse(v)
    }

    const operator = Object.keys(v)[0]

    if (!QuerySchema.hasField(operator)) {
      const err = `Unknown operator ${ operator }`
      if (this.throwError) {
        this.throwError(err)
      }
      throw new Error(err)
    }

    // console.log(`looking for schema at`, this.fullPath, operator, QuerySchema.schemaAtPath(operator))
    return {
      [operator]: Schema.cloneSchema({
        schema: QuerySchema.schemaAtPath(operator),
        name: `${ this.fullPath }.${ operator }`,
        parent: this instanceof Schema ? this : undefined
      }).parse(v[operator])
    }
  },
  validate (v, { state }) {
    if (v && Query.isOperator(v) && Object.keys(v).length > 1) {
      this.throwError(`Invalid operator`)
    }
  }
}

Transformers.Query = Query
