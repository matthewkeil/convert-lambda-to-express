import { APIGatewayProxyWithCognitoAuthorizerHandler } from "aws-lambda";
import { Logger } from "winston";
import { Handler } from "express";
import { SharedIniFileCredentials, Credentials } from "aws-sdk";
import { Context, ContextOptions } from "./Context";
import { Event, EventOptions } from "./Event";
import {
  convertResponseFactory,
  ConvertResponseOptions,
} from "./convertResponse";
import { runHandler } from "./runHandler";

export interface WrapperOptions
  extends Omit<ContextOptions, "startTime" | "credentials">,
    Pick<
      EventOptions,
      "isBase64EncodedReq" | "resourcePath" | "stage" | "stageVariables"
    >,
    ConvertResponseOptions {
  credentialsFilename?: string;
  profile?: string;
  logger?: Logger;
}

export function getCredentials(filename?: string, profile?: string) {
  if (filename) {
    const credentials = new SharedIniFileCredentials({ filename, profile });
    if (!!credentials.accessKeyId && !!credentials.secretAccessKey) {
      return credentials;
    }
  }

  if (
    process.env.AWS_ACCESS_KEY_ID?.length &&
    process.env.AWS_SECRET_ACCESS_KEY?.length
  ) {
    return new Credentials({
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      sessionToken: process.env.AWS_SESSION_TOKEN,
    });
  }
}

export function wrapLambda(
  handler: APIGatewayProxyWithCognitoAuthorizerHandler,
  options: WrapperOptions = {}
): Handler {
  const logger = options.logger ?? console;
  const credentials = getCredentials(
    options.credentialsFilename ?? "~/.aws/credentials",
    options.profile
  );

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
        accountId: context._accountId,
      });
      const convertResponse = convertResponseFactory({ res, logger, options });
      await runHandler({
        logger,
        handler,
        event,
        context,
        callback: convertResponse,
      });
    } catch (err) {
      // if server error building Event, Context or convertResponse
      return next(err);
    }
  };
}
