import { apiRoute } from "@/server/api/handler";
import {
  registerMobileDevice,
  registerMobileDeviceSchema,
} from "@/server/mobile/devices";

export const runtime = "nodejs";

export const POST = apiRoute(
  {
    auth: "session",
    csrf: true,
    rateLimit: "sensitive",
    input: registerMobileDeviceSchema,
  },
  async ({ actor, input, ip }) => registerMobileDevice(actor!, input, ip),
);
