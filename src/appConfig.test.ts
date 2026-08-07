import type { ConfigContext } from 'expo/config';

import appConfig from '../app.config';

describe('Expo orientation configuration', () => {
  it('supports both portrait and landscape reading', () => {
    const config = appConfig({ config: {} } as ConfigContext);

    expect(config.orientation).toBe('default');
  });
});
