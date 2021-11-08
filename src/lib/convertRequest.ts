import { Request } from "express";
import {
  APIGatewayProxyResult,
  APIGatewayProxyWithCognitoAuthorizerEvent,
} from "aws-lambda";
import { Context } from "./Context";
import { generateRandomHex } from "./utils";
import { WrapperOptions } from "..";
import { SharedIniFileCredentials } from "aws-sdk";

const defaultWrapperOptions = {
  functionName: "convert-lambda-to-express",
  resourcePath: "/${proxy+}",
};

function buildRequestTime(startTime: number) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "UTC",
  });

  const formatted = formatter.formatToParts(new Date(startTime));
  const day = formatted[2]?.value;
  const month = formatted[0]?.value;
  const year = formatted[4]?.value;
  const hour = formatted[6]?.value;
  const minute = formatted[8]?.value;
  const second = formatted[10]?.value;
  return `${day}/${month}/${year}:${hour}:${minute}:${second} +0000`;
}

function buildQueryString(query: Request["query"]) {
  const params: APIGatewayProxyWithCognitoAuthorizerEvent["queryStringParameters"] =
    {};
  for (const [key, value] of Object.entries(query)) {
    params[key] = Array.isArray(value) ? value.join(" ") : `${value}`;
  }
  return params;
}

function buildRequestHeaders(_headers: Request["headers"]) {
  const headers: APIGatewayProxyWithCognitoAuthorizerEvent["headers"] = {};
  for (const [name, value] of Object.entries(_headers)) {
    headers[name] = Array.isArray(value) ? value.join(" ") : value;
  }
  return headers;
}

interface ConvertRequestOptions extends WrapperOptions {
  req: Request;
  nodeModulesPath: string;
  credentials?: SharedIniFileCredentials;
  resolve: (response: APIGatewayProxyResult) => void;
  reject: (err: Error) => void;
}

export function convertRequest({
  req,
  credentials,
  resolve,
  reject,
  ...options
}: ConvertRequestOptions) {
  const startTime = Date.now();

  const context = new Context({
    ...options,
    functionName: options.functionName ?? defaultWrapperOptions.functionName,
    timeoutInSeconds: options.timeoutInSeconds,
    startTime,
    credentials,
    resolve,
    reject,
  });

  const event: APIGatewayProxyWithCognitoAuthorizerEvent = {
    body: req.body,
    resource: options.resourcePath ?? defaultWrapperOptions.resourcePath,
    httpMethod: req.method,
    path: req.path,
    pathParameters: req.params,
    headers: buildRequestHeaders(req.headers),
    multiValueHeaders: {},
    queryStringParameters: buildQueryString(req.query),
    multiValueQueryStringParameters: {},
    isBase64Encoded: options.isBase64Encoded ?? false,
    
    stageVariables: null,
    requestContext: {
      accountId: options.accountId ?? "123456789012",
      apiId: "express",
      protocol: req.protocol,
      httpMethod: req.method,
      path: req.path,
      stage: options.stage ?? "dev",
      requestId: context.awsRequestId,
      requestTimeEpoch: startTime,
      requestTime: buildRequestTime(startTime),
      resourcePath: options.resourcePath ?? defaultWrapperOptions.resourcePath,
      resourceId: generateRandomHex(6),
      // TODO: implement
      authorizer: {
        claims: {},
      },
      // TODO: implement
      identity: {
        accessKey: null,
        accountId: null,
        caller: null,
        cognitoIdentityPoolId: null,
        cognitoIdentityId: null,
        sourceIp: "127.0.0.1",
        cognitoAuthenticationType: null,
        cognitoAuthenticationProvider: null,
        userArn: null,
        userAgent: "Custom User Agent String",
        user: null,
        apiKey: null,
        apiKeyId: null,
        principalOrgId: null,
        clientCert: null,
      },
    },
  };

  return {
    event,
    context,
  };
}
