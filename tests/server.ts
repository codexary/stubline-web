import { setupServer } from 'msw/node';
import { handlers } from '../src/demo/handlers';

export const server = setupServer(...handlers);
