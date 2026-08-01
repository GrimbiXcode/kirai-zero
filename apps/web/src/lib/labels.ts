import type { ItemKind, Stance, Visibility } from "shared";
import { t } from "../i18n";

// The enum values double as the second half of their translation key, so a new
// value in `shared` fails the typecheck here until it has a German label.
export const kindLabel = (kind: ItemKind): string => t(`kind.${kind}`);
export const stanceLabel = (stance: Stance): string => t(`lists.stance.${stance}`);
export const visibilityLabel = (visibility: Visibility): string =>
  t(`lists.visibility.${visibility}`);
