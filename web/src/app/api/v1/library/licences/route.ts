import { apiRoute } from "@/server/api/handler";
import {
  assignLicenceSeat,
  attachLicenceMaterial,
  createLicencePool,
  detachLicenceMaterial,
  listLibraryLicenceDesk,
  revokeLicenceSeat,
  updateLicencePool,
} from "@/server/lms/licences";
import { libraryLicenceActionSchema } from "@/server/lms/schemas";

export const runtime = "nodejs";

export const GET = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
  },
  async ({ actor }) => listLibraryLicenceDesk(actor!),
);

export const POST = apiRoute(
  {
    auth: "session",
    rateLimit: "sensitive",
    input: libraryLicenceActionSchema,
  },
  async ({ actor, input, ip }) => {
    if (input.action === "create_pool") {
      return createLicencePool(actor!, input, ip);
    }
    if (input.action === "update_pool") {
      return updateLicencePool(actor!, input, ip);
    }
    if (input.action === "attach_material") {
      return attachLicenceMaterial(actor!, input, ip);
    }
    if (input.action === "detach_material") {
      return detachLicenceMaterial(actor!, input, ip);
    }
    if (input.action === "assign_seat") {
      return assignLicenceSeat(actor!, input, ip);
    }
    return revokeLicenceSeat(actor!, input, ip);
  },
);
