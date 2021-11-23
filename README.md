# convert-lambda-to-express

Production-ready package to run your lambda workloads as an express server. Built with both developers and enterprise in mind.

`convert-lambda-to-express` provides fully features `event` and `context` objects to your handlers and there should be no need to modify your existing code. If you rely on the `ENVIRONMENT` variables that lambda provides, those are accounted for as well.

Running apiGateway/lambda locally during development can be a challenge (to say the least). The other options out there are either too slow or too complicated. This package aims to solve this problem by providing a simple way to run your api locally. It allows you to wrap your handlers and serve them from an express server.

Makes development of lambda api's a breeze. This package was developed because the other options available for running lambdas, like [sam local](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-cli-command-reference-sam-local-start-api.html), [serverless-offline](https://github.com/dherault/serverless-offline) or [docker-lambda](https://github.com/lambci/docker-lambda), require docker containers. They are all VERY slow hot-reloading or do not provide that feature at all (how does one dev without hot reload these days?!?!).

There are even some great use cases for migrating workloads away from Lambda and this is the project for you.

Hate your, now baked-in, vendor lock and the non-portable lambda function signature? Have you found that concurrency limits for very choppy traffic and extremely high workloads hard to reserve concurrency for? Just want to use an auto-scaling group or kubernetes cluster now that you've grown? Do you have long running, but very low resource tasks that end up costing an arm and leg on Lambda. Depending on your specifics it can end up being much more effective/cost-efficient to run you system on EC2 or a kubernetes cluster. Rest assured this is a production-ready package that is built for a bulletproof base with express.

If you love this package and want to [thank me](https://www.paypal.com/donate?hosted_button_id=HCF76TA62TXJW), or contract with me, you can find me at [Matthew Keil](https://www.linkedin.com/in/matthew-keil/). I specialize in Crypto/Solidity, DevOps and Security(SecOps) development. Open-source for the win!

## Install

```bash
npm install -S convert-lambda-to-express
```

## Basic usage

```typescript
import { wrapLambda } from 'convert-lambda-to-express';
import express from 'express';
import { handler } from './someLambdaHandler';

const app = express();

app.get('/', wrapLambda(handler));

app.listen(3000, () => {
  console.log('Listening on port 3000');
});
```

## Advanced usage

```typescript
import express from 'express';
import { wrapLambda, WrapperOptions } from 'convert-lambda-to-express';
import { handler } from './someLambdaHandler';

const app = express();

const options: WrapperOptions = {
  functionName: 'my-function',
  resourcePath: '/api/v1/my-function',
  profile: 'my-aws-credentials-profile', // from ~/.aws/credentials
  region: 'us-east-1', // sets AWS_REGION for sdk calls in handler
  timeoutInSeconds: 10, // sets actual timeout for handler
  finalize: () => {
    // do some cleanup here after function runs but before
    // response is sent to client
  }
};

app.get(config.resourcePath, wrapLambda(handler, options));

app.listen(3000, () => {
  console.log('Listening on port 3000');
});
```

## Hot-Reloading DevServer (useful with cdk)

You can import the `addToDevServer` into your cdk constructs and add the handlers during run time.  This was the designed use case.  See [`matthewkeil/full-stack-pattern`](https://github.com/matthewkeil/full-stack-pattern) for an example. Also works well with sam templates or any other method for programmatically building the handlers array in the example below.  In the cdk instance, instead of calling app.synth() call startDevServer() and it will give you a hot reloading api.   

```typescript
import { addToDevServer, startDevServer, HandlerConfig } from 'convert-lambda-to-express';
import { middlewareHandler } from './someCorporateMiddleware';

// HandlerConfig extends WrapperOptions
const handlers: HandlerConfig[] = [
  {
    profile: 'my-aws-credentials-profile', // from ~/.aws/credentials
    region: 'us-east-1', // sets AWS_REGION for sdk calls in handler
    method: 'GET',
    path: '/path/{param1}/{param2}',
    handler: 'doSomethingFancy/index.handler',
    codeDirectory: './path/to/code/directory', // where `doSomething` fancy folder is located
    environment: {
      ENV_VAR: 'value'
    }
  }
];

for (const handler of handlers) {
  addToDevServer(handler);
}

const port = 3002;

startDevServer({
  port,
  prod: true,
  hotReload: true, // will watch all `handler.codeDirectory` paths for changes and restart server
  corsOptions: {
    // cors package options
    origin: `http://localhost:${port}`,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    preflightContinue: false,
    optionsSuccessStatus: 204
  },
  helmetOptions: {
    // helmet package options, pick better options than this example please...
    noSniff: true,
    xssFilter: true
  }
});
```

## WrapperOptions, HandlerConfig and DevServerConfig

Configure your lambdas and devServer with these `options` objects:

```typescript
export interface WrapperOptions {
  handler?: string;
  functionName?: string;
  functionVersion?: string;
  memorySize?: number;
  logGroupName?: string;
  logStreamName?: string;
  timeoutInSeconds?: number;
  identity?: CognitoIdentity;
  clientContext?: ClientContext;
  nodeModulesPath?: string;
  resourcePath?: string;
  stage?: string;
  isBase64Encoded?: boolean;
  finalize?: () => void;
  accountId?: string;
  region?: string;
  profile?: string;
  credentialsFilename?: string;
  logger?: Logger; // winston logger
  defaultResponseHeaders?: { [header: string]: string | number | boolean };
}

