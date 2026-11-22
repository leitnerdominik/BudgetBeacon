const NAVIGATION_KEY = "budgetbeacon.desktopNavigation";

export function readNavigationCollapsed(): boolean {
  try {
    return window.localStorage.getItem(NAVIGATION_KEY) === "collapsed";
  } catch {
    return false;
  }
}

export function saveNavigationCollapsed(collapsed: boolean): void {
  try {
    window.localStorage.setItem(NAVIGATION_KEY, collapsed ? "collapsed" : "expanded");
  } catch {
    // The current layout still works when browser storage is unavailable.
  }
}
