import { Context } from './Context';
import { TimeoutError } from './utils';

describe('Context', () => {
  it('should create a proper arn', () => {
    const arn = Context.createInvokeFunctionArn('us-east-1', '123456789012', 'my-function');
    expect(arn).toEqual('arn:aws:lambda:us-east-1:123456789012:function:my-function');
  });

  it('should create a proper awsRequestId', () => {
    const awsRequestId = Context.getAwsRequestId();
    const REQUEST_ID_REGEX = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;
    expect(awsRequestId).toMatch(REQUEST_ID_REGEX);
  });

  it('should timeout properly', async () => {
    expect.assertions(3);
    try {
      await new Promise((_, reject) => {
        const context = new Context({
          startTime: Date.now(),
          timeoutInSeconds: 1
        });
        context._reject = reject;
      });
    } catch (err) {
      expect(err).toBeInstanceOf(TimeoutError);
      expect((err as Error).name).toEqual('TimeoutError');
      expect((err as Error).message).toEqual('Task timed out after 1 second(s)');
    }
  });

  it('should getRemainingTimeInMillis', done => {
    expect.assertions(2);

    const context = new Context({
      startTime: Date.now(),
      timeoutInSeconds: 1
    });

    setTimeout(() => {
      expect(context.getRemainingTimeInMillis()).toBeLessThanOrEqual(500);
    }, 500);

    expect(context.getRemainingTimeInMillis()).toBeLessThanOrEqual(1000);

    new Promise((_, reject) => {
      context._reject = reject;
    }).catch(() => done());
  });
});
