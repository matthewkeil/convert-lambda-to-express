# convert-lambda-to-express

Production-ready package to run your lambda workloads as an express server. Build with the developer (me :P) in mind and makes development of lambda api's a breeze. This package was developed because the other options available for running lambdas, like [sam local start-api](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/sam-cli-command-reference-sam-local-start-api.html) [serverless-offline](https://github.com/dherault/serverless-offline) or [docker-lambda](https://github.com/lambci/docker-lambda), require docker containers and are VERY slow hot-reloading or do not provide that feature at all (how does one dev without hot reload these days?!?!).

Running apiGateway/lambda locally during development can be a challenge (to say the least). The other options out there are either too slow or too complicated. This package aims to solve this problem by providing a simple way to run your api locally. It allows you to wrap your handlers and serve them from an express server.

`convert-lambda-to-express` provides fully features `event` and `context` objects to your handlers and there should be no need to modify your existing code. If you rely on the ENVIRONMENT variables that lambda provides, those are accounted for as well.

There are even some great use cases for migrating workloads away from Lambda and this is the project for you. Hate your, now baked-in, vendor lock with the non-portable lambda function signature? Have you found that concurrency limits with very choppy traffic for extremely high workloads make it hard to reserve concurrency for and just want to use an auto-scaling group or kubernetes cluster now that you've grown? Do you have long running, but very low resource tasks that end up costing an arm and leg on Lambda. Depending on your specifics it can end up being much more effective/cost-efficient to run you system on EC2 or on a kubernetes cluster. Rest assured this is a production-ready package that is built for a bulletproof base with express.

If you love this package and want to [thank me](https://www.paypal.com/donate?hosted_button_id=HCF76TA62TXJW), or contract with me, you can find me at [Matthew Keil](https://www.linkedin.com/in/matthew-keil/).  I specialize in DevOps, Security(SecOps) and Crypto/Solidity development. Open-source for the win!

## Install

```bash
npm install -S convert-lambda-to-express
```

## Basic usage

```typescript
import { wrapLambda } from "convert-lambda-to-express";
import express from "express";
import { handler } from "./someLambdaHandler";

const app = express();

app.get("/", wrapLambda(handler));

app.listen(3000, () => {
  console.log("Listening on port 3000");
});
```

## Advanced usage

```typescript
import express from "express";
import { wrapLambda, WrapperOptions } from "convert-lambda-to-express";
import { handler } from "./someLambdaHandler";

const app = express();

const options: WrapperOptions = {
  functionName: "my-function",
  resourcePath: "/api/v1/my-function",
  profile: "my-aws-credentials-profile", // from ~/.aws/credentials
  region: "us-east-1", // sets AWS_REGION for sdk calls in handler
  timeoutInSeconds: 10, // sets actual timeout for handler
  finalize: () => {
    // do some cleanup here after function runs but before
    // response is sent to client
  },
};

app.get(config.resourcePath, wrapLambda(handler, options));

app.listen(3000, () => {
  console.log("Listening on port 3000");
});
```


## WrapperOptions

Configure your lambdas with the the `options` object:

```typescript
export interface WrapperOptions {
  functionName?: string;
  resourcePath?: string;
  profile?: string;
  region?: string;
  accountId?: string;
  timeoutInSeconds?: number;
  stage?: string;
  isBase64Encoded?: boolean;
  handler?: string; 
  nodeModulesPath?: string;
  identity?: CognitoIdentity;
  clientContext?: ClientContext;
  finalize?: () => void;
  logger?: Logger;
  defaultHeaders?: { [header: string]: string | number | boolean };
}
```

| Key name | Description |
| --- | --- |
| `functionName`|optional, defaults to `convert-lambda-to-express`. Placed in ENVIRONMENT, `event` and `context`|
| `resourcePath`|optional, defaults to `/${proxy+}` Placed in ENVIRONMENT, `event` and `context`|
| `profile`|optional, defaults to `default`. profile from `~/.aws/credential` to use. Adds tokens to AWS_TOKEN, AWS_SECRET_TOKEN, AWS_SESSION_TOKEN|
| `region`|optional, AWS region, default to `us-east-1`. adds AWS_REGION to ENVIRONMENT|
| `accountId`|optional, aws account id. Placed in ENVIRONMENT|
| `timeoutInSeconds`|optional, default to `3`. watchdog timer that mimics lambda's timeout|
| `stage`|optional, defaults to `dev`. Passed in `event`|
| `isBase64Encoded`|optional, default to `false`. Passed in to handler `event`|
| `handler`|optional, in `filename.exportName` format. Placed in ENVIRONMENT|
| `nodeModulesPath`|optional, path to local node_modules folder. Placed in ENVIRONMENT|
| `identity`|optional, CognitoIdentity object, see [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/7b62f878cc218c8e94e6efafa55cea6796b501f7/types/aws-lambda/handler.d.ts#L124). Passed in `context`|
| `clientContext`|optional, ClientContext object, see [DefinitelyTyped](https://github.com/DefinitelyTyped/DefinitelyTyped/blob/7b62f878cc218c8e94e6efafa55cea6796b501f7/types/aws-lambda/handler.d.ts#L129). Passed in `context`|
| `finalize`|optional, clean-up function that is called at the end of each request|
| `logger`|optional, winston Logger object. will default to the console object if not present|
| `defaultHeaders`|optional, headers that should be applied to all responses|


## License

This library is released under the MIT license.
