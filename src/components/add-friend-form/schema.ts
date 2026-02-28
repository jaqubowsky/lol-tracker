import { z } from "zod";

export const riotIdSchema = z
  .string()
  .trim()
  .min(1, "Wpisz Riot ID")
  .regex(
    /^.+#.+$/,
    "Nieprawidłowy format — wpisz Nazwa#TAG"
  )
  .transform((val) => {
    const [gameName, ...rest] = val.split("#");
    const tagLine = rest.join("#");
    return { gameName: gameName.trim(), tagLine: tagLine.trim() };
  });
