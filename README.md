# convert-lambda-to-express

<!-- [![NPM](https://nodei.co/npm/lambda-local.png?compact=true)](https://www.npmjs.com/package/lambda-local)

[![Lambda-local unit tests](https://github.com/ashiina/lambda-local/actions/workflows/unittests.yml/badge.svg?branch=develop&event=push)](https://github.com/ashiina/lambda-local/actions?query=event%3Apush) -->

Lambda-local lets you test **NodeJS Amazon Lambda functions** on your local machine, by providing a simplistic API and command-line tool.

It does not aim to be perfectly feature proof as projects like [serverless-offline](https://github.com/dherault/serverless-offline) or [docker-lambda](https://github.com/lambci/docker-lambda), but rather to remain **very light** (it still provides a fully built `Context`, handles all of its parameters and functions, and everything is customizable easily).

The main target are unit tests and running lambda functions locally.

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
import { wrapLambda } from "convert-lambda-to-express";
import express from "express";
import { handler, WrapperOptions } from "./someLambdaHandler";

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

Executes a lambda given the `options` object:

| Key name | Description |
| --- | --- |
| `event`|requested event as a json object|
| `lambdaPath`|requested path to the lambda function|
| `lambdaFunc`|pass the lambda function. You cannot use it at the same time as lambdaPath|
| `profilePath`|optional, path to your AWS credentials file|
| `profileName`|optional, aws profile name. Must be used with |
| `lambdaHandler`|optional handler name, default to `handler`|
| `region`|optional, AWS region, default to `us-east-1`|
| `callbackWaitsForEmptyEventLoop`|optional, default to `false`. Setting it to True will wait for an empty loop before returning.|
| `timeoutMs`|optional, timeout, default to 3000 ms|
| `environment`|optional, extra environment variables for the lambda|
| `envfile`|optional, load an environment file before booting|
| `envdestroy`|optional, destroy added environment on closing, default to false|
| `verboseLevel`|optional, default 3. Level 2 dismiss handler() text, level 1 dismiss lambda-local text and level 0 dismiss also the result
| `callback`|optional, lambda third parameter [callback][1]. When left out a Promise is returned|
| `clientContext`|optional, used to populated clientContext property of lambda second parameter (context)


## License

This library is released under the MIT license.

[1]: http://docs.aws.amazon.com/lambda/latest/dg/nodejs-prog-model-handler.html
