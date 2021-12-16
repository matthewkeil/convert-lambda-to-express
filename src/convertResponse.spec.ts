/* eslint-disable @typescript-eslint/no-explicit-any */
import { APIGatewayProxyResult } from 'aws-lambda';
import { coerceBody, convertResponseFactory, ConvertResponseOptions, setResponseHeaders } from './convertResponse';

class MockResponse {
  header = jest.fn();
  status = jest.fn(() => this);
  send = jest.fn();
  end = jest.fn();
  json = jest.fn();
}

describe('convertResponse()', () => {
  let res: MockResponse;
  let logger: Console;
  beforeEach(() => {
    res = new MockResponse();
    logger = {
      info: jest.fn(),
      error: jest.fn()
    } as any;
  });
  const defaultContentType = 'application/json';
  const options: ConvertResponseOptions = {
    defaultResponseHeaders: {
      'content-type': defaultContentType
    }
  };
  const defaultResponse: APIGatewayProxyResult = {
    statusCode: 200,
    body: '{"default":"body"}'
  };
  const responseContentType = 'application/xml';
  const responseWithContentType: APIGatewayProxyResult = {
    statusCode: 200,
    body: '',
    headers: {
      'content-type': responseContentType
    }
  };
  const multiValueResponseType = ['no-cache', 'no-store', 'must-revalidate'];
  const multiValueResponse: APIGatewayProxyResult = {
    statusCode: 200,
    body: '',
    headers: {
      'content-type': responseContentType
    },
    multiValueHeaders: {
      'cache-control': multiValueResponseType
    }
  };
  describe('setResponseHeaders', () => {
    it('should set default headers correctly', () => {
      setResponseHeaders({
        res: res as any,
        options,
        response: defaultResponse
      });
      expect(res.header).toHaveBeenCalledWith('content-type', defaultContentType);
    });
    it('should set response headers correctly', () => {
      setResponseHeaders({
        res: res as any,
        response: responseWithContentType
      });
      expect(res.header).toHaveBeenCalledWith('content-type', responseContentType);
    });
    it('should set response multi-value headers correctly', () => {
      setResponseHeaders({ res: res as any, response: multiValueResponse });
      expect(res.header).toHaveBeenNthCalledWith(1, 'content-type', responseContentType);
      expect(res.header).toHaveBeenNthCalledWith(2, 'cache-control', multiValueResponseType.join(', '));
    });
    it('should set default headers first and overwrite with specific headers', () => {
      setResponseHeaders({
        res: res as any,
        options,
        response: responseWithContentType
      });
      expect(res.header).toHaveBeenNthCalledWith(1, 'content-type', defaultContentType);
      expect(res.header).toHaveBeenNthCalledWith(2, 'content-type', responseContentType);
    });
  });

  describe('coerceBody', () => {
    it('should handle string', () => {
      expect(coerceBody('hello')).toEqual('hello');
    });
    it('should handle number', () => {
      expect(coerceBody(1234)).toEqual('1234');
    });
    it('should handle boolean', () => {
      expect(coerceBody(true)).toEqual('true');
    });
    it('should handle bigint', () => {
      const intString = '90071992547409911234';
      expect(coerceBody(BigInt(intString))).toEqual(intString);
    });
    it('should handle object', () => {
      expect(coerceBody({ some: 'object' })).toEqual('{"some":"object"}');
    });
    it('should handle array', () => {
      expect(coerceBody(['some', 'array'])).toEqual('["some","array"]');
    });
    it('should handle buffer', () => {
      expect(coerceBody(Buffer.from('hello'))).toEqual('hello');
    });
    it('should handle function', () => {
      const func = function (param: any) {
        return param;
      };
      expect(coerceBody(func)).toEqual(func.toString());
    });
    it('should handle null', () => {
      expect(coerceBody(null)).toEqual('');
    });
    it('should handle undefined', () => {
      expect(coerceBody(undefined)).toEqual('');
    });
    it('should handle odd objects', () => {
      const oddObject = function (param: any) {
        return param;
      };
      oddObject.toString = 0;
      try {
        // eslint-disable-next-line no-console
        console.log(`${oddObject}`);
      } catch (err: unknown) {
        const { message, name } = err as Error;
        // check that was a bad object
        expect(name).toEqual('TypeError');
        expect(message).toEqual('Cannot convert object to primitive value');
      }
      expect(coerceBody(oddObject)).toEqual('');
    });
  });

  describe('convertResponseFactory', () => {
    let convertResponse: (err?: Error, response?: APIGatewayProxyResult) => void;
    beforeEach(() => {
      convertResponse = convertResponseFactory({
        res: res as any,
        logger: logger as any,
        options
      });
    });

    it('should return a function', () => {
      expect(typeof convertResponse).toEqual('function');
      expect(convertResponse.length).toEqual(2);
    });

    it('should return a valid response', () => {
      convertResponse(undefined, defaultResponse);
      expect(res.header).toHaveBeenNthCalledWith(1, 'content-type', defaultContentType);
      expect(logger.info).toBeCalledTimes(2);
      expect(logger.info).toHaveBeenNthCalledWith(1, 'End - Result:');
      expect(logger.info).toHaveBeenNthCalledWith(2, defaultResponse.body);
      expect(res.send).toBeCalledTimes(1);
      expect(res.send).toHaveBeenCalledWith(defaultResponse.body);
      expect(res.status).toBeCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(defaultResponse.statusCode);
      expect(res.end).toBeCalledTimes(1);
      expect(res.end).toHaveBeenCalledWith();
    });

    it('should set a default statusCode', () => {
      convertResponse(undefined, {
        body: 'hello',
        statusCode: undefined
      } as any);
      expect(res.status).toBeCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should respond with passed errors', () => {
      const err = new Error('there was an error');
      convertResponse(err);
      const errResponse = {
        errorMessage: err.message,
        errorType: err.name,
        trace: err.stack?.split('\n')
      };
      expect(logger.error).toBeCalledTimes(2);
      expect(logger.error).toHaveBeenNthCalledWith(1, 'End - Error:');
      expect(logger.error).toHaveBeenNthCalledWith(2, errResponse);
      expect(res.status).toBeCalledTimes(1);
      expect(res.status).toHaveBeenCalledWith(500);
      expect(res.json).toBeCalledTimes(1);
      expect(res.json).toHaveBeenCalledWith(errResponse);
    });

    it('should respond with error if no response', () => {
      try {
        convertResponse();
      } catch (err) {
        expect(err).toBeInstanceOf(TypeError);
        expect((err as TypeError).message).toEqual('no response returned from handler');
      }
    });
  });
});
