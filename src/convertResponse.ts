import { IncomingHttpHeaders } from 'http';
import { Response } from 'express';
import { Logger } from 'winston';

type DefaultHeaders = {
  [key in keyof IncomingHttpHeaders]: Parameters<Response['header']>[1];
};
export interface ConvertResponseOptions {
  defaultResponseHeaders?: DefaultHeaders;
}

function isObject(response: unknown): response is Record<string, unknown> {
  return typeof response === 'object' && response !== null && !Array.isArray(response) && !Buffer.isBuffer(response);
}

export function setResponseHeaders({
  res,
  response,
  options
}: {
  res: Response;
  response?: unknown;
  options?: ConvertResponseOptions;
}) {
  if (options?.defaultResponseHeaders) {
    for (const [name, value] of Object.entries(options?.defaultResponseHeaders)) {
      res.header(name, value);
    }
  }

  if (isObject(response)) {
    if (isObject(response.headers)) {
      for (const [name, value] of Object.entries(response.headers)) {
        res.header(name, `${value}`);
      }
    }

    if (isObject(response.multiValueHeaders)) {
      for (const [name, value] of Object.entries(response.multiValueHeaders)) {
        res.header(name, Array.isArray(value) ? value.map(val => `${val}`).join(', ') : `${value}`);
      }
    }
  }
}

export function coerceBody(body: unknown): string {
  if (typeof body === 'string' || typeof body === 'number' || typeof body === 'boolean' || typeof body === 'bigint') {
    return `${body}`;
  }

  if (Buffer.isBuffer(body)) {
    return body.toString();
  }

  if (
    // cases of Object or Array
    typeof body === 'object' &&
    body !== null &&
    !Buffer.isBuffer(body)
  ) {
    return JSON.stringify(body);
  }

  if (body) {
    // possible function/ArrayBuffer/symbol/etc attempt toString()
    try {
      return (body as any).toString(); // eslint-disable-line @typescript-eslint/no-explicit-any
    } catch {
      // everything failed
    }
  }

  return '';
}

export function convertResponseFactory({
  res,
  logger,
  options
}: {
  res: Response;
  logger: Logger | Console;
  options?: ConvertResponseOptions;
}) {
  function sendError({ message, name, stack }: Error) {
    const errorOutput = {
      errorMessage: message,
      errorType: name,
      trace: stack?.split('\n')
    };
    logger.error('End - Error:');
    logger.error(errorOutput);
    return res.status(500).json(errorOutput);
  }

  return function convertResponse(err?: Error, response?: unknown) {
    setResponseHeaders({ res, options, response });

    if (err) {
      return sendError(err);
    }

    try {
      const coerced = isObject(response) && 'body' in response ? coerceBody(response.body) : coerceBody(response);
      logger.info('End - Result:');
      logger.info(coerced);

      const statusCode = isObject(response) && !!response.statusCode ? parseInt(`${response.statusCode}`) : 200;
      return res.status(statusCode).send(coerced);
    } catch (error) {
      return sendError(error as Error);
    }
  };
}
