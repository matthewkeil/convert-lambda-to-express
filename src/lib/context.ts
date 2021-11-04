import os from "os";
import { SharedIniFileCredentials } from "aws-sdk";
import {
  Context as IContext,
  CognitoIdentity,
  ClientContext,
  APIGatewayProxyResult,
} from "aws-lambda";
import { generateRandomHex, TimeoutError } from "./utils.js";
import { WrapperOptions } from "../index.js";

/*
 * Lambda's Context object.
 * Refer to this documentation:
 * https://docs.aws.amazon.com/lambda/latest/dg/nodejs-context.html
 */
export interface ContextOptions extends WrapperOptions {
  functionName: string;
  startTime: number;
  credentials?: SharedIniFileCredentials;
  nodeModulesPath: string;
  resolve: (response: APIGatewayProxyResult) => void;
  reject: (err: Error) => void;
}

export class Context implements IContext {
  public callbackWaitsForEmptyEventLoop = false; // not possible on a server
  public functionName: string;
  public functionVersion: string;
  public invokedFunctionArn: string;
  public memoryLimitInMB: string;
  public awsRequestId: string;
  public logGroupName: string;
  public logStreamName = "aws-log-stream";
  public identity?: CognitoIdentity;
  public clientContext?: ClientContext;

  private startTime: number;
  private timeout: number;
  private finalize: () => void;

  private _timeout?: NodeJS.Timeout;
  private _stopped = false;

  constructor(private options: ContextOptions) {
    this.finalize = options.finalize ?? function () {};
    this._buildExecutionEnv();

    /**
     *
     *
     *
     */
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
    this.startTime = options.startTime;
    this.timeout = options?.timeoutInSeconds
      ? options.timeoutInSeconds * 1000
      : 3000; // default lambda timeout
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

  done(err?: Error | string, messageOrObject?: any): void {
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
      return this.options.reject(error);
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
    response
      ? this.options.resolve(response)
      : this.options.resolve({ statusCode: 200, body: "" });
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

  public _clearTimeout() {
    if (this._timeout) {
      clearTimeout(this._timeout);
      this._timeout = undefined;
    }
  }

  private _buildExecutionEnv() {
    const defaultRegion = "us-east-1";
    const pwd = process.cwd();

    // base configuration
    process.env.AWS_LAMBDA_FUNCTION_NAME = this.options.functionName;
    process.env.AWS_LAMBDA_FUNCTION_MEMORY_SIZE = Math.floor(
      os.freemem() / 1048576
    ).toString();
    process.env.AWS_LAMBDA_FUNCTION_VERSION = "$LATEST";
    process.env.AWS_LAMBDA_INITIALIZATION_TYPE = "on-demand";
    process.env.TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // logging information
    process.env.AWS_LAMBDA_LOG_GROUP_NAME = this.logGroupName;
    process.env.AWS_LAMBDA_LOG_STREAM_NAME = this.logStreamName;
    // information so aws-sdk can run as it would normally
    process.env.AWS_REGION = this.options.region ?? defaultRegion;
    process.env.AWS_DEFAULT_REGION = this.options.region ?? defaultRegion;
    process.env.AWS_ACCESS_KEY_ID = `${this.options.credentials?.accessKeyId}`;
    process.env.AWS_SECRET_ACCESS_KEY = `${this.options.credentials?.secretAccessKey}`;
    process.env.AWS_SESSION_TOKEN = `${this.options.credentials?.sessionToken}`;
    // runtime information
    process.env.AWS_EXECUTION_ENV = `AWS_Lambda_nodejs${
      process.version.split(".")[0]
    }.x`;
    process.env.AWS_LAMBDA_RUNTIME_API = "127.0.0.1:9001";
    process.env._HANDLER = this.options.handler ?? "index.handler";
    process.env.PWD = pwd;
    process.env.LAMBDA_TASK_ROOT = pwd;
    process.env.LAMBDA_RUNTIME_DIR = process.execPath;
    process.env.NODE_PATH = this.options.nodeModulesPath;
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
