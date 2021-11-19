import { APIGatewayProxyWithCognitoAuthorizerHandler } from "aws-lambda";
import { Logger } from "winston";
import { Handler } from "express";
import { SharedIniFileCredentials } from "aws-sdk";
import { Context, ContextOptions } from "./Context";
import { Event, EventOptions } from "./Event";
import {
  convertResponseFactory,
  ConvertResponseOptions,
} from "./convertResponse";
import { runHandler } from "./runHandler";

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
      await runHandler({
        event,
        context,
        logger,
        handler,
        callback: convertResponse,
      });
    } catch (err) {
      // if server error building Event, Context or convertResponse
      return next(err);
    }
  };
}
