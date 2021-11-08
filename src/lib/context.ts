import os from "os";
import { resolve } from "path";
import { SharedIniFileCredentials } from "aws-sdk";
import {
  Context as IContext,
  CognitoIdentity,
  ClientContext,
  APIGatewayProxyResult,
} from "aws-lambda";
import { generateRandomHex, TimeoutError } from "./utils.js";

type Resolve = (response: APIGatewayProxyResult) => void;
type Reject = (err: Error) => void;
/*
 * Lambda's Context object.
 * Refer to this documentation:
 * https://docs.aws.amazon.com/lambda/latest/dg/nodejs-context.html
 */
export interface ContextOptions {
  startTime?: number;
  credentials?: SharedIniFileCredentials;
  resolve?: Resolve;
  reject?: Reject;

  // passed through from WrapperOptions
  functionName?: string;
  functionVersion?: string;
  memorySize?: number;
  logGroupName?: string;
  logStreamName?: string;
  timeoutInSeconds?: number;
  identity?: CognitoIdentity;
  clientContext?: ClientContext;
  handler?: string; // in filename.exportName format
  nodeModulesPath?: string;
  region?: string;
  accountId?: string;
  finalize?: () => void;
}

export class Context implements IContext {
  public functionName: string;
  public functionVersion: string;
  public memoryLimitInMB: string;
  public logGroupName: string;
  public logStreamName: string;
  public invokedFunctionArn: string;
  public awsRequestId: string;
  public identity?: CognitoIdentity;
  public clientContext?: ClientContext;
  public callbackWaitsForEmptyEventLoop: boolean;

  private finalize: () => void;

  private _region: string;
  private _accountId: string;
  private _startTime: number;
  private _timeout: number;
  private __timeout?: NodeJS.Timeout;
  private _stopped = false;

  private _resolve?: Resolve;
  get resolve() {
    return this._resolve;
  }
  set resolve(resolve: undefined | Resolve) {
    this._resolve = resolve;
  }
  private _reject?: Reject;
  get reject() {
    return this._reject;
  }
  set reject(reject: undefined | Reject) {
    this._reject = reject;
  }

  constructor(private options: ContextOptions) {
    // setup time management
    this._startTime = options.startTime ?? Date.now();
    this._timeout = options?.timeoutInSeconds
      ? options.timeoutInSeconds * 1000
      : 3000; // default lambda timeout
    this.__timeout = setTimeout(() => {
      this.fail(
        new TimeoutError(
          "Task timed out after " +
            (this._timeout / 1000).toFixed(2) +
            " seconds"
        )
      );
    }, this._timeout);

    // setup properties of IContext
    this.callbackWaitsForEmptyEventLoop = false; // not supported by this package
    this.functionName = options.functionName ?? "convert-lambda-to-express";
    this.functionVersion = options.functionVersion ?? "1";
    this.invokedFunctionArn = this._createInvokeFunctionArn();
    this.memoryLimitInMB = `${options.memorySize ?? 128}`;
    this.awsRequestId = this._createInvokeId();
    this.logGroupName =
      options.logGroupName ?? `/aws/lambda/${this.functionName}`;
    this.logStreamName = options.logStreamName ?? "aws-log-stream";
    this.identity = options.identity;
    this.clientContext = options.clientContext;

    // setup Context internals
    this._region = this.options.region ?? "us-east-1";
    this._accountId = this.options.accountId ?? "123456789012";
    this.resolve = options.resolve;
    this.reject = options.reject;
    this.finalize = options.finalize ?? function () {};
    for (const [key, value] of Object.entries(this._buildExecutionEnv())) {
      process.env[key] = value;
    }
  }

  public done(
    err?: Error | string,
    messageOrObject?: any
  ): void | APIGatewayProxyResult {
    if (this._stopped) {
      return;
    }
    this._stopped = true;
    this._clearTimeout();
    this.finalize();

    let error: Error | undefined;
    if (typeof err === "string") {
      error = new Error(err);
    } else if (err) {
      error = err;
    }
    if (error) {
      if (this.reject) {
        return this.reject(error);
      }
      throw error;
    }

    let response: APIGatewayProxyResult | undefined;
    if (typeof messageOrObject === "string") {
      response = {
        body: messageOrObject,
        statusCode: 200,
      };
    } else if (
      typeof messageOrObject === "object" &&
      messageOrObject !== null
    ) {
      response = {
        body: JSON.stringify(messageOrObject),
        statusCode: 200,
      };
    }

    const _response = response ? response : { statusCode: 200, body: "" };
    if (this.resolve) {
      return this.resolve(_response);
    }

    return _response;
  }

  public fail(err: Error | string): void {
    this.done(err);
  }

  public succeed(messageOrObject: any): void {
    this.done(undefined, messageOrObject);
  }

  public getRemainingTimeInMillis(): number {
    const now = new Date().getTime();
    return this._timeout + this._startTime - now;
  }

  public _clearTimeout() {
    if (this.__timeout) {
      clearTimeout(this.__timeout);
      this.__timeout = undefined;
    }
  }

  public _buildExecutionEnv() {
    const env: { [key: string]: string } = {};
    const pwd = process.cwd();

    // base configuration
    env.AWS_LAMBDA_FUNCTION_NAME = this.functionName;
    env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE = Math.floor(
      os.freemem() / 1048576
    ).toString();
    env.AWS_LAMBDA_FUNCTION_VERSION = "$LATEST";
    env.AWS_LAMBDA_INITIALIZATION_TYPE = "on-demand";
    env.TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;

    // logging information
    env.AWS_LAMBDA_LOG_GROUP_NAME = this.logGroupName;
    env.AWS_LAMBDA_LOG_STREAM_NAME = this.logStreamName;

    // information so aws-sdk can run as it would normally
    env.AWS_REGION = this._region;
    env.AWS_DEFAULT_REGION = this._region;
    env.AWS_ACCESS_KEY_ID =
      `${this.options.credentials?.accessKeyId}` ??
      process.env.AWS_ACCESS_KEY_ID;
    env.AWS_SECRET_ACCESS_KEY =
      `${this.options.credentials?.secretAccessKey}` ??
      process.env.AWS_SECRET_ACCESS_KEY;
    env.AWS_SESSION_TOKEN =
      `${this.options.credentials?.sessionToken}` ??
      process.env.AWS_SESSION_TOKEN;

    // runtime information
    env.AWS_EXECUTION_ENV = `AWS_Lambda_nodejs${
      process.version.split(".")[0]
    }.x`;
    env.AWS_LAMBDA_RUNTIME_API = "127.0.0.1:9001";
    env._HANDLER = this.options.handler ?? "index.handler";
    env.PWD = pwd;
    env.LAMBDA_TASK_ROOT = pwd;
    env.LAMBDA_RUNTIME_DIR = process.execPath;
    env.NODE_PATH = this.options.nodeModulesPath
      ? this.options.nodeModulesPath
      : resolve(require.resolve("express"), "..", "..");

    return env;
  }

  public _createInvokeFunctionArn() {
    return [
      "arn",
      "aws",
      "lambda",
      this._region,
      this._accountId || Math.round(Math.random() * 1000000000000).toString(),
      "function",
      this.functionName,
      this.functionVersion,
    ].join(":");
  }

  public _createInvokeId() {
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
