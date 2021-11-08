import util from "util";
import { Response } from "express";
import { APIGatewayProxyResult } from "aws-lambda";
import { Logger } from "winston";

type DefaultHeaders = { [key: string]: Parameters<Response["setHeader"]>[1] };
export interface ConvertResponseOptions {
  defaultResponseHeaders?: DefaultHeaders;
}

function setResponseHeaders({
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
      res.setHeader(name, value);
    }
  }

  if (response?.headers) {
    for (const [name, value] of Object.entries(response.headers)) {
      res.setHeader(name, `${value}`);
    }
  }

  if (response?.multiValueHeaders) {
    for (const [name, value] of Object.entries(response.multiValueHeaders)) {
      res.setHeader(name, value.map((val) => `${val}`).join(","));
    }
  }
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
  function sendError(errorOutput: {
    errorMessage: string;
    errorType: string;
    trace: string[] | undefined;
  }) {
    logger.log("error", "End - Error:");
    logger.log("error", errorOutput);
    return res.status(500).json(errorOutput);
  }

  return function convertResponse(
    err?: Error,
    response?: APIGatewayProxyResult
  ) {
    setResponseHeaders({ res, options, response });

    if (err) {
      return sendError({
        errorMessage: err.message,
        errorType: err.name,
        trace: err.stack?.split("\n"),
      });
    }

    if (!response) {
      const error = new SyntaxError("no error or response to send");
      Error.captureStackTrace(error);
      return sendError({
        errorMessage: error.message,
        errorType: "WrapperError",
        trace: error.stack?.split("\n"),
      });
    }

    logger.log("info", "End - Result:");
    logger.log("info", util.inspect(response, false, Infinity));

    if (response.body) {
      res.send(response.body);
    }

    return res.status(response.statusCode).end();
  };
}
