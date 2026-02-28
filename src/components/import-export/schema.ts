import { z } from "zod";

const regionSchema = z.enum(["eun1", "euw1"]);

export const importSchema = z.object({
  version: z.literal(1),
  friends: z.array(
    z.object({
      puuid: z.string(),
      gameName: z.string(),
      tagLine: z.string(),
      region: regionSchema.optional().default("eun1"),
    })
  ),
});

export type ImportData = z.infer<typeof importSchema>;
