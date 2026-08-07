import { PLAYER_PRESENTATION_OPTIONS } from './playerPresentation';

describe('player presentation', () => {
  it('uses a dismissible modal instead of extending beneath the full-screen top region', () => {
    expect(PLAYER_PRESENTATION_OPTIONS).toMatchObject({
      presentation: 'modal',
      gestureEnabled: true,
    });
  });
});
