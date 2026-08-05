type DismissibleRouter = {
  canDismiss: () => boolean;
  dismiss: () => void;
  canGoBack: () => boolean;
  back: () => void;
  replace: (href: '/(tabs)/listen') => void;
};

export function dismissPlayer(router: DismissibleRouter): void {
  if (router.canDismiss()) {
    router.dismiss();
    return;
  }
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace('/(tabs)/listen');
}
