const statusCodes = {
  200: 'OK',
  201: 'Created',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  405: 'Method Not Allowed',
  409: 'Conflict',
  411: 'Length Required',
  412: 'Precondition Failed',
  429: 'Too Many Requests',
  500: 'Internal Server Error',
  503: 'Service Unavailable'
}
export class ApiError extends Error {
  constructor (code = 400, message) {
    super(message || statusCodes[code] || 'unknown error')
    this.code = code
  }
}
