import { HandlerConfig } from './devServer';

declare global {
  var CLTE_HANDLER_DEFINITIONS: undefined | HandlerConfig[];
}
