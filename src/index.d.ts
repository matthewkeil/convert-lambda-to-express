import { HandlerConfig } from './devServer';

declare global {
  // eslint-disable-next-line no-var
  var CLTE_HANDLER_DEFINITIONS: undefined | HandlerConfig[];
}