export interface HandlerConfig extends WrapperOptions {
  method: HttpMethod;
  resourcePath: string;
  handler: string;
  codeDirectory?: string;
  environment?: HandlerEnvironment;
}

export interface DevServerConfig {
  port?: number;
  hotReload?: boolean;
  prod?: boolean;
  morganSetting?: MorganOption;
  corsOptions?: CorsOptions;
  helmetOptions?: Parameters<typeof helmet>[0];
  middleware?: Handler[];
  verbose?: boolean;
  codeDirectory?: string;
}
```

| Key name | Description |
| --- | --- |
| `method` | HTTP method to use for the handler|
| `resourcePath`|defaults to `/{proxy+}` Placed in ENVIRONMENT, `event` and `context`|
| `handler`|`filename.exportName` format. Placed in ENVIRONMENT|
| `codeDirectory`|used to import handler and for watching code changes|
| `environment`|environment variables|
| `functionName`|optional, defaults to `convert-lambda-to-express`. Placed in ENVIRONMENT, `event` and `context`|
| `functionVersion`|optional, defaults to `$LATEST`. Placed in ENVIRONMENT|
| `timeoutInSeconds`|optional, default to `3`. watchdog timer that mimics lambda's timeout|
| `identity`|optional, CognitoIdentity object, see [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/7b62f878cc218c8e94e6efafa55cea6796b501f7/types/aws-lambda/handler.d.ts#L124). Passed in `context`|
| `clientContext`|optional, ClientContext object, see [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/7b62f878cc218c8e94e6efafa55cea6796b501f7/types/aws-lambda/handler.d.ts#L129). Passed in `context`|
| `nodeModulesPath`|optional, path to local node_modules folder. Placed in ENVIRONMENT|
| `stage`|optional, defaults to `dev`. Passed in `event`|
| `isBase64Encoded`|optional, default to `false`. Passed in to handler `event`|
| `finalize`|optional, clean-up function that is called at the end of each request|
| `accountId`|optional, aws account id. Placed in ENVIRONMENT|
| `region`|optional, AWS region, default to `us-east-1`. adds AWS_REGION to ENVIRONMENT|
| `profile`|optional, defaults to `default`. profile from `~/.aws/credential` to use. Adds tokens to AWS_TOKEN, AWS_SECRET_TOKEN, AWS_SESSION_TOKEN|
| `credentialsFilename`|optional, defaults to `~/.aws/credential`|
| `logger`|optional, winston Logger object. will default to the console object if not present|
| `defaultResponseHeaders`|optional, headers that should be applied to all responses|


## License

This library is released under the MIT license.
