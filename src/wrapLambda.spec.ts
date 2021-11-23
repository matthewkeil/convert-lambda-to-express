import { resolve } from 'path';
import { getCredentials } from './wrapLambda';

const testCredentialsFile = resolve(__dirname, '..', 'test', 'credentials');

describe('getCredentials', () => {
  it('should load default credentials from file', () => {
    const credentials = getCredentials(testCredentialsFile);
    expect(credentials?.accessKeyId).toEqual('ZYXWVUTSRQPONMLKJIHG');
    expect(credentials?.secretAccessKey).toEqual('foobarbaz1');
    expect(credentials?.sessionToken).toEqual('foobarbazfoobarbazfoobarbaz1');
  });

  it('should load profile credentials from file', () => {
    const credentials = getCredentials(testCredentialsFile, 'test');
    expect(credentials?.accessKeyId).toEqual('ABCDEFGHIJKLMNOPQRST');
    expect(credentials?.secretAccessKey).toEqual('foobarbaz2');
    expect(credentials?.sessionToken).toEqual('foobarbazfoobarbazfoobarbaz2');
  });

  it('should return undefined if incorrect profile used', () => {
    const credentials = getCredentials(testCredentialsFile, 'bad');
    expect(credentials).toBeUndefined();
  });

  it('should load credentials from the environment', () => {
    process.env.AWS_ACCESS_KEY_ID = 'foo';
    process.env.AWS_SECRET_ACCESS_KEY = 'bar';
    process.env.AWS_SESSION_TOKEN = 'baz';
    const credentials = getCredentials();
    expect(credentials?.accessKeyId).toEqual('foo');
    expect(credentials?.secretAccessKey).toEqual('bar');
    expect(credentials?.sessionToken).toEqual('baz');
  });

  it('should return undefined if no credentials', () => {
    process.env.AWS_ACCESS_KEY_ID = '';
    process.env.AWS_SECRET_ACCESS_KEY = '';
    process.env.AWS_SESSION_TOKEN = '';
    const credentials = getCredentials();
    expect(credentials).toBeUndefined();
  });
});
