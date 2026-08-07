import { dismissPlayer } from './dismissPlayer';

describe('dismissPlayer', () => {
  it('dismisses a presented player modal before trying stack back', () => {
    const router = {
      canDismiss: jest.fn(() => true),
      dismiss: jest.fn(),
      canGoBack: jest.fn(() => true),
      back: jest.fn(),
      replace: jest.fn(),
    };
    dismissPlayer(router);
    expect(router.dismiss).toHaveBeenCalledTimes(1);
    expect(router.back).not.toHaveBeenCalled();
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('uses stack back when the route is not presented modally', () => {
    const router = {
      canDismiss: jest.fn(() => false),
      dismiss: jest.fn(),
      canGoBack: jest.fn(() => true),
      back: jest.fn(),
      replace: jest.fn(),
    };
    dismissPlayer(router);
    expect(router.back).toHaveBeenCalledTimes(1);
    expect(router.replace).not.toHaveBeenCalled();
  });

  it('returns to Quran when there is no navigation history', () => {
    const router = {
      canDismiss: jest.fn(() => false),
      dismiss: jest.fn(),
      canGoBack: jest.fn(() => false),
      back: jest.fn(),
      replace: jest.fn(),
    };
    dismissPlayer(router);
    expect(router.replace).toHaveBeenCalledWith('/(tabs)/quran');
  });
});
