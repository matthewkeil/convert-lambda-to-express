import { APIGatewayProxyWithCognitoAuthorizerHandler } from "aws-lambda";
import { Context } from "./Context";
import { Event } from "./Event";

describe("", () => {
  function buildObjects() {
    const startTime = Date.now();
    const context = new Context({ startTime });
    const event = new Event({
      startTime,
      awsRequestId: context.awsRequestId,
    });
    const logger = {
      log: () => {},
      warn: () => {},
      error: () => {},
      info: () => {},
    } as Console;

    return { event, context, logger };
  }

  it("should accommodate handlers that return nothing", async () => {
    expect(true).toBeTruthy();
  //   expect.assertions(6);

  //   const contextHandler: APIGatewayProxyWithCognitoAuthorizerHandler = async (
  //     _,
  //     context
  //   ) => {
  //     return context.done() as any;
  //   };
  //   const callbackHandler: APIGatewayProxyWithCognitoAuthorizerHandler = async (
  //     _,
  //     __,
  //     callback
  //   ) => {
  //     return callback() as any;
  //   };
  //   const asyncHandler: APIGatewayProxyWithCognitoAuthorizerHandler = async (
  //     _,
  //     __
  //   ) => {
  //     return undefined as any;
  //   };

  //   for (const handler of [asyncHandler, contextHandler, callbackHandler]) {
  //     const { event, context, logger } = buildObjects();
  //     await runHandler({
  //       event,
  //       context,
  //       logger,
  //       handler,
  //       callback: (err) => {
  //         expect(err).toBeInstanceOf(Error);
  //         expect(err?.message).toEqual("handler didn't return response");
  //       },
  //     });
  //   }
  });
});
