import os from "os";
import { resolve } from "path";
import { SharedIniFileCredentials } from "aws-sdk";
import {
  Context as IContext,
  CognitoIdentity,
  ClientContext,
  APIGatewayProxyResult,
} from "aws-lambda";
import { generateRandomHex, TimeoutError } from "./utils";

type Resolve = (response: APIGatewayProxyResult) => void;
type Reject = (err: Error) => void;
/*
 * Lambda's Context object.
 * Refer to this documentation:
 * https://docs.aws.amazon.com/lambda/latest/dg/nodejs-context.html
 */
export interface ContextOptions {
  startTime: number;
  credentials?: SharedIniFileCredentials;
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
  public static createInvokeFunctionArn(
    region: string,
    accountId: string,
    functionName: string
  ) {
    return [
      "arn",
      "aws",
      "lambda",
      region,
      accountId,
      "function",
      functionName,
    ].join(":");
  }

  public static getAwsRequestId() {
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

  private _region: string;
  private _startTime: number;
  private _timeout: number;
  private __timeout?: NodeJS.Timeout;
  private __finalize: () => void;
  private _finalized = false;

  public _accountId: string;
  public _resolve?: Resolve;
  public _reject?: Reject;

  constructor(private options: ContextOptions) {
    // setup time management
    this._startTime = options.startTime;
    this._timeout = options?.timeoutInSeconds
      ? options.timeoutInSeconds * 1000
      : 3000; // default lambda timeout
    this.__timeout = setTimeout(() => {
      this.fail(
        new TimeoutError(
          "Task timed out after " +
            (this._timeout / 1000).toFixed(0) +
            " second(s)"
        )
      );
    }, this._timeout);

    // setup Context internals
    this._region = this.options.region ?? "us-east-1";
    this._accountId = this.options.accountId ?? "123456789012";
    this.__finalize = options.finalize ?? function () {};

    // setup properties of IContext
    this.callbackWaitsForEmptyEventLoop = false; // not supported by this package
    this.functionName = options.functionName ?? "convert-lambda-to-express";
    this.functionVersion = options.functionVersion ?? "$LATEST";
    this.memoryLimitInMB = `${options.memorySize ?? 128}`;
    this.logGroupName =
      options.logGroupName ?? `/aws/lambda/${this.functionName}`;
    this.logStreamName = options.logStreamName ?? "aws-log-stream";
    this.identity = options.identity;
    this.clientContext = options.clientContext;

    this.invokedFunctionArn = Context.createInvokeFunctionArn(
      this._region,
      this._accountId,
      this.functionName
    );
    this.awsRequestId = Context.getAwsRequestId();

    for (const [key, value] of Object.entries(this._buildExecutionEnv())) {
      process.env[key] = value;
    }
  }

  public done(
    err?: Error | string,
    messageOrObject?: any
  ): void | APIGatewayProxyResult {
    let error: Error | undefined;
    if (typeof err === "string") {
      error = new Error(err);
    } else if (err) {
      error = err;
    }
    if (error) {
      if (this._reject) {
        return this._reject(error);
      }
      throw error;
    }

    return this._resolve ? this._resolve(messageOrObject) : messageOrObject;
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

  public _finalize() {
    if (!this._finalized) {
      this.__finalize();
      this._finalized = true;
    }
  }

  public _buildExecutionEnv() {
    const env: { [key: string]: string } = {};
    const pwd = process.cwd();

    /**
     *  Example env from lambda.
     *
     *  // provided by code below
     *  AWS_LAMBDA_FUNCTION_NAME: 'testing',
     *  AWS_LAMBDA_FUNCTION_MEMORY_SIZE: '128',
     *  AWS_LAMBDA_FUNCTION_VERSION: '$LATEST',
     *  AWS_LAMBDA_INITIALIZATION_TYPE: 'on-demand',
     *  TZ: ':UTC',
     *  AWS_LAMBDA_LOG_GROUP_NAME: '/aws/lambda/testing',
     *  AWS_LAMBDA_LOG_STREAM_NAME: '2021/11/22/[$LATEST]de828bd7f9c24c7eb7785595c8986d57',
     *  AWS_REGION: 'us-east-1',
     *  AWS_DEFAULT_REGION: 'us-east-1',
     *  AWS_ACCESS_KEY_ID: 'ASIAZCOEDDHJLKBSTXHC',
     *  AWS_SECRET_ACCESS_KEY: 'p9J3AUnM6Xq/FWC1gbjZYQNPQ5dcrssKFE5O5KuX',
     *  AWS_SESSION_TOKEN: 'IQoJb3JpZ2luX2VjEG0aCXVzLWVhc3QtMSJHMEUCIQDE+QJWdu2ObTnT9tX2LwciiBgtztLCIatoB3SAuf+pXQIgODR1wCU8X0IWyZGWQNcs6gT/fscXr994bg9/PXfW8/8qjAIINhAAGgw2MjM3MTgzNzM4NDIiDDPpPESUXC4fMbct4CrpAc5qgMybO6icB79pLiOw5wysZJJIYRXiB0Je8OAQXrHwNaV8hxyZ8bnLVeSA0K4LSea4htMaKUpL5f88lqmFrIJMYRnKD4V3xVmLX65oFh7wl8WkF2gJ91Hl8x8keEriRdRyD69h1nhcCzM2UsQvZykDw7BTjwBYu74E4JUaTgtdZscG1/W2B9I4ooPWzOwjuCdcY6NFsUC/LBAZojS5UqQkI3Uhj1y4Fj/KtpaGBjR07EaeuRJKEDj7Urw2v4CpmyJIQObu0qqU7nWFAbSiAXyfgEWwJ4F/8sJeDD5rVE9S7aqOj4HSK/nQMJWI8IwGOpoBYbUVUr5d+H4aC4/fJR8oTotYqXqCzwit+KvnShgTLTeOnzxKVIs/h/mAXETBKoSLTSBC5Fhap9+8GJ2Oh+MLRiJ2N2I/JlbT05R9M5J3iL/OlRzxMNj8BLheEit6E23LvmIv+O3AtvDu0N+DDG2++KxlPpmfrC9DiE//i57xfLd/g+arsBnCHw1fK1Jw+6FXovJXVzLloB/DPA==',
     *  AWS_EXECUTION_ENV: 'AWS_Lambda_nodejs14.x',
     *  AWS_LAMBDA_RUNTIME_API: '127.0.0.1:9001',
     *  _HANDLER: 'index.handler',
     *  PWD: '/var/task',
     *  LAMBDA_TASK_ROOT: '/var/task',
     *  LAMBDA_RUNTIME_DIR: '/var/runtime',
     *  NODE_PATH: '/opt/nodejs/node14/node_modules:/opt/nodejs/node_modules:/var/runtime/node_modules:/var/runtime:/var/task',
     *
     *  // provided by node env
     *  LANG: 'en_US.UTF-8',
     *  PATH: '/var/lang/bin:/usr/local/bin:/usr/bin/:/bin:/opt/bin',
     *  SHLVL: '0',
     *
     *  // no provided
     *  NODE_EXTRA_CA_CERTS: '/etc/pki/tls/certs/ca-bundle.crt',
     *  LD_LIBRARY_PATH: '/var/lang/lib:/lib64:/usr/lib64:/var/runtime:/var/runtime/lib:/var/task:/var/task/lib:/opt/lib',
     *  AWS_XRAY_DAEMON_ADDRESS: '169.254.79.129:2000',
     *  _AWS_XRAY_DAEMON_ADDRESS: '169.254.79.129',
     *  _AWS_XRAY_DAEMON_PORT: '2000',
     *  AWS_XRAY_CONTEXT_MISSING: 'LOG_ERROR',
     *  _X_AMZN_TRACE_ID: 'Root=1-619c0415-0114f3884674422b7ee957a1;Parent=4a9245f561fc8965;Sampled=0'
     */

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
    if (this.options.credentials?.accessKeyId) {
      env.AWS_ACCESS_KEY_ID = this.options.credentials.accessKeyId;
    }
    if (this.options.credentials?.secretAccessKey) {
      env.AWS_SECRET_ACCESS_KEY = this.options.credentials.secretAccessKey;
    }
    if (this.options.credentials?.sessionToken) {
      env.AWS_SESSION_TOKEN = this.options.credentials.sessionToken;
    }

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
}
