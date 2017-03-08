/**
 * headers.js
 *
 * Headers class offers convenient helpers
 */

import {checkInvalidHeaderChar, checkIsHttpToken} from './common.js'

function sanitizeName (name) {
  name += ''
  if (!checkIsHttpToken(name)) {
    throw new TypeError(`${name} is not a legal HTTP header name`)
  }
  return name.toLowerCase()
}

function sanitizeValue (value) {
  value += ''
  if (checkInvalidHeaderChar(value)) {
    throw new TypeError(`${value} is not a legal HTTP header value`)
  }
  return value
}

const MAP = Symbol('map')
export default class Headers {
  /**
   * Headers class
   *
   * @param {Object} init Response headers
   */
  constructor (init = undefined) {
    this[ MAP ] = Object.create(null)

    // We don't worry about converting prop to ByteString here as append()
    // will handle it.
    if (init == null) {
      // no op
    } else if (typeof init === 'object') {
      const method = init[ Symbol.iterator ]
      if (method != null) {
        if (typeof method !== 'function') {
          throw new TypeError('Header pairs must be iterable')
        }

        // sequence<sequence<ByteString>>
        // Note: per spec we have to first exhaust the lists then process them
        const pairs = []
        for (const pair of init) {
          if (typeof pair !== 'object' || typeof pair[ Symbol.iterator ] !== 'function') {
            throw new TypeError('Each header pair must be iterable')
          }
          pairs.push(Array.from(pair))
        }

        for (const pair of pairs) {
          if (pair.length !== 2) {
            throw new TypeError('Each header pair must be a name/value tuple')
          }
          this.append(pair[ 0 ], pair[ 1 ])
        }
      } else {
        // record<ByteString, ByteString>
        for (const key of Object.keys(init)) {
          const value = init[ key ]
          this.append(key, value)
        }
      }
    } else {
      throw new TypeError('Provided initializer must be an object')
    }

    Object.defineProperty(this, Symbol.toStringTag, {
      value: 'Headers',
      writable: false,
      enumerable: false,
      configurable: true
    })
  }

  /**
   * Return first header value given name
   *
   * @param {string} name Header name
   * @return {string}
   */
  get (name) {
    const list = this[ MAP ][ sanitizeName(name) ]
    if (!list) {
      return null
    }

    return list.join(',')
  }

  /**
   * Iterate over all headers
   *
   * @param {function} callback Executed for each item with parameters (value, name, thisArg)
   * @param {boolean} thisArg `this` context for callback function
   */
  forEach (callback, thisArg = undefined) {
    let pairs = getHeaderPairs(this)
    let i = 0
    while (i < pairs.length) {
      const [ name, value ] = pairs[ i ]
      callback.call(thisArg, value, name, this)
      pairs = getHeaderPairs(this)
      i++
    }
  }

  /**
   * Overwrite header values given name
   *
   * @param {string} name Header name
   * @param {string} value Header value
   */
  set (name, value) {
    this[ MAP ][ sanitizeName(name) ] = [ sanitizeValue(value) ]
  }

  /**
   * Append a value onto existing header
   *
   * @param {string} name Header name
   * @param {string} value Header value
   */
  append (name, value) {
    if (!this.has(name)) {
      this.set(name, value)
      return
    }

    this[ MAP ][ sanitizeName(name) ].push(sanitizeValue(value))
  }

  /**
   * Check for header name existence
   *
   * @param {string} name Header name
   * @return {boolean}
   */
  has (name) {
    return !!this[ MAP ][ sanitizeName(name) ]
  }

  /**
   * Delete all header values given name
   *
   * @param {string} name Header name
   */
  delete (name) {
    delete this[ MAP ][ sanitizeName(name) ]
  };

  /**
   * Return raw headers (non-spec api)
   *
   * @return {Object}
   */
  raw () {
    return this[ MAP ]
  }

  /**
   * Get an iterator on keys.
   *
   * @return {Iterator}
   */
  keys () {
    return createHeadersIterator(this, 'key')
  }

  /**
   * Get an iterator on values.
   *
   * @return {Iterator}
   */
  values () {
    return createHeadersIterator(this, 'value')
  }

  /**
   * Get an iterator on entries.
   *
   * This is the default iterator of the Headers object.
   *
   * @return {Iterator}
   */
  [Symbol.iterator] () {
    return createHeadersIterator(this, 'key+value')
  }
}
Headers.prototype.entries = Headers.prototype[ Symbol.iterator ]

Object.defineProperty(Headers.prototype, Symbol.toStringTag, {
  value: 'HeadersPrototype',
  writable: false,
  enumerable: false,
  configurable: true
})

function getHeaderPairs (headers, kind) {
  const keys = Object.keys(headers[ MAP ]).sort()
  return keys.map(
    kind === 'key'
      ? k => [ k ]
      : k => [ k, headers.get(k) ]
  )
}

const INTERNAL = Symbol('internal')

function createHeadersIterator (target, kind) {
  const iterator = Object.create(HeadersIteratorPrototype)
  iterator[ INTERNAL ] = {
    target,
    kind,
    index: 0
  }
  return iterator
}

const HeadersIteratorPrototype = Object.setPrototypeOf({
  next () {
    // istanbul ignore if
    if (!this ||
      Object.getPrototypeOf(this) !== HeadersIteratorPrototype) {
      throw new TypeError('Value of `this` is not a HeadersIterator')
    }

    const {
      target,
      kind,
      index
    } = this[ INTERNAL ]
    const values = getHeaderPairs(target, kind)
    const len = values.length
    if (index >= len) {
      return {
        value: undefined,
        done: true
      }
    }

    const pair = values[ index ]
    this[ INTERNAL ].index = index + 1

    let result
    if (kind === 'key') {
      result = pair[ 0 ]
    } else if (kind === 'value') {
      result = pair[ 1 ]
    } else {
      result = pair
    }

    return {
      value: result,
      done: false
    }
  }
}, Object.getPrototypeOf(
  Object.getPrototypeOf([][ Symbol.iterator ]())
))

Object.defineProperty(HeadersIteratorPrototype, Symbol.toStringTag, {
  value: 'HeadersIterator',
  writable: false,
  enumerable: false,
  configurable: true
})
