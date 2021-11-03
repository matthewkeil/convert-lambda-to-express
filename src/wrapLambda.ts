import {
  APIGatewayProxyResult,
  APIGatewayProxyWithCognitoAuthorizerHandler,
  ClientContext,
  CognitoIdentity,
} from "aws-lambda";
import { Logger } from "winston";
export interface WrapperOptions {
  functionName?: string;
  resourcePath?: string;
  logger?: Logger;
  profile?: string;
  timeoutInSeconds?: number;
  stage?: string;
  accountId?: string;
  defaultHeaders?: {
    [header: string]: string | number | boolean;
  };
  isBase64Encoded?: boolean;
  region?: string;
  handler?: string; // in filename.exportName format
  nodeModulesPath?: string;
  finalize?: () => void;
  identity?: CognitoIdentity;
  clientContext?: ClientContext;
}

import { resolve } from "path";
import { Handler } from "express";
import { SharedIniFileCredentials } from "aws-sdk";
import { Context } from "./lib/Context";
import { convertRequest } from "./lib/convertRequest";
import { convertResponseFactory } from "./lib/convertResponse";

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
  }

  const nodeModulesPath =
    options.nodeModulesPath ?? resolve(require.resolve("express"), "..", "..");
  const logger = options.logger ?? console;

  return async (req, res, next) => {
    try {
      const convertResponse = convertResponseFactory(res, logger);
      let _context: Context;

      const response = await new Promise<APIGatewayProxyResult>(
        (resolve, reject) => {
          // only allow one resolution. which ever is first, callback
          // or promise.then, wins and the other is ignored
          let resolved = false;
          function _resolve(results: APIGatewayProxyResult) {
            _context._clearTimeout();
            if (!resolved) {
              resolved = true;
              resolve(results);
            }
          }
          function _reject(err: Error) {
            _context._clearTimeout();
            if (!resolved) {
              resolved = true;
              reject(err);
            }
          }

          const { event, context } = convertRequest({
            ...options,
            nodeModulesPath,
            req,
            credentials,
            resolve: _resolve,
            reject: _reject,
          });
          _context = context;

          logger.log("info", "START RequestId: " + context.awsRequestId);
          // pass in done callback function check if its used
          const voidOrPromise = handler(event, context, (err, res) => {
            if (err) {
              return _reject(err instanceof Error ? err : new Error(err));
            }
            _resolve(res ? res : { statusCode: 200, body: "" });
          });

          // if promise is returned from handler then wait for it to resolve
          if (voidOrPromise) {
            voidOrPromise.then(_resolve).catch(_reject);
          }
        }
        // if handler throws and error return as a handler error through context object
      ).catch((err) => {
        convertResponse(err);
      });

      if (response) {
        convertResponse(undefined, response);
      }
    } catch (err) {
      // if server error building request
      return next(err);
    }
  };
}
