import { inspect } from "util";
import {
  APIGatewayProxyResult,
  APIGatewayProxyWithCognitoAuthorizerHandler,
} from "aws-lambda";
import { Logger } from "winston";
import { Handler } from "express";
import { SharedIniFileCredentials } from "aws-sdk";
import { Context, ContextOptions } from "./lib/Context";
import { Event, EventOptions } from "./lib/Event";
import {
  convertResponseFactory,
  ConvertResponseOptions,
} from "./lib/convertResponse";

export interface WrapperOptions
  extends Omit<
      ContextOptions,
      "startTime" | "credentials" | "resolve" | "reject"
    >,
    Pick<
      EventOptions,
      | "accountId"
      | "isBase64EncodedReq"
      | "resourcePath"
      | "stage"
      | "stageVariables"
    >,
    ConvertResponseOptions {
  profile?: string;
  logger?: Logger;
}
export function wrapLambda(
  handler: APIGatewayProxyWithCognitoAuthorizerHandler,
  options: WrapperOptions = {}
): Handler {
  let credentials: SharedIniFileCredentials | undefined;
  try {
    let credsOptions;
    if (options.profile) {
      credsOptions = { profile: options.profile };
    }
    credentials = new SharedIniFileCredentials(credsOptions);
  } catch {
    // throws if no file, no profile named `options.profile` or no default profile
    // just pass `credentials` object a undefined
  }

  const logger = options.logger ?? console;

  return async (req, res, next) => {
    try {
      const startTime = Date.now();
      const context = new Context({
        ...options,
        startTime,
        credentials,
      });
      const event = new Event({
        ...options,
        req,
        startTime,
        awsRequestId: context.awsRequestId,
      });
      const convertResponse = convertResponseFactory({ res, logger, options });

      /**
       * handler function can return results via three methods. need to normalize
       * and catch them all.
       *
       * 1) handler uses the deprecated methods and calls context.done(), context.fail(),
       * or context.succeed(). Context was built so that context.done calls the
       * resolve/reject and context.succeed and context.fail call context.done. need to
       * pass resolve/reject to context object so they are available to the done function.
       *
       * 2) handler uses the call back function. pass in a callback function that
       * uses resolve/reject from within the callback that we pass into the handler.
       *
       * 3) handler is an async function that returns a promise. then/catch the promise
       *
       */
      const response = await new Promise<APIGatewayProxyResult>(
        (_resolve, _reject) => {
          // only allow one resolution. which ever is first (callback, context.done,
          // promise) wins and the other(s) is ignored
          let resolved = false;
          function resolve(results: APIGatewayProxyResult) {
            context._clearTimeout();
            if (!resolved) {
              resolved = true;
              return _resolve(results);
            }
            logger.log(
              "error",
              "resolve called multiple times. ignoring. results:"
            );
            logger.log("error", inspect(results, false, Infinity));
          }
          function reject(err: Error) {
            context._clearTimeout();
            if (!resolved) {
              resolved = true;
              return _reject(err);
            }
            logger.log(
              "error",
              "reject called multiple times. ignoring. error:"
            );
            logger.log("error", inspect(err, false, Infinity));
          }

          // handle case #1 from comment above
          context.resolve = resolve;
          context.reject = reject;

          logger.log("info", "START RequestId: " + context.awsRequestId);
          const voidOrPromise = handler(event, context, (err, res) => {
            // handle case #2 from above
            if (err) {
              return reject(err instanceof Error ? err : new Error(err));
            }
            resolve(res ? res : { statusCode: 200, body: "" });
          });

          // handle case #3 from above
          if (voidOrPromise) {
            voidOrPromise.then(resolve).catch(reject);
          }
        }
      ).catch((err) => {
        // errors caught from the handler function
        convertResponse(err);
      });

      if (response) {
        convertResponse(undefined, response);
      }
    } catch (err) {
      // if server error building Event, Context or convertResponse
      return next(err);
    }
  };
}
