import util from "util";
import { IncomingHttpHeaders } from "http";
import { Response } from "express";
import { APIGatewayProxyResult } from "aws-lambda";
import { Logger } from "winston";

type DefaultHeaders = {
  [key in keyof IncomingHttpHeaders]: Parameters<Response["header"]>[1];
};
export interface ConvertResponseOptions {
  defaultResponseHeaders?: DefaultHeaders;
}

export function setResponseHeaders({
  res,
  response,
  options,
}: {
  res: Response;
  response?: APIGatewayProxyResult;
  options?: ConvertResponseOptions;
}) {
  if (options?.defaultResponseHeaders) {
    for (const [name, value] of Object.entries(
      options?.defaultResponseHeaders
    )) {
      res.header(name, value);
    }
  }

  if (response?.headers) {
    for (const [name, value] of Object.entries(response.headers)) {
      res.header(name, `${value}`);
    }
  }

  if (response?.multiValueHeaders) {
    for (const [name, value] of Object.entries(response.multiValueHeaders)) {
      res.header(name, value.map((val) => `${val}`).join(", "));
    }
  }
}

export function coerceBody(body: unknown): string {
  if (
    typeof body === "string" ||
    typeof body === "number" ||
    typeof body === "boolean" ||
    typeof body === "bigint"
  ) {
    return `${body}`;
  }

  if (Buffer.isBuffer(body)) {
    return body.toString();
  }

  if (
    // cases of Object or Array
    typeof body === "object" &&
    body !== null
  ) {
    return JSON.stringify(body);
  }

  if (!!body) {
    // possible function/ArrayBuffer/symbol/etc attempt toString()
    try {
      return (body as any).toString();
    } catch {
      // everything failed
      throw new TypeError("could not coerce return value to string");
    }
  }

  throw new TypeError(`handler returned nullish response: ${body}`);
}

export function convertResponseFactory({
  res,
  logger,
  options,
}: {
  res: Response;
  logger: Logger | Console;
  options?: ConvertResponseOptions;
}) {
  function sendError({ message, name, stack }: Error) {
    const errorOutput = {
      errorMessage: message,
      errorType: name,
      trace: stack?.split("\n"),
    };
    logger.error("End - Error:");
    logger.error(errorOutput);
    return res.status(500).json(errorOutput);
  }

  return function convertResponse(
    err?: Error,
    response?: APIGatewayProxyResult
  ) {
    setResponseHeaders({ res, options, response });

    if (err) {
      return sendError(err);
    }

    if (!response) {
      throw new TypeError("no response returned from handler");
    }

    try {
      const coerced = coerceBody(response.body);
      logger.info("End - Result:");
      logger.info(coerced);
      res.send(coerced);

      return res.status(response.statusCode ?? 200).end();
    } catch (error) {
      return sendError(error as Error);
    }
  };
}

// if (
//   typeof messageOrObject === "string" ||
//   typeof messageOrObject === "number" ||
//   typeof messageOrObject === "boolean" ||
//   typeof messageOrObject === "bigint"
// ) {
//   response = {
//     body: `${messageOrObject}`,
//     statusCode: 200,
//   };
// } else if (
//   // cases of Object or Array
//   typeof messageOrObject === "object" &&
//   messageOrObject !== null
// ) {
//   response = {
//     body: JSON.stringify(messageOrObject),
//     statusCode: 200,
//   };
// } else if (!!messageOrObject) {
//   // possible function/buffer/symbol/etc attempt toString()
//   try {
//     response = {
//       statusCode: 200,
//       body: messageOrObject.toString(),
//     };
//   } catch {
//     // everything failed
//     error = new Error("could not coerce return value to string");
//   }
// } else {
//   error = new Error(
//     `handler returned nullish response: ${messageOrObject}`
//   );
// }

// if (!response) {
//   return callback(new Error("handler didn't return response"));
// }

// if (!res) {
//   return reject(new Error("handler didn't return response"));
// }

// if (!response) {
//   const error = new Error("handler didn't return response");
//   if (this.reject) {
//     return this.reject(error);
//   }
//   throw error;
// }
