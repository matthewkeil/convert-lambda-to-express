import { resolve } from 'path';
import {
  convertToExpressPath,
  getHandler,
  watchCodePath,
  watchPaths,
  overwrittenKeys,
  loadEnvironment
} from './devServer';

describe('devServer', () => {
  describe('watchCodePath', () => {
    beforeEach(() => {
      watchPaths.length = 0;
    });
    afterEach(() => {
      watchPaths.length = 0;
    });
    it('should watch multiple paths', () => {
      const path1 = resolve(__dirname, '..', 'test');
      const path2 = resolve(__dirname, '..', 'src');
      expect(watchPaths.length).toBe(0);
      watchCodePath(path1);
      expect(watchPaths.length).toBe(1);
      expect(watchPaths[0]).toBe(path1);
      watchCodePath(path2);
      expect(watchPaths.length).toBe(2);
      expect(watchPaths[0]).toBe(path1);
      expect(watchPaths[1]).toBe(path2);
    });

    it('should only watch shorter part of nested paths', () => {
      const shorterPath = resolve(__dirname, '..', 'test');
      const longerPath = resolve(shorterPath, 'longer', 'path');
      const longestPath = resolve(shorterPath, 'longer', 'nested', 'path');

      expect(watchPaths.length).toBe(0);

      watchCodePath(shorterPath);
      expect(watchPaths.length).toBe(1);
      expect(watchPaths[0]).toBe(shorterPath);

      watchCodePath(longerPath);
      expect(watchPaths.length).toBe(1);
      expect(watchPaths[0]).toBe(shorterPath);

      watchCodePath(longestPath);
      expect(watchPaths.length).toBe(1);
      expect(watchPaths[0]).toBe(shorterPath);

      watchPaths.length = 0;
      expect(watchPaths.length).toBe(0);

      watchCodePath(longestPath);
      expect(watchPaths.length).toBe(1);
      expect(watchPaths[0]).toBe(longestPath);

      watchCodePath(longerPath);
      expect(watchPaths.length).toBe(2);
      expect(watchPaths[0]).toBe(longestPath);
      expect(watchPaths[1]).toBe(longerPath);

      watchCodePath(shorterPath);
      expect(watchPaths.length).toBe(1);
      expect(watchPaths[0]).toBe(shorterPath);
    });
  });

  describe('loadEnvironment', () => {
    beforeEach(() => {
      overwrittenKeys.length = 0;
    });
    afterEach(() => {
      overwrittenKeys.length = 0;
    });
    const environment1 = {
      TEST_VAR: 'environment1-var1',
      TEST_VAR2: 'environment1-var2'
    };
    const environment2 = {
      TEST_VAR: 'environment2-var1',
      TEST_VAR3: 'environment2-var3'
    };
    it('should load environment variables', () => {
      delete process.env.TEST_VAR;
      delete process.env.TEST_VAR2;
      delete process.env.TEST_VAR3;
      loadEnvironment({ environment: environment1 });
      expect(process.env.TEST_VAR).toEqual(environment1.TEST_VAR);
      expect(process.env.TEST_VAR2).toEqual(environment1.TEST_VAR2);
      expect(process.env.TEST_VAR3).toBeUndefined();
    });
    it('should track overwritten variables', () => {
      delete process.env.TEST_VAR;
      delete process.env.TEST_VAR2;
      delete process.env.TEST_VAR3;

      expect(overwrittenKeys.length).toEqual(0);
      loadEnvironment({ environment: environment1 });
      loadEnvironment({ environment: environment2 });

      expect(overwrittenKeys.length).toEqual(1);
      expect(overwrittenKeys[0]).toEqual('TEST_VAR');

      expect(process.env.TEST_VAR).toEqual(environment2.TEST_VAR);
      expect(process.env.TEST_VAR2).toEqual(environment1.TEST_VAR2);
      expect(process.env.TEST_VAR3).toEqual(environment2.TEST_VAR3);
    });
    it('should log env/key pairs in verbose mode', () => {
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      const spy = jest.spyOn(console, 'log').mockImplementation(() => {});

      delete process.env.TEST_VAR;
      delete process.env.TEST_VAR2;
      delete process.env.TEST_VAR3;
      loadEnvironment({ environment: environment1, verbose: true });
      expect(spy).toHaveBeenNthCalledWith(1, 'loading env: key TEST_VAR with value environment1-var1');
      expect(spy).toHaveBeenNthCalledWith(2, 'loading env: key TEST_VAR2 with value environment1-var2');

      spy.mockClear();
    });
  });

  describe('getHandler', () => {
    const handler = 'test/testHandler.handler';
    const codeDirectory = resolve(__dirname, '..');
    watchPaths.length = 0;
    expect(watchPaths.length).toBe(0);

    const { exportName, filePath, handlerFunction } = getHandler({
      handler,
      codeDirectory
    });

    expect(watchPaths.length).toBe(1);
    expect(exportName).toEqual('handler');
    expect(filePath).toEqual(resolve(codeDirectory, 'test', 'testHandler.ts'));
    expect(typeof handlerFunction).toEqual('function');
    expect(handlerFunction.length).toEqual(2);
  });

  describe('convertToExpressPath', () => {
    const resourcePath = '/test/{param1}/segment/{param2}';
    const expectedPath = '/test/:param1/segment/:param2';
    expect(convertToExpressPath(resourcePath)).toEqual(expectedPath);
  });
});
