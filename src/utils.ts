const hexChars = '0123456789abcdef'.split('');
export function generateRandomHex(length: number) {
  let hexVal = '';
  for (let i = 0; i < length; i++) {
    hexVal += hexChars[Math.floor(Math.random() * hexChars.length)];
  }
  return hexVal;
}

export class TimeoutError extends Error {
  constructor(m: string) {
    super(m);
    this.name = 'TimeoutError';
  }
}

export const httpMethods = ['GET', 'PUT', 'POST', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const;
export type HttpMethod = typeof httpMethods[number];
export function isHttpMethod(value: unknown): value is HttpMethod {
  return typeof value === 'string' && httpMethods.includes(value.toUpperCase() as HttpMethod);
}
