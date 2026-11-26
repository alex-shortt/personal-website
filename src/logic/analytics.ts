import posthog from "posthog-js";

let initialized = false;

export function initializeAnalytics() {
  if (initialized) return posthog;
  initialized = true;
  posthog.init("phc_P5H8es69BaGFLoTwhgtGhixyXn5m4KFJiIYw4BZB33v", {
    api_host: "https://app.posthog.com",
  });
  return posthog;
}
