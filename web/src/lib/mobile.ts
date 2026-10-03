export const IOS_BUNDLE_ID = "uk.co.alharamainschools.app";
export const ANDROID_PACKAGE = "uk.co.alharamainschools.app";

export const MOBILE_PLATFORMS = ["ios", "android", "web"] as const;

export type MobilePlatform = (typeof MOBILE_PLATFORMS)[number];
