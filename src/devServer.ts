/* eslint-disable no-console */
import { watch } from 'fs';
import { resolve } from 'path';
import { createServer } from 'http';
import type { APIGatewayProxyWithCognitoAuthorizerHandler } from 'aws-lambda';
import morgan from 'morgan';
import helmet from 'helmet';
import cors, { CorsOptions } from 'cors';
import express, { Handler } from 'express';
import { HttpMethod } from './utils';
import { wrapLambda, WrapperOptions } from './wrapLambda';

type MorganOption = 'combined' | 'common' | 'dev' | 'short' | 'tiny';

type HandlerEnvironment = { [key: string]: string };

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

const handlerDefinitions: HandlerConfig[] = [];

export const watchPaths: string[] = [];
export function watchCodePath(path: string) {
  let pathIsShorter = false;
  for (let index = 0; index < watchPaths.length; index++) {
    const watched = watchPaths[index] as string;
    if (watched.startsWith(path)) {
      if (!pathIsShorter) {
        // path is shorter root path so replace with root
        watchPaths[index] = path;
        pathIsShorter = true;
        continue;
      }
      // already watching root, remove entry
      watchPaths.splice(index, 1);
    } else if (path.startsWith(watched)) {
      // already watching root
      return;
    }
  }

  if (!pathIsShorter) {
    // if path is not shorter and not already watched yet then path is not part of the same file tree
    watchPaths.push(path);
  }
}

export function addToDevServer(config: HandlerConfig) {
  handlerDefinitions.push(config);
}

export const overwrittenKeys: string[] = [];
export function loadEnvironment({ verbose, environment }: { verbose?: boolean; environment?: HandlerEnvironment }) {
  if (!environment) {
    return;
  }
  for (const [key, value] of Object.entries(environment)) {
    if (key in process.env) {
      overwrittenKeys.push(key);
    }
    if (verbose) {
      console.log(`loading env: key ${key} with value ${value}`);
    }
    process.env[key] = value;
  }
}

interface GetHandlerConfig {
  handler: string;
  codeDirectory: string;
}
export function getHandler({ codeDirectory, handler }: GetHandlerConfig) {
  watchCodePath(codeDirectory);

  const handlerPathSegments = handler.split('/');
  const filenameAndExport = handlerPathSegments.pop()?.split('.');
  if (!Array.isArray(filenameAndExport) || filenameAndExport.length !== 2) {
    throw new Error(`handler ${handler} is not valid`);
  }
  const [filename, exportName] = filenameAndExport as [string, string];

  const filePath = resolve(codeDirectory, ...handlerPathSegments, filename);
  const resolved = require.resolve(filePath);
  if (require.cache[resolved]) {
    delete require.cache[resolved]; // eslint-disable-line @typescript-eslint/no-dynamic-delete
  }

  return {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    handlerFunction: require(resolved)[exportName] as APIGatewayProxyWithCognitoAuthorizerHandler,
    filePath: resolved,
    exportName
  };
}

export function convertToExpressPath(resourcePath: string) {
  return resourcePath.replace(/\{/g, ':').replace(/\}/g, '');
}

function buildDevServer({
  verbose,
  prod,
  morganSetting,
  corsOptions,
  helmetOptions,
  middleware,
  codeDirectory: globalCodeDirectory
}: DevServerConfig = {}) {
  const devServer = express();
  devServer.use(morgan(morganSetting ?? prod ? 'combined' : 'dev'));
  devServer.use(
    cors(
      corsOptions ?? {
        origin: '*',
        methods: '*',
        allowedHeaders: '*'
      }
    )
  );
  devServer.use(helmet(helmetOptions));

  if (middleware) {
    for (const middlewareHandler of middleware) {
      devServer.use(middlewareHandler);
    }
  }

  for (const handlerConfig of handlerDefinitions) {
    const { environment, method, resourcePath, handler } = handlerConfig;
    const path = convertToExpressPath(resourcePath);
    const _method = method.toLowerCase() as Lowercase<HttpMethod>;

    /**
     * load environment from definition provided in template to lambda
     * will attempt to give correct values during parse phase of require below.
     * if process.env.KEY is used in the body of the handler, instead of proxied
     * at the head like `const tableName = process.env.TABLE_NAME` as the head
     * the value may be incorrect at runtime.
     */
    loadEnvironment({ verbose, environment });

    const codeDirectory = handlerConfig.codeDirectory ?? globalCodeDirectory;
    if (!codeDirectory) {
      throw new Error(`codeDirectory is required for ${handlerConfig.handler}`);
    }
    const { exportName, filePath, handlerFunction } = getHandler({
      codeDirectory,
      handler
    });
    const wrappedHandler = wrapLambda(handlerFunction, handlerConfig);
    devServer[_method](path, wrappedHandler);

    if (verbose) {
      console.log({
        method: _method,
        path,
        exportName,
        filePath
      });
    }
  }

  if (overwrittenKeys.length && verbose) {
    console.log(`The following process.env.KEYS were overwritten. The
same key was loaded in multiple handler files and there may be
undesired effects.

The values should be correct if you proxied the values to separate
variables at the head of each file, however if you use process.env.KEY
during runtime, and not just during the parse phase, there will be problems
as the values for the keys listed below may be different than anticipated.

The following are the keys that may have been overwritten:
>
${overwrittenKeys.map(key => `> process.env.${key}`).join('\n')}
>`);
  }

  return devServer;
}

export function getDevServer(config?: DevServerConfig) {
  if (!handlerDefinitions.length) {
    throw new Error('no handlers added to server');
  }
  return buildDevServer(config);
}

export function startDevServer(config: DevServerConfig = {}) {
  if (config.prod) {
    process.env.NODE_ENV = 'production';
  } else if (process.env.NODE_ENV === 'production') {
    config.prod = true;
  }

  const port = config.port ?? 3001;
  const hotReload = config.hotReload ?? true;

  function startServer() {
    const app = getDevServer(config);
    const server = createServer(app);
    server.listen(port, () => {
      console.log(`listening on port: ${port}`);
    });

    return { app, server };
  }

  let { app, server } = startServer();

  if (hotReload) {
    for (const path of watchPaths) {
      let debounce: NodeJS.Timeout | undefined;
      watch(path, { recursive: true }, () => {
        // debounce server restarts to once a second
        if (!debounce) {
          debounce = setTimeout(() => {
            if (debounce) {
              // if timeout still exists during tick clear it
              clearTimeout(debounce);
            }
            debounce = undefined;
          }, 1000);

          server.close(err => {
            if (err) {
              throw err;
            }
            ({ app, server } = startServer());
          });
        }
      });
    }
  }

  return { app, server };
}