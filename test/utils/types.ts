import { Signers } from '../../types';

declare module 'mocha' {
  export interface Context {
    signers: Signers;
  }
}
