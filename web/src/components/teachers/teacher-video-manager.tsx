"use client";

import { useState } from "react";
import { IntroVideoForm } from "@/components/teachers/intro-video-form";
import type { OnboardingState } from "@/components/teachers/teacher-onboarding";

export function TeacherVideoManager({ initial }: { initial: OnboardingState }) {
  const [state, setState] = useState(initial);

  return (
    <IntroVideoForm<OnboardingState>
      video={state.video}
      canEdit={state.canEditVideo}
      onSaved={setState}
    />
  );
}
