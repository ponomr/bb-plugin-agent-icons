import { definePluginApp } from "@get-bb/plugin-sdk/app";
import { createMark } from "./src/app/mark";
import { IconsOverlay } from "./src/app/overlay";
import { captureRegisteredIds } from "./src/app/registered-ids";
import { SettingsSection } from "./src/app/settings/settings-section";

export default definePluginApp((app) => {
  for (const providerId of captureRegisteredIds()) {
    app.slots.experimental_providerIcon({ providerKind: "agent", providerId, icon: createMark(providerId) });
  }
  app.slots.experimental_appOverlay({ id: "icons-state", component: IconsOverlay });
  app.slots.settingsSection({
    id: "icons",
    title: "Agent icons",
    description: "An icon and a colour for each provider. Assignments are shared by all devices.",
    component: SettingsSection,
  });
});
