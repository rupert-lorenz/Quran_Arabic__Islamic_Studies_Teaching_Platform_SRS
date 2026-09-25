"use client";

import { useState } from "react";
import { StaffPricingControls, type StaffRatesWorkspaceData } from "@/components/staff/staff-pricing-controls";
import { StaffRatePolicy } from "@/components/staff/staff-rate-policy";

export function StaffRatesClient({
  initial,
  canEdit,
}: {
  initial: StaffRatesWorkspaceData;
  canEdit: boolean;
}) {
  const [data, setData] = useState(initial);

  return (
    <div>
      <StaffRatePolicy
        initial={data}
        canEdit={canEdit}
        onUpdated={(next) => setData(next as StaffRatesWorkspaceData)}
      />
      <StaffPricingControls data={data} canEdit={canEdit} onUpdated={setData} />
    </div>
  );
}
