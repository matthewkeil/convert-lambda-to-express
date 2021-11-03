const hexChars = "0123456789abcdef".split("");
export function generateRandomHex(length: number) {
  var hexVal = "";
  for (var i = 0; i < length; i++) {
    hexVal += hexChars[Math.floor(Math.random() * hexChars.length)];
  }
  return hexVal;
}

export class TimeoutError extends Error {
  constructor(m: string) {
    super(m);
    this.name = "TimeoutError";
  }
}