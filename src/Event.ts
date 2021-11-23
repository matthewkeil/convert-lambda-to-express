import { Request } from 'express';
import {
  APIGatewayEventRequestContextWithAuthorizer,
  APIGatewayProxyCognitoAuthorizer,
  APIGatewayProxyEventHeaders,
  APIGatewayProxyEventMultiValueHeaders,
  APIGatewayProxyEventMultiValueQueryStringParameters,
  APIGatewayProxyEventPathParameters,
  APIGatewayProxyEventQueryStringParameters,
  APIGatewayProxyEventStageVariables,
  APIGatewayProxyWithCognitoAuthorizerEvent
} from 'aws-lambda';
import { generateRandomHex } from './utils';

const DEFAULT_RESOURCE_PATH = '/{proxy+}';

export interface EventOptions {
  awsRequestId: string;
  accountId: string;
  startTime: number;
  req: Request;
  isBase64EncodedReq?: boolean;
  resourcePath?: string;
  stage?: string;
  stageVariables?: APIGatewayProxyEventStageVariables;
}

export class Event implements APIGatewayProxyWithCognitoAuthorizerEvent {
  public static buildRequestTime(startTime: number) {
    const formatter = new Intl.DateTimeFormat('en-US', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZone: 'UTC'
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

  public static buildRequestMultiValueHeaders(_headers: Request['headers']) {
    const headers: APIGatewayProxyWithCognitoAuthorizerEvent['multiValueHeaders'] = {};
    for (const [name, value] of Object.entries(_headers)) {
      headers[name] = Array.isArray(value) ? value : value ? value.split(',') : undefined;
    }
    return headers;
  }

  public static buildRequestHeaders(_headers: Request['headers']) {
    const headers: APIGatewayProxyWithCognitoAuthorizerEvent['headers'] = {};
    for (const [name, value] of Object.entries(_headers)) {
      headers[name] = Array.isArray(value) ? value.join(',') : value;
    }
    return headers;
  }

  private static buildMultiValueQueryString(query: Request['query']) {
    const flattened: APIGatewayProxyEventMultiValueQueryStringParameters = {};
    const queryParams = typeof query === 'object' ? Object.entries(query) : [];
    if (!queryParams.length) {
      return null;
    }
    for (const [key, value] of queryParams) {
      if (!value) {
        continue;
      } else if (typeof value === 'string') {
        flattened[key] = [value];
      } else if (Array.isArray(value)) {
        const flattenedKey: string[] = [];
        value.forEach(val => {
          if (typeof val === 'string') {
            flattenedKey.push(val);
          }
        });
        flattened[key] = flattenedKey;
      }
    }
    return flattened;
  }

  public static buildQueryString(_query: APIGatewayProxyEventMultiValueQueryStringParameters | null) {
    if (!_query) {
      return null;
    }
    const query: APIGatewayProxyWithCognitoAuthorizerEvent['queryStringParameters'] = {};
    for (const [key, value] of Object.entries(_query)) {
      if (!value) {
        continue;
      }
      query[key] = value.pop();
    }
    return query;
  }

  public body: string | null;
  public path: string;
  public httpMethod: string;
  public pathParameters: APIGatewayProxyEventPathParameters | null;
  public headers: APIGatewayProxyEventHeaders;
  public multiValueHeaders: APIGatewayProxyEventMultiValueHeaders;
  public queryStringParameters: APIGatewayProxyEventQueryStringParameters | null;
  public multiValueQueryStringParameters: APIGatewayProxyEventMultiValueQueryStringParameters | null;

  public resource: string;
  public isBase64Encoded: boolean;

  public stageVariables: APIGatewayProxyEventStageVariables | null;
  public requestContext: APIGatewayEventRequestContextWithAuthorizer<APIGatewayProxyCognitoAuthorizer>;

  constructor(private options: EventOptions) {
    const { req } = this.options;
    const resourcePath = this.options.resourcePath ?? DEFAULT_RESOURCE_PATH;
    const path = req.path;
    const method = req.method;

    this.body = !req.body ? null : typeof req.body === 'string' ? req.body : JSON.stringify(req.body);
    this.path = path;
    this.httpMethod = method;
    this.pathParameters = req.params ?? null;
    this.stageVariables = this.options.stageVariables ?? null;
    this.resource = resourcePath;
    this.isBase64Encoded = this.options.isBase64EncodedReq ?? false;

    this.headers = Event.buildRequestHeaders(req.headers ?? {});
    this.multiValueHeaders = Event.buildRequestMultiValueHeaders(req.headers ?? {});
    this.multiValueQueryStringParameters = Event.buildMultiValueQueryString(req.query ?? {});
    this.queryStringParameters = Event.buildQueryString(this.multiValueQueryStringParameters);

    const startTime = this.options.startTime;

    this.requestContext = {
      accountId: this.options.accountId,
      apiId: 'express',
      protocol: req.protocol ?? 'https',
      httpMethod: method,
      path: path,
      stage: options.stage ?? 'dev',
      requestId: this.options.awsRequestId,
      requestTimeEpoch: startTime,
      requestTime: Event.buildRequestTime(startTime),
      resourcePath,
      resourceId: generateRandomHex(6),
      // TODO: implement
      authorizer: {
        claims: {}
      },
      // TODO: implement
      identity: {
        accessKey: null,
        accountId: null,
        caller: null,
        cognitoIdentityPoolId: null,
        cognitoIdentityId: null,
        sourceIp: '127.0.0.1',
        cognitoAuthenticationType: null,
        cognitoAuthenticationProvider: null,
        userArn: null,
        userAgent: 'Custom User Agent String',
        user: null,
        apiKey: null,
        apiKeyId: null,
        principalOrgId: null,
        clientCert: null
      }
    };
  }
}
