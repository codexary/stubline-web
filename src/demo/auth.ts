import type { AuthProvider } from '../auth';

export class DemoAuthProvider implements AuthProvider {
  async begin(): Promise<string> {
    return 'demo-buyer-token';
  }

  async complete() {
    return null;
  }
}
