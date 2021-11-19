import { watch } from "fs";
import { resolve, sep } from "path";
import { createServer } from "http";
import morgan from "morgan";
import helmet from "helmet";
import cors, { CorsOptions } from "cors";
import express, { Handler } from "express";
import { HttpMethod } from "./utils";
import { wrapLambda, WrapperOptions } from "./wrapLambda";

type MorganOption = "combined" | "common" | "dev" | "short" | "tiny";

type HandlerEnvironment = { [key: string]: string };

export interface HandlerConfig extends WrapperOptions {
  method: HttpMethod;
  handler: string;
  resourcePath: string;
  codeDirectory: string;
  environment?: HandlerEnvironment;
}

export interface DevServerConfig extends WrapperOptions {
  port?: number;
  hotReload?: boolean;
  prod?: boolean;
  morganSetting?: MorganOption;
  corsOptions?: CorsOptions;
  helmetOptions?: Parameters<typeof helmet>[0];
  middleware?: Handler[];
  verbose?: boolean;
}

const overwrittenKeys: string[] = [];
const handlerDefinitions: HandlerConfig[] = [];

const watchPaths: string[] = [];
function watchCodePath(path: string) {
  for (const watched of watchPaths) {
    if (watched.startsWith(path)) {
      // path is shorter root path so replace with root
      const index = watchPaths.indexOf(watched);
      watchPaths[index] = path;
      return;
    } else if (path.startsWith(watched)) {
      // already watching root
      return;
    }
  }
  // if haven't returned yet then path is not part of the same file tree
  watchPaths.push(path);
}

export function addToDevServer(config: HandlerConfig) {
  handlerDefinitions.push(config);
}

function loadEnvironment({
  verbose,
  environment,
}: {
  verbose?: boolean;
  environment?: HandlerEnvironment;
}) {
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

function getHandler(config: HandlerConfig & { verbose?: boolean }) {
  const { codeDirectory, handler, method, resourcePath, environment, verbose } =
    config;

  watchCodePath(codeDirectory);

  const handlerPathSegments = handler.split("/");
  const filenameAndExport = handlerPathSegments.pop()?.split(".");
  if (!Array.isArray(filenameAndExport) || filenameAndExport.length !== 2) {
    throw new Error(`handler ${handler} is not valid`);
  }
  const [filename, exportName] = filenameAndExport as [string, string];
  const filePath = require.resolve(
    resolve(...codeDirectory.split(sep), ...handlerPathSegments, filename)
  );

  /**
   * load environment from definition provided in template to lambda
   * will attempt to give correct values during parse phase of require below.
   * if process.env.KEY is used in the body of the handler, instead of proxied
   * at the head like `const tableName = process.env.TABLE_NAME` as the head
   * the value may be incorrect at runtime.
   */
  loadEnvironment({ verbose, environment });

  if (verbose) {
    console.log({
      method,
      resourcePath,
      filePath,
    });
  }

  if (require.cache[filePath]) {
    delete require.cache[filePath];
  }
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  return wrapLambda(require(filePath)[exportName], config);
}

function buildDevServer({
  verbose,
  prod,
  morganSetting,
  corsOptions,
  helmetOptions,
  middleware,
}: DevServerConfig = {}) {
  const devServer = express();
  devServer.use(morgan(morganSetting ?? prod ? "combined" : "dev"));
  devServer.use(
    cors(
      corsOptions ?? {
        origin: "*",
        methods: "*",
        allowedHeaders: "*",
      }
    )
  );
  devServer.use(helmet(helmetOptions));

  if (middleware) {
    for (const middlewareHandler of middleware) {
      devServer.use(middlewareHandler);
    }
  }

  for (const {
    codeDirectory,
    resourcePath,
    method,
    handler,
    environment,
  } of handlerDefinitions) {
    const _method = method.toLowerCase() as Lowercase<HttpMethod>;
    devServer[_method](
      resourcePath,
      getHandler({
        handler,
        method,
        resourcePath,
        codeDirectory,
        environment,
        verbose,
      })
    );
  }

  if (overwrittenKeys.length) {
    const keyList = overwrittenKeys.map((key) => `> ${key}\n`);
    console.log(`The following process.env.KEYS were overwritten. The 
same key was loaded in multiple handler files and there may be
undesired effects.  

The values should be correct if you proxied the values to separate
values at the head of each file, however if you use process.env.KEY
during runtime, and not just during the parse phase, there will be problems
as the values for the keys listed below may be different than anticipated.

The following are the keys that may have been overwritten:
>
> ${keyList}
>`);
  }

  return devServer;
}

export function getDevServer(config?: DevServerConfig) {
  if (!handlerDefinitions.length) {
    throw new Error("no handlers added to server");
  }
  return buildDevServer(config);
}

export function startDevServer(config: DevServerConfig = {}) {
  const port = config.port ?? 3001;
  const hotReload = config.hotReload ?? true;

  function startServer() {
    const app = getDevServer(config);
    const server = createServer(app);
    server.listen(port, () => {
      console.log(`listening on port: ${port}`);
    });

    return { server, app };
  }

  let { server, app } = startServer();

  if (hotReload) {
    for (const path of watchPaths) {
      watch(path, { recursive: true }, () => {
        server.close(() => {
          ({ server } = startServer());
        });
      });
    }
  }

  return { app, server };
}
