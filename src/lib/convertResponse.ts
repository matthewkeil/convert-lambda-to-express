import util from "util";
import { Response } from "express";
import { APIGatewayProxyResult } from "aws-lambda";
import { WrapperOptions } from "..";
import { Logger } from "winston";

function buildResponseHeaders({
  response,
  options,
}: {
  response: APIGatewayProxyResult;
  options?: WrapperOptions;
}) {
  const headers = new Map(Object.entries(options?.defaultHeaders ?? {}));
  if (response.headers) {
    for (const [name, value] of Object.entries(response.headers)) {
      if (!headers.has(name)) {
        headers.set(name, value);
        continue;
      }
      const existing = headers.get(name);
      headers.set(name, `${existing} ${value}`);
    }
  }
  if (response.multiValueHeaders) {
    for (const [name, value] of Object.entries(response.multiValueHeaders)) {
      if (!headers.has(name)) {
        headers.set(name, value.join(" "));
        continue;
      }
      const existing = headers.get(name);
      headers.set(name, `${existing} ${value.join(" ")}`);
    }
  }
  return headers;
}

export function convertResponseFactory(
  res: Response,
  logger: Logger | Console,
  options?: WrapperOptions
) {
  return function convertResponse(
    err?: Error,
    response?: APIGatewayProxyResult
  ) {
    let errorOutput;
    if (err) {
      errorOutput = {
        errorMessage: err.message,
        errorType: err.name,
        trace: err.stack?.split("\n"),
      };
      logger.log("error", "End - Error:");
      logger.log("error", errorOutput);
      return res.status(500).json(errorOutput);
    }

    if (!response) {
      throw new Error("no error or response to send");
    }

    logger.log("info", "End - Result:");
    logger.log("info", util.inspect(response, false, Infinity));

    res.status(response.statusCode);
    const headers = buildResponseHeaders({ response, options });
    for (const [name, value] of headers.entries()) {
      res.setHeader(name, `${value}`);
    }
    if (response.body) {
      res.send(response.body);
    }
    
    return res.end();
  };
}
