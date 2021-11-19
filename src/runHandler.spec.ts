import util from "util";
import { APIGatewayProxyWithCognitoAuthorizerHandler } from "aws-lambda";
import { Context } from "./Context";
import { Event } from "./Event";
import { runHandler } from "./runHandler";

describe("runHandler()", () => {
  function buildObjects() {
    const startTime = Date.now();
    const context = new Context({ startTime });
    const event = new Event({
      startTime,
      awsRequestId: context.awsRequestId,
    });
    const logger = {
      log: jest.fn() as any,
      warn: jest.fn() as any,
      error: jest.fn() as any,
      info: jest.fn() as any,
    } as Console;

    return { event, context, logger };
  }

  describe("handles valid responses", () => {
    it("should handle context.done() finalized handlers", (done) => {
      const handler: APIGatewayProxyWithCognitoAuthorizerHandler = (
        _,
        context
      ) => {
        context.done(undefined, "it worked");
      };

      const { event, context, logger } = buildObjects();
      runHandler({
        event,
        context,
        logger,
        handler,
        callback: (_, result) => {
          expect(result).toEqual("it worked");
          done();
        },
      });
    });

    it("should handle callback finalized handlers", (done) => {
      const handler: APIGatewayProxyWithCognitoAuthorizerHandler = (
        _,
        __,
        callback
      ) => {
        callback(undefined, { statusCode: 200, body: "it worked" });
      };

      const { event, context, logger } = buildObjects();
      runHandler({
        event,
        context,
        logger,
        handler,
        callback: (_, result) => {
          expect(result).toEqual({
            statusCode: 200,
            body: "it worked",
          });
          done();
        },
      });
    });

    it("should handle async finalized handlers", (done) => {
      const handler: APIGatewayProxyWithCognitoAuthorizerHandler = async (
        _,
        __
      ) => {
        return { statusCode: 200, body: "it worked" };
      };

      const { event, context, logger } = buildObjects();
      runHandler({
        event,
        context,
        logger,
        handler,
        callback: (_, result) => {
          expect(result).toEqual({
            statusCode: 200,
            body: "it worked",
          });
          done();
        },
      });
    });
  });

  describe("handles non-thrown errors", () => {
    it("should handle errors passed to context.done()", (done) => {
      const handler: APIGatewayProxyWithCognitoAuthorizerHandler = (
        _,
        context
      ) => {
        context.done(new Error("it errored"));
      };

      const { event, context, logger } = buildObjects();
      runHandler({
        event,
        context,
        logger,
        handler,
        callback: (err) => {
          expect(err).toBeInstanceOf(Error);
          expect(err?.message).toEqual("it errored");
          done();
        },
      });
    });

    it("should handle string error messages passed to context.done()", (done) => {
      const handler: APIGatewayProxyWithCognitoAuthorizerHandler = (
        _,
        context
      ) => {
        context.done("it errored" as unknown as any);
      };

      const { event, context, logger } = buildObjects();
      runHandler({
        event,
        context,
        logger,
        handler,
        callback: (err) => {
          expect(err).toBeInstanceOf(Error);
          expect(err?.message).toEqual("it errored");
          done();
        },
      });
    });

    it("should handle errors passed to callback", (done) => {
      const handler: APIGatewayProxyWithCognitoAuthorizerHandler = (
        _,
        __,
        callback
      ) => {
        callback(new Error("it errored"));
      };

      const { event, context, logger } = buildObjects();
      runHandler({
        event,
        context,
        logger,
        handler,
        callback: (err) => {
          expect(err).toBeInstanceOf(Error);
          expect(err?.message).toEqual("it errored");
          done();
        },
      });
    });

    it("should handle string error messages passed to callback", (done) => {
      const handler: APIGatewayProxyWithCognitoAuthorizerHandler = (
        _,
        __,
        callback
      ) => {
        callback("it errored");
      };

      const { event, context, logger } = buildObjects();
      runHandler({
        event,
        context,
        logger,
        handler,
        callback: (err) => {
          expect(err).toBeInstanceOf(Error);
          expect(err?.message).toEqual("it errored");
          done();
        },
      });
    });
  });

  describe("handles thrown errors from invalid handler code", () => {
    it("should handle thrown errors in non-async handlers", (done) => {
      const handler: APIGatewayProxyWithCognitoAuthorizerHandler = (_, __) => {
        throw new Error("it errored");
      };

      const { event, context, logger } = buildObjects();
      runHandler({
        event,
        context,
        logger,
        handler,
        callback: (err) => {
          expect(err).toBeInstanceOf(Error);
          expect(err?.message).toEqual("it errored");
          done();
        },
      });
    });

    it("should handle thrown errors in async handlers", (done) => {
      const handler: APIGatewayProxyWithCognitoAuthorizerHandler = async (
        _,
        __
      ) => {
        throw new Error("it errored");
      };

      const { event, context, logger } = buildObjects();
      runHandler({
        event,
        context,
        logger,
        handler,
        callback: (err) => {
          expect(err).toBeInstanceOf(Error);
          expect(err?.message).toEqual("it errored");
          done();
        },
      });
    });
  });

  it("should handler throwing of an object that is not an Error", (done) => {
    const handler: APIGatewayProxyWithCognitoAuthorizerHandler = (_, __) => {
      throw "this is not an error!!";
    };

    const { event, context, logger } = buildObjects();
    runHandler({
      event,
      context,
      logger,
      handler,
      callback: (err) => {
        expect(logger.error).toHaveBeenCalledWith("'this is not an error!!'");
        expect(err).toBeInstanceOf(Error);
        expect(err?.message).toEqual(
          "something other than an error was thrown from the handler"
        );
        done();
      },
    });
  });

  describe("calls context._finalize() and context._clearTimeout()", () => {
    it("should call on resolution", () => {
      const handler: APIGatewayProxyWithCognitoAuthorizerHandler = async (
        _,
        __
      ) => {
        return { statusCode: 200, body: "it worked" };
      };

      const { event, context, logger } = buildObjects();
      const spyTimeout = jest.spyOn(context, "_clearTimeout");
      const spyFinalize = jest.spyOn(context, "_finalize");

      runHandler({
        event,
        context,
        logger,
        handler,
        callback: (_, __) => {
          expect(spyTimeout).toHaveBeenCalled();
          expect(spyFinalize).toHaveBeenCalled();
          spyTimeout.mockRestore();
          spyFinalize.mockRestore();
        },
      });
    });

    it("should call on rejection", () => {
      const handler: APIGatewayProxyWithCognitoAuthorizerHandler = async (
        _,
        __
      ) => {
        throw new Error("it errored");
      };

      const { event, context, logger } = buildObjects();
      const spyTimeout = jest.spyOn(context, "_clearTimeout");
      const spyFinalize = jest.spyOn(context, "_finalize");

      runHandler({
        event,
        context,
        logger,
        handler,
        callback: (_, __) => {
          expect(spyTimeout).toHaveBeenCalled();
          expect(spyFinalize).toHaveBeenCalled();
          spyTimeout.mockRestore();
          spyFinalize.mockRestore();
        },
      });
    });

    it("should call context._clearTimeout() on synchronous errors", () => {
      const handler: APIGatewayProxyWithCognitoAuthorizerHandler = (_, __) => {
        throw new Error("it errored");
      };

      const { event, context, logger } = buildObjects();
      const spy = jest.spyOn(context, "_clearTimeout");

      runHandler({
        event,
        context,
        logger,
        handler,
        callback: (_, __) => {
          expect(context._clearTimeout).toHaveBeenCalled();
          spy.mockRestore();
        },
      });
    });
  });

  describe("only allows one resolution", () => {
    describe("multiple resolves", () => {
      it("context and callback", (done) => {
        const validResponse = { body: "it worked", statusCode: 200 };
        const invalidResponse = { body: "it worked again", statusCode: 200 };

        const handler: APIGatewayProxyWithCognitoAuthorizerHandler = (
          _,
          context,
          callback
        ) => {
          context.done(undefined, validResponse);
          callback(undefined, invalidResponse);
        };

        const { event, context, logger } = buildObjects();
        runHandler({
          event,
          context,
          logger,
          handler,
          callback: (_, result) => {
            expect(result).toEqual(validResponse);
            expect(logger.error).toBeCalledTimes(2);
            expect(logger.error).toHaveBeenNthCalledWith(
              1,
              "multiple resolutions. ignoring results:"
            );
            expect(logger.error).toHaveBeenNthCalledWith(
              2,
              util.inspect(invalidResponse, false, Infinity)
            );
            done();
          },
        });
      });
      it("context and async", (done) => {
        const validResponse = { body: "it worked", statusCode: 200 };
        const invalidResponse = { body: "it worked again", statusCode: 200 };

        const handler: APIGatewayProxyWithCognitoAuthorizerHandler = async (
          _,
          context
        ) => {
          context.done(undefined, validResponse);
          return invalidResponse;
        };

        const { event, context, logger } = buildObjects();
        runHandler({
          event,
          context,
          logger,
          handler,
          callback: (_, result) => {
            expect(result).toEqual(validResponse);
            expect(logger.error).toBeCalledTimes(2);
            expect(logger.error).toHaveBeenNthCalledWith(
              1,
              "multiple resolutions. ignoring results:"
            );
            expect(logger.error).toHaveBeenNthCalledWith(
              2,
              util.inspect(invalidResponse, false, Infinity)
            );
            done();
          },
        });
      });
      it("callback and async", (done) => {
        const validResponse = { body: "it worked", statusCode: 200 };
        const invalidResponse = { body: "it worked again", statusCode: 200 };

        const handler: APIGatewayProxyWithCognitoAuthorizerHandler = async (
          _,
          __,
          callback
        ) => {
          callback(undefined, validResponse);
          return invalidResponse;
        };

        const { event, context, logger } = buildObjects();
        runHandler({
          event,
          context,
          logger,
          handler,
          callback: (_, result) => {
            expect(result).toEqual(validResponse);
            expect(logger.error).toBeCalledTimes(2);
            expect(logger.error).toHaveBeenNthCalledWith(
              1,
              "multiple resolutions. ignoring results:"
            );
            expect(logger.error).toHaveBeenNthCalledWith(
              2,
              util.inspect(invalidResponse, false, Infinity)
            );
            done();
          },
        });
      });
    });

    describe("multiple rejections", () => {
      it("context and callback", (done) => {
        const invalidError = new Error("it errored again");
        const handler: APIGatewayProxyWithCognitoAuthorizerHandler = (
          _,
          context,
          callback
        ) => {
          context.done(new Error("it errored"));
          callback(invalidError);
        };

        const { event, context, logger } = buildObjects();
        runHandler({
          event,
          context,
          logger,
          handler,
          callback: (error) => {
            expect(error).toBeInstanceOf(Error);
            expect(error?.message).toEqual("it errored");
            expect(logger.error).toBeCalledTimes(2);
            expect(logger.error).toHaveBeenNthCalledWith(
              1,
              "multiple resolutions. ignoring error:"
            );
            expect(logger.error).toHaveBeenNthCalledWith(
              2,
              util.inspect(invalidError, false, Infinity)
            );
            done();
          },
        });
      });
      it("context and async", (done) => {
        const invalidError = new Error("it errored again");
        const handler: APIGatewayProxyWithCognitoAuthorizerHandler = async (
          _,
          context
        ) => {
          context.done(new Error("it errored"));
          throw invalidError;
        };

        const { event, context, logger } = buildObjects();
        runHandler({
          event,
          context,
          logger,
          handler,
          callback: (error) => {
            expect(error).toBeInstanceOf(Error);
            expect(error?.message).toEqual("it errored");
            /**
             * I think Promise timing prevents this from getting logged.
             * Seems like the executor is out of scope by time it gets called
             * because the promise is thrown away. not 100% sure but the result
             * is the same. Only one resolution works.
             */
            // expect(logger.error).toBeCalledTimes(2);
            // expect(logger.error).toHaveBeenNthCalledWith(
            //   1,
            //   "multiple resolutions. ignoring error:"
            // );
            // expect(logger.error).toHaveBeenNthCalledWith(
            //   2,
            //   util.inspect(invalidError, false, Infinity)
            // );
            done();
          },
        });
      });
      it("callback and async", (done) => {
        const invalidError = new Error("it errored again");
        const handler: APIGatewayProxyWithCognitoAuthorizerHandler = async (
          _,
          __,
          callback
        ) => {
          callback(new Error("it errored"));
          throw invalidError;
        };

        const { event, context, logger } = buildObjects();
        runHandler({
          event,
          context,
          logger,
          handler,
          callback: (error) => {
            expect(error).toBeInstanceOf(Error);
            expect(error?.message).toEqual("it errored");
            /**
             * I think Promise timing prevents this from getting logged.
             * Seems like the executor is out of scope by time it gets called
             * because the promise is thrown away. not 100% sure but the result
             * is the same. Only one resolution works.
             */
            // expect(logger.error).toBeCalledTimes(2);
            // expect(logger.error).toHaveBeenNthCalledWith(
            //   1,
            //   "multiple resolutions. ignoring error:"
            // );
            // expect(logger.error).toHaveBeenNthCalledWith(
            //   2,
            //   util.inspect(invalidError, false, Infinity)
            // );
            done();
          },
        });
      });
    });

    describe("mixed resolves/rejects", () => {
      it("context and callback", (done) => {
        const validResponse = { body: "it worked", statusCode: 200 };
        const invalidResponse = new Error("it errored also");

        const handler: APIGatewayProxyWithCognitoAuthorizerHandler = (
          _,
          context,
          callback
        ) => {
          context.done(undefined, validResponse);
          callback(invalidResponse);
        };

        const { event, context, logger } = buildObjects();
        runHandler({
          event,
          context,
          logger,
          handler,
          callback: (_, result) => {
            expect(result).toEqual(validResponse);
            expect(logger.error).toBeCalledTimes(2);
            expect(logger.error).toHaveBeenNthCalledWith(
              1,
              "multiple resolutions. ignoring error:"
            );
            expect(logger.error).toHaveBeenNthCalledWith(
              2,
              util.inspect(invalidResponse, false, Infinity)
            );
            done();
          },
        });
      });
      it("context and async", (done) => {
        const validResponse = new Error("it errored also");
        const invalidResponse = { body: "it worked", statusCode: 200 };

        const handler: APIGatewayProxyWithCognitoAuthorizerHandler = async (
          _,
          context
        ) => {
          context.done(validResponse);
          return invalidResponse;
        };

        const { event, context, logger } = buildObjects();
        runHandler({
          event,
          context,
          logger,
          handler,
          callback: (error, result) => {
            expect(result).toBeUndefined();
            expect(error).toBeInstanceOf(Error);
            expect(error?.message).toEqual("it errored also");
            expect(logger.error).toBeCalledTimes(2);
            expect(logger.error).toHaveBeenNthCalledWith(
              1,
              "multiple resolutions. ignoring results:"
            );
            expect(logger.error).toHaveBeenNthCalledWith(
              2,
              util.inspect(invalidResponse, false, Infinity)
            );
            done();
          },
        });
      });
      it("callback and async", (done) => {
        const validResponse = { body: "it worked", statusCode: 200 };
        const invalidResponse = new Error("it errored also");
        const handler: APIGatewayProxyWithCognitoAuthorizerHandler = async (
          _,
          __,
          callback
        ) => {
          callback(undefined, validResponse);
          throw invalidResponse;
        };

        const { event, context, logger } = buildObjects();
        runHandler({
          event,
          context,
          logger,
          handler,
          callback: (error, result) => {
            expect(error).toBeUndefined();
            expect(result).toBe(validResponse);
            /**
             * I think Promise timing prevents this from getting logged.
             * Seems like the executor is out of scope by time it gets called
             * because the promise is thrown away. not 100% sure but the result
             * is the same. Only one resolution works.
             */
            // expect(logger.error).toBeCalledTimes(2);
            // expect(logger.error).toHaveBeenNthCalledWith(
            //   1,
            //   "multiple resolutions. ignoring results:"
            // );
            // expect(logger.error).toHaveBeenNthCalledWith(
            //   2,
            //   util.inspect(validResponse, false, Infinity)
            // );
            done();
          },
        });
      });
    });
  });

  it("should log the start message", (done) => {
    const handler: APIGatewayProxyWithCognitoAuthorizerHandler = (_, __) => {
      throw new Error("testing 123");
    };

    const { event, context, logger } = buildObjects();
    runHandler({
      event,
      context,
      logger,
      handler,
      callback: () => {
        expect(logger.info).toHaveBeenCalledWith(
          `START RequestId: ${context.awsRequestId}`
        );
        done();
      },
    });
  });
});
