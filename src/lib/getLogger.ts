/*
 * Simplified mute module.
 * https://github.com/shannonmoeller/mute
 *
 * The MIT License (MIT)
 *
 * Copyright (c) Shannon Moeller <me@shannonmoeller.com> (shannonmoeller.com)
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy of
 * this software and associated documentation files (the "Software"), to deal in
 * the Software without restriction, including without limitation the rights to
 * use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
 * the Software, and to permit persons to whom the Software is furnished to do so,
 * subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
 * FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
 * COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
 * IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
 * CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 *
 */

// export function getWinstonConsole() {
//   const { combine, colorize, simple } = winston.format;
//   const _simple = simple();
//   const myFormat = winston.format((info) => {
//     const stringifiedRest = processJSON(
//       Object.assign({}, info, {
//         level: undefined,
//         message: undefined,
//         splat: undefined,
//       })
//     );
//     var new_info = { level: info.level, message: info.message };
//     if (new_info.message == undefined) {
//       new_info.message = "";
//     }
//     if (stringifiedRest !== "{}") {
//       new_info.message += stringifiedRest;
//     }
//     return _simple.transform(new_info);
//   });

//   const logger = winston.createLogger({
//     level: "info",
//     transports: [
//       new winston.transports.Console({
//         format: combine(colorize(), myFormat()),
//       }),
//     ],
//   });
//   return logger;
// }

// var logger = utils.getWinstonConsole();

// export function setLogger(_logger){
//     if(_logger != null && typeof _logger.transports != 'undefined'){
//         logger = _logger;
//     } else {
//         console.warn("Invalid logger object ! Using default logger");
//     }
// }

// export function getLogger() {
//     return logger;
// }

// function _mute(stream) {
//   var write = stream && stream.write;
//   var originalWrite = write && write.originalWrite;

//   // We only need to mute unmuted streams
//   if (!write || originalWrite) {
//     return;
//   }

//   function noop() {}
//   noop.originalWrite = write;
//   stream.write = noop;
// }

// function _unmute(stream) {
//   var write = stream && stream.write;
//   var originalWrite = write && write.originalWrite;

//   // We only need to unmute muted streams
//   if (!write || !originalWrite) {
//     return;
//   }

//   stream.write = originalWrite;
// }

// export default function mute() {
//   var streams = [process.stdout, process.stderr];
//   streams.forEach(_mute);
//   return function unmuteStreams() {
//     streams.forEach(_unmute);
//   };
// }
