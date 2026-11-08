import { defineRpcContract } from "@get-bb/plugin-sdk";
import { z } from "zod";

export const ICONS_TAG = "icons";

/** bb accepts icon registrations only for ids of letters, digits, `-` and `_`. */
export const PROVIDER_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;
export const providerIdSchema = z.string().regex(PROVIDER_ID_PATTERN, "недопустимый id провайдера");
export const colorSchema = z.string().regex(/^#[0-9a-fA-F]{6}$/, "цвет должен быть в виде #rrggbb");
const idSchema = z.string().min(1).max(128);
const nameSchema = z.string().trim().min(1, "имя не может быть пустым").max(80, "имя длиннее 80 символов");

export const tintSchema = z.object({ light: colorSchema.optional(), dark: colorSchema.optional() });
export const sourceSchema = z.union([
  z.object({ set: idSchema, icon: idSchema }),
  z.object({ builtin: z.string().min(1).max(64) }),
]);
export const assignmentSchema = z.object({ source: sourceSchema, tint: tintSchema.optional() });

export type Tint = z.infer<typeof tintSchema>;
export type IconSource = z.infer<typeof sourceSchema>;
export type Assignment = z.infer<typeof assignmentSchema>;

/** Key of a set icon in `IconsState.icons`. */
export function iconRef(setId: string, iconId: string): string {
  return `${setId}/${iconId}`;
}

/** True when `source` is an icon of the set, or that one icon when `iconId` is given. */
export function pointsAt(source: IconSource, setId: string, iconId?: string): boolean {
  return "set" in source && source.set === setId && (iconId === undefined || source.icon === iconId);
}

export const setSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  iconCount: z.number(),
  bytes: z.number(),
});
export type SetSummary = z.infer<typeof setSummarySchema>;

/** Trees are `unknown` on the wire; the client re-validates them. */
const iconTreeSchema = z.object({ name: z.string(), tree: z.unknown() });

export const stateSchema = z.object({
  /** Keyed by provider id. */
  assignments: z.record(z.string(), assignmentSchema),
  sets: z.array(setSummarySchema),
  /** Trees of assigned set icons only, keyed `<setId>/<iconId>`. */
  icons: z.record(z.string(), iconTreeSchema),
  totalBytes: z.number(),
});
export type IconsState = z.infer<typeof stateSchema>;

export const setIconSchema = z.object({ id: z.string(), name: z.string(), bytes: z.number(), tree: z.unknown() });
export type SetIcon = z.infer<typeof setIconSchema>;

const affectedSchema = z.object({ affected: z.array(z.string()) });

export const uploadResultSchema = z.object({
  accepted: z.array(z.object({ fileName: z.string(), iconId: z.string(), name: z.string() })),
  rejected: z.array(z.object({ fileName: z.string(), reason: z.string() })),
});
export type UploadResult = z.infer<typeof uploadResultSchema>;

export const iconsContract = defineRpcContract({
  state: {
    input: z.null(),
    output: stateSchema,
    tags: () => [ICONS_TAG],
  },
  setIcons: {
    input: z.object({ setId: idSchema }),
    output: z.object({ id: z.string(), name: z.string(), icons: z.array(setIconSchema) }),
    tags: () => [ICONS_TAG],
  },
  assign: {
    input: z.object({ providerId: providerIdSchema, source: sourceSchema, tint: tintSchema.optional() }),
    output: z.object({ providerId: z.string() }),
  },
  clear: {
    input: z.object({ providerId: providerIdSchema }),
    output: z.object({ cleared: z.boolean() }),
  },
  createSet: {
    input: z.object({ name: nameSchema }),
    output: z.object({ setId: z.string() }),
  },
  renameSet: {
    input: z.object({ setId: idSchema, name: nameSchema }),
    output: z.object({ setId: z.string() }),
  },
  uploadIcons: {
    input: z.object({
      setId: idSchema,
      files: z.array(z.object({ fileName: z.string().min(1).max(255), text: z.string() })).min(1).max(200),
    }),
    output: uploadResultSchema,
  },
  renameIcon: {
    input: z.object({ setId: idSchema, iconId: idSchema, name: nameSchema }),
    output: z.object({ iconId: z.string() }),
  },
  deleteIcon: {
    input: z.object({ setId: idSchema, iconId: idSchema }),
    output: affectedSchema,
  },
  deleteSet: {
    input: z.object({ setId: idSchema }),
    output: affectedSchema,
  },
});
export type IconsContract = typeof iconsContract;
