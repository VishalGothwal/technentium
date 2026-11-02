"use server";
import { updateTag } from "next/cache";
import { runAction } from "@/server/actions";
import { FEATURES_TAG } from "@/server/features";
import { clearTestOtps, updateFeatures } from "@/server/modules/settings/features.service";

/** Switch changes re-render cached pages (sign-in methods, section notices, banners) straight away. */
export const updateFeaturesAction = async (changes: Record<string, unknown>) =>
  runAction(async (a) => {
    await updateFeatures(a, changes);
    updateTag(FEATURES_TAG);
  });

export const clearTestOtpsAction = async () => runAction((a) => clearTestOtps(a));
