import { inspect } from "util";
import {
  APIGatewayProxyResult,
  APIGatewayProxyWithCognitoAuthorizerHandler,
} from "aws-lambda";
import { Event } from "./Event";
import { Context } from "./Context";
import { Logger } from "winston";

/**
 * @description handler function can return results via three methods. need to
 * normalize and catch them all.
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
export async function runHandler({
  event,
  context,
  logger,
  handler,
  callback,
}: {
  event: Event;
  context: Context;
  logger: Logger | Console;
  handler: APIGatewayProxyWithCognitoAuthorizerHandler;
  callback: (err?: Error, result?: APIGatewayProxyResult) => void;
}): Promise<void> {
  try {
    const response = await new Promise<APIGatewayProxyResult | undefined>(
      (_resolve, _reject) => {
        logger.info(`START RequestId: ${context.awsRequestId}`);

        // only allow one resolution. which ever is first (callback, context.done,
        // promise) wins and the other(s) is ignored
        let resolved = false;

        function resolve(results?: APIGatewayProxyResult) {
          if (!resolved) {
            resolved = true;
            return _resolve(results);
          }
          logger.error("multiple resolutions. ignoring results:");
          logger.error(inspect(results, false, Infinity));
        }

        function reject(err: Error) {
          if (!resolved) {
            resolved = true;
            return _reject(err);
          }
          logger.error("multiple resolutions. ignoring error:");
          logger.error(inspect(err, false, Infinity));
        }

        // handle case #1 from comment above. set resolve/reject on context object
        // and Context class actuates them context.done/succeed/fail are called
        context._resolve = resolve;
        context._reject = reject;

        // handle case #2 from above. build callback function that calls resolve/reject
        // if callback is used by the handler.
        const handlerCallback = (
          err?: string | Error | null,
          res?: APIGatewayProxyResult
        ) => {
          if (err) {
            return reject(err instanceof Error ? err : new Error(err));
          }
          resolve(res);
        };

        // run the handler
        const voidOrPromise = handler(event, context, handlerCallback);

        // handle case #3 where handler returns a promise. then/catch the promise
        if (voidOrPromise) {
          voidOrPromise.then(resolve).catch(reject);
        }

        // if voidOrPromise is nullish then handler is using callback function or context
        // object for response. context timeout will watch that function doesn't hang. just
        // return from promise executor here.
      }
    );

    context._finalize();
    context._clearTimeout();

    return callback(undefined, response);
  } catch (err) {
    context._finalize();
    context._clearTimeout();

    if (err instanceof Error) {
      // errors caught from the handler function
      return callback(err);
    }

    // something other than an error was thrown from inside the handler function
    logger.error(inspect(err, false, Infinity));
    return callback(
      new Error("something other than an error was thrown from the handler")
    );
  }
}
