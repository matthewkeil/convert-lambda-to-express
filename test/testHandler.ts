import { APIGatewayProxyWithCognitoAuthorizerEvent, Context } from 'aws-lambda';

export function handler(event: APIGatewayProxyWithCognitoAuthorizerEvent, context: Context) {
  // eslint-disable-next-line no-console
  console.log({ event, context });
}
