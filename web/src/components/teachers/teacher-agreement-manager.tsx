"use client";

import { useState } from "react";
import {
  TeacherAgreementRecord,
  TeacherAgreementSignForm,
} from "@/components/teachers/teacher-agreement-record";
import type { OnboardingState } from "@/components/teachers/teacher-onboarding";

export function TeacherAgreementManager({
  initial,
}: {
  initial: OnboardingState;
}) {
  const [state, setState] = useState(initial);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  return (
    <div className="grid gap-6">
      {state.agreement ? (
        <TeacherAgreementRecord record={state.agreement} />
      ) : null}
      {state.agreements
        ?.filter((item) => item.id !== state.agreement?.id)
        .map((record) => (
          <TeacherAgreementRecord key={record.id} record={record} />
        ))}
      {state.canSignAgreement ? (
        <TeacherAgreementSignForm<OnboardingState>
          title={state.agreementTitle ?? "Teacher agreement"}
          version={state.agreementVersion}
          clauses={[...state.agreementClauses]}
          defaultName={state.displayName}
          onSigned={(next) => {
            setState(next);
            setMessage("Agreement signed and stored.");
            setError("");
          }}
        />
      ) : null}
      {error ? (
        <p className="rounded-2xl bg-rose px-4 py-3 text-sm font-semibold text-brand">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-2xl bg-mint px-4 py-3 text-sm font-semibold text-brand">
          {message}
        </p>
      ) : null}
    </div>
  );
}
