import {
  Context as IContext,
  CognitoIdentity,
  ClientContext,
} from "aws-lambda";
import { TimeoutError, generateRandomHex } from "./utils.js";
import mute from "./mute.js";
import { Logger } from "winston";

/*
 * Lambda's Context object.
 * Refer to this documentation:
 * https://docs.aws.amazon.com/lambda/latest/dg/nodejs-context.html
 */
export interface ContextOptions {
  functionName: string;
  logger: Logger;
  verboseLevel?: number;
  timeoutInMs?: number;
  callbackWaitsForEmptyEventLoop?: boolean;
  identity?: CognitoIdentity;
  clientContext?: ClientContext;
  finalize: () => void;
}

export class Context implements IContext {
  public callbackWaitsForEmptyEventLoop: boolean;
  public functionName: string;
  public functionVersion: string;
  public invokedFunctionArn: string;
  public memoryLimitInMB: string;
  public awsRequestId: string;
  public logGroupName: string;
  public logStreamName = "aws-log-stream";
  public identity?: CognitoIdentity;
  public clientContext?: ClientContext;

  private logger: Logger;
  private verboseLevel: number;
  private unmute: () => void;

  private finalize: () => void;
  private startTime: number;
  private timeout: number;
  private _timeout: NodeJS.Timeout;

  private _stopped = false;

  constructor(options: ContextOptions) {
    this.finalize = options.finalize ?? function () {};
    this.logger = options.logger;
    this.verboseLevel = options.verboseLevel;

    if (this.verboseLevel > 1) {
      this.logger.log("info", "START RequestId: " + this.awsRequestId);
    }
    if (this.verboseLevel < 3) {
      this.unmute = mute();
    }
    /**
     *
     *
     *
     */
    this.callbackWaitsForEmptyEventLoop =
      options.callbackWaitsForEmptyEventLoop ?? false;
    this.functionName = options.functionName;
    this.functionVersion = process.env.AWS_LAMBDA_FUNCTION_VERSION ?? "1";
    this.invokedFunctionArn = this._createInvokeFunctionArn();
    this.memoryLimitInMB = process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE ?? "128";
    this.awsRequestId = this._createInvokeId();
    this.logGroupName = `/aws/lambda/${this.functionName}`;
    this.identity = options.identity;
    this.clientContext = options.clientContext;
    /**
     *
     *
     *
     */
    this.startTime = new Date().getTime();
    this.timeout = options.timeoutInMs ?? 3000;
    this._init_timeout();
  }

  done(err?: Error | string, messageOrObject?: any): void {
    // May only be called once
    if (this._stopped) {
      return;
    }
    this._stopped = true;

    clearTimeout(this._timeout);
    if (this.unmute != null) {
      this.unmute();
      this.unmute = null;
    }

    let errorOutput;
    if (err instanceof Error) {
      errorOutput = {
        errorMessage: err.message,
        errorType: err.name,
      };
      //http://docs.aws.amazon.com/en_en/lambda/latest/dg/nodejs-prog-mode-exceptions.html
      if (err.stack) {
        // Trim stack
        const stack = err.stack.split("\n");
        stack.shift();
        for (var i = 0; i < stack.length; i++) {
          stack[i] = stack[i].trim().substr(3);
        }
        errorOutput.stackTrace = stack;
      }
    } else if (typeof err === "string") {
      errorOutput = { errorMessage: err };
    }

    if (errorOutput) {
      if (this.verboseLevel > 1) {
        this.logger.log("error", "End - Error:");
      }
      if (this.verboseLevel > 0) {
        this.logger.log("error", err);
      }
    } else {
      if (this.verboseLevel > 1) {
        this.logger.log("info", "End - Result:");
      }
      if (this.verboseLevel > 0) {
        this.logger.log("info", messageOrObject);
      }
    }
    this.finalize(); //Destroy env...

    if (this.callbackWaitsForEmptyEventLoop) {
      this.logger.log(
        "info",
        "This Context Mock cannot wait for empty event loop"
      );
    }
  }

  fail(err: Error | string): void {
    this.done(err);
  }

  succeed(messageOrObject: any): void {
    this.done(undefined, messageOrObject);
  }

  getRemainingTimeInMillis(): number {
    const now = new Date().getTime();
    return this.timeout + this.startTime - now;
  }

  private _init_timeout() {
    this._timeout = setTimeout(() => {
      this.fail(
        new TimeoutError(
          "Task timed out after " +
            (this.timeout / 1000).toFixed(2) +
            " seconds"
        )
      );
    }, this.timeout);
  }

  private _createInvokeFunctionArn() {
    return [
      "arn",
      "aws",
      "lambda",
      process.env.AWS_REGION,
      process.env.AWS_ACCOUNT_ID ||
        Math.round(Math.random() * 1000000000000).toString(),
      "function",
      this.functionName,
      this.functionVersion,
    ].join(":");
  }

  private _createInvokeId() {
    /*
     * create random invokeid.
     * Assuming that invokeid follows the format:
     * 8hex-4hex-4hex-4hex-12hex
     */
    return [
      generateRandomHex(8),
      generateRandomHex(4),
      generateRandomHex(4),
      generateRandomHex(4),
      generateRandomHex(12),
    ].join("-");
  }
}
